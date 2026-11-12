import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export interface ReceiptPDFOptions {
  sale: any;
  businessName?: string;
  branchName?: string;
  taxNumber?: string;
  cashierName?: string;
  format?: '80mm' | 'a4';
}

export function exportReceiptPDF({
  sale,
  businessName = 'TAREZA ENTERPRISE',
  branchName = 'Main Store Branch',
  taxNumber = 'VAT-10029384-ZW',
  cashierName = 'POS Operator',
  format = '80mm'
}: ReceiptPDFOptions) {
  if (!sale) {
    toast.error('Cannot generate PDF: No transaction data provided.');
    return;
  }

  try {
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

    const callAutoTable = (doc: jsPDF, options: any) => {
      if (typeof autoTable === 'function') {
        autoTable(doc, options);
      } else if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(options);
      }
    };

    if (format === '80mm') {
      // Calculate dynamic height for 80mm roll
      const baseHeight = 120;
      const itemRowHeight = 7;
      const paymentRowHeight = 6;
      const calculatedHeight = Math.max(160, baseHeight + (items.length * itemRowHeight) + (payments.length * paymentRowHeight));

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, calculatedHeight]
      });

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(businessName.toUpperCase(), 40, 10, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(branchName, 40, 15, { align: 'center' });
      doc.text(`Tax / VAT Reg: ${taxNumber}`, 40, 19, { align: 'center' });

      // Divider line
      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(5, 22, 75, 22);
      doc.setLineDashPattern([], 0);

      // Metadata
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(isQuotation ? `QUOTATION: ${receiptNumber}` : `TAX INVOICE / RECEIPT: ${receiptNumber}`, 40, 27, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Date: ${formattedDate}`, 5, 33);
      doc.text(`Cashier: ${cashierName}`, 5, 37);
      doc.text(`Customer: ${customerName}`, 5, 41);

      // Table of items
      const tableData = items.map((item: any) => {
        const name = item.product?.name || item.name || 'Unnamed Item';
        const qty = Number(item.quantity || 1);
        const price = Number(
          item.unitPrice ?? 
          item.unit_price ?? 
          item.price ?? 
          item.product?.retailPrice ?? 
          item.product?.price ?? 
          (item.subtotal && item.quantity ? item.subtotal / item.quantity : 0)
        );
        const lineTotal = Number(item.subtotal !== undefined ? item.subtotal : (price * qty)) + Number(item.vatAmount || item.vat_amount || 0);
        return [
          name,
          String(qty),
          `$${price.toFixed(2)}`,
          `$${lineTotal.toFixed(2)}`
        ];
      });

      callAutoTable(doc, {
        startY: 44,
        margin: { left: 5, right: 5 },
        theme: 'plain',
        head: [['Item', 'Qty', 'Price', 'Total']],
        body: tableData,
        headStyles: {
          fontSize: 7.5,
          fontStyle: 'bold',
          textColor: [20, 20, 20],
          fillColor: [240, 240, 240],
          cellPadding: 1.5,
          lineWidth: 0.2,
          lineColor: [200, 200, 200]
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [0, 0, 0],
          cellPadding: 1.5
        },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 8, halign: 'right' },
          2: { cellWidth: 14, halign: 'right' },
          3: { cellWidth: 16, halign: 'right' }
        }
      });

      let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 4 : 80;

      // Dashed divider
      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(5, currentY, 75, currentY);
      doc.setLineDashPattern([], 0);
      currentY += 4;

      // Totals
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      doc.text('Subtotal:', 5, currentY);
      doc.text(`$${subtotal.toFixed(2)}`, 75, currentY, { align: 'right' });
      currentY += 4;

      if (discountTotal > 0) {
        doc.text('Discount:', 5, currentY);
        doc.text(`-$${discountTotal.toFixed(2)}`, 75, currentY, { align: 'right' });
        currentY += 4;
      }

      doc.text('VAT (15%):', 5, currentY);
      doc.text(`$${vatTotal.toFixed(2)}`, 75, currentY, { align: 'right' });
      currentY += 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('TOTAL (USD):', 5, currentY);
      doc.text(`$${total.toFixed(2)}`, 75, currentY, { align: 'right' });
      currentY += 5;

      // Payments section
      if (isQuotation) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text('Estimate valid for 30 days. No payments collected.', 40, currentY, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        currentY += 6;
      } else {
        doc.setDrawColor(200, 200, 200);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(5, currentY, 75, currentY);
        doc.setLineDashPattern([], 0);
        currentY += 4;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('PAYMENT DETAILS', 5, currentY);
        currentY += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        if (payments.length > 0) {
          payments.forEach((p: any) => {
            const method = String(p.method || p.payment_method || 'CASH').replace('_', ' ').toUpperCase();
            const amt = Number(p.amount || 0);
            doc.text(method, 5, currentY);
            doc.text(`$${amt.toFixed(2)}`, 75, currentY, { align: 'right' });
            currentY += 3.5;
          });
        } else {
          const method = String(sale.payment_method || 'CASH').toUpperCase();
          doc.text(method, 5, currentY);
          doc.text(`$${total.toFixed(2)}`, 75, currentY, { align: 'right' });
          currentY += 3.5;
        }

        if (change > 0) {
          doc.setFont('helvetica', 'bold');
          doc.text('CHANGE DUE:', 5, currentY);
          doc.text(`$${change.toFixed(2)}`, 75, currentY, { align: 'right' });
          currentY += 4;
        }
      }

      // Footer
      currentY += 3;
      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(5, currentY, 75, currentY);
      doc.setLineDashPattern([], 0);
      currentY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('*** THANK YOU FOR YOUR BUSINESS! ***', 40, currentY, { align: 'center' });
      currentY += 3.5;
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`Tareza Cloud POS • Ref: ${receiptNumber}`, 40, currentY, { align: 'center' });

      doc.save(`Receipt_${receiptNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(`Receipt ${receiptNumber} PDF exported!`);
    } else {
      // Standard A4 Format
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Header Banner
      doc.setFillColor(24, 24, 27);
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(businessName.toUpperCase(), 14, 12);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(212, 212, 216);
      doc.text(`BRANCH: ${branchName.toUpperCase()} | TAX REG: ${taxNumber}`, 14, 18);
      doc.text(isQuotation ? 'OFFICIAL PRICE ESTIMATE / QUOTATION' : 'SALES TAX RECEIPT & INVOICE', 14, 24);

      doc.setFontSize(8);
      doc.text(`DATE: ${formattedDate}`, 196, 18, { align: 'right' });
      doc.text(`DOC #: ${receiptNumber}`, 196, 24, { align: 'right' });

      // Metadata card
      let y = 38;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 182, 20, 2, 2, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('CUSTOMER / BILLED TO:', 18, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.text(customerName, 18, y + 12);

      doc.setFont('helvetica', 'bold');
      doc.text('SERVICED BY:', 120, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.text(`Operator: ${cashierName}`, 120, y + 12);
      doc.text(`Status: ${sale.status || 'COMPLETED'}`, 120, y + 17);

      // Table
      const tableData = items.map((item: any) => {
        const name = item.product?.name || item.name || 'Item';
        const qty = Number(item.quantity || 1);
        const price = Number(
          item.unitPrice ?? 
          item.unit_price ?? 
          item.price ?? 
          item.product?.retailPrice ?? 
          item.product?.price ?? 
          (item.subtotal && item.quantity ? item.subtotal / item.quantity : 0)
        );
        const lineTotal = Number(item.subtotal !== undefined ? item.subtotal : (price * qty)) + Number(item.vatAmount || item.vat_amount || 0);
        return [
          name,
          String(qty),
          `$${price.toFixed(2)}`,
          `$${lineTotal.toFixed(2)}`
        ];
      });

      callAutoTable(doc, {
        startY: y + 26,
        margin: { left: 14, right: 14 },
        head: [['Product / Service Description', 'Quantity', 'Unit Price', 'Total (USD)']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [15, 23, 42]
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 26, halign: 'right' },
          2: { cellWidth: 28, halign: 'right' },
          3: { cellWidth: 28, halign: 'right' }
        }
      });

      let finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 120;

      // Summary Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(120, finalY, 76, 36, 2, 2, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Subtotal:', 124, finalY + 7);
      doc.text(`$${subtotal.toFixed(2)}`, 192, finalY + 7, { align: 'right' });

      doc.text('Discount:', 124, finalY + 13);
      doc.text(`-$${discountTotal.toFixed(2)}`, 192, finalY + 13, { align: 'right' });

      doc.text('VAT Total (15%):', 124, finalY + 19);
      doc.text(`$${vatTotal.toFixed(2)}`, 192, finalY + 19, { align: 'right' });

      doc.setDrawColor(203, 213, 225);
      doc.line(124, finalY + 23, 192, finalY + 23);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('TOTAL (USD):', 124, finalY + 30);
      doc.text(`$${total.toFixed(2)}`, 192, finalY + 30, { align: 'right' });

      doc.save(`Receipt_A4_${receiptNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(`A4 Receipt ${receiptNumber} PDF exported!`);
    }
  } catch (err: any) {
    console.error('Error generating receipt PDF:', err);
    toast.error('Failed to generate Receipt PDF: ' + (err.message || 'Unknown error'));
  }
}
