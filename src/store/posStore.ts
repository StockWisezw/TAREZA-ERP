import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type Product = {
  id: string;
  name: string;
  barcode: string;
  sku: string;
  retailPrice: number;
  wholesalePrice: number;
  taxClass: 'standard' | 'zero' | 'exempt';
  category?: string;
  imageUrl?: string;
  stock?: number;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit: number;
  balance: number;
};

export type Discount = {
  type: 'percentage' | 'fixed';
  value: number;
  reason?: string;
};

export type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number; // dynamically set based on tier
  subtotal: number;
  vatAmount: number;
  discount?: Discount;
};

export type PaymentMethod = 'cash' | 'card' | 'ecocash' | 'usd_cash' | 'credit';

export type Payment = {
  id: string;
  method: PaymentMethod;
  amount: number;
};

export type PricingTier = 'retail' | 'wholesale';

export type SaleRecord = {
  id: string;
  items: CartItem[];
  payments: Payment[];
  subtotal: number;
  vatTotal: number;
  discountTotal: number;
  total: number;
  timestamp: string;
  status: 'offline_pending' | 'synced' | 'parked' | 'refunded' | 'partially_refunded';
  receiptNumber: string;
  customerId?: string;
};

interface POSState {
  cart: CartItem[];
  pricingTier: PricingTier;
  payments: Payment[];
  offlineQueue: SaleRecord[];
  parkedSales: SaleRecord[];
  currentCustomer: Customer | null;
  globalDiscount?: Discount;
  
  // Actions
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  applyItemDiscount: (itemId: string, discount: Discount) => void;
  applyGlobalDiscount: (discount: Discount) => void;
  setPricingTier: (tier: PricingTier) => void;
  setCurrentCustomer: (customer: Customer | null) => void;
  addPayment: (method: PaymentMethod, amount: number) => void;
  removePayment: (paymentId: string) => void;
  clearCart: () => void;
  parkSale: () => void;
  resumeSale: (saleId: string) => void;
  completeSale: () => SaleRecord | null;
  getTotals: () => { subtotal: number; vat: number; discount: number; total: number; amountPaid: number; balance: number };
  removeSaleFromOfflineQueue: (saleId: string) => void;
  clearOfflineQueue: () => void;
}

// Fixed 15% VAT for standard items in Zimbabwe
const VAT_RATE = 0.15;

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      cart: [],
      pricingTier: 'retail',
      payments: [],
      offlineQueue: [],
      parkedSales: [],
      currentCustomer: null,

      addToCart: (product, quantity = 1) => set((state) => {
        const existingItem = state.cart.find((item) => item.product.id === product.id);
        const unitPrice = state.pricingTier === 'wholesale' ? product.wholesalePrice : product.retailPrice;
        
        if (existingItem) {
          const newQty = existingItem.quantity + quantity;
          const subtotal = newQty * unitPrice;
          let itemDiscountValue = 0;
          if (existingItem.discount) {
            itemDiscountValue = existingItem.discount.type === 'percentage' 
              ? subtotal * (existingItem.discount.value / 100) 
              : existingItem.discount.value;
          }
          const vatAmount = product.taxClass === 'standard' ? (subtotal - itemDiscountValue) * VAT_RATE : 0;
          
          return {
            cart: state.cart.map((item) =>
              item.id === existingItem.id
                ? { ...item, quantity: newQty, subtotal, vatAmount, unitPrice }
                : item
            ),
          };
        }

        const subtotal = quantity * unitPrice;
        const vatAmount = product.taxClass === 'standard' ? subtotal * VAT_RATE : 0;

        return {
          cart: [...state.cart, { id: uuidv4(), product, quantity, unitPrice, subtotal, vatAmount }],
        };
      }),

      removeFromCart: (itemId) => set((state) => ({
        cart: state.cart.filter((item) => item.id !== itemId),
      })),

      updateQuantity: (itemId, quantity) => set((state) => {
        if (quantity <= 0) {
          return { cart: state.cart.filter((item) => item.id !== itemId) };
        }
        return {
          cart: state.cart.map((item) => {
            if (item.id === itemId) {
              const subtotal = quantity * item.unitPrice;
              let itemDiscountValue = 0;
              if (item.discount) {
                itemDiscountValue = item.discount.type === 'percentage' 
                  ? subtotal * (item.discount.value / 100) 
                  : item.discount.value;
              }
              const vatAmount = item.product.taxClass === 'standard' ? Math.max(0, subtotal - itemDiscountValue) * VAT_RATE : 0;
              return { ...item, quantity, subtotal, vatAmount };
            }
            return item;
          }),
        };
      }),

      applyItemDiscount: (itemId, discount) => set((state) => {
        return {
          cart: state.cart.map((item) => {
            if (item.id === itemId) {
              let itemDiscountValue = discount.type === 'percentage' 
                ? item.subtotal * (discount.value / 100) 
                : discount.value;
              const vatAmount = item.product.taxClass === 'standard' ? Math.max(0, item.subtotal - itemDiscountValue) * VAT_RATE : 0;
              return { ...item, discount, vatAmount };
            }
            return item;
          }),
        };
      }),

      applyGlobalDiscount: (discount) => set({ globalDiscount: discount }),

      setPricingTier: (tier) => set((state) => {
        const updatedCart = state.cart.map(item => {
          const unitPrice = tier === 'wholesale' ? item.product.wholesalePrice : item.product.retailPrice;
          const subtotal = item.quantity * unitPrice;
          let itemDiscountValue = 0;
          if (item.discount) {
            itemDiscountValue = item.discount.type === 'percentage' 
              ? subtotal * (item.discount.value / 100) 
              : item.discount.value;
          }
          const vatAmount = item.product.taxClass === 'standard' ? Math.max(0, subtotal - itemDiscountValue) * VAT_RATE : 0;
          return { ...item, unitPrice, subtotal, vatAmount };
        });
        return { pricingTier: tier, cart: updatedCart };
      }),

      setCurrentCustomer: (customer) => set({ currentCustomer: customer }),

      addPayment: (method, amount) => set((state) => ({
        payments: [...state.payments, { id: uuidv4(), method, amount }]
      })),

      removePayment: (paymentId) => set((state) => ({
        payments: state.payments.filter((p) => p.id !== paymentId)
      })),

      clearCart: () => set({ cart: [], payments: [], currentCustomer: null, globalDiscount: undefined }),

      parkSale: () => {
        const state = get();
        if (state.cart.length === 0) return;
        
        const totals = state.getTotals();
        const parked: SaleRecord = {
          id: uuidv4(),
          items: [...state.cart],
          payments: [...state.payments],
          subtotal: totals.subtotal,
          vatTotal: totals.vat,
          discountTotal: totals.discount,
          total: totals.total,
          timestamp: new Date().toISOString(),
          status: 'parked',
          receiptNumber: `PRK-${Math.floor(Date.now() / 1000).toString(16).toUpperCase()}`,
          customerId: state.currentCustomer?.id,
        };

        set((s) => ({
          parkedSales: [...s.parkedSales, parked],
          cart: [],
          payments: [],
          currentCustomer: null,
          globalDiscount: undefined
        }));
      },

      resumeSale: (saleId) => {
        const state = get();
        const sale = state.parkedSales.find(s => s.id === saleId);
        if (!sale) return;

        set((s) => ({
          cart: sale.items,
          payments: sale.payments,
          parkedSales: s.parkedSales.filter(p => p.id !== saleId),
          // Simplified, ideally you'd load the full customer object if needed
        }));
      },

      getTotals: () => {
        const { cart, payments, globalDiscount } = get();
        
        let subtotal = 0;
        let totalDiscount = 0;
        let totalVat = 0;

        cart.forEach(item => {
          subtotal += item.subtotal;
          let itemDiscount = 0;
          if (item.discount) {
            itemDiscount = item.discount.type === 'percentage' 
              ? item.subtotal * (item.discount.value / 100) 
              : item.discount.value;
            totalDiscount += itemDiscount;
          }
          totalVat += item.vatAmount;
        });

        let finalSubtotal = subtotal - totalDiscount;

        if (globalDiscount) {
          const gDiscountValue = globalDiscount.type === 'percentage'
            ? finalSubtotal * (globalDiscount.value / 100)
            : globalDiscount.value;
          totalDiscount += gDiscountValue;
          finalSubtotal -= gDiscountValue;
          // Note: Apportioning global discount to VAT items is complex in real life, simplified here.
        }

        const total = finalSubtotal + totalVat;
        const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        const balance = total - amountPaid;
        
        return { subtotal, vat: totalVat, discount: totalDiscount, total, amountPaid, balance };
      },

      completeSale: () => {
        const state = get();
        const totals = state.getTotals();
        
        if (state.cart.length === 0 || totals.balance > 0.01) return null;

        const newSale: SaleRecord = {
          id: uuidv4(),
          items: [...state.cart],
          payments: [...state.payments],
          subtotal: totals.subtotal,
          vatTotal: totals.vat,
          discountTotal: totals.discount,
          total: totals.total,
          timestamp: new Date().toISOString(),
          status: 'offline_pending',
          receiptNumber: `RCPT-${Math.floor(Date.now() / 1000).toString(16).toUpperCase()}`,
          customerId: state.currentCustomer?.id,
        };

        set((state) => ({
          offlineQueue: [...state.offlineQueue, newSale],
          cart: [],
          payments: [],
          currentCustomer: null,
          globalDiscount: undefined
        }));

        return newSale;
      },

      removeSaleFromOfflineQueue: (saleId) => set((state) => ({
        offlineQueue: state.offlineQueue.filter((sale) => sale.id !== saleId)
      })),

      clearOfflineQueue: () => set({ offlineQueue: [] })
    }),
    {
      name: 'tareza-pos-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
