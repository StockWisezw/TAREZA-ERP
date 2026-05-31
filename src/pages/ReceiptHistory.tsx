import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Search, Receipt, RefreshCcw, Download, ChevronRight, ChevronDown, Plus, Trash2, Edit, CreditCard, ShoppingCart, User, X } from 'lucide-react';
import { usePOSStore, SaleRecord } from '../store/posStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useReactToPrint } from 'react-to-print';
import { ReceiptPrint } from '../components/pos/ReceiptPrint';
import { toast } from 'sonner';
import { supabase, db, doc, getDoc, updateDoc } from '../lib/supabaseClient';
import { recordStockMovement, postJournalEntry, logAuditEvent } from '../services/ledgerService';
import { jsPDF } from 'jspdf';

const getPackSize = (sku: string | undefined): number => {
  if (!sku) return 1;
  const match = sku.match(/\|PK:(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
};

export default function ReceiptHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [businessName, setBusinessName] = useState('Tareza Retail');
  const [branchName, setBranchName] = useState('Harare Branch');
  const [taxNumber, setTaxNumber] = useState('BP123456789');
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
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
      const { data: bDataList } = await supabase.from('branches').select('*');
      setBranches(bDataList || []);

      const { data: salesData } = await supabase.from('sales')
        .select('*, sale_items(*, products(*))')
        .order('created_at', { ascending: false })
        .limit(50);
        
      const normalizedSales = (salesData || []).map(sale => {
        let itemsList = sale.items;
        if (!itemsList || !Array.isArray(itemsList) || itemsList.length === 0) {
          itemsList = (sale.sale_items || []).map((si: any) => ({
            id: si.id,
            product: {
              id: si.product_id,
              name: si.products?.name || 'Unnamed Item',
              retailPrice: si.unit_price,
              wholesalePrice: si.unit_price,
              sku: si.products?.sku || ''
            },
            quantity: si.quantity,
            price: si.unit_price,
            unitPrice: si.unit_price,
            subtotal: si.line_total,
            vatAmount: si.vat_amount
          }));
        } else {
          // Double-check if product name is resolved correctly inside item.product
          itemsList = itemsList.map((item: any) => ({
            ...item,
            product: {
              ...item.product,
              name: item.product?.name || item.name || 'Unnamed Item'
            }
          }));
        }
        return {
          ...sale,
          items: itemsList
        };
      });
        
      setSalesHistory(normalizedSales);

      const { data: custData } = await supabase.from('customers').select('*').order('name');
      setCustomers(custData || []);

      const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true).order('name');
      setProducts(prodData || []);

      // Attempt to load current Business and Branch info for professional receipts
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data: bUser } = await supabase.from('business_users')
          .select('business_id, branch_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        if (bUser?.business_id) {
          const { data: bData } = await supabase.from('businesses')
            .select('name, tax_number')
            .eq('id', bUser.business_id)
            .maybeSingle();
          if (bData) {
            if (bData.name) setBusinessName(bData.name);
            if (bData.tax_number) setTaxNumber(bData.tax_number);
          }

          if (bUser.branch_id) {
            const { data: branchData } = await supabase.from('branches')
              .select('name')
              .eq('id', bUser.branch_id)
              .maybeSingle();
            if (branchData?.name) {
              setBranchName(branchData.name);
            }
          }
        }
      }

    } catch (err) {
      console.error('Failed to load transaction history details + business profile:', err);
      toast.error('Could not load history details completely');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: receiptRef
  });

  const setSaleAndPrint = (sale: any) => {
    setSelectedSale(sale);
    requestAnimationFrame(() => handlePrint());
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

  const downloadSelectedPDF = () => {
    if (!selectedSale) {
      toast.error('Please click on a specific transaction row in the table below to select it first.');
      return;
    }

    const sale = selectedSale;
    const items = sale.items || [];
    const payments = sale.payments || [];

    // Calculate dimensions
    const itemsSize = items.length;
    const paymentsSize = payments.length;
    const calculatedHeight = 110 + (itemsSize * 9) + (paymentsSize * 6);
    const pageHeight = Math.max(160, calculatedHeight);

    // Create jsPDF instance
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, pageHeight]
    });

    let y = 10;

    // Helper draw functions
    const drawCenterText = (text: string, fontSize: number, style: 'normal' | 'bold' | 'italic' = 'normal') => {
      doc.setFont('courier', style);
      doc.setFontSize(fontSize);
      doc.text(text, 40, y, { align: 'center' });
      y += (fontSize * 0.45) + 1.5;
    };

    const drawLeftRight = (left: string, right: string, fontSize: number = 8, style: 'normal' | 'bold' = 'normal') => {
      doc.setFont('courier', style);
      doc.setFontSize(fontSize);
      doc.text(left, 6, y, { align: 'left' });
      doc.text(right, 74, y, { align: 'right' });
      y += (fontSize * 0.45) + 1.5;
    };

    const drawDashedLine = () => {
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.text('------------------------------------------', 40, y, { align: 'center' });
      y += 4;
    };

    // Header Details (ReceiptPrint style)
    drawCenterText(businessName.toUpperCase(), 12, 'bold');
    drawCenterText(branchName, 8, 'normal');
    drawCenterText(`VAT No: ${taxNumber}`, 8, 'normal');
    y += 1.5;
    drawCenterText(`Receipt: ${sale.receiptNumber}`, 8, 'bold');
    
    // Correctly resolve date
    const saleDateStr = sale.created_at ? new Date(sale.created_at).toLocaleString() : (sale.timestamp ? new Date(sale.timestamp).toLocaleString() : new Date().toLocaleString());
    drawCenterText(saleDateStr, 8, 'normal');

    if (sale.customerId || sale.customer_id) {
      drawCenterText(`Customer: ${sale.customerName || 'Walk-In'}`, 8, 'normal');
    }
    y += 1.5;

    // Items Section
    drawDashedLine();
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text('Item', 6, y, { align: 'left' });
    doc.text('Qty', 55, y, { align: 'right' });
    doc.text('Total', 74, y, { align: 'right' });
    y += 4.5;
    drawDashedLine();

    // Render each cart item row
    items.forEach((item: any) => {
      const pName = item.product?.name || item.name || 'Unnamed Item';
      const cleanName = pName.length > 22 ? pName.substring(0, 20) + '..' : pName;
      const qty = String(item.quantity);
      
      const itemSub = item.subtotal || ((item.price || item.product?.price || 0) * item.quantity);
      const itemVat = item.vatAmount || 0;
      const itemTotalFormatted = `$${(itemSub + itemVat).toFixed(2)}`;

      drawLeftRight(cleanName, itemTotalFormatted, 8, 'normal');
      // Render Qty position custom
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.text(qty, 55, y - 8 * 0.45 - 1.5, { align: 'right' });

      if (item.discount) {
        const discStr = item.discount.type === 'percentage' ? `${item.discount.value}%` : `$${item.discount.value}`;
        drawCenterText(`  (-${discStr} discount included)`, 7.5, 'italic');
      }
    });

    drawDashedLine();

    // Financial totals
    const totalAmountFloat = Number(sale.total_amount || sale.total || 0).toFixed(2);
    const subtotalFloat = Number(sale.subtotal || (sale.total / 1.15) || 0).toFixed(2);
    const discountFloat = Number(sale.discountTotal || sale.discount_total || 0).toFixed(2);
    const vatTotalFloat = Number(sale.vatTotal || sale.vat_total || 0).toFixed(2);

    drawLeftRight('Subtotal:', `$${subtotalFloat}`);
    if (Number(discountFloat) > 0) {
      drawLeftRight('Discount:', `-$${discountFloat}`);
    }
    drawLeftRight('VAT (15%):', `$${vatTotalFloat}`);

    // Draw total underline
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.25);
    doc.line(6, y - 0.5, 74, y - 0.5);
    y += 2;

    drawLeftRight('TOTAL (USD):', `$${totalAmountFloat}`, 9.5, 'bold');
    
    drawDashedLine();

    // Payments detail list
    drawCenterText('PAYMENTS', 8, 'bold');
    let paymentsTotalSum = 0;

    if (payments.length > 0) {
      payments.forEach((p: any) => {
        const pMethodStr = (p.method || 'CASH').replace('_', ' ').toUpperCase();
        const pAmt = Number(p.amount || 0);
        paymentsTotalSum += pAmt;
        drawLeftRight(pMethodStr, `$${pAmt.toFixed(2)}`, 8, 'normal');
      });
    } else {
      const pMethodStr = (sale.payment_method || 'CASH').toUpperCase();
      const pAmt = Number(sale.total_amount || sale.total || 0);
      paymentsTotalSum = pAmt;
      drawLeftRight(pMethodStr, `$${pAmt.toFixed(2)}`, 8, 'normal');
    }

    if (paymentsTotalSum > Number(totalAmountFloat)) {
      const changeFloat = (paymentsTotalSum - Number(totalAmountFloat)).toFixed(2);
      drawLeftRight('CHANGE', `$${changeFloat}`, 8.5, 'bold');
    }

    drawDashedLine();

    // Compliance / Tax footer
    drawCenterText('SALES TAX INVOICE', 7.5, 'bold');
    drawCenterText(`Receipt #${sale.receiptNumber}`, 7.5, 'normal');

    y += 1.5;
    const resolvedStatus = sale.status === 'offline_pending' ? 'Offline Queue - Sync Pending' : 'Synced Online';
    drawCenterText(resolvedStatus.toUpperCase(), 7.5, 'bold');
    
    y += 4;
    drawCenterText('*** Thank you for your business! ***', 7.5, 'normal');
    drawCenterText('Generated by Tareza POS & ERP', 7, 'normal');

    // Trigger PDF browser save
    doc.save(`receipt_${sale.receiptNumber}.pdf`);
    toast.success(`Exported Receipt ${sale.receiptNumber} as high-fidelity PDF!`);
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
      const payload: any = {
        id: saleId,
        business_id: businessId || null,
        branch_id: branchId || null,
        user_id: userData?.user?.id || null,
        customer_id: selectedCustomerId || null,
        customerName: customerName,
        receiptNumber: invoiceNumber,
        payments: [{ method: paymentMethod, amount: totalAmountVal }],
        subtotal: subtotalSum,
        vat_total: vatTotalVal,
        vatTotal: vatTotalVal,
        discount_total: 0,
        discountTotal: 0,
        total: totalAmountVal,
        payment_method: paymentMethod,
        status: paymentMethod === 'Invoice' ? 'UNPAID' : 'COMPLETED',
        receipt_number: invoiceNumber,
        items: invoiceItems,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('sales').insert([payload]);
      if (error) throw error;

      // 1. Log sale items and update real-time stock levels
      if (invoiceItems.length > 0) {
        const itemsPayload = invoiceItems.map(item => ({
          sale_id: saleId,
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.price,
          unit_price: item.price,
          line_total: item.subtotal,
          vat_amount: item.subtotal * 0.15
        }));
        await supabase.from('sale_items').insert(itemsPayload);

        for (const item of invoiceItems) {
          try {
            const isWholesale = item.tier === 'wholesale' || item.pricing_tier === 'wholesale';
            const multiplier = isWholesale ? getPackSize(item.product?.sku) : 1;
            await recordStockMovement(
              businessId || 'default_business',
              branchId || 'default_branch',
              item.product.id,
              -Math.abs(item.quantity * multiplier), // negative for stock depletion
              'POS_SALE',
              userData?.user?.id || 'unknown',
              invoiceNumber,
              item.price
            );
          } catch (stkErr) {
            console.warn('Unable to record stock movement:', stkErr);
          }
        }
      }

      // 2. Double-Entry Accounting postings
      try {
        const ledgerLines = [
          { accountCode: '1100', debit: totalAmountVal, credit: 0, description: `Invoice layout ${invoiceNumber}` },
          { accountCode: '4000', debit: 0, credit: totalAmountVal, description: `Invoice sales revenue [${invoiceNumber}]` }
        ];
        await postJournalEntry(
          businessId || 'default_business',
          branchId || 'default_branch',
          userData?.user?.id || 'unknown',
          invoiceNumber,
          `Customer Invoice Manual Entry ${invoiceNumber}`,
          ledgerLines
        );
      } catch (postErr) {
        console.warn('Double-entry journal posting skipped:', postErr);
      }

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
          const isWholesale = item.tier === 'wholesale' || item.pricing_tier === 'wholesale';
          const multiplier = isWholesale ? getPackSize(item.product?.sku) : 1;
          const qtyToReturn = Math.abs(Number(item.quantity || 0)) * multiplier;
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

  // Only show previous sales receipts (exclude unpaid/invoice transactions)
  const filteredSales = salesHistory.filter(s => {
    const isInvoice = (s.payment_method || '').toLowerCase() === 'invoice' || s.status === 'UNPAID';
    if (isInvoice) return false;
    
    if (searchTerm) {
      const matchReceipt = s.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCustomer = s.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
      return !!(matchReceipt || matchCustomer);
    }
    return true;
  });

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
          <DropdownMenu>
            <DropdownMenuTrigger 
              render={
                <Button variant="outline" className="bg-white shadow-sm flex items-center">
                  <Download className="mr-2 h-4 w-4 text-zinc-500" /> Export <ChevronDown className="ml-1.5 h-3.5 w-3.5 text-zinc-400" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="bg-white p-1 shadow-md border rounded-md min-w-[220px]">
              <DropdownMenuItem onClick={exportCSV} className="text-zinc-700 hover:bg-zinc-100 cursor-pointer text-xs py-2 px-3 justify-start flex items-center">
                <Download className="mr-2 h-3.5 w-3.5 text-zinc-400" /> Export All as CSV
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={downloadSelectedPDF} 
                className={`text-zinc-700 hover:bg-zinc-100 cursor-pointer text-xs py-2 px-3 justify-start flex items-center ${!selectedSale ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!selectedSale}
              >
                {selectedSale ? (
                  <>
                     <Receipt className="mr-2 h-3.5 w-3.5 text-blue-500 animate-pulse" /> Download {selectedSale.receiptNumber} PDF
                  </>
                ) : (
                  <>
                    <Receipt className="mr-2 h-3.5 w-3.5 text-zinc-300" /> Choose Receipt (Select Row)
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                <TableHead>Branch</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right w-[150px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-zinc-500">
                    Loading transactions history...
                  </TableCell>
                </TableRow>
              ) : filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-zinc-500 text-sm">
                    No past sales receipts found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map(sale => {
                  const saleBranch = branches.find(b => b.id === sale.branch_id);
                  const resolvedBranchName = saleBranch ? saleBranch.name : 'Harare Branch';
                  
                  const productsStr = sale.items && Array.isArray(sale.items)
                    ? sale.items.map((i: any) => `${i.product?.name || i.name || 'item'} (x${i.quantity})`).join(', ')
                    : 'No items';

                  return (
                    <TableRow 
                      key={sale.id} 
                      onClick={() => setSelectedSale(sale)}
                      className={`hover:bg-zinc-50/50 transition-colors cursor-pointer group ${
                        selectedSale?.id === sale.id 
                          ? 'bg-blue-50/70 border-l-2 border-blue-600' 
                          : ''
                      }`}
                    >
                      <TableCell className="font-mono text-xs">
                        {sale.created_at ? new Date(sale.created_at).toLocaleString() : new Date(sale.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-primary font-medium">{sale.receiptNumber}</TableCell>
                      <TableCell className="text-xs font-semibold text-zinc-700">{resolvedBranchName}</TableCell>
                      <TableCell className="font-semibold text-zinc-800">{sale.customerName || 'Walk-In Customer'}</TableCell>
                      <TableCell className="text-xs text-zinc-600 max-w-[220px] truncate" title={productsStr}>
                        {productsStr}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-650">{sale.payment_method || 'Cash'}</TableCell>
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
                );
              })
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
