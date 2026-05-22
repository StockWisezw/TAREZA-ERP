import React, { useState, useEffect } from 'react';
import { usePOSStore } from '../store/posStore';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';

export function SyncStatusIndicator() {
  const { offlineQueue } = usePOSStore();
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const pendingCount = offlineQueue.length;

  if (pendingCount === 0 && isOnline) {
    return (
      <div className="flex items-center text-emerald-600 dark:text-emerald-400 group cursor-default" title="All synced to cloud">
        <Cloud className="w-4 h-4 mr-1.5" />
        <span className="text-xs font-medium hidden sm:inline-block">Synced</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center text-amber-500 group cursor-default" title={`${pendingCount} pending offline`}>
        <CloudOff className="w-4 h-4 mr-1.5" />
        <span className="text-xs font-medium hidden sm:inline-block">
          Offline {pendingCount > 0 && `(${pendingCount})`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center text-blue-500 group cursor-default" title={`Syncing ${pendingCount} items`}>
      <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
      <span className="text-xs font-medium hidden sm:inline-block">Syncing {pendingCount} actions...</span>
    </div>
  );
}
