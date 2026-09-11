import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { APBill } from '../types/erp';

export interface BillPDFOptions {
  bill: APBill | any;
  businessName?: string;
  branchName?: string;
  taxNumber?: string;
}

export function exportBillPDF({
  bill,
  businessName = 'TAREZA ENTERPRISE WORKSPACE',
  branchName = 'Main Store Branch',
  taxNumber = 'VAT-10029384-ZW'
}: BillPDFOptions) {
  if (!bill) {
    toast.error('Cannot generate Bill PDF: No vendor bill record provided.');
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

    const billNumber = bill.bill_number || `BILL-${String(bill.id || '').slice(0, 8).toUpperCase()}`;
    const billDate = bill.bill_date ? new Date(bill.bill_date).toLocaleDateString() : new Date().toLocaleDateString();
    const dueDate = bill.due_date ? new Date(bill.due_date).toLocaleDateString() : 'Upon Presentation';
    const status = String(bill.status || 'approved').toUpperCase();
    const supplierName = bill.supplier_name || 'Vendor Supplier';
    const expenseCode = bill.expense_account_code || '6000';
    const expenseName = bill.expense_account_name || 'Operating Expenses';

    const subtotal = Number(bill.subtotal || 0);
    const taxAmount = Number(bill.tax_amount || 0);
    const totalAmount = Number(bill.total_amount || (subtotal + taxAmount));
    const amountPaid = Number(bill.amount_paid || 0);
    const balanceDue = Number(bill.balance_due !== undefined ? bill.balance_due : (totalAmount - amountPaid));

    // 1. Header Banner
    doc.setFillColor(39, 39, 42); // Charcoal zinc
    doc.rect(0, 0, 210, 34, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(businessName.toUpperCase(), 14, 13);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(212, 212, 216);
    doc.text(`BRANCH: ${branchName.toUpperCase()} | VAT REG: ${taxNumber}`, 14, 19);
    doc.text('ACCOUNTS PAYABLE (A/P) VENDOR BILL VOUCHER', 14, 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('BILL VOUCHER', 196, 13, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`REF: ${billNumber}`, 196, 19, { align: 'right' });
    doc.text(`STATUS: ${status}`, 196, 25, { align: 'right' });

    // 2. Metadata Cards
    let y = 40;

    // Supplier Info
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 92, 32, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('SUPPLIER / VENDOR DETAILS:', 18, y + 6);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(supplierName, 18, y + 13);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Vendor Invoice #: ${billNumber}`, 18, y + 20);
    doc.text(`Allocation Code: ${expenseCode} - ${expenseName}`, 18, y + 26);

    // Dates & Terms
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(110, y, 86, 32, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('BILL SCHEDULING:', 114, y + 6);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Bill Date:', 114, y + 13);
    doc.text(billDate, 192, y + 13, { align: 'right' });

    doc.text('Due Date:', 114, y + 19);
    doc.text(dueDate, 192, y + 19, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Payable Balance:', 114, y + 26);
    doc.text(`$${balanceDue.toFixed(2)}`, 192, y + 26, { align: 'right' });

    // 3. Accounting Allocation Table
    const tableData = [
      [
        bill.notes || `Procurement from ${supplierName}`,
        `${expenseCode} - ${expenseName}`,
        `$${subtotal.toFixed(2)}`,
        `$${taxAmount.toFixed(2)}`,
        `$${totalAmount.toFixed(2)}`
      ]
    ];

    callAutoTable({
      startY: y + 38,
      margin: { left: 14, right: 14 },
      head: [['Description / Goods Received', 'General Ledger Account', 'Net Subtotal', 'Input Tax', 'Total Amount (USD)']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [39, 39, 42],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [15, 23, 42]
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 50 },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' }
      }
    });

    let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 120;

    // Financial Breakdown Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(120, currentY, 76, 40, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text('Subtotal Net:', 124, currentY + 7);
    doc.text(`$${subtotal.toFixed(2)}`, 192, currentY + 7, { align: 'right' });

    doc.text('Input VAT Claimable:', 124, currentY + 14);
    doc.text(`$${taxAmount.toFixed(2)}`, 192, currentY + 14, { align: 'right' });

    doc.text('Total Bill Amount:', 124, currentY + 21);
    doc.text(`$${totalAmount.toFixed(2)}`, 192, currentY + 21, { align: 'right' });

    doc.text('Disbursements Made:', 124, currentY + 28);
    doc.text(`-$${amountPaid.toFixed(2)}`, 192, currentY + 28, { align: 'right' });

    doc.setDrawColor(203, 213, 225);
    doc.line(124, currentY + 31, 192, currentY + 31);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('OUTSTANDING PAYABLE:', 124, currentY + 37);
    doc.text(`$${balanceDue.toFixed(2)}`, 192, currentY + 37, { align: 'right' });

    // Authorization sign-off
    const signY = 240;
    doc.setDrawColor(203, 213, 225);
    doc.line(14, signY + 12, 75, signY + 12);
    doc.line(130, signY + 12, 196, signY + 12);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Procurement Officer / Receiver', 14, signY + 17);
    doc.text('Finance Controller Approval Stamp', 130, signY + 17);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Tareza Cloud ERP • Accounts Payable Voucher ${billNumber}`, 105, 288, { align: 'center' });

    doc.save(`VendorBill_${billNumber}_${billDate.replace(/\//g, '-')}.pdf`);
    toast.success(`Vendor Bill ${billNumber} PDF downloaded!`);
  } catch (err: any) {
    console.error('Error generating bill PDF:', err);
    toast.error('Failed to generate Bill PDF: ' + (err.message || 'Unknown error'));
  }
}
