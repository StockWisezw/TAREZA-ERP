import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { RegisterSession, CashLog } from '../hooks/useCashManagement';
import { supabase } from '../lib/firebaseClient';

export interface ZReportPDFOptions {
  session: RegisterSession | any;
  auditLogs?: CashLog[] | any[];
  businessName?: string;
  branchName?: string;
  operatorName?: string;
  supervisorName?: string;
}

export async function exportZReportPDF({
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

    const callAutoTable = (options: any) => {
      if (typeof autoTable === 'function') {
        autoTable(doc, options);
      } else if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(options);
      }
    };

    const getFinalY = (fallbackY: number): number => {
      return (doc as any).lastAutoTable?.finalY ?? fallbackY;
    };

    // Financial Values
    let openingFloat = Number(session.opening_balance || 0);
    let closingBalance = Number(session.closing_balance || 0);
    let expectedBalance = Number(session.expected_balance || 0);
    let variance = Number(session.variance || 0);
    let salesTotal = Number(session.sales_total || 0);
    let salesCount = Number(session.sales_count || 0);
    let payoutsTotal = Number(session.payouts_total || 0);
    let cogsTotal = Number(session.cogs_total ?? session.cogs ?? 0);

    // If COGS is missing or 0, dynamically query the shift's sales to compute exact perpetual COGS
    if (cogsTotal === 0 && session.opened_at) {
      try {
        const startIso = new Date(session.opened_at).toISOString();
        const endIso = session.closed_at ? new Date(session.closed_at).toISOString() : new Date().toISOString();

        let salesQuery = supabase.from('sales')
          .select('id, receipt_number, total, items, status, created_at')
          .gte('created_at', startIso)
          .lte('created_at', endIso);

        if (session.business_id && session.business_id !== '00000000-0000-0000-0000-000000000000') {
          salesQuery = salesQuery.eq('business_id', session.business_id);
        }

        const { data: shiftSales } = await salesQuery;

        // Fetch products to resolve unit and pack cost prices
        let prodQuery = supabase.from('products').select('id, cost_price, costPrice, price, retail_price, sku, pack_size');
        if (session.business_id && session.business_id !== '00000000-0000-0000-0000-000000000000') {
          prodQuery = prodQuery.eq('business_id', session.business_id);
        }
        const { data: prodList } = await prodQuery;
        const prodMap = new Map((prodList || []).map((p: any) => [p.id, p]));

        if (shiftSales && shiftSales.length > 0) {
          let computedCogs = 0;
          let computedSales = 0;
          let count = 0;

          shiftSales.forEach((s: any) => {
            const stat = String(s.status || '').toUpperCase();
            if (['REFUNDED', 'VOIDED', 'CANCELLED'].includes(stat)) return;

            count++;
            computedSales += Number(s.total || 0);

            let items: any[] = [];
            if (Array.isArray(s.items)) items = s.items;
            else if (typeof s.items === 'string') {
              try { items = JSON.parse(s.items); } catch { items = []; }
            }

            items.forEach((it: any) => {
              const qty = Number(it.quantity || 1);
              let cost = 0;
              const embeddedCost = it.product?.cost_price ?? it.product?.costPrice ?? it.costPrice ?? it.cost_price;
              if (embeddedCost !== undefined && embeddedCost !== null && Number(embeddedCost) > 0) {
                cost = Number(embeddedCost);
              } else {
                const pId = it.product?.id || it.product_id || it.productId;
                if (pId && prodMap.has(pId)) {
                  cost = Number(prodMap.get(pId).cost_price ?? prodMap.get(pId).costPrice ?? 0);
                }
              }

              let multiplier = 1;
              const sku = it.product?.sku || it.sku || '';
              const match = sku.match(/\|PK:(\d+)/i);
              if (match) {
                multiplier = parseInt(match[1], 10);
              } else if (it.tier === 'wholesale' || String(it.tier || '').toLowerCase().includes('wholesale')) {
                const pObj = it.product || (it.product_id ? prodMap.get(it.product_id) : null);
                if (pObj?.pack_size) {
                  multiplier = Number(pObj.pack_size) || 1;
                }
              }

              computedCogs += (qty * multiplier * cost);
            });
          });

          cogsTotal = computedCogs;
          if (salesTotal === 0 && computedSales > 0) {
            salesTotal = computedSales;
          }
          if (salesCount === 0 && count > 0) {
            salesCount = count;
          }

          // Backfill computed cogs to database record for instant future reports
          if (session.id && !session.id.startsWith('off-shift-')) {
            supabase.from('register_sessions')
              .update({ cogs_total: computedCogs, cogs: computedCogs, sales_total: salesTotal })
              .eq('id', session.id)
              .then(() => {});
          }
        }
      } catch (calcErr) {
        console.warn('Could not backfill session COGS for PDF:', calcErr);
      }
    }

    // Backfill auditLogs if empty
    let activeAuditLogs = [...auditLogs];
    if (activeAuditLogs.length === 0 && session.opened_at) {
      try {
        const startIso = new Date(session.opened_at).toISOString();
        const endIso = session.closed_at ? new Date(session.closed_at).toISOString() : new Date().toISOString();
        let logQuery = supabase.from('cash_drawer_logs')
          .select('*')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: true });

        if (session.business_id && session.business_id !== '00000000-0000-0000-0000-000000000000') {
          logQuery = logQuery.eq('business_id', session.business_id);
        }

        const { data: logsDocs } = await logQuery;
        if (logsDocs && logsDocs.length > 0) {
          activeAuditLogs = logsDocs;
        }
      } catch (logErr) {
        console.warn('Could not fetch audit logs for Z report:', logErr);
      }
    }

    // Filter cash management movement logs into Operating Expenses vs Owner Cash Drops
    let operatingExpensesTotal = 0;
    let ownerDropsTotal = 0;
    let cashInsTotal = 0;

    if (activeAuditLogs && activeAuditLogs.length > 0) {
      activeAuditLogs.forEach((log: any) => {
        const amt = Math.abs(Number(log.amount || 0));
        const tType = String(log.transaction_type || '').toLowerCase();
        const lType = String(log.type || '').toLowerCase();

        // Categorize Owner Cash Drops (Non-expense, Equity / Safe Transfer)
        if (
          tType === 'owner_collection' || 
          tType === 'drop' || 
          tType === 'drawer_drop' || 
          tType === 'safe_drop' || 
          lType === 'drop'
        ) {
          ownerDropsTotal += amt;
        } 
        // Categorize Operating Till Expenses (Recorded in Cash Management)
        else if (
          tType === 'expense' || 
          tType === 'payout' || 
          tType === 'restock' || 
          (lType === 'payout' && tType !== 'owner_collection')
        ) {
          operatingExpensesTotal += amt;
        } 
        else if (tType === 'cash_in' || lType === 'payin' || lType === 'inflow') {
          cashInsTotal += amt;
        }
      });
    } else {
      // Fallback if raw logs are not passed
      operatingExpensesTotal = payoutsTotal;
    }

    // Perpetual Inventory Method for Cost of Goods Sold (COGS)
    // In perpetual inventory, COGS is matched continuously per transaction
    const grossProfit = salesTotal - cogsTotal;
    const grossMarginPct = salesTotal > 0 ? (grossProfit / salesTotal) * 100 : 0;

    // Operating Net Profit = Gross Profit (Perpetual Method) - Operating Expenses (Cash Management)
    // Note: Owner cash drops are excluded from expenses
    const netProfit = grossProfit - operatingExpensesTotal;
    const netMarginPct = salesTotal > 0 ? (netProfit / salesTotal) * 100 : 0;

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
    doc.setFontSize(15);
    doc.text(businessName.toUpperCase(), 14, 11);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(212, 212, 216);
    doc.text(`BRANCH: ${branchName.toUpperCase()} | CLOSED REGISTER AUDIT REPORT (Z-REPORT)`, 14, 17);
    doc.text(`AUDIT REF: ${referenceCode} | STATUS: ${session.status || 'CLOSED'}`, 14, 23);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`ISSUED: ${generatedAtStr}`, 196, 23, { align: 'right' });

    // 2. Metadata Box
    let y = 36;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 22, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    // Left Column
    doc.setFont('helvetica', 'bold');
    doc.text('Cashier / Operator:', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(operatorName, 55, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Supervisor / Auditor:', 18, y + 11.5);
    doc.setFont('helvetica', 'normal');
    doc.text(supervisorName, 55, y + 11.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Register Shift ID:', 18, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.text(session.id || 'N/A', 55, y + 17);

    // Right Column
    doc.setFont('helvetica', 'bold');
    doc.text('Opened At:', 115, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(openedAtStr, 140, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Closed At:', 115, y + 11.5);
    doc.setFont('helvetica', 'normal');
    doc.text(closedAtStr, 140, y + 11.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Accounting Method:', 115, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.text('Perpetual Inventory / Cash Reconciled', 140, y + 17);

    y += 26;

    // 3. Section 1: Shift Financial Profitability (Perpetual Method)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('1. SHIFT OPERATIONAL PROFITABILITY (PERPETUAL METHOD)', 14, y);
    y += 2.5;

    const profitabilityRows = [
      ['Gross Sales Revenue (Point of Sale)', `$${salesTotal.toFixed(2)}`, '100.0%'],
      ['Cost of Goods Sold (Perpetual Inventory Method)', `-$${cogsTotal.toFixed(2)}`, salesTotal > 0 ? `${((cogsTotal / salesTotal) * 100).toFixed(1)}%` : '0.0%'],
      ['GROSS PROFIT MARGIN', `$${grossProfit.toFixed(2)}`, `${grossMarginPct.toFixed(1)}%`],
      ['Operating Expenses Recorded in Cash Management', `-$${operatingExpensesTotal.toFixed(2)}`, salesTotal > 0 ? `${((operatingExpensesTotal / salesTotal) * 100).toFixed(1)}%` : '0.0%'],
      ['NET OPERATING PROFIT FOR SHIFT', `$${netProfit.toFixed(2)}`, `${netMarginPct.toFixed(1)}%`],
      ['* Cash Drops Collected by Owner (Equity Drawing / Safe Transfer - Not an Expense)', `$${ownerDropsTotal.toFixed(2)}`, 'Excluded']
    ];

    callAutoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Financial Profitability Line Item', 'Amount (USD)', 'Margin %']],
      body: profitabilityRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      styles: {
        fontSize: 8,
        cellPadding: 1.8,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 120, fontStyle: 'normal' },
        1: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 24, halign: 'right', fontStyle: 'normal' }
      },
      didParseCell: (data: any) => {
        if (data.row.index === 2) { // Gross profit
          data.cell.styles.fillColor = [240, 253, 244];
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.row.index === 4) { // Net profit
          if (netProfit >= 0) {
            data.cell.styles.fillColor = [236, 253, 245];
            data.cell.styles.textColor = [6, 95, 70];
          } else {
            data.cell.styles.fillColor = [254, 242, 242];
            data.cell.styles.textColor = [153, 27, 27];
          }
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.row.index === 5) { // Owner collection note
          data.cell.styles.fillColor = [248, 250, 252];
          data.cell.styles.textColor = [100, 116, 139];
          data.cell.styles.fontStyle = 'italic';
        }
      }
    });

    y = getFinalY(y + 35) + 6;

    // 4. Section 2: Cash Drawer Reconciliation Summary
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('2. SHIFT CASH DRAWER RECONCILIATION SUMMARY', 14, y);
    y += 2.5;

    const reconciliationRows = [
      ['Opening Cash Float', `$${openingFloat.toFixed(2)}`],
      [`Total Cash Sales Collected (${salesCount} transactions)`, `+$${salesTotal.toFixed(2)}`],
      ['Total Till Operating Payouts / Expenses', `-$${operatingExpensesTotal.toFixed(2)}`],
      ['Cash Drops Collected by Owner / Safe Transfer', `-$${ownerDropsTotal.toFixed(2)}`],
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

    callAutoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Reconciliation Item / Cash Metric', 'Amount (USD)']],
      body: reconciliationRows,
      theme: 'grid',
      headStyles: {
        fillColor: [39, 39, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      styles: {
        fontSize: 8,
        cellPadding: 1.8,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 130, fontStyle: 'normal' },
        1: { cellWidth: 52, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (data: any) => {
        if (data.row.index === 4 || data.row.index === 5) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.row.index === 6) { // Variance row
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

    y = getFinalY(y + 35) + 6;

    // 5. Section 3: Cash Movement Audit Trail Table (if logs exist)
    if (auditLogs && auditLogs.length > 0) {
      // Check space
      if (y > 215) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('3. TILL CASH MOVEMENT AUDIT TRAIL', 14, y);
      y += 2.5;

      const logRows = auditLogs.map((log: any) => {
        const timeStr = log.created_at ? new Date(log.created_at).toLocaleTimeString() : '—';
        const typeStr = (log.transaction_type || log.type || 'Event').replace(/_/g, ' ').toUpperCase();
        const notesStr = log.notes || '—';
        const isPositive = log.type === 'inflow' || log.type === 'opening' || log.type === 'cash_in';
        const amountStr = `${isPositive ? '+' : '-'}$${Number(log.amount || 0).toFixed(2)}`;

        return [timeStr, typeStr, notesStr, amountStr];
      });

      callAutoTable({
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Time', 'Event / Type', 'Audit Notes / Reason', 'Amount']],
        body: logRows,
        theme: 'striped',
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 1.6,
          textColor: [51, 65, 85]
        },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 38, fontStyle: 'bold' },
          2: { cellWidth: 90 },
          3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
        }
      });

      y = getFinalY(y + 30) + 6;
    }

    // Check space for signatures
    if (y > 235) {
      doc.addPage();
      y = 20;
    }

    // 6. Section 4: Signatures & Compliance Verification
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('4. COMPLIANCE SIGN-OFF & DUAL CERTIFICATION', 14, y);
    y += 4;

    // Box for signatures
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, y, 182, 34, 2, 2, 'D');

    // Operator Sign Column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('Cashier / Register Operator', 20, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Name: ${operatorName}`, 20, y + 10);
    doc.text('I certify that counted cash and drawer movements are true.', 20, y + 14);
    doc.setDrawColor(100, 116, 139);
    doc.line(20, y + 25, 95, y + 25);
    doc.text('Signature & Date', 20, y + 29);

    // Supervisor Sign Column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('Supervisor / Auditor', 110, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Name: ${supervisorName}`, 110, y + 10);
    doc.text('Verified for store accounting compliance & general ledger entry.', 110, y + 14);
    doc.line(110, y + 25, 185, y + 25);
    doc.text('Signature & Date', 110, y + 29);

    // 7. Footer on all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Official Closed Register Z-Report Document • Tareza ERP Enterprise Audit & Compliance System',
        14,
        289
      );
      doc.text(`Page ${i} of ${pageCount}`, 196, 289, { align: 'right' });
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
