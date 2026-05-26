import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SaleRecord } from '../../store/posStore';

interface ReceiptPrintProps {
  sale: SaleRecord | null;
  businessName?: string;
  branchName?: string;
  taxNumber?: string;
}

export const ReceiptPrint = React.forwardRef<HTMLDivElement, ReceiptPrintProps>(
  ({ sale, businessName = "Tareza Retail", branchName = "Harare Branch", taxNumber = "BP123456789" }, ref) => {
    return (
      <div className="hidden print:block">
        <div ref={ref} className="w-[80mm] p-4 text-black font-mono text-xs bg-white mx-auto print:mx-0">
          {sale ? (
            <>
              <div className="text-center mb-4">
                <h2 className="font-bold text-lg">{businessName}</h2>
                <p>{branchName}</p>
                <p>VAT No: {taxNumber}</p>
                <p className="mt-2">Receipt: {sale.receiptNumber}</p>
                <p>{new Date(sale.timestamp).toLocaleString()}</p>
                {sale.customerId && <p className="mt-1">Customer ID: {sale.customerId}</p>}
              </div>

              <div className="border-t border-b border-dashed border-zinc-400 py-2 mb-2">
                <table className="w-full">
                  <thead>
                    <tr className="text-left font-bold border-b border-dashed border-zinc-300">
                      <th className="w-1/2 pb-1">Item</th>
                      <th className="text-right pb-1">Qty</th>
                      <th className="text-right pb-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="pr-2 py-1">
                          {item.product.name}
                          {item.discount && (
                            <div className="text-[10px] italic">
                              (-{item.discount.type === 'percentage' ? `${item.discount.value}%` : `$${item.discount.value}`})
                            </div>
                          )}
                        </td>
                        <td className="text-right py-1">{item.quantity}</td>
                        <td className="text-right py-1">${(item.subtotal + item.vatAmount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

          <div className="space-y-1 mb-4 pt-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discountTotal > 0 && (
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>-${sale.discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>VAT (15%):</span>
              <span>${sale.vatTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-2 mt-1 border-t border-solid border-zinc-400">
              <span>TOTAL (USD):</span>
              <span>${sale.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="mb-4 border-b border-dashed border-zinc-400 pb-2">
            <h3 className="font-bold mb-1">Payments</h3>
            {sale.payments.map((p) => (
              <div key={p.id} className="flex justify-between uppercase text-[11px]">
                <span>{p.method.replace('_', ' ')}</span>
                <span>${p.amount.toFixed(2)}</span>
              </div>
            ))}
            {sale.payments.reduce((acc, p) => acc + p.amount, 0) > sale.total && (
              <div className="flex justify-between uppercase text-[11px] font-bold mt-1">
                <span>CHANGE</span>
                <span>${(sale.payments.reduce((acc, p) => acc + p.amount, 0) - sale.total).toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="text-center mt-4">
            {/* POS Sync Status */}
            <h3 className="font-bold border-b border-zinc-400 border-solid mb-2 pb-1 text-[10px]">SALES TAX INVOICE</h3>
            <p className="text-[10px] text-zinc-700 mb-2">Receipt #{sale.receiptNumber}</p>
            
            <div className="flex justify-center mb-2">
              <QRCodeSVG value={`RECEIPT-${sale.receiptNumber}-${sale.total}`} size={100} level="M" />
            </div>
            
            <div className="mt-2 text-center text-[10px]">
              {sale.status === 'offline_pending' ? (
                <p className="text-amber-600 font-bold uppercase tracking-wider text-[9px]">Offline Queue - Sync Pending</p>
              ) : (
                <p className="text-emerald-600 font-bold uppercase tracking-wider text-[9px]">Synced Online</p>
              )}
            </div>
          </div>
          
          <div className="text-center mt-6 text-[10px]">
            <p>*** Thank you for your business! ***</p>
            <p className="mt-1">Generated by Tareza POS</p>
          </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }
);

ReceiptPrint.displayName = 'ReceiptPrint';
