import React, { useState, useEffect } from 'react';
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
import { Badge } from '../ui/badge';
import { 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  User, 
  Phone, 
  AlertCircle,
  Receipt,
  ArrowRightCircle,
  Check,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { db as dexieDb } from '../../lib/dexieDb';
import { supabase } from '../../lib/firebaseClient';
import { usePOSStore } from '../../store/posStore';
import { useBusinessStore } from '../../store';

export interface LeftChangeRecord {
  id: string;
  business_id: string;
  branch_id?: string;
  cashier_id?: string;
  cashier_name?: string;
  customer_name: string;
  customer_phone?: string;
  sale_id?: string;
  receipt_number?: string;
  amount: number;
  currency: string;
  notes?: string;
  status: 'unclaimed' | 'claimed';
  claimed_at?: string | null;
  claimed_by?: string | null;
  created_at: string;
  updated_at?: string;
}

interface CustomerChangeNotesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAmount?: number;
  initialReceipt?: string;
}

export function CustomerChangeNotes({
  open,
  onOpenChange,
  initialAmount,
  initialReceipt
}: CustomerChangeNotesProps) {
  const [records, setRecords] = useState<LeftChangeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unclaimed' | 'claimed'>('unclaimed');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amount, setAmount] = useState<string>(initialAmount ? initialAmount.toFixed(2) : '');
  const [currency, setCurrency] = useState('USD');
  const [receiptNumber, setReceiptNumber] = useState(initialReceipt || '');
  const [notes, setNotes] = useState('');

  const { activeBranch, currentBusiness } = useBusinessStore();
  const { cart, applyGlobalDiscount } = usePOSStore();

  const loadRecords = async () => {
    try {
      setLoading(true);
      // Read from local Dexie database for offline capability
      let localItems: LeftChangeRecord[] = [];
      try {
        localItems = await dexieDb.left_changes.toArray();
      } catch (dErr) {
        console.warn('Dexie read left_changes notice:', dErr);
      }

      // Also try fetching latest from remote if online
      if (navigator.onLine) {
        try {
          const { data: remoteData } = await supabase
            .from('left_changes')
            .select('*')
            .order('created_at', { ascending: false });

          if (remoteData && remoteData.length > 0) {
            // Merge remote with local
            for (const r of remoteData) {
              await dexieDb.left_changes.put(r);
            }
            localItems = await dexieDb.left_changes.toArray();
          }
        } catch (rErr) {
          console.warn('Online left_changes fetch soft fail:', rErr);
        }
      }

      // Sort newest first
      localItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecords(localItems);
    } catch (err) {
      console.error('Error loading left changes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadRecords();
      if (initialAmount && initialAmount > 0) {
        setAmount(initialAmount.toFixed(2));
        setShowAddForm(true);
      }
      if (initialReceipt) {
        setReceiptNumber(initialReceipt);
      }
    }
  }, [open, initialAmount, initialReceipt]);

  const handleSaveLeftChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!customerName.trim()) {
      toast.error('Customer name is required.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid positive change amount.');
      return;
    }

    try {
      const cashierName = localStorage.getItem('tareza_active_cashier_name') || 'Cashier';
      const cashierId = localStorage.getItem('tareza_active_cashier_id') || 'cashier_local';
      const bizId = currentBusiness?.id || 'default_business';
      const branchId = activeBranch?.id || '';

      const newRecord: LeftChangeRecord = {
        id: crypto.randomUUID(),
        business_id: bizId,
        branch_id: branchId,
        cashier_id: cashierId,
        cashier_name: cashierName,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || undefined,
        amount: parsedAmount,
        currency: currency.toUpperCase(),
        receipt_number: receiptNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        status: 'unclaimed',
        claimed_at: null,
        claimed_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 1. Save to Dexie offline DB
      await dexieDb.left_changes.put(newRecord);

      // 2. Queue or save to Cloud if online
      try {
        await supabase.from('left_changes').insert([newRecord]);
      } catch (sErr) {
        console.warn('Queued left change offline:', sErr);
      }

      toast.success(`Recorded $${parsedAmount.toFixed(2)} left change for "${customerName.trim()}".`);
      
      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setAmount('');
      setReceiptNumber('');
      setNotes('');
      setShowAddForm(false);

      await loadRecords();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to record left change.');
    }
  };

  const handleMarkAsClaimed = async (record: LeftChangeRecord) => {
    try {
      const cashierName = localStorage.getItem('tareza_active_cashier_name') || 'Cashier';
      const now = new Date().toISOString();

      const updated = {
        ...record,
        status: 'claimed' as const,
        claimed_at: now,
        claimed_by: cashierName,
        updated_at: now
      };

      await dexieDb.left_changes.put(updated);

      try {
        await supabase.from('left_changes').update({
          status: 'claimed',
          claimed_at: now,
          claimed_by: cashierName,
          updated_at: now
        }).eq('id', record.id);
      } catch (uErr) {
        console.warn('Updated left change status locally:', uErr);
      }

      toast.success(`Change of ${record.currency} ${record.amount.toFixed(2)} marked as claimed by ${record.customer_name}.`);
      await loadRecords();
    } catch (err: any) {
      toast.error('Failed to update status.');
    }
  };

  const handleApplyToCart = (record: LeftChangeRecord) => {
    if (cart.length === 0) {
      toast.error('Cart is currently empty. Add items to cart before applying left change credit.');
      return;
    }

    applyGlobalDiscount({
      type: 'fixed',
      value: record.amount
    });

    handleMarkAsClaimed(record);
    toast.success(`Applied ${record.currency} ${record.amount.toFixed(2)} credit from customer's left change to cart!`);
    onOpenChange(false);
  };

  // Filtered list
  const filteredRecords = records.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      r.customer_name.toLowerCase().includes(query) ||
      (r.customer_phone && r.customer_phone.includes(query)) ||
      (r.receipt_number && r.receipt_number.toLowerCase().includes(query)) ||
      (r.notes && r.notes.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  const unclaimedCount = records.filter(r => r.status === 'unclaimed').length;
  const unclaimedTotal = records
    .filter(r => r.status === 'unclaimed')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 p-6 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <DialogHeader className="pb-3 border-b border-zinc-150 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  Customer Left Changes Notes
                  {unclaimedCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                      {unclaimedCount} Unclaimed
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                  Record and track customers who left change or short balance to redeem later.
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              variant={showAddForm ? 'outline' : 'default'}
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs font-bold gap-1.5 cursor-pointer rounded-xl"
            >
              <Plus className="w-4 h-4" />
              {showAddForm ? 'View List' : 'Record Change'}
            </Button>
          </div>
        </DialogHeader>

        {/* Unclaimed Summary Banner */}
        <div className="flex items-center justify-between p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl mt-2 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-amber-900 dark:text-amber-200">Pending Left Changes:</span>
            <span className="font-bold text-amber-700 dark:text-amber-300">{unclaimedCount} notes</span>
          </div>
          <div className="font-mono font-black text-amber-800 dark:text-amber-200 text-sm">
            Total: ${unclaimedTotal.toFixed(2)}
          </div>
        </div>

        {showAddForm ? (
          /* ADD NEW LEFT CHANGE FORM */
          <form onSubmit={handleSaveLeftChange} className="space-y-3.5 py-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Customer Full Name *</Label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <Input
                    required
                    placeholder="e.g. Mr. Moyo / Tendai"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Phone Number (Optional)</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <Input
                    type="tel"
                    placeholder="e.g. 0771 234 567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Change Amount Left *</Label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <Input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-9 h-10 text-base font-bold font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Currency</Label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-bold focus:outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="ZIG">ZiG</option>
                  <option value="ZAR">ZAR (R)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Receipt / Sale Ref (Optional)</Label>
              <div className="relative">
                <Receipt className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                <Input
                  placeholder="e.g. RCP-10293 or Walk-in"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="pl-9 h-10 text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Notes / Details</Label>
              <Input
                placeholder="e.g. No 50c coin available at till, to collect on next visit"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 cursor-pointer h-10"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 cursor-pointer h-10 bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Save Left Change Note
              </Button>
            </div>
          </form>
        ) : (
          /* SEARCH & LIST VIEW */
          <div className="flex flex-col flex-1 overflow-hidden space-y-3 py-2">
            {/* Filters */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
                <Input
                  placeholder="Search customer, phone, receipt..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8.5 h-9 text-xs bg-zinc-50 dark:bg-zinc-800/60"
                />
              </div>
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusFilter('unclaimed')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    statusFilter === 'unclaimed' 
                      ? 'bg-white dark:bg-zinc-700 text-amber-700 dark:text-amber-400 shadow-xs' 
                      : 'text-zinc-500'
                  }`}
                >
                  Unclaimed ({unclaimedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('claimed')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    statusFilter === 'claimed' 
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs' 
                      : 'text-zinc-500'
                  }`}
                >
                  Claimed
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    statusFilter === 'all' 
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs' 
                      : 'text-zinc-500'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[360px]">
              {loading && records.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-zinc-400" />
                  Loading customer change records...
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-zinc-300 dark:text-zinc-700" />
                  No {statusFilter !== 'all' ? statusFilter : ''} change notes found.
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddForm(true)}
                    className="mt-2 text-xs font-semibold cursor-pointer rounded-xl"
                  >
                    Record a customer's left change
                  </Button>
                </div>
              ) : (
                filteredRecords.map((item) => {
                  const isUnclaimed = item.status === 'unclaimed';
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isUnclaimed 
                          ? 'border-amber-200/80 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/10 hover:border-amber-300' 
                          : 'border-zinc-200/70 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/40 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                              {item.customer_name}
                            </span>
                            {item.customer_phone && (
                              <span className="text-xs text-zinc-500 font-mono">
                                • {item.customer_phone}
                              </span>
                            )}
                            <Badge className={
                              isUnclaimed 
                                ? 'bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold uppercase' 
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold uppercase'
                            }>
                              {item.status}
                            </Badge>
                          </div>

                          {item.notes && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">
                              📝 {item.notes}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                            <span>{new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {item.receipt_number && <span>Ref: {item.receipt_number}</span>}
                            <span>Recorded by: {item.cashier_name || 'Cashier'}</span>
                          </div>

                          {!isUnclaimed && item.claimed_at && (
                            <div className="text-[11px] text-emerald-600 font-medium">
                              ✓ Claimed on {new Date(item.claimed_at).toLocaleDateString()} by {item.claimed_by || 'Staff'}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="text-lg font-black font-mono text-zinc-900 dark:text-zinc-100">
                            {item.currency} {item.amount.toFixed(2)}
                          </span>

                          {isUnclaimed && (
                            <div className="flex items-center gap-1.5">
                              {cart.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApplyToCart(item)}
                                  className="h-7 px-2 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 cursor-pointer"
                                  title="Apply as discount / credit to current cart"
                                >
                                  <ArrowRightCircle className="w-3 h-3 mr-1" />
                                  Apply to Cart
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleMarkAsClaimed(item)}
                                className="h-7 px-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Claimed
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-zinc-150 dark:border-zinc-800">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full cursor-pointer h-9 text-xs font-semibold"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
