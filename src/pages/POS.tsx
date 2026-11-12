import React, { useState, useRef, useEffect } from 'react';
import { 
  usePOSStore, 
  Product, 
  SaleRecord, 
  Customer, 
  getItemPackSize,
  getPackSize
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
import { db as dexieDb } from '../lib/dexieDb';
import { usePOSSession } from '../hooks/usePOSSession';
import { usePOSData } from '../hooks/usePOSData';
import { indexedDbService } from '../services/indexedDbService';
import { useCartCalculations } from '../hooks/useCartCalculations';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { ProductGrid } from '../components/pos/ProductGrid';
import { CartSummary } from '../components/pos/CartSummary';
import { SessionManager } from '../components/pos/SessionManager';
import { ShiftsDashboard } from '../components/pos/ShiftsDashboard';
import { QuotationManager } from '../components/pos/QuotationManager';
import { PaymentFlow } from '../components/pos/PaymentFlow';
import { TransactionHistoryManager } from '../components/pos/TransactionHistoryManager';
import { POSHardwareSettingsDialog } from '../components/pos/POSHardwareSettingsDialog';
import { CustomerChangeNotes } from '../components/pos/CustomerChangeNotes';
import { Button } from '../components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useReactToPrint } from 'react-to-print';
import { useNavigate } from 'react-router-dom';
import { Package, Tag, ShoppingCart, HelpCircle, Monitor, Cpu, Fingerprint, Maximize, Sliders, Layout, RefreshCw, FileText } from 'lucide-react';

export default function POS() {
  const navigate = useNavigate();
  const { 
    cart, getTotals, addToCart, removeFromCart, updateQuantity, pricingTier, setPricingTier, setItemPricingTier,
    clearCart, completeSale, currentCustomer, setCurrentCustomer, parkSale, parkedSales, resumeSale,
    applyGlobalDiscount, applyItemDiscount, payments, globalDiscount, offlineQueue
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

  const [showChangeNotes, setShowChangeNotes] = useState(false);
  const [unclaimedChangeCount, setUnclaimedChangeCount] = useState(0);

  useEffect(() => {
    const fetchUnclaimedCount = async () => {
      try {
        const count = await dexieDb.left_changes.where('status').equals('unclaimed').count();
        setUnclaimedChangeCount(count);
      } catch (e) {}
    };
    fetchUnclaimedCount();
    const interval = setInterval(fetchUnclaimedCount, 6000);
    return () => clearInterval(interval);
  }, []);

  // Load saved active transaction state on initial mount/resume from IndexedDB
  useEffect(() => {
    const resumeStoredActiveTransaction = async () => {
      try {
        // First restore any pending offline transactions queue
        await usePOSStore.getState().loadOfflineQueueFromIndexedDb();
        
        // Then restore active transaction state
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

  // Load data via custom hook
  const { products, setProducts, customers, categories, isLoading } = usePOSData(activeSession);
  const [activeCategory, setActiveCategory] = useState<string>('all');
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
  const [viewingDashboard, setViewingDashboard] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? window.navigator.onLine : true);

  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      toast.error('Cannot sync: No internet connection detected. Please connect to a network.');
      return;
    }
    setIsManualSyncing(true);
    const syncToast = toast.loading('Syncing offline transactions and register data to cloud...');
    try {
      const { syncOfflineDatabase } = await import('../lib/firebaseClient');
      await syncOfflineDatabase();

      const { offlineSyncEngine } = await import('../services/offlineSyncEngine');
      await offlineSyncEngine.sync();

      window.dispatchEvent(new CustomEvent('tareza-trigger-sync'));
      toast.success('All offline transactions & register data synced to cloud!', { id: syncToast });
    } catch (err: any) {
      console.error('[Manual Sync Error]:', err);
      toast.error('Sync failed: ' + (err?.message || String(err)), { id: syncToast });
    } finally {
      setIsManualSyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.info('Internet connection restored. Tap "Sync Data to Online" to push offline transactions.');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Operating offline. All transactions are recorded locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // POS Hardware & Touchscreen Resolution Optimizers
  const [posScale, setPosScale] = useState<'75' | '85' | '90' | '100' | '110'>(() => {
    return (localStorage.getItem('tareza_pos_scale') as any) || '100';
  });
  const [hardwareOptimize, setHardwareOptimize] = useState<boolean>(() => {
    return localStorage.getItem('tareza_pos_hw_optimize') === 'true';
  });
  const [touchOptimized, setTouchOptimized] = useState<boolean>(() => {
    return localStorage.getItem('tareza_pos_touch_optimized') === 'true';
  });
  const [hideHeader, setHideHeader] = useState<boolean>(() => {
    return localStorage.getItem('tareza_pos_hide_layout_header') === 'true';
  });
  const [scaleMode, setScaleMode] = useState<'zoom' | 'transform' | 'vector'>(() => {
    const saved = localStorage.getItem('tareza_pos_scale_mode');
    if (saved) return saved as 'zoom' | 'transform' | 'vector';
    return 'vector';
  });
  const [showHwSettings, setShowHwSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Apply root font-size scaling for crisp, pixel-perfect vector zooming
  useEffect(() => {
    if (scaleMode === 'vector') {
      document.documentElement.style.fontSize = `${posScale}%`;
    } else {
      document.documentElement.style.fontSize = ''; // Reset to default
    }
    return () => {
      document.documentElement.style.fontSize = ''; // Revert when leaving POS page
    };
  }, [posScale, scaleMode]);

  // Persist hardware preferences
  useEffect(() => {
    localStorage.setItem('tareza_pos_scale', posScale);
  }, [posScale]);

  useEffect(() => {
    localStorage.setItem('tareza_pos_hw_optimize', String(hardwareOptimize));
  }, [hardwareOptimize]);

  useEffect(() => {
    localStorage.setItem('tareza_pos_touch_optimized', String(touchOptimized));
  }, [touchOptimized]);

  useEffect(() => {
    localStorage.setItem('tareza_pos_hide_layout_header', String(hideHeader));
    window.dispatchEvent(new CustomEvent('tareza_pos_header_toggled'));
  }, [hideHeader]);

  useEffect(() => {
    localStorage.setItem('tareza_pos_scale_mode', scaleMode);
  }, [scaleMode]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        toast.error(`Error enabling fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

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

  // Load static constants or preference
  useEffect(() => {
    const isVat = localStorage.getItem('tareza_vat_enabled') === 'true';
    setVatEnabled(isVat);
  }, [setVatEnabled]);

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

    const isOffline = true; // All transactions recorded offline by default

    // Calculate a sale timestamp matching the active shift business day date with current wall-clock time
    const getSaleTimestamp = () => {
      if (!activeSession || !activeSession.opened_at) return new Date().toISOString();
      const sessionDate = new Date(activeSession.opened_at);
      const now = new Date();
      sessionDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      return sessionDate.toISOString();
    };
    const saleTimestamp = getSaleTimestamp();

    let sale = null;
    try {
      sale = completeSale({ 
        isOffline, 
        allProducts: products, 
        customTimestamp: saleTimestamp,
        businessId: activeSession?.business_id,
        branchId: activeSession?.branch_id
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete checkout');
      return;
    }

    if (sale) {
      setLastSale(sale);
      setShowPayment(false);
      setShowPostSale(true);
      toast.success(`Sale recorded locally (Receipt #${sale.receiptNumber}). Ready for manual sync.`);
      shouldPrintRef.current = false;
      
      // Decrement stock in local state immediately so UI updates instantly with BOM explosion
      setProducts(prevProducts => {
        const deductions: Record<string, number> = {};
        
        for (const item of sale.items) {
          const bomBundle = item.product.bundles?.find((b: any) => b.is_bom);
          if (bomBundle && bomBundle.bom_composition && bomBundle.bom_composition.length > 0) {
            // Explode BOM
            for (const comp of bomBundle.bom_composition) {
              const compProduct = prevProducts.find(p => p.id === comp.product_id || p.sku === comp.sku);
              if (compProduct) {
                const decAmount = item.quantity * comp.quantity;
                deductions[compProduct.id] = (deductions[compProduct.id] || 0) + decAmount;
              }
            }
          } else {
            // Standard item or simple pack
            const multiplier = getItemPackSize(item);
            const decAmount = item.quantity * multiplier;
            deductions[item.product.id] = (deductions[item.product.id] || 0) + decAmount;
          }
        }

        // Apply deductions
        const updated = prevProducts.map(p => {
          const dec = deductions[p.id];
          if (dec !== undefined) {
            return {
              ...p,
              stock: Math.max(0, (p.stock || 0) - dec)
            };
          }
          return p;
        });
        
        saveLocalProducts(updated);
        return updated;
      });

      const updateLocalSessionWithOfflineSale = (saleAmount: number, saleCogs: number = 0) => {
        if (activeSession) {
          const currentTotalSales = Number(activeSession.sales_total || 0) + saleAmount;
          const currentCountSales = Number(activeSession.sales_count || 0) + 1;
          const currentExpectedObj = Number(activeSession.expected_balance || activeSession.opening_balance || 0) + saleAmount;
          const currentCogs = Number(activeSession.cogs_total || activeSession.cogs || 0) + saleCogs;
          
          const updatedSession = {
            ...activeSession,
            sales_total: currentTotalSales,
            sales_count: currentCountSales,
            expected_balance: currentExpectedObj,
            cogs_total: currentCogs,
            cogs: currentCogs
          };

          setActiveSession(updatedSession as any);
          localStorage.setItem('tareza_active_offline_session', JSON.stringify(updatedSession));
          localStorage.setItem('tareza_active_session_cache', JSON.stringify(updatedSession));
        }
      };

      const persistOfflineSale = async (currentSale: SaleRecord, saleCogsVal: number) => {
        try {
          updateLocalSessionWithOfflineSale(currentSale.total, saleCogsVal);

          const { getActiveBusinessId } = await import('../lib/firebaseClient');
          const bizId = (await getActiveBusinessId()) || activeSession?.business_id || 'default_business';
          const branchId = activeSession?.branch_id || '';

          // 1. Save complete sale into Dexie sales table
          await dexieDb.sales.put({
            id: currentSale.id,
            receipt_number: currentSale.receiptNumber,
            receiptNumber: currentSale.receiptNumber,
            total: currentSale.total,
            vat_total: currentSale.vatTotal,
            vatTotal: currentSale.vatTotal,
            discount_total: currentSale.discountTotal,
            discountTotal: currentSale.discountTotal,
            subtotal: currentSale.subtotal || (currentSale.total - currentSale.vatTotal),
            payment_method: currentSale.payments.length > 0 ? currentSale.payments[0].method : 'cash',
            payments: currentSale.payments,
            items: currentSale.items,
            status: 'COMPLETED',
            created_at: currentSale.timestamp || new Date().toISOString(),
            business_id: bizId,
            branch_id: branchId,
            customer_id: currentSale.customerId || null,
            customerId: currentSale.customerId || null,
            customerName: currentSale.customerName || 'Walk-In Customer',
            syncStatus: 'pending',
            synced: false
          });

          // 2. Save items into Dexie sale_items table
          if (currentSale.items && currentSale.items.length > 0) {
            for (const item of currentSale.items) {
              await dexieDb.sale_items.put({
                id: crypto.randomUUID(),
                business_id: bizId,
                sale_id: currentSale.id,
                product_id: item.product.id,
                quantity: item.quantity,
                price: item.unitPrice,
                unit_price: item.unitPrice,
                line_total: item.subtotal,
                vat_amount: item.vatAmount || 0,
                syncStatus: 'pending'
              });

              // 3. Decrement stock in Dexie inventory & products, and record Stock Movement
              const mult = getItemPackSize(item);
              const dec = item.quantity * mult;
              try {
                // A. Update local Dexie products table
                const pRecord = await dexieDb.products.get(item.product.id);
                const currentStock = Number(pRecord?.stock || pRecord?.stock_quantity || item.product?.stock || 0);
                const newStock = Math.max(0, currentStock - dec);
                if (pRecord) {
                  await dexieDb.products.update(item.product.id, {
                    stock: newStock,
                    stock_quantity: newStock
                  });
                }

                // B. Update or create local Dexie inventory table entry
                const invRecords = await dexieDb.inventory.where('product_id').equals(item.product.id).toArray();
                let updatedInvQty = newStock;
                if (invRecords.length > 0) {
                  const firstInv = invRecords[0];
                  updatedInvQty = Math.max(0, (Number(firstInv.quantity) || 0) - dec);
                  await dexieDb.inventory.update(firstInv.id, {
                    quantity: updatedInvQty,
                    updated_at: new Date().toISOString()
                  });
                } else {
                  await dexieDb.inventory.put({
                    id: crypto.randomUUID(),
                    business_id: bizId,
                    branch_id: branchId || 'main_branch',
                    product_id: item.product.id,
                    quantity: updatedInvQty,
                    reorder_level: 5,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    syncStatus: 'pending'
                  });
                }

                // C. Record stock movement in Dexie stock_movements table
                const movementId = crypto.randomUUID();
                const movementRecord = {
                  id: movementId,
                  business_id: bizId,
                  branch_id: branchId || 'main_branch',
                  product_id: item.product.id,
                  quantity: -dec, // Negative reflects stock deduction from sale
                  type: 'SALE',
                  notes: `Sale Receipt #${currentSale.receiptNumber} (${item.quantity} x ${item.product.name})`,
                  reference_id: currentSale.id,
                  created_at: currentSale.timestamp || new Date().toISOString(),
                  syncStatus: 'pending'
                };
                await dexieDb.stock_movements.put(movementRecord);

                // D. Add to Offline Sync Queue
                await dexieDb.offlineQueue.put({
                  id: crypto.randomUUID(),
                  type: 'stock_movements:save',
                  recordId: movementId,
                  payload: movementRecord,
                  timestamp: Date.now(),
                  retryCount: 0,
                  status: 'pending',
                  priority: 'normal'
                });

                // E. Real-time Cloud update if online
                if (typeof navigator !== 'undefined' && navigator.onLine) {
                  // Push stock movement to cloud
                  try {
                    await supabase.from('stock_movements').insert([movementRecord]);
                  } catch (err) {
                    console.warn('Live stock movement insert deferred:', err);
                  }

                  // Update product stock in cloud
                  try {
                    await supabase.from('products').update({
                      stock: newStock,
                      stock_quantity: newStock,
                      updated_at: new Date().toISOString()
                    }).eq('id', item.product.id);
                  } catch (err) {
                    console.warn('Live product stock update deferred:', err);
                  }

                  // Update inventory row in Supabase
                  (async () => {
                    try {
                      let invQ = supabase.from('inventory').select('id, quantity').eq('product_id', item.product.id);
                      if (branchId) invQ = invQ.eq('branch_id', branchId);
                      const { data: invRows } = await invQ.limit(1);
                      if (invRows && invRows.length > 0) {
                        const targetInvId = invRows[0].id;
                        const remoteQty = Math.max(0, (Number(invRows[0].quantity) || 0) - dec);
                        await supabase.from('inventory').update({
                          quantity: remoteQty,
                          updated_at: new Date().toISOString()
                        }).eq('id', targetInvId);
                      } else {
                        await supabase.from('inventory').insert([{
                          id: crypto.randomUUID(),
                          business_id: bizId,
                          branch_id: branchId || 'main_branch',
                          product_id: item.product.id,
                          quantity: newStock,
                          reorder_level: 5,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString()
                        }]);
                      }
                    } catch (invErr) {
                      console.warn('Live inventory update deferred:', invErr);
                    }
                  })();
                }
              } catch (stkErr) {
                console.error('[POS] Stock decrement and movement tracking error:', stkErr);
              }
            }
          }

          // 4. Record cash drawer logs in Dexie
          for (const p of currentSale.payments) {
            try {
              await dexieDb.cash_drawer_logs.put({
                id: crypto.randomUUID(),
                business_id: bizId,
                branch_id: branchId,
                amount: p.amount,
                type: p.method === 'credit' ? 'receivable' : 'cash',
                transaction_type: p.method + '_sale',
                payment_method: p.method,
                notes: `Offline Sale ${currentSale.receiptNumber} - ${p.method}`,
                linked_document_id: currentSale.id,
                linked_document_type: 'sale',
                created_at: currentSale.timestamp || new Date().toISOString(),
                syncStatus: 'pending'
              });
            } catch (logErr) {}
          }

          // 5. Update shift in Dexie register_sessions table
          if (activeSession?.id) {
            try {
              const existingSess = await dexieDb.register_sessions.get(activeSession.id);
              const updatedSess = {
                ...(existingSess || activeSession),
                id: activeSession.id,
                business_id: bizId,
                sales_total: Number(activeSession.sales_total || 0) + currentSale.total,
                sales_count: Number(activeSession.sales_count || 0) + 1,
                expected_balance: Number(activeSession.expected_balance || activeSession.opening_balance || 0) + currentSale.total,
                cogs_total: Number(activeSession.cogs_total || 0) + saleCogsVal,
                updated_at: new Date().toISOString()
              };
              await dexieDb.register_sessions.put(updatedSess);
            } catch (sessErr) {}
          }

          // 6. Ensure queued in posStore and dexieDb.offlineQueue
          const offlineSale = { ...currentSale, status: 'offline_pending' as const, business_id: bizId, branch_id: branchId };
          usePOSStore.setState((s: any) => {
            const exists = s.offlineQueue.some((q: any) => q.id === currentSale.id || q.receiptNumber === currentSale.receiptNumber);
            return {
              offlineQueue: exists ? s.offlineQueue : [...s.offlineQueue, offlineSale]
            };
          });

          await dexieDb.offlineQueue.put({
            id: crypto.randomUUID(),
            type: 'sales:save',
            recordId: currentSale.id,
            payload: {
              id: currentSale.id,
              receipt_number: currentSale.receiptNumber,
              receiptNumber: currentSale.receiptNumber,
              total: currentSale.total,
              vat_total: currentSale.vatTotal,
              discount_total: currentSale.discountTotal,
              subtotal: currentSale.subtotal,
              payment_method: currentSale.payments.length > 0 ? currentSale.payments[0].method : 'cash',
              payments: currentSale.payments,
              items: currentSale.items,
              status: 'COMPLETED',
              created_at: currentSale.timestamp,
              business_id: bizId,
              branch_id: branchId,
              customer_id: currentSale.customerId
            },
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending',
            priority: 'high'
          });

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('inventory-update-needed'));
            window.dispatchEvent(new Event('offline-mode-changed'));
          }
        } catch (offlineErr) {
          console.error('[POS] Error in persistOfflineSale:', offlineErr);
        }
      };

      // Precalculate perpetual COGS for this sale
      let saleCogs = 0;
      if (sale.items && sale.items.length > 0) {
        for (const item of sale.items) {
          if (item.product?.bundles && item.product.bundles.length > 0) {
            for (const comp of item.product.bundles) {
              const compCostPrice = Number(comp.costPrice || comp.cost_price || 0);
              saleCogs += (compCostPrice * Number(comp.quantity || 1) * Number(item.quantity || 1));
            }
          } else {
            const multiplier = getItemPackSize(item);
            const itemCost = Number(item.product?.costPrice || item.product?.cost_price || item.costPrice || item.cost_price || 0);
            saleCogs += (itemCost * Number(item.quantity || 1) * multiplier);
          }
        }
      }

      // OFFLINE-FIRST: Record all transactions offline locally by default.
      // Remote cloud sync is triggered manually by user when internet is restored.
      await persistOfflineSale(sale, saleCogs);
    }
  };

  // Filtered catalogue products search match
  const filteredProducts = products.filter(product => {
    const isCatMatch = activeCategory === 'all' || product.category === activeCategory;
    const lowerSearch = searchTerm.toLowerCase();
    const isPackMatch = getPackSize(product.sku) > 1 && ("pack".includes(lowerSearch) || "wholesale".includes(lowerSearch));
    const isBundleMatch = product.bundles && product.bundles.some((b: any) => b.name.toLowerCase().includes(lowerSearch));
    const isSearchMatch = 
      product.name.toLowerCase().includes(lowerSearch) || 
      product.sku.toLowerCase().includes(lowerSearch) || 
      product.barcode.includes(lowerSearch) ||
      isPackMatch ||
      isBundleMatch;
    return isCatMatch && isSearchMatch;
  });

  // Resolution scaler calculation
  const scaleRatio = parseFloat(posScale) / 100;
  const scaleStyle: React.CSSProperties = scaleRatio !== 1 ? (
    scaleMode === 'zoom' ? {
      // @ts-ignore - zoom is non-standard but fully supported on Chrome/WebView
      zoom: scaleRatio,
      width: '100%',
      height: '100%',
    } : scaleMode === 'transform' ? {
      transform: `scale(${scaleRatio})`,
      transformOrigin: 'top left',
      width: `${100 / scaleRatio}%`,
      height: `${100 / scaleRatio}%`,
    } : {}
  ) : {};

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

  // First Dashboard for POS: Registers and Shifts log
  if (viewingDashboard) {
    return (
      <ShiftsDashboard
        activeSession={activeSession}
        setActiveSession={setActiveSession}
        refreshActiveSession={refreshActiveSession}
        onEnterCheckout={(session) => {
          setViewingDashboard(false);
        }}
        openingFloat={openingFloat}
        setOpeningFloat={setOpeningFloat}
        requireFloat={requireFloat}
        setRequireFloat={setRequireFloat}
        handleStartShift={handleStartShift}
      />
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
        onClose={() => setViewingDashboard(true)}
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

      <div 
        className={cn(
          "flex-1 flex flex-col md:flex-row h-full md:h-full md:max-h-full gap-4 pb-1 overflow-hidden pos-scale-container",
          hardwareOptimize && "pos-hw-optimized",
          touchOptimized && "pos-touch-optimized"
        )}
        style={scaleStyle}
      >
        
        {/* LEFT COLUMN: Products & Search */}
        <div className={cn("flex-1 flex flex-col h-full overflow-hidden animate-fade-in", activeMobileTab !== 'catalog' && "hidden md:flex")}>
          
          {/* Header toolbar */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">Point of Sale</h1>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-bold border border-zinc-200 dark:border-zinc-700" title="Offline-first POS: all transactions are recorded locally by default">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Offline-First
                </span>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 animate-pulse">
                    No Internet
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSync}
                disabled={isManualSyncing || !isOnline}
                className={cn(
                  "text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-none transition-all cursor-pointer",
                  offlineQueue.length > 0
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                    : "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                )}
                title={isOnline ? "Manually sync all offline transactions to cloud" : "Connect to internet to sync data"}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isManualSyncing && "animate-spin")} />
                <span>
                  {isManualSyncing 
                    ? "Syncing..." 
                    : offlineQueue.length > 0 
                      ? `Sync Data to Online (${offlineQueue.length})` 
                      : "Sync Data to Online"}
                </span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowChangeNotes(true)}
                className={cn(
                  "text-xs shadow-none cursor-pointer rounded-xl font-extrabold flex items-center gap-1.5 transition-all",
                  unclaimedChangeCount > 0 
                    ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100" 
                    : "border-zinc-200 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                )}
                title="Customer Left Changes Notes"
              >
                <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Left Changes</span>
                {unclaimedChangeCount > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {unclaimedChangeCount}
                  </span>
                )}
              </Button>
              <TransactionHistoryManager 
                activeSession={activeSession}
                setActiveSession={setActiveSession}
                userId={(activeSession as any)?.user_id || (activeSession as any)?.cashier_id || 'unknown'}
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setViewingDashboard(true)}
                className="border-indigo-200 bg-indigo-50/25 text-indigo-650 dark:border-indigo-900 dark:bg-indigo-950/20 dark:text-indigo-400 text-xs shadow-none cursor-pointer rounded-xl font-extrabold hover:bg-indigo-100/45 flex items-center gap-1"
                title="Return to Shifts & Registers Dashboard"
              >
                <Layout className="w-3.5 h-3.5 text-indigo-500" />
                <span>Shifts Dashboard</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowHwSettings(true)}
                className="border-blue-200 bg-blue-50/25 text-blue-600 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-400 text-xs shadow-none cursor-pointer rounded-xl font-extrabold hover:bg-blue-100/40 flex items-center gap-1"
                title="POS Hardware & Screen Resolution Optimizer"
              >
                <Sliders className="w-3.5 h-3.5 text-blue-500" />
                <span>Optimize Display</span>
              </Button>
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

      {/* POS HARDWARE & DISPLAY OPTIMIZER MODAL */}
      <POSHardwareSettingsDialog
        open={showHwSettings}
        onOpenChange={setShowHwSettings}
        posScale={posScale}
        setPosScale={setPosScale}
        hardwareOptimize={hardwareOptimize}
        setHardwareOptimize={setHardwareOptimize}
        touchOptimized={touchOptimized}
        setTouchOptimized={setTouchOptimized}
        hideHeader={hideHeader}
        setHideHeader={setHideHeader}
        scaleMode={scaleMode}
        setScaleMode={setScaleMode}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
      />

      {/* Customer Left Changes Tracker Modal */}
      <CustomerChangeNotes
        open={showChangeNotes}
        onOpenChange={setShowChangeNotes}
      />
    </div>
  );
}
