import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SaleRecord } from '../../store/posStore';
import { supabase } from '../../lib/firebaseClient';

interface ReceiptPrintProps {
  sale: SaleRecord | null;
  businessName?: string;
  branchName?: string;
  taxNumber?: string;
}

export const ReceiptPrint = React.forwardRef<HTMLDivElement, ReceiptPrintProps>(
  ({ sale, businessName, branchName, taxNumber = "BP123456789" }, ref) => {
    if (!sale) return null;

    const [fetchedBusinessName, setFetchedBusinessName] = React.useState<string>("");
    const [fetchedBranchName, setFetchedBranchName] = React.useState<string>("");

    React.useEffect(() => {
      async function resolveDetails() {
        try {
          const bizId = (sale as any).business_id || (sale as any).businessId;
          const brId = (sale as any).branch_id || (sale as any).branchId;
          
          let resolvedBizName = "";
          let resolvedBranchName = "";

          if (bizId) {
            const { data: bData } = await supabase
              .from('businesses')
              .select('name')
              .eq('id', bizId)
              .maybeSingle();
            if (bData?.name) {
              resolvedBizName = bData.name;
            }
          }

          if (brId) {
            const { data: brData } = await supabase
              .from('branches')
              .select('name')
              .eq('id', brId)
              .maybeSingle();
            if (brData?.name) {
              resolvedBranchName = brData.name;
            }
          }

          // Fallbacks for current user if not on the sale object yet
          if (!resolvedBizName || !resolvedBranchName) {
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
              const { data: bUser } = await supabase
                .from('business_users')
                .select('business_id, branch_id')
                .eq('user_id', userData.user.id)
                .maybeSingle();

              if (bUser) {
                if (!resolvedBizName && bUser.business_id) {
                  const { data: bData } = await supabase
                    .from('businesses')
                    .select('name')
                    .eq('id', bUser.business_id)
                    .maybeSingle();
                  if (bData?.name) {
                    resolvedBizName = bData.name;
                  }
                }
                if (!resolvedBranchName && bUser.branch_id) {
                  const { data: brData } = await supabase
                    .from('branches')
                    .select('name')
                    .eq('id', bUser.branch_id)
                    .maybeSingle();
                  if (brData?.name) {
                    resolvedBranchName = brData.name;
                  }
                }
              }
            }
          }

          if (resolvedBizName) setFetchedBusinessName(resolvedBizName);
          if (resolvedBranchName) setFetchedBranchName(resolvedBranchName);
        } catch (e) {
          console.error("Error resolving receipt business details:", e);
        }
      }

      resolveDetails();
    }, [sale]);

    const displayBusinessName = (businessName && businessName !== "Tareza Retail") ? businessName : (fetchedBusinessName || "My Business");
    const displayBranchName = (branchName && branchName !== "Harare Branch") ? branchName : (fetchedBranchName || "Main Branch");

    // Robust falling back for snake_case/camelCase database & POS types
    const receiptNumber = sale.receiptNumber || (sale as any).receipt_number || "N/A";
    const timestamp = sale.timestamp || (sale as any).created_at || new Date().toISOString();
    const formattedDate = new Date(timestamp).toLocaleString();
    
    const items = Array.isArray(sale.items) ? sale.items : [];
    const payments = Array.isArray(sale.payments) ? sale.payments : [];
    
    const subtotal = Number(sale.subtotal !== undefined ? sale.subtotal : ((sale as any).subtotal_amount || (sale.total - (sale.vatTotal || (sale as any).vat_total || 0))));
    const discountTotal = Number(sale.discountTotal !== undefined ? sale.discountTotal : ((sale as any).discount_total || 0));
    const vatTotal = Number(sale.vatTotal !== undefined ? sale.vatTotal : ((sale as any).vat_total || 0));
    const total = Number(sale.total !== undefined ? sale.total : ((sale as any).total_amount || 0));

    const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    return (
      <div className="hidden print:block">
        <div ref={ref} className="w-[80mm] p-4 text-black font-mono text-xs bg-white mx-auto print:mx-0">
          <div className="text-center mb-4">
            <h2 className="font-bold text-lg">{displayBusinessName}</h2>
            <p>{displayBranchName}</p>
            <p>VAT No: {taxNumber}</p>
            <p className="mt-2 text-xs font-bold">{sale.status === 'QUOTATION' ? 'Quotation' : 'Receipt'}: {receiptNumber}</p>
            <p>{formattedDate}</p>
            {(sale.customerName || sale.customerId || (sale as any).customer_id) && (
              <p className="mt-1 font-semibold">
                Customer: {sale.customerName || "Walk-In Customer"}
              </p>
            )}
          </div>

          <div className="border-t border-b border-dashed border-zinc-400 py-2 mb-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left font-bold border-b border-dashed border-zinc-300">
                  <th className="w-1/2 pb-1">Item</th>
                  <th className="text-right pb-1">Qty</th>
                  <th className="text-right pb-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => {
                  const name = item.product?.name || item.name || "Unnamed Item";
                  const quantity = Number(item.quantity || 1);
                  const price = Number(item.price || item.product?.price || 0);
                  const lineSubtotal = Number(item.subtotal || (price * quantity));
                  const lineVatAmount = Number(item.vatAmount || item.vat_amount || 0);
                  const itemTotal = lineSubtotal + lineVatAmount;

                  return (
                    <tr key={item.id} className="align-top">
                      <td className="pr-2 py-1">
                        {name}
                        {item.discount && (
                          <div className="text-[10px] italic">
                            (-{item.discount.type === 'percentage' ? `${item.discount.value}%` : `$${item.discount.value}`})
                          </div>
                        )}
                      </td>
                      <td className="text-right py-1">{quantity}</td>
                      <td className="text-right py-1">${itemTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-1 mb-4 pt-1 text-xs">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>-${discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>VAT (15%):</span>
              <span>${vatTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-2 mt-1 border-t border-solid border-zinc-400">
              <span>TOTAL (USD):</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {sale.status === 'QUOTATION' ? (
            <div className="mb-4 border-b border-dashed border-zinc-400 pb-2 text-xs">
              <h3 className="font-bold mb-1">PROFORMA ESTIMATE</h3>
              <p className="text-[10px] text-zinc-500 italic">No payments have been collected against this quotation. Estimate is valid for 30 days.</p>
            </div>
          ) : (
            <div className="mb-4 border-b border-dashed border-zinc-400 pb-2 text-xs">
              <h3 className="font-bold mb-1">Payments</h3>
              {payments.map((p: any) => {
                const method = String(p.method || p.payment_method || "CASH");
                const amount = Number(p.amount || 0);
                return (
                  <div key={p.id || Math.random().toString()} className="flex justify-between uppercase text-[11px]">
                    <span>{method.replace('_', ' ')}</span>
                    <span>${amount.toFixed(2)}</span>
                  </div>
                );
              })}
              {payments.length === 0 && (
                <div className="flex justify-between uppercase text-[11px]">
                  <span>{String((sale as any).payment_method || "CASH").toUpperCase()}</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              )}
              {totalPaid > total && (
                <div className="flex justify-between uppercase text-[11px] font-bold mt-1">
                  <span>CHANGE</span>
                  <span>${(totalPaid - total).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <div className="text-center mt-4 pb-2">
            <h3 className="font-bold border-b border-zinc-400 border-solid mb-2 pb-1 text-[10px]">
              {sale.status === 'QUOTATION' ? 'OFFICIAL QUOTATION / PRICE ESTIMATE' : 'SALES TAX INVOICE'}
            </h3>
            <p className="text-[10px] text-zinc-700 mb-2 font-semibold">
              {sale.status === 'QUOTATION' ? 'Quotation' : 'Receipt'} #{receiptNumber}
            </p>
            
            <div className="flex justify-center mb-2">
              <QRCodeSVG value={`QUOTATION-${receiptNumber}-${total}`} size={100} level="M" />
            </div>
            
            <div className="mt-2 text-center text-[10px]">
              {sale.status === 'QUOTATION' ? (
                <p className="text-blue-650 font-bold uppercase tracking-wider text-[9px]">Draft Estimate</p>
              ) : sale.status === 'offline_pending' ? (
                <p className="text-amber-600 font-bold uppercase tracking-wider text-[9px]">Offline Queue - Sync Pending</p>
              ) : (
                <p className="text-emerald-600 font-bold uppercase tracking-wider text-[9px]">Synced Online</p>
              )}
            </div>
          </div>
          
          <div className="text-center mt-4 text-[10px] border-t pt-2 border-dashed">
            <p>*** Thank you for your business! ***</p>
            <p className="mt-1">Generated by POS Terminal</p>
          </div>
        </div>
      </div>
    );
  }
);

ReceiptPrint.displayName = 'ReceiptPrint';
