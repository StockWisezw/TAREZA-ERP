import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Search, Filter, Plus, Package, Check, RefreshCw, Layers, ArrowDownLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';

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
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantityToReceive, setQuantityToReceive] = useState('10');
  const [grnNotes, setGrnNotes] = useState('');

  // History log of received goods
  const [grnHistory, setGrnHistory] = useState<any[]>([]);

  // Automatically update product selection and quantities based on chosen PO items
  useEffect(() => {
    if (!selectedPOId || purchaseOrders.length === 0) return;
    const po = purchaseOrders.find(p => p.id === selectedPOId);
    if (po && po.items && po.items.length > 0) {
      const firstItem = po.items[0];
      setSelectedProductId(firstItem.product_id);
      setQuantityToReceive(firstItem.quantity?.toString() || '1');
    }
  }, [selectedPOId, purchaseOrders]);

  const currentPO = purchaseOrders.find(po => po.id === selectedPOId);
  const poItems = currentPO?.items || [];
  const filteredProducts = poItems.length > 0 
    ? products.filter(p => poItems.some((it: any) => it.product_id === p.id))
    : products;

  const handleProductChange = (val: string) => {
    setSelectedProductId(val);
    if (currentPO && currentPO.items) {
      const match = currentPO.items.find((it: any) => it.product_id === val);
      if (match) {
        setQuantityToReceive(match.quantity?.toString() || '1');
      }
    }
  };

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
        supabase.from('stock_movements').select('*').eq('type', 'IN').order('created_at', { ascending: false }).limit(20)
      ]);

      const pos = poRes.data || [];
      const brs = branchRes.data || [];
      const prods = prodRes.data || [];
      const sups = supRes.data || [];

      setPurchaseOrders(pos);
      setBranches(brs);
      setProducts(prods);
      setSuppliers(sups);

      // Select default PO and branch for dialog
      if (pos.length > 0) setSelectedPOId(pos[0].id);
      if (brs.length > 0) setSelectedBranchId(brs[0].id);
      if (prods.length > 0) setSelectedProductId(prods[0].id);

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

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedBranchId || !quantityToReceive) {
      toast.error("Please fill in all receiving fields");
      return;
    }

    const qty = parseInt(quantityToReceive);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid positive quantity");
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

      // 1. Log stock movement
      const movementId = crypto.randomUUID();
      const movementPayload = {
        id: movementId,
        product_id: selectedProductId,
        branch_id: selectedBranchId,
        quantity: qty,
        type: 'IN',
        created_at: new Date().toISOString()
      };
      const { error: moveError } = await supabase.from('stock_movements').insert(movementPayload);
      if (moveError) throw moveError;

      // 2. Adjust/upsert inventory quantity
      const { data: invRecords } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', selectedProductId)
        .eq('branch_id', selectedBranchId);

      if (invRecords && invRecords.length > 0) {
        // update existing
        const record = invRecords[0];
        const newQty = (record.quantity || 0) + qty;
        const { error: invError } = await supabase
          .from('inventory')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', record.id);
        if (invError) throw invError;
      } else {
        // insert new
        const newInvId = crypto.randomUUID();
        const { error: invError } = await supabase
          .from('inventory')
          .insert({
            id: newInvId,
            business_id: businessId || null,
            product_id: selectedProductId,
            branch_id: selectedBranchId,
            quantity: qty,
            reorder_level: 10,
            created_at: new Date().toISOString()
          });
        if (invError) throw invError;
      }

      // 3. Mark selected PO as RECEIVED if there was an active PO selected
      if (selectedPOId) {
        const { error: poError } = await supabase
          .from('purchase_orders')
          .update({ status: 'RECEIVED' })
          .eq('id', selectedPOId);
        if (poError) throw poError;
      }

      toast.success(`Success! Received ${qty} unit(s) of stock. Inventory updated!`);
      setIsOpen(false);
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
          <p className="text-sm text-zinc-500 mt-0.5">Receive warehouse stock, balance incoming purchase orders, and record stock status logs.</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
          <ArrowDownLeft className="mr-2 h-4 w-4" /> Receive Incoming Stock (GRN)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 border-zinc-200">
          <CardHeader>
            <CardTitle className="text-base">Pending Orders</CardTitle>
            <CardDescription>POs ready to be fully or partially received.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {purchaseOrders.filter(po => po.status !== 'RECEIVED').length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">No pending purchase orders.</p>
            ) : (
              purchaseOrders.filter(po => po.status !== 'RECEIVED').map(po => {
                const supplier = suppliers.find(s => s.id === po.supplier_id);
                return (
                  <div key={po.id} className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-mono text-xs font-semibold text-blue-600">{po.po_number || 'PO-GEN'}</p>
                      <p className="text-xs font-medium text-zinc-700">{supplier ? supplier.name : 'Unknown Supplier'}</p>
                      <p className="text-[11px] text-zinc-500">Expected: {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : '-'}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] text-zinc-600 capitalize">{po.status?.toLowerCase().replace('_', ' ')}</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 border-zinc-200">
          <CardHeader>
            <CardTitle className="text-base">Recent Stock Receipts (GRN Audit Logs)</CardTitle>
            <CardDescription>Verified log entries showing inventory quantity additions.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-zinc-50">
                <TableRow>
                  <TableHead>Time Received</TableHead>
                  <TableHead>Product SKU / Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Qty Received</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grnHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-zinc-400 text-sm">
                      No recent receiving logs. Press the button above to receive stock.
                    </TableCell>
                  </TableRow>
                ) : (
                  grnHistory.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-zinc-500">{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <p className="font-semibold text-xs text-zinc-900">{log.product_name}</p>
                        <p className="font-mono text-[10px] text-zinc-400">{log.sku || '-'}</p>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600">{log.branch_name}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">+{log.quantity} units</TableCell>
                      <TableCell className="text-center">
                        <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Receive Stock against Purchase Order</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleReceiveGoods} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-650">Select Purchase Order</label>
              <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                <SelectTrigger className="bg-white border-zinc-200">
                  <SelectValue placeholder="Select PO Reference" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {purchaseOrders.map(po => {
                    const sup = suppliers.find(s => s.id === po.supplier_id);
                    return (
                      <SelectItem key={po.id} value={po.id}>
                        {po.po_number || 'PO'} - {sup ? sup.name : 'Supplier'} (${po.total_amount?.toFixed(2)})
                      </SelectItem>
                    );
                  })}
                  {purchaseOrders.length === 0 && (
                    <SelectItem value="none" disabled>No active POs to clear</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {poItems.length > 0 && (
              <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-lg space-y-2 text-xs">
                <span className="font-bold text-zinc-700 block">Ordered Products in this PO:</span>
                <div className="space-y-1 divide-y divide-zinc-100 max-h-[140px] overflow-y-auto">
                  {poItems.map((it: any, index: number) => {
                    const isSelected = selectedProductId === it.product_id;
                    return (
                      <div key={index} className={`flex justify-between items-center py-1.5 px-2 rounded-md ${isSelected ? 'bg-blue-50 font-semibold text-blue-700' : 'text-zinc-650'}`}>
                        <span>• {it.product_name}</span>
                        <span className="font-mono text-[11px]">Ordered Qty: <strong className="text-zinc-900">{it.quantity}</strong></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-650">Item Received</label>
                <Select value={selectedProductId} onValueChange={handleProductChange}>
                  <SelectTrigger className="bg-white border-zinc-200">
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {filteredProducts.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    {filteredProducts.length === 0 && (
                      <SelectItem value="none" disabled>No active products</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-650">Target Warehouse Branch</label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="bg-white border-zinc-200">
                    <SelectValue placeholder="Destination Location" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                    {branches.length === 0 && (
                      <SelectItem value="none" disabled>No active branches</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Quantity Count to Adjust (Add into stock)</label>
                <Input 
                  type="number" 
                  value={quantityToReceive} 
                  onChange={e => setQuantityToReceive(e.target.value)} 
                  placeholder="10"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Receiving Clerk Notes (Discrepancy audit)</label>
                <Input 
                  value={grnNotes} 
                  onChange={e => setGrnNotes(e.target.value)} 
                  placeholder="Perfect condition, verified count matches packing list."
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel/Close</Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">Receive Goods (GRN)</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
