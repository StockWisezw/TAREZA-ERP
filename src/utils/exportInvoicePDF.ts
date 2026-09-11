import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { ARInvoice } from '../types/erp';

export interface InvoicePDFOptions {
  invoice: ARInvoice | any;
  businessName?: string;
  branchName?: string;
  taxNumber?: string;
  currency?: string;
  bankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    branchCode?: string;
    swiftCode?: string;
    ecocashMerchant?: string;
  };
}

export function exportInvoicePDF({
  invoice,
  businessName = 'TAREZA ENTERPRISE WORKSPACE',
  branchName = 'Main Commercial Branch',
  taxNumber = 'VAT-10029384-ZW',
  currency = 'USD',
  bankDetails = {
    bankName: 'Standard Chartered / Stanbic Bank Zimbabwe',
    accountName: 'Tareza Enterprise Pvt Ltd',
    accountNumber: '9140003849102',
    branchCode: '32001',
    swiftCode: 'SBICZWHX',
    ecocashMerchant: '*151*2*2*104928*AMOUNT#'
  }
}: InvoicePDFOptions) {
  if (!invoice) {
    toast.error('Cannot generate Invoice PDF: No invoice record provided.');
    return;
  }

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const callAutoTable = (options: any) => {
      if (typeof autoTable === 'function') {
        autoTable(doc, options);
      } else if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(options);
      }
    };

    const invoiceNumber = invoice.invoice_number || `INV-${String(invoice.id || '').slice(0, 8).toUpperCase()}`;
    const issueDate = invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : new Date().toLocaleDateString();
    const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Upon Receipt';
    const status = String(invoice.status || 'sent').toUpperCase();
    const customerName = invoice.customer_name || 'Valued Customer';
    const customerEmail = invoice.customer_email || 'N/A';
    const customerPhone = invoice.customer_phone || 'N/A';

    const subtotal = Number(invoice.subtotal || 0);
    const taxAmount = Number(invoice.tax_amount || (subtotal * 0.15));
    const totalAmount = Number(invoice.total_amount || (subtotal + taxAmount));
    const amountPaid = Number(invoice.amount_paid || 0);
    const balanceDue = Number(invoice.balance_due !== undefined ? invoice.balance_due : (totalAmount - amountPaid));

    // 1. Top Header Banner
    doc.setFillColor(15, 23, 42); // Deep slate
    doc.rect(0, 0, 210, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(businessName.toUpperCase(), 14, 14);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`BRANCH: ${branchName.toUpperCase()} | TAX REG: ${taxNumber}`, 14, 21);
    doc.text('OFFICIAL COMMERCIAL TAX INVOICE', 14, 28);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('INVOICE', 196, 14, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`# ${invoiceNumber}`, 196, 21, { align: 'right' });
    doc.text(`STATUS: ${status}`, 196, 28, { align: 'right' });

    // 2. Metadata Cards (Customer & Dates)
    let y = 42;
    
    // Billed To Card (Left)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 92, 34, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('BILLED TO (CUSTOMER):', 18, y + 6);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(customerName, 18, y + 13);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Phone: ${customerPhone}`, 18, y + 20);
    doc.text(`Email: ${customerEmail}`, 18, y + 26);

    // Invoice Details Card (Right)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(110, y, 86, 34, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('INVOICE SUMMARY:', 114, y + 6);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Date of Issue:', 114, y + 13);
    doc.text(issueDate, 192, y + 13, { align: 'right' });

    doc.text('Payment Due Date:', 114, y + 19);
    doc.text(dueDate, 192, y + 19, { align: 'right' });

    doc.text('Currency:', 114, y + 25);
    doc.text(currency, 192, y + 25, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Balance Due:', 114, y + 31);
    doc.text(`$${balanceDue.toFixed(2)}`, 192, y + 31, { align: 'right' });

    // 3. Line Items Table
    const rawItems = Array.isArray(invoice.items) && invoice.items.length > 0 
      ? invoice.items 
      : [{ description: invoice.notes || 'Commercial Goods / Services as agreed', quantity: 1, unit_price: subtotal, amount: subtotal, tax_rate: 15 }];

    const tableData = rawItems.map((item: any) => {
      const desc = item.description || item.name || 'Commercial Item';
      const qty = Number(item.quantity || 1);
      const rate = Number(item.unit_price || item.price || 0);
      const amt = Number(item.amount || (rate * qty));
      const taxPct = item.tax_rate !== undefined ? item.tax_rate : 15;
      return [
        desc,
        String(qty),
        `$${rate.toFixed(2)}`,
        `${taxPct}%`,
        `$${amt.toFixed(2)}`
      ];
    });

    callAutoTable({
      startY: y + 40,
      margin: { left: 14, right: 14 },
      head: [['Description', 'Qty', 'Unit Rate', 'Tax Rate', `Total (${currency})`]],
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
        0: { cellWidth: 96 },
        1: { cellWidth: 20, halign: 'right' },
        2: { cellWidth: 24, halign: 'right' },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' }
      }
    });

    let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 140;

    // 4. Financial Calculations Box (Right) & Banking Info (Left)
    // Left: Banking & Settlement Instructions
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, 100, 48, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('BANKING & SETTLEMENT INSTRUCTIONS', 18, currentY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Bank: ${bankDetails.bankName || 'Stanbic Bank'}`, 18, currentY + 14);
    doc.text(`Account Name: ${bankDetails.accountName || businessName}`, 18, currentY + 20);
    doc.text(`Account Number: ${bankDetails.accountNumber || '9140003849102'}`, 18, currentY + 26);
    doc.text(`Branch / Swift: ${bankDetails.branchCode || '32001'} / ${bankDetails.swiftCode || 'SBICZWHX'}`, 18, currentY + 32);
    doc.text(`EcoCash Merchant: ${bankDetails.ecocashMerchant || '*151*2*2*104928*AMT#'}`, 18, currentY + 38);
    doc.text(`* Reference Quote: ${invoiceNumber}`, 18, currentY + 44);

    // Right: Calculation totals
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(120, currentY, 76, 48, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text('Subtotal Net:', 124, currentY + 8);
    doc.text(`$${subtotal.toFixed(2)}`, 192, currentY + 8, { align: 'right' });

    doc.text('VAT Total (15%):', 124, currentY + 15);
    doc.text(`$${taxAmount.toFixed(2)}`, 192, currentY + 15, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Total Invoiced:', 124, currentY + 22);
    doc.text(`$${totalAmount.toFixed(2)}`, 192, currentY + 22, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text('Less Paid:', 124, currentY + 29);
    doc.text(`-$${amountPaid.toFixed(2)}`, 192, currentY + 29, { align: 'right' });

    doc.setDrawColor(203, 213, 225);
    doc.line(124, currentY + 34, 192, currentY + 34);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('BALANCE DUE:', 124, currentY + 42);
    doc.text(`$${balanceDue.toFixed(2)}`, 192, currentY + 42, { align: 'right' });

    // 5. Notes & Terms
    currentY += 54;
    if (invoice.notes) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('NOTES & TERMS:', 14, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(invoice.notes, 14, currentY + 5, { maxWidth: 182 });
      currentY += 14;
    }

    // 6. Signature blocks
    currentY = Math.max(currentY, 245);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, currentY + 15, 75, currentY + 15);
    doc.line(130, currentY + 15, 196, currentY + 15);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Commercial Signature', 14, currentY + 20);
    doc.text('Customer Acceptance & Seal', 130, currentY + 20);

    // 7. Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated by Tareza Cloud ERP • Official Tax Invoice ${invoiceNumber} • Page 1 of 1`, 105, 288, { align: 'center' });

    doc.save(`Invoice_${invoiceNumber}_${issueDate.replace(/\//g, '-')}.pdf`);
    toast.success(`Tax Invoice ${invoiceNumber} PDF downloaded!`);
  } catch (err: any) {
    console.error('Error generating invoice PDF:', err);
    toast.error('Failed to generate Invoice PDF: ' + (err.message || 'Unknown error'));
  }
}
