import React, { useState, useRef, useEffect } from 'react';
import { Search, Trash2, CreditCard, Receipt, Barcode, ShoppingCart, Package, ArrowRightLeft, UserPlus, Pause, Play, Tag, HelpCircle, X, ChevronDown, Check, Coins } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { useReactToPrint } from 'react-to-print';
import { useNavigate } from 'react-router-dom';

import { usePOSStore, Product, SaleRecord, Customer, getPackSize } from '../store/posStore';
import { PaymentDialog } from '../components/pos/PaymentDialog';
import { ReceiptPrint } from '../components/pos/ReceiptPrint';
import { 
  getProducts as getLocalProducts, 
  saveProducts as saveLocalProducts,
  getCategories as getLocalCategories,
  saveCategories as saveLocalCategories,
  getCustomers as getLocalCustomers,
  saveCustomers as saveLocalCustomers
} from '../lib/indexedDb';

import {
  getOpenRegisterSession,
  openRegisterSession,
  closeRegisterSession,
  recordStockMovement,
  postJournalEntry,
  logAuditEvent
} from '../services/ledgerService';

import { db, doc, getDoc, updateDoc } from '../lib/supabaseClient';

export default function POS() {
  const navigate = useNavigate();
  const { 
    cart, getTotals, addToCart, removeFromCart, updateQuantity, pricingTier, setPricingTier, setItemPricingTier,
    clearCart, completeSale, currentCustomer, setCurrentCustomer, parkSale, parkedSales, resumeSale,
    applyGlobalDiscount
  } = usePOSStore();
  
  const totals = getTotals();

  // Active Cashier Register Session Shift Manager States
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [openingFloat, setOpeningFloat] = useState('100');
  const [closingActual, setClosingActual] = useState('');
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showShiftDetails, setShowShiftDetails] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showPostSale, setShowPostSale] = useState(false);
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const shouldPrintRef = useRef(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [vatEnabled, setVatEnabled] = useState(false);

  useEffect(() => {
    const isVat = localStorage.getItem('tareza_vat_enabled') === 'true';
    setVatEnabled(isVat);
  }, []);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [categories, setCategories] = useState<{id: string, name: string, icon: any}[]>([
    { id: 'all', name: 'All Menu', icon: <Package className="w-5 h-5" /> },
    { id: 'beverages', name: 'Beverages', icon: <ShoppingCart className="w-5 h-5" /> }, // Use ShoppingCart instead of Coffee
    { id: 'snacks', name: 'Snacks', icon: <Tag className="w-5 h-5" /> },
    { id: 'pharmacy', name: 'Pharmacy', icon: <HelpCircle className="w-5 h-5" /> }, // Use HelpCircle instead of Pill
  ]);

  const receiptRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch products and customers from Supabase with IndexedDB offline-first logic
  useEffect(() => {
    let unsubscribeProducts: any = null;
    
    const loadData = async () => {
      try {
        setIsLoading(true);

        // 1. Load instantly from local IndexedDB if cache exists
        const cachedProducts = await getLocalProducts();
        const cachedCustomers = await getLocalCustomers();
        const cachedCats = await getLocalCategories();

        if (cachedProducts.length > 0) {
          setProducts(cachedProducts);
          setIsLoading(false); // Enable immediate UI rendering!
        }
        if (cachedCustomers.length > 0) {
          setCustomers(cachedCustomers);
        }
        if (cachedCats.length > 0) {
          setCategories([
            { id: 'all', name: 'All Menu', icon: <Package className="w-5 h-5" /> },
            ...cachedCats.map(c => ({ id: c.id, name: c.name, icon: <Tag className="w-5 h-5" /> }))
          ]);
        }

        // 1.5 Recover open register session
        try {
          const { supabase: appService } = await import('../lib/supabaseClient');
          const { data: userContext } = await appService.auth.getUser();
          if (userContext?.user) {
            const { data: userBusiness } = await appService.from('business_users').select('business_id').eq('user_id', userContext.user.id).limit(1).maybeSingle();
            if (userBusiness?.business_id) {
              const activeRS = await getOpenRegisterSession(userBusiness.business_id, userContext.user.id);
              if (activeRS) {
                setActiveSession(activeRS);
              }
            }
          }
        } catch (sErr) {
          console.error("Failed to recover open register session on mount:", sErr);
        } finally {
          setSessionLoading(false);
        }

        // 2. Refresh from Server
        const { supabase } = await import('../lib/supabaseClient');
        
        let productsData: any[] = [];
        let customersData: any[] = [];
        let catData: any[] = [];
        
        try {
          const [custRes, catRes] = await Promise.all([
            supabase.from('customers').select('*'),
            supabase.from('categories').select('*')
          ]);
          
          customersData = custRes.data || [];
          catData = catRes.data || [];
          
          if (catData.length > 0) {
            const formattedCats = catData.map(c => ({ id: c.id, name: c.name }));
            await saveLocalCategories(formattedCats);

            setCategories([
              { id: 'all', name: 'All Menu', icon: <Package className="w-5 h-5" /> },
              ...catData.map(c => ({ id: c.id, name: c.name, icon: <Tag className="w-5 h-5" /> }))
            ]);
          }
          
          // Setup realtime subscription for products
          const channel = supabase.channel('public:products')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
               Promise.all([
                 supabase.from('products').select('*'),
                 Promise.resolve(supabase.from('inventory').select('*')).catch(() => ({ data: [] }))
               ]).then(([pRes, iRes]) => {
                  const data = pRes.data || [];
                  const invData = iRes.data || [];
                  if (data && data.length > 0) {
                     const updatedProducts = data.map(p => {
                       const productInventory = invData.filter((i: any) => i.product_id === p.id);
                       const totalStock = productInventory.reduce((acc: number, cur: any) => acc + (cur.quantity || 0), 0);
                       return {
                         id: p.id,
                         name: p.name || 'Unnamed',
                         barcode: p.barcode || '',
                         sku: p.sku || '',
                         retailPrice: p.retail_price || p.retailPrice || 0,
                         wholesalePrice: p.wholesale_price || p.wholesalePrice || 0,
                         taxClass: p.tax_class || p.taxClass || 'standard',
                         category: p.category_id || p.category || 'all',
                         imageUrl: '', 
                         stock: totalStock
                       };
                     });
                     setProducts(updatedProducts);
                     saveLocalProducts(updatedProducts);
                  } else {
                    setProducts([]);
                    saveLocalProducts([]);
                  }
               });
            })
            .subscribe();
            
          unsubscribeProducts = () => {
            supabase.removeChannel(channel);
          };

          // Initial load from Supabase / local storage resolution
          const [productsRes, inventoryRes] = await Promise.all([
             supabase.from('products').select('*'),
             Promise.resolve(supabase.from('inventory').select('*')).catch(() => ({ data: [] }))
          ]);
          
          const initProducts = productsRes.data || [];
          const initInventory = inventoryRes.data || [];
          
          if (initProducts && initProducts.length > 0) {
            const processedProducts = initProducts.map(p => {
              const productInventory = initInventory.filter((i: any) => i.product_id === p.id);
              const totalStock = productInventory.reduce((acc: number, cur: any) => acc + (cur.quantity || 0), 0);
              
              return {
                id: p.id,
                name: p.name || 'Unnamed',
                barcode: p.barcode || '',
                sku: p.sku || '',
                retailPrice: p.retail_price || p.retailPrice || 0,
                wholesalePrice: p.wholesale_price || p.wholesalePrice || 0,
                taxClass: p.tax_class || p.taxClass || 'standard',
                category: p.category_id || p.category || 'all',
                imageUrl: '', 
                stock: totalStock
              };
            });
            setProducts(processedProducts);
            await saveLocalProducts(processedProducts);
          } else {
             setProducts([]);
             await saveLocalProducts([]);
          }
          
        } catch (e) {
          console.warn("Offline or network issue. Relying entirely on locally cached indexedDB data.", e);
          if (cachedProducts.length > 0) {
            toast.info("Operating offline mode with locally cached product catalog.", { duration: 4000 });
          } else {
            toast.error("Offline. No locally cached catalog found.");
          }
        }

        if (customersData.length > 0) {
          const processedCustomers = customersData.map(c => ({
            id: c.id,
            name: c.name || 'Unnamed',
            phone: c.phone || '',
            email: c.email || '',
            address: c.address || '',
            balance: c.balance || 0,
            creditLimit: c.credit_limit || c.creditLimit || 0
          }));
          setCustomers(processedCustomers);
          await saveLocalCustomers(processedCustomers);
        } else if (cachedCustomers.length > 0) {
          // If server call fails or is empty, fallback to cached
          setCustomers(cachedCustomers);
        } else {
          setCustomers([]);
        }
      } catch (err) {
        console.error("Failed to load POS data: ", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    
    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
    };
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 to focus search
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Space for payment ONLY if not typing in an input
      if (e.key === ' ' && document.activeElement?.tagName !== 'INPUT' && cart.length > 0) {
        e.preventDefault();
        setShowPayment(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length]);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    onAfterPrint: () => {
      setLastSale(null); // Clear last sale after printing
    }
  });

  const handleProductClick = (product: Product) => {
    addToCart(product, 1);
    setSearchTerm('');
    setIsSearching(false);
    searchInputRef.current?.focus();
  };

  const handlePaymentComplete = async () => {
    if (!activeSession) {
      toast.error('No active cashier shift session! Please start a shift first before attempting a sale.');
      return;
    }

    const isOffline = !navigator.onLine;

    const sale = completeSale({ isOffline });
    if (sale) {
      setLastSale(sale);
      setShowPayment(false);
      setShowPostSale(true);
      toast.success(isOffline ? 'Sale queued — will sync when online.' : 'Sale completed and recorded!');
      shouldPrintRef.current = false;
      
      if (!isOffline) {
        try {
          const { supabase } = await import('../lib/supabaseClient');

          const { data: userData } = await supabase.auth.getUser();
          let businessId = '';
          let branchId = '';
          if (userData?.user) {
            const { data: businessData } = await supabase.from('business_users').select('business_id, branch_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
            if (businessData?.business_id) {
              businessId = businessData.business_id;
              branchId = businessData.branch_id || '';
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

          // Ensure valid UUID format for any legacy/stub bypass prevention
          if (!businessId || businessId === 'default_business') {
            businessId = '00000000-0000-0000-0000-000000000000';
          }
          if (!branchId || branchId === 'default_branch') {
            branchId = '00000000-0000-0000-0000-000000000000';
          }

          let customerNameVal = 'Walk-In Customer';
          if (sale.customerId) {
            const { data: custVal } = await supabase.from('customers').select('name').eq('id', sale.customerId).maybeSingle();
            if (custVal?.name) {
              customerNameVal = custVal.name;
            }
          }

          const salePayload: any = {
             receipt_number: sale.receiptNumber,
             receiptNumber: sale.receiptNumber,
             customerName: customerNameVal,
             total: sale.total,
             vat_total: sale.vatTotal,
             vatTotal: sale.vatTotal,
             discount_total: sale.discountTotal,
             discountTotal: sale.discountTotal,
             subtotal: sale.total - sale.vatTotal,
             payment_method: sale.payments.length > 0 ? sale.payments[0].method : 'cash',
             payments: sale.payments,
             items: sale.items,
             status: 'COMPLETED',
             created_at: new Date().toISOString()
          };
          if (businessId) salePayload.business_id = businessId;
          if (branchId) salePayload.branch_id = branchId;
          if (sale.customerId) {
            salePayload.customer_id = sale.customerId;
            salePayload.customerId = sale.customerId;
          }

          const { data: saleDoc, error: saleErr } = await supabase.from('sales').insert([salePayload]).select().single();

          if (saleErr || !saleDoc) {
             throw new Error(saleErr?.message || 'Failed to initialize sale document in remote DB.');
          }

          if (saleDoc) {
            // 1. Log sale items and update real-time stock levels with matching double-entry COGS
            if (sale.items.length > 0) {
              const itemsPayload = sale.items.map(item => ({
                sale_id: saleDoc.id,
                product_id: item.product.id,
                quantity: item.quantity,
                price: item.unitPrice,
                unit_price: item.unitPrice,
                line_total: item.subtotal,
                vat_amount: item.vatAmount
              }));
              await supabase.from('sale_items').insert(itemsPayload);

              for (const item of sale.items) {
                const isWholesale = item.tier === 'wholesale';
                const multiplier = isWholesale ? getPackSize(item.product.sku) : 1;
                await recordStockMovement(
                  businessId,
                  branchId,
                  item.product.id,
                  -Math.abs(item.quantity * multiplier), // negative for stock depletion
                  'POS_SALE',
                  userData?.user?.id || 'unknown',
                  sale.receiptNumber,
                  item.product.wholesalePrice
                );
              }
            }

            // 2. Double-Entry Accounting postings for sale receipts
            const creditPayment = sale.payments.find(p => p.method === 'credit');
            const isCredit = !!creditPayment;
            const mainAccount = isCredit ? '1100' : '1000'; // Accounts Receivable vs POS Cash Till

            const ledgerLines = [
              { accountCode: mainAccount, debit: sale.total, credit: 0, description: `Receipt payment ${sale.receiptNumber}` },
              { accountCode: '4000', debit: 0, credit: sale.total, description: `Sales Revenue registered [${sale.receiptNumber}]` }
            ];

            await postJournalEntry(
              businessId,
              branchId,
              userData?.user?.id || 'unknown',
              sale.receiptNumber,
              `POS Sale Checkout ${sale.receiptNumber}`,
              ledgerLines
            );

            // 3. Update active session metrics
            const sessRef = doc(db, 'register_sessions', activeSession.id);
            const sessSnap = await getDoc(sessRef);
            if (sessSnap.exists()) {
              const sessData = sessSnap.data();
              const currentTotalSales = Number(sessData.sales_total || 0) + sale.total;
              const currentCountSales = Number(sessData.sales_count || 0) + 1;
              const currentExpectedObj = Number(sessData.expected_balance || 0) + sale.total;
              await updateDoc(sessRef, {
                sales_total: currentTotalSales,
                sales_count: currentCountSales,
                expected_balance: currentExpectedObj
              });
              // Update activeSession state
              setActiveSession({
                ...activeSession,
                sales_total: currentTotalSales,
                sales_count: currentCountSales,
                expected_balance: currentExpectedObj
              });
            }

            // 4. Update Customer credit balance if credit purchase
            if (creditPayment && sale.customerId) {
              const { data: custData } = await supabase.from('customers').select('*').eq('id', sale.customerId).single();
              if (custData) {
                const newBalance = Number(custData.balance || 0) + creditPayment.amount;
                await supabase.from('customers').update({ balance: newBalance }).eq('id', sale.customerId);
              }
            }

            // 5. Update Cash Drawer Log (Cash Management)
            const cashPayment = sale.payments.find(p => p.method === 'cash' || p.method === 'usd_cash');
            if (cashPayment) {
              await supabase.from('cash_drawer_logs').insert([{
                business_id: businessId,
                branch_id: branchId,
                amount: cashPayment.amount,
                type: 'sale',
                transaction_type: 'cash_sale',
                notes: `Sale ${sale.receiptNumber}`,
                created_at: new Date().toISOString()
              }]);
            }

            // 6. Log Audit Trail
            await logAuditEvent(
              businessId,
              userData?.user?.id || 'unknown',
              'CREATE',
              'POS',
              null,
              { receipt: sale.receiptNumber, total: sale.total }
            );
          }
        } catch (err) {
          console.error('Failed to sync sale to Firebase directly, saving to offline queue:', err);
          // If online sync fails, push to offline queue so SyncManager retries it
          const offlineSale = { ...sale, status: 'offline_pending' as const };
          usePOSStore.setState((s: any) => ({
            offlineQueue: [...s.offlineQueue, offlineSale]
          }));
          toast.warning('Could not save to database — sale queued for automatic retry.');
        }
      }
    } else {
      toast.error('Could not complete sale. Check balance.');
    }
  };

  const handleStartShift = async () => {
    try {
      const floatVal = parseFloat(openingFloat);
      if (isNaN(floatVal) || floatVal < 0) {
        toast.error('Please input a valid opening balance float (non-negative).');
        return;
      }
      const { supabase: appService } = await import('../lib/supabaseClient');
      const { data: userData } = await appService.auth.getUser();
      if (!userData?.user) {
        toast.error('Session error: Could not verify user authentic token.');
        return;
      }
      
      const { data: businessData } = await appService.from('business_users')
        .select('business_id, branch_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      const bid = businessData?.business_id || 'default_business';
      const brid = businessData?.branch_id || 'default_branch';

      const res = await openRegisterSession(bid, brid, userData.user.id, floatVal);
      if (res.success) {
        setActiveSession(res.session);
        toast.success(`Active register session successfully started with float $${floatVal.toFixed(2)}.`);
      } else {
        toast.error(res.error || 'Failed to start register session.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred starting register shift session.');
    }
  };

  const handleEndShift = async () => {
    try {
      const actualVal = parseFloat(closingActual);
      if (isNaN(actualVal) || actualVal < 0) {
        toast.error('Please input a valid closing drawer counter float.');
        return;
      }
      const res = await closeRegisterSession(activeSession.id, actualVal);
      if (res.success) {
        setActiveSession(null);
        setClosingActual('');
        setShowCloseShift(false);
        toast.success(`Active Shift successfully ended! Total Expected: $${res.session.expected_balance.toFixed(2)}, Actual Drawer Float: $${actualVal.toFixed(2)}, Shift Variance Code Over/Short: $${res.session.variance.toFixed(2)}.`);
      } else {
        toast.error(res.error || 'Failed to end register session safely.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred during final shift audit closure.');
    }
  };

  useEffect(() => {
    if (lastSale && shouldPrintRef.current) {
      // Small timeout to ensure ReceiptPrint renders with lastSale
      requestAnimationFrame(() => {
        handlePrint();
        shouldPrintRef.current = false;
      });
    }
  }, [lastSale, handlePrint]);

  const filteredProducts = products.filter(p => {
    const sTerm = searchTerm.toLowerCase();
    const matchesSearch = (p.name || '').toLowerCase().includes(sTerm) || 
                          (p.barcode || '').toLowerCase().includes(sTerm) || 
                          (p.sku || '').toLowerCase().includes(sTerm) ||
                          (p.code || '').toLowerCase().includes(sTerm);
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (!activeSession && !sessionLoading) {
    return (
      <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md bg-white border border-zinc-200 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-zinc-800" />
          <CardHeader className="pt-6">
            <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-2">
              <Coins className="w-6 h-6 text-zinc-700" />
            </div>
            <CardTitle className="text-xl font-bold text-zinc-900 font-sans tracking-tight">Initialize Cashier Shift</CardTitle>
            <p className="text-sm text-zinc-500 mt-1">
              An active register session and opening float are required to activate the POS terminal and maintain continuous transactional integrity.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600">Register Opening Cash Float (USD)</label>
              <Input
                type="number"
                placeholder="100.00"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="w-full font-mono text-lg py-5 pl-3"
              />
            </div>
            <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200 text-xs text-zinc-600 flex items-start gap-2">
              <span className="text-zinc-400 mt-0.5">ℹ</span>
              <span>All sales completed under this terminal shift will be balanced automatically to your cashier ID and are fully auditable.</span>
            </div>
          </CardContent>
          <DialogFooter className="p-6 bg-zinc-50 border-t border-zinc-100 flex flex-col gap-2">
            <Button onClick={handleStartShift} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-5 font-semibold text-sm">
              Open Register Shift
            </Button>
          </DialogFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] gap-4 pb-2">
      
      {/* LEFT COLUMN: Products & Search */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden h-full">
        
        {/* Top Search Bar Area */}
        <div className="p-3 border-b border-zinc-200 bg-zinc-50/50">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-800">Point of Sale</h1>
            <div className="flex items-center gap-2">
              {activeSession && (
                <Dialog open={showShiftDetails} onOpenChange={setShowShiftDetails}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70 hover:text-emerald-800">
                      <Coins className="w-4 h-4 mr-2" /> Shift: Active
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-zinc-700" /> Active Shift Controls
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                          <span className="text-xs text-zinc-400 block mb-0.5">Opened At</span>
                          <span className="font-medium text-zinc-700 font-mono text-xs">
                            {new Date(activeSession.opened_at).toLocaleTimeString() || 'Just now'}
                          </span>
                        </div>
                        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                          <span className="text-xs text-zinc-400 block mb-0.5">Opening Float</span>
                          <span className="font-semibold text-zinc-800 font-mono">
                            ${(activeSession.opening_balance || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                          <span className="text-xs text-zinc-400 block mb-0.5">Current Expected</span>
                          <span className="font-semibold text-zinc-800 font-mono">
                            ${(activeSession.expected_balance || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 font-mono">
                          <span className="text-xs text-zinc-400 block mb-0.5">Transactions Count</span>
                          <span className="font-bold text-zinc-800">
                            {activeSession.sales_count || 0} Sales
                          </span>
                        </div>
                      </div>

                      <Separator />

                      {!showCloseShift ? (
                        <Button 
                          onClick={() => {
                            setShowCloseShift(true);
                            setClosingActual(activeSession.expected_balance?.toString() || '');
                          }} 
                          variant="destructive" 
                          className="w-full"
                        >
                          End Shift & Close Session
                        </Button>
                      ) : (
                        <div className="space-y-3 p-3 border border-red-100 bg-red-50/20 rounded-xl">
                          <h3 className="text-xs font-semibold text-red-800">Final Shift Close Checklist</h3>
                          <div className="space-y-1.5">
                            <label className="text-xs text-zinc-600 block">Actual Cash Drawer Float Counter</label>
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              value={closingActual}
                              onChange={(e) => setClosingActual(e.target.value)}
                              className="font-mono text-base"
                            />
                            <p className="text-[10px] text-zinc-500">
                              Input the exact cash balance. Unbalanced deviations or variance overages/shortages will be reconciled dynamically to the General Ledger.
                            </p>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" variant="outline" onClick={() => setShowCloseShift(false)} className="flex-1">
                              Back
                            </Button>
                            <Button size="sm" variant="destructive" onClick={handleEndShift} className="flex-1">
                              Confirm Close Shift
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              <Button onClick={parkSale} variant="outline" size="sm" className="hidden sm:flex" disabled={cart.length === 0}>
                <Pause className="w-4 h-4 mr-2" /> Hold Sale
              </Button>
              {parkedSales.length > 0 && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm">
                      <Play className="w-4 h-4 mr-2" /> Resume ({parkedSales.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Parked Sales</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {parkedSales.map(sale => (
                        <Card key={sale.id} className="cursor-pointer hover:bg-zinc-50" onClick={() => {
                          resumeSale(sale.id);
                          // A bit hacky but works for un-controlled Radix Dialog, blur or click outside
                          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                        }}>
                          <CardContent className="p-4 flex justify-between items-center">
                            <div>
                              <p className="font-semibold">{sale.receiptNumber}</p>
                              <p className="text-sm text-zinc-500">{new Date(sale.timestamp).toLocaleTimeString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-bold">${sale.total.toFixed(2)}</p>
                              <p className="text-sm text-zinc-500">{sale.items.length} items</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
          
          <div className="relative z-20">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-3 h-5 w-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <Input 
                ref={searchInputRef}
                placeholder="Search products by name, SKU, or scan barcode (F2)..." 
                className="pl-12 h-12 text-base shadow-sm font-sans border-zinc-200 focus-visible:ring-primary focus-visible:border-primary rounded-xl transition-all bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button size="icon" variant="ghost" className="absolute right-2 top-1 h-10 w-10 text-zinc-400 hover:text-zinc-600">
                <Barcode className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Categories */}
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex flex-col items-center justify-center min-w-[100px] py-3 px-4 rounded-xl border transition-all duration-200 ${
                    activeCategory === cat.id 
                    ? 'border-primary bg-primary/5 text-primary shadow-sm' 
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className={`mb-2 p-2 rounded-full ${
                    activeCategory === cat.id ? 'bg-primary/20 text-primary' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {cat.icon}
                  </div>
                  <span className="text-xs font-semibold whitespace-nowrap">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Grid Area */}
        <ScrollArea className="flex-1 bg-zinc-50/50 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24">
            {filteredProducts.map((product) => {
              const bgColors = ['bg-rose-100 text-rose-600', 'bg-blue-100 text-blue-600', 'bg-emerald-100 text-emerald-600', 'bg-amber-100 text-amber-600', 'bg-purple-100 text-purple-600', 'bg-indigo-100 text-indigo-600', 'bg-cyan-100 text-cyan-600'];
              const colorClass = bgColors[product.name.charCodeAt(0) % bgColors.length];
              const pSize = getPackSize(product.sku);
              const hasPack = pSize > 1;

              return (
              <div 
                key={product.id}
                className="group relative bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col hover:border-primary/50"
              >
                <div className={`h-32 relative overflow-hidden flex items-center justify-center ${colorClass}`}>
                  <Package className="w-10 h-10 group-hover:scale-110 transition-transform duration-300 opacity-80" />
                  {product.taxClass !== 'standard' && (
                    <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] bg-white/90 backdrop-blur-sm border-zinc-200 text-zinc-700">
                      {product.taxClass}
                    </Badge>
                  )}
                  {hasPack && (
                    <Badge className="absolute top-2 right-2 text-[10px] bg-purple-600 text-white font-semibold shadow-sm border-0">
                      Pack of {pSize} Available
                    </Badge>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h4 className="font-semibold text-sm line-clamp-2 leading-tight mb-1">{product.name}</h4>
                  <p className="text-xs text-zinc-500 font-mono mb-1">{product.sku}</p>
                  
                  {product.stock !== undefined && (
                    <div className="flex flex-col gap-0.5 mb-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Stock:</span>
                        <span className={`text-xs font-mono font-bold ${(product.stock || 0) > 0 ? ((product.stock || 0) <= pSize * 2 ? 'text-amber-500' : 'text-emerald-505 font-bold') : 'text-rose-500'}`}>
                          {product.stock} units
                        </span>
                      </div>
                      {hasPack && (
                        <span className="text-[10px] text-zinc-500 font-medium">
                          (= {Math.floor(product.stock / pSize)} packs & {product.stock % pSize} units)
                        </span>
                      )}
                    </div>
                  )}
                  
                  {hasPack ? (
                    <div className="space-y-1.5 mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full text-xs h-8 flex justify-between px-2 text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:text-primary transition-all rounded-lg"
                        onClick={() => addToCart(product, 1, 'retail')}
                      >
                        <span className="font-medium text-[11px]">Add Unit</span>
                        <span className="font-mono font-bold text-[11px]">${product.retailPrice.toFixed(2)}</span>
                      </Button>
                      <Button 
                        size="sm" 
                        className="w-full text-xs h-8 flex justify-between px-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-all rounded-lg"
                        onClick={() => addToCart(product, 1, 'wholesale')}
                      >
                        <span className="text-[11px]">Add Pack ({pSize})</span>
                        <span className="font-mono font-bold text-[11px]">${product.wholesalePrice.toFixed(2)}</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-auto pt-2 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <span className="font-bold text-primary text-base">
                        ${product.retailPrice.toFixed(2)}
                      </span>
                      <Button 
                        size="icon" 
                        className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-white"
                        onClick={() => addToCart(product, 1, 'retail')}
                      >
                        <span className="text-lg leading-none mt-[-2px]">+</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
            
            {filteredProducts.length === 0 && (
               <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-500">
                 <Package className="w-12 h-12 text-zinc-300 mb-4" />
                 <p className="text-lg font-medium text-zinc-700">No products found</p>
                 <p className="text-sm">Try adjusting your search or category filter</p>
               </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT COLUMN: Cart List, Totals & Payment (approx 400px fixed or flex ratio) */}
      <div className="w-full lg:w-[400px] xl:w-[460px] flex flex-col gap-4">
        
        {/* Customer Panel */}
        <Card className="border-zinc-200 shadow-sm shrink-0">
          <CardContent className="p-4">
            {currentCustomer ? (
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-zinc-800">{currentCustomer.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={currentCustomer.balance > 0 ? "text-amber-600 border-amber-200 bg-amber-50" : "text-emerald-600 border-emerald-200 bg-emerald-50"}>
                      Bal: ${currentCustomer.balance.toFixed(2)}
                    </Badge>
                    {currentCustomer.creditLimit > 0 && (
                      <span className="text-xs text-zinc-500">Limit: ${currentCustomer.creditLimit.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setCurrentCustomer(null)} className="h-8 w-8 text-zinc-400 hover:text-zinc-600">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full border-dashed border-zinc-300 text-zinc-500 hover:text-primary hover:border-primary hover:bg-zinc-50">
                    <UserPlus className="w-4 h-4 mr-2" /> Add Customer to Sale
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select Customer</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 mt-4">
                    {customers.map(c => (
                      <div key={c.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-zinc-50 cursor-pointer" onClick={() => setCurrentCustomer(c)}>
                        <span className="font-medium">{c.name}</span>
                        <span className="font-mono text-sm text-zinc-500">Bal: ${c.balance.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* Global toggle removed as per request of selecting packs with its own price */}

        {/* Cart items list */}
        <Card className="border-zinc-200 shadow-sm flex-1 min-h-[150px] flex flex-col pt-2">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-4">
              <ShoppingCart className="h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 px-3 pb-2">
              <div className="space-y-2">
                {cart.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="flex justify-between items-center group">
                    <div className="flex flex-col flex-1">
                      <h4 className="text-[13px] font-bold leading-none mb-1 text-zinc-800 line-clamp-1 pr-2">{item.product.name}</h4>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-mono text-zinc-650">${item.unitPrice.toFixed(2)}</span>
                        {getPackSize(item.product.sku) > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newTier = item.tier === 'wholesale' ? 'retail' : 'wholesale';
                              setItemPricingTier(item.id, newTier);
                              toast.success(`Switched ${item.product.name} to ${newTier === 'wholesale' ? 'Pack' : 'Unit'} pricing`);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-semibold border transition-all uppercase tracking-wider ${
                              item.tier === 'wholesale' 
                                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" 
                                : "bg-blue-50 text-blue-705 border-blue-200 hover:bg-blue-100"
                            }`}
                          >
                            {item.tier === 'wholesale' ? `Pack (${getPackSize(item.product.sku)} units)` : 'Unit pricing'}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 border border-zinc-200 shrink-0">
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-zinc-600 hover:bg-white hover:shadow-sm rounded-md" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                        <span className="text-[11px] w-5 text-center font-bold font-mono text-zinc-800">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-zinc-600 hover:bg-white hover:shadow-sm rounded-md" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                      </div>
                      
                      <div className="flex flex-col items-end min-w-[50px]">
                        <span className="font-bold text-[13px] font-mono text-zinc-900">${(item.subtotal + item.vatAmount).toFixed(2)}</span>
                      </div>

                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => removeFromCart(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>

        {/* Totals Panel */}
        <Card className="shrink-0 flex flex-col border-zinc-200 shadow-sm overflow-hidden">
          <CardContent className="p-0 flex flex-col h-full">
            <div className="flex-1 p-3 space-y-2 bg-white">
              <div className="flex justify-between text-zinc-600 items-baseline">
                <span className="text-xs">Subtotal ({cart.length} items)</span>
                <span className="font-mono text-sm font-medium">${totals.subtotal.toFixed(2)}</span>
              </div>
              
              {totals.discount > 0 && (
                <div className="flex justify-between text-amber-600 items-baseline">
                  <span className="text-xs">Discount</span>
                  <span className="font-mono text-sm font-medium">-${totals.discount.toFixed(2)}</span>
                </div>
              )}
              
              {vatEnabled && (
                <div className="flex justify-between text-zinc-650 items-baseline group">
                  <span className="text-xs flex items-center">
                    VAT (15%)
                  </span>
                  <span className="font-mono text-sm font-medium">${totals.vat.toFixed(2)}</span>
                </div>
              )}

              <Separator className="my-1" />

              <div className="pt-1">
                <div className="flex justify-between items-end">
                  <span className="text-base font-semibold text-secondary">Total</span>
                  <span className="text-3xl font-extrabold tracking-tight font-mono text-primary">${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 border-t border-zinc-200 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="bg-white h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold text-sm" onClick={clearCart} disabled={cart.length === 0}>
                  Cancel
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="bg-white h-10 font-semibold text-sm" disabled={cart.length === 0}>
                      <Tag className="w-3.5 h-3.5 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Discount</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Apply Global Discount</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <Button variant="outline" className="h-12 text-base" onClick={() => applyGlobalDiscount({ type: 'percentage', value: 5 })}>5% Off</Button>
                      <Button variant="outline" className="h-12 text-base" onClick={() => applyGlobalDiscount({ type: 'percentage', value: 10 })}>10% Off</Button>
                      <Button variant="outline" className="h-12 text-base" onClick={() => applyGlobalDiscount({ type: 'fixed', value: 5 })}>$5 Off</Button>
                      <Button variant="outline" className="h-12 text-base text-red-500" onClick={() => applyGlobalDiscount({ type: 'percentage', value: 0 })}>Remove Discount</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" className="bg-white h-12 border-zinc-200 font-semibold" onClick={() => toast.info('Select order from history to refund.')}>
                  Refund
                </Button>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" className="bg-white h-10 border-zinc-200 text-zinc-700 font-medium text-xs sm:text-sm" onClick={() => navigate('/cash-management')}>
                   Open Drawer (Cash Management)
                </Button>
              </div>
              
              <Button 
                className="w-full h-12 text-xl font-bold shadow-lg transition-transform active:scale-[0.98] bg-emerald-600 text-white hover:bg-emerald-700 relative overflow-hidden rounded-xl border border-emerald-700 mt-2"
                disabled={cart.length === 0} 
                onClick={() => setShowPayment(true)}
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
                <span className="flex items-center ml-4">Pay Now</span>
                <span className="absolute right-6 font-mono font-extrabold text-xl">${totals.total.toFixed(2)}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* External Modals and Hidden Printable Areas */}
      <PaymentDialog 
        open={showPayment} 
        onOpenChange={setShowPayment}
        onComplete={handlePaymentComplete}
      />
      
      {/* Post Sale Options Dialog */}
      <Dialog open={showPostSale} onOpenChange={setShowPostSale}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Sale Completed</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900">Success</h3>
              <p className="text-zinc-500 font-mono mt-1">Receipt: {lastSale?.receiptNumber}</p>
            </div>
            
            {lastSale && lastSale.payments.reduce((acc, p) => acc + p.amount, 0) > lastSale.total && (
              <div className="w-full mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm text-center">
                <p className="text-emerald-700 font-medium mb-1">Change Due</p>
                <p className="text-3xl font-extrabold font-mono text-emerald-700">
                  ${(lastSale.payments.reduce((acc, p) => acc + p.amount, 0) - lastSale.total).toFixed(2)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              className="w-full sm:w-auto flex-1" 
              onClick={() => {
                setShowPostSale(false);
                setLastSale(null);
              }}
            >
              Next Customer
            </Button>
            <Button 
              className="w-full sm:w-auto flex-1 min-h-[44px]" 
              onClick={() => {
                handlePrint();
                setShowPostSale(false);
              }}
            >
              <Receipt className="mr-2 h-4 w-4" /> Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptPrint ref={receiptRef} sale={lastSale} />
    </div>
  );
}

