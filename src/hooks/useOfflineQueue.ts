import { useState, useEffect } from 'react';
import { usePOSStore, SaleRecord } from '../store/posStore';
import { toast } from 'sonner';
import { supabase } from '../lib/firebaseClient';

export function useOfflineQueue() {
  const { offlineQueue, removeSaleFromOfflineQueue, clearOfflineQueue } = usePOSStore();
  const [isSyncing, setIsSyncing] = useState(false);

  const syncOfflineSales = async () => {
    if (offlineQueue.length === 0) return;
    setIsSyncing(true);
    let successCount = 0;

    for (const sale of offlineQueue) {
      try {
        const payload = {
          receipt_number: sale.receiptNumber,
          subtotal: sale.subtotal,
          vat_total: sale.vatTotal,
          discount_total: sale.discountTotal,
          total: sale.total,
          payment_method: sale.payments?.[0]?.method || 'cash',
          payments: sale.payments,
          items: sale.items,
          status: 'synced',
          created_at: sale.timestamp,
          customer_id: sale.customerId || null,
          customer_name: sale.customerName || 'Valued Customer',
          branch_id: sale.branch_id || null,
        };

        const { error } = await supabase.from('sales').insert([payload]);
        if (!error) {
          removeSaleFromOfflineQueue(sale.id);
          successCount++;
        }
      } catch (err) {
        console.error('Error syncing offline sale record ID:', sale.id, err);
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully synchronized ${successCount} queued offline sales to direct database Cloud ledger!`);
    }
    setIsSyncing(false);
  };

  useEffect(() => {
    // Listen for network events
    const handleOnline = () => {
      toast.info('Network connection recovered! Syncing offline sales log...');
      syncOfflineSales();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [offlineQueue]);

  return {
    queueLength: offlineQueue.length,
    isSyncing,
    syncOfflineSales,
    clearQueue: clearOfflineQueue,
  };
}
