import React, { useState, useRef, useEffect } from 'react';
import { Search, Trash2, CreditCard, Receipt, Barcode, ShoppingCart, Package, ArrowRightLeft, UserPlus, Pause, Play, Tag, HelpCircle, X, ChevronDown, Check, Coins, User } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { useReactToPrint } from 'react-to-print';
import { useNavigate } from 'react-router-dom';

import { usePOSStore, Product, SaleRecord, Customer, getPackSize, getItemPackSize } from '../store/posStore';
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
    applyGlobalDiscount, applyItemDiscount
  } = usePOSStore();
  
  const totals = getTotals();

  // Active Cashier Register Session Shift Manager States
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [openingFloat, setOpeningFloat] = useState('100');
  const [requireFloat, setRequireFloat] = useState(false);
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

  // Odoo-style POS numpad and selection state variables
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
  const [numpadMode, setNumpadMode] = useState<'qty' | 'disc' | 'price'>('qty');
  const [isNewInput, setIsNewInput] = useState<boolean>(true);
  const [numpadBuffer, setNumpadBuffer] = useState<string>('');

  // Auto-select the last added item or maintain current selection
  useEffect(() => {
    if (cart.length > 0) {
      const exists = cart.some(item => item.id === selectedCartItemId);
      if (!exists) {
        setSelectedCartItemId(cart[cart.length - 1].id);
        setIsNewInput(true);
        setNumpadBuffer('');
      }
    } else {
      setSelectedCartItemId(null);
      setNumpadBuffer('');
    }
  }, [cart, selectedCartItemId]);

  const getVatRate = () => localStorage.getItem('tareza_vat_enabled') === 'true' ? 0.15 : 0;

  const updateItemPriceInStore = (itemId: string, newPrice: number) => {
    usePOSStore.setState((state) => {
      const updatedCart = state.cart.map((item) => {
        if (item.id === itemId) {
          const subtotal = item.quantity * newPrice;
          let itemDiscountValue = 0;
          if (item.discount) {
            itemDiscountValue = item.discount.type === 'percentage' 
              ? subtotal * (item.discount.value / 100) 
              : item.discount.value;
          }
          const vatAmount = item.product.taxClass === 'standard' 
            ? (subtotal - itemDiscountValue) * getVatRate() 
            : 0;
          return { ...item, unitPrice: newPrice, subtotal, vatAmount };
        }
        return item;
      });
      return { cart: updatedCart };
    });
  };

  const handleNumpadKey = (key: string) => {
    if (cart.length === 0) {
      toast.error("Please add a product to the cart first.");
      return;
    }
    const activeId = selectedCartItemId || (cart.length > 0 ? cart[cart.length - 1].id : null);
    if (!activeId) return;

    const selectedItem = cart.find(item => item.id === activeId);
    if (!selectedItem) return;

    if (numpadMode === 'qty') {
      let currentBuf = numpadBuffer;
      if (isNewInput) {
        if (key === 'backspace') {
          const s = selectedItem.quantity.toString();
          currentBuf = s.slice(0, -1);
        } else if (key === '+/-') {
          const newQty = -selectedItem.quantity;
          updateQuantity(selectedItem.id, newQty);
          setNumpadBuffer(newQty.toString());
          setIsNewInput(false);
          return;
        } else if (key === '.') {
          currentBuf = '0.';
        } else {
          currentBuf = key;
        }
        setIsNewInput(false);
      } else {
        if (key === 'backspace') {
          currentBuf = currentBuf.slice(0, -1);
        } else if (key === '+/-') {
          if (currentBuf.startsWith('-')) {
            currentBuf = currentBuf.substring(1);
          } else {
            currentBuf = '-' + currentBuf;
          }
        } else if (key === '.') {
          if (!currentBuf.includes('.')) {
            currentBuf = (currentBuf || '0') + '.';
          }
        } else {
          currentBuf = currentBuf + key;
        }
      }

      setNumpadBuffer(currentBuf);
      const parsed = parseFloat(currentBuf);
      const finalQty = isNaN(parsed) ? 0 : parsed;
      updateQuantity(selectedItem.id, finalQty);
    } else if (numpadMode === 'disc') {
      const currentVal = selectedItem.discount?.value || 0;
      let currentBuf = numpadBuffer;
      if (isNewInput) {
        if (key === 'backspace') {
          const s = currentVal.toString();
          currentBuf = s.slice(0, -1);
        } else if (key === '+/-') {
          return;
        } else if (key === '.') {
          currentBuf = '0.';
        } else {
          currentBuf = key;
        }
        setIsNewInput(false);
      } else {
        if (key === 'backspace') {
          currentBuf = currentBuf.slice(0, -1);
        } else if (key === '+/-') {
          // No-op for discount
        } else if (key === '.') {
          if (!currentBuf.includes('.')) {
            currentBuf = (currentBuf || '0') + '.';
          }
        } else {
          currentBuf = currentBuf + key;
        }
      }

      setNumpadBuffer(currentBuf);
      const parsed = parseFloat(currentBuf);
      let finalVal = isNaN(parsed) ? 0 : parsed;
      if (finalVal > 100) finalVal = 100;
      applyItemDiscount(selectedItem.id, { type: 'percentage', value: finalVal });
    } else if (numpadMode === 'price') {
      const currentVal = selectedItem.unitPrice;
      let currentBuf = numpadBuffer;
      if (isNewInput) {
        if (key === 'backspace') {
          const s = currentVal.toString();
          currentBuf = s.slice(0, -1);
        } else if (key === '+/-') {
          const newPrice = -selectedItem.unitPrice;
          updateItemPriceInStore(selectedItem.id, newPrice);
          setNumpadBuffer(newPrice.toString());
          setIsNewInput(false);
          return;
        } else if (key === '.') {
          currentBuf = '0.';
        } else {
          currentBuf = key;
        }
        setIsNewInput(false);
      } else {
        if (key === 'backspace') {
          currentBuf = currentBuf.slice(0, -1);
        } else if (key === '+/-') {
          if (currentBuf.startsWith('-')) {
            currentBuf = currentBuf.substring(1);
          } else {
            currentBuf = '-' + currentBuf;
          }
        } else if (key === '.') {
          if (!currentBuf.includes('.')) {
            currentBuf = (currentBuf || '0') + '.';
          }
        } else {
          currentBuf = currentBuf + key;
        }
      }

      setNumpadBuffer(currentBuf);
      const parsed = parseFloat(currentBuf);
      const finalPrice = isNaN(parsed) ? 0 : parsed;
      updateItemPriceInStore(selectedItem.id, finalPrice);
    }
  };

  useEffect(() => {
    const isVat = localStorage.getItem('tareza_vat_enabled') === 'true';
    setVatEnabled(isVat);
    const reqFloat = localStorage.getItem('tareza_require_float') === 'true';
    setRequireFloat(reqFloat);
    if (!reqFloat) {
      setOpeningFloat('0');
    }
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
          
          const refreshPOSProducts = () => {
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
             }).catch(err => {
                console.error("Failed to refresh POS products dynamically:", err);
             });
          };

          // Setup realtime subscription for products and inventory changes
          const channel = supabase.channel('public:pos_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refreshPOSProducts)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, refreshPOSProducts)
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

    let sale = null;
    try {
      sale = completeSale({ isOffline });
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete checkout');
      return;
    }

    if (sale) {
      setLastSale(sale);
      setShowPayment(false);
      setShowPostSale(true);
      toast.success(isOffline ? 'Sale queued — will sync when online.' : 'Sale completed and recorded!');
      shouldPrintRef.current = false;
      
      // Decrement stock in local state immediately so UI updates instantly
      setProducts(prevProducts => {
        const updated = prevProducts.map(p => {
          const cartItem = sale.items.find(item => item.product.id === p.id);
          if (cartItem) {
            const multiplier = getItemPackSize(cartItem);
            const deduction = cartItem.quantity * multiplier;
            return {
              ...p,
              stock: Math.max(0, (p.stock || 0) - deduction)
            };
          }
          return p;
        });
        saveLocalProducts(updated);
        return updated;
      });

      if (!isOffline) {
        try {
          const { supabase } = await import('../lib/supabaseClient');

          const { data: userData } = await supabase.auth.getUser();
          let businessId = activeSession?.business_id || '';
          let branchId = activeSession?.branch_id || '';

          if (userData?.user && (!businessId || businessId === 'default_business' || !branchId || branchId === 'default_branch')) {
            const { data: businessData } = await supabase.from('business_users').select('business_id, branch_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
            if (businessData) {
              if (!businessId || businessId === 'default_business') businessId = businessData.business_id || '';
              if (!branchId || branchId === 'default_branch') branchId = businessData.branch_id || '';
            }
          }

          if (!businessId || businessId === 'default_business' || businessId === '00000000-0000-0000-0000-000000000000') {
            const { data: fallbackB } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
            if (fallbackB?.id) {
              businessId = fallbackB.id;
              const { data: fallbackBr } = await supabase.from('branches').select('id').eq('business_id', fallbackB.id).limit(1).maybeSingle();
              if (fallbackBr?.id) {
                branchId = fallbackBr.id;
              }
            } else {
              const { data: newB } = await supabase.from('businesses').insert({ name: 'Default Business' }).select().single();
              if (newB) {
                businessId = newB.id;
                const { data: newBr } = await supabase.from('branches').insert({ business_id: businessId, name: 'Default Branch' }).select().single();
                if (newBr) {
                  branchId = newBr.id;
                }
              }
            }
          }

          if (!branchId || branchId === 'default_branch' || branchId === '00000000-0000-0000-0000-000000000000') {
            const { data: fallbackBr } = await supabase.from('branches').select('id').eq('business_id', businessId).limit(1).maybeSingle();
            if (fallbackBr?.id) {
              branchId = fallbackBr.id;
            } else {
              const { data: newBr } = await supabase.from('branches').insert({ business_id: businessId, name: 'Default Branch' }).select().single();
              if (newBr) {
                branchId = newBr.id;
              }
            }
          }

          const salePayload: any = {
             receipt_number: sale.receiptNumber,
             receiptNumber: sale.receiptNumber,
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
              const { error: itemsErr } = await supabase.from('sale_items').insert(itemsPayload);
              if (itemsErr) {
                console.error('[POS] Failed to save sale items:', itemsErr);
                throw new Error(itemsErr.message || 'Failed to save items for this sale.');
              }

              for (const item of sale.items) {
                const multiplier = getItemPackSize(item);
                await recordStockMovement(
                  businessId,
                  branchId,
                  item.product.id,
                  -(item.quantity * multiplier), // negative for stock depletion, positive for stock replenishment/refund
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
      const floatVal = parseFloat(openingFloat) || 0;
      if (requireFloat && (!openingFloat || floatVal <= 0)) {
        toast.error('Starting cash float is required. Please type an opening amount first.');
        return;
      }
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

      let bid = businessData?.business_id;
      let brid = businessData?.branch_id;

      if (!bid || bid === 'default_business') {
        const { data: fallbackB } = await appService.from('businesses').select('id').limit(1).maybeSingle();
        if (fallbackB?.id) {
          bid = fallbackB.id;
        } else {
          const { data: newB } = await appService.from('businesses').insert({ name: 'Default Business' }).select().single();
          if (newB) {
            bid = newB.id;
          }
        }
      }

      if (bid && (!brid || brid === 'default_branch')) {
        const { data: fallbackBr } = await appService.from('branches').select('id').eq('business_id', bid).limit(1).maybeSingle();
        if (fallbackBr?.id) {
          brid = fallbackBr.id;
        } else {
          const { data: newBr } = await appService.from('branches').insert({ business_id: bid, name: 'Default Branch' }).select().single();
          if (newBr) {
            brid = newBr.id;
          }
        }
      }

      const res = await openRegisterSession(bid || '00000000-0000-0000-0000-000000000000', brid || '00000000-0000-0000-0000-000000000000', userData.user.id, floatVal);
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
              <label className="text-xs font-medium text-zinc-650 block">
                Register Opening Cash Float (USD) {requireFloat ? '*' : '(Optional)'}
              </label>
              <Input
                type="number"
                placeholder={requireFloat ? "100.00" : "0.00 (Optional - Defaults to zero)"}
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="w-full font-mono text-lg py-5 pl-3"
              />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-xl transition-all">
              <div className="space-y-0.5">
                <label htmlFor="pos-req-float-toggle" className="text-xs font-bold text-zinc-805 cursor-pointer block">Require Cash Float to Open</label>
                <span className="text-[10px] text-zinc-500 max-w-[210px] block leading-normal">
                  When disabled, cashier shifts start immediately with custom or zero balances.
                </span>
              </div>
              <Switch 
                id="pos-req-float-toggle" 
                checked={requireFloat} 
                onCheckedChange={(val) => {
                  setRequireFloat(val);
                  localStorage.setItem('tareza_require_float', String(val));
                  if (!val) {
                    setOpeningFloat('0');
                  } else {
                    setOpeningFloat('100');
                  }
                  toast.success(val ? "Float requirement activated." : "Float requirement disabled.");
                }} 
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
              <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <Input 
                ref={searchInputRef}
                placeholder="Search products by name, SKU, or scan barcode (F2)..." 
                className="pl-10 h-10 text-sm shadow-sm font-sans border-zinc-200 focus-visible:ring-primary focus-visible:border-primary rounded-xl transition-all bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button size="icon" variant="ghost" className="absolute right-1.5 top-0.5 h-9 w-9 text-zinc-400 hover:text-zinc-650">
                <Barcode className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Categories */}
            <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1.5 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 py-1 px-3.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                    activeCategory === cat.id 
                    ? 'border-primary bg-primary/5 text-primary shadow-sm' 
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <span className="scale-75 text-zinc-400 opacity-80">{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Grid Area */}
        <ScrollArea className="flex-1 bg-zinc-50/50 p-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 pb-16">
            {filteredProducts.map((product) => {
              const bgColors = ['bg-rose-100 text-rose-600', 'bg-blue-100 text-blue-600', 'bg-emerald-100 text-emerald-600', 'bg-amber-100 text-amber-600', 'bg-purple-100 text-purple-600', 'bg-indigo-100 text-indigo-600', 'bg-cyan-100 text-cyan-600'];
              const colorClass = bgColors[product.name.charCodeAt(0) % bgColors.length];
              const pSize = getPackSize(product.sku);
              const hasPack = pSize > 1;

              return (
              <div 
                key={product.id}
                onClick={() => addToCart(product, 1, 'retail')}
                className="group relative bg-white border border-zinc-200 rounded-xl overflow-hidden hover:shadow-sm transition-all flex flex-col cursor-pointer hover:border-primary/50"
              >
                <div className={`h-11 relative overflow-hidden flex items-center justify-center shrink-0 ${colorClass}`}>
                  <Package className="w-5 h-5 group-hover:scale-110 transition-transform duration-300 opacity-80" />
                  {product.taxClass !== 'standard' && (
                    <Badge variant="secondary" className="absolute top-1 left-1 text-[8px] h-3 px-1 bg-white/90 backdrop-blur-sm border-zinc-200 text-zinc-700">
                      {product.taxClass}
                    </Badge>
                  )}
                  {hasPack && (
                    <Badge className="absolute top-1 right-1 text-[8px] h-3 px-1 bg-purple-600 text-white font-semibold shadow-sm border-0">
                      Pack ({pSize})
                    </Badge>
                  )}
                </div>
                <div className="p-1.5 flex flex-col flex-1">
                  <h4 className="font-semibold text-xs text-zinc-800 line-clamp-2 leading-tight min-h-[1.75rem] mb-0.5">{product.name}</h4>
                  <p className="text-[10px] text-zinc-400 font-mono leading-none mb-1">{product.sku}</p>
                  
                  {product.stock !== undefined && (
                    <div className="flex flex-col gap-0.5 mb-1">
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-mono font-medium ${(product.stock || 0) > 0 ? 'text-zinc-500' : 'text-rose-500 font-bold'}`}>
                          Stock: {product.stock}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {((product.bundles && product.bundles.length > 0) || hasPack) ? (
                    <div className="space-y-1 mt-auto pt-1 select-none" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full text-[10px] h-6 flex justify-between px-1.5 text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:text-primary transition-all rounded-md"
                        onClick={() => addToCart(product, 1, 'retail')}
                      >
                        <span>+1 Unit</span>
                        <span className="font-mono font-bold">${product.retailPrice.toFixed(2)}</span>
                      </Button>
                      {hasPack && (
                        <Button 
                          size="sm" 
                          className="w-full text-[10px] h-6 flex justify-between px-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-all rounded-md"
                          onClick={() => addToCart(product, 1, 'wholesale')}
                        >
                          <span>+Pack ({pSize})</span>
                          <span className="font-mono font-bold">${product.wholesalePrice.toFixed(2)}</span>
                        </Button>
                      )}
                      {product.bundles?.map((b: any, index: number) => (
                        <Button 
                          key={index}
                          size="sm" 
                          className="w-full text-[10px] h-6 flex justify-between px-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-all rounded-md"
                          onClick={() => addToCart(product, 1, b.name)}
                        >
                          <span>+{b.name} ({b.pack_size || b.packSize})</span>
                          <span className="font-mono font-bold">${Number(b.price || 0).toFixed(2)}</span>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-auto pt-1 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <span className="font-bold text-xs text-primary leading-none">
                        ${product.retailPrice.toFixed(2)}
                      </span>
                      <Button 
                        size="icon" 
                        className="h-5 w-5 rounded-full bg-primary hover:bg-primary/90 text-white"
                        onClick={() => addToCart(product, 1, 'retail')}
                      >
                        <span className="text-xs leading-none">+</span>
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

      {/* RIGHT COLUMN: Customer, Cart List, Totals & Odoo Numpad Panel */}
      <div className="w-full lg:w-[400px] xl:w-[460px] flex flex-col gap-2 h-full overflow-hidden justify-between">
        
        {/* Customer Panel */}
        <Card className="border-zinc-200 shadow-sm shrink-0">
          <CardContent className="p-2">
            {currentCustomer ? (
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xs text-zinc-800 flex items-center gap-1">
                    <User className="w-3 h-3 text-zinc-500" />
                    {currentCustomer.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-[10px] py-0 px-1 border-0 h-4.5 font-semibold ${currentCustomer.balance > 0 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50"}`}>
                      Bal: ${currentCustomer.balance.toFixed(2)}
                    </Badge>
                    {currentCustomer.creditLimit > 0 && (
                      <span className="text-[10px] text-zinc-500 font-mono">Limit: ${currentCustomer.creditLimit.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setCurrentCustomer(null)} className="h-6 w-6 text-zinc-400 hover:text-zinc-650">
                  <X className="h-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full h-8 text-xs border-dashed border-zinc-300 text-zinc-500 hover:text-primary hover:border-primary hover:bg-zinc-50 bg-white">
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Select Customer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select Customer</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 mt-4 max-h-[60vh] overflow-y-auto">
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

        {/* Dynamic Interactive Shopping Cart items list container */}
        <Card className="border-zinc-200 shadow-sm flex-1 min-h-[140px] max-h-[290px] flex flex-col pt-1.5 bg-white pb-1.5 rounded-xl overflow-hidden">
          {cart.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center text-zinc-400 p-3">
              <ShoppingCart className="h-7 w-7 text-zinc-300 mb-1.5" />
              <p className="text-xs font-semibold">Cart is currently empty</p>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              <ScrollArea className="flex-1 px-2.5">
                <div className="space-y-1">
                  {cart.map((item, index) => {
                    const isSelected = selectedCartItemId === item.id;
                    return (
                      <div 
                        key={`${item.id}-${index}`} 
                        onClick={() => {
                          setSelectedCartItemId(item.id);
                          setIsNewInput(true);
                        }}
                        className={`flex justify-between items-center p-1.5 rounded-lg border transition-all cursor-pointer group ${
                          isSelected 
                            ? 'border-primary ring-1 ring-primary/30 bg-primary/[0.02]' 
                            : 'border-zinc-100 hover:border-zinc-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-col flex-1 min-w-0 pr-1">
                          <h4 className={`text-xs font-bold leading-tight line-clamp-1 ${isSelected ? 'text-primary' : 'text-zinc-800'}`}>
                            {item.product.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-500 font-mono">
                            <span>${item.unitPrice.toFixed(2)}</span>
                            {item.discount && item.discount.value > 0 && (
                              <span className="text-rose-600 font-semibold bg-rose-50 px-1 rounded text-[8px]">
                                -{item.discount.value}%
                              </span>
                            )}
                            {(getPackSize(item.product.sku) > 1 || (item.product.bundles && item.product.bundles.length > 0)) && (
                              <select
                                value={item.tier || 'retail'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const selectedTier = e.target.value;
                                  setItemPricingTier(item.id, selectedTier);
                                  toast.success(`Switched ${item.product.name} to ${selectedTier === 'retail' ? 'Unit' : (selectedTier === 'wholesale' ? 'Pack' : selectedTier)}`);
                                }}
                                className="bg-zinc-50 border border-zinc-200 text-zinc-700 text-[9px] font-bold py-0.5 px-1 rounded cursor-pointer max-w-[120px] h-5 focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="retail">Unit (1)</option>
                                {getPackSize(item.product.sku) > 1 && (
                                  <option value="wholesale">Pack ({getPackSize(item.product.sku)})</option>
                                )}
                                {item.product.bundles?.map((b: any, bIdx: number) => (
                                  <option key={bIdx} value={b.name}>{b.name} ({b.pack_size || b.packSize})</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Numeric input for manual typed quantity as requested by the user */}
                          <div className="flex items-center gap-1">
                            <input 
                              type="number"
                              step="any"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                  updateQuantity(item.id, val);
                                } else if (e.target.value === '') {
                                  updateQuantity(item.id, 0);
                                }
                              }}
                              onClick={() => {
                                setSelectedCartItemId(item.id);
                                setIsNewInput(true);
                              }}
                              className="w-10 h-6 text-center text-xs font-black font-mono border border-zinc-250 bg-zinc-50 rounded focus:bg-white text-zinc-900 p-0 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                            <div className="flex flex-col gap-0.5">
                              <button 
                                className="h-3 w-3 flex items-center justify-center bg-zinc-100 text-zinc-700 text-[8px] hover:bg-zinc-250 rounded border border-zinc-200"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                +
                              </button>
                              <button 
                                className="h-3 w-3 flex items-center justify-center bg-zinc-100 text-zinc-700 text-[8px] hover:bg-zinc-250 rounded border border-zinc-200"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              >
                                -
                              </button>
                            </div>
                          </div>
                          
                          <div className="text-right min-w-[50px]">
                            <span className="font-bold text-xs font-mono text-zinc-900">${(item.subtotal + item.vatAmount).toFixed(2)}</span>
                          </div>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-red-400 hover:text-red-650 hover:bg-red-50 rounded" 
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              
              <div className="text-[9px] text-zinc-500 text-center select-none font-medium mt-1 leading-none py-1 border-t border-zinc-100 bg-zinc-50/70 rounded-b-xl flex items-center justify-center gap-1.5 shrink-0">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Select cart row to alter Qty/Disc/Price using the Numpad.
              </div>
            </div>
          )}
        </Card>

        {/* Compact Totals Board Panel */}
        <div className="bg-white border border-zinc-200 rounded-xl p-2.5 text-zinc-800 shadow-sm shrink-0">
          <div className="flex justify-between items-baseline text-xs text-zinc-500 mb-0.5">
            <span>Subtotal</span>
            <span className="font-mono font-semibold">${totals.subtotal.toFixed(2)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between items-baseline text-xs text-amber-600 mb-0.5">
              <span>Total Discount</span>
              <span className="font-mono font-semibold">-${totals.discount.toFixed(2)}</span>
            </div>
          )}
          {vatEnabled && (
            <div className="flex justify-between items-baseline text-xs text-zinc-500 mb-0.5">
              <span>VAT (15%)</span>
              <span className="font-mono font-semibold">${totals.vat.toFixed(2)}</span>
            </div>
          )}
          <Separator className="my-1" />
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-zinc-700">Total to Pay</span>
            <span className="text-xl font-black font-mono text-primary leading-none">
              ${totals.total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Odoo POS Numpad Actions Widget */}
        <div className="grid grid-cols-12 gap-1.5 p-1.5 bg-zinc-50/50 border border-zinc-200 rounded-xl shadow-inner shrink-0">
          
          {/* Left Part: 4x4 keypad matrix (takes 8 of 12 width) */}
          <div className="col-span-8 grid grid-cols-4 gap-1">
            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('1')} 
              className="h-10 text-base font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 shadow-sm rounded-lg"
            >
              1
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('2')} 
              className="h-10 text-base font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 shadow-sm rounded-lg"
            >
              2
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('3')} 
              className="h-10 text-base font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 shadow-sm rounded-lg"
            >
              3
            </Button>
            <Button 
              type="button"
              variant={numpadMode === 'qty' ? 'default' : 'outline'} 
              onClick={() => { setNumpadMode('qty'); setIsNewInput(true); }}
              className={`h-11 text-[10px] font-extrabold uppercase leading-none rounded-lg border ${
                numpadMode === 'qty' ? 'bg-primary text-white border-primary shadow' : 'bg-white text-zinc-650 border-zinc-200'
              }`}
            >
              Qty
            </Button>

            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('4')} 
              className="h-10 text-base font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 shadow-sm rounded-lg"
            >
              4
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('5')} 
              className="h-10 text-base font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 shadow-sm rounded-lg"
            >
              5
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('6')} 
              className="h-10 text-base font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 shadow-sm rounded-lg"
            >
              6
            </Button>
            <Button 
              type="button"
              variant={numpadMode === 'disc' ? 'default' : 'outline'} 
              onClick={() => { setNumpadMode('disc'); setIsNewInput(true); }}
              className={`h-11 text-[10px] font-extrabold uppercase leading-none rounded-lg border ${
                numpadMode === 'disc' ? 'bg-primary text-white border-primary shadow' : 'bg-white text-zinc-650 border-zinc-200'
              }`}
              disabled={cart.length === 0}
            >
              % Disc
            </Button>

            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('7')} 
              className="h-10 text-base font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 shadow-sm rounded-lg"
            >
              7
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('8')} 
              className="h-10 text-base font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 shadow-sm rounded-lg"
            >
              8
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('9')} 
              className="h-10 text-base font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 shadow-sm rounded-lg"
            >
              9
            </Button>
            <Button 
              type="button"
              variant={numpadMode === 'price' ? 'default' : 'outline'} 
              onClick={() => { setNumpadMode('price'); setIsNewInput(true); }}
              className={`h-11 text-[10px] font-extrabold uppercase leading-none rounded-lg border ${
                numpadMode === 'price' ? 'bg-primary text-white border-primary shadow' : 'bg-white text-zinc-650 border-zinc-200'
              }`}
              disabled={cart.length === 0}
            >
              Price
            </Button>

            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('+/-')} 
              className="h-10 text-xs font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 rounded-lg shadow-sm"
            >
              +/-
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('0')} 
              className="h-10 text-base font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 rounded-lg shadow-sm"
            >
              0
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('.')} 
              className="h-10 text-base font-bold font-mono bg-white hover:bg-zinc-100 border-zinc-200 rounded-lg shadow-sm"
            >
              .
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleNumpadKey('backspace')} 
              className="h-10 text-base font-bold flex items-center justify-center bg-white hover:bg-rose-50 hover:text-rose-600 border-zinc-200 rounded-lg shadow-sm"
            >
              ⌫
            </Button>
          </div>

          {/* Right Part: Quick checkout macro blocks (takes 4 of 12 width) */}
          <div className="col-span-4 flex flex-col gap-1.5 justify-between">
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                onClick={clearCart} 
                disabled={cart.length === 0}
                className="flex-1 h-9 px-1 text-[10px] font-bold text-rose-600 border-rose-200 bg-white hover:bg-rose-50 rounded-lg transition-colors"
                title="Cancel sale / Clear order items"
              >
                Clear
              </Button>
              <Button 
                variant="outline" 
                onClick={parkSale} 
                disabled={cart.length === 0}
                className="flex-1 h-9 px-1 text-[10px] font-bold text-zinc-700 border-zinc-200 bg-white hover:bg-zinc-100 rounded-lg transition-all"
                title="Put items on hold"
              >
                Hold
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-1">
              <Button 
                variant="outline" 
                onClick={() => navigate('/cash-management')} 
                className="h-9 px-0.5 text-[9px] font-bold text-center border-zinc-200 bg-white leading-tight rounded-lg hover:bg-zinc-105"
                title="Drawer Control Dashboard"
              >
                Cash Control
              </Button>
              <Button 
                type="button"
                variant="outline" 
                onClick={() => toast.info('To initiate a refund, please choose from active sales log.')} 
                className="h-9 px-0.5 text-[9px] font-bold text-zinc-650 border-zinc-200 bg-white rounded-lg hover:bg-zinc-105"
                title="Order return / customer refund log link"
              >
                Refund
              </Button>
            </div>

            <Button 
              onClick={() => setShowPayment(true)} 
              disabled={cart.length === 0}
              className="h-[4.25rem] w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase flex flex-col items-center justify-center gap-1 shadow border border-emerald-700 active:scale-[0.98] transition-transform"
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span className="tracking-widest">Pay Now</span>
            </Button>
          </div>
        </div>

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

