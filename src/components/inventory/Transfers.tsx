import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { 
  Search, 
  Plus, 
  ArrowRightLeft, 
  MapPin, 
  Truck, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  X, 
  Eye, 
  AlertTriangle 
} from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/firebaseClient';

export function Transfers() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // New Transfer Form State
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  
  // Single Item Draft Selection
  const [tempProductId, setTempProductId] = useState('');
  const [tempQty, setTempQty] = useState<number>(1);

  // View Details State
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchTransfers(),
        fetchBranches(),
        fetchProducts(),
        fetchInventory()
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransfers = async () => {
    const { data, error } = await supabase
      .from('inventory_transfers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transfers:', error);
    } else if (data) {
      setTransfers(data);
    }
  };

  const fetchBranches = async () => {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching branches:', error);
    } else if (data) {
      setBranches(data);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching products:', error);
    } else if (data) {
      setProducts(data);
    }
  };

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*');

    if (error) {
      console.error('Error fetching inventory:', error);
    } else if (data) {
      setInventory(data);
    }
  };

  // Helper to determine product stock at a specific branch
  const getProductStockAtBranch = (prodId: string, branchId: string): number => {
    if (!prodId || !branchId) return 0;
    const record = inventory.find(i => i.product_id === prodId && i.branch_id === branchId);
    return record ? Number(record.quantity) : 0;
  };

  const handleAddProductToDraft = () => {
    if (!fromBranchId) {
      toast.error('Please select an origin branch first.');
      return;
    }
    if (!tempProductId) {
      toast.error('Please select a product to add.');
      return;
    }

    const qtyVal = Number(tempQty);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      toast.error('Please enter a valid transfer quantity.');
      return;
    }

    const product = products.find(p => p.id === tempProductId);
    if (!product) return;

    const availableStock = getProductStockAtBranch(tempProductId, fromBranchId);
    
    // Check if item is already drafted
    const existingIndex = selectedItems.findIndex(i => i.product_id === tempProductId);
    const existingQty = existingIndex >= 0 ? selectedItems[existingIndex].quantity : 0;
    const totalDraftedQty = existingQty + qtyVal;

    if (totalDraftedQty > availableStock) {
      toast.warning(`Warning: Selected quantity (${totalDraftedQty}) exceeds current in-stock quantity (${availableStock}) at the origin branch.`);
    }

    if (existingIndex >= 0) {
      // Update quantity
      const updated = [...selectedItems];
      updated[existingIndex].quantity = totalDraftedQty;
      setSelectedItems(updated);
    } else {
      // Add new
      setSelectedItems(prev => [
        ...prev, 
        {
          product_id: tempProductId,
          name: product.name,
          sku: product.sku || 'N/A',
          quantity: qtyVal,
          current_stock: availableStock
        }
      ]);
    }

    // Reset single item state
    setTempProductId('');
    setTempQty(1);
  };

  const handleRemoveDraftItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateTransfer = async () => {
    if (!fromBranchId) {
      toast.error('Origin branch is required.');
      return;
    }
    if (!toBranchId) {
      toast.error('Destination branch is required.');
      return;
    }
    if (fromBranchId === toBranchId) {
      toast.error('Origin and destination branches must be different.');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Please add at least one product line item to transfer.');
      return;
    }

    try {
      const activeBusinessRes = await supabase.from('business_users').select('business_id').limit(1).maybeSingle();
      const bizId = activeBusinessRes?.data?.business_id || null;

      const randomId = Math.random().toString(36).substring(2, 15);
      const newTrf = {
        id: randomId,
        business_id: bizId,
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        status: 'PENDING',
        notes: notes,
        items: selectedItems,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('inventory_transfers')
        .insert(newTrf);

      if (error) throw error;

      toast.success('Inventory transfer ticket has been created dynamically in PENDING state!');
      setIsNewTransferOpen(false);
      
      // Clean up fields
      setFromBranchId('');
      setToBranchId('');
      setNotes('');
      setSelectedItems([]);
      setTempProductId('');
      setTempQty(1);

      loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register transfer');
    }
  };

  const handleUpdateStatus = async (id: string, currentTransfer: any, newStatus: string) => {
    try {
      // Process inventory adjustments when status changes
      if (newStatus === 'IN_TRANSIT') {
        // Dispatching inventory: Deduct from origin branch
        const items = currentTransfer.items || [];
        if (items.length === 0) {
          toast.error('This transfer has no items to dispatch.');
          return;
        }

        for (const item of items) {
          // Adjust stock downwards at origin branch
          const { data: invRecords } = await supabase
            .from('inventory')
            .select('*')
            .eq('product_id', item.product_id)
            .eq('branch_id', currentTransfer.from_branch_id);

          if (invRecords && invRecords.length > 0) {
            const record = invRecords[0];
            const currentQty = record.quantity || 0;
            const newQty = Number(currentQty) - Number(item.quantity);
            
            await supabase
              .from('inventory')
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq('id', record.id);
          } else {
            // Negative inventory at origin if dispatching nonexistent
            const randId = Math.random().toString(36).substring(2, 11);
            await supabase
              .from('inventory')
              .insert({
                id: randId,
                business_id: currentTransfer.business_id,
                product_id: item.product_id,
                branch_id: currentTransfer.from_branch_id,
                quantity: -Number(item.quantity),
                reorder_level: 10
              });
          }

          // Write a negative stock movement record for dispatch out
          const moveId = Math.random().toString(36).substring(2, 11);
          await supabase.from('stock_movements').insert({
            id: moveId,
            product_id: item.product_id,
            branch_id: currentTransfer.from_branch_id,
            quantity: -Number(item.quantity),
            type: 'transfer_out',
            created_at: new Date().toISOString()
          });
        }
        toast.info('Stock successfully deducted from origin branch & set to IN TRANSIT.');

      } else if (newStatus === 'RECEIVED' || newStatus === 'COMPLETED') {
        // Completing or receiving: Add to destination branch
        const items = currentTransfer.items || [];
        if (items.length === 0) {
          toast.error('This transfer has no items to receive.');
          return;
        }

        for (const item of items) {
          // Add stock at destination branch
          const { data: invRecords } = await supabase
            .from('inventory')
            .select('*')
            .eq('product_id', item.product_id)
            .eq('branch_id', currentTransfer.to_branch_id);

          if (invRecords && invRecords.length > 0) {
            const record = invRecords[0];
            const currentQty = record.quantity || 0;
            const newQty = Number(currentQty) + Number(item.quantity);
            
            await supabase
              .from('inventory')
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq('id', record.id);
          } else {
            // Create brand new row for destination branch
            const randId = Math.random().toString(36).substring(2, 11);
            await supabase
              .from('inventory')
              .insert({
                id: randId,
                business_id: currentTransfer.business_id,
                product_id: item.product_id,
                branch_id: currentTransfer.to_branch_id,
                quantity: Number(item.quantity),
                reorder_level: 10
              });
          }

          // Write positive stock movement record for receiving
          const moveId = Math.random().toString(36).substring(2, 11);
          await supabase.from('stock_movements').insert({
            id: moveId,
            product_id: item.product_id,
            branch_id: currentTransfer.to_branch_id,
            quantity: Number(item.quantity),
            type: 'transfer_in',
            created_at: new Date().toISOString()
          });
        }
        
        newStatus = 'COMPLETED'; // Normalize to COMPLETED status
        toast.success('Stock successfully added to receiving branch. Transfer complete!');
      }

      await supabase
        .from('inventory_transfers')
        .update({ status: newStatus })
        .eq('id', id);

      loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update transfer status.');
    }
  };

  const getBranchName = (id: string): string => {
    const match = branches.find(b => b.id === id);
    return match ? match.name : 'Unknown Branch';
  };

  // Filter transfers list based on search bar
  const filteredTransfers = transfers.filter(trf => {
    const fromName = getBranchName(trf.from_branch_id).toLowerCase();
    const toName = getBranchName(trf.to_branch_id).toLowerCase();
    const trfNotes = (trf.notes || '').toLowerCase();
    const trfId = (trf.id || '').toLowerCase();
    const q = searchQuery.toLowerCase();

    return fromName.includes(q) || toName.includes(q) || trfNotes.includes(q) || trfId.includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Branch Transfers</h2>
          <p className="text-sm text-zinc-500">Move inventory between warehouses and track in-transit stock.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={loadAllData}>Refresh</Button>
          <Button className="w-full sm:w-auto" onClick={() => setIsNewTransferOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Transfer
          </Button>
        </div>
      </div>

      {/* Aggregate Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-100 bg-blue-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-800">In Transit</p>
              <p className="text-2xl font-bold text-blue-900">{transfers.filter(t => t.status === 'IN_TRANSIT').length}</p>
            </div>
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-amber-100 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800">Pending Approval</p>
              <p className="text-2xl font-bold text-amber-900">{transfers.filter(t => t.status === 'PENDING').length}</p>
            </div>
            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-emerald-800">Completed (Total)</p>
              <p className="text-2xl font-bold text-emerald-900">{transfers.filter(t => t.status === 'COMPLETED' || t.status === 'RECEIVED').length}</p>
            </div>
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Transfers Table */}
      <Card className="border-zinc-200 shadow-sm">
        <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-50/50 rounded-t-xl">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Search transfers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white" 
            />
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfer ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Items Count</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-zinc-500">Loading transfers...</TableCell>
              </TableRow>
            ) : filteredTransfers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-zinc-500">No transfers found.</TableCell>
              </TableRow>
             ) : filteredTransfers.map((trf) => (
              <TableRow key={trf.id} className="hover:bg-zinc-50/40">
                <TableCell className="font-mono text-xs font-semibold text-zinc-600">
                  #{trf.id?.substring(0, 8)}
                </TableCell>
                <TableCell className="text-xs text-zinc-500">
                  {trf.created_at ? new Date(trf.created_at).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-zinc-700 text-xs">
                    <MapPin className="h-3.5 w-3.5 text-zinc-400" /> 
                    {getBranchName(trf.from_branch_id)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-500" /> 
                    {getBranchName(trf.to_branch_id)}
                  </div>
                </TableCell>
                <TableCell className="text-xs font-mono font-bold text-zinc-600">
                  {(trf.items || []).length} items
                </TableCell>
                <TableCell>
                  {trf.status === 'IN_TRANSIT' && <Badge className="bg-blue-100 text-blue-805 hover:bg-blue-200 border-0 text-xs">In Transit</Badge>}
                  {trf.status === 'PENDING' && <Badge className="bg-amber-150 text-amber-850 hover:bg-amber-250 border-0 text-xs text-amber-700 font-semibold">Pending Approval</Badge>}
                  {(trf.status === 'COMPLETED' || trf.status === 'RECEIVED') && <Badge className="bg-emerald-100 text-emerald-800 border-0 hover:bg-emerald-250 text-xs font-semibold">Completed</Badge>}
                  {trf.status === 'CANCELLED' && <Badge className="bg-red-100 text-red-650 border-0 hover:bg-red-200 text-xs">Cancelled</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedTransfer(trf);
                        setIsViewOpen(true);
                      }}
                      className="h-8 text-zinc-600 hover:text-zinc-900"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    
                    {trf.status === 'PENDING' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 border-amber-200 text-amber-900 bg-amber-50 hover:bg-amber-100 hover:text-amber-950 font-medium" 
                        onClick={() => handleUpdateStatus(trf.id, trf, 'IN_TRANSIT')}
                      >
                        Dispatch
                      </Button>
                    )}

                    {trf.status === 'IN_TRANSIT' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 border-blue-200 text-blue-800 bg-blue-50 hover:bg-blue-100 hover:text-blue-900 font-medium" 
                        onClick={() => handleUpdateStatus(trf.id, trf, 'RECEIVED')}
                      >
                        Receive
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* New Transfer Creation Modal Dialog */}
      <Dialog open={isNewTransferOpen} onOpenChange={setIsNewTransferOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-905 font-bold flex items-center gap-2">
              <Truck className="h-5 w-5 text-indigo-600" /> Create Physical Inventory Transfer Request
            </DialogTitle>
            <DialogDescription>
              Physically relocate and track inventory stock items securely across business branch warehouses.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
            <div>
              <Label className="text-zinc-700 font-bold text-xs mb-1.5 block">Origin Branch (From)</Label>
              <Select 
                value={fromBranchId} 
                onValueChange={(val) => {
                  setFromBranchId(val);
                  setSelectedItems([]); // Reset selected items since stock varies
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select Origin Warehouse">
                    {branches.find(b => b.id === fromBranchId)?.name || 'Select Origin Warehouse'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-zinc-700 font-bold text-xs mb-1.5 block">Destination Branch (To)</Label>
              <Select value={toBranchId} onValueChange={setToBranchId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select Destination Warehouse">
                    {branches.find(b => b.id === toBranchId)?.name || 'Select Destination Warehouse'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id} disabled={b.id === fromBranchId}>
                      {b.name} {b.id === fromBranchId ? '(Cannot be source)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-700 font-bold text-xs">Internal Notes / Reason</Label>
            <Input 
              placeholder="e.g. Relocating soft drinks to retail shop due to stock shortage" 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-white"
            />
          </div>

          {/* Lines drafting container */}
          <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/60 my-2 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
              <h3 className="text-xs font-black uppercase text-zinc-600 tracking-wider">Draft Transfer Line Items</h3>
              {fromBranchId && <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">Showing Origin Quantities</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <Label className="text-[11px] font-bold text-zinc-650 block mb-1">Pick Product to Relocate</Label>
                <Select value={tempProductId} onValueChange={setTempProductId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={fromBranchId ? "Select Product" : "Select Origin Branch first"}>
                      {(() => {
                        const matched = products.find(p => p.id === tempProductId);
                        if (!matched) return fromBranchId ? "Select Product" : "Select Origin Branch first";
                        const originStock = getProductStockAtBranch(matched.id, fromBranchId);
                        return `${matched.name} (SKU: ${matched.sku || 'N/A'}) — In Stock: ${originStock}`;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => {
                      const originStock = getProductStockAtBranch(p.id, fromBranchId);
                      return (
                        <SelectItem key={p.id} value={p.id} disabled={!fromBranchId}>
                          {p.name} (SKU: {p.sku || 'N/A'}) — In Stock: {originStock}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <div className="w-24">
                  <Label className="text-[11px] font-bold text-zinc-650 block mb-1">Quantity</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={tempQty}
                    onChange={(e) => setTempQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-white text-right"
                  />
                </div>
                <Button type="button" onClick={handleAddProductToDraft} className="flex-1">
                  Add Item
                </Button>
              </div>
            </div>

            {/* Selected items table */}
            <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white max-h-[200px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-zinc-50">
                  <TableRow>
                    <TableHead className="text-xs py-1.5">Product Name</TableHead>
                    <TableHead className="text-xs text-right py-1.5 w-24">Origin Stock</TableHead>
                    <TableHead className="text-xs text-right py-1.5 w-24">Transfer Qty</TableHead>
                    <TableHead className="text-xs w-16 text-center py-1.5"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-zinc-400 py-6 italic text-xs">
                        Add product items above to draft transfer ticket.
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedItems.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-zinc-50/50">
                        <TableCell className="text-xs font-medium py-1.5">
                          <div>{item.name}</div>
                          <div className="text-[9px] font-mono text-zinc-400">SKU: {item.sku}</div>
                        </TableCell>
                        <TableCell className="text-xs text-right py-1.5 font-mono text-zinc-500">
                          {item.current_stock}
                        </TableCell>
                        <TableCell className="text-xs text-right py-1.5 font-mono font-semibold text-zinc-800">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRemoveDraftItem(idx)}
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsNewTransferOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTransfer} disabled={selectedItems.length === 0}>
              Create Transfer Ticket
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* View Transfer Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          {selectedTransfer && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-zinc-901 font-bold flex items-center gap-1.5">
                      Transfer Ticket Details
                    </DialogTitle>
                    <p className="font-mono text-xs text-zinc-400 mt-0.5">#{selectedTransfer.id}</p>
                  </div>
                  <Badge className={`border-0 text-xs ${
                    selectedTransfer.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                    selectedTransfer.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {selectedTransfer.status}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 border-y border-zinc-150 py-3 my-2 text-xs">
                <div>
                  <span className="text-zinc-400 font-bold uppercase tracking-wider block text-[10px]">Relocation Origin</span>
                  <div className="font-semibold text-zinc-800 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-zinc-405" /> {getBranchName(selectedTransfer.from_branch_id)}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-400 font-bold uppercase tracking-wider block text-[10px]">Relocation Destination</span>
                  <div className="font-semibold text-zinc-800 mt-0.5 flex items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3 text-emerald-505" /> {getBranchName(selectedTransfer.to_branch_id)}
                  </div>
                </div>
              </div>

              {selectedTransfer.notes && (
                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 text-xs my-2">
                  <span className="font-bold text-zinc-500 block mb-0.5">Internal notes & reason:</span>
                  <p className="text-zinc-700 italic">"{selectedTransfer.notes}"</p>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-xs font-black uppercase text-zinc-650 tracking-wider">Transfer Product Lines</span>
                <div className="border border-zinc-200 rounded-lg overflow-hidden max-h-[220px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase">
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3 text-right">Drafted Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedTransfer.items || []).map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-zinc-100 hover:bg-zinc-50/40 text-zinc-850">
                          <td className="py-2 px-3 font-semibold text-zinc-900">{item.name}</td>
                          <td className="py-2 px-3 font-mono text-zinc-500">{item.sku || 'N/A'}</td>
                          <td className="py-2 px-3 text-right font-bold text-indigo-700 font-mono">{item.quantity} units</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedTransfer.status === 'PENDING' && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 my-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-[11px] text-amber-800 font-medium">
                    This transfer is currently pending. Click the <strong>Dispatch</strong> button in the action list to reduce physical origin branch stock quantities and start carriage tracking.
                  </p>
                </div>
              )}

              {selectedTransfer.status === 'IN_TRANSIT' && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 my-2">
                  <Truck className="h-5 w-5 text-blue-600 shrink-0" />
                  <p className="text-[11px] text-blue-800 font-medium">
                    This transfer is currently in-transit. Click <strong>Receive</strong> in the action list to finalize carriage tracking, which increments physical destination warehouse quantities.
                  </p>
                </div>
              )}

              <DialogFooter className="mt-3">
                <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
                
                {selectedTransfer.status === 'PENDING' && (
                  <Button 
                    className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
                    onClick={() => {
                      setIsViewOpen(false);
                      handleUpdateStatus(selectedTransfer.id, selectedTransfer, 'IN_TRANSIT');
                    }}
                  >
                    Dispatch Transfer Now
                  </Button>
                )}

                {selectedTransfer.status === 'IN_TRANSIT' && (
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    onClick={() => {
                      setIsViewOpen(false);
                      handleUpdateStatus(selectedTransfer.id, selectedTransfer, 'RECEIVED');
                    }}
                  >
                    Receive & Finalize Cargo
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
