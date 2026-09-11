import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { TaxReturnPeriod } from '../types/erp';

export interface TaxReturnPDFOptions {
  period?: TaxReturnPeriod | any;
  taxReturn?: TaxReturnPeriod | any;
  businessName?: string;
  branchName?: string;
  taxNumber?: string;
}

export function exportTaxReturnPDF({
  period,
  taxReturn,
  businessName = 'TAREZA ENTERPRISE WORKSPACE',
  branchName = 'Main Branch',
  taxNumber = 'VAT-10029384-ZW'
}: TaxReturnPDFOptions) {
  const activePeriod = period || taxReturn;
  if (!activePeriod) {
    toast.error('Cannot generate Tax Return PDF: No period data provided.');
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

    const periodName = activePeriod.period_name || 'Current VAT Period';
    const startDate = activePeriod.start_date ? new Date(activePeriod.start_date).toLocaleDateString() : 'N/A';
    const endDate = activePeriod.end_date ? new Date(activePeriod.end_date).toLocaleDateString() : 'N/A';
    const status = String(activePeriod.status || activePeriod.filing_status || 'draft').toUpperCase();

    const outputTax = Number(activePeriod.output_tax || 0);
    const inputTax = Number(activePeriod.input_tax || 0);
    const netTaxPayable = Number(activePeriod.net_tax_payable !== undefined ? activePeriod.net_tax_payable : (outputTax - inputTax));
    const grossSales = Number(activePeriod.gross_sales || (outputTax / 0.15));

    // 1. Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(businessName.toUpperCase(), 14, 13);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`BRANCH: ${branchName.toUpperCase()} | ZIMRA / VAT TAX AUTHORITY FILING`, 14, 19);
    doc.text(`TAXPAYER IDENTIFICATION NUMBER (TIN / VAT NO): ${taxNumber}`, 14, 25);
    doc.text(`TAX RETURN FORM (VAT 7 STATUTORY SCHEDULE)`, 14, 31);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('VAT RETURN', 196, 13, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`PERIOD: ${periodName}`, 196, 19, { align: 'right' });
    doc.text(`STATUS: ${status}`, 196, 25, { align: 'right' });

    // 2. Schedule Table
    const tableData = [
      ['Box 1', 'Gross Standard Rated Taxable Supplies (Sales excl. VAT)', `$${grossSales.toFixed(2)}`],
      ['Box 2', 'Output VAT Collected on Taxable Supplies (15%)', `$${outputTax.toFixed(2)}`],
      ['Box 3', 'Input VAT Paid on Commercial Purchases & Vendor Bills', `$${inputTax.toFixed(2)}`],
      ['Box 4', 'Deductible Capital Goods / Import VAT Credits', '$0.00'],
      ['Box 5', 'Total Allowable Deductions (Box 3 + Box 4)', `$${inputTax.toFixed(2)}`],
      [
        'Box 6',
        netTaxPayable >= 0 ? 'NET VAT PAYABLE TO REVENUE AUTHORITY' : 'NET VAT REFUNDABLE CLAIM FROM REVENUE AUTHORITY',
        `$${Math.abs(netTaxPayable).toFixed(2)}`
      ]
    ];

    callAutoTable({
      startY: 44,
      margin: { left: 14, right: 14 },
      head: [['Schedule Line', 'Tax Line Item Description', 'Amount (USD)']],
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
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 120 },
        2: { cellWidth: 36, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (data: any) => {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.textColor = netTaxPayable >= 0 ? [185, 28, 28] : [4, 120, 87];
        }
      }
    });

    let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 120;

    // Summary Note
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, 182, 34, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('DECLARATION OF ACCURACY & COMPLIANCE', 18, currentY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`I declare that the information provided in this VAT return for the tax period ${startDate} to ${endDate}`, 18, currentY + 14);
    doc.text('is a true, accurate, and complete record extracted directly from verified Tareza Cloud ERP General Ledgers', 18, currentY + 20);
    doc.text('and that all claimed input tax is supported by valid fiscal invoices in compliance with national tax legislation.', 18, currentY + 26);

    // Signature Block
    const signY = 240;
    doc.setDrawColor(203, 213, 225);
    doc.line(14, signY + 12, 75, signY + 12);
    doc.line(130, signY + 12, 196, signY + 12);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Public Officer / Authorized Representative', 14, signY + 17);
    doc.text('Official Business Stamp & Date', 130, signY + 17);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Tareza Cloud ERP • Statutory VAT Return Form ${periodName}`, 105, 288, { align: 'center' });

    doc.save(`VAT_Return_${periodName.replace(/\s+/g, '_')}.pdf`);
    toast.success(`VAT Return ${periodName} PDF downloaded!`);
  } catch (err: any) {
    console.error('Error generating tax return PDF:', err);
    toast.error('Failed to generate Tax Return PDF: ' + (err.message || 'Unknown error'));
  }
}
