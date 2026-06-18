import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/firebaseClient';
import { jsPDF } from 'jspdf';
import { 
  FileText, 
  FileSpreadsheet, 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  AlertCircle,
  Clock,
  Briefcase,
  History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

interface RegulatoryComplianceExportsProps {
  plSummary: any;
  balanceSheet: any;
  productSalesData: any[];
  startDate: string;
  endDate: string;
}

export function RegulatoryComplianceExports({
  plSummary,
  balanceSheet,
  productSalesData,
  startDate,
  endDate
}: RegulatoryComplianceExportsProps) {
  const [reportType, setReportType] = useState<string>('income');
  const [exportFormat, setExportFormat] = useState<string>('pdf');
  const [exporting, setExporting] = useState<boolean>(false);
  const [businessName, setBusinessName] = useState<string>('Tareza ERP Client');
  const [branchName, setBranchName] = useState<string>('All Branches');
  
  // Custom states to fetch inventory or audit ledger dynamically
  const [inventoryStats, setInventoryStats] = useState<any[]>([]);
  const [auditMovements, setAuditMovements] = useState<any[]>([]);

  useEffect(() => {
    async function loadMetaAndLedger() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        let bId = '';
        if (userData?.user) {
          const { data: bUser } = await supabase
            .from('business_users')
            .select('business_id')
            .eq('user_id', userData.user.id)
            .limit(1)
            .maybeSingle();
          if (bUser?.business_id) {
            bId = bUser.business_id;
            
            // Fetch business actual name
            const { data: bMeta } = await supabase
              .from('businesses')
              .select('name')
              .eq('id', bId)
              .maybeSingle();
            if (bMeta?.name) {
              setBusinessName(bMeta.name);
            }
          }
        }

        // Fetch Inventory Valuation detail stats
        let invQuery = supabase.from('inventory_batches').select('*');
        if (bId) invQuery = invQuery.eq('business_id', bId);
        const { data: batchData } = await invQuery;

        let prodQuery = supabase.from('products').select('id, name, sku, cost_price, retail_price');
        if (bId) prodQuery = prodQuery.eq('business_id', bId);
        const { data: prodData } = await prodQuery;

        if (batchData && prodData) {
          const mapped = batchData.map((b: any) => {
            const prod = prodData.find((p: any) => p.id === b.product_id);
            const cost = Number(b.cost_price || prod?.cost_price || 0);
            return {
              ...b,
              product_name: prod ? prod.name : 'Unknown Product',
              sku: prod ? prod.sku : '-',
              unit_cost: cost,
              total_valuation: Number(b.quantity || 0) * cost
            };
          }).filter(item => item.quantity > 0);
          setInventoryStats(mapped);
        }

        // Fetch audit ledger history
        let moveQuery = supabase.from('stock_movements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);
        if (bId) moveQuery = moveQuery.eq('business_id', bId);
        const { data: movementData } = await moveQuery;

        if (movementData) {
          const mappedMoves = movementData.map((m: any) => {
            const p = prodData?.find((prod: any) => prod.id === m.product_id);
            return {
              ...m,
              product_name: p ? p.name : 'Unknown Product',
              sku: p ? p.sku : '-'
            };
          });
          setAuditMovements(mappedMoves);
        }

      } catch (e) {
        console.error('Error loading meta labels for compliance page:', e);
      }
    }

    loadMetaAndLedger();
  }, [startDate, endDate]);

  const triggerExport = async () => {
    try {
      setExporting(true);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Compliance_${reportType}_${timestamp}`;

      if (exportFormat === 'csv') {
        runCsvExport(filename);
      } else {
        await runPdfExport(filename);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('An error occurred while building the compliance file.');
    } finally {
      setExporting(false);
    }
  };

  // 1. Generate formatted CSV
  const runCsvExport = (filename: string) => {
    let headers: string[] = [];
    let rows: string[][] = [];

    if (reportType === 'income') {
      headers = ['Line Descriptor', 'Debit / Credit Value (USD)'];
      rows = [
        ['OPERATIONAL REVENUE (Excl VAT)', plSummary.grossRevenue.toFixed(2)],
        ['Cost of Goods Sold (COGS)', `(${plSummary.costOfGoodsSold.toFixed(2)})`],
        ['Gross Profit Margin', plSummary.grossProfit.toFixed(2)],
        ['Operating Administrative Expenses', `(${plSummary.operatingExpenses.toFixed(2)})`],
        ['Income Before Tax Expense', plSummary.netProfit.toFixed(2)],
        ['Income Tax Expense (Calculated)', `(${plSummary.taxExpense.toFixed(2)})`],
        ['NET GAIN / LOSS FOR YEAR (IAS 1)', plSummary.netProfitAfterTax.toFixed(2)],
        ['Other Comprehensive Income (OCI - Net of tax)', plSummary.ociRevaluationSurplusNet.toFixed(2)],
        ['TOTAL COMPREHENSIVE PERIOD EARNINGS', plSummary.totalComprehensiveIncome.toFixed(2)]
      ];
    } else if (reportType === 'balance') {
      headers = ['IAS 1 Financial Position Account Class', 'Carrying Balance Amount (USD)'];
      rows = [
        ['ASSETS: Petty Cash Tills', balanceSheet.cashAsset.toFixed(2)],
        ['ASSETS: Trade Debtors (AR)', balanceSheet.receivableAsset.toFixed(2)],
        ['ASSETS: Merchandise Stock', balanceSheet.inventoryAsset.toFixed(2)],
        ['TOTAL CURRENT ASSETS', balanceSheet.currentAssets.toFixed(2)],
        ['ASSETS: Property, Plant & Equipment (PPE)', balanceSheet.ppeCost.toFixed(2)],
        ['ASSETS: Revaluation Index Adjust', balanceSheet.ppeAdjustment.toFixed(2)],
        ['TOTAL NON-CURRENT ASSETS', balanceSheet.nonCurrentAssets.toFixed(2)],
        ['TOTAL GAAP CORPORATE ASSETS', balanceSheet.totalAssets.toFixed(2)],
        ['LIABILITIES: Accounts Payable (AP)', balanceSheet.payableLiability.toFixed(2)],
        ['LIABILITIES: Long Term Corporate Loan', balanceSheet.longTermLoan.toFixed(2)],
        ['LIABILITIES: Deferred Tax Provisions', balanceSheet.deferredTaxLiability.toFixed(2)],
        ['TOTAL LIABILITIES', balanceSheet.totalLiabilities.toFixed(2)],
        ['EQUITY: Issued Share Capital', balanceSheet.shareCapital.toFixed(2)],
        ['EQUITY: Accumulated Retained Earnings', balanceSheet.closingRetainedEarnings.toFixed(2)],
        ['EQUITY: Revaluation Surplus Reserve', balanceSheet.revaluationReserve.toFixed(2)],
        ['TOTAL EQUITY CARRYING AMOUNT', balanceSheet.totalEquity.toFixed(2)],
        ['TOTAL LIABILITIES & EQUITY PARITY', balanceSheet.totalLiabilitiesAndEquity.toFixed(2)]
      ];
    } else if (reportType === 'inventory') {
      headers = ['Product Name', 'SKU', 'Batch Lot', 'Expiry Stamp', 'Quantity On Hand', 'Average Cost (USD)', 'Total Valuation (USD)'];
      inventoryStats.forEach((it: any) => {
        rows.push([
          it.product_name,
          it.sku,
          it.batch_number,
          it.expiry_date,
          it.quantity.toString(),
          it.unit_cost.toFixed(2),
          it.total_valuation.toFixed(2)
        ]);
      });
    } else if (reportType === 'ledger') {
      headers = ['StockMovementID', 'Timestamp', 'Product Name', 'SKU', 'Lot Batch', 'Variance Qty', 'Nature of Entry', 'Clerk / User ID'];
      auditMovements.forEach((m: any) => {
        rows.push([
          m.id,
          m.created_at,
          m.product_name,
          m.sku,
          m.batch_number || 'N/A',
          m.quantity.toString(),
          m.type,
          m.notes || 'No meta entry'
        ]);
      });
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV compiled and downloaded successfully!');
  };

  // 2. Generate pristine, styled PDF using jsPDF
  const runPdfExport = async (filename: string) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Formatting Helpers
    const drawDivider = (y: number) => {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(15, y, 195, y);
    };

    const drawHeader = () => {
      // Background Accent on Top Header (Elegant Dark Slate Profile of Tareza)
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 35, 'F');

      // Title & Branding
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('TAREZA CLOUD ERP', 15, 15);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Regulatory Corporate Audit & Tax Compliance Statements', 15, 21);
      doc.text('Powered by Tareza Smart Ledgers', 15, 26);

      // Metas right-aligned
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`BUSINESS: ${businessName.toUpperCase()}`, 195, 14, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(`AUDIT RANGE: ${startDate} to ${endDate}`, 195, 19, { align: 'right' });
      doc.text(`GENERATED: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`, 195, 24, { align: 'right' });
    };

    const drawFooter = (pageNum: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text('Confidential Document. For accounting audits, regulatory filings, and tax reporting only.', 15, 287);
      doc.text(`Page 1 of ${pageNum}`, 195, 287, { align: 'right' });
    };

    drawHeader();

    let y = 45;

    if (reportType === 'income') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(20, 30, 50);
      doc.text('STATEMENT OF COMPREHENSIVE INCOME (Profit & Loss)', 15, y);
      y += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Calculated according to International Accounting Standard (IAS) 1 standard reporting structure.', 15, y);
      
      y += 8;
      drawDivider(y);
      y += 7;

      // Profit & Loss Rows
      const plData = [
        { label: 'OPERATIONAL REVENUE (Gross of Sales)', val: plSummary.grossRevenue, bold: true },
        { label: 'Cost of Goods Sold (COGS)', val: -plSummary.costOfGoodsSold },
        { label: 'GROSS OPERATING PERIOD MARGIN', val: plSummary.grossProfit, bold: true, highlight: true },
        { label: 'General operating administrative expenses', val: -plSummary.operatingExpenses },
        { label: 'EARNINGS BEFORE TAXES (EBT)', val: plSummary.netProfit, bold: true },
        { label: 'Corporate taxation expense provision', val: -plSummary.taxExpense },
        { label: 'NET INCOME AFTER TAX', val: plSummary.netProfitAfterTax, bold: true, highlight: true },
        { label: 'Revaluation Surplus on Non-Current PPE Assets', val: plSummary.ociRevaluationSurplusNet },
        { label: 'TOTAL COMPREHENSIVE INCOME (IAS 1 Compliant)', val: plSummary.totalComprehensiveIncome, bold: true, highlight: true }
      ];

      plData.forEach((row) => {
        if (row.bold) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(17, 24, 39);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(75, 85, 99);
        }

        if (row.highlight) {
          doc.setFillColor(243, 244, 246);
          doc.rect(13, y - 4, 184, 6, 'F');
        }

        doc.setFontSize(10);
        doc.text(row.label, 15, y);
        
        let prefix = row.val < 0 ? '-$' : '$';
        let formattedVal = prefix + Math.abs(row.val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        doc.text(formattedVal, 190, y, { align: 'right' });
        y += 8;
      });

    } else if (reportType === 'balance') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(20, 30, 50);
      doc.text('STATEMENT OF FINANCIAL POSITION (Balance Sheet)', 15, y);
      y += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Balances carried at close of period compliant with IFRS standards.', 15, y);
      
      y += 8;
      drawDivider(y);
      y += 7;

      const bsData = [
        { label: 'ASSETS: Cash and cash equivalents', val: balanceSheet.cashAsset },
        { label: 'ASSETS: Trade Debtors (Receivables)', val: balanceSheet.receivableAsset },
        { label: 'ASSETS: Merchandise inventories', val: balanceSheet.inventoryAsset },
        { label: 'TOTAL CURRENT ASSETS', val: balanceSheet.currentAssets, bold: true },
        { label: 'ASSETS: Property, Plant & Equipment (PPE)', val: balanceSheet.ppeCost },
        { label: 'ASSETS: Fair value adjustment carrying revaluation', val: balanceSheet.ppeAdjustment },
        { label: 'TOTAL NON-CURRENT ASSETS', val: balanceSheet.nonCurrentAssets, bold: true },
        { label: 'TOTAL CUMULATIVE CONSOLIDATED ASSETS', val: balanceSheet.totalAssets, bold: true, highlight: true },
        { label: '', val: null }, // spacer
        { label: 'LIABILITIES: Trade payables & accounts payable', val: balanceSheet.payableLiability },
        { label: 'LIABILITIES: Financial bank loans (Long term)', val: balanceSheet.longTermLoan },
        { label: 'LIABILITIES: Deferred taxation provision liabilities', val: balanceSheet.deferredTaxLiability },
        { label: 'TOTAL CORPORATE LIABILITIES', val: balanceSheet.totalLiabilities, bold: true },
        { label: 'EQUITY: Contributed issued capital', val: balanceSheet.shareCapital },
        { label: 'EQUITY: Retained period reserves', val: balanceSheet.closingRetainedEarnings },
        { label: 'EQUITY: Cumulative revaluation reserves surplus', val: balanceSheet.revaluationReserve },
        { label: 'TOTAL SHAREHOLDER EQUITY BOOK VALUE', val: balanceSheet.totalEquity, bold: true },
        { label: 'TOTAL LIABILITIES AND SHAREHOLDER EQUITY', val: balanceSheet.totalLiabilitiesAndEquity, bold: true, highlight: true }
      ];

      bsData.forEach((row) => {
        if (!row.label) {
          y += 4;
          return;
        }

        if (row.bold) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(17, 24, 39);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(75, 85, 99);
        }

        if (row.highlight) {
          doc.setFillColor(243, 244, 246);
          doc.rect(13, y - 4, 184, 6, 'F');
        }

        doc.setFontSize(9.5);
        doc.text(row.label, 15, y);
        
        if (row.val !== null) {
          let formattedVal = '$' + Number(row.val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          doc.text(formattedVal, 190, y, { align: 'right' });
        }
        y += 7.5;
      });

    } else if (reportType === 'inventory') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(20, 30, 50);
      doc.text('INVENTORY VALUATION & REGULATORY LOT LOG', 15, y);
      y += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Audited on-hand stock batches with compliance aging values for health inspection verification.', 15, y);
      
      y += 8;
      drawDivider(y);
      y += 5;

      // Table Header
      doc.setFillColor(249, 250, 251);
      doc.rect(15, y, 180, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text('Product Name / SKU', 17, y + 5);
      doc.text('Batch Lot', 82, y + 5);
      doc.text('Expiry Stamp', 112, y + 5);
      doc.text('Stock On Hand', 142, y + 5);
      doc.text('Total Valuation', 175, y + 5);
      y += 11;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);

      const itemsToShow = inventoryStats.slice(0, 25); // cap on page 1

      itemsToShow.forEach((item: any) => {
        if (y > 270) {
          // simple pagination split
          doc.addPage();
          drawHeader();
          y = 45;
        }

        doc.setFont('helvetica', 'bold');
        doc.text(item.product_name.slice(0, 34), 17, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`SKU: ${item.sku.slice(0, 18)}`, 17, y + 3.5);

        doc.setFont('helvetica', 'bold');
        doc.text(item.batch_number.slice(0, 14), 82, y + 2);

        doc.setFont('helvetica', 'normal');
        doc.text(item.expiry_date, 112, y + 2);
        doc.text(`${item.quantity} units`, 142, y + 2);

        doc.setFont('helvetica', 'bold');
        doc.text(`$${Number(item.total_valuation).toFixed(2)}`, 175, y + 2);
        
        y += 8.5;
        doc.setDrawColor(240, 240, 240);
        doc.line(15, y - 2, 195, y - 2);
      });

      if (inventoryStats.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.text('No matching inventory lots found with active units on hand.', 17, y + 5);
      }

    } else if (reportType === 'ledger') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(20, 30, 50);
      doc.text('IMMUTABLE STOCK LEDGER & AUDIT TRAIL LOG', 15, y);
      y += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Immutable stock movement ledger logs capturing active discrepancies or variances.', 15, y);
      
      y += 8;
      drawDivider(y);
      y += 5;

      // Table Header
      doc.setFillColor(249, 250, 251);
      doc.rect(15, y, 180, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text('Timestamp / ID', 17, y + 5);
      doc.text('Product Description', 70, y + 5);
      doc.text('Batch No', 132, y + 5);
      doc.text('Net Flow', 162, y + 5);
      doc.text('Action Type', 180, y + 5);
      y += 11;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(50, 50, 50);

      const itemsToShow = auditMovements.slice(0, 24);

      itemsToShow.forEach((m: any) => {
        if (y > 270) {
          doc.addPage();
          drawHeader();
          y = 45;
        }

        doc.text(new Date(m.created_at).toISOString().replace('T', ' ').slice(0, 16), 17, y);
        doc.setFont('helvetica', 'bold');
        doc.text(m.product_name.slice(0, 30), 70, y);
        doc.setFont('helvetica', 'normal');
        doc.text(m.batch_number || '-', 132, y);

        const changeTxt = m.quantity > 0 ? `+${m.quantity}` : `${m.quantity}`;
        doc.setFont('helvetica', 'bold');
        if (m.quantity < 0) {
          doc.setTextColor(205, 50, 50);
        } else {
          doc.setTextColor(40, 140, 40);
        }
        doc.text(changeTxt, 162, y);

        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.text(m.type.slice(0, 12), 180, y);

        y += 8.5;
        doc.setDrawColor(240, 240, 240);
        doc.line(15, y - 2, 195, y - 2);
      });
    }

    // Add ZIMRA Tax Compliance Signature block at the bottom
    if (y < 230) {
      y = 235;
      drawDivider(y);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text('DECLARATION AND AUDITOR SIGN-OFF', 15, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Certified compiled on behalf of the company as true financial records matching ledger journals.', 15, y);
      y += 16;
      
      // Lines for signature
      doc.setDrawColor(150, 150, 150);
      doc.line(15, y, 90, y);
      doc.line(120, y, 195, y);
      y += 4;
      doc.setFont('helvetica', 'italic');
      doc.text('Prepared By: Chief Financial Officer / Accountant', 15, y);
      doc.text('Verified By: External Board Auditor / ZIMRA Assessor', 120, y);
    }

    drawFooter(doc.getNumberOfPages());
    doc.save(`${filename}.pdf`);
    toast.success('Pristine PDF document compiled and downloaded successfully!');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6">
      
      {/* Configuration Column */}
      <Card className="lg:col-span-5 border shadow bg-white rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-zinc-50 border-b pb-5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-indigo-650" />
            <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-950">Audit Export Configurator</CardTitle>
          </div>
          <CardDescription className="text-xs">Compile and download fully formatted files for corporate tax, board valuation, and public health records.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-zinc-700 block">1. Select Statement Type for Export</span>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="bg-white h-10 text-xs border-zinc-200">
                <SelectValue placeholder="Income Statement" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="income">Comprehensive Profit & Loss (IAS 1)</SelectItem>
                <SelectItem value="balance">Statement of Financial Position (Balance Sheet)</SelectItem>
                <SelectItem value="inventory">Inventory Asset Valuation Ledger (SOH Audit)</SelectItem>
                <SelectItem value="ledger">Immutable Variance & Scrap History (SOP Ledger)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-zinc-700 block">2. Select Target Document Format</span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                  exportFormat === 'pdf'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold'
                    : 'border-zinc-200 bg-white text-zinc-650 hover:bg-zinc-50'
                }`}
              >
                <FileText className="h-5 w-5 shrink-0" />
                <span className="text-xs">PDF Document</span>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                  exportFormat === 'csv'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-700 font-bold'
                    : 'border-zinc-200 bg-white text-zinc-650 hover:bg-zinc-50'
                }`}
              >
                <FileSpreadsheet className="h-5 w-5 shrink-0" />
                <span className="text-xs">CSV Spreadsheet</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-zinc-100">
            <div className="flex justify-between text-xs text-zinc-500 py-0.5">
              <span>Primary Business Unit</span>
              <span className="font-semibold text-zinc-800">{businessName}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 py-0.5">
              <span>Target Branch Log</span>
              <span className="font-semibold text-zinc-800">{branchName}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 py-0.5">
              <span>Tax/GST Region Code</span>
              <span className="font-semibold text-zinc-800">ZIMRA Class A</span>
            </div>
          </div>

          <Button
            onClick={triggerExport}
            disabled={exporting}
            className="w-full bg-indigo-650 text-white hover:bg-indigo-700 font-bold h-11 flex items-center justify-center gap-2 cursor-pointer rounded-xl select-none"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Processing Compliance Ledger...' : 'Generate and Download Statement'}
          </Button>

        </CardContent>
      </Card>

      {/* Preview Column */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="border shadow bg-white rounded-2xl overflow-hidden">
          <CardHeader className="bg-zinc-50 border-b pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-sm font-semibold">Regulatory Review Mockup Preview</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="border border-dashed border-zinc-250 p-4 rounded-xl bg-zinc-50/30 font-mono text-[11px] text-zinc-600 space-y-3.5 max-h-[360px] overflow-y-auto">
              {reportType === 'income' ? (
                <>
                  <div className="text-center font-bold pb-2 border-b border-zinc-200 uppercase">
                    {businessName} - Profit & Loss Statement (USD)
                  </div>
                  <div className="flex justify-between">
                    <span>Gross Revenue:</span>
                    <span className="font-bold text-zinc-900">${plSummary.grossRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Cost of Goods Sold (COGS):</span>
                    <span>-${plSummary.costOfGoodsSold.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-950 pt-1 border-t border-zinc-150">
                    <span>Gross Profit:</span>
                    <span>${plSummary.grossProfit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Administrative Operating Expenses:</span>
                    <span>-${plSummary.operatingExpenses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-950 pt-1 border-t">
                    <span>Earnings Before Tax:</span>
                    <span>${plSummary.netProfit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Corporate Provision Tax:</span>
                    <span>-${plSummary.taxExpense.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700 bg-emerald-50/50 p-1 rounded">
                    <span>Net Gain For Corporate Term:</span>
                    <span>${plSummary.netProfitAfterTax.toFixed(2)}</span>
                  </div>
                </>
              ) : reportType === 'balance' ? (
                <>
                  <div className="text-center font-bold pb-2 border-b border-zinc-200 uppercase">
                    {businessName} - Balance Sheet (IFRS Carrying Values)
                  </div>
                  <div className="font-bold border-b border-zinc-100 pb-0.5">1. Total Assets</div>
                  <div className="flex justify-between pl-3">
                    <span>- Cash Tills & Bank Deposits:</span>
                    <span>${balanceSheet.cashAsset.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-3">
                    <span>- Live Accounts Receivables (Debtors):</span>
                    <span>${balanceSheet.receivableAsset.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-3">
                    <span>- Asset Merchandise Stock valuation:</span>
                    <span>${balanceSheet.inventoryAsset.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-3 font-semibold text-zinc-900">
                    <span>Total Net Current Assets:</span>
                    <span>${balanceSheet.currentAssets.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-950 pt-1.5 border-t border-zinc-200">
                    <span>Total Cumulative Corporate Assets:</span>
                    <span>${balanceSheet.totalAssets.toFixed(2)}</span>
                  </div>
                  <div className="font-bold border-b border-zinc-100 pb-0.5 mt-2">2. Liabilities & Equity</div>
                  <div className="flex justify-between pl-3">
                    <span>- Trade Accounts Payables (Creditors):</span>
                    <span>${balanceSheet.payableLiability.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-3 font-semibold text-zinc-900">
                    <span>Total Liabilities Book Value:</span>
                    <span>${balanceSheet.totalLiabilities.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-3 font-semibold text-zinc-900">
                    <span>Total Equity Reserves Carried:</span>
                    <span>${balanceSheet.totalEquity.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-950 pt-1.5 border-t border-zinc-200">
                    <span>Total Liabilities and Shareholder Equity:</span>
                    <span>${balanceSheet.totalLiabilitiesAndEquity.toFixed(2)}</span>
                  </div>
                </>
              ) : reportType === 'inventory' ? (
                <>
                  <div className="text-center font-bold pb-2 border-b border-zinc-200 uppercase">
                    On-Hand Lot Valuation & Stock Aging Mockup (Count: {inventoryStats.length})
                  </div>
                  {inventoryStats.slice(0, 5).map((it, idx) => (
                    <div key={idx} className="flex justify-between border-b pb-1">
                      <div>
                        <span className="font-bold text-zinc-900">{it.product_name}</span>
                        <div className="text-[9px] text-zinc-400">Lot {it.batch_number} - Expiry: {it.expiry_date}</div>
                      </div>
                      <span className="font-bold">${it.total_valuation.toFixed(2)} ({it.quantity} Unit)</span>
                    </div>
                  ))}
                  {inventoryStats.length > 5 && (
                    <div className="text-center italic text-zinc-400 text-[10px] pt-1">
                      + {inventoryStats.length - 5} other active lots will compile in final file.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-center font-bold pb-2 border-b border-zinc-200 uppercase">
                    Sub-Ledger Variance Records Audit (Count: {auditMovements.length})
                  </div>
                  {auditMovements.slice(0, 5).map((m, idx) => (
                    <div key={idx} className="flex justify-between border-b pb-1 text-[10px]">
                      <div>
                        <span className="font-bold text-zinc-900">{m.product_name}</span>
                        <div className="text-[9px] text-zinc-400">Type: {m.type} - Note: {m.notes}</div>
                      </div>
                      <span className={`font-semibold ${m.quantity < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity} units
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="text-[11px] leading-relaxed text-zinc-500 space-y-2 py-2.5 px-3.5 rounded bg-zinc-50 border border-zinc-150">
              <div className="flex items-center gap-2 font-bold text-zinc-700">
                <AlertCircle className="h-4 w-4 text-indigo-650" /> Compliance Legal Disclaimer
              </div>
              <p>
                Under ZIMRA reporting regulations and standard operating guidelines, downloaded exports are legally classified as active business ledger outputs. Discrepancies between physical audits and system balances must be reconciled via authorized stocktaking adjustments.
              </p>
            </div>

          </CardContent>
        </Card>
      </div>

    </div>
  );
}
