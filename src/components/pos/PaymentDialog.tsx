import React, { useState, useEffect } from 'react';
import { usePOSStore, PaymentMethod } from '../../store/posStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Banknote, CreditCard, Smartphone, CheckCircle2, UserCheck } from 'lucide-react';
import { Badge } from '../ui/badge';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function PaymentDialog({ open, onOpenChange, onComplete }: PaymentDialogProps) {
  const { getTotals, addPayment, removePayment, payments, currentCustomer } = usePOSStore();
  const totals = getTotals();
  
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('usd_cash');
  const [amountInput, setAmountInput] = useState<string>('');
  const [changeAmount, setChangeAmount] = useState<number>(0);

  const remainingBalance = totals.balance;

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setAmountInput('');
      setChangeAmount(0);
      if (currentCustomer && currentCustomer.creditLimit > 0) {
        setSelectedMethod('credit');
      } else {
        setSelectedMethod('usd_cash');
      }
    }
  }, [open, currentCustomer]);

  const handleAddPayment = () => {
    let amt = parseFloat(amountInput);
    if (isNaN(amt)) return;
    
    // If we have a negative balance (refund) and they entered a positive number,
    // automatically treat it as a negative payment representing cash out/refund.
    if (remainingBalance < 0 && amt > 0) {
      amt = -amt;
    }

    if (amt === 0) return;
    
    let validAmount = amt;
    let change = 0;

    if (remainingBalance < 0) {
      // Refund scenario
      if (amt < remainingBalance) {
        change = amt - remainingBalance;
        setChangeAmount(Math.abs(change));
        validAmount = remainingBalance;
      }
    } else {
      // Standard sale scenario
      validAmount = Math.min(amt, remainingBalance);
      if (selectedMethod === 'usd_cash' || selectedMethod === 'cash') {
        if (amt > remainingBalance) {
          change = amt - remainingBalance;
          setChangeAmount(change);
          validAmount = remainingBalance;
        }
      }
    }

    if (selectedMethod === 'credit') {
      if (!currentCustomer) {
        alert("Must select a customer for credit sales.");
        return;
      }
      if (remainingBalance > 0 && validAmount > currentCustomer.creditLimit - currentCustomer.balance) {
        alert(`Credit limit exceeded! Available credit: $${(currentCustomer.creditLimit - currentCustomer.balance).toFixed(2)}`);
        return;
      }
    }
    
    addPayment(selectedMethod, validAmount);
    setAmountInput('');
  };

  const setFullAmount = () => {
    setAmountInput(remainingBalance.toFixed(2));
  };

  const setPresetAmount = (amount: number) => {
    setAmountInput(amount.toString());
  };

  const handleComplete = () => {
    onComplete();
  };

  const isFullyPaid = Math.abs(totals.balance) <= 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
        </DialogHeader>

        {!isFullyPaid ? (
          <div className="space-y-6 py-4">
            <div className="flex justify-between items-center bg-zinc-50 p-6 rounded-xl border border-zinc-200">
              <span className="text-zinc-500 text-lg font-medium">{remainingBalance < 0 ? "To Refund" : "To Pay"}</span>
              <span className={`text-4xl font-bold font-mono ${remainingBalance < 0 ? "text-rose-600" : "text-zinc-900"}`}>
                ${Math.abs(remainingBalance).toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <Button 
                type="button" 
                variant={selectedMethod === 'usd_cash' ? 'default' : 'outline'} 
                className="flex-col h-auto py-3 gap-1"
                onClick={() => setSelectedMethod('usd_cash')}
              >
                <Banknote className="h-5 w-5" />
                <span className="text-xs">USD</span>
              </Button>
              <Button 
                type="button" 
                variant={selectedMethod === 'card' ? 'default' : 'outline'} 
                className="flex-col h-auto py-3 gap-1"
                onClick={() => setSelectedMethod('card')}
              >
                <CreditCard className="h-5 w-5" />
                <span className="text-xs">Swipe</span>
              </Button>
              <Button 
                type="button" 
                variant={selectedMethod === 'ecocash' ? 'default' : 'outline'} 
                className="flex-col h-auto py-3 gap-1"
                onClick={() => setSelectedMethod('ecocash')}
              >
                <Smartphone className="h-5 w-5" />
                <span className="text-xs">EcoCash</span>
              </Button>
              <Button 
                type="button" 
                variant={selectedMethod === 'cash' ? 'default' : 'outline'} 
                className="flex-col h-auto py-3 gap-1"
                onClick={() => setSelectedMethod('cash')}
              >
                <Banknote className="h-5 w-5" />
                <span className="text-xs">USD Cash</span>
              </Button>
              <Button 
                type="button" 
                variant={selectedMethod === 'credit' ? 'default' : 'outline'} 
                disabled={!currentCustomer}
                className="flex-col h-auto py-3 gap-1 relative"
                onClick={() => setSelectedMethod('credit')}
              >
                <UserCheck className="h-5 w-5" />
                <span className="text-xs">Credit</span>
                {!currentCustomer && (
                  <span className="absolute -top-2 -right-2 flex h-3 w-3">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-zinc-300"></span>
                  </span>
                )}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <Label>Tender Amount</Label>
                {selectedMethod === 'credit' && currentCustomer && (
                  <span className="text-xs text-zinc-500">
                    Avail Credit: ${(currentCustomer.creditLimit - currentCustomer.balance).toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  autoFocus
                  placeholder="0.00" 
                  className="text-2xl h-14 font-mono placeholder:font-sans"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPayment()}
                />
                <Button variant="secondary" className="h-14 px-6 text-lg" onClick={setFullAmount}>Max</Button>
                <Button className="h-14 px-8 text-lg" onClick={handleAddPayment}>Add</Button>
              </div>
              
              {(selectedMethod === 'usd_cash' || selectedMethod === 'cash') && (
                <div className="flex gap-2 justify-start overflow-x-auto pb-2">
                  {remainingBalance > 0 ? (
                    <>
                      {[10, 20, 50, 100].map(val => (
                        <Button key={val} variant="outline" size="sm" onClick={() => setPresetAmount(val)} className="font-mono">
                          ${val}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setPresetAmount(Math.ceil(remainingBalance))} className="font-mono">
                        Exact Next (${Math.ceil(remainingBalance)})
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setPresetAmount(remainingBalance)} className="font-mono text-rose-600 border-rose-200">
                      Exact Refund (${Math.abs(remainingBalance).toFixed(2)})
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center space-y-4 pt-10 pb-6 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 className="h-20 w-20 text-emerald-500" />
            <h3 className="text-2xl font-bold text-emerald-600">{totals.total < 0 ? "Refund Paid" : "Sale Completed"}</h3>
            {changeAmount > 0 && (
              <div className="mt-4 p-4 bg-white border border-emerald-200 rounded-xl shadow-sm text-center min-w-[200px]">
                <p className="text-zinc-500 font-medium mb-1">Change Due</p>
                <p className="text-4xl font-extrabold font-mono text-emerald-600">${changeAmount.toFixed(2)}</p>
              </div>
            )}
            <p className="text-zinc-500">Transaction is ready to be completed.</p>
          </div>
        )}

        {/* Payments List */}
        {payments.length > 0 && (
          <div className="border-t pt-4 space-y-2 mt-4">
            <h4 className="text-sm font-medium mb-2 text-zinc-500">Applied Payments</h4>
            {payments.map(p => (
              <div key={p.id} className="flex justify-between items-center text-sm p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                <span className="uppercase font-medium text-zinc-700 flex items-center gap-2">
                  <Badge variant="secondary">{p.method.replace('_', ' ')}</Badge>
                </span>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-base">
                    {p.amount < 0 ? '-' : ''}${Math.abs(p.amount).toFixed(2)}
                  </span>
                  <button onClick={() => { removePayment(p.id); setChangeAmount(0); }} className="text-zinc-400 hover:text-red-500 text-xs transition-colors">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="mt-6 border-t pt-6">
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} className="w-1/3">Cancel</Button>
          <Button 
            size="lg"
            onClick={handleComplete} 
            disabled={!isFullyPaid}
            className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold"
          >
            Pay & Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
