import React from 'react';
import { 
  Coins, 
  HelpCircle, 
  Clock, 
  Check, 
  User, 
  Play, 
  Pause, 
  X 
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../ui/dialog';
import { toast } from 'sonner';

interface SessionManagerProps {
  activeSession?: any;
  sessionLoading?: boolean;
  openingFloat: string;
  setOpeningFloat: (val: string) => void;
  requireFloat: boolean;
  setRequireFloat?: (val: boolean) => void;
  closingActual?: string;
  setClosingActual?: (val: string) => void;
  showCloseShift?: boolean;
  setShowCloseShift?: (val: boolean) => void;
  showShiftDetails?: boolean;
  setShowShiftDetails?: (val: boolean) => void;
  handleStartShift: () => Promise<boolean>;
  handleEndShift?: () => Promise<boolean>;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  activeSession,
  sessionLoading,
  openingFloat,
  setOpeningFloat,
  requireFloat,
  setRequireFloat,
  closingActual,
  setClosingActual,
  showCloseShift,
  setShowCloseShift,
  showShiftDetails,
  setShowShiftDetails,
  handleStartShift,
  handleEndShift
}) => {
  if (sessionLoading) {
    return (
      <div className="fixed inset-0 bg-zinc-950/20 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl flex flex-col items-center gap-3 shadow-xl">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-350 border-t-zinc-800 animate-spin" />
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Auditing active register session...</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md bg-white dark:bg-zinc-90 w border border-zinc-200 dark:border-zinc-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-zinc-800" />
          <CardHeader className="pt-6">
            <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-2">
              <Coins className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
            </div>
            <CardTitle className="text-xl font-bold text-zinc-900 dark:text-white font-sans tracking-tight">Initialize Cashier Shift</CardTitle>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              An active register session and opening float are required to activate the POS terminal and maintain continuous transactional integrity.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                Register Opening Cash Float (USD) {requireFloat ? '*' : '(Optional)'}
              </label>
              <Input
                type="number"
                placeholder={requireFloat ? "100.00" : "0.00 (Optional - Defaults to zero)"}
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="w-full font-mono text-lg py-5 pl-3"
              />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-805 rounded-xl transition-all">
              <div className="space-y-0.5">
                <label htmlFor="pos-req-float-toggle" className="text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer block">Require Cash Float to Open</label>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 max-w-[210px] block leading-normal">
                  When disabled, cashier shifts start immediately with custom or zero balances.
                </span>
              </div>
              <Switch 
                id="pos-req-float-toggle" 
                checked={requireFloat} 
                onCheckedChange={(val) => {
                  setRequireFloat(val);
                  localStorage.setItem('tareza_require_float', String(val));
                  if (!val) {
                    setOpeningFloat('0');
                  } else {
                    setOpeningFloat('100');
                  }
                  toast.success(val ? "Float requirement activated." : "Float requirement disabled.");
                }} 
              />
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-450 flex items-start gap-2">
              <span className="text-zinc-400 mt-0.5">ℹ</span>
              <span>All sales completed under this terminal shift will be balanced automatically to your cashier ID and are fully auditable.</span>
            </div>
          </CardContent>
          <DialogFooter className="p-6 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-2">
            <Button onClick={handleStartShift} className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 py-5 font-bold text-sm select-none cursor-pointer">
              Open Register Shift
            </Button>
          </DialogFooter>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Session Active Indicator Dropdown */}
      <div className="flex items-center gap-2">
        <Dialog open={showShiftDetails} onOpenChange={setShowShiftDetails}>
          <Button 
            onClick={() => setShowShiftDetails(true)}
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 h-8 border-emerald-200 hover:bg-emerald-50 text-emerald-700 bg-white dark:bg-zinc-900 dark:border-emerald-800/30 text-[10px] font-bold uppercase tracking-wider transition-all select-none cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>Shift Active</span>
          </Button>

          <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-90 w text-zinc-900 dark:text-zinc-100">
            <DialogHeader>
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                Active Register Shift Details
              </CardTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3">
              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60">
                  <span className="text-zinc-400 font-semibold block mb-0.5">Shift Opened At</span>
                  <span className="font-bold">
                    {new Date(activeSession.opened_at).toLocaleTimeString() || 'Just now'}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60">
                  <span className="text-zinc-400 font-semibold block mb-0.5">Opening Float Balance</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-100 font-mono">
                    ${(activeSession.opening_balance || 0).toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60">
                  <span className="text-zinc-400 font-semibold block mb-0.5">Estimated Draw Balance</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-100 font-mono">
                    ${(activeSession.expected_balance || 0).toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60">
                  <span className="text-zinc-400 font-semibold block mb-0.5">Register Sale Counter</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {activeSession.sales_count || 0} Sales
                  </span>
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 rounded-xl p-3 text-[11px] leading-relaxed">
                ℹ Cashier is fully responsible for discrepancy errors. Ending this Shift is irreversible.
              </div>
            </div>
            <DialogFooter className="bg-zinc-50 dark:bg-zinc-900 p-4 border-t border-zinc-100 dark:border-zinc-800 -mx-6 -mb-6 mt-4 gap-2">
              <Button 
                onClick={() => {
                  setShowShiftDetails(false);
                  setClosingActual(activeSession.expected_balance?.toString() || '');
                  setShowCloseShift(true);
                }} 
                className="w-full bg-red-650 hover:bg-red-700 text-white rounded-xl py-2.5 text-xs font-bold select-none cursor-pointer"
              >
                End Active Cashier Shift
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Close shift verification modal */}
        <Dialog open={showCloseShift} onOpenChange={setShowCloseShift}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-90 w text-zinc-900 dark:text-zinc-100">
            <DialogHeader>
              <CardTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
                <Pause className="w-5 h-5" /> End Cashier Shift Audit
              </CardTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3">
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                To close out bookkeeping records, please physically count all hardware cash drawer currencies and log the exact cash counter total below:
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Actual Counted Float (USD) *
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={closingActual}
                  onChange={(e) => setClosingActual(e.target.value)}
                  className="w-full font-mono text-base py-4"
                />
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl text-[10.5px] border border-zinc-150 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                Current estimate expected: <span className="font-bold text-zinc-850 dark:text-white font-mono">${(activeSession.expected_balance || 0).toFixed(2)}</span>. Overages or shortages will raise compliance variances.
              </div>
            </div>
            <DialogFooter className="bg-zinc-50 dark:bg-zinc-900 p-4 border-t border-zinc-100 dark:border-zinc-800 -mx-6 -mb-6 mt-4 flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCloseShift(false);
                  setShowShiftDetails(true);
                }} 
                className="rounded-xl grow text-xs font-bold select-none cursor-pointer"
              >
                Go Back
              </Button>
              <Button 
                onClick={handleEndShift}
                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-250 text-white dark:text-zinc-950 rounded-xl grow text-xs font-bold select-none cursor-pointer"
              >
                Confirm End Shift
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};
