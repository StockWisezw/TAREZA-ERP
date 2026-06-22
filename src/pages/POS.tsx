import React, { useState, useRef, useEffect } from 'react';
import { 
  usePOSStore, 
  Product, 
  SaleRecord, 
  Customer, 
  getItemPackSize 
} from '../store/posStore';
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
import { db, doc, getDoc, updateDoc, supabase } from '../lib/firebaseClient';
import { usePOSSession } from '../hooks/usePOSSession';
import { indexedDbService } from '../services/indexedDbService';
import { useCartCalculations } from '../hooks/useCartCalculations';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { ProductGrid } from '../components/pos/ProductGrid';
import { CartSummary } from '../components/pos/CartSummary';
import { SessionManager } from '../components/pos/SessionManager';
import { QuotationManager } from '../components/pos/QuotationManager';
import { PaymentFlow } from '../components/pos/PaymentFlow';
import { TransactionHistoryManager } from '../components/pos/TransactionHistoryManager';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useReactToPrint } from 'react-to-print';
import { useNavigate } from 'react-router-dom';
import { Package, Tag, ShoppingCart, HelpCircle } from 'lucide-react';

export default function POS() {
  const navigate = useNavigate();
  const { 
    cart, getTotals, addToCart, removeFromCart, updateQuantity, pricingTier, setPricingTier, setItemPricingTier,
    clearCart, completeSale, currentCustomer, setCurrentCustomer, parkSale, parkedSales, resumeSale,
    applyGlobalDiscount, applyItemDiscount, payments, globalDiscount
  } = usePOSStore();
  
  const totals = getTotals();

  // Load Custom Hooks
  const {
    activeSession,
    setActiveSession,
    sessionLoading,
    openingFloat,
    setOpeningFloat,
    requireFloat,
    setRequireFloat,
    closingActual,
    setClosingActual,
    showCloseShift,
    setShowCloseShift,
    showShiftDetails,
    setShowShiftDetails,
    handleStartShift,
    handleEndShift,
    refreshActiveSession
  } = usePOSSession();

  const {
    vatEnabled,
    setVatEnabled,
    getVatRate,
    calculateItemVat
  } = useCartCalculations();

  const {
    queueLength,
    isSyncing,
    syncOfflineSales
  } = useOfflineQueue();

  // Load saved active transaction state on initial mount/resume from IndexedDB
  useEffect(() => {
    const resumeStoredActiveTransaction = async () => {
      try {
        const storedTx = await indexedDbService.getActiveTransaction();
        if (storedTx && usePOSStore.getState().cart.length === 0) {
          usePOSStore.setState({
            cart: storedTx.cart || [],
            payments: storedTx.payments || [],
            pricingTier: (storedTx.pricingTier as any) || 'retail',
            currentCustomer: storedTx.currentCustomer || null,
            globalDiscount: storedTx.globalDiscount
          });
          toast.info("Resumed active transaction state from local IndexedDB cache.");
        }
      } catch (err) {
        console.error("Failed to restore active transaction from IndexedDB:", err);
      }
    };
    resumeStoredActiveTransaction();
  }, []);

  // Sync active transaction state to IndexedDB in real-time on any changes
  useEffect(() => {
    const backupActiveTransaction = async () => {
      const txState = {
        id: 'current_active_transaction',
        cart,
        payments,
        pricingTier,
        currentCustomer,
        globalDiscount,
        updatedAt: new Date().toISOString()
      };
      
      try {
        if (cart.length > 0 || payments.length > 0) {
          await indexedDbService.saveActiveTransaction(txState);
        } else {
          await indexedDbService.clearActiveTransaction();
        }
      } catch (err) {
        console.error("Failed to sync active transaction to IndexedDB:", err);
      }
    };
    backupActiveTransaction();
  }, [cart, payments, pricingTier, currentCustomer, globalDiscount]);

  // Local States
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showPostSale, setShowPostSale] = useState(false);
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null);

  // Numpad interaction buffer values
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
  const [numpadMode, setNumpadMode] = useState<'qty' | 'disc' | 'price'>('qty');
  const [numpadBuffer, setNumpadBuffer] = useState('');
  const [isNewInput, setIsNewInput] = useState(true);

  // Voice POS Assistant states
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Quotation States
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [quoteNotes, setQuoteNotes] = useState('Estimate valid for 30 days. Prices are subject to change.');
  const [quoteCustomerName, setQuoteCustomerName] = useState('');
  const [isQuotesListOpen, setIsQuotesListOpen] = useState(false);
  const [dbQuotes, setDbQuotes] = useState<any[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // refs
  const receiptRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartContainerRef = useRef<HTMLDivElement>(null);
  const shouldPrintRef = useRef(false);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${lastSale?.receiptNumber || 'POS'}`,
    onAfterPrint: () => {
      shouldPrintRef.current = false;
    }
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [categories, setCategories] = useState<{id: string, name: string, icon: any}[]>([
    { id: 'all', name: 'All Menu', icon: <Package className="w-5 h-5" /> },
    { id: 'beverages', name: 'Beverages', icon: <ShoppingCart className="w-5 h-5" /> },
    { id: 'snacks', name: 'Snacks', icon: <Tag className="w-5 h-5" /> },
    { id: 'pharmacy', name: 'Pharmacy', icon: <HelpCircle className="w-5 h-5" /> },
  ]);

  // Load static constants or preference
  useEffect(() => {
    const isVat = localStorage.getItem('tareza_vat_enabled') === 'true';
    setVatEnabled(isVat);
  }, [setVatEnabled]);

  // Fetch initial products and customers with local resolution
  useEffect(() => {
    let unsubscribeProducts: any = null;
    
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load instantly from local cache
        const localProds = await getLocalProducts();
        if (localProds && localProds.length > 0) {
          setProducts(localProds);
          setIsLoading(false);
        }
        const localCusts = await getLocalCustomers();
        if (localCusts && localCusts.length > 0) {
          setCustomers(localCusts);
        }
        const localCats = await getLocalCategories();
        if (localCats && localCats.length > 0) {
          setCategories([
            { id: 'all', name: 'All Menu', icon: <Package className="w-5 h-5" /> },
            ...localCats.map((c: any) => ({ id: c.id, name: c.name, icon: <Tag className="w-5 h-5" /> }))
          ]);
        }

        // Connect fetch with supabase
        const { data: userData } = await supabase.auth.getUser();
        let userBusinessId = '';
        let userBranchId = '';
        if (userData?.user) {
          const { data: bData } = await supabase.from('business_users').select('business_id, branch_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
          if (bData) {
            userBusinessId = bData.business_id;
            userBranchId = bData.branch_id;
          }
        }

        let customersQuery = supabase.from('customers').select('*').order('name');
        if (userBusinessId) {
          customersQuery = customersQuery.eq('business_id', userBusinessId);
        }

        let categoriesQuery = supabase.from('categories').select('*');
        if (userBusinessId) {
          categoriesQuery = categoriesQuery.eq('business_id', userBusinessId);
        }

        const [custRes, catRes] = await Promise.all([
          customersQuery,
          categoriesQuery
        ]);
        
        const customersData = custRes.data || [];
        const catData = catRes.data || [];
        
        if (customersData.length > 0) {
          const formattedCusts = customersData.map(c => ({
            id: c.id,
            name: c.name,
            creditLimit: Number(c.credit_limit || 0),
            balance: Number(c.balance || 0)
          }));
          setCustomers(formattedCusts);
          await saveLocalCustomers(formattedCusts);
        }

        if (catData.length > 0) {
          const formattedCats = catData.map(c => ({ id: c.id, name: c.name }));
          await saveLocalCategories(formattedCats);

          setCategories([
            { id: 'all', name: 'All Menu', icon: <Package className="w-5 h-5" /> },
            ...catData.map(c => ({ id: c.id, name: c.name, icon: <Tag className="w-5 h-5" /> }))
          ]);
        }
        
        const refreshPOSProducts = () => {
          let productsQuery = supabase.from('products').select('*');
          if (userBusinessId) {
            productsQuery = productsQuery.eq('business_id', userBusinessId);
          }

          let inventoryQuery = supabase.from('inventory').select('*');
          if (userBusinessId) {
            inventoryQuery = inventoryQuery.eq('business_id', userBusinessId);
          }
          if (userBranchId) {
            inventoryQuery = inventoryQuery.eq('branch_id', userBranchId);
          }

          Promise.all([
            productsQuery,
            Promise.resolve(inventoryQuery).catch(() => ({ data: [] }))
          ]).then(([pRes, iRes]) => {
             const data = pRes.data || [];
             const invData = iRes.data || [];
             if (data && data.length > 0) {
                const updatedProducts = data.map(p => {
                  const productInventory = invData.filter((i: any) => i.product_id === p.id && (!userBranchId || i.branch_id === userBranchId));
                  const totalStock = productInventory.reduce((acc: number, cur: any) => acc + (cur.quantity || 0), 0);
                  return {
                    id: p.id,
                    name: p.name || 'Unnamed',
                    barcode: p.barcode || '',
                    sku: p.sku || '',
                    retailPrice: p.retail_price || p.retailPrice || 0,
                    wholesalePrice: p.wholesale_price || p.wholesalePrice || 0,
                    costPrice: p.cost_price || 0,
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

        // Setup real-time postgres subscriptions
        const channel = supabase.channel('public:pos_sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refreshPOSProducts)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, refreshPOSProducts)
          .subscribe();
          
        unsubscribeProducts = () => {
           supabase.removeChannel(channel);
        };

        let initProductsQuery = supabase.from('products').select('*');
        if (userBusinessId) {
          initProductsQuery = initProductsQuery.eq('business_id', userBusinessId);
        }

        let initInventoryQuery = supabase.from('inventory').select('*');
        if (userBusinessId) {
          initInventoryQuery = initInventoryQuery.eq('business_id', userBusinessId);
        }
        if (userBranchId) {
          initInventoryQuery = initInventoryQuery.eq('branch_id', userBranchId);
        }

        const [productsRes, inventoryRes] = await Promise.all([
           initProductsQuery,
           Promise.resolve(initInventoryQuery).catch(() => ({ data: [] }))
        ]);
        
        const initProducts = productsRes.data || [];
        const initInventory = inventoryRes.data || [];
        
        if (initProducts && initProducts.length > 0) {
          const processedProducts = initProducts.map(p => {
            const productInventory = initInventory.filter((i: any) => i.product_id === p.id && (!userBranchId || i.branch_id === userBranchId));
            const totalStock = productInventory.reduce((acc: number, cur: any) => acc + (cur.quantity || 0), 0);
            
            return {
              id: p.id,
              name: p.name || 'Unnamed',
              barcode: p.barcode || '',
              sku: p.sku || '',
              retailPrice: p.retail_price || p.retailPrice || 0,
              wholesalePrice: p.wholesale_price || p.wholesalePrice || 0,
              costPrice: p.cost_price || 0,
              taxClass: p.tax_class || p.taxClass || 'standard',
              category: p.category_id || p.category || 'all',
              imageUrl: '', 
              stock: totalStock
            };
          });
          setProducts(processedProducts);
          await saveLocalProducts(processedProducts);
        }
      } catch (err) {
        console.error('Core loading failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
    };
  }, []);

  // Update voice assistant capability
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setSpeechSupported(true);
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        toast.info('Listening for voice POS checkout command...');
      };

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript.toLowerCase();
        toast.success(`Heard command: "${transcript}"`);
        handleVoiceCommand(transcript);
      };

      recognitionRef.current = rec;
    }
  }, [products]);

  // Keep track of cart and auto-select newly added items automatically
  const prevCartLengthRef = useRef(cart.length);
  useEffect(() => {
    if (cart.length > prevCartLengthRef.current) {
      // Item was added! Auto-select the last item
      const lastItem = cart[cart.length - 1];
      if (lastItem) {
        setSelectedCartItemId(lastItem.id);
        setIsNewInput(true);
      }
    } else if (cart.length === 0) {
      setSelectedCartItemId(null);
    } else if (selectedCartItemId && !cart.some(item => item.id === selectedCartItemId)) {
      // Selected item was removed, select the last remaining item
      setSelectedCartItemId(cart[cart.length - 1].id);
      setIsNewInput(true);
    }
    prevCartLengthRef.current = cart.length;
  }, [cart, selectedCartItemId]);

  // Physical Keyboard listener for POS navigation and keyboard entries
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in any input/textarea/select element (unless arrow keys)
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.hasAttribute('contenteditable') ||
        activeEl.tagName === 'SELECT'
      )) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          // Allow arrow key override to select down/up in the cart items list
        } else {
          return;
        }
      }

      if (cart.length === 0) return;

      // Arrow Down: move to next item
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIndex = cart.findIndex(item => item.id === selectedCartItemId);
        let nextIndex = 0;
        if (currentIndex !== -1) {
          nextIndex = (currentIndex + 1) % cart.length;
        }
        setSelectedCartItemId(cart[nextIndex].id);
        setIsNewInput(true);
        toast.info(`Selected: ${cart[nextIndex].product.name}`);
        return;
      }

      // Arrow Up: move to previous item
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = cart.findIndex(item => item.id === selectedCartItemId);
        let prevIndex = cart.length - 1;
        if (currentIndex !== -1) {
          prevIndex = (currentIndex - 1 + cart.length) % cart.length;
        }
        setSelectedCartItemId(cart[prevIndex].id);
        setIsNewInput(true);
        toast.info(`Selected: ${cart[prevIndex].product.name}`);
        return;
      }

      // Numpad number mapping
      if (/[0-9]/.test(e.key)) {
        e.preventDefault();
        handleNumpadKey(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleNumpadKey('.');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleNumpadKey('backspace');
      } else if (e.key === '+' || e.key === '-') {
        e.preventDefault();
        handleNumpadKey('+/-');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setShowPayment(true);
        toast.info("Proceeding to Split-Tenders Payment Settle...");
      } else if (e.key === 'Escape') {
        e.preventDefault();
        clearCart();
        toast.success("Cart cleared");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cart, selectedCartItemId, numpadMode, numpadBuffer, isNewInput]);

  const startVoiceSearch = () => {
    if (!speechSupported) {
      toast.error('Voice input is not supported in this browser version.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const handleVoiceCommand = (command: string) => {
    if (command.includes('checkout') || command.includes('payment') || command.includes('pay')) {
      if (cart.length > 0) {
        setShowPayment(true);
      } else {
        toast.error('Cart is empty. Cannot checkout.');
      }
      return;
    }

    if (command.includes('clear') || command.includes('empty')) {
      clearCart();
      toast.success('Cart cleared.');
      return;
    }

    // Match search term
    const match = products.find(p => p.name.toLowerCase().includes(command) || p.sku.toLowerCase() === command);
    if (match) {
      addToCart(match, 1, 'retail');
      toast.success(`Added ${match.name} to cart.`);
    } else {
      setSearchTerm(command);
      toast.info(`Searching for: ${command}`);
    }
  };

  // Numpad key triggers
  const handleNumpadKey = (key: string) => {
    const selectedItem = cart.find(item => item.id === selectedCartItemId);
    const resolvedItem = selectedItem || (cart.length > 0 ? cart[cart.length - 1] : null);

    if (!resolvedItem) {
      toast.error('Please select an item in the cart to change quantity.');
      return;
    }

    const targetItem = resolvedItem;

    if (numpadMode === 'qty') {
      const currentVal = targetItem.quantity;
      let currentBuf = numpadBuffer;
      const replacesZero = currentVal === 0 || isNewInput || currentBuf === '0' || currentBuf === '';
      if (replacesZero) {
        if (key === 'backspace') {
          const s = currentVal.toString();
          currentBuf = s.length <= 1 || s === '0' ? '' : s.slice(0, -1);
        } else if (key === '+/-') {
          const newQty = -targetItem.quantity;
          updateQuantity(targetItem.id, newQty);
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
      updateQuantity(targetItem.id, finalQty);
    } else if (numpadMode === 'disc') {
      const currentVal = targetItem.discount?.value || 0;
      let currentBuf = numpadBuffer;
      const replacesZero = currentVal === 0 || isNewInput || currentBuf === '0' || currentBuf === '';
      if (replacesZero) {
        if (key === 'backspace') {
          const s = currentVal.toString();
          currentBuf = s.length <= 1 || s === '0' ? '' : s.slice(0, -1);
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
      applyItemDiscount(targetItem.id, { type: 'percentage', value: finalVal });
    } else if (numpadMode === 'price') {
      const currentVal = targetItem.unitPrice;
      let currentBuf = numpadBuffer;
      const replacesZero = currentVal === 0 || isNewInput || currentBuf === '0' || currentBuf === '';
      if (replacesZero) {
        if (key === 'backspace') {
          const s = currentVal.toString();
          currentBuf = s.length <= 1 || s === '0' ? '' : s.slice(0, -1);
        } else if (key === '+/-') {
          const newPrice = -targetItem.unitPrice;
          usePOSStore.setState((s: any) => ({
             cart: s.cart.map((item: any) => item.id === targetItem.id ? { ...item, unitPrice: newPrice } : item)
          }));
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
      usePOSStore.setState((s: any) => ({
         cart: s.cart.map((item: any) => item.id === targetItem.id ? { ...item, unitPrice: finalPrice } : item)
      }));
    }
  };

  const fetchQuotations = async () => {
    setIsLoadingQuotes(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('status', 'QUOTATION')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDbQuotes(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load quotations list.');
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  const resumeQuotation = (quote: any) => {
    clearCart();

    if (quote.items && Array.isArray(quote.items)) {
      quote.items.forEach((item: any) => {
        const productObj: Product = item.product || {
          id: item.product_id || item.productId,
          name: item.product_name || item.name || 'Unknown Item',
          sku: item.sku || '',
          barcode: item.barcode || '',
          retailPrice: item.price || item.unit_price || item.unitPrice || 0,
          wholesalePrice: item.price || item.unit_price || item.unitPrice || 0,
          taxClass: item.tax_class || 'standard'
        };
        addToCart(productObj, item.quantity, item.tier || 'retail');
      });

      if (quote.customer_id || quote.customerId) {
        setCurrentCustomer({
          id: quote.customer_id || quote.customerId,
          name: quote.customerName || 'Customer',
          creditLimit: 0,
          balance: 0
        });
      }

      toast.success(`Quotation ${quote.receipt_number || quote.receiptNumber} loaded into active cart!`);
    } else {
      toast.error('Quotation has no items.');
    }
  };

  const deleteQuotation = async (id: string, number: string) => {
    if (!confirm(`Are you sure you want to permanently delete quotation ${number}?`)) return;
    try {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (error) throw error;
      toast.success(`Quotation ${number} deleted.`);
      fetchQuotations();
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to delete quote: ${err.message}`);
    }
  };

  const handleCreateQuotation = async () => {
    if (cart.length === 0) {
      toast.error('Cannot create quotation with an empty cart.');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      let businessId = '';
      let branchId = '';
      
      if (userData?.user) {
        const { data: businessData } = await supabase
          .from('business_users')
          .select('business_id, branch_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        if (businessData) {
          businessId = businessData.business_id;
          branchId = businessData.branch_id;
        }
      }

      const quoteReceiptNumber = `QUOT-${Math.floor(Date.now() / 1000).toString(16).toUpperCase()}`;
      
      const payload: any = {
        receiptNumber: quoteReceiptNumber,
        receipt_number: quoteReceiptNumber,
        total: totals.total,
        vatTotal: totals.vat,
        vat_total: totals.vat,
        discountTotal: totals.discount,
        discount_total: totals.discount,
        subtotal: totals.subtotal,
        payment_method: 'cash',
        payments: [],
        items: cart,
        status: 'QUOTATION',
        customerName: quoteCustomerName || currentCustomer?.name || 'Valued Customer',
        created_at: new Date().toISOString()
      };

      if (businessId) payload.business_id = businessId;
      if (branchId) payload.branch_id = branchId;
      if (currentCustomer?.id) {
        payload.customerId = currentCustomer.id;
        payload.customer_id = currentCustomer.id;
      }

      const { data: quoteDoc, error: quoteErr } = await supabase.from('sales').insert([payload]).select().single();

      if (quoteErr) throw quoteErr;

      await logAuditEvent(
        businessId,
        userData?.user?.id || 'unknown',
        'CREATE',
        'POS',
        null,
        { receiptNumber: quoteReceiptNumber, total: totals.total, isQuotation: true }
      );

      toast.success(`Quotation ${quoteReceiptNumber} saved successfully!`);
      setIsQuoteDialogOpen(false);
      clearCart();
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to create quote document: ${err.message}`);
    }
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

      const updateLocalSessionWithOfflineSale = (saleAmount: number) => {
        if (activeSession) {
          const currentTotalSales = Number(activeSession.sales_total || 0) + saleAmount;
          const currentCountSales = Number(activeSession.sales_count || 0) + 1;
          const currentExpectedObj = Number(activeSession.expected_balance || activeSession.opening_balance || 0) + saleAmount;
          
          const updatedSession = {
            ...activeSession,
            sales_total: currentTotalSales,
            sales_count: currentCountSales,
            expected_balance: currentExpectedObj
          };

          setActiveSession(updatedSession as any);
          localStorage.setItem('tareza_active_offline_session', JSON.stringify(updatedSession));
          localStorage.setItem('tareza_active_session_cache', JSON.stringify(updatedSession));
        }
      };

      if (!isOffline) {
        try {
          const { supabase } = await import('../lib/firebaseClient');

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

              // 2.1: Record stock movements with error handling
              const stockErrors: string[] = [];
              for (const item of sale.items) {
                try {
                  const multiplier = getItemPackSize(item);
                  const result = await recordStockMovement(
                    businessId,
                    branchId,
                    item.product.id,
                    -(item.quantity * multiplier),
                    'POS_SALE',
                    userData?.user?.id || 'unknown',
                    sale.receiptNumber,
                    item.product.costPrice || 0
                  );
                  
                  if (!result || result.error) {
                    stockErrors.push(`${item.product.name}: ${result?.error || 'Unknown error'}`);
                  }
                } catch (err: any) {
                  stockErrors.push(`${item.product.name}: ${err.message}`);
                }
              }

              if (stockErrors.length > 0) {
                console.warn('[POS] Inventory sync warnings:', stockErrors);
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
              } as any);
            }

            // 4. Update Customer credit balance if credit purchase
            if (creditPayment && sale.customerId) {
              const { data: custData } = await supabase.from('customers').select('*').eq('id', sale.customerId).single();
              if (custData) {
                const newBalance = Number(custData.balance || 0) + creditPayment.amount;
                await supabase.from('customers').update({ balance: newBalance }).eq('id', sale.customerId);
              }
            }

            // 4.1: Log ALL payment methods
            const paymentTypeMap: Record<string, string> = {
              'cash': 'cash_sale',
              'usd_cash': 'usd_cash_sale',
              'card': 'card_sale',
              'ecocash': 'ecocash_sale',
              'credit': 'credit_sale'
            };

            for (const payment of sale.payments) {
              try {
                const { error } = await supabase.from('cash_drawer_logs').insert([{
                  business_id: businessId,
                  branch_id: branchId,
                  amount: payment.amount,
                  type: payment.method === 'credit' ? 'receivable' : 'cash',
                  transaction_type: paymentTypeMap[payment.method] || 'sale',
                  payment_method: payment.method,
                  notes: `Sale ${sale.receiptNumber} - ${payment.method}`,
                  linked_document_id: saleDoc.id,
                  linked_document_type: 'sale',
                  created_at: new Date().toISOString()
                }]);
                
                if (error) {
                  console.error(`[POS] Cash log error for ${payment.method}:`, error);
                }
              } catch (err: any) {
                console.error(`[POS] Exception logging ${payment.method}:`, err);
              }
            }

            // 4.2: Create summary record for complete audit trail
            try {
              const cashTotal = sale.payments
                .filter(p => p.method === 'cash' || p.method === 'usd_cash')
                .reduce((sum, p) => sum + p.amount, 0);
              const cardTotal = sale.payments
                .filter(p => p.method === 'card')
                .reduce((sum, p) => sum + p.amount, 0);
              const creditTotal = sale.payments
                .filter(p => p.method === 'credit')
                .reduce((sum, p) => sum + p.amount, 0);
              
              await supabase.from('transaction_summaries').insert([{
                business_id: businessId,
                branch_id: branchId,
                transaction_type: 'sale',
                reference_id: sale.receiptNumber,
                reference_document_id: saleDoc.id,
                total_amount: sale.total,
                cash_amount: cashTotal,
                card_amount: cardTotal,
                credit_amount: creditTotal,
                created_at: new Date().toISOString(),
                created_by: userData?.user?.id || 'unknown'
              }]);
            } catch (err: any) {
              console.warn('[POS] Summary record creation failed:', err.message);
            }

            // 3.1: Trigger inventory refresh trigger
            try {
              window.dispatchEvent(new Event('inventory-update-needed'));
            } catch (err) {
              console.error('Failed to dispatch inventory event:', err);
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
          const offlineSale = { ...sale, status: 'offline_pending' as const };
          usePOSStore.setState((s: any) => ({
            offlineQueue: [...s.offlineQueue, offlineSale]
          }));
          updateLocalSessionWithOfflineSale(sale.total);
          toast.warning('Could not save to database — sale queued for automatic retry.');
        }
      } else {
        updateLocalSessionWithOfflineSale(sale.total);
      }
    }
  };

  // Filtered catalogue products search match
  const filteredProducts = products.filter(product => {
    const isCatMatch = activeCategory === 'all' || product.category === activeCategory;
    const lowerSearch = searchTerm.toLowerCase();
    const isSearchMatch = 
      product.name.toLowerCase().includes(lowerSearch) || 
      product.sku.toLowerCase().includes(lowerSearch) || 
      product.barcode.includes(lowerSearch);
    return isCatMatch && isSearchMatch;
  });

  // Check register session status
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh] bg-zinc-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900" />
          <p className="text-sm font-semibold text-zinc-500">Checking Active Register Shift Session...</p>
        </div>
      </div>
    );
  }

  // Session screen layout wrapper when cashier has no active shift opened
  if (!activeSession) {
    return (
      <SessionManager 
        openingFloat={openingFloat}
        setOpeningFloat={setOpeningFloat}
        requireFloat={requireFloat}
        handleStartShift={handleStartShift}
      />
    );
  }

  // Active cashier view grid container
  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      
      {/* Mobile Tab Selector - Hidden on desktop/tablets (md+) */}
      <div className="flex select-none bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 md:hidden justify-between w-full max-w-sm mx-auto mb-3 gap-1 shrink-0 animate-fade-in">
        <button
          type="button"
          onClick={() => setActiveMobileTab('catalog')}
          className={`flex-1 py-1.8 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${activeMobileTab === 'catalog' ? 'bg-white dark:bg-zinc-800 shadow-xs text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-750'}`}
        >
          Browse Products
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab('cart')}
          className={`flex-1 py-1.8 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${activeMobileTab === 'cart' ? 'bg-white dark:bg-zinc-800 shadow-xs text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-750'}`}
        >
          Cart Summary
          {cart.length > 0 && (
            <span className="bg-rose-500 text-white rounded-full text-[9px] w-4.5 h-4.5 flex items-center justify-center font-bold">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row h-full md:h-[calc(100vh-5.5rem)] max-h-[calc(100vh-5.5rem)] gap-4 pb-2 overflow-hidden">
        
        {/* LEFT COLUMN: Products & Search */}
        <div className={cn("flex-1 flex flex-col h-full overflow-hidden animate-fade-in", activeMobileTab !== 'catalog' && "hidden md:flex")}>
          
          {/* Header toolbar */}
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">Point of Sale</h1>
            <div className="flex items-center gap-2">
              <TransactionHistoryManager 
                activeSession={activeSession}
                setActiveSession={setActiveSession}
                userId={(activeSession as any)?.user_id || (activeSession as any)?.cashier_id || 'unknown'}
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setShowShiftDetails(true);
                  refreshActiveSession();
                }}
                className="border-zinc-200 bg-white dark:bg-zinc-900 border-dashed text-xs shadow-none cursor-pointer rounded-xl font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
              >
                Shift Controls
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  fetchQuotations();
                  setIsQuotesListOpen(true);
                }}
                className="border-zinc-200 bg-white dark:bg-zinc-900 border-dashed text-xs shadow-none cursor-pointer rounded-xl font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
              >
                Load Quote
              </Button>
            </div>
          </div>

          {/* Dynamic products catalog list cards */}
          <ProductGrid 
            products={products}
            categories={categories}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            isListening={isListening}
            speechSupported={speechSupported}
            startVoiceSearch={startVoiceSearch}
            addToCart={addToCart}
            isLoading={isLoading}
            filteredProducts={filteredProducts}
          />
        </div>

        {/* RIGHT COLUMN: Active shopping Cart and total prices panels */}
        <CartSummary 
          className={cn(activeMobileTab !== 'cart' && "hidden md:flex")}
          cart={cart}
          currentCustomer={currentCustomer}
          setCurrentCustomer={setCurrentCustomer}
          customers={customers}
          selectedCartItemId={selectedCartItemId}
          setSelectedCartItemId={setSelectedCartItemId}
          setIsNewInput={setIsNewInput}
          setItemPricingTier={setItemPricingTier}
          updateQuantity={updateQuantity}
          removeFromCart={removeFromCart}
          clearCart={clearCart}
          parkSale={parkSale}
          totals={totals}
          vatEnabled={vatEnabled}
          numpadMode={numpadMode}
          setNumpadMode={setNumpadMode}
          handleNumpadKey={handleNumpadKey}
          isQuoteDialogOpen={isQuoteDialogOpen}
          setIsQuoteDialogOpen={setIsQuoteDialogOpen}
          quoteCustomerName={quoteCustomerName}
          setQuoteCustomerName={setQuoteCustomerName}
          quoteNotes={quoteNotes}
          setQuoteNotes={setQuoteNotes}
          handleCreateQuotation={handleCreateQuotation}
          cartContainerRef={cartContainerRef}
          setShowPayment={setShowPayment}
          pricingTier={pricingTier}
          setPricingTier={setPricingTier}
        />
      </div>

      {/* Hidden and external modals including receipts and shift closing */}
      <PaymentFlow 
        showPayment={showPayment}
        setShowPayment={setShowPayment}
        showPostSale={showPostSale}
        setShowPostSale={setShowPostSale}
        lastSale={lastSale}
        setLastSale={setLastSale}
        handlePaymentComplete={handlePaymentComplete}
        handlePrint={handlePrint}
        refreshActiveSession={refreshActiveSession}
        receiptRef={receiptRef}
      />

      {/* Dynamic Active Register Shift Controls modal */}
      <SessionManager 
        openingFloat={openingFloat}
        setOpeningFloat={setOpeningFloat}
        requireFloat={requireFloat}
        handleStartShift={handleStartShift}
        activeSession={activeSession}
        showShiftDetails={showShiftDetails}
        setShowShiftDetails={setShowShiftDetails}
        showCloseShift={showCloseShift}
        setShowCloseShift={setShowCloseShift}
        closingActual={closingActual}
        setClosingActual={setClosingActual}
        handleEndShift={handleEndShift}
      />

      {/* Quotation Manager Modal */}
      <QuotationManager 
        isQuotesListOpen={isQuotesListOpen}
        setIsQuotesListOpen={setIsQuotesListOpen}
        isLoadingQuotes={isLoadingQuotes}
        dbQuotes={dbQuotes}
        fetchQuotations={fetchQuotations}
        resumeQuotation={resumeQuotation}
        deleteQuotation={deleteQuotation}
      />

    </div>
  );
}
