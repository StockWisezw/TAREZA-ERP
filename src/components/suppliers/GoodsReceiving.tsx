import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Search, Filter, Plus, Package, Check, RefreshCw, Layers, ArrowDownLeft, Trash2, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '../../lib/firebaseClient';
import { toast } from 'sonner';

export interface ReceivableItem {
  product_id: string;
  product_name: string;
  sku?: string;
  quantityOrdered: number;
  quantityReceived: number;
  batchNumber: string;
}

export default function GoodsReceiving() {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Extra / Non-PO item state selectors
  const [extraProductId, setExtraProductId] = useState('');
  const [extraQty, setExtraQty] = useState('1');
  const [extraBatchNum, setExtraBatchNum] = useState('');

  // History log of received goods
  const [grnHistory, setGrnHistory] = useState<any[]>([]);

  // Synchronize PO product items to editable bulk list
  useEffect(() => {
    if (!selectedPOId || purchaseOrders.length === 0) {
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
          batchNumber: `B-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100+Math.random()*900)}`
        };
      });
      setReceivableItems(mapped);
    } else {
      setReceivableItems([]);
    }
  }, [selectedPOId, purchaseOrders, products]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [poRes, branchRes, prodRes, supRes, movementsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('branches').select('*').order('name'),
        supabase.from('products').select('*').eq('is_active', true).order('name'),
        supabase.from('suppliers').select('*'),
        supabase.from('stock_movements').select('*').eq('type', 'IN').order('created_at', { ascending: false }).limit(30)
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
      if (pos.length > 0) setSelectedPOId(pos[0].id);
      if (brs.length > 0) setSelectedBranchId(brs[0].id);

      // Map movement history
      const mappedMovements = (movementsRes.data || []).map((m: any) => {
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
      toast.error('Failed to load Goods Receiving context');
    } finally {
      setLoading(false);
    }
  };

  // Add a brand new item inline to the bulk GRN checklist
  const handleAddExtraItem = () => {
    if (!extraProductId) {
      toast.error('Please pick a product to add to this receipt.');
      return;
    }
    const match = products.find(p => p.id === extraProductId);
    if (!match) return;

    const qty = Number(extraQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a positive quantity.');
      return;
    }

    const nextBatch = extraBatchNum.trim() || `B-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100+Math.random()*900)}`;

    const alreadyInList = receivableItems.some(i => i.product_id === match.id);
    if (alreadyInList) {
      setReceivableItems(prev => prev.map(item => {
        if (item.product_id === match.id) {
          return {
            ...item,
            quantityReceived: item.quantityReceived + qty
          };
        }
        return item;
      }));
      toast.success(`Updated receipt quantity for ${match.name}.`);
    } else {
      setReceivableItems(prev => [
        ...prev,
        {
          product_id: match.id,
          product_name: match.name,
          sku: match.sku,
          quantityOrdered: 0,
          quantityReceived: qty,
          batchNumber: nextBatch
        }
      ]);
      toast.success(`${match.name} added to the bulk GRN queue.`);
    }

    setExtraProductId('');
    setExtraQty('1');
    setExtraBatchNum('');
  };

  const removeItemFromGRN = (index: number) => {
    setReceivableItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateReceivedQty = (index: number, val: number) => {
    if (val < 0) return;
    setReceivableItems(prev => prev.map((item, i) => i === index ? { ...item, quantityReceived: val } : item));
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

      // Allow old historical dates
      const selectedDate = grnDate ? new Date(grnDate).toISOString() : new Date().toISOString();

      for (const item of itemsToProcess) {
        const qty = item.quantityReceived;
        const bNum = item.batchNumber || 'N/A';
        const formattedNotes = `Batch: ${bNum}. GRN Note: ${grnNotes.trim() || 'No notes left.'}`;

        // 1. Log stock movement
        const movementId = crypto.randomUUID();
        const movementPayload = {
          id: movementId,
          product_id: item.product_id,
          branch_id: selectedBranchId,
          quantity: qty,
          type: 'IN',
          created_at: selectedDate,
          notes: formattedNotes
        };
        const { error: moveError } = await supabase.from('stock_movements').insert(movementPayload);
        if (moveError) throw moveError;

        // 2. Adjust or upsert inventory stock balances
        const { data: invRecords } = await supabase
          .from('inventory')
          .select('*')
          .eq('product_id', item.product_id)
          .eq('branch_id', selectedBranchId);

        if (invRecords && invRecords.length > 0) {
          const record = invRecords[0];
          const newQty = (record.quantity || 0) + qty;
          const { error: invError } = await supabase
            .from('inventory')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', record.id);
          if (invError) throw invError;
        } else {
          const newInvId = crypto.randomUUID();
          const { error: invError } = await supabase
            .from('inventory')
            .insert({
              id: newInvId,
              business_id: businessId || null,
              product_id: item.product_id,
              branch_id: selectedBranchId,
              quantity: qty,
              reorder_level: 10,
              created_at: selectedDate
            });
          if (invError) throw invError;
        }
      }

      // 3. Mark matching PO as RECEIVED if applicable
      if (selectedPOId) {
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
        <Button onClick={() => setIsOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-semibold">
          <ArrowDownLeft className="mr-2 h-4 w-4 text-white" /> Create New Bulk GRN Receipt
        </Button>
      </div>

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
                  <div key={po.id} className="p-3 bg-white border border-zinc-200 rounded-lg flex justify-between items-center transition-all hover:bg-zinc-50">
                    <div>
                      <p className="font-mono text-xs font-semibold text-blue-600">{po.po_number || 'PO-GEN'}</p>
                      <p className="text-xs font-medium text-zinc-700">{supplier ? supplier.name : 'Unknown Supplier'}</p>
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
                <TableHeader className="bg-zinc-100">
                  <TableRow>
                    <TableHead className="font-semibold text-zinc-700">Time Received</TableHead>
                    <TableHead className="font-semibold text-zinc-700">Product SKU / Name</TableHead>
                    <TableHead className="font-semibold text-zinc-700">Storage Location</TableHead>
                    <TableHead className="font-semibold text-zinc-700 text-right">Received Count</TableHead>
                    <TableHead className="font-semibold text-zinc-700 text-center w-[120px]">Verification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grnHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-zinc-400 text-sm">
                        No recent receiving logs. Press the button above to initiate a bulk stock arrival.
                      </TableCell>
                    </TableRow>
                  ) : (
                    grnHistory.map((log) => (
                      <TableRow key={log.id} className="hover:bg-zinc-50/50">
                        <TableCell className="text-xs text-zinc-500">{new Date(log.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <p className="font-semibold text-xs text-zinc-900">{log.product_name}</p>
                          <p className="font-mono text-[10px] text-zinc-400">{log.sku || '-'}</p>
                          {log.notes && (
                            <p className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded italic mt-1 inline-block whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">{log.notes}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-600">{log.branch_name}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-600">+{log.quantity} units</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="h-3 w-3 text-emerald-600 mr-1" /> Checked
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FULL SCREEN DEDICATED GRN DIALOG */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-5xl h-[92vh] flex flex-col justify-between bg-white p-6 md:p-8">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold text-zinc-900">Process Bulk Shipment Arrival (Goods Received Note)</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleReceiveGoods} className="flex-1 flex flex-col justify-between overflow-y-auto min-h-0 space-y-6 py-4">
            <div className="space-y-6">
              
              {/* Meta Inputs: Date selection, target location, PO selector */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                    Receipt Date (Allows Old/Past Dates)
                  </label>
                  <Input 
                    type="date" 
                    value={grnDate} 
                    onChange={e => setGrnDate(e.target.value)} 
                    className="bg-white border-zinc-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Clear Against Purchase Order</label>
                  <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                    <SelectTrigger className="bg-white border-zinc-200">
                      <SelectValue placeholder="No PO / Standalone GRN">
                        {(() => {
                          const matched = purchaseOrders.find(po => po.id === selectedPOId);
                          if (!matched) return 'Select PO Reference';
                          const sup = suppliers.find(s => s.id === matched.supplier_id);
                          return `${matched.po_number || 'PO'} - ${sup ? sup.name : 'Supplier'} ($${matched.total_amount?.toFixed(2)})`;
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {purchaseOrders.map(po => {
                        const sup = suppliers.find(s => s.id === po.supplier_id);
                        return (
                          <SelectItem key={po.id} value={po.id}>
                            {po.po_number || 'PO'} — {sup ? sup.name : 'Supplier'} (${po.total_amount?.toFixed(2)})
                          </SelectItem>
                        );
                      })}
                      {purchaseOrders.length === 0 && (
                        <SelectItem value="none" disabled>No pending POs available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Target Warehouse / Branch Location</label>
                  <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                    <SelectTrigger className="bg-white border-zinc-200">
                      <SelectValue placeholder="Select Destination Block">
                        {branches.find(b => b.id === selectedBranchId)?.name || 'Select Destination'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>

              {/* Bulk Interactive Table */}
              <div className="border border-zinc-200 rounded-xl bg-white overflow-hidden shadow-sm">
                <div className="bg-zinc-50 p-3 border-b flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-zinc-500" />
                    Shipment Itemization & Batch Setup
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Total bulk items queue: {receivableItems.length}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-100 text-[11px] text-zinc-650 font-bold border-b sticky top-0 z-10">
                      <tr>
                        <th className="p-3">Product Description</th>
                        <th className="p-3 text-center">SKU</th>
                        <th className="p-3 text-center">Ordered Qty</th>
                        <th className="p-3 text-center">Received Qty</th>
                        <th className="p-3 text-center">Batch Label (Required)</th>
                        <th className="p-3 text-center w-12 border-l">Rem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {receivableItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-zinc-400 italic">
                            No products are currently staged. Select a PO from above or add custom products manually below.
                          </td>
                        </tr>
                      ) : (
                        receivableItems.map((item, index) => (
                          <tr key={index} className="hover:bg-zinc-50/50">
                            <td className="p-3 font-semibold text-zinc-900">{item.product_name}</td>
                            <td className="p-3 text-center font-mono text-zinc-500 text-[10px]">{item.sku || '-'}</td>
                            <td className="p-3 text-center text-zinc-500 font-mono italic">
                              {item.quantityOrdered > 0 ? `${item.quantityOrdered} ordered` : 'N/A (Extra)'}
                            </td>
                            <td className="p-3 text-center">
                              <Input
                                type="number"
                                min="0"
                                value={item.quantityReceived}
                                onChange={e => updateReceivedQty(index, Number(e.target.value))}
                                className="w-24 mx-auto text-center h-8 font-semibold text-zinc-900 border-zinc-300"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <Input
                                type="text"
                                value={item.batchNumber}
                                onChange={e => updateBatchNumber(index, e.target.value)}
                                placeholder="e.g. B-GEN-01"
                                className="w-36 mx-auto text-center h-8 font-mono text-xs border-zinc-300"
                              />
                            </td>
                            <td className="p-3 text-center border-l bg-zinc-50">
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
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
                <span className="text-xs font-bold text-zinc-700 block">Adding Extra/Ad-hoc Products on this GRN Record</span>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  
                  <div className="flex-1 space-y-1.5 w-full">
                    <span className="text-[11px] text-zinc-500 font-semibold block">Pick Product</span>
                    <Select value={extraProductId} onValueChange={setExtraProductId}>
                      <SelectTrigger className="bg-white h-9 text-xs">
                        <SelectValue placeholder="Select Ad-hoc Product" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku || 'No SKU'})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full sm:w-28 space-y-1.5">
                    <span className="text-[11px] text-zinc-500 font-semibold block">Qty Arrival</span>
                    <Input 
                      type="number" 
                      min="1" 
                      value={extraQty} 
                      onChange={e => setExtraQty(e.target.value)} 
                      className="h-9 bg-white text-xs border-zinc-300 text-center"
                    />
                  </div>

                  <div className="w-full sm:w-36 space-y-1.5">
                    <span className="text-[11px] text-zinc-500 font-semibold block">Batch No. (Optional)</span>
                    <Input 
                      type="text" 
                      placeholder="e.g. B-MAY-26" 
                      value={extraBatchNum} 
                      onChange={e => setExtraBatchNum(e.target.value)} 
                      className="h-9 bg-white text-xs border-zinc-300 text-center font-mono"
                    />
                  </div>

                  <Button type="button" onClick={handleAddExtraItem} variant="outline" className="h-9 px-4 text-xs font-bold border-zinc-300 whitespace-nowrap bg-zinc-900 border text-white hover:bg-zinc-800">
                    Add To Packing List
                  </Button>

                </div>
              </div>

              {/* Global Receiving Remarks */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-750">Receiving Clerk Notes / Remarks (Global discrepency audit)</label>
                <Input 
                  value={grnNotes} 
                  onChange={e => setGrnNotes(e.target.value)} 
                  placeholder="e.g. Shipment delivered in 1 parcel, seal checked and pristine condition."
                  className="bg-white border-zinc-200"
                />
              </div>

            </div>

            <DialogFooter className="border-t pt-4 mt-6 gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel / Close</Button>
              <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold px-6">
                Receive Cargo & Clear Stock (GRN)
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
