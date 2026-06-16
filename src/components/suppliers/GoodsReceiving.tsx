import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Search, Filter, Plus, Package, Check, RefreshCw, Layers, ArrowDownLeft, Trash2, Calendar, WifiOff, CloudLightning, Database, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '../../lib/firebaseClient';
import { toast } from 'sonner';
import { recordStockMovement } from '../../services/ledgerService';

export interface ReceivableItem {
  product_id: string;
  product_name: string;
  sku?: string;
  quantityOrdered: number;
  quantityReceived: number;
  batchNumber: string;
  costPrice: number;
}

export default function GoodsReceiving() {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // States for GRN dialog
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [grnNotes, setGrnNotes] = useState('');
  
  // Historical / Custom Receipt Date
  const [grnDate, setGrnDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Bulk Receivable Items list state
  const [receivableItems, setReceivableItems] = useState<ReceivableItem[]>([]);
  const grnContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (grnContainerRef.current) {
      setTimeout(() => {
        if (grnContainerRef.current) {
          grnContainerRef.current.scrollTop = grnContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [receivableItems.length]);

  // Extra / Non-PO item state selectors
  const [extraProductId, setExtraProductId] = useState('');
  const [extraQty, setExtraQty] = useState('0.00');
  const [extraCostPrice, setExtraCostPrice] = useState('0.00');
  const [extraBatchNum, setExtraBatchNum] = useState('');
  const [extraProductSearch, setExtraProductSearch] = useState('');
  const [standaloneSupplierId, setStandaloneSupplierId] = useState('cash-supplier');

  // History log of received goods
  const [grnHistory, setGrnHistory] = useState<any[]>([]);
  const [offlineGRNs, setOfflineGRNs] = useState<any[]>([]);

  // Check offline flag
  const getIsOffline = () => {
    return localStorage.getItem('tareza_offline_mode') === 'true' || (typeof window !== 'undefined' && !window.navigator.onLine);
  };

  // Synchronize PO product items to editable bulk list
  useEffect(() => {
    if (!selectedPOId || selectedPOId === 'none' || purchaseOrders.length === 0) {
      setReceivableItems([]);
      return;
    }
    const po = purchaseOrders.find(p => p.id === selectedPOId);
    if (po && po.items && po.items.length > 0) {
      const mapped = po.items.map((it: any) => {
        const prod = products.find(p => p.id === it.product_id);
        return {
          product_id: it.product_id,
          product_name: it.product_name || prod?.name || 'Unknown Item',
          sku: prod?.sku || '',
          quantityOrdered: Number(it.quantity || 0),
          quantityReceived: Number(it.quantity || 0), // Default to receive remaining full amount
          batchNumber: `B-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100+Math.random()*900)}`,
          costPrice: Number(it.price || prod?.cost_price || 0)
        };
      });
      setReceivableItems(mapped);
    } else {
      setReceivableItems([]);
    }
  }, [selectedPOId, purchaseOrders, products]);

  useEffect(() => {
    fetchData();
    window.addEventListener('offline-mode-changed', fetchData);
    return () => {
      window.removeEventListener('offline-mode-changed', fetchData);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Load offline GRNs list from local storage
      const cachedGrnsRaw = localStorage.getItem('tareza_offline_grns') || '[]';
      setOfflineGRNs(JSON.parse(cachedGrnsRaw));

      const [poRes, branchRes, prodRes, supRes, movementsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('branches').select('*').order('name'),
        supabase.from('products').select('*').eq('is_active', true).order('name'),
        supabase.from('suppliers').select('*'),
        supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(100)
      ]);

      const pos = poRes.data || [];
      const brs = branchRes.data || [];
      const prods = prodRes.data || [];
      const sups = supRes.data || [];

      setPurchaseOrders(pos);
      setBranches(brs);
      setProducts(prods);
      setSuppliers(sups);

      // Select defaults
      if (pos.length > 0 && !selectedPOId) setSelectedPOId(pos[0].id);
      if (brs.length > 0 && !selectedBranchId) setSelectedBranchId(brs[0].id);

      // Map movement history and filter client-side for 'IN' or 'GOODS_RECEIVED'
      const mappedMovements = (movementsRes.data || [])
        .filter((m: any) => m.type === 'IN' || m.type === 'GOODS_RECEIVED' || (m.notes && m.notes.includes('Reversal of parent GRN')))
        .slice(0, 50)
        .map((m: any) => {
          const prod = prods.find((p: any) => p.id === m.product_id);
          const br = brs.find((b: any) => b.id === m.branch_id);
          return {
            ...m,
            product_name: prod ? prod.name : 'Unknown Product',
            sku: prod ? prod.sku : '-',
            branch_name: br ? br.name : 'Unknown Warehouse/Branch'
          };
        });
      setGrnHistory(mappedMovements);

    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load Goods Receiving context from cloud database');
    } finally {
      setLoading(false);
    }
  };

  // Handle auto-selecting ad-hoc product and filling cost price
  const handleSelectExtraProduct = (prodId: string) => {
    setExtraProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setExtraCostPrice((prod.cost_price || 0).toFixed(2));
    } else {
      setExtraCostPrice('0.00');
    }
  };

  // Add a brand new item inline to the bulk GRN checklist
  const handleAddExtraItem = () => {
    if (!extraProductId || extraProductId === 'none') {
      toast.error('Please pick a product to add to this receipt.');
      return;
    }
    const match = products.find(p => p.id === extraProductId);
    if (!match) return;

    const qty = Number(extraQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a positive quantity received.');
      return;
    }

    const price = Number(extraCostPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid unit cost price.');
      return;
    }

    const nextBatch = extraBatchNum.trim() || `B-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100+Math.random()*900)}`;

    const alreadyInList = receivableItems.some(i => i.product_id === match.id);
    
    // Strict duplication prevention per user request
    if (alreadyInList) {
      toast.error(`"${match.name}" has already been staged on this receipt list. To protect against double-entry errors, duplicates are restricted. Please adjust its received quantity directly inside the itemization table below.`);
      return;
    }

    setReceivableItems(prev => [
      ...prev,
      {
        product_id: match.id,
        product_name: match.name,
        sku: match.sku,
        quantityOrdered: 0,
        quantityReceived: qty,
        batchNumber: nextBatch,
        costPrice: price
      }
    ]);
    toast.success(`${match.name} added to the bulk GRN queue.`);

    setExtraProductId('');
    setExtraQty('0.00');
    setExtraCostPrice('0.00');
    setExtraBatchNum('');
    setExtraProductSearch('');
  };

  const removeItemFromGRN = (index: number) => {
    setReceivableItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateReceivedQty = (index: number, val: number) => {
    if (val < 0) return;
    setReceivableItems(prev => prev.map((item, i) => i === index ? { ...item, quantityReceived: val } : item));
  };

  const updateCostPrice = (index: number, val: number) => {
    if (val < 0) return;
    setReceivableItems(prev => prev.map((item, i) => i === index ? { ...item, costPrice: val } : item));
  };

  const updateBatchNumber = (index: number, val: string) => {
    setReceivableItems(prev => prev.map((item, i) => i === index ? { ...item, batchNumber: val } : item));
  };

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBranchId) {
      toast.error("Please select a target warehouse branch.");
      return;
    }

    const itemsToProcess = receivableItems.filter(item => item.quantityReceived > 0);
    if (itemsToProcess.length === 0) {
      toast.error("No products with quantities > 0 are selected for receipt.");
      return;
    }

    try {
      setSubmitting(true);
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      let businessId = '';

      if (userData?.user) {
        const { data: bUser } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();
        if (bUser) {
          businessId = bUser.business_id;
        }
      }

      const isAppOffline = getIsOffline();

      // Handle offline mode queueing
      if (isAppOffline) {
        const localGrnId = 'off-grn-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString().slice(-4);
        
        let matchingSupplierName = 'Cash Supplier';
        if (selectedPOId !== 'none') {
          const matchedPOObj = purchaseOrders.find(p => p.id === selectedPOId);
          matchingSupplierName = matchedPOObj?.supplier_name || suppliers.find(s => s.id === matchedPOObj?.supplier_id)?.name || 'PO Supplier';
        } else if (standaloneSupplierId !== 'cash-supplier') {
          matchingSupplierName = suppliers.find(s => s.id === standaloneSupplierId)?.name || 'Cash Supplier';
        }

        const offlineGRNRecord = {
          id: localGrnId,
          created_at: new Date().toISOString(),
          date: grnDate,
          branch_id: selectedBranchId,
          branch_name: branches.find(b => b.id === selectedBranchId)?.name || 'Local Warehouse',
          po_id: selectedPOId,
          po_number: selectedPOId !== 'none' ? (purchaseOrders.find(p => p.id === selectedPOId)?.po_number || 'PO-MATCH') : null,
          notes: grnNotes,
          supplier_id: selectedPOId !== 'none' ? (purchaseOrders.find(p => p.id === selectedPOId)?.supplier_id || 'PO-Supplier') : standaloneSupplierId,
          supplier_name: matchingSupplierName,
          items: itemsToProcess
        };

        const existingRaw = localStorage.getItem('tareza_offline_grns') || '[]';
        const existingArr = JSON.parse(existingRaw);
        existingArr.push(offlineGRNRecord);
        localStorage.setItem('tareza_offline_grns', JSON.stringify(existingArr));

        toast.success(`Cargo shipment receipt saved OFFLINE! (${itemsToProcess.length} items logged). Manual synchronisation is available on network restoration.`);
        setIsOpen(false);
        setGrnNotes('');
        setReceivableItems([]);
        fetchData();
        return;
      }

      // Allow old historical dates
      const selectedDate = grnDate ? new Date(grnDate).toISOString() : new Date().toISOString();
      const po = selectedPOId && selectedPOId !== 'none' ? purchaseOrders.find(p => p.id === selectedPOId) : null;
      const associatedTxRef = po?.po_number || `GRN-${Math.floor(1000 + Math.random() * 9000)}`;

      for (const item of itemsToProcess) {
        const qty = item.quantityReceived;
        const bNum = item.batchNumber || 'N/A';
        const formattedNotes = `Batch: ${bNum}. GRN Note: ${grnNotes.trim() || 'No notes left.'}`;

        // Call unified ledger record service to perform:
        // 1. Stock movement logging
        // 2. Inventory updates (insert or update)
        // 3. Automated double-entry audit postings (Merchandise Inventory 1200 Debit vs Accounts Payable 2000 Credit)
        const result = await recordStockMovement(
          businessId || 'default_business',
          selectedBranchId,
          item.product_id,
          qty,
          'GOODS_RECEIVED',
          userData?.user?.id || 'system',
          associatedTxRef,
          item.costPrice, // Pass the cost price to post correctly in ledger
          formattedNotes,
          selectedDate
        );

        if (!result.success) {
          throw new Error(result.error || `Failed to record stock movement for product: ${item.product_name}`);
        }
      }

      // 3. Mark matching PO as RECEIVED if applicable
      if (selectedPOId && selectedPOId !== 'none') {
        const { error: poError } = await supabase
          .from('purchase_orders')
          .update({ status: 'RECEIVED' })
          .eq('id', selectedPOId);
        if (poError) throw poError;
      }

      toast.success(`Successfully cleared bulk shipment of ${itemsToProcess.length} item(s) to inventory.`);
      setIsOpen(false);
      setGrnNotes('');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error completing Goods Receipt: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  // Reversal implementation to handle duplicate data error corrections per user request
  const handleReverseGRN = async (log: any) => {
    if (!window.confirm(`Are you absolutely sure you want to REVERSE this bulk Goods Receipt for ${log.product_name} (+${log.quantity} units)? This will immediately deduct the received units from warehouse catalog stock and post balancing audit ledger adjustments.`)) {
      return;
    }

    try {
      setLoading(true);
      setSubmitting(true);

      const { data: userData } = await supabase.auth.getUser();
      let businessId = log.business_id;
      if (!businessId && userData?.user) {
        const { data: bUser } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();
        if (bUser) {
          businessId = bUser.business_id;
        }
      }

      const revTxRef = `REV-GRN-${log.id.slice(0, 8)}`;
      const revNotes = `REVERSAL correction of duplicate parent GRN #${log.id.slice(0, 8)}. Original details: ${log.notes || 'None'}`;

      // Call recordStockMovement with negative quantity to safely reverse stock logs
      const result = await recordStockMovement(
        businessId || 'default_business',
        log.branch_id,
        log.product_id,
        -log.quantity, // Negative subtracts stock level safely
        'ADJUSTMENT',  // Logs as stock audit adjust
        userData?.user?.id || 'system',
        revTxRef,
        undefined, // automatically fetches standard cost price
        revNotes
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Append [REVERSED] warning to original record's notes to keep standard traceback
      await supabase
        .from('stock_movements')
        .update({ notes: `[REVERSED] ${log.notes || ''}` })
        .eq('id', log.id);

      toast.success(`Successfully reversed shipment. Logged correction of -${log.quantity} units for ${log.product_name}.`);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Reversal failed: ${err.message}`);
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  // Syncing routine for offline cached Goods Receipts
  const handleSyncOfflineGRN = async (offGrn: any) => {
    try {
      setSubmitting(true);
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      let businessId = '';
      if (userData?.user) {
        const { data: bUser } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();
        if (bUser) {
          businessId = bUser.business_id;
        }
      }

      const selectedDate = offGrn.date ? new Date(offGrn.date).toISOString() : new Date().toISOString();
      const associatedTxRef = offGrn.po_number || `GRN-OFF-${Math.floor(1000 + Math.random() * 9000)}`;

      for (const item of offGrn.items) {
        const qty = item.quantityReceived;
        const bNum = item.batchNumber || 'N/A';
        const formattedNotes = `[Synced Offline] Batch: ${bNum}. Notes: ${offGrn.notes || 'No notes left.'}`;

        const result = await recordStockMovement(
          businessId || 'default_business',
          offGrn.branch_id,
          item.product_id,
          qty,
          'GOODS_RECEIVED',
          userData?.user?.id || 'system',
          associatedTxRef,
          item.costPrice,
          formattedNotes,
          selectedDate
        );

        if (!result.success) {
          throw new Error(result.error || `Failed to record stock movement for product: ${item.product_name}`);
        }
      }

      // Sync PO status
      if (offGrn.po_id && offGrn.po_id !== 'none') {
        const { error: poError } = await supabase
          .from('purchase_orders')
          .update({ status: 'RECEIVED' })
          .eq('id', offGrn.po_id);
        if (poError) throw poError;
      }

      // Remove from offline storage
      const cached = localStorage.getItem('tareza_offline_grns') || '[]';
      const arr = JSON.parse(cached).filter((g: any) => g.id !== offGrn.id);
      localStorage.setItem('tareza_offline_grns', JSON.stringify(arr));

      toast.success(`Offline GRN synced and booked to active journals successfully!`);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Syncing failure: ${err.message || String(err)}`);
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-zinc-900">Goods Receiving Notes (GRN)</h3>
          <p className="text-sm text-zinc-500 mt-0.5">Receive warehouse stock, balance incoming purchase orders instantly in batches, and specify old/historical date logs.</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-semibold cursor-pointer">
          <ArrowDownLeft className="mr-2 h-4 w-4 text-white" /> Create New Bulk GRN Receipt
        </Button>
      </div>

      {/* Offline Received Cargo Sync Dashboard Panel */}
      {offlineGRNs.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <WifiOff className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-amber-800 dark:text-amber-400">Offline Goods Received Queue ({offlineGRNs.length} pending sync)</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">These inventory arrivals were recorded without internet data connections. You can selectively sync individual records to database ledger journals.</p>
            </div>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900/60 rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800">
            {offlineGRNs.map((g) => (
              <div key={g.id} className="p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 dark:bg-transparent">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-zinc-950 dark:text-white">Date: {g.date}</span>
                    <Badge variant="outline" className="text-[10px] font-bold bg-zinc-50 border-zinc-200">
                      Receipt ID: {g.id.slice(0, 8).toUpperCase()}
                    </Badge>
                    <Badge className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Supplier: {g.supplier_name || 'Cash Supplier'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-blue-50/50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 font-mono border-blue-200/30">
                      Branch: {g.branch_name}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-650 dark:text-zinc-350 font-sans mt-1">
                    <strong className="text-zinc-500">Staged Items:</strong> {g.items.map((it: any) => `${it.product_name} (+${it.quantityReceived} @ $${Number(it.costPrice || 0).toFixed(2)})`).join(', ')}
                  </p>
                  {g.notes && <p className="text-[10px] text-zinc-400 italic">Clerk Notes: "{g.notes}"</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-zinc-900 hover:bg-zinc-850 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold h-8 inline-flex items-center gap-1 cursor-pointer select-none text-[11px]"
                    disabled={submitting}
                    onClick={() => handleSyncOfflineGRN(g)}
                  >
                    <RefreshCw className={`h-3 w-3 ${submitting ? 'animate-spin' : ''}`} /> Sync Now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 h-8 px-2"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to discard this offline queued cargo shipment?")) {
                        const updated = offlineGRNs.filter(x => x.id !== g.id);
                        localStorage.setItem('tareza_offline_grns', JSON.stringify(updated));
                        setOfflineGRNs(updated);
                        toast.success("Offline queued receipt discarded.");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 border-zinc-200">
          <CardHeader>
            <CardTitle className="text-base text-zinc-805">Pending Purchase Orders</CardTitle>
            <CardDescription>POs currently ready to be bulk or partially cleared.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {purchaseOrders.filter(po => po.status !== 'RECEIVED').length === 0 ? (
              <p className="text-sm text-zinc-400 py-8 text-center bg-zinc-50 rounded-lg border border-dashed">No pending purchase orders found.</p>
            ) : (
              purchaseOrders.filter(po => po.status !== 'RECEIVED').map(po => {
                const supplier = suppliers.find(s => s.id === po.supplier_id);
                return (
                  <div key={po.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex justify-between items-center transition-all hover:bg-zinc-50">
                    <div>
                      <p className="font-mono text-xs font-semibold text-blue-600">{po.po_number || 'PO-GEN'}</p>
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{supplier ? supplier.name : 'Unknown Supplier'}</p>
                      <p className="text-[11px] text-zinc-500">Expected: {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : '-'}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] text-zinc-650 bg-amber-50 text-amber-700 border border-amber-200 capitalize">{po.status?.toLowerCase().replace('_', ' ')}</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-2 border-zinc-200">
          <CardHeader>
            <CardTitle className="text-base text-zinc-805">Recent Bulk Receipts (GRN Audit Logs)</CardTitle>
            <CardDescription>Verified log entries showing historical stock arrivals of product batches.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-100 dark:bg-zinc-900/40">
                  <TableRow>
                    <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Time Received</TableHead>
                    <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Product SKU / Name</TableHead>
                    <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Linked Supplier / Cost</TableHead>
                    <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300">Storage Location</TableHead>
                    <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300 text-right">Received Count</TableHead>
                    <TableHead className="font-semibold text-zinc-700 dark:text-zinc-300 text-center w-[160px]">Action / Reversal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grnHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-zinc-400 text-sm">
                        No recent receiving logs. Press the button above to initiate a bulk stock arrival.
                      </TableCell>
                    </TableRow>
                  ) : (
                    grnHistory.map((log) => {
                      const isReversed = log.notes && log.notes.startsWith('[REVERSED]');
                      return (
                        <TableRow key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                          <TableCell className="text-xs text-zinc-500">{new Date(log.created_at).toLocaleString()}</TableCell>
                          <TableCell>
                            <p className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">{log.product_name}</p>
                            <p className="font-mono text-[10px] text-zinc-400">{log.sku || '-'}</p>
                            {log.notes && (
                              <p className={`text-[10px] px-1.5 py-0.5 rounded italic mt-1 inline-block whitespace-nowrap overflow-hidden text-ellipsis max-w-xs ${
                                isReversed ? 'bg-red-50 text-red-600 dark:bg-red-955' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                              }`}>
                                {log.notes}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              {log.supplier_name || 'Cash Supplier'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-zinc-650 dark:text-zinc-400">{log.branch_name}</TableCell>
                          <TableCell className={`text-right font-mono font-bold ${log.quantity < 0 ? 'text-rose-650' : 'text-emerald-600'}`}>
                            {log.quantity > 0 ? `+${log.quantity}` : log.quantity} units
                          </TableCell>
                          <TableCell className="text-center">
                            {isReversed ? (
                              <Badge className="bg-red-50 text-red-600 border border-red-200 select-none text-[10.5px]">
                                Reversed Correction
                              </Badge>
                            ) : (
                              <div className="flex gap-1.5 justify-center">
                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 select-none">
                                  <Check className="h-3 w-3 text-emerald-600 mr-1" /> Checked
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReverseGRN(log)}
                                  disabled={submitting}
                                  className="text-red-650 border-red-200 hover:bg-rose-50 text-[10.5px] font-bold h-6 py-0 px-2 rounded cursor-pointer select-none"
                                >
                                  Reverse
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FULL SCREEN DEDICATED GRN DIALOG */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-5xl h-[92vh] flex flex-col justify-between bg-white dark:bg-zinc-900 p-6 md:p-8">
          <DialogHeader className="border-b pb-4 border-zinc-150 dark:border-zinc-800">
            <DialogTitle className="text-xl font-black text-zinc-900 dark:text-white">Process Bulk Shipment Arrival (Goods Received Note)</DialogTitle>
          </DialogHeader>

          {(() => {
            // Compute real-time filtered products
            const filteredProducts = products.filter(p => {
              const term = extraProductSearch.toLowerCase();
              return (p.name || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term);
            });

            // Calculate active supplier linkage
            let activeSupplierName = 'Cash Supplier';
            if (selectedPOId && selectedPOId !== 'none') {
              const matchedPO = purchaseOrders.find(p => p.id === selectedPOId);
              const matchedPOSupplier = matchedPO ? suppliers.find(s => s.id === matchedPO.supplier_id) : null;
              activeSupplierName = matchedPOSupplier ? matchedPOSupplier.name : 'Cash Supplier';
            } else {
              const standaloneSupplier = standaloneSupplierId !== 'cash-supplier' ? suppliers.find(s => s.id === standaloneSupplierId) : null;
              activeSupplierName = standaloneSupplier ? standaloneSupplier.name : 'Cash Supplier';
            }

            // Calculations for summary card
            const totalProjectedBillValue = receivableItems.reduce((sum, item) => sum + ((item.quantityReceived || 0) * (item.costPrice || 0)), 0);
            const totalReceivedUnits = receivableItems.reduce((sum, item) => sum + (item.quantityReceived || 0), 0);

            return (
              <form onSubmit={handleReceiveGoods} className="flex-1 flex flex-col justify-between overflow-y-auto min-h-0 space-y-6 py-4">
                <div className="space-y-6">
                  
                  {/* Meta Inputs: Date selection, target location, PO selector */}
                  <div className={`grid grid-cols-1 md:grid-cols-${selectedPOId === 'none' ? '4' : '3'} gap-6`}>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                        Receipt Date
                      </label>
                      <Input 
                        type="date" 
                        value={grnDate} 
                        onChange={e => setGrnDate(e.target.value)} 
                        className="bg-white dark:bg-zinc-850 border-zinc-200 dark:border-zinc-750"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Clear Against Purchase Order</label>
                      <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                        <SelectTrigger className="bg-white dark:bg-zinc-850 border-zinc-200 dark:border-zinc-750">
                          <SelectValue placeholder="No PO / Standalone GRN">
                            {(() => {
                              if (selectedPOId === 'none') return 'Standalone GRN (No PO Matching)';
                              const matched = purchaseOrders.find(po => po.id === selectedPOId);
                              if (!matched) return 'Select PO Reference / Standalone';
                              const sup = suppliers.find(s => s.id === matched.supplier_id);
                              return `${matched.po_number || 'PO'} - ${sup ? sup.name : 'Supplier'} ($${matched.total_amount?.toFixed(2)})`;
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-150">
                          <SelectItem value="none">Standalone GRN (No PO Matching)</SelectItem>
                          {purchaseOrders.map(po => {
                            const sup = suppliers.find(s => s.id === po.supplier_id);
                            return (
                              <SelectItem key={po.id} value={po.id}>
                                {po.po_number || 'PO'} — {sup ? sup.name : 'Supplier'} (${po.total_amount?.toFixed(2)})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedPOId === 'none' && (
                      <div className="space-y-1.5 animate-in fade-in duration-200">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-100">Linked Supplier (Required for Bill)</label>
                        <Select value={standaloneSupplierId} onValueChange={setStandaloneSupplierId}>
                          <SelectTrigger className="bg-white dark:bg-zinc-850 border-zinc-200 dark:border-zinc-750">
                            <SelectValue placeholder="Cash Supplier">
                              {suppliers.find(s => s.id === standaloneSupplierId)?.name || 'Cash Supplier'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100">
                            <SelectItem value="cash-supplier">Cash Supplier (No Supplier Account)</SelectItem>
                            {suppliers.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Target Warehouse / Branch Location</label>
                      <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                        <SelectTrigger className="bg-white dark:bg-zinc-850 border-zinc-200 dark:border-zinc-750">
                          <SelectValue placeholder="Select Destination Block">
                            {branches.find(b => b.id === selectedBranchId)?.name || 'Select Destination'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100">
                          {branches.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                  </div>

                  {/* Accounting Balance Routing Informational Banner */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-blue-200/50 bg-blue-50/40 dark:bg-blue-950/10">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Financial Bill Routing</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
                          Linked Supplier: <span className="text-blue-700 dark:text-blue-400 font-bold">{activeSupplierName}</span>
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-805">
                          {selectedPOId !== 'none' ? 'PO Linked Balance' : 'Cash Account Balance'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {selectedPOId !== 'none' 
                          ? `Authorized automatically via PO: ${(purchaseOrders.find(p => p.id === selectedPOId))?.po_number}`
                          : `For standalone arrivals, purchases will report details under the specify or general 'Cash Supplier' system profile.`}
                      </p>
                    </div>

                    <div className="flex flex-col justify-center md:items-end">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Dynamic Projected Bill Value</span>
                      <div className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                        ${totalProjectedBillValue.toFixed(2)}
                      </div>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {totalReceivedUnits} Total Received Units
                      </p>
                    </div>
                  </div>

                  {/* Bulk Interactive Table */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
                    <div className="bg-zinc-50 dark:bg-zinc-900/80 p-3 border-b border-zinc-200 dark:border-zinc-850 flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <Package className="h-4 w-4 text-zinc-500" />
                        Shipment Itemization & Batch Setup
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Total bulk items queue: {receivableItems.length}
                      </span>
                    </div>

                    <div ref={grnContainerRef} className="overflow-x-auto max-h-[260px] overflow-y-auto scroll-smooth">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-zinc-100 dark:bg-zinc-800 text-[11px] text-zinc-650 dark:text-zinc-400 font-bold border-bSticky border-zinc-205 dark:border-zinc-800 top-0 z-10">
                          <tr>
                            <th className="p-3">Product Description</th>
                            <th className="p-3 text-center">SKU</th>
                            <th className="p-3 text-center">Ordered Qty</th>
                            <th className="p-3 text-center">Received Qty (Wider)</th>
                            <th className="p-3 text-center">Unit Cost ($) (Wider)</th>
                            <th className="p-3 text-center">Batch Label (Required)</th>
                            <th className="p-3 text-center w-12 border-l border-zinc-200 dark:border-zinc-800">Rem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {receivableItems.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center py-10 text-zinc-400 dark:text-zinc-500 italic">
                                No products are currently staged. Select a PO from above or add custom products manually below.
                              </td>
                            </tr>
                          ) : (
                            receivableItems.map((item, index) => (
                              <tr key={index} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                                <td className="p-3 font-semibold text-zinc-900 dark:text-zinc-50">{item.product_name}</td>
                                <td className="p-3 text-center font-mono text-zinc-500 text-[10px]">{item.sku || '-'}</td>
                                <td className="p-3 text-center text-zinc-500 dark:text-zinc-450 font-mono italic">
                                  {item.quantityOrdered > 0 ? `${item.quantityOrdered} ordered` : 'N/A (Extra)'}
                                </td>
                                <td className="p-3 text-center">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.quantityReceived === 0 ? "0.00" : item.quantityReceived}
                                    onChange={e => updateReceivedQty(index, Number(e.target.value))}
                                    onFocus={(e) => e.target.select()}
                                    className="w-48 mx-auto text-center h-8 font-semibold text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850"
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.costPrice === 0 ? "0.00" : item.costPrice}
                                    onChange={e => updateCostPrice(index, Number(e.target.value))}
                                    onFocus={(e) => e.target.select()}
                                    className="w-48 mx-auto text-center h-8 font-semibold text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850"
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <Input
                                    type="text"
                                    value={item.batchNumber}
                                    onChange={e => updateBatchNumber(index, e.target.value)}
                                    placeholder="e.g. B-GEN-01"
                                    className="w-36 mx-auto text-center h-8 font-mono text-xs border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 dark:text-zinc-100"
                                  />
                                </td>
                                <td className="p-3 text-center border-l border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-900">
                                  <button type="button" onClick={() => removeItemFromGRN(index)} className="text-red-500 hover:text-red-700 font-bold">
                                    <Trash2 className="h-4 w-4 mx-auto" strokeWidth={2.5} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add Standalone Product manually below */}
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 relative">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-350 block">Adding Extra/Ad-hoc Products on this GRN Record</span>
                    
                    {/* Real-time Products search input */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
                      <div className="space-y-1.5 w-full relative">
                        <span className="text-[11px] text-zinc-500 font-semibold block flex items-center gap-1">
                          <Search className="h-3 w-3" /> Search Product (Type to filter dropdown choices instantly)
                        </span>
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="Type SKU or Name to find product matches..."
                            value={extraProductSearch}
                            onChange={e => setExtraProductSearch(e.target.value)}
                            className="h-9 bg-white dark:bg-zinc-850 text-xs border-zinc-250 w-full"
                          />
                          
                          {/* Rich Suggestions Match Dropdown per user request */}
                          {extraProductSearch.trim().length > 0 && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-lg shadow-2xl max-h-52 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                              {filteredProducts.slice(0, 10).map(p => (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    handleSelectExtraProduct(p.id);
                                    setExtraProductSearch('');
                                  }}
                                  className="p-2.5 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer flex justify-between items-center text-zinc-800 dark:text-zinc-200"
                                >
                                  <span>{p.name} {p.sku ? `(${p.sku})` : ''}</span>
                                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">${Number(p.cost_price || 0).toFixed(2)}</span>
                                </div>
                              ))}
                              {filteredProducts.length === 0 && (
                                <div className="p-3 text-xs text-zinc-400 dark:text-zinc-500 italic text-center">No matching products found</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 w-full">
                        <span className="text-[11px] text-zinc-500 font-semibold block">Select Filtered Product</span>
                        <Select value={extraProductId} onValueChange={handleSelectExtraProduct}>
                          <SelectTrigger className="bg-white dark:bg-zinc-850 h-9 text-xs w-full">
                            <SelectValue placeholder="Click to choose matches..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-zinc-850 max-h-60 overflow-y-auto text-zinc-900 dark:text-zinc-50">
                            {filteredProducts.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} {p.sku ? `(${p.sku})` : ''} — ${Number(p.cost_price || 0).toFixed(2)}
                              </SelectItem>
                            ))}
                            {filteredProducts.length === 0 && (
                              <SelectItem value="none" disabled>No products matching filters</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-end pt-2 border-t border-zinc-200/50">
                      
                      <div className="w-full sm:w-1/3 space-y-1.5">
                        <span className="text-[11px] text-zinc-500 font-semibold block">Qty Arrival (Wider)</span>
                        <Input 
                          type="number" 
                          step="0.01"
                          min="0"
                          value={extraQty} 
                          onChange={e => setExtraQty(e.target.value)} 
                          onFocus={(e) => e.target.select()}
                          className="h-10 bg-white dark:bg-zinc-850 text-xs border-zinc-300 dark:border-zinc-700 text-center w-full grow font-semibold dark:text-white"
                        />
                      </div>

                      <div className="w-full sm:w-1/3 space-y-1.5">
                        <span className="text-[11px] text-zinc-500 font-semibold block">Unit Cost Price ($) (Wider)</span>
                        <Input 
                          type="number" 
                          step="0.01"
                          min="0"
                          value={extraCostPrice} 
                          onChange={e => setExtraCostPrice(e.target.value)} 
                          onFocus={(e) => e.target.select()}
                          className="h-10 bg-white dark:bg-zinc-850 text-xs border-zinc-300 dark:border-zinc-700 text-center w-full grow font-semibold dark:text-white"
                        />
                      </div>

                      <div className="w-full sm:w-1/3 space-y-1.5">
                        <span className="text-[11px] text-zinc-500 font-semibold block">Batch No. (Optional)</span>
                        <Input 
                          type="text" 
                          placeholder="e.g. B-MAY-26" 
                          value={extraBatchNum} 
                          onChange={e => setExtraBatchNum(e.target.value)} 
                          className="h-10 bg-white dark:bg-zinc-850 text-xs border-zinc-300 dark:border-zinc-700 text-center font-mono w-full dark:text-white"
                        />
                      </div>

                      <Button type="button" onClick={handleAddExtraItem} variant="outline" className="h-10 px-5 text-xs font-bold border-zinc-300 whitespace-nowrap bg-zinc-900 border text-white hover:bg-zinc-800 w-full sm:w-auto cursor-pointer">
                        Add To Packing List
                      </Button>

                    </div>
                  </div>

                  {/* Global Receiving Remarks */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-750 dark:text-zinc-300">Receiving Clerk Notes / Remarks (Global discrepancy audit)</label>
                    <Input 
                      value={grnNotes} 
                      onChange={e => setGrnNotes(e.target.value)} 
                      placeholder="e.g. Shipment delivered in 1 parcel, seal checked and pristine condition."
                      className="bg-white dark:bg-zinc-850 border-zinc-200 dark:border-zinc-700"
                    />
                  </div>

                </div>

                <DialogFooter className="border-t pt-4 mt-6 gap-2 sm:gap-0 border-zinc-150 dark:border-zinc-800">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={submitting}>Cancel / Close</Button>
                  <Button type="submit" disabled={submitting} className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold px-7 h-11 flex items-center justify-center cursor-pointer select-none">
                    {submitting ? (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="animate-spin h-4 w-4 shrink-0" /> Processing Cargo Shipment...
                      </span>
                    ) : (
                      "Receive Cargo & Clear Stock (GRN)"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
