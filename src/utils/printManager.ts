import { toast } from 'sonner';
import { exportReceiptPDF } from './exportReceiptPDF';
import { exportZReportPDF } from './exportZReportPDF';

/**
 * Universal print trigger that handles:
 * 1. Modal backdrop removal and scroll unlock during print
 * 2. Standalone HTML print container isolation
 * 3. Graceful fallback to PDF export if iframe sandboxing blocks window.print()
 */

export function triggerBrowserPrint(options?: {
  onBefore?: () => void;
  onAfter?: () => void;
  fallbackToPDF?: () => void;
}) {
  try {
    if (options?.onBefore) options.onBefore();

    // Check if we are inside an iframe where window.print might be blocked
    const isInsideIframe = window.self !== window.top;

    // Add print preparation class to body
    document.body.classList.add('is-printing-active');

    const handleAfterPrint = () => {
      document.body.classList.remove('is-printing-active');
      window.removeEventListener('afterprint', handleAfterPrint);
      if (options?.onAfter) options.onAfter();
    };

    window.addEventListener('afterprint', handleAfterPrint);

    // Trigger print
    try {
      window.print();
    } catch (printErr: any) {
      console.warn('window.print() error or blocked by sandbox:', printErr);
      if (options?.fallbackToPDF) {
        toast.info('Browser print was restricted. Generating PDF export instead...');
        options.fallbackToPDF();
      } else {
        toast.error('Print failed: ' + (printErr.message || 'Restricted by browser'));
      }
    }

    // Safety timeout to clean up print classes if afterprint does not fire
    setTimeout(() => {
      document.body.classList.remove('is-printing-active');
    }, 2000);

  } catch (err: any) {
    console.error('Print trigger failed:', err);
    if (options?.fallbackToPDF) {
      options.fallbackToPDF();
    }
  }
}

/**
 * High-reliability receipt printer that formats an 80mm thermal receipt
 * and prints it with zero dependencies on Tailwind class resolution.
 */
export function printReceiptDirect(sale: any, businessInfo?: {
  businessName?: string;
  branchName?: string;
  taxNumber?: string;
  cashierName?: string;
}) {
  if (!sale) {
    toast.error('Cannot print: No sale record provided.');
    return;
  }

  const bizName = businessInfo?.businessName || 'TAREZA ENTERPRISE';
  const branchName = businessInfo?.branchName || 'Main Branch';
  const taxNumber = businessInfo?.taxNumber || 'VAT-10029384-ZW';
  const cashier = businessInfo?.cashierName || 'POS Operator';

  const isQuotation = sale.status === 'QUOTATION';
  const receiptNumber = sale.receiptNumber || sale.receipt_number || 'N/A';
  const timestamp = sale.timestamp || sale.created_at || new Date().toISOString();
  const formattedDate = new Date(timestamp).toLocaleString();
  const customerName = sale.customerName || sale.customer_name || 'Walk-In Customer';

  const items = Array.isArray(sale.items) ? sale.items : [];
  const payments = Array.isArray(sale.payments) ? sale.payments : [];

  const subtotal = Number(sale.subtotal !== undefined ? sale.subtotal : (sale.subtotal_amount || (sale.total - (sale.vatTotal || sale.vat_total || 0))));
  const discountTotal = Number(sale.discountTotal !== undefined ? sale.discountTotal : (sale.discount_total || 0));
  const vatTotal = Number(sale.vatTotal !== undefined ? sale.vatTotal : (sale.vat_total || 0));
  const total = Number(sale.total !== undefined ? sale.total : (sale.total_amount || 0));
  const totalPaid = payments.length > 0 
    ? payments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0)
    : total;
  const change = Math.max(0, totalPaid - total);

  // Build standalone self-contained HTML for receipt
  const itemsHtml = items.map((item: any) => {
    const name = item.product?.name || item.name || 'Item';
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || item.product?.price || 0);
    const lineTotal = Number(item.subtotal || (price * qty)) + Number(item.vatAmount || item.vat_amount || 0);
    return `
      <tr>
        <td style="padding: 3px 0; word-break: break-word;">${name}</td>
        <td style="padding: 3px 0; text-align: right;">${qty}</td>
        <td style="padding: 3px 0; text-align: right;">$${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const paymentsHtml = payments.length > 0
    ? payments.map((p: any) => `
        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
          <span>${String(p.method || p.payment_method || 'CASH').replace('_', ' ').toUpperCase()}:</span>
          <span>$${Number(p.amount || 0).toFixed(2)}</span>
        </div>
      `).join('')
    : `
        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
          <span>${String(sale.payment_method || 'CASH').toUpperCase()}:</span>
          <span>$${total.toFixed(2)}</span>
        </div>
      `;

  // Create or reuse print iframe
  let printFrame = document.getElementById('tareza-receipt-print-frame') as HTMLIFrameElement;
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'tareza-receipt-print-frame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    printFrame.style.visibility = 'hidden';
    document.body.appendChild(printFrame);
  }

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${isQuotation ? 'Quotation' : 'Receipt'} #${receiptNumber}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            width: 76mm;
            margin: 0 auto;
            padding: 5mm 3mm;
            font-family: 'Courier New', Courier, monospace, system-ui;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider {
            border-top: 1px dashed #444;
            margin: 6px 0;
          }
          .divider-solid {
            border-top: 1px solid #000;
            margin: 6px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="bold" style="font-size: 14px; text-transform: uppercase;">${bizName}</div>
          <div style="font-size: 10px;">${branchName}</div>
          <div style="font-size: 10px;">Tax Reg: ${taxNumber}</div>
          <div class="divider"></div>
          <div class="bold" style="font-size: 12px; margin: 3px 0;">
            ${isQuotation ? 'PRICE ESTIMATE / QUOTATION' : 'SALES TAX RECEIPT'}
          </div>
          <div style="font-size: 11px; font-weight: bold;"># ${receiptNumber}</div>
          <div style="font-size: 10px;">${formattedDate}</div>
          <div style="font-size: 10px; margin-top: 2px;">Cashier: ${cashier}</div>
          <div style="font-size: 10px;">Customer: ${customerName}</div>
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr style="border-bottom: 1px dashed #666; font-weight: bold;">
              <th style="text-align: left; padding-bottom: 3px;">Item</th>
              <th style="text-align: right; padding-bottom: 3px; width: 35px;">Qty</th>
              <th style="text-align: right; padding-bottom: 3px; width: 60px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
          <span>Subtotal:</span>
          <span>$${subtotal.toFixed(2)}</span>
        </div>
        ${discountTotal > 0 ? `
          <div style="display: flex; justify-content: space-between; margin: 2px 0;">
            <span>Discount:</span>
            <span>-$${discountTotal.toFixed(2)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
          <span>VAT (15%):</span>
          <span>$${vatTotal.toFixed(2)}</span>
        </div>
        <div class="divider-solid"></div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin: 4px 0;">
          <span>TOTAL (USD):</span>
          <span>$${total.toFixed(2)}</span>
        </div>
        <div class="divider-solid"></div>

        ${isQuotation ? `
          <div style="font-size: 10px; text-align: center; color: #555; margin: 6px 0;">
            * Estimate valid for 30 days. No payments collected. *
          </div>
        ` : `
          <div style="font-weight: bold; font-size: 11px; margin-top: 6px;">PAYMENTS:</div>
          ${paymentsHtml}
          ${change > 0 ? `
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 4px;">
              <span>CHANGE DUE:</span>
              <span>$${change.toFixed(2)}</span>
            </div>
          ` : ''}
        `}

        <div class="divider"></div>
        <div class="text-center" style="font-size: 10px; margin-top: 8px;">
          <div>*** THANK YOU FOR YOUR CUSTOM ***</div>
          <div style="font-size: 9px; color: #666; margin-top: 3px;">Tareza Cloud Retail POS</div>
        </div>
      </body>
    </html>
  `;

  try {
    const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(receiptHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          console.warn('Print iframe failed, attempting direct window.print or PDF export fallback:', e);
          exportReceiptPDF({
            sale,
            businessName: bizName,
            branchName,
            taxNumber,
            cashierName: cashier,
            format: '80mm'
          });
        }
      }, 250);
    }
  } catch (frameErr) {
    console.warn('Iframe printing blocked, triggering PDF download:', frameErr);
    exportReceiptPDF({
      sale,
      businessName: bizName,
      branchName,
      taxNumber,
      cashierName: cashier,
      format: '80mm'
    });
  }
}
