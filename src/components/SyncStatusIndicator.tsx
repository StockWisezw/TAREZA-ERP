import React, { useState, useEffect } from 'react';
import { usePOSStore } from '../store/posStore';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverTitle, PopoverDescription } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { toast } from 'sonner';

export function SyncStatusIndicator() {
  const { offlineQueue } = usePOSStore();
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

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

  const handleManualSyncClick = () => {
    if (!navigator.onLine) {
      toast.error('Cannot sync: Internet connection is currently offline. Please check your networks.');
      return;
    }

    if (pendingCount === 0) {
      toast.info('All transactions are already synchronized to Supabase.');
      return;
    }

    setIsManualSyncing(true);
    toast.promise(
      new Promise<void>((resolve) => {
        // Dispatch custom global event to notify SyncManager
        window.dispatchEvent(new CustomEvent('tareza-trigger-sync'));
        
        // Wait 1.5s to let the background job execute, then resolve
        setTimeout(() => {
          setIsManualSyncing(false);
          resolve();
        }, 1500);
      }),
      {
        loading: 'Connecting to database and verifying queue...',
        success: 'Sync queue triggered! Live updates will begin instantly.',
        error: 'Failed to trigger sync.'
      }
    );
  };

  let triggerContent = null;

  if (pendingCount === 0 && isOnline) {
    triggerContent = (
      <div className="flex items-center text-emerald-600 dark:text-emerald-400 group cursor-pointer hover:opacity-80 transition-opacity" title="All transactions synced">
        <Cloud className="w-4 h-4 mr-1.5" />
        <span className="text-xs font-medium hidden sm:inline-block">Synced</span>
      </div>
    );
  } else {
    triggerContent = (
      <div className="flex items-center text-amber-500 group cursor-pointer hover:opacity-80 transition-opacity" title={`${pendingCount} offline pending`}>
        <CloudOff className="w-4 h-4 mr-1.5" />
        <span className="text-xs font-medium hidden sm:inline-block">
          Offline Queue ({pendingCount})
        </span>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger className="bg-transparent border-none p-0 flex items-center justify-center outline-none cursor-pointer">
        {triggerContent}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl" align="end">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <PopoverHeader>
            <PopoverTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Sync Status</PopoverTitle>
            <PopoverDescription className="text-xs text-zinc-500">
              {pendingCount === 0 
                ? "All transactions are saved safely." 
                : `${pendingCount} transaction${pendingCount !== 1 ? 's' : ''} stored locally in your offline queue.`}
            </PopoverDescription>
          </PopoverHeader>
        </div>
        
        {pendingCount > 0 ? (
          <ScrollArea className="h-64">
            <div className="p-2 space-y-1">
              {offlineQueue.map((sale) => (
                <div key={sale.id} className="text-sm p-3 rounded-md hover:bg-zinc-150 dark:hover:bg-zinc-800 flex justify-between items-start transition-colors">
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{sale.receiptNumber}</span>
                    <span className="text-xs text-zinc-500">{new Date(sale.timestamp).toLocaleString()}</span>
                    <span className="text-xs text-zinc-500 truncate mt-1">
                       {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}: {sale.items.map(i => i.product.name).join(', ')}
                    </span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap ml-4">${sale.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="p-6 text-center text-sm text-zinc-500 flex flex-col items-center">
            <Cloud className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mb-2" />
            <p className="font-medium">Your offline queue is empty!</p>
            <p className="text-xs text-zinc-450 mt-1">All transactions are fully synced up and secure.</p>
          </div>
        )}

        <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
          <Button 
            id="sync-now-button"
            variant="outline" 
            size="sm" 
            className="w-full text-xs font-semibold flex items-center justify-center gap-1.5"
            onClick={handleManualSyncClick}
            disabled={isManualSyncing || !isOnline}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
            {isOnline ? (pendingCount > 0 ? 'Sync Now' : 'Synced to Cloud') : 'Offline - Reconnect'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
