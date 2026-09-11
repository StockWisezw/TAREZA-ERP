import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export interface CustomerStatementPDFOptions {
  customers?: any[];
  businessName?: string;
  branchName?: string;
  specificCustomer?: any;
}

export function exportCustomerStatementPDF({
  customers = [],
  businessName = 'TAREZA ENTERPRISE WORKSPACE',
  branchName = 'Main Commercial Branch',
  specificCustomer
}: CustomerStatementPDFOptions) {
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

    const dateStr = new Date().toLocaleDateString();

    if (specificCustomer) {
      // Individual Customer Statement
      const c = specificCustomer;
      const cName = c.name || c.full_name || 'Customer';
      const cEmail = c.email || 'N/A';
      const cPhone = c.phone || 'N/A';
      const cAddress = c.address || 'N/A';
      const cType = c.customer_type || c.type || 'Retail';
      const totalSpent = Number(c.total_spent || c.totalSpent || 0);
      const balance = Number(c.balance || c.credit_balance || 0);

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 34, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(businessName.toUpperCase(), 14, 13);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`BRANCH: ${branchName.toUpperCase()} | CLIENT STATEMENT OF ACCOUNT`, 14, 19);
      doc.text(`CUSTOMER ID: ${c.id ? String(c.id).slice(0, 8).toUpperCase() : 'CUST-REF'}`, 14, 25);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('STATEMENT', 196, 13, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`DATE: ${dateStr}`, 196, 19, { align: 'right' });

      // Customer Info Box
      let y = 40;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 92, 34, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('ACCOUNT HOLDER:', 18, y + 6);

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(cName, 18, y + 13);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Phone: ${cPhone}`, 18, y + 20);
      doc.text(`Email: ${cEmail}`, 18, y + 26);
      doc.text(`Account Tier: ${cType.toUpperCase()}`, 18, y + 31);

      // Financials Summary Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(110, y, 86, 34, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('ACCOUNT BALANCE SUMMARY:', 114, y + 6);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Lifetime Invoiced Spend:', 114, y + 14);
      doc.text(`$${totalSpent.toFixed(2)}`, 192, y + 14, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(balance > 0 ? 185 : 15, balance > 0 ? 28 : 23, balance > 0 ? 28 : 42);
      doc.text('Outstanding Ledger Balance:', 114, y + 24);
      doc.text(`$${balance.toFixed(2)}`, 192, y + 24, { align: 'right' });

      // Transactions / Invoices Table
      const txs = Array.isArray(c.transactions) ? c.transactions : [];
      const tableData = txs.length > 0 ? txs.map((t: any) => [
        t.date ? new Date(t.date).toLocaleDateString() : dateStr,
        t.reference || t.invoice_number || 'INV',
        t.description || 'Goods / Services',
        `$${Number(t.amount || 0).toFixed(2)}`,
        t.status || 'Settled'
      ]) : [
        [dateStr, 'OPENING', 'Account balance carried forward', `$${balance.toFixed(2)}`, balance > 0 ? 'Current' : 'Clear']
      ];

      callAutoTable({
        startY: y + 42,
        margin: { left: 14, right: 14 },
        head: [['Date', 'Reference', 'Description', 'Amount (USD)', 'Status']],
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
          0: { cellWidth: 26 },
          1: { cellWidth: 32, fontStyle: 'bold' },
          2: { cellWidth: 74 },
          3: { cellWidth: 26, halign: 'right' },
          4: { cellWidth: 24, halign: 'center' }
        }
      });

      doc.save(`Statement_${cName.replace(/\s+/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`);
      toast.success(`Statement for ${cName} exported!`);
    } else {
      // Customer Directory Master PDF
      if (customers.length === 0) {
        toast.error('No customer records to export.');
        return;
      }

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 34, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(businessName.toUpperCase(), 14, 13);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`BRANCH: ${branchName.toUpperCase()} | CUSTOMER DIRECTORY MASTER REGISTER`, 14, 19);
      doc.text(`TOTAL ACCOUNTS: ${customers.length} REGISTERED CLIENTS`, 14, 25);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('CLIENT DIRECTORY', 196, 13, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`AS AT: ${dateStr}`, 196, 19, { align: 'right' });

      const tableData = customers.map((c: any) => [
        c.name || c.full_name || 'Valued Client',
        c.phone || 'N/A',
        c.email || 'N/A',
        (c.customer_type || c.type || 'Retail').toUpperCase(),
        `$${Number(c.total_spent || c.totalSpent || 0).toFixed(2)}`,
        `$${Number(c.balance || c.credit_balance || 0).toFixed(2)}`
      ]);

      callAutoTable({
        startY: 42,
        margin: { left: 14, right: 14 },
        head: [['Customer Name', 'Phone', 'Email Address', 'Type', 'Total Spent', 'Balance Due']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [15, 23, 42]
        },
        columnStyles: {
          0: { cellWidth: 44, fontStyle: 'bold' },
          1: { cellWidth: 30 },
          2: { cellWidth: 48 },
          3: { cellWidth: 20 },
          4: { cellWidth: 20, halign: 'right' },
          5: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
        }
      });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Tareza Cloud ERP • Customer Directory • Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
      }

      doc.save(`CustomerDirectory_${dateStr.replace(/\//g, '-')}.pdf`);
      toast.success('Customer Directory PDF exported!');
    }
  } catch (err: any) {
    console.error('Error generating customer statement PDF:', err);
    toast.error('Failed to generate Customer Statement PDF: ' + (err.message || 'Unknown error'));
  }
}
