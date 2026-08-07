import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Sliders } from 'lucide-react';

interface OfflineModePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleOfflineMode: () => void;
}

export function OfflineModePromptDialog({
  open,
  onOpenChange,
  onToggleOfflineMode
}: OfflineModePromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
              <Sliders className="h-5 w-5 animate-pulse" />
            </span>
            Network Connection Interrupted
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 pt-1">
            You appear to be offline or experiencing high network latency. Would you like to enable Offline Queue Mode to prevent transaction delays?
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 text-xs text-zinc-600 dark:text-zinc-300 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-3.5 space-y-1.5 my-2">
          <p className="font-semibold text-amber-900 dark:text-amber-300">
            Offline Mode Benefits:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800 dark:text-amber-400">
            <li>Instant local receipt printing without waiting for database confirmation</li>
            <li>Automatic queuing in IndexedDB with zero risk of transaction loss</li>
            <li>Automatic background syncing as soon as connection is restored</li>
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-row justify-end pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold cursor-pointer"
          >
            Stay Online
          </Button>
          <Button
            onClick={() => {
              onToggleOfflineMode();
              onOpenChange(false);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 rounded-xl cursor-pointer"
          >
            Switch to Offline Mode
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
