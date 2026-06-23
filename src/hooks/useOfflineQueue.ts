import { useState, useEffect } from 'react';
import { usePOSStore } from '../store/posStore';
import { toast } from 'sonner';

export function useOfflineQueue() {
  const { offlineQueue, clearOfflineQueue } = usePOSStore();
  const [isSyncing, setIsSyncing] = useState(false);

  const syncOfflineSales = async () => {
    if (offlineQueue.length === 0) return;
    setIsSyncing(true);
    try {
      // Dispatch event to SyncManager to trigger the fully featured sync pipeline
      window.dispatchEvent(new Event('tareza-trigger-sync'));
      await new Promise(resolve => setTimeout(resolve, 1500));
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      toast.info('Network connection recovered! Triggering background sync manager...');
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
