import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export interface JournalPDFOptions {
  entry: any;
  lines?: any[];
  businessName?: string;
  branchName?: string;
}

export function exportJournalPDF({
  entry,
  lines = [],
  businessName = 'TAREZA ENTERPRISE WORKSPACE',
  branchName = 'Main Branch'
}: JournalPDFOptions) {
  if (!entry) {
    toast.error('Cannot generate Journal PDF: No journal entry data provided.');
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

    const refCode = entry.reference || entry.reference_code || `JV-${String(entry.id || '').slice(0, 8).toUpperCase()}`;
    const entryDate = entry.date ? new Date(entry.date).toLocaleDateString() : new Date().toLocaleDateString();
    const narrative = entry.narrative || entry.description || 'Standard Accounting Journal Adjustment';
    const status = String(entry.status || 'posted').toUpperCase();

    // 1. Header Banner
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, 210, 34, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(businessName.toUpperCase(), 14, 13);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`BRANCH: ${branchName.toUpperCase()} | GENERAL LEDGER SYSTEM`, 14, 19);
    doc.text('OFFICIAL DOUBLE-ENTRY JOURNAL VOUCHER (JV)', 14, 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('JOURNAL VOUCHER', 196, 13, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`REF: ${refCode}`, 196, 19, { align: 'right' });
    doc.text(`STATUS: ${status}`, 196, 25, { align: 'right' });

    // 2. Metadata Cards
    let y = 40;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 26, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('JOURNAL PARTICULARS:', 18, y + 6);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(`Posting Date: ${entryDate}`, 18, y + 13);
    doc.text(`Narrative / Explanation: ${narrative}`, 18, y + 20, { maxWidth: 174 });

    // 3. Journal Lines Table
    let totalDebit = 0;
    let totalCredit = 0;

    const tableData = lines.map((l: any) => {
      const debit = Number(l.debit || 0);
      const credit = Number(l.credit || 0);
      totalDebit += debit;
      totalCredit += credit;

      return [
        l.account_code || '---',
        l.account_name || 'Account',
        l.description || narrative,
        debit > 0 ? `$${debit.toFixed(2)}` : '-',
        credit > 0 ? `$${credit.toFixed(2)}` : '-'
      ];
    });

    // Add totals row
    tableData.push([
      'TOTALS',
      'BALANCED DOUBLE-ENTRY SUM',
      Math.abs(totalDebit - totalCredit) < 0.01 ? 'DEBITS = CREDITS (BALANCED)' : 'OUT OF BALANCE',
      `$${totalDebit.toFixed(2)}`,
      `$${totalCredit.toFixed(2)}`
    ]);

    callAutoTable({
      startY: y + 32,
      margin: { left: 14, right: 14 },
      head: [['Code', 'Account Title', 'Line Memo', 'Debit (USD)', 'Credit (USD)']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [15, 23, 42]
      },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: 'bold' },
        1: { cellWidth: 50 },
        2: { cellWidth: 52 },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' }
      },
      didParseCell: (data: any) => {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.textColor = [15, 23, 42];
        }
      }
    });

    // Signature Block
    const signY = 240;
    doc.setDrawColor(203, 213, 225);
    doc.line(14, signY + 12, 65, signY + 12);
    doc.line(80, signY + 12, 130, signY + 12);
    doc.line(145, signY + 12, 196, signY + 12);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Prepared By (Accountant)', 14, signY + 17);
    doc.text('Verified By (Chief Audit)', 80, signY + 17);
    doc.text('Authorized By (Finance Director)', 145, signY + 17);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Tareza Cloud ERP • GAAP General Ledger Journal Voucher ${refCode}`, 105, 288, { align: 'center' });

    doc.save(`JournalVoucher_${refCode}_${entryDate.replace(/\//g, '-')}.pdf`);
    toast.success(`Journal Voucher ${refCode} PDF downloaded!`);
  } catch (err: any) {
    console.error('Error generating journal PDF:', err);
    toast.error('Failed to generate Journal PDF: ' + (err.message || 'Unknown error'));
  }
}
