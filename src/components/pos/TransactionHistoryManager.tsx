import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  RotateCcw, 
  CheckCircle2, 
  X, 
  ChevronDown, 
  ChevronUp, 
  XCircle, 
  RefreshCw,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { supabase, db, doc, getDoc, updateDoc } from '../../lib/firebaseClient';
import { getItemPackSize, usePOSStore } from '../../store/posStore';
import { recordStockMovement, logAuditEvent } from '../../services/ledgerService';
import { toast } from 'sonner';

interface TransactionHistoryManagerProps {
  activeSession: any;
  setActiveSession: (session: any) => void;
  userId: string;
}

export const TransactionHistoryManager: React.FC<TransactionHistoryManagerProps> = ({
  activeSession,
  setActiveSession,
  userId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'REFUNDED'>('ALL');

  // Refund dialog states
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [targetSaleForRefund, setTargetSaleForRefund] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState('Wrong Item Scanned / Cashier Error');
  const [customReason, setCustomReason] = useState('');
  const [restockInventory, setRestockInventory] = useState(true);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  const businessId = activeSession?.business_id || '';
  const branchId = activeSession?.branch_id || '';

  const fetchSalesHistory = async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      let queryBuilder = supabase
        .from('sales')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (branchId) {
        queryBuilder = queryBuilder.eq('branch_id', branchId);
      }

      const { data, error } = await queryBuilder.limit(60);

      if (error) throw error;
      const nonQuotationSales = (data || []).filter((s: any) => String(s.status).toUpperCase() !== 'QUOTATION');
      setSales(nonQuotationSales);
    } catch (error: any) {
      console.error('[History] Failed to load transactions:', error);
      toast.error('Could not fetch transaction history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && businessId) {
      fetchSalesHistory();
    }
  }, [isOpen, businessId, branchId]);

  const handleOpenRefundDialog = (sale: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetSaleForRefund(sale);
    setRefundReason('Wrong Item Scanned / Cashier Error');
    setCustomReason('');
    setRestockInventory(true);
    setIsRefundDialogOpen(true);
  };

  const handleProcessRefund = async () => {
    if (!targetSaleForRefund || !activeSession) return;

    const finalReason = refundReason === 'Other' ? customReason : refundReason;
    if (refundReason === 'Other' && !customReason.trim()) {
      toast.error('Please specify a refund reason.');
      return;
    }

    setIsProcessingRefund(true);
    try {
      const saleId = targetSaleForRefund.id;
      const receiptNumber = targetSaleForRefund.receiptNumber || targetSaleForRefund.receipt_number || 'UNKNOWN';
      const refundAmount = Number(targetSaleForRefund.total || 0);

      // 1. Update the sale record status to REFUNDED in Supabase
      const { error: saleUpdateErr } = await supabase
        .from('sales')
        .update({ status: 'REFUNDED', refund_notes: finalReason })
        .eq('id', saleId);

      if (saleUpdateErr) throw saleUpdateErr;

      // 2. Update active register session metrics in Firestore & Supabase
      let updatedRefundsTotal = Number(activeSession.refunds_total || 0) + refundAmount;
      let updatedExpectedBalance = Number(activeSession.expected_balance || 0) - refundAmount;

      if (activeSession && activeSession.id && !activeSession.id.startsWith('off-shift-')) {
        try {
          const sessRef = doc(db, 'register_sessions', activeSession.id);
          const sessSnap = await getDoc(sessRef);
          if (sessSnap.exists()) {
            const sessData = sessSnap.data();
            updatedRefundsTotal = Number(sessData.refunds_total || 0) + refundAmount;
            updatedExpectedBalance = Number(sessData.expected_balance || 0) - refundAmount;

            // Firestore Update
            await updateDoc(sessRef, {
              refunds_total: updatedRefundsTotal,
              expected_balance: updatedExpectedBalance
            });
          }
        } catch (sessErr) {
          console.warn('[Refund] Failed to update Firestore session metrics:', sessErr);
        }
      }

      // Local state update (Always run for both online and offline sessions)
      const updatedSess = {
        ...activeSession,
        refunds_total: updatedRefundsTotal,
        expected_balance: updatedExpectedBalance
      };
      setActiveSession(updatedSess);
      localStorage.setItem('tareza_active_offline_session', JSON.stringify(updatedSess));
      localStorage.setItem('tareza_active_session_cache', JSON.stringify(updatedSess));

      // Supabase session update for total sync (Only if not off-shift)
      if (activeSession && activeSession.id && !activeSession.id.startsWith('off-shift-')) {
        try {
          await supabase
            .from('register_sessions')
            .update({
              refunds_total: updatedRefundsTotal,
              expected_balance: updatedExpectedBalance
            })
            .eq('id', activeSession.id);
        } catch (errSup) {
          console.warn('[Refund] Session update failed in Supabase:', errSup);
        }
      }

      // 3. Reverse inventory count and log stock movements if requested
      let saleItems: any[] = [];
      if (restockInventory && targetSaleForRefund.items) {
        if (Array.isArray(targetSaleForRefund.items)) {
          saleItems = targetSaleForRefund.items;
        } else if (typeof targetSaleForRefund.items === 'string') {
          try {
            saleItems = JSON.parse(targetSaleForRefund.items);
          } catch {
            saleItems = [];
          }
        }

        for (const item of saleItems) {
          if (!item.product?.id) continue;
          try {
            const multiplier = getItemPackSize(item);
            await recordStockMovement(
              businessId,
              branchId,
              item.product.id,
              Number(item.quantity || 1) * multiplier, // Positive adds items back to inventory stock
              'POS_RETURN',
              userId,
              receiptNumber,
              undefined,
              `POS Return Restock [Reason: ${finalReason}]`
            );
          } catch (itemErr: any) {
            console.error(`[Refund] Failed to restock item ${item.product?.name}:`, itemErr);
          }
        }

        // Trigger real-time inventory updates for active client views
        try {
          window.dispatchEvent(new Event('inventory-update-needed'));
        } catch (errEv) {
          console.error(errEv);
        }
      }

      // 4. Record correction detail logs into the cash_drawer_logs table
      let paymentsArray: any[] = [];
      if (Array.isArray(targetSaleForRefund.payments)) {
        paymentsArray = targetSaleForRefund.payments;
      } else if (typeof targetSaleForRefund.payments === 'string') {
        try {
          paymentsArray = JSON.parse(targetSaleForRefund.payments);
        } catch {
          paymentsArray = [];
        }
      }

      if (paymentsArray.length === 0) {
        paymentsArray = [{ method: targetSaleForRefund.payment_method || 'cash', amount: refundAmount }];
      }

      for (const payment of paymentsArray) {
        try {
          await supabase.from('cash_drawer_logs').insert([{
            business_id: businessId,
            branch_id: branchId,
            amount: -Number(payment.amount || refundAmount), // Decrement the register value
            type: payment.method === 'credit' ? 'receivable' : 'cash',
            transaction_type: 'refund',
            payment_method: payment.method || 'cash',
            notes: `Instant POS Refund for Sale ${receiptNumber} [Reason: ${finalReason}]`,
            linked_document_id: saleId,
            linked_document_type: 'sale',
            created_at: new Date().toISOString()
          }]);
        } catch (logErr) {
          console.error('[Refund] Cash log insertion failure:', logErr);
        }
      }

      // 5. Commit audit trail activity
      await logAuditEvent(
        businessId,
        userId,
        'VOID',
        'POS',
        targetSaleForRefund,
        { ...targetSaleForRefund, status: 'REFUNDED', refund_notes: finalReason }
      );

      toast.success(`Transaction ${receiptNumber} has been successfully refunded! Shift audit reports and warehouse counts updated.`);
      
      // Update local state listing
      setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: 'REFUNDED', refund_notes: finalReason } : s));
      setIsRefundDialogOpen(false);
      setTargetSaleForRefund(null);
    } catch (err: any) {
      console.error('[Refund] Processing error:', err);
      toast.error(err.message || 'Error occurred while issuing refund.');
    } finally {
      setIsProcessingRefund(false);
    }
  };

  const getSaleItems = (sale: any) => {
    if (!sale.items) return [];
    if (Array.isArray(sale.items)) return sale.items;
    try {
      return JSON.parse(sale.items);
    } catch {
      return [];
    }
  };

  const filteredSales = sales.filter(s => {
    const rawReceipt = s.receiptNumber || s.receipt_number || '';
    const rawCustName = s.customerName || s.customer_name || 'Walk-in Customer';
    const matchesSearch = 
      rawReceipt.toLowerCase().includes(searchTerm.toLowerCase()) || 
      rawCustName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    const saleStatus = String(s.status || '').toUpperCase();
    if (statusFilter === 'REFUNDED') return matchesSearch && saleStatus === 'REFUNDED';
    return matchesSearch && saleStatus !== 'REFUNDED';
  });

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="border-zinc-200 bg-white dark:bg-zinc-900 border-dashed text-xs shadow-none cursor-pointer rounded-xl font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5 text-zinc-500" />
            <span>Transaction History</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-3xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 max-h-[85vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              Store POS Transaction History
            </DialogTitle>
          </DialogHeader>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 pt-3 pb-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search Receipt Code or Cashier / Customer Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs rounded-xl h-9 border-zinc-200"
              />
            </div>
            <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl h-9 shrink-0">
              {(['ALL', 'COMPLETED', 'REFUNDED'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${statusFilter === filter ? 'bg-white dark:bg-zinc-900 shadow-xs text-zinc-950 dark:text-white' : 'text-zinc-500 hover:text-zinc-750'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Results Scroller */}
          <div className="flex-1 overflow-hidden min-h-[250px] relative">
            {isLoading ? (
              <div className="py-20 text-center text-xs text-zinc-400 font-semibold flex flex-col items-center gap-2 justify-center h-full">
                <RefreshCw className="w-5 h-5 animate-spin text-zinc-600 dark:text-zinc-400" />
                <span>Scanning register sales records...</span>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="py-20 text-center text-xs text-zinc-400 font-medium flex flex-col items-center justify-center gap-2 h-full">
                <FileSpreadsheet className="w-8 h-8 text-zinc-300" />
                <span>No matching sales records found in current shift boundary.</span>
              </div>
            ) : (
              <ScrollArea className="h-[450px] pr-2">
                <div className="space-y-3 pb-4">
                  {filteredSales.map((sale) => {
                    const isExpanded = expandedSaleId === sale.id;
                    const items = getSaleItems(sale);
                    const isRefunded = String(sale.status || '').toUpperCase() === 'REFUNDED';
                    const displayStatus = isRefunded ? 'Refunded' : (sale.status || 'Completed');

                    return (
                      <div 
                        key={sale.id}
                        className={`border rounded-xl transition-all overflow-hidden bg-zinc-50/20 dark:bg-zinc-900/10 hover:border-zinc-300 dark:hover:border-zinc-700 ${isExpanded ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30' : 'border-zinc-200 dark:border-zinc-800'}`}
                      >
                        {/* Summary Line */}
                        <div 
                          className="flex justify-between items-center p-4 cursor-pointer select-none"
                          onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
                                {sale.receiptNumber || sale.receipt_number || 'REG-POS'}
                              </span>
                              <Badge 
                                variant={isRefunded ? "destructive" : "default"}
                                className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider ${isRefunded ? 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50/80 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900' : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50/80 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900'}`}
                              >
                                {displayStatus}
                              </Badge>
                            </div>
                            <div className="text-[10px] text-zinc-400 font-medium">
                              {new Date(sale.created_at || sale.timestamp).toLocaleString()} • Customer: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{sale.customerName || sale.customer_name || 'Walk-in'}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-xs font-black text-zinc-900 dark:text-white">
                                ${Number(sale.total || 0).toFixed(2)} USD
                              </span>
                              <p className="text-[9px] text-zinc-400 font-mono capitalize">
                                {sale.payment_method || (sale.payments && sale.payments[0]?.method) || 'Cash'}
                              </p>
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="p-4 pt-0 border-t border-zinc-150/60 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/40 animate-slide-down">
                            <div className="space-y-3 pt-3">
                              {/* Items log details */}
                              <div>
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Purchase Basket</h4>
                                <div className="space-y-2 max-h-[160px] overflow-auto pr-1">
                                  {items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-zinc-100 dark:border-zinc-850 last:border-0">
                                      <div>
                                        <p className="font-bold text-zinc-800 dark:text-zinc-200">
                                          {item.product?.name || 'Unlisted Product'}
                                        </p>
                                        <p className="text-[9px] font-mono text-zinc-400 font-semibold mt-0.2">
                                          SKU: {item.product?.sku || 'N/A'} • Multiplier: x{getItemPackSize(item)}
                                        </p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="font-sans font-bold text-zinc-700 dark:text-zinc-300">
                                          {item.quantity} units x ${Number(item.unitPrice || item.price || 0).toFixed(2)}
                                        </p>
                                        <p className="text-[9px] text-zinc-400 font-bold">
                                          Sub: ${Number((item.quantity * (item.unitPrice || item.price || 0))).toFixed(2)}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Breakdown calculations */}
                              <div className="flex flex-col sm:flex-row justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 gap-3">
                                <div className="space-y-0.5">
                                  <p>Subtotal: <strong className="text-zinc-700 dark:text-zinc-300">${Number(sale.subtotal || (sale.total - (sale.vatTotal || 0))).toFixed(2)}</strong></p>
                                  <p>Sales Tax (VAT): <strong className="text-zinc-700 dark:text-zinc-300">${Number(sale.vatTotal || sale.vat_total || 0).toFixed(2)}</strong></p>
                                  {Number(sale.discountTotal || sale.discount_total || 0) > 0 && (
                                    <p className="text-rose-600">Discount: <strong>-${Number(sale.discountTotal || sale.discount_total).toFixed(2)}</strong></p>
                                  )}
                                </div>
                                <div className="sm:text-right flex flex-col justify-between items-start sm:items-end gap-2">
                                  <div>
                                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-400">Total Billed Amt</span>
                                    <p className="font-black text-sm text-zinc-900 dark:text-white">${Number(sale.total || 0).toFixed(2)} USD</p>
                                  </div>

                                  {isRefunded ? (
                                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-2 max-w-xs text-left">
                                      <p className="text-[9px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        <span>Refund Audit Notes</span>
                                      </p>
                                      <p className="text-[10px] text-amber-700 dark:text-amber-300 italic mt-0.5 mt-0.2 leading-normal">
                                        "{sale.refund_notes || 'No notes specified.'}"
                                      </p>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="rounded-lg h-8 text-[11px] font-black tracking-wide uppercase hover:bg-rose-600/95 cursor-pointer bg-red-650 hover:bg-red-700 flex items-center gap-1 mt-1 font-bold"
                                      onClick={(e) => handleOpenRefundDialog(sale, e)}
                                    >
                                      <RotateCcw className="w-3 h-3 shrink-0" />
                                      <span>Issue Instant Refund</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              className="text-xs h-9 rounded-xl border-zinc-200"
            >
              Close History Panel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-Dialog: Instant Refund Form Modal */}
      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-90 w text-zinc-900 dark:text-zinc-100 rounded-2xl z-50">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-rose-600">
              <RotateCcw className="w-5 h-5 text-rose-500 animate-[spin_5s_linear_infinite]" />
              Confirm POS Instant Refund
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-3">
            <div className="bg-rose-50/50 dark:bg-rose-955/10 border border-rose-100 dark:border-rose-950/40 p-3 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-rose-900">Initiating Void & Reversal Sequence</p>
                <p className="text-zinc-550 dark:text-zinc-400 leading-normal font-medium">
                  This transaction value of <span className="font-bold text-zinc-800 dark:text-zinc-200">${Number(targetSaleForRefund?.total || 0).toFixed(2)}</span> will be deducted from active shift cash records. A reversal journal entry will be committed immediately.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Select Refund Narrative / Reason
              </Label>
              <Select value={refundReason} onValueChange={setRefundReason}>
                <SelectTrigger className="w-full text-xs rounded-xl h-10 border-zinc-200">
                  <SelectValue placeholder="Select a correction reason" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900">
                  <SelectItem value="Wrong Item Scanned / Cashier Error" className="text-xs">Wrong Item Scanned / Cashier Error</SelectItem>
                  <SelectItem value="Customer Returned Defective / Broken Item" className="text-xs">Customer Returned Defective / Broken Item</SelectItem>
                  <SelectItem value="Customer Exchange / Return" className="text-xs">Customer Exchange / Return</SelectItem>
                  <SelectItem value="Incorrect Billing Pricing Level Applied" className="text-xs">Incorrect Billing Pricing Level Applied</SelectItem>
                  <SelectItem value="Other" className="text-xs">Other (Specify Custom Reason)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {refundReason === 'Other' && (
              <div className="space-y-1.5 animate-slide-down">
                <Label htmlFor="custom-reason" className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  Describe Custom Refund Reason
                </Label>
                <Textarea
                  id="custom-reason"
                  placeholder="Provide precise details for the ledger audit reports..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="text-xs rounded-xl border-zinc-200 resize-none min-h-[70px] leading-relaxed"
                />
              </div>
            )}

            <div className="flex items-center space-x-3 bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-150/40 dark:border-zinc-800/80">
              <Checkbox 
                id="restock-count" 
                checked={restockInventory}
                onCheckedChange={(checked) => setRestockInventory(!!checked)}
                className="rounded cursor-pointer border-zinc-300"
              />
              <div className="space-y-0.5">
                <label 
                  htmlFor="restock-count"
                  className="text-xs font-bold text-zinc-805 dark:text-zinc-100 cursor-pointer select-none"
                >
                  Increment Warehouse Inventory
                </label>
                <p className="text-[10px] text-zinc-400 font-medium">
                  Automatically add the items back into the active store inventory.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-zinc-100 dark:border-zinc-800 gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessingRefund}
              onClick={() => {
                setIsRefundDialogOpen(false);
                setTargetSaleForRefund(null);
              }}
              className="text-xs h-9 rounded-xl border-zinc-200 font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isProcessingRefund}
              onClick={handleProcessRefund}
              className="text-xs h-9 rounded-xl bg-rose-650 hover:bg-rose-700 hover:bg-rose-700/95 font-bold"
            >
              {isProcessingRefund ? 'Processing Void Reversal...' : 'Complete Refund Reversal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
