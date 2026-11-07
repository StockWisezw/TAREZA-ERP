import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function OfflineStatusBadge() {
  const [isOnline, setIsOnline] = useState<boolean>(typeof window !== 'undefined' ? window.navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const checkConnectivity = () => {
    const netOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;
    setIsOnline(netOnline);
  };

  useEffect(() => {
    checkConnectivity();

    const handleOnline = () => {
      checkConnectivity();
    };
    const handleOffline = () => {
      checkConnectivity();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(checkConnectivity, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleBadgeClick = async () => {
    if (!isOnline) {
      toast.info('POS is running in Offline-First mode. All sales and shift data are recorded safely in local storage.');
      return;
    }

    setIsSyncing(true);
    const syncToast = toast.loading('Initiating manual sync to cloud...');
    try {
      const { syncOfflineDatabase } = await import('../lib/firebaseClient');
      await syncOfflineDatabase();

      const { offlineSyncEngine } = await import('../services/offlineSyncEngine');
      await offlineSyncEngine.sync();

      window.dispatchEvent(new CustomEvent('tareza-trigger-sync'));
      toast.success('Offline transactions synced with cloud!', { id: syncToast });
    } catch (err: any) {
      toast.error('Sync failed: ' + (err?.message || String(err)), { id: syncToast });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div 
      onClick={handleBadgeClick} 
      className="flex items-center select-none cursor-pointer hover:opacity-90 active:scale-95 transition-transform" 
      id="offline-status-badge"
      title={isOnline ? "Online (Connected). Click to manually sync data to cloud." : "Offline-First Mode Active. All sales saved locally."}
    >
      {isOnline ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 transition-all duration-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          {isSyncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Online'}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 animate-pulse transition-all duration-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <WifiOff className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Offline (Local)</span>
        </span>
      )}
    </div>
  );
}
