import { describe, it, expect } from 'vitest';

export interface CartTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

/**
 * Cart math calculations utility function
 */
export function calculateCartTotals(
  items: CartItem[], 
  globalDiscountAmount: number, 
  taxRatePercent: number
): CartTotals {
  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  // Make sure we never discount below zero
  const discount = Math.min(globalDiscountAmount, subtotal);
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = taxableAmount * (taxRatePercent / 100);
  const total = taxableAmount + tax;

  return {
    subtotal,
    discount,
    tax,
    total
  };
}

/**
 * Text or percentage based discount apply helper
 */
export function applyDiscount(price: number, discountExpr: string): number {
  if (discountExpr.endsWith('%')) {
    const pct = parseFloat(discountExpr.substring(0, discountExpr.length - 1)) || 0;
    const discAmount = (price * pct) / 100;
    return Math.max(0, price - discAmount);
  } else {
    const amount = parseFloat(discountExpr) || 0;
    return Math.max(0, price - amount);
  }
}

describe('Cart Calculations Suite', () => {
  describe('calculateCartTotals', () => {
    it('should calculate subtotal correctly based on items quantity and rate', () => {
      const items: CartItem[] = [
        { productId: '1', productName: 'Premium Bread', quantity: 2, price: 100 },
        { productId: '2', productName: 'Local Fresh Milk', quantity: 1, price: 200 }
      ];
      const result = calculateCartTotals(items, 0, 0);
      expect(result.subtotal).toBe(400);
    });

    it('should apply standard branch tax ratios correctly to taxables', () => {
      const items: CartItem[] = [
        { productId: '1', productName: 'General Bread Container', quantity: 1, price: 100 }
      ];
      const result = calculateCartTotals(items, 0, 15); // 15% VAT
      expect(result.tax).toBe(15);
      expect(result.total).toBe(115);
    });

    it('should apply global discounts and reflect correctly on aggregate margins', () => {
      const items: CartItem[] = [
        { productId: '1', productName: 'Imported Coffee Bean Bag', quantity: 1, price: 100 }
      ];
      const result = calculateCartTotals(items, 10, 0); // Flat $10 ZWG discount
      expect(result.discount).toBe(10);
      expect(result.total).toBe(90);
    });
  });

  describe('applyDiscount helper', () => {
    it('should handle percentage discount conversion strings correctly', () => {
      const discounted = applyDiscount(100, '10%');
      expect(discounted).toBe(90);
    });

    it('should handle standard fixed dollar numerical inputs safely', () => {
      const discounted = applyDiscount(100, '10'); // Flat discount
      expect(discounted).toBe(90);
    });

    it('should prevent discounting items beyond their base values', () => {
      const discounted = applyDiscount(100, '150');
      expect(discounted).toBe(0);
    });
  });
});
