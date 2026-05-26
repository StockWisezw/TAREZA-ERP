import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Search, Receipt, RefreshCcw, Download, ChevronRight, Plus, Trash2, Edit, CreditCard, ShoppingCart, User, X } from 'lucide-react';
import { usePOSStore, SaleRecord } from '../store/posStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useReactToPrint } from 'react-to-print';
import { ReceiptPrint } from '../components/pos/ReceiptPrint';
import { toast } from 'sonner';
import { supabase, db, doc, getDoc, updateDoc } from '../lib/supabaseClient';
import { recordStockMovement, postJournalEntry, logAuditEvent } from '../services/ledgerService';

export default function ReceiptHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Create Invoice Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [currentQty, setCurrentQty] = useState('1');
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Invoice');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: salesData } = await supabase.from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
        
      setSalesHistory(salesData || []);

      const { data: custData } = await supabase.from('customers').select('*').order('name');
      setCustomers(custData || []);

      const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true).order('name');
      setProducts(prodData || []);

    } catch (err) {
      console.error('Failed to load transaction history details:', err);
      toast.error('Could not load history');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: receiptRef
  });

  const setSaleAndPrint = (sale: any) => {
    setSelectedSale(sale);
    setTimeout(() => {
      handlePrint();
    }, 150);
  };

  const exportCSV = () => {
    if (salesHistory.length === 0) {
      toast.error('No receipts to export');
      return;
    }
    
    const headers = ['Receipt #', 'Date', 'Total Amount', 'Items', 'Status', 'Payment Method'];
    const rows = salesHistory.map(s => [
      s.receiptNumber,
      s.created_at ? new Date(s.created_at).toLocaleString() : new Date(s.timestamp).toLocaleString(),
      s.total.toFixed(2),
      s.items ? s.items.map((i: any) => `${i.product.name} (x${i.quantity})`).join('; ') : '',
      s.status,
      s.payment_method || '-'
    ]);
    
    const csvContent = "\uFEFF" + headers.join(',') + "\n" 
      + rows.map(e => `"${e.join('","')}"`).join("\n");
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `receipts_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Past receipts logs exported');
  };

  const generateInvoiceNumber = () => {
    const randomID = Math.floor(1000 + Math.random() * 9000);
    setInvoiceNumber(`INV-${randomID}`);
  };

  const openInvoiceDialog = () => {
    generateInvoiceNumber();
    setSelectedCustomerId(customers[0]?.id || '');
    setSelectedProductId(products[0]?.id || '');
    setInvoiceItems([]);
    setPaymentMethod('Invoice');
    setCurrentQty('1');
    setIsCreateOpen(true);
  };

  const addItemToInvoice = () => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    const qty = parseInt(currentQty) || 1;
    const price = prod.retail_price || prod.price || 0;
    const subtotal = price * qty;

    const newItem = {
      id: crypto.randomUUID(),
      product: {
        id: prod.id,
        name: prod.name,
        price: price,
        sku: prod.sku || '',
      },
      quantity: qty,
      price: price,
      subtotal: subtotal
    };

    setInvoiceItems([...invoiceItems, newItem]);
    toast.success(`Added ${prod.name} (x${qty})`);
  };

  const removeItemFromInvoice = (itemId: string) => {
    setInvoiceItems(invoiceItems.filter(item => item.id !== itemId));
  };

  const saveCreatedInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invoiceItems.length === 0) {
      toast.error("Please add at least one physical product item.");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      let businessId = '';
      let branchId = '';

      if (userData?.user) {
        const { data: bUser } = await supabase.from('business_users').select('business_id, branch_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
        if (bUser) {
          businessId = bUser.business_id;
          branchId = bUser.branch_id || '';
        }
      }

      const matchedCust = customers.find(c => c.id === selectedCustomerId);
      const customerName = matchedCust ? matchedCust.name : 'Walk-In Customer';

      // Sum totals
      const subtotalSum = invoiceItems.reduce((acc, item) => acc + item.subtotal, 0);
      const vatTotalVal = subtotalSum * 0.15; // default 15% VAT
      const totalAmountVal = subtotalSum + vatTotalVal;

      const saleId = crypto.randomUUID();
      const payload = {
        id: saleId,
        business_id: businessId || null,
        branch_id: branchId || null,
        user_id: userData?.user?.id || null,
        customer_id: selectedCustomerId || null,
        payments: [{ method: paymentMethod, amount: totalAmountVal }],
        subtotal: subtotalSum,
        vat_total: vatTotalVal,
        discount_total: 0,
        total: totalAmountVal,
        payment_method: paymentMethod,
        status: paymentMethod === 'Invoice' ? 'UNPAID' : 'COMPLETED',
        receipt_number: invoiceNumber,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('sales').insert(payload);
      if (error) throw error;

      toast.success(`Successfully created Invoice transaction ${invoiceNumber}!`);
      setIsCreateOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error saving invoice: ${err.message || 'Unknown error'}`);
    }
  };

  const refundSaleItem = async (id: string, refNum: string) => {
    if (!confirm(`Are you sure you want to refund receipt/invoice ${refNum}? This will re-credit stock levels and post a reversal to the ledger.`)) {
      return;
    }

    try {
      // 1. Authenticated user & business/branch fetch
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || 'unknown';
      let businessId = '';
      let branchId = '';

      if (userData?.user) {
        const { data: bUser } = await supabase.from('business_users').select('business_id, branch_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
        if (bUser) {
          businessId = bUser.business_id;
          branchId = bUser.branch_id || '';
        }
      }

      if (!businessId) {
        const { data: fallbackB } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
        if (fallbackB?.id) {
          businessId = fallbackB.id;
          const { data: fallbackBr } = await supabase.from('branches').select('id').eq('business_id', fallbackB.id).limit(1).maybeSingle();
          if (fallbackBr?.id) {
            branchId = fallbackBr.id;
          }
        }
      }
      if (!businessId) businessId = 'default_business';
      if (!branchId) branchId = 'default_branch';

      // 2. Fetch sale record
      const { data: sale, error: saleFetchError } = await supabase.from('sales').select('*').eq('id', id).maybeSingle();
      if (saleFetchError || !sale) {
        throw new Error(saleFetchError?.message || 'Could not find the sale record.');
      }

      if (sale.status === 'REFUNDED') {
        toast.error('Transaction has already been refunded.');
        return;
      }

      // 3. Perform database update
      const { error: updateError } = await supabase.from('sales')
        .update({ status: 'REFUNDED' })
        .eq('id', id);

      if (updateError) throw updateError;

      // 4. Re-credit stock to inventory for each item (positive quantity change)
      if (sale.items && Array.isArray(sale.items)) {
        for (const item of sale.items) {
          const qtyToReturn = Math.abs(Number(item.quantity || 0));
          const prodId = item.product?.id || item.productId;
          if (prodId && qtyToReturn > 0) {
            await recordStockMovement(
              businessId,
              branchId,
              prodId,
              qtyToReturn, // POSITIVE value to re-credit stock
              'POS_RETURN',
              userId,
              refNum,
              item.product?.wholesalePrice || item.product?.cost_price || 0
            );
          }
        }
      }

      // 5. Post reverse double-entry accounting journal entries
      try {
        const saleTotal = Number(sale.total || sale.total_amount || 0);
        const creditPayment = (sale.payments || []).find((p: any) => p.method === 'credit' || p.method === 'invoice');
        const isCredit = !!creditPayment || sale.payment_method === 'Invoice' || sale.status === 'UNPAID';
        const targetAssetAccount = isCredit ? '1100' : '1000'; // AR vs Till

        const ledgerLines = [
          { accountCode: '4000', debit: saleTotal, credit: 0, description: `Refund / Reversal of Service Revenue [${refNum}]` },
          { accountCode: targetAssetAccount, debit: 0, credit: saleTotal, description: `Refund / Reversal of Receipt Asset [${refNum}]` }
        ];

        await postJournalEntry(
          businessId,
          branchId,
          userId,
          refNum,
          `POS Refund Reversal ${refNum}`,
          ledgerLines
        );
      } catch (err) {
        console.warn('Deferred audit post event ledger recording error:', err);
      }

      // 6. Adjust Customer balance if credit sale
      try {
        const isCredit = sale.payment_method === 'Invoice' || sale.status === 'UNPAID' || (sale.payments || []).some((p: any) => p.method === 'credit');
        const customerId = sale.customer_id || sale.customerId;
        if (isCredit && customerId) {
          const { data: custData } = await supabase.from('customers').select('*').eq('id', customerId).single();
          if (custData) {
            const saleTotal = Number(sale.total || sale.total_amount || 0);
            const newBalance = Number(custData.balance || 0) - saleTotal;
            await supabase.from('customers').update({ balance: newBalance }).eq('id', customerId);
          }
        }
      } catch (err) {
        console.warn('Customer account balance re-crediting error:', err);
      }

      // 7. Update Session expected balance stats
      try {
        const { data: openSession } = await supabase
          .from('register_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'OPEN')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openSession) {
          const sessRef = doc(db, 'register_sessions', openSession.id);
          const sessSnap = await getDoc(sessRef);
          if (sessSnap.exists()) {
            const sessData = sessSnap.data();
            const saleTotal = Number(sale.total || sale.total_amount || 0);
            await updateDoc(sessRef, {
              refunds_total: Number(sessData.refunds_total || 0) + saleTotal,
              expected_balance: Number(sessData.expected_balance || 0) - saleTotal,
            });
          }
        }
      } catch (err) {
        console.warn('Register session update bypass during refund:', err);
      }

      // 8. Log audit trail
      try {
        await logAuditEvent(
          businessId,
          userId,
          'VOID',
          'POS',
          sale,
          { receipt_number: refNum, status: 'REFUNDED' }
        );
      } catch (err) {
        console.warn('Audit logger recording error:', err);
      }

      toast.success(`Transaction ${refNum} has been completely REFUNDED. Inventory re-credited and general ledger adjusted.`);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error refunding: ${err.message}`);
    }
  };

  const deleteSaleItem = async (id: string, refNum: string) => {
    if (!confirm(`Are you sure you want to delete receipt/invoice ${refNum} entirely? Status reference logs will clear.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('sales')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success(`Transaction record ${refNum} deleted`);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error deleting: ${err.message}`);
    }
  };

  // Status badges for invoice / sales
  const getSaleStatusBadge = (status: string) => {
    const cleaned = status ? status.toUpperCase() : 'COMPLETED';
    if (cleaned === 'REFUNDED') {
      return <Badge className="bg-rose-100 text-rose-800 border-0 hover:bg-rose-100 font-semibold text-xs">Refunded</Badge>;
    }
    if (cleaned === 'UNPAID') {
      return <Badge className="bg-amber-100 text-amber-800 border-0 hover:bg-amber-100 font-semibold text-xs">Unpaid Invoice</Badge>;
    }
    return <Badge className="bg-emerald-100 text-emerald-800 border-0 hover:bg-emerald-100 font-semibold text-xs">Paid / Complete</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receipt History</h1>
          <p className="text-sm text-zinc-500 mt-1">Audit, edit, adjust status, and manage physical receipts and business invoices.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-white shadow-sm" onClick={() => window.print()}>
            Print All
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm" onClick={openInvoiceDialog}>
            <Plus className="mr-2 h-4 w-4" /> Create Invoice
          </Button>
        </div>
      </div>

      <Card className="border-zinc-200">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-zinc-50/80 border-b p-4 gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-zinc-900">Past Transactions</CardTitle>
            <CardDescription className="text-xs">Select any receipt item to issue audits, reprints, refunds, or deletion.</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Search by receipt #, customer Name" 
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-100 hover:bg-zinc-100">
                <TableHead>Date / Time</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Items Count</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right w-[150px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-zinc-500">
                    Loading transactions history...
                  </TableCell>
                </TableRow>
              ) : salesHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-zinc-500 text-sm">
                    No past transactions found. Choose "Create Invoice" inside header to generate one manually.
                  </TableCell>
                </TableRow>
              ) : (
                salesHistory
                  .filter(s => 
                    s.receiptNumber.includes(searchTerm) || 
                    (s.customerName && s.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map(sale => (
                  <TableRow key={sale.id} className="hover:bg-zinc-50/50 transition-colors cursor-pointer group">
                    <TableCell className="font-mono text-xs">
                      {sale.created_at ? new Date(sale.created_at).toLocaleString() : new Date(sale.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-primary font-medium">{sale.receiptNumber}</TableCell>
                    <TableCell className="font-semibold text-zinc-800">{sale.customerName || 'Walk-In Customer'}</TableCell>
                    <TableCell className="text-xs text-zinc-600">{sale.payment_method || 'Cash'}</TableCell>
                    <TableCell className="text-xs">{sale.items ? sale.items.length : 0} item(s)</TableCell>
                    <TableCell>
                      {getSaleStatusBadge(sale.status)}
                    </TableCell>
                    <TableCell className="text-right font-bold font-mono text-zinc-900">
                      ${(sale.total_amount || sale.total || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8">
                              <ChevronRight className="h-4 w-4 mr-1" /> Open
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-white">
                            <DialogHeader>
                              <DialogTitle>Receipt Validation / Print View</DialogTitle>
                            </DialogHeader>
                            <div className="py-6 px-8 border rounded-lg bg-zinc-50 font-mono text-sm text-center">
                              <h3 className="font-bold text-lg text-zinc-900">TAREZA CLOUD ERP</h3>
                              <p className="text-xs text-zinc-500">Receipt/Invoice: {sale.receiptNumber}</p>
                              <p className="text-xs text-zinc-500">Date: {sale.created_at ? new Date(sale.created_at).toLocaleString() : new Date(sale.timestamp).toLocaleString()}</p>
                              <p className="text-xs text-zinc-600 font-semibold mt-1">Customer: {sale.customerName || 'Walk-In'}</p>
                              <div className="my-3 border-t border-dashed border-zinc-300"></div>
                              
                              {sale.items && sale.items.map((item: any) => (
                                <div key={item.id} className="flex justify-between py-1 text-xs">
                                  <span>{item.quantity}x {item.product?.name}</span>
                                  <span>${((item.price || item.product?.price || 0) * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                              
                              <div className="my-3 border-t border-dashed border-zinc-300"></div>
                              <div className="flex justify-between font-bold text-sm text-zinc-950">
                                <span>TOTAL AMOUNT</span>
                                <span>${(sale.total_amount || sale.total || 0).toFixed(2)}</span>
                              </div>
                              <div className="mt-6 pt-4 flex gap-2 border-t">
                                <Button className="w-full h-10 text-white bg-blue-600 hover:bg-blue-700" onClick={() => setSaleAndPrint(sale)}>
                                  <Receipt className="mr-2 h-4 w-4" /> Reprint receipt
                                </Button>
                                <Button 
                                  variant="outline" 
                                  className="w-full h-10 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                                  onClick={() => refundSaleItem(sale.id, sale.receiptNumber)}
                                >
                                  <RefreshCcw className="mr-2 h-4 w-4" /> Refund / Adjust
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => deleteSaleItem(sale.id, sale.receiptNumber)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Invoice creation dialog container */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-xl bg-white text-zinc-950">
          <DialogHeader>
            <DialogTitle>Create Customer Invoice Manual Entry</DialogTitle>
          </DialogHeader>

          <form onSubmit={saveCreatedInvoice} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Invoice Number</label>
                <div className="flex gap-2">
                  <Input 
                    value={invoiceNumber} 
                    onChange={e => setInvoiceNumber(e.target.value)} 
                    required 
                  />
                  <Button type="button" variant="outline" size="sm" onClick={generateInvoiceNumber}>Gen</Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Select Customer Account</label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="bg-white border-zinc-200">
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.customer_type ? `(${c.customer_type})` : ''}
                      </SelectItem>
                    ))}
                    {customers.length === 0 && (
                      <SelectItem value="none" disabled>No customers registered</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 border p-3 rounded-lg bg-zinc-50">
              <p className="text-xs font-bold text-zinc-700">Add Line Items</p>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold">Select Product</span>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="bg-white border-zinc-200">
                      <SelectValue placeholder="Product catalog item" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} (${(p.retail_price || 0).toFixed(2)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-20 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold">Qty</span>
                  <Input 
                    type="number" 
                    value={currentQty} 
                    onChange={e => setCurrentQty(e.target.value)}
                    placeholder="1"
                  />
                </div>

                <Button type="button" size="sm" onClick={addItemToInvoice} className="bg-zinc-900 text-white hover:bg-zinc-800">
                  Add Item
                </Button>
              </div>

              <div className="divide-y max-h-32 overflow-y-auto mt-2">
                {invoiceItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-1.5 text-xs text-zinc-800">
                    <div>
                      <p className="font-semibold">{item.product.name}</p>
                      <p className="text-[10px] text-zinc-500">{item.quantity} x ${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">${item.subtotal.toFixed(2)}</span>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-red-500"
                        onClick={() => removeItemFromInvoice(item.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {invoiceItems.length === 0 && (
                  <p className="text-xs text-zinc-400 py-1 text-center">No catalog lines added yet.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Payment Setup Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-white border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Invoice">Unpaid Customer Invoice (Net 30)</SelectItem>
                    <SelectItem value="Cash">Cash Receipt (Fully Paid)</SelectItem>
                    <SelectItem value="Card">Bank Card Swipe (Fully Paid)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 bg-zinc-100 p-2.5 rounded-lg flex flex-col justify-center">
                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wide">Summary Totals</p>
                <p className="text-xl font-mono font-bold text-zinc-900 mt-0.5">
                  ${(invoiceItems.reduce((acc, item) => acc + item.subtotal, 0) * 1.15).toFixed(2)}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Includes standard 15% VAT threshold</p>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Close</Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">Record Sales Invoice</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hidden print renderer */}
      <ReceiptPrint ref={receiptRef} sale={selectedSale} />
    </div>
  );
}
