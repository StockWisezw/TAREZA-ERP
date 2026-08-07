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
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Calculator, Coins } from 'lucide-react';
import { toast } from 'sonner';

interface DenominationCalculatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calcCurrency: 'USD' | 'ZWG' | 'ZAR';
  setCalcCurrency: (cur: 'USD' | 'ZWG' | 'ZAR') => void;
  denominations: Record<string, Record<number, number>>;
  setDenominations: React.Dispatch<React.SetStateAction<Record<string, Record<number, number>>>>;
  coinTotals: Record<string, string>;
  setCoinTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  rates: Record<string, number>;
  onApplyCountedCash: (totalUsd: number) => void;
}

export function DenominationCalculatorModal({
  open,
  onOpenChange,
  calcCurrency,
  setCalcCurrency,
  denominations,
  setDenominations,
  coinTotals,
  setCoinTotals,
  rates,
  onApplyCountedCash
}: DenominationCalculatorModalProps) {
  
  const calculateTotalForCurrency = (currencyCode: 'USD' | 'ZWG' | 'ZAR') => {
    const denoms = denominations[currencyCode] || {};
    let noteTotal = 0;
    Object.entries(denoms).forEach(([denomStr, count]) => {
      noteTotal += Number(denomStr) * (count || 0);
    });
    const coinAmt = parseFloat(coinTotals[currencyCode] || '0') || 0;
    return noteTotal + coinAmt;
  };

  const currentLocalTotal = calculateTotalForCurrency(calcCurrency);
  const currentRate = rates[calcCurrency] || 1.0;
  const currentEquivalentUsd = calcCurrency === 'USD' ? currentLocalTotal : currentLocalTotal / currentRate;

  const totalUsdAcrossCurrencies = (
    calculateTotalForCurrency('USD') +
    (calculateTotalForCurrency('ZWG') / (rates.ZWG || 26.9181)) +
    (calculateTotalForCurrency('ZAR') / (rates.ZAR || 16.2229))
  );

  const handleNoteCountChange = (currencyCode: string, denom: number, val: string) => {
    const count = parseInt(val, 10) || 0;
    setDenominations(prev => ({
      ...prev,
      [currencyCode]: {
        ...(prev[currencyCode] || {}),
        [denom]: Math.max(0, count)
      }
    }));
  };

  const handleApply = () => {
    onApplyCountedCash(totalUsdAcrossCurrencies);
    onOpenChange(false);
    toast.success(`Total drawer cash recalculated: $${totalUsdAcrossCurrencies.toFixed(2)} USD applied`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-emerald-600" />
            Physical Cash Denomination Counter
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            Count notes & coins across multi-currency tills (USD, ZWG, ZAR) to compute exact total USD value.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Currency Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            {(['USD', 'ZWG', 'ZAR'] as const).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setCalcCurrency(curr)}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  calcCurrency === curr
                    ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {curr} {rates[curr] && curr !== 'USD' ? `(1 USD = ${rates[curr].toFixed(2)})` : ''}
              </button>
            ))}
          </div>

          {/* Denominations Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
            {Object.keys(denominations[calcCurrency] || {})
              .map(Number)
              .sort((a, b) => b - a)
              .map((denom) => {
                const count = denominations[calcCurrency]?.[denom] || 0;
                const subtotal = denom * count;
                return (
                  <div key={denom} className="p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                      <span>{calcCurrency} {denom} Note</span>
                      <span className="text-emerald-600">{subtotal.toFixed(0)}</span>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Qty"
                      value={count || ''}
                      onChange={(e) => handleNoteCountChange(calcCurrency, denom, e.target.value)}
                      className="h-8 text-xs font-semibold bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
                    />
                  </div>
                );
              })}
          </div>

          {/* Coins Entry */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-1">
            <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              Unsorted Loose Coins Total ({calcCurrency})
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={coinTotals[calcCurrency] || ''}
              onChange={(e) => setCoinTotals(prev => ({ ...prev, [calcCurrency]: e.target.value }))}
              className="h-8 text-xs font-semibold bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
            />
          </div>

          {/* Calculated Summary */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex justify-between items-center">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">
                {calcCurrency} Drawer Total: {currentLocalTotal.toFixed(2)}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                Total USD Across All Tills: ${totalUsdAcrossCurrencies.toFixed(2)} USD
              </span>
            </div>
            <Button
              onClick={handleApply}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 h-8 rounded-lg cursor-pointer"
            >
              Apply Counted Total
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
