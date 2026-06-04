import React, { useEffect, useRef } from 'react';
import { usePOSStore, getItemPackSize, CartItem } from '../../store/posStore';
import { supabase } from '../../lib/supabaseClient';
import { recordStockMovement, postJournalEntry, logAuditEvent } from '../../services/ledgerService';
import { toast } from 'sonner';

export function SyncManager() {
  const { offlineQueue, removeSaleFromOfflineQueue } = usePOSStore();
  const isSyncingRef = useRef(false);
  const retryCountRef = useRef<Record<string, number>>({});

  const processSync = async () => {
    // 1. Connectivity check
    if (!navigator.onLine) return;

    // 2. Queue empty check
    if (offlineQueue.length === 0) return;

    // 3. Single-flight lock
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    const sale = offlineQueue[0];

    try {
      console.log(`[SyncManager] Background sync started. Found ${offlineQueue.length} transactions pending.`);

      // Ensure user session is verified
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        console.warn('[SyncManager] No authenticated user found. Postponing sync until signed in.');
        isSyncingRef.current = false;
        return;
      }

      const userId = userData.user.id;

      // Determine businessId / branchId with robust DB resolution
      let businessId = '';
      let branchId = '';

      const { data: bUser } = await supabase
        .from('business_users')
        .select('business_id, branch_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (bUser?.business_id && bUser.business_id !== 'default_business') {
        businessId = bUser.business_id;
        branchId = bUser.branch_id && bUser.branch_id !== 'default_branch' ? bUser.branch_id : '';
      }

      if (!businessId) {
        const { data: fallbackB } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
        if (fallbackB?.id) {
          businessId = fallbackB.id;
        } else {
          const { data: newB } = await supabase.from('businesses').insert({ name: 'Default Business' }).select().single();
          if (newB) {
            businessId = newB.id;
          }
        }
      }

      if (businessId && !branchId) {
        const { data: fallbackBr } = await supabase.from('branches').select('id').eq('business_id', businessId).limit(1).maybeSingle();
        if (fallbackBr?.id) {
          branchId = fallbackBr.id;
        } else {
          const { data: newBr } = await supabase.from('branches').insert({ business_id: businessId, name: 'Default Branch' }).select().single();
          if (newBr) {
            branchId = newBr.id;
          }
        }
      }

      // Check if sale has already been recorded in Supabase to prevent duplication
      const { data: existingSale, error: checkError } = await supabase
        .from('sales')
        .select('id')
        .eq('receiptNumber', sale.receiptNumber)
        .maybeSingle();

      if (checkError) {
        console.warn('[SyncManager] Error checking duplicate receipts:', checkError);
      }

      let saleDocId = existingSale?.id;

      if (!saleDocId) {
        // Prepare main sale payload
        const salePayload: any = {
          receipt_number: sale.receiptNumber,
          receiptNumber: sale.receiptNumber,
          total: sale.total,
          vat_total: sale.vatTotal,
          vatTotal: sale.vatTotal,
          discount_total: sale.discountTotal,
          discountTotal: sale.discountTotal,
          subtotal: sale.subtotal || (sale.total - sale.vatTotal),
          payment_method: sale.payments.length > 0 ? sale.payments[0].method : 'cash',
          payments: sale.payments,
          items: sale.items,
          status: 'COMPLETED',
          created_at: new Date(sale.timestamp).toISOString(),
          business_id: businessId,
        };

        if (branchId && branchId !== 'default_branch') {
          salePayload.branch_id = branchId;
        }
        if (userId) {
          salePayload.user_id = userId;
        }
        if (sale.customerId) {
          salePayload.customer_id = sale.customerId;
          salePayload.customerId = sale.customerId;
        }

        // Step A: Insert Sale Record
        const { data: saleDoc, error: saleErr } = await supabase
          .from('sales')
          .insert([salePayload])
          .select()
          .single();

        if (saleErr || !saleDoc) {
          throw new Error(saleErr?.message || 'Could not instantiate sale row in Supabase.');
        }

        saleDocId = saleDoc.id;

        // Step B: Insert Sale Items
        if (sale.items && sale.items.length > 0) {
          const itemsPayload = sale.items.map((item) => ({
            sale_id: saleDocId,
            product_id: item.product.id,
            quantity: item.quantity,
            price: item.unitPrice,
            unit_price: item.unitPrice,
            line_total: item.subtotal,
            vat_amount: item.vatAmount,
          }));

          const { error: itemsErr } = await supabase.from('sale_items').insert(itemsPayload);
          if (itemsErr) {
            console.warn('[SyncManager] Error inserting sale items:', itemsErr);
          }
        }
      } else {
        console.log(`[SyncManager] Sale with receipt ${sale.receiptNumber} already exists in database. Skipping row insert.`);
      }

      const isNewSale = !existingSale;

      if (isNewSale) {
        // Step C: Trigger secondary accounting and warehouse routines (wrapped safely in catches)
      
        // 1. Stock Movements
        try {
          if (sale.items && sale.items.length > 0) {
            await Promise.all(
              sale.items.map((item) => {
                const multiplier = getItemPackSize(item);
                return recordStockMovement(
                  businessId,
                  branchId,
                  item.product.id,
                  -Math.abs(item.quantity * multiplier),
                  'POS_SALE',
                  userId,
                  sale.receiptNumber,
                  item.product.wholesalePrice || 0
                );
              })
            );
          }
        } catch (e) {
          console.warn('[SyncManager] Stock movements registration error:', e);
        }

        // 2. Journal Entry
        const creditPayment = sale.payments.find((p) => p.method === 'credit');
        const isCredit = !!creditPayment;
        try {
          const mainAccount = isCredit ? '1100' : '1000'; // AR vs Cash Till

          const ledgerLines = [
            { accountCode: mainAccount, debit: sale.total, credit: 0, description: `Receipt payment ${sale.receiptNumber}` },
            { accountCode: '4000', debit: 0, credit: sale.total, description: `Sales Revenue registered [${sale.receiptNumber}]` }
          ];

          await postJournalEntry(
            businessId,
            branchId,
            userId,
            sale.receiptNumber,
            `POS Sale Checkout ${sale.receiptNumber}`,
            ledgerLines
          );
        } catch (e) {
          console.warn('[SyncManager] Ledger recording error:', e);
        }

        // 3. Keep Register Session Stats Updated
        try {
          const { data: openSession } = await supabase
            .from('register_sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'OPEN')
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (openSession) {
            await supabase
              .from('register_sessions')
              .update({
                sales_total: Number(openSession.sales_total || 0) + sale.total,
                sales_count: Number(openSession.sales_count || 0) + 1,
                expected_balance: Number(openSession.expected_balance || 0) + sale.total,
              })
              .eq('id', openSession.id);
          }
        } catch (e) {
          console.warn('[SyncManager] Register session stats update bypassed:', e);
        }

        // 3.5 Log cash payment in cash_drawer_logs if any cash portion exists
        try {
          let totalCashPortion = 0;
          if (sale.payments && sale.payments.length > 0) {
            sale.payments.forEach((p: any) => {
              const m = String(p.method || p.payment_method || '').toLowerCase();
              if (m === 'cash' || m === 'usd_cash' || m === 'zig_cash' || m === 'zwg_cash') {
                totalCashPortion += Number(p.amount || 0);
              }
            });
          } else {
            const pm = String((sale as any).payment_method || '').toLowerCase();
            if (pm === 'cash' || pm === 'usd_cash' || pm === 'zig_cash' || pm === 'zwg_cash') {
              totalCashPortion = Number(sale.total || 0);
            }
          }

          if (totalCashPortion > 0) {
            await supabase.from('cash_drawer_logs').insert([{
              business_id: businessId,
              branch_id: branchId || null,
              amount: totalCashPortion,
              type: 'cash_in',
              transaction_type: 'cash_sale',
              notes: `POS Cash Payment received for Receipt #${sale.receiptNumber} (Offline Sync)`,
              created_at: new Date(sale.timestamp || Date.now()).toISOString()
            }]);
          }
        } catch (e) {
          console.warn('[SyncManager] Cash drawer logging bypassed:', e);
        }

        // 4. Update Customer Balance if credit was extended
        try {
          if (isCredit && sale.customerId) {
            const { data: custData } = await supabase
              .from('customers')
              .select('*')
              .eq('id', sale.customerId)
              .single();

            if (custData && creditPayment) {
              const newBalance = Number(custData.balance || 0) + creditPayment.amount;
              await supabase.from('customers').update({ balance: newBalance }).eq('id', sale.customerId);
            }
          }
        } catch (e) {
          console.warn('[SyncManager] Customer credit update bypassed:', e);
        }

        // 5. Cash Drawer Log
        try {
          const cashPayment = sale.payments.find((p) => p.method === 'cash' || p.method === 'usd_cash');
          if (cashPayment && saleDocId) {
            await supabase.from('cash_drawer_logs').insert([{
              business_id: businessId,
              branch_id: branchId,
              amount: cashPayment.amount,
              type: 'sale',
              transaction_type: 'cash_sale',
              notes: `Sale ${sale.receiptNumber}`,
              created_at: new Date(sale.timestamp).toISOString()
            }]);
          }
        } catch (e) {
          console.warn('[SyncManager] Cash drawer log write bypassed:', e);
        }

        // 6. Log Audit Trail
        try {
          await logAuditEvent(
            businessId,
            userId,
            'CREATE',
            'POS',
            null,
            { receipt: sale.receiptNumber, total: sale.total, source: 'offline_sync' }
          );
        } catch (e) {
          console.warn('[SyncManager] Audit log write bypassed:', e);
        }
      }

      // Step D: Clean Removal
      removeSaleFromOfflineQueue(sale.id);
      if (retryCountRef.current[sale.id] !== undefined) {
        delete retryCountRef.current[sale.id];
      }
      console.log(`[SyncManager] Background Sync: Transaction ${sale.receiptNumber} successfully synchronized over active internet connection!`);
      console.log(`[SyncManager] Successfully completed background sync of sale ${sale.receiptNumber}.`);

    } catch (err: any) {
      console.error('[SyncManager] Error syncing transaction from queue:', err);
      
      // Increment failure count to guard against infinite browser lockups on schema deviations or permanent errors
      if (sale?.id) {
        const count = (retryCountRef.current[sale.id] || 0) + 1;
        retryCountRef.current[sale.id] = count;
        
        if (count >= 3) {
          console.warn(`[SyncManager] Removing blocked transaction ${sale.receiptNumber} after 3 continuous failures.`);
          removeSaleFromOfflineQueue(sale.id);
          delete retryCountRef.current[sale.id];
          console.error(`[SyncManager] Auto-Sync: Bypassed receipt ${sale.receiptNumber} after 3 continuous failures to unblock other pending transactions.`);
        }
      }
    } finally {
      isSyncingRef.current = false;
      // After finishing one item, call setTimeout(processSync, count >= 3 ? 1000 : 0) to avoid excessive spinning on error blocks
      const saleId = sale?.id;
      const failCount = saleId ? (retryCountRef.current[saleId] || 0) : 0;
      const delay = failCount > 0 ? 3000 : 0; // Wait 3s before retrying a failed transaction to alleviate server hammering
      setTimeout(processSync, delay);
    }
  };

  useEffect(() => {
    if (navigator.onLine && offlineQueue.length > 0) {
      processSync();
    }
  }, [offlineQueue]);

  useEffect(() => {
    const handleOnline = () => {
      if (offlineQueue.length > 0) processSync();
    };

    const handleManualSync = () => {
      console.log('[SyncManager] Manual sync trigger received via global event.');
      if (offlineQueue.length > 0) processSync();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('tareza-trigger-sync', handleManualSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('tareza-trigger-sync', handleManualSync);
    };
  }, [offlineQueue]);

  return null;
}
