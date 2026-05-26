import { useEffect, useState, useRef } from 'react';
import { usePOSStore, SaleRecord } from '../../store/posStore';
import { toast } from 'sonner';
import {
  getOpenRegisterSession,
  recordStockMovement,
  postJournalEntry,
  logAuditEvent
} from '../../services/ledgerService';
import { db, doc, getDoc, updateDoc } from '../../lib/supabaseClient';

const CHANNEL_NAME = 'tareza-pos-sync-channel';

interface SyncMessage {
  type: 'SYNC_START' | 'SYNC_SUCCESS' | 'SYNC_FAIL';
  saleId: string;
  receiptNumber?: string;
}

export function SyncManager() {
  const { offlineQueue, removeSaleFromOfflineQueue } = usePOSStore();
  const [syncingByOtherTabIds, setSyncingByOtherTabIds] = useState<Set<string>>(new Set());
  
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  // Initialize BroadcastChannel to coordinate multi-tab sync operations
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    const handleMessage = (event: MessageEvent<SyncMessage>) => {
      const { type, saleId, receiptNumber } = event.data;

      switch (type) {
        case 'SYNC_START':
          setSyncingByOtherTabIds(prev => {
            const next = new Set(prev);
            next.add(saleId);
            return next;
          });
          break;

        case 'SYNC_SUCCESS':
          // Critical: Keep other tabs' in-memory Zustand store perfectly synchronized in real-time
          removeSaleFromOfflineQueue(saleId);
          setSyncingByOtherTabIds(prev => {
            const next = new Set(prev);
            next.delete(saleId);
            return next;
          });
          if (receiptNumber) {
            toast.success(`POS Sale Sync: Offline receipt ${receiptNumber} was synced successfully by another POS tab.`);
          }
          break;

        case 'SYNC_FAIL':
          setSyncingByOtherTabIds(prev => {
            const next = new Set(prev);
            next.delete(saleId);
            return next;
          });
          break;
      }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [removeSaleFromOfflineQueue]);

  const syncOfflineSale = async (sale: SaleRecord) => {
    if (!navigator.onLine) return;
    if (syncingByOtherTabIds.has(sale.id)) return;

    // Broadcast our intent to sync this transaction to prevent other open tabs from attempting the same sale
    channelRef.current?.postMessage({
      type: 'SYNC_START',
      saleId: sale.id
    });

    try {
      const { supabase } = await import('../../lib/supabaseClient');

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        throw new Error('No active user context found. Authenticate to sync offline sales.');
      }

      let businessId = 'default_business';
      let branchId = 'default_branch';

      const { data: businessData } = await supabase.from('business_users')
        .select('business_id, branch_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      if (businessData?.business_id) businessId = businessData.business_id;
      if (businessData?.branch_id) branchId = businessData.branch_id;

      // Ensure we have an active open cashier register session on Firestore to sync this sale
      let activeRS = await getOpenRegisterSession(businessId, userData.user.id);
      if (!activeRS) {
        // Fallback: search for any OPEN session in the same business
        const { data: anyOpen } = await supabase.from('register_sessions')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'OPEN')
          .limit(1)
          .maybeSingle();

        if (anyOpen) {
          activeRS = anyOpen;
        } else {
          // Double Fallback: Auto-create an open shift session with $0 float so we do not block POS offline-sales syncing!
          const { data: newSession, error: createError } = await supabase.from('register_sessions')
            .insert({
              business_id: businessId,
              branch_id: branchId !== 'default_branch' ? branchId : null,
              user_id: userData.user.id,
              opening_balance: 0,
              expected_balance: 0,
              status: 'OPEN',
              opened_at: new Date().toISOString()
            })
            .select()
            .single();

          if (!createError && newSession) {
            activeRS = newSession;
            console.log(`[SyncManager] Auto-created shift register session ${newSession.id} for seamless offline sync.`);
          } else {
            console.error('[SyncManager] Failed to auto-create register session:', createError);
            throw new Error('No active shift session. Please start a shift first in your main tab.');
          }
        }
      }

      // Safeguard Idempotency: Don't insert duplicates if transaction was successfully synced previously
      const { data: existingSales } = await supabase.from('sales')
        .select('id')
        .eq('receipt_number', sale.receiptNumber)
        .limit(1)
        .maybeSingle();

      let saleDoc;
      if (existingSales) {
        saleDoc = existingSales;
        console.log(`[SyncManager] Sale with receipt ${sale.receiptNumber} already exists in Firestore. Preventing duplication.`);
      } else {
        const salePayload: any = {
          receipt_number: sale.receiptNumber,
          total_amount: sale.total,
          total_tax_amount: sale.vatTotal,
          total_discount: sale.discountTotal,
          payment_method: sale.payments.length > 0 ? sale.payments[0].method : 'cash',
          status: 'COMPLETED',
          register_session_id: activeRS.id,
          created_at: sale.timestamp || new Date().toISOString()
        };
        if (businessId) salePayload.business_id = businessId;
        if (sale.customerId) salePayload.customer_id = sale.customerId;

        const { data: newDoc, error: saleErr } = await supabase.from('sales').insert([salePayload]).select().single();
        if (saleErr || !newDoc) {
          throw new Error(saleErr?.message || 'Failed to initialize sale document in Firestore.');
        }
        saleDoc = newDoc;

        // 1. Log sale items and update real-time stock levels
        if (sale.items.length > 0) {
          const itemsPayload = sale.items.map(item => ({
            sale_id: saleDoc.id,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            line_total: item.subtotal,
            vat_amount: item.vatAmount
          }));
          await supabase.from('sale_items').insert(itemsPayload);

          for (const item of sale.items) {
            try {
              await recordStockMovement(
                businessId,
                branchId,
                item.product.id,
                -Math.abs(item.quantity),
                'POS_SALE',
                userData.user.id,
                sale.receiptNumber,
                item.product.wholesalePrice
              );
            } catch (err) {
              console.error('[SyncManager] Failed to record stock movement:', err);
            }
          }
        }

        // 2. Double-Entry Accounting journal entries
        const creditPayment = sale.payments.find(p => p.method === 'credit');
        const isCredit = !!creditPayment;
        const mainAccount = isCredit ? '1100' : '1000';

        const ledgerLines = [
          { accountCode: mainAccount, debit: sale.total, credit: 0, description: `Receipt payment ${sale.receiptNumber}` },
          { accountCode: '4000', debit: 0, credit: sale.total, description: `Sales Revenue registered [${sale.receiptNumber}]` }
        ];

        try {
          await postJournalEntry(
            businessId,
            branchId,
            userData.user.id,
            sale.receiptNumber,
            `POS Sale Checkout ${sale.receiptNumber}`,
            ledgerLines
          );
        } catch (err) {
          console.error('[SyncManager] Failed to register ledger entry:', err);
        }

        // 3. Update active session values
        try {
          const sessRef = doc(db, 'register_sessions', activeRS.id);
          const sessSnap = await getDoc(sessRef);
          if (sessSnap.exists()) {
            const sessData = sessSnap.data();
            const currentTotalSales = Number(sessData.sales_total || 0) + sale.total;
            const currentCountSales = Number(sessData.sales_count || 0) + 1;
            const currentExpectedObj = Number(sessData.expected_balance || 0) + sale.total;
            await updateDoc(sessRef, {
              sales_total: currentTotalSales,
              sales_count: currentCountSales,
              expected_balance: currentExpectedObj
            });
          }
        } catch (err) {
          console.error('[SyncManager] Failed to update shift stats:', err);
        }

        // 4. Update Customer credit balances
        if (creditPayment && sale.customerId) {
          try {
            const { data: custData } = await supabase.from('customers').select('*').eq('id', sale.customerId).single();
            if (custData) {
              const newBalance = Number(custData.balance || 0) + creditPayment.amount;
              await supabase.from('customers').update({ balance: newBalance }).eq('id', sale.customerId);
            }
          } catch (err) {
            console.error('[SyncManager] Failed to update customer credit balance:', err);
          }
        }

        // 5. Update Cash Drawer records
        const cashPayment = sale.payments.find(p => p.method === 'cash' || p.method === 'usd_cash');
        if (cashPayment) {
          try {
            await supabase.from('cash_drawer_logs').insert([{
              amount: cashPayment.amount,
              transaction_type: 'cash_sale',
              notes: `Sale ${sale.receiptNumber}`,
              sale_id: saleDoc.id,
              created_at: new Date().toISOString()
            }]);
          } catch (err) {
            console.error('[SyncManager] Failed to write cash drawer log:', err);
          }
        }

        // 6. Log secure Audit Trail
        try {
          await logAuditEvent(
            businessId,
            userData.user.id,
            'CREATE',
            'POS',
            null,
            { receipt: sale.receiptNumber, total: sale.total }
          );
        } catch (err) {
          console.error('[SyncManager] Failed to create audit log:', err);
        }
      }

      // Success: Remove from offlineQueue in Zustand/localStorage and broadcast success
      removeSaleFromOfflineQueue(sale.id);
      channelRef.current?.postMessage({
        type: 'SYNC_SUCCESS',
        saleId: sale.id,
        receiptNumber: sale.receiptNumber
      });

      toast.success(`POS Sale Sync: Offline receipt ${sale.receiptNumber} successfully synced with Firebase.`);
    } catch (error) {
      console.error('[SyncManager] Error syncing transaction:', error);

      // Reset sync permission across other tabs
      channelRef.current?.postMessage({
        type: 'SYNC_FAIL',
        saleId: sale.id
      });

      // Avoid spamming offline notifications if the backend is simply unreachable
      const errMsg = error instanceof Error ? error.message : String(error);
      if (!errMsg.includes('unavailable') && !errMsg.includes('No active cashier register session')) {
        toast.error(`POS Sale Sync Delay: Could not upload receipt ${sale.receiptNumber}. Retrying in background.`);
      }
    }
  };

  useEffect(() => {
    const processSync = async () => {
      if (isSyncingRef.current) return;
      if (!navigator.onLine) return;
      if (offlineQueue.length === 0) return;

      isSyncingRef.current = true;
      try {
        for (const sale of offlineQueue) {
          if (syncingByOtherTabIds.has(sale.id)) {
            continue; // Skipped because another open tab is currently processing this ID
          }
          await syncOfflineSale(sale);
        }
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Process immediately
    processSync();

    const handleOnline = () => {
      console.log('[SyncManager] Network status: ONLINE. Commencing background queue sync.');
      processSync();
    };

    window.addEventListener('online', handleOnline);

    // Periodic synchronization check every 15 seconds
    const interval = setInterval(processSync, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [offlineQueue, syncingByOtherTabIds]);

  return null; // Headless service
}
