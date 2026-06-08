import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, FileText, PackageCheck, AlertCircle, RefreshCw, Printer, Download, Edit, Trash2, Eye, MoreHorizontal, Settings } from 'lucide-react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table as ShadcnTable,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '../../lib/firebaseClient';
import { toast } from 'sonner';

export function Procurement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [pos, setPos] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals / Form States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any | null>(null);

  // Form inputs for new / edit PO
  const [poNumber, setPoNumber] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [poStatus, setPoStatus] = useState('PENDING_APPROVAL');
  const [totalAmount, setTotalAmount] = useState('0.00');
  const [orderDate, setOrderDate] = useState('');

  // Ordered product line items
  const [poItems, setPoItems] = useState<any[]>([]);
  const [tempProductId, setTempProductId] = useState('');
  const [tempQty, setTempQty] = useState('1');
  const [tempPrice, setTempPrice] = useState('0.00');

  // Interactive row expansion
  const [expandedPOId, setExpandedPOId] = useState<string | null>(null);

  const handleAddItem = () => {
    if (!tempProductId) {
      toast.error("Please select a product");
      return;
    }
    const matchedProd = products.find(p => p.id === tempProductId);
    if (!matchedProd) return;

    const qty = parseFloat(tempQty);
    const prc = parseFloat(tempPrice);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    const newItem = {
      product_id: tempProductId,
      product_name: matchedProd.name,
      quantity: qty,
      price: prc
    };

    const nextItems = [...poItems, newItem];
    setPoItems(nextItems);
    
    // Auto-update total amount
    const nextTotal = nextItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    setTotalAmount(nextTotal.toFixed(2));

    // Reset fields but keep selected product for convenience
    setTempQty('1');
    setTempPrice('0.00');
  };

  const handleRemoveItem = (index: number) => {
    const nextItems = poItems.filter((_, idx) => idx !== index);
    setPoItems(nextItems);
    const nextTotal = nextItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    setTotalAmount(nextTotal.toFixed(2));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Suppliers, Products, and POs in parallel
      const [supsRes, POsRes, productsRes] = await Promise.all([
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('is_active', true).order('name')
      ]);

      const supsList = supsRes.data || [];
      const POsList = POsRes.data || [];
      const prodList = productsRes?.data || [];

      setSuppliers(supsList);
      setProducts(prodList);

      // Map POs to show supplier details correctly
      const mapped = POsList.map((po: any) => {
        const foundSupplier = supsList.find((s: any) => s.id === po.supplier_id);
        return {
          ...po,
          po_number: po.po_number || `PO-${po.id.slice(0, 4).toUpperCase()}`,
          order_date: po.order_date || po.created_at || new Date().toISOString().split('T')[0],
          expected_delivery_date: po.expected_delivery_date || '',
          suppliers_advanced: {
            name: foundSupplier ? foundSupplier.name : 'Unknown Supplier'
          }
        };
      });

      setPos(mapped);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const generatePONumber = () => {
    const nextNum = Math.floor(1000 + Math.random() * 9000);
    setPoNumber(`PO-EXP-${nextNum}`);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }
    if (!poNumber) {
      toast.error("Please enter/generate a PO number");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      let businessId = '';

      if (userData?.user) {
        const { data: businessData } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        if (businessData) {
          businessId = businessData.business_id;
        }
      }

      const newId = crypto.randomUUID();
      const payload = {
        id: newId,
        po_number: poNumber,
        business_id: businessId || null,
        supplier_id: selectedSupplierId,
        status: poStatus,
        total_amount: parseFloat(totalAmount) || 0,
        order_date: orderDate || new Date().toISOString().split('T')[0],
        expected_delivery_date: expectedDelivery || null,
        items: poItems,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('purchase_orders').insert(payload);

      if (error) throw error;

      toast.success(`Purchase Order ${poNumber} created successfully!`);
      setIsCreateOpen(false);
      
      // Reset form
      setPoNumber('');
      setSelectedSupplierId('');
      setExpectedDelivery('');
      setPoStatus('PENDING_APPROVAL');
      setTotalAmount('0.00');
      setOrderDate('');
      setPoItems([]);

      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error creating PO: ${err.message || 'Unknown error'}`);
    }
  };

  const handleEditPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    try {
      const payload = {
        po_number: poNumber,
        supplier_id: selectedSupplierId,
        status: poStatus,
        total_amount: parseFloat(totalAmount) || 0,
        expected_delivery_date: expectedDelivery || null,
        order_date: orderDate || new Date().toISOString().split('T')[0],
        items: poItems
      };

      const { error } = await supabase
        .from('purchase_orders')
        .update(payload)
        .eq('id', selectedPO.id);

      if (error) throw error;

      toast.success(`Purchase Order ${poNumber} updated successfully!`);
      setIsEditOpen(false);
      setSelectedPO(null);
      setPoItems([]);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error updating PO: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDeletePO = async (id: string, number: string) => {
    if (!confirm(`Are you sure you want to delete purchase order ${number}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`Purchase order ${number} deleted`);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error deleting PO: ${err.message || 'Unknown error'}`);
    }
  };

  const openCreateDialog = () => {
    generatePONumber();
    setSelectedSupplierId(suppliers[0]?.id || '');
    setExpectedDelivery(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setPoStatus('PENDING_APPROVAL');
    setTotalAmount('0.00');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setPoItems([]);
    setTempProductId(products[0]?.id || '');
    setTempQty('1');
    setTempPrice('0.00');
    setIsCreateOpen(true);
  };

  const openEditDialog = (po: any) => {
    setSelectedPO(po);
    setPoNumber(po.po_number);
    setSelectedSupplierId(po.supplier_id || '');
    setExpectedDelivery(po.expected_delivery_date || '');
    setPoStatus(po.status || 'PENDING_APPROVAL');
    setTotalAmount(po.total_amount?.toString() || '0.00');
    setOrderDate(po.order_date || '');
    setPoItems(po.items || []);
    setTempProductId(products[0]?.id || '');
    setTempQty('1');
    setTempPrice('0.00');
    setIsEditOpen(true);
  };

  const adjustStatusDirect = async (po: any, nextStatus: string) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: nextStatus })
        .eq('id', po.id);

      if (error) throw error;
      toast.success(`Updated status of ${po.po_number} to ${nextStatus}`);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error updating status: ${err.message || 'Unknown error'}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'DRAFT': return <Badge variant="outline" className="text-zinc-500">Draft</Badge>;
      case 'PENDING_APPROVAL': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0">Pending Approval</Badge>;
      case 'APPROVED': 
      case 'SENT': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-0">Approved / Sent</Badge>;
      case 'PARTIAL_RECEIVED': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-0">Partial Receipt</Badge>;
      case 'RECEIVED': return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0">Fully Received</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const exportCSV = () => {
    if (!pos || pos.length === 0) {
      toast.error('No purchase orders to export');
      return;
    }
    const headers = ['PO Number', 'Supplier', 'Order Date', 'Expected Delivery', 'Status', 'Total'];
    const csvContent = "\uFEFF" + headers.join(',') + '\n'
      + pos.map(p => `"${p.po_number || ''}","${p.suppliers_advanced?.name || ''}","${p.order_date || ''}","${p.expected_delivery_date || ''}","${p.status || ''}",${p.total_amount || 0}`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `purchase_orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Purchase orders exported successfully');
  };

  const filteredPOs = pos.filter(po => 
    po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    po.suppliers_advanced?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search POs by number, supplier..." 
            className="pl-9 bg-white shadow-sm border-zinc-200 h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" className="bg-white shadow-sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <Button variant="outline" className="bg-white shadow-sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button variant="outline" onClick={fetchData} className="bg-white shadow-sm"><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm" onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" /> Create PO</Button>
        </div>
      </div>

      <Card className="border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <ShadcnTable>
            <TableHeader className="bg-zinc-50/80 border-b border-zinc-200">
              <TableRow>
                <TableHead className="w-[150px]">PO Number</TableHead>
                <TableHead className="w-[200px]">Supplier</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                   <TableCell colSpan={7} className="text-center py-6 text-zinc-500">
                      Loading purchase orders...
                   </TableCell>
                </TableRow>
              ) : filteredPOs.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={7} className="text-center py-6 text-zinc-500">
                      No purchase orders found. Click "Create PO" to add one.
                   </TableCell>
                </TableRow>
              ) : filteredPOs.map((po) => (
                <React.Fragment key={po.id}>
                  <TableRow 
                    className="hover:bg-zinc-50/50 cursor-pointer"
                    onClick={() => setExpandedPOId(expandedPOId === po.id ? null : po.id)}
                  >
                    <TableCell className="font-mono text-sm font-medium text-blue-600">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 text-[10px]">{expandedPOId === po.id ? '▼' : '▶'}</span>
                        {po.po_number}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-zinc-900">{po.suppliers_advanced?.name || 'Unknown Supplier'}</TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {po.order_date ? new Date(po.order_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-zinc-900">
                      ${(po.total_amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(po.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(po)}>
                          <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          } />
                          <DropdownMenuContent align="end" className="bg-white">
                            <DropdownMenuLabel>Status Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => adjustStatusDirect(po, 'APPROVED')}>
                              Approve PO
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => adjustStatusDirect(po, 'RECEIVED')}>
                              Mark Received
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => adjustStatusDirect(po, 'DRAFT')}>
                              Convert to Draft
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive font-semibold" onClick={() => handleDeletePO(po.id, po.po_number)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete PO
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedPOId === po.id && (
                    <TableRow className="bg-zinc-50/30 hover:bg-zinc-50/30">
                      <TableCell colSpan={7} className="p-4 border-t border-b">
                        <div className="space-y-3 pl-4">
                          <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Ordered Products ({po.items?.length || 0})</h4>
                          {(!po.items || po.items.length === 0) ? (
                            <p className="text-xs text-zinc-400 italic">No specific products were listed for this purchase order. Click Edit to add items.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {po.items.map((it: any, idx: number) => {
                                const matchedProd = products.find((pr: any) => pr.id === it.product_id);
                                return (
                                  <div key={idx} className="bg-white p-3 rounded-xl border border-zinc-200 flex justify-between items-center text-sm shadow-sm">
                                    <div>
                                      <p className="font-semibold text-zinc-900">{matchedProd ? matchedProd.name : (it.product_name || 'Generic Item')}</p>
                                      <p className="text-xs text-zinc-500 font-mono">SKU: {matchedProd ? matchedProd.sku : 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold text-zinc-800">{it.quantity} x ${Number(it.price || 0).toFixed(2)}</p>
                                      <p className="text-xs font-mono text-zinc-500">${(Number(it.quantity || 0) * Number(it.price || 0)).toFixed(2)}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </ShadcnTable>
        </div>
      </Card>

      {/* CREATE PO DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreatePO} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">PO Number</label>
                <div className="flex gap-2">
                  <Input 
                    value={poNumber} 
                    onChange={e => setPoNumber(e.target.value)} 
                    placeholder="PO-EXP-3912"
                    required
                  />
                  <Button type="button" variant="outline" size="sm" onClick={generatePONumber}>Auto</Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Supplier</label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="bg-white border-zinc-200">
                    <SelectValue placeholder="Select Supplier" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                    {suppliers.length === 0 && (
                      <SelectItem value="none" disabled>No Suppliers Available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Order Date</label>
                <Input 
                  type="date" 
                  value={orderDate} 
                  onChange={e => setOrderDate(e.target.value)} 
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Expected Delivery</label>
                <Input 
                  type="date" 
                  value={expectedDelivery} 
                  onChange={e => setExpectedDelivery(e.target.value)} 
                />
              </div>
            </div>

            <div className="border border-zinc-200 rounded-lg p-3 space-y-3 bg-zinc-50/50">
              <span className="text-xs font-bold text-zinc-750 block">Add Products to Order</span>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold block">Select Product</span>
                  <Select value={tempProductId} onValueChange={(val) => {
                    setTempProductId(val);
                    const prod = products.find(p => p.id === val);
                    if (prod) {
                      setTempPrice((prod.cost_price || prod.retail_price || 0).toString());
                    }
                  }}>
                    <SelectTrigger className="bg-white h-9 text-xs">
                      <SelectValue placeholder="Pick Product" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} (${Number(p.cost_price || p.retail_price || 0).toFixed(2)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-16 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold block">Qty</span>
                  <Input type="number" min="1" value={tempQty} onChange={e => setTempQty(e.target.value)} className="h-9 bg-white text-xs" />
                </div>
                <div className="w-20 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold block">Price ($)</span>
                  <Input type="number" step="0.01" value={tempPrice} onChange={e => setTempPrice(e.target.value)} className="h-9 bg-white text-xs" />
                </div>
                <Button type="button" onClick={handleAddItem} size="sm" className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white h-9 p-2 text-xs">Add</Button>
              </div>

              {poItems.length > 0 && (
                <div className="border border-zinc-200 rounded-md bg-white overflow-hidden max-h-[160px] overflow-y-auto shadow-sm">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-zinc-50 text-[10px] text-zinc-500 font-semibold border-b">
                      <tr>
                        <th className="p-2">Product</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Price</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {poItems.map((item, index) => (
                        <tr key={index}>
                          <td className="p-2 font-medium truncate max-w-[120px]">{item.product_name}</td>
                          <td className="p-2 text-center">{item.quantity}</td>
                          <td className="p-2 text-right">${Number(item.price || 0).toFixed(2)}</td>
                          <td className="p-2 text-right">${(item.quantity * item.price).toFixed(2)}</td>
                          <td className="p-2 text-center">
                            <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Calculated Total Price ($)</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={totalAmount} 
                  onChange={e => setTotalAmount(e.target.value)} 
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Status</label>
                <Select value={poStatus} onValueChange={setPoStatus}>
                  <SelectTrigger className="bg-white border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                    <SelectItem value="APPROVED">Approved / Sent</SelectItem>
                    <SelectItem value="RECEIVED">Fully Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">Save Purchase Order</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT PO DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Update Purchase Order / Adjust Status</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditPO} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">PO Number</label>
                <Input 
                  value={poNumber} 
                  onChange={e => setPoNumber(e.target.value)} 
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Supplier</label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="bg-white border-zinc-200">
                    <SelectValue placeholder="Select Supplier" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Order Date</label>
                <Input 
                  type="date" 
                  value={orderDate} 
                  onChange={e => setOrderDate(e.target.value)} 
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Expected Delivery</label>
                <Input 
                  type="date" 
                  value={expectedDelivery} 
                  onChange={e => setExpectedDelivery(e.target.value)} 
                />
              </div>
            </div>

            <div className="border border-zinc-200 rounded-lg p-3 space-y-3 bg-zinc-50/50">
              <span className="text-xs font-bold text-zinc-750 block">Add Products to Order</span>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold block">Select Product</span>
                  <Select value={tempProductId} onValueChange={(val) => {
                    setTempProductId(val);
                    const prod = products.find(p => p.id === val);
                    if (prod) {
                      setTempPrice((prod.cost_price || prod.retail_price || 0).toString());
                    }
                  }}>
                    <SelectTrigger className="bg-white h-9 text-xs">
                      <SelectValue placeholder="Pick Product" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} (${Number(p.cost_price || p.retail_price || 0).toFixed(2)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-16 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold block">Qty</span>
                  <Input type="number" min="1" value={tempQty} onChange={e => setTempQty(e.target.value)} className="h-9 bg-white text-xs" />
                </div>
                <div className="w-20 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold block">Price ($)</span>
                  <Input type="number" step="0.01" value={tempPrice} onChange={e => setTempPrice(e.target.value)} className="h-9 bg-white text-xs" />
                </div>
                <Button type="button" onClick={handleAddItem} size="sm" className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white h-9 p-2 text-xs">Add</Button>
              </div>

              {poItems.length > 0 && (
                <div className="border border-zinc-200 rounded-md bg-white overflow-hidden max-h-[160px] overflow-y-auto shadow-sm">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-zinc-50 text-[10px] text-zinc-500 font-semibold border-b">
                      <tr>
                        <th className="p-2">Product</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Price</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {poItems.map((item, index) => (
                        <tr key={index}>
                          <td className="p-2 font-medium truncate max-w-[120px]">{item.product_name}</td>
                          <td className="p-2 text-center">{item.quantity}</td>
                          <td className="p-2 text-right">${Number(item.price || 0).toFixed(2)}</td>
                          <td className="p-2 text-right">${(item.quantity * item.price).toFixed(2)}</td>
                          <td className="p-2 text-center">
                            <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-650">Total Price ($)</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={totalAmount} 
                  onChange={e => setTotalAmount(e.target.value)} 
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-650">Status</label>
                <Select value={poStatus} onValueChange={setPoStatus}>
                  <SelectTrigger className="bg-white border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                    <SelectItem value="APPROVED">Approved / Sent</SelectItem>
                    <SelectItem value="RECEIVED">Fully Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
