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

import { usePOSStore, Product, SaleRecord, Customer } from '../store/posStore';
import { PaymentDialog } from '../components/pos/PaymentDialog';
import { ReceiptPrint } from '../components/pos/ReceiptPrint';
import { supabase } from '../lib/supabase';

export default function POS() {
  const { 
    cart, getTotals, addToCart, removeFromCart, updateQuantity, pricingTier, setPricingTier, 
    clearCart, completeSale, currentCustomer, setCurrentCustomer, parkSale, parkedSales, resumeSale,
    applyGlobalDiscount
  } = usePOSStore();
  
  const totals = getTotals();

  const [searchTerm, setSearchTerm] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showPostSale, setShowPostSale] = useState(false);
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const shouldPrintRef = useRef(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [categories, setCategories] = useState<{id: string, name: string, icon: any}[]>([
    { id: 'all', name: 'All Menu', icon: <Package className="w-5 h-5" /> },
    { id: 'beverages', name: 'Beverages', icon: <ShoppingCart className="w-5 h-5" /> }, // Use ShoppingCart instead of Coffee
    { id: 'snacks', name: 'Snacks', icon: <Tag className="w-5 h-5" /> },
    { id: 'pharmacy', name: 'Pharmacy', icon: <HelpCircle className="w-5 h-5" /> }, // Use HelpCircle instead of Pill
  ]);

  const receiptRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch products and customers from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Using mock data as fallback if no real data exists or API errors out, 
        // given this is a preview environment heavily reliant on Supabase correctly migrating.
        let productsData: any[] | null = null;
        let customersData: any[] | null = null;
        
        try {
          const [{ data: pData }, { data: cData }] = await Promise.all([
            supabase.from('products').select('id, name, barcode, sku, retail_price, wholesale_price, tax_class').eq('is_active', true),
            supabase.from('customers').select('id, name, phone, email, address, balance, credit_limit')
          ]);
          productsData = pData;
          customersData = cData;
        } catch (e) {
          console.error("Supabase fetch failed", e);
        }

        if (productsData && productsData.length > 0) {
          setProducts(productsData.map(p => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode || '',
            sku: p.sku || '',
            retailPrice: p.retail_price,
            wholesalePrice: p.wholesale_price,
            taxClass: p.tax_class as any,
            category: p.category || 'all',
            imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&h=150&fit=crop', // Default image
          })));
        } else {
          // Fallback static mock data for demo if DB is empty
          setProducts([
            { id: '1', name: 'Mazoe Orange Crush 2L', retailPrice: 4.50, wholesalePrice: 4.10, barcode: '600123456789', sku: 'BV-MOC-2L', taxClass: 'standard', category: 'beverages', imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&h=300&fit=crop' },
            { id: '2', name: 'Bakers Blue Label Marie 200g', retailPrice: 1.20, wholesalePrice: 1.05, barcode: '600987654321', sku: 'BK-MAR-200G', taxClass: 'standard', category: 'snacks', imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300&h=300&fit=crop' },
            { id: '3', name: 'Panadol 500mg 20s', retailPrice: 2.50, wholesalePrice: 2.10, barcode: '500123456', sku: 'MD-PAN-500MG', taxClass: 'exempt', category: 'pharmacy', imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5e4a8dfd1?w=300&h=300&fit=crop' },
            { id: '4', name: 'Coca-Cola 330ml Can', retailPrice: 0.80, wholesalePrice: 0.65, barcode: '5449000000996', sku: 'BV-COK-330ML', taxClass: 'standard', category: 'beverages', imageUrl: 'https://images.unsplash.com/photo-1622483767851-4602f23b2c65?w=300&h=300&fit=crop' },
            { id: '5', name: 'Willards Things 150g', retailPrice: 1.50, wholesalePrice: 1.30, barcode: '6002345678912', sku: 'SN-WIL-150G', taxClass: 'standard', category: 'snacks', imageUrl: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=300&h=300&fit=crop' },
            { id: '6', name: 'Paracetamol 100s', retailPrice: 5.00, wholesalePrice: 4.00, barcode: '500987654', sku: 'MD-PAR-100S', taxClass: 'exempt', category: 'pharmacy', imageUrl: 'https://images.unsplash.com/photo-1596562479577-ba8bd5b5f25a?w=300&h=300&fit=crop' },
            { id: '7', name: 'Lays Salt & Vinegar 120g', retailPrice: 2.00, wholesalePrice: 1.80, barcode: '6002345671234', sku: 'SN-LAY-120G', taxClass: 'standard', category: 'snacks', imageUrl: 'https://images.unsplash.com/photo-1566478989037-eade2e597c55?w=300&h=300&fit=crop' },
            { id: '8', name: 'Sprite 2L', retailPrice: 2.20, wholesalePrice: 1.95, barcode: '5449000123456', sku: 'BV-SPR-2L', taxClass: 'standard', category: 'beverages', imageUrl: 'https://images.unsplash.com/photo-1625772299848-3a8309df07eb?w=300&h=300&fit=crop' },
          ]);
        }

        if (customersData && customersData.length > 0) {
          setCustomers(customersData.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone || '',
            email: c.email || '',
            address: c.address || '',
            balance: c.balance || 0,
            creditLimit: c.credit_limit || 0
          })));
        } else {
          setCustomers([
            { id: '1', name: 'John Doe Walk-in', balance: 0, creditLimit: 0 },
            { id: '2', name: 'Acme Supermarket', balance: 154.20, creditLimit: 1000 },
          ]);
        }
      } catch (err) {
        console.error("Error loading POS data: ", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 to focus search
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // F4 to toggle pricing tier
      if (e.key === 'F4') {
        e.preventDefault();
        setPricingTier(pricingTier === 'retail' ? 'wholesale' : 'retail');
      }
      // Space for payment ONLY if not typing in an input
      if (e.key === ' ' && document.activeElement?.tagName !== 'INPUT' && cart.length > 0) {
        e.preventDefault();
        setShowPayment(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pricingTier, setPricingTier, cart.length]);

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

  const handlePaymentComplete = () => {
    const sale = completeSale();
    if (sale) {
      setLastSale(sale);
      setShowPayment(false);
      setShowPostSale(true);
      toast.success('Sale Completed!');
      shouldPrintRef.current = true;
    } else {
      toast.error('Could not complete sale. Check balance.');
    }
  };

  useEffect(() => {
    if (lastSale && shouldPrintRef.current) {
      // Small timeout to ensure ReceiptPrint renders with lastSale
      setTimeout(() => {
        handlePrint();
        shouldPrintRef.current = false;
      }, 500);
    }
  }, [lastSale, handlePrint]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.barcode.includes(searchTerm) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] gap-4 pb-2">
      
      {/* LEFT COLUMN: Search & Cart */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        
        {/* Top Search Bar Area */}
        <div className="p-4 border-b border-zinc-200 bg-zinc-50/50">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-800">Point of Sale</h1>
            <div className="flex items-center gap-2">
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
                        <Card key={sale.id} className="cursor-pointer hover:bg-zinc-50" onClick={() => resumeSale(sale.id)}>
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
            {filteredProducts.map((product) => (
              <div 
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="group relative bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:shadow-md transition-all cursor-pointer flex flex-col hover:border-primary/50"
              >
                <div className="h-32 bg-zinc-100 relative overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-zinc-300" />
                    </div>
                  )}
                  {product.taxClass !== 'standard' && (
                    <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] bg-white/90 backdrop-blur-sm border-zinc-200">
                      {product.taxClass}
                    </Badge>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h4 className="font-semibold text-sm line-clamp-2 leading-tight mb-1">{product.name}</h4>
                  <p className="text-xs text-zinc-500 font-mono mb-2">{product.sku}</p>
                  
                  <div className="mt-auto flex items-center justify-between">
                    <span className="font-bold text-primary text-base">
                      ${(pricingTier === 'wholesale' ? product.wholesalePrice : product.retailPrice).toFixed(2)}
                    </span>
                    <Button size="icon" className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <span className="text-lg leading-none mt-[-2px]">+</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
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

        {/* Pricing Tier Toggle */}
        <Card className="border-zinc-200 shadow-sm shrink-0">
          <CardContent className="p-1 flex">
            <Button 
              variant={pricingTier === 'retail' ? 'default' : 'ghost'} 
              className={`flex-1 rounded-md ${pricingTier === 'retail' ? 'shadow-sm' : ''}`}
              onClick={() => setPricingTier('retail')}
            >
              Retail
            </Button>
            <Button 
              variant={pricingTier === 'wholesale' ? 'default' : 'ghost'} 
              className={`flex-1 rounded-md ${pricingTier === 'wholesale' ? 'shadow-sm bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
              onClick={() => setPricingTier('wholesale')}
            >
              Wholesale
            </Button>
          </CardContent>
        </Card>

        {/* Cart items list */}
        <Card className="border-zinc-200 shadow-sm shrink-0 max-h-[40vh] flex flex-col pt-4">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-8">
              <ShoppingCart className="h-10 w-10 text-zinc-300 mb-2" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 px-4 pb-4">
              <div className="space-y-3">
                {cart.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="flex justify-between items-center group">
                    <div className="flex flex-col flex-1">
                      <h4 className="text-sm font-bold leading-none mb-1 text-zinc-800 line-clamp-1 pr-2">{item.product.name}</h4>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-zinc-600">${item.unitPrice.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 border border-zinc-200 shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 hover:bg-white hover:shadow-sm rounded-md" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                        <span className="text-xs w-6 text-center font-bold font-mono text-zinc-800">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 hover:bg-white hover:shadow-sm rounded-md" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                      </div>
                      
                      <div className="flex flex-col items-end min-w-[60px]">
                        <span className="font-bold text-sm font-mono text-zinc-900">${(item.subtotal + item.vatAmount).toFixed(2)}</span>
                      </div>

                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => removeFromCart(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>

        {/* Totals Panel */}
        <Card className="flex-1 flex flex-col border-zinc-200 shadow-sm overflow-hidden">
          <CardContent className="p-0 flex flex-col h-full">
            <div className="flex-1 p-5 space-y-4 bg-white">
              <div className="flex justify-between text-zinc-600 items-baseline">
                <span className="text-sm">Subtotal ({cart.length} items)</span>
                <span className="font-mono text-base font-medium">${totals.subtotal.toFixed(2)}</span>
              </div>
              
              {totals.discount > 0 && (
                <div className="flex justify-between text-amber-600 items-baseline">
                  <span className="text-sm">Discount</span>
                  <span className="font-mono text-base font-medium">-${totals.discount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-zinc-600 items-baseline group cursor-help">
                <span className="text-sm flex items-center border-b border-dashed border-zinc-300 pb-0.5">
                  VAT (15%) <span className="ml-1 text-[10px] bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded text-zinc-500">ZIMRA</span>
                </span>
                <span className="font-mono text-base font-medium">${totals.vat.toFixed(2)}</span>
              </div>

              <Separator className="my-2" />

              <div className="pt-2">
                <div className="flex justify-between items-end">
                  <span className="text-lg font-semibold text-secondary">Total</span>
                  <span className="text-4xl font-extrabold tracking-tight font-mono text-primary">${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-200 space-y-3">
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 bg-white h-12" onClick={clearCart} disabled={cart.length === 0}>
                  Cancel
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1 bg-white h-12" disabled={cart.length === 0}>
                      <Tag className="w-4 h-4 mr-2" /> Discount
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
              </div>
              
              <Button 
                className="w-full h-16 text-xl font-bold shadow-lg transition-transform active:scale-[0.98] bg-primary text-secondary hover:bg-primary/90 relative overflow-hidden"
                disabled={cart.length === 0} 
                onClick={() => setShowPayment(true)}
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
                <span className="flex items-center">CHARGE <ArrowRightLeft className="ml-2 w-5 h-5 opacity-80" /></span>
                <span className="absolute right-6 font-mono font-extrabold">${totals.total.toFixed(2)}</span>
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

