import { useState, useEffect } from 'react';
import { usePOSStore, CartItem } from '../store/posStore';

export function useCartCalculations() {
  const { cart, getTotals } = usePOSStore();
  const [vatEnabled, setVatEnabled] = useState(false);

  useEffect(() => {
    const enabled = localStorage.getItem('tareza_vat_enabled') === 'true';
    setVatEnabled(enabled);
  }, []);

  const getVatRate = () => (localStorage.getItem('tareza_vat_enabled') === 'true' ? 0.15 : 0);

  const calculateItemVat = (item: CartItem, price: number, qty: number) => {
    if (item.product.taxClass !== 'standard') return 0;
    const subtotal = price * qty;
    let itemDiscountValue = 0;
    if (item.discount) {
      itemDiscountValue = item.discount.type === 'percentage'
        ? subtotal * (item.discount.value / 100)
        : item.discount.value;
    }
    return (subtotal - itemDiscountValue) * getVatRate();
  };

  const formattedTotals = () => {
    const raw = getTotals();
    return {
      subtotal: raw.subtotal.toFixed(2),
      vat: raw.vat.toFixed(2),
      discount: raw.discount.toFixed(2),
      total: raw.total.toFixed(2),
      amountPaid: raw.amountPaid.toFixed(2),
      balance: raw.balance.toFixed(2),
      raw,
    };
  };

  return {
    vatEnabled,
    setVatEnabled,
    getVatRate,
    calculateItemVat,
    formattedTotals,
    totals: getTotals(),
  };
}
