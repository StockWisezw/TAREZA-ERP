import React from 'react';
import { 
  User, 
  UserPlus, 
  X, 
  ShoppingCart, 
  Trash2,
  Search
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from '../ui/dialog';
import { getPackSize, CartItem, Customer, usePOSStore } from '../../store/posStore';
import { cn } from '../../lib/utils';

interface CartSummaryProps {
  cart: CartItem[];
  currentCustomer: Customer | null;
  setCurrentCustomer: (c: Customer | null) => void;
  customers: Customer[];
  selectedCartItemId: string | null;
  setSelectedCartItemId: (id: string | null) => void;
  setIsNewInput: (val: boolean) => void;
  setItemPricingTier: (id: string, tier: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  parkSale: () => void;
  totals: any;
  vatEnabled: boolean;
  numpadMode?: 'qty' | 'disc' | 'price';
  setNumpadMode?: (mode: 'qty' | 'disc' | 'price') => void;
  handleNumpadKey?: (key: string) => void;
  isQuoteDialogOpen: boolean;
  setIsQuoteDialogOpen: (open: boolean) => void;
  quoteCustomerName: string;
  setQuoteCustomerName: (name: string) => void;
  quoteNotes: string;
  setQuoteNotes: (notes: string) => void;
  handleCreateQuotation: () => void;
  cartContainerRef: React.RefObject<HTMLDivElement>;
  setShowPayment: (show: boolean) => void;
  className?: string;
  pricingTier: 'retail' | 'wholesale';
  setPricingTier: (tier: 'retail' | 'wholesale') => void;
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  cart,
  currentCustomer,
  setCurrentCustomer,
  customers,
  selectedCartItemId,
  setSelectedCartItemId,
  setIsNewInput,
  setItemPricingTier,
  updateQuantity,
  removeFromCart,
  clearCart,
  parkSale,
  totals,
  vatEnabled,
  numpadMode,
  setNumpadMode,
  handleNumpadKey,
  isQuoteDialogOpen,
  setIsQuoteDialogOpen,
  quoteCustomerName,
  setQuoteCustomerName,
  quoteNotes,
  setQuoteNotes,
  handleCreateQuotation,
  cartContainerRef,
  setShowPayment,
  className,
  pricingTier,
  setPricingTier
}) => {
  const [customerSearch, setCustomerSearch] = React.useState('');

  React.useEffect(() => {
    if (cartContainerRef && cartContainerRef.current) {
      setTimeout(() => {
        if (cartContainerRef.current) {
          cartContainerRef.current.scrollTop = cartContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [cart.length, cartContainerRef]);

  return (
    <div className={cn("w-full md:w-[325px] lg:w-[400px] xl:w-[460px] flex flex-col gap-2 h-full overflow-hidden justify-between", className)}>
      
      {/* Customer Panel */}
      <Card className="border-zinc-200 shadow-sm shrink-0">
        <CardContent className="p-2">
          {currentCustomer ? (
            <div className="flex justify-between items-center bg-zinc-55/40 p-1.5 rounded-lg border border-zinc-150">
              <div>
                <h3 className="font-bold text-xs text-zinc-805 flex items-center gap-1">
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
              <Button variant="ghost" size="icon" onClick={() => setCurrentCustomer(null)} className="h-6 w-6 text-zinc-400 hover:text-zinc-600 p-0 rounded-lg cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Dialog onOpenChange={(open) => { if (!open) setCustomerSearch(''); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full h-8 text-xs border-dashed border-zinc-300 text-zinc-500 hover:text-zinc-950 hover:border-zinc-400 hover:bg-zinc-50 bg-white shadow-none cursor-pointer">
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Select Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white text-zinc-90 w max-w-sm rounded-2xl border-zinc-200">
                <DialogHeader>
                  <DialogTitle className="text-sm font-extrabold text-zinc-900">Select Customer Account</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                    <Input 
                      placeholder="Type name, ID, or phone..." 
                      className="pl-8.5 bg-zinc-55/60 text-xs h-9 border-zinc-205 rounded-xl placeholder:text-zinc-400"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
                    {(() => {
                      const list = customers.filter(c => 
                        c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                        (c.id && c.id.toLowerCase().includes(customerSearch.toLowerCase()))
                      );
                      if (list.length === 0) {
                        return <p className="text-center text-xs text-zinc-400 py-6">No matching customers found.</p>;
                      }
                      return list.map(c => (
                        <div 
                          key={c.id} 
                          className="flex justify-between items-center p-2.5 border border-zinc-150 rounded-xl hover:bg-indigo-50/20 hover:border-indigo-200/50 transition-all cursor-pointer" 
                          onClick={() => {
                            setCurrentCustomer(c);
                            setCustomerSearch('');
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-zinc-805">{c.name}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">Code: {c.id || 'N/A'}</span>
                          </div>
                          <span className="font-mono text-xs text-zinc-500 font-bold bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-100/50">Bal: ${c.balance.toFixed(2)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {/* Global Pricing Tier Switcher */}
      {(() => {
        const isPricingToggleEnabled = typeof window !== 'undefined' ? localStorage.getItem('tareza_pricing_toggle') !== 'false' : true;
        if (!isPricingToggleEnabled) return null;
        return (
          <div className="bg-zinc-100 p-1 rounded-xl border border-zinc-205 flex gap-1 text-[11px] font-bold shrink-0 shadow-sm">
            <button
              onClick={() => setPricingTier('retail')}
              className={cn(
                "flex-grow flex-1 py-1 px-3 rounded-lg text-center transition-all duration-150 cursor-pointer h-7 flex items-center justify-center",
                pricingTier === 'retail' 
                  ? "bg-white text-zinc-950 shadow-sm border border-zinc-200" 
                  : "text-zinc-500 hover:text-zinc-800"
              )}
            >
              Retail Sales Price
            </button>
            <button
              onClick={() => setPricingTier('wholesale')}
              className={cn(
                "flex-grow flex-1 py-1 px-3 rounded-lg text-center transition-all duration-150 cursor-pointer h-7 flex items-center justify-center",
                pricingTier === 'wholesale' 
                  ? "bg-purple-600 text-white shadow-sm font-bold border-0" 
                  : "text-zinc-500 hover:text-zinc-805"
              )}
            >
              Wholesale / Pack Price
            </button>
          </div>
        );
      })()}

      {/* Dynamic Interactive Shopping Cart items list container */}
      <Card className="border-zinc-200 shadow-sm flex-1 min-h-[300px] h-full flex flex-col pt-1.5 bg-white pb-1.5 rounded-xl overflow-hidden">
        {cart.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-zinc-400 p-3">
            <ShoppingCart className="h-7 w-7 text-zinc-300 mb-1.5" />
            <p className="text-xs font-semibold">Cart is currently empty</p>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div ref={cartContainerRef} className="flex-1 overflow-y-auto px-2.5 scroll-smooth">
              <div className="space-y-0.5">
                {cart.map((item, index) => {
                  const isSelected = selectedCartItemId === item.id;
                  return (
                    <div 
                      key={`${item.id}-${index}`} 
                      onClick={() => {
                        setSelectedCartItemId(item.id);
                        setIsNewInput(true);
                      }}
                      className={`flex justify-between items-center py-0.5 px-1.5 rounded-md border transition-all cursor-pointer group ${
                        isSelected 
                          ? 'border-zinc-950 ring-1 ring-zinc-950/5 bg-zinc-50/10' 
                          : 'border-zinc-100 hover:border-zinc-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col flex-1 min-w-0 pr-1">
                        <h4 className={`text-[10px] font-extrabold leading-tight line-clamp-1 ${isSelected ? 'text-zinc-950 font-black' : 'text-zinc-800'}`}>
                          {item.product.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[9px] text-zinc-500 font-mono">
                          <span className="font-bold text-zinc-650">${item.unitPrice.toFixed(2)}</span>
                          {item.discount && item.discount.value > 0 && (
                            <span className="text-rose-600 font-bold bg-rose-50 px-1 rounded text-[8px]">
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
                              }}
                              className="bg-zinc-50 border border-zinc-200 text-zinc-700 text-[8px] font-bold py-0.5 px-0.5 rounded cursor-pointer max-w-[80px] h-4.5 focus:outline-none"
                            >
                              <option value="retail">Unit</option>
                              {getPackSize(item.product.sku) > 1 && (
                                <option value="wholesale">Pack ({getPackSize(item.product.sku)})</option>
                              )}
                              {item.product.bundles?.map((b: any, bIdx: number) => (
                                <option key={bIdx} value={b.name}>{b.name}</option>
                              ))}
                            </select>
                          )}
                          
                          <div className="flex items-center gap-0.5 border-l border-zinc-250 pl-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[8px] text-zinc-400 font-bold">P:</span>
                            <input 
                              type="number"
                              step="any"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                  usePOSStore.setState((s: any) => ({
                                    cart: s.cart.map((cartItem: any) => cartItem.id === item.id ? { ...cartItem, unitPrice: val } : cartItem)
                                  }));
                                }
                              }}
                              className="w-[38px] h-3.5 text-center text-[9px] font-bold font-mono border border-zinc-200 bg-zinc-50 hover:bg-white focus:bg-white rounded p-0 text-zinc-900 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[8px] text-zinc-400 font-bold">D%:</span>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount?.value || 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                const applyItemDiscount = usePOSStore.getState().applyItemDiscount;
                                if (!isNaN(val)) {
                                  applyItemDiscount(item.id, { type: 'percentage', value: Math.min(100, Math.max(0, val)) });
                                } else {
                                  applyItemDiscount(item.id, { type: 'percentage', value: 0 });
                                }
                              }}
                              className="w-[28px] h-3.5 text-center text-[9px] font-bold font-mono border border-zinc-200 bg-zinc-50 hover:bg-white focus:bg-white rounded p-0 text-zinc-900 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">
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
                            className="w-7 h-4.5 text-center text-[9px] font-black font-mono border border-zinc-250 bg-zinc-50 rounded focus:bg-white text-zinc-900 p-0 focus:outline-none"
                          />
                          <div className="flex flex-col gap-0 border-l border-zinc-150 pl-0.5">
                            <button 
                              className="h-2.5 w-2.5 flex items-center justify-center bg-zinc-100 text-zinc-700 text-[6px] hover:bg-zinc-200 rounded"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              +
                            </button>
                            <button 
                              className="h-2.5 w-2.5 flex items-center justify-center bg-zinc-100 text-zinc-700 text-[6px] hover:bg-zinc-200 rounded"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              -
                            </button>
                          </div>
                        </div>
                        
                        <div className="text-right min-w-[45px]">
                          <span className="font-bold text-[10px] font-mono text-zinc-900">${(item.subtotal + item.vatAmount).toFixed(2)}</span>
                        </div>

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 text-red-500 hover:text-red-700 hover:bg-rose-50 rounded p-0 shrink-0 cursor-pointer" 
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="text-[9px] text-zinc-500 text-center select-none font-medium mt-1 leading-none py-1 border-t border-zinc-100 bg-zinc-50/70 rounded-b-xl flex items-center justify-center gap-1.5 shrink-0">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Adjust Quantity, Price & Discount directly for any cart row.
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
        <Separator className="my-1 border-zinc-150" />
        <div className="flex justify-between items-end">
          <span className="text-xs font-bold text-zinc-700">Total to Pay</span>
          <span className="text-xl font-black font-mono text-zinc-950 leading-none">
            ${totals.total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Professional Direct Action Checkout Panel */}
      <div className="flex flex-col gap-2 p-2 bg-zinc-50/50 border border-zinc-200 rounded-xl shadow-inner shrink-0">
        
        {/* Row 1: Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button 
            variant="outline" 
            onClick={clearCart} 
            disabled={cart.length === 0}
            className="h-10 text-[11px] font-bold text-rose-650 border-rose-200 bg-white hover:bg-rose-50/50 rounded-xl transition-colors cursor-pointer shadow-none flex items-center justify-center gap-1"
            title="Cancel sale / Clear order items"
          >
            🗑️ Clear
          </Button>

          <Button 
            variant="outline" 
            onClick={parkSale} 
            disabled={cart.length === 0}
            className="h-10 text-[11px] font-bold text-zinc-705 border-zinc-200 bg-white hover:bg-zinc-100 rounded-xl transition-all cursor-pointer shadow-none flex items-center justify-center gap-1"
            title="Put items on hold"
          >
            ⏸️ Hold
          </Button>

          <Dialog open={isQuoteDialogOpen} onOpenChange={(open) => {
            setIsQuoteDialogOpen(open);
            if (open) {
              setQuoteCustomerName(currentCustomer?.name || '');
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                disabled={cart.length === 0}
                className="h-10 text-[11px] font-bold text-blue-600 border-blue-200 bg-white hover:bg-blue-50/50 rounded-xl transition-all shadow-none flex items-center justify-center gap-1 cursor-pointer"
                title="Generate a Proforma Quotation/Estimate"
              >
                📄 Quote
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white text-zinc-90 w">
              <DialogHeader>
                <DialogTitle className="text-sm font-extrabold text-zinc-900">Generate Proforma Quotation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-650">Customer Name / Direct Billing ID</label>
                  <Input 
                    value={quoteCustomerName}
                    onChange={e => setQuoteCustomerName(e.target.value)}
                    placeholder="e.g. Acme Corporation Ltd or John Doe" 
                    className="bg-white border-zinc-200 h-10 text-zinc-900"
                  />
                  <p className="text-[10px] text-zinc-400">If customer was selected on POS main, their name is pre-loaded automatically.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-650">Quotation Terms & Notes</label>
                  <Input 
                    value={quoteNotes}
                    onChange={e => setQuoteNotes(e.target.value)}
                    placeholder="e.g. Estimate valid for 30 days." 
                    className="bg-white border-zinc-200 h-10 text-zinc-900"
                  />
                </div>

                <div className="bg-zinc-50 border rounded-xl p-3 text-xs text-zinc-700 space-y-2">
                  <div className="flex justify-between">
                    <span>Line Items:</span>
                    <span className="font-semibold text-zinc-800">{cart.length} product(s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Items Quantity:</span>
                    <span className="font-semibold text-zinc-800">{cart.reduce((sum, item) => sum + item.quantity, 0)} units</span>
                  </div>
                  <Separator className="my-1.5 border-zinc-150" />
                  <div className="flex justify-between font-bold text-sm text-zinc-900">
                    <span>Estimated Total Cost:</span>
                    <span className="font-mono text-zinc-950">${totals.total.toFixed(2)} USD</span>
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-[11px] text-blue-800 flex items-start gap-2">
                  <span className="mt-0.5 font-bold">ℹ</span>
                  <span>Quotations do not hold or deduct stock inventory, and do not process cash or ledger payments. They are proforma only.</span>
                </div>
              </div>
              <DialogFooter className="bg-zinc-50 dark:bg-zinc-900 p-4 border-t border-zinc-100 dark:border-zinc-800 -mx-6 -mb-6 mt-4 flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsQuoteDialogOpen(false)}
                  className="rounded-xl grow text-xs font-bold select-none cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateQuotation}
                  className="bg-zinc-900 hover:bg-zinc-805 dark:bg-zinc-100 dark:hover:bg-zinc-250 text-white dark:text-zinc-950 rounded-xl grow text-xs font-bold select-none cursor-pointer"
                >
                  Save Quote Draft
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Row 2: Proceed Payment Button */}
        <Button 
          onClick={() => setShowPayment(true)} 
          disabled={cart.length === 0}
          className="w-full h-14 text-xs font-extrabold uppercase leading-none shadow-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 rounded-xl flex items-center justify-between px-4 transition-all disabled:opacity-50 select-none cursor-pointer mt-1"
        >
          <div className="flex flex-col items-start gap-0.5 text-left">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Checkout Bill</span>
            <span className="text-xs font-black">Proceed To Payment</span>
          </div>
          <span className="text-base font-black font-mono tracking-tight bg-white/10 px-3 py-1 rounded-lg">
            ${totals.total.toFixed(2)}
          </span>
         </Button>
      </div>
      
    </div>
  );
};
