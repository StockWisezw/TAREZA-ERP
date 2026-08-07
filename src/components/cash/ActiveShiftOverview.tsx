import React, { useState } from 'react';
import { RegisterSession, CashLog } from '../../hooks/useCashManagement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { 
  Lock, Unlock, DollarSign, Calculator, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, UserMinus, RotateCcw, Plus, Landmark
} from 'lucide-react';
import { toast } from 'sonner';

interface ActiveShiftOverviewProps {
  isDrawerOpen: boolean;
  activeSession: RegisterSession | null;
  startingFloatAmount: number;
  sessionCashSales: number;
  sessionOutflows: number;
  expectedCash: number;
  cashLogs: CashLog[];
  onOpenRegister: (floatInput: string) => Promise<void>;
  onCloseRegister: (countedCash: number, notes: string) => Promise<void>;
  onAddLog: (amount: string, type: string, notes: string) => Promise<void>;
  onReverseLog: (log: CashLog) => Promise<void>;
  onOpenDenominationCalc: () => void;
  requireFloat: boolean;
  showAdvanced: boolean;
}

export function ActiveShiftOverview({
  isDrawerOpen,
  activeSession,
  startingFloatAmount,
  sessionCashSales,
  sessionOutflows,
  expectedCash,
  cashLogs,
  onOpenRegister,
  onCloseRegister,
  onAddLog,
  onReverseLog,
  onOpenDenominationCalc,
  requireFloat,
  showAdvanced
}: ActiveShiftOverviewProps) {
  // Open Form
  const [startingFloatInput, setStartingFloatInput] = useState('');
  
  // Close Form
  const [countedCash, setCountedCash] = useState(0);
  const [closeNotes, setCloseNotes] = useState('');

  // Add Log Form
  const [entryAmount, setEntryAmount] = useState('');
  const [entryType, setEntryType] = useState('expense');
  const [entryNotes, setEntryNotes] = useState('');

  const formatLogType = (type: string) => {
    switch (type) {
      case 'opening_float': return 'Opening Float';
      case 'expense': return 'Micro Expense';
      case 'restock': return 'Emergency Restock';
      case 'owner_collection': return 'Owner Cash Drop';
      case 'cash_in': return 'Cash Inbound';
      case 'reversal_outflow': return 'Outflow Reversal';
      case 'reversal_inflow': return 'Inflow Reversal';
      case 'closing_count': return 'Shift Reconciliation';
      default: return type.replace('_', ' ');
    }
  };

  if (!isDrawerOpen) {
    return (
      <Card className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 rounded-2xl p-6">
        <div className="max-w-md mx-auto space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">Register Cash Drawer Locked</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Start a new cashier shift by verifying the starting physical float in the till.
            </p>
          </div>

          <div className="space-y-3 text-left bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Starting Float Amount (USD) {requireFloat && <span className="text-rose-500">*</span>}
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={startingFloatInput}
              onChange={(e) => setStartingFloatInput(e.target.value)}
              className="h-10 text-sm font-semibold rounded-xl"
            />
            <Button
              onClick={async () => {
                await onOpenRegister(startingFloatInput);
                setStartingFloatInput('');
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-10 rounded-xl cursor-pointer"
            >
              <Unlock className="h-4 w-4 mr-1.5" />
              Open Register Shift
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const variance = countedCash - expectedCash;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border border-zinc-200 dark:border-zinc-800 shadow-xs rounded-2xl p-4 bg-white dark:bg-zinc-900">
          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Starting Float</span>
          <div className="text-xl font-black text-zinc-900 dark:text-white mt-1">
            ${startingFloatAmount.toFixed(2)}
          </div>
          <span className="text-[10px] text-zinc-400 block mt-0.5">Physical opening cash</span>
        </Card>

        <Card className="border border-zinc-200 dark:border-zinc-800 shadow-xs rounded-2xl p-4 bg-white dark:bg-zinc-900">
          <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Shift Cash Sales</span>
          <div className="text-xl font-black text-emerald-600 mt-1">
            +${sessionCashSales.toFixed(2)}
          </div>
          <span className="text-[10px] text-zinc-400 block mt-0.5">Collected in POS receipts</span>
        </Card>

        <Card className="border border-zinc-200 dark:border-zinc-800 shadow-xs rounded-2xl p-4 bg-white dark:bg-zinc-900">
          <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider">Outflows & Expenses</span>
          <div className="text-xl font-black text-rose-600 mt-1">
            -${sessionOutflows.toFixed(2)}
          </div>
          <span className="text-[10px] text-zinc-400 block mt-0.5">Till payouts & drops</span>
        </Card>

        <Card className="border border-blue-200 dark:border-blue-900/50 shadow-xs rounded-2xl p-4 bg-blue-50/30 dark:bg-blue-950/20">
          <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Expected Cash in Till</span>
          <div className="text-xl font-black text-blue-700 dark:text-blue-400 mt-1">
            ${expectedCash.toFixed(2)}
          </div>
          <span className="text-[10px] text-blue-500 block mt-0.5">Computed drawer balance</span>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Till Actions & Reconciliation */}
        <div className="lg:col-span-1 space-y-6">
          {/* Add Till Log Card */}
          <Card className="border border-zinc-200 dark:border-zinc-800 shadow-xs rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600" />
                Register Cash Movement
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Record micro-expenses, owner drops, emergency restocks, or float additions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Transaction Type</Label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value)}
                  className="w-full h-9 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 mt-1"
                >
                  <option value="expense">Micro Expense (Payout)</option>
                  <option value="restock">Emergency Restock (Payout)</option>
                  <option value="owner_collection">Owner Cash Drop (Outflow)</option>
                  <option value="cash_in">Float Addition / Capital (Cash In)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Amount ($ USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  className="h-9 text-xs font-semibold rounded-xl mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Description / Reason</Label>
                <Input
                  placeholder="e.g., Office milk purchase, Supplier deposit"
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  className="h-9 text-xs font-semibold rounded-xl mt-1"
                />
              </div>

              <Button
                onClick={async () => {
                  await onAddLog(entryAmount, entryType, entryNotes);
                  setEntryAmount('');
                  setEntryNotes('');
                }}
                className="w-full bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 text-white dark:text-zinc-900 text-xs font-bold h-9 rounded-xl cursor-pointer mt-1"
              >
                Save Cash Movement
              </Button>
            </CardContent>
          </Card>

          {/* Freeze & Reconcile Shift Card */}
          <Card className="border border-amber-200 dark:border-amber-900/50 shadow-xs rounded-2xl bg-amber-50/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-600" />
                Close Shift & Reconcile
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Count physical cash in the till and verify against computed drawer balance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Denomination Counter</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenDenominationCalc}
                  className="h-7 text-xs font-semibold gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 cursor-pointer rounded-lg"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  Launch Counter
                </Button>
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Counted Physical Cash ($ USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={countedCash || ''}
                  onChange={(e) => setCountedCash(parseFloat(e.target.value) || 0)}
                  className="h-9 text-xs font-bold text-emerald-600 rounded-xl mt-1"
                />
              </div>

              {countedCash > 0 && Math.abs(variance) > 0.01 && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between font-bold ${variance < 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Variance Detected
                  </span>
                  <span>{variance < 0 ? '-' : '+'}${Math.abs(variance).toFixed(2)}</span>
                </div>
              )}

              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Shift Notes / Audit Explanation</Label>
                <Input
                  placeholder="Required if variance exists..."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="h-9 text-xs font-semibold rounded-xl mt-1"
                />
              </div>

              <Button
                onClick={async () => {
                  await onCloseRegister(countedCash, closeNotes);
                  setCountedCash(0);
                  setCloseNotes('');
                }}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold h-10 rounded-xl cursor-pointer"
              >
                <Lock className="h-4 w-4 mr-1.5" />
                Close Shift & Freeze Drawer
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Shift Cash Movement Trail */}
        <div className="lg:col-span-2">
          <Card className="border border-zinc-200 dark:border-zinc-800 shadow-xs rounded-2xl h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Landmark className="h-4 w-4 text-emerald-600" />
                Active Shift Audit Trail ({cashLogs.length} Entries)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Real-time log of till openings, expenses, owner drops, and reversals recorded during this shift.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Movement Type</th>
                      <th className="p-3">Notes / Reason</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {cashLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-zinc-400">
                          No cash movements recorded during this shift yet.
                        </td>
                      </tr>
                    ) : (
                      cashLogs.map((log) => {
                        const isReversed = log.notes?.startsWith('[REVERSED]');
                        const isInflow = ['cash_in', 'opening_float', 'reversal_outflow'].includes(log.transaction_type);

                        return (
                          <tr key={log.id} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors ${isReversed ? 'opacity-50 line-through bg-zinc-50/30' : ''}`}>
                            <td className="p-3 font-medium text-zinc-500 text-[11px]">
                              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3 font-bold text-zinc-800 dark:text-zinc-200">
                              {formatLogType(log.transaction_type)}
                            </td>
                            <td className="p-3 text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate">
                              {log.notes || '—'}
                            </td>
                            <td className={`p-3 text-right font-mono font-bold ${isInflow ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isInflow ? '+' : '-'}${Number(log.amount).toFixed(2)}
                            </td>
                            <td className="p-3 text-right">
                              {!isReversed && !log.transaction_type.startsWith('reversal_') && log.transaction_type !== 'opening_float' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onReverseLog(log)}
                                  className="h-6 text-[10px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer rounded-lg px-2"
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Reverse
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
