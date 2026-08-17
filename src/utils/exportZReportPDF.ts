import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'sonner';
import { RegisterSession, CashLog } from '../hooks/useCashManagement';

export interface ZReportPDFOptions {
  session: RegisterSession | any;
  auditLogs?: CashLog[] | any[];
  businessName?: string;
  branchName?: string;
  operatorName?: string;
  supervisorName?: string;
}

export function exportZReportPDF({
  session,
  auditLogs = [],
  businessName = 'TAREZA ENTERPRISE WORKSPACE',
  branchName = 'Main Store Branch',
  operatorName = 'System Operator',
  supervisorName = 'Branch Supervisor'
}: ZReportPDFOptions) {
  if (!session) {
    toast.error('Cannot generate PDF: No shift session data provided.');
    return;
  }

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const openingFloat = Number(session.opening_balance || 0);
    const closingBalance = Number(session.closing_balance || 0);
    const expectedBalance = Number(session.expected_balance || 0);
    const variance = Number(session.variance || 0);
    const salesTotal = Number(session.sales_total || 0);
    const salesCount = Number(session.sales_count || 0);
    const payoutsTotal = Number(session.payouts_total || 0);

    const referenceCode = session.id 
      ? (session.id.startsWith('off-shift-') 
          ? `SHIFT-OFFLINE-${session.id.slice(-6)}` 
          : `Z-AUDIT-${session.id.slice(0, 8).toUpperCase()}`)
      : 'Z-AUDIT-LOCAL';

    const openedAtStr = session.opened_at ? new Date(session.opened_at).toLocaleString() : 'N/A';
    const closedAtStr = session.closed_at ? new Date(session.closed_at).toLocaleString() : 'Active / Unclosed';
    const generatedAtStr = new Date().toLocaleString();

    // 1. Top Header Banner
    doc.setFillColor(24, 24, 27); // Dark zinc / charcoal background
    doc.rect(0, 0, 210, 32, 'F');

    // Title & Branding
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(businessName.toUpperCase(), 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(212, 212, 216);
    doc.text(`BRANCH: ${branchName.toUpperCase()} | CLOSED REGISTER AUDIT REPORT (Z-REPORT)`, 14, 18);
    doc.text(`AUDIT REF: ${referenceCode} | STATUS: ${session.status || 'CLOSED'}`, 14, 24);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`ISSUED: ${generatedAtStr}`, 196, 24, { align: 'right' });

    // 2. Metadata Box
    let y = 38;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 22, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    // Left Column
    doc.setFont('helvetica', 'bold');
    doc.text('Cashier / Operator:', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(operatorName, 55, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Supervisor / Auditor:', 18, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(supervisorName, 55, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.text('Register Shift ID:', 18, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.text(session.id || 'N/A', 55, y + 18);

    // Right Column
    doc.setFont('helvetica', 'bold');
    doc.text('Opened At:', 115, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(openedAtStr, 140, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Closed At:', 115, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(closedAtStr, 140, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.text('Document Type:', 115, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.text('Certified Z-Report', 140, y + 18);

    y += 28;

    // 3. Financial Reconciliation Section Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('1. SHIFT CASH RECONCILIATION FINANCIAL SUMMARY', 14, y);
    y += 3;

    // Financial Reconciliation Table
    const reconciliationRows = [
      ['Opening Cash Float', `$${openingFloat.toFixed(2)}`],
      [`Total Gross Cash Sales (${salesCount} transactions)`, `+$${salesTotal.toFixed(2)}`],
      ['Total Till Payouts / Micro-Expenses', `-$${payoutsTotal.toFixed(2)}`],
      ['Expected Drawer Balance', `$${expectedBalance.toFixed(2)}`],
      ['Actual Counted Cash at Closure', `$${closingBalance.toFixed(2)}`],
      [
        'COMPLIANCE AUDIT VARIANCE',
        variance < 0 
          ? `-$${Math.abs(variance).toFixed(2)} (SHORTAGE)` 
          : variance > 0 
          ? `+$${variance.toFixed(2)} (OVERAGE)` 
          : '$0.00 (BALANCED)'
      ]
    ];

    (doc as any).autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Reconciliation Item / Metric', 'Amount (USD)']],
      body: reconciliationRows,
      theme: 'grid',
      headStyles: {
        fillColor: [39, 39, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.2,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 130, fontStyle: 'normal' },
        1: { cellWidth: 52, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (data: any) => {
        // Style specific rows
        if (data.row.index === 3 || data.row.index === 4) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.row.index === 5) { // Variance row
          if (variance < 0) {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [153, 27, 27];
          } else if (variance > 0) {
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [146, 64, 14];
          } else {
            data.cell.styles.fillColor = [220, 252, 231];
            data.cell.styles.textColor = [22, 101, 52];
          }
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // 4. Cash Movement Audit Trail Table (if logs exist)
    if (auditLogs && auditLogs.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('2. TILL CASH MOVEMENT AUDIT TRAIL', 14, y);
      y += 3;

      const logRows = auditLogs.map((log: any) => {
        const timeStr = log.created_at ? new Date(log.created_at).toLocaleTimeString() : '—';
        const typeStr = (log.transaction_type || log.type || 'Event').replace(/_/g, ' ').toUpperCase();
        const notesStr = log.notes || '—';
        const isPositive = log.type === 'inflow' || log.type === 'opening' || log.type === 'cash_in';
        const amountStr = `${isPositive ? '+' : '-'}$${Number(log.amount || 0).toFixed(2)}`;

        return [timeStr, typeStr, notesStr, amountStr];
      });

      (doc as any).autoTable({
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Time', 'Event / Type', 'Audit Notes / Reason', 'Amount']],
        body: logRows,
        theme: 'striped',
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          textColor: [51, 65, 85]
        },
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 36, fontStyle: 'bold' },
          2: { cellWidth: 88 },
          3: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
        }
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Check page space for signatures
    if (y > 230) {
      doc.addPage();
      y = 25;
    }

    // 5. Signatures & Compliance Verification
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('3. COMPLIANCE SIGN-OFF & CERTIFICATION', 14, y);
    y += 5;

    // Box for signatures
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, y, 182, 36, 2, 2, 'D');

    // Operator Sign Column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Cashier / Register Operator', 20, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Name: ${operatorName}`, 20, y + 11);
    doc.text('I certify that counted cash and drawer movements are true.', 20, y + 15);
    doc.setDrawColor(100, 116, 139);
    doc.line(20, y + 27, 95, y + 27);
    doc.text('Signature & Date', 20, y + 31);

    // Supervisor Sign Column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Supervisor / Auditor', 110, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Name: ${supervisorName}`, 110, y + 11);
    doc.text('Verified for store accounting compliance & general ledger entry.', 110, y + 15);
    doc.line(110, y + 27, 185, y + 27);
    doc.text('Signature & Date', 110, y + 31);

    // 6. Footer on all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Official Closed Register Z-Report Document • Tareza ERP Enterprise Audit & Compliance System',
        14,
        288
      );
      doc.text(`Page ${i} of ${pageCount}`, 196, 288, { align: 'right' });
    }

    // Save File
    const sanitizedBiz = businessName.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 12);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `Z-Report_${referenceCode}_${sanitizedBiz}_${dateStamp}.pdf`;

    doc.save(filename);
    toast.success(`Z-Report PDF exported successfully: ${filename}`);
  } catch (error: any) {
    console.error('[exportZReportPDF] Failed to export PDF:', error);
    toast.error(`Failed to generate Z-Report PDF: ${error.message || 'Unknown error'}`);
  }
}
