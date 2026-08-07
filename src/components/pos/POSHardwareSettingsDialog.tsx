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
import { cn } from '../../lib/utils';
import { Monitor, Cpu, Fingerprint, Maximize, Sliders, Layout } from 'lucide-react';

interface POSHardwareSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posScale: '75' | '85' | '90' | '100' | '110';
  setPosScale: (scale: '75' | '85' | '90' | '100' | '110') => void;
  hardwareOptimize: boolean;
  setHardwareOptimize: (val: boolean) => void;
  touchOptimized: boolean;
  setTouchOptimized: (val: boolean) => void;
  hideHeader: boolean;
  setHideHeader: (val: boolean) => void;
  scaleMode: 'zoom' | 'transform' | 'vector';
  setScaleMode: (mode: 'zoom' | 'transform' | 'vector') => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

export function POSHardwareSettingsDialog({
  open,
  onOpenChange,
  posScale,
  setPosScale,
  hardwareOptimize,
  setHardwareOptimize,
  touchOptimized,
  setTouchOptimized,
  hideHeader,
  setHideHeader,
  scaleMode,
  setScaleMode,
  isFullscreen,
  toggleFullscreen
}: POSHardwareSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6">
        <DialogHeader className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <DialogTitle className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Sliders className="h-5 w-5 text-blue-600" />
            POS Hardware & Screen Resolution Setup
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
            Configure screen scaling, touch response, and hardware acceleration for optimal terminal performance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3">
          {/* Zoom / Scale Selector */}
          <div className="space-y-2 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div className="flex justify-between items-baseline">
              <label className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-zinc-500" />
                Screen & Resolution Vector Scale
              </label>
              <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {posScale}%
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-tight">
              Adjust vector scale to fit 8-inch, 10-inch, 15-inch, or dual-screen cashier displays without horizontal scrolling.
            </p>
            <div className="grid grid-cols-5 gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-1">
              {(['75', '85', '90', '100', '110'] as const).map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => {
                    setPosScale(scale);
                    toast.success(`POS Scale set to ${scale}%`);
                  }}
                  className={cn(
                    "py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center",
                    posScale === scale
                      ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs border border-zinc-200 dark:border-zinc-700"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  )}
                >
                  {scale}%
                </button>
              ))}
            </div>
          </div>

          {/* Touch Target Fingertip Assist */}
          <div className="flex items-start justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100/70 transition-all">
            <div className="flex gap-3">
              <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600 shrink-0 mt-0.5">
                <Fingerprint className="h-4 w-4" />
              </div>
              <div className="space-y-0.5 pr-2">
                <label className="text-xs font-bold text-zinc-800 cursor-pointer block" htmlFor="hw-touch">
                  Touch Target Fingertip Assist
                </label>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Increases row, button, and dropdown action heights to make precise fingertip clicking on old or uncalibrated touchscreen systems effortless.
                </p>
              </div>
            </div>
            <input
              id="hw-touch"
              type="checkbox"
              checked={touchOptimized}
              onChange={(e) => {
                setTouchOptimized(e.target.checked);
                toast.success(e.target.checked ? 'Touch Target Assist enabled' : 'Standard Target sizes restored');
              }}
              className="h-4.5 w-4.5 mt-1 cursor-pointer rounded border-zinc-300 text-blue-600 focus:ring-blue-500 shrink-0"
            />
          </div>

          {/* WebView Layout Header Collapse Option */}
          <div className="flex items-start justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100/70 transition-all">
            <div className="flex gap-3">
              <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600 shrink-0 mt-0.5">
                <Layout className="h-4 w-4" />
              </div>
              <div className="space-y-0.5 pr-2">
                <label className="text-xs font-bold text-zinc-800 cursor-pointer block" htmlFor="hw-hide-header">
                  Hide Main Layout Header
                </label>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Collapses and hides the main ERP top header bar to reclaim 64px of vertical screen height. Highly recommended for handheld smart POS terminals (like Q2I).
                </p>
              </div>
            </div>
            <input
              id="hw-hide-header"
              type="checkbox"
              checked={hideHeader}
              onChange={(e) => {
                setHideHeader(e.target.checked);
                toast.success(e.target.checked ? 'Main Header hidden to save screen space' : 'Main Header restored');
              }}
              className="h-4.5 w-4.5 mt-1 cursor-pointer rounded border-zinc-300 text-blue-600 focus:ring-blue-500 shrink-0"
            />
          </div>

          {/* Scaling Engine Selector */}
          <div className="space-y-2 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div className="flex justify-between items-baseline">
              <label className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-zinc-500" />
                Scaling Rendering Engine
              </label>
            </div>
            <p className="text-[10px] text-zinc-400 leading-tight">
              Change the underlying CSS rendering logic if the screen layout appears misaligned, cut-off, or click locations are offset.
            </p>
            <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-1">
              <button
                type="button"
                onClick={() => {
                  setScaleMode('vector');
                  toast.success('Scaling Engine: Crisp Native Vector');
                }}
                className={cn(
                  "py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center",
                  scaleMode === 'vector'
                    ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs border border-zinc-200 dark:border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                Crisp Vector
              </button>
              <button
                type="button"
                onClick={() => {
                  setScaleMode('transform');
                  toast.success('Scaling Engine: Standard CSS Transform');
                }}
                className={cn(
                  "py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center",
                  scaleMode === 'transform'
                    ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs border border-zinc-200 dark:border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                Transform
              </button>
              <button
                type="button"
                onClick={() => {
                  setScaleMode('zoom');
                  toast.success('Scaling Engine: Android WebView Zoom');
                }}
                className={cn(
                  "py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center",
                  scaleMode === 'zoom'
                    ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs border border-zinc-200 dark:border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                Zoom
              </button>
            </div>
          </div>

          {/* Fullscreen Terminal Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-blue-50/20 border border-blue-100 rounded-xl">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Maximize className="h-3.5 w-3.5 text-blue-600" />
                Terminal Fullscreen Mode
              </span>
              <p className="text-[10px] text-blue-600/70 leading-tight">
                Hide browser address bar, back buttons, and menus to maximize vertical real estate.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={toggleFullscreen}
              className="text-[11px] h-8.5 font-bold border-blue-200 bg-white hover:bg-blue-50 text-blue-700 cursor-pointer rounded-lg shrink-0 px-3"
            >
              {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            </Button>
          </div>
        </div>

        <DialogFooter className="bg-zinc-50 dark:bg-zinc-900 p-4 border-t border-zinc-100 dark:border-zinc-800 -mx-6 -mb-6 mt-5 flex justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-xl px-5 text-xs font-bold select-none cursor-pointer h-9"
          >
            Apply Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
