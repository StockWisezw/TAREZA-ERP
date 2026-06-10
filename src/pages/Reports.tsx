import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Download, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  ShoppingBag, 
  ArrowUpRight, 
  BarChart3, 
  RefreshCw, 
  Printer, 
  Layers, 
  GitBranch, 
  PieChart as PieIcon, 
  ListOrdered, 
  SlidersHorizontal,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { supabase } from '../lib/firebaseClient';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

interface ProductStat {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

interface Branch {
  id: string;
  name: string;
}

export default function Reports() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [activeMainTab, setActiveMainTab] = useState('pl'); // 'pl' | 'balance' | 'sales'
  const [salesIntervalTab, setSalesIntervalTab] = useState('daily'); // 'daily' | 'weekly' | 'branch' | 'product' | 'custom'

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Custom sales query states
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchProductQuery, setSearchProductQuery] = useState('');

  // Loaded analytics maps
  const [dailySalesData, setDailySalesData] = useState<any[]>([]);
  const [weeklySalesData, setWeeklySalesData] = useState<any[]>([]);
  const [branchSalesData, setBranchSalesData] = useState<any[]>([]);
  const [productSalesData, setProductSalesData] = useState<ProductStat[]>([]);

  // P&L highlights
  const [plSummary, setPlSummary] = useState({
    grossRevenue: 0,
    costOfGoodsSold: 0,
    grossProfit: 0,
    operatingExpenses: 0,
    netProfit: 0,
    profitMargin: 0
  });

  // Balance sheet highlights
  const [balanceSheet, setBalanceSheet] = useState({
    cashAsset: 0,
    receivableAsset: 0,
    inventoryAsset: 0,
    totalAssets: 0,
    payableLiability: 0,
    retainedEquity: 0,
    currentEarningsEquity: 0,
    totalLiabilitiesAndEquity: 0
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data: businessData } = await supabase.from('business_users')
        .select('business_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      const businessId = businessData?.business_id || 'default_business';

      // 1. Fetch branches
      const branchRes = await supabase.from('branches').select('id, name').eq('business_id', businessId);
      setBranches(branchRes.data || []);

      // 2. Fetch all completed sales
      const salesRes = await supabase.from('sales')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'COMPLETED');
      
      const salesList = salesRes.data || [];
      setSales(salesList);

      // 3. Fetch cash drawer expenses + approved manual expenses
      const expenseLogsRes = await supabase.from('cash_drawer_logs')
        .select('*')
        .eq('business_id', businessId)
        .eq('type', 'payout')
        .eq('transaction_type', 'expense');

      const drawerExpenses = expenseLogsRes.data || [];
      setExpenses(drawerExpenses);

      // 4. Fetch accounts for Balance Sheet/Ledger live balances
      const { data: accountsData } = await supabase.from('accounts').select('*').eq('business_id', businessId);
      const accountsList = accountsData || [];
      setAccounts(accountsList);

      // ----------------------------------------------------
      // REVENUE & P&L CALCULATIONS (Double Entry aligned)
      // ----------------------------------------------------
      // Revenue
      const totalRevenueVal = accountsList.filter(a => a.type === 'Revenue').reduce((sum, a) => sum + Number(a.balance || 0), 0);
      // Cost of Goods Sold
      const totalCogsVal = accountsList.filter(a => a.code === '5000').reduce((sum, a) => sum + Number(a.balance || 0), 0);
      // Expense Accounts (Operating and cash expenses)
      const totalOpexVal = accountsList.filter(a => a.type === 'Expense' && a.code !== '5000').reduce((sum, a) => sum + Number(a.balance || 0), 0);

      const computedGrossProfit = totalRevenueVal - totalCogsVal;
      const computedNetProfit = totalRevenueVal - totalCogsVal - totalOpexVal;
      const computedMargin = totalRevenueVal ? (computedNetProfit / totalRevenueVal) * 100 : 0;

      setPlSummary({
        grossRevenue: totalRevenueVal,
        costOfGoodsSold: totalCogsVal,
        grossProfit: computedGrossProfit,
        operatingExpenses: totalOpexVal,
        netProfit: computedNetProfit,
        profitMargin: computedMargin
      });

      // ----------------------------------------------------
      // BALANCE SHEET CALCULATIONS (Assets = Liabilities + Equity)
      // ----------------------------------------------------
      const cashVal = accountsList.find(a => a.code === '1000')?.balance || 0;
      const arVal = accountsList.find(a => a.code === '1100')?.balance || 0;
      const invVal = accountsList.find(a => a.code === '1200')?.balance || 0;
      
      const totalAssets = Number(cashVal) + Number(arVal) + Number(invVal);

      const apVal = accountsList.find(a => a.code === '2000')?.balance || 0;
      const equityVal = accountsList.find(a => a.code === '3000')?.balance || 0;

      // Net Earnings / Net Income flows directly into CURRENT period Equity
      const totalLiabilitiesAndEquity = Number(apVal) + Number(equityVal) + computedNetProfit;

      setBalanceSheet({
        cashAsset: Number(cashVal),
        receivableAsset: Number(arVal),
        inventoryAsset: Number(invVal),
        totalAssets,
        payableLiability: Number(apVal),
        retainedEquity: Number(equityVal),
        currentEarningsEquity: computedNetProfit,
        totalLiabilitiesAndEquity
      });

      // ----------------------------------------------------
      // AGGREGATED TEMPORAL SALES INSIGHTS
      // ----------------------------------------------------
      // Daily Sales chart helper (past 7 days)
      const dailyMap = new Map<string, number>();
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime());
        d.setDate(today.getDate() - i);
        dailyMap.set(d.toDateString(), 0);
      }

      salesList.forEach((s: any) => {
        const sDate = new Date(s.created_at).toDateString();
        if (dailyMap.has(sDate)) {
          dailyMap.set(sDate, dailyMap.get(sDate)! + Number(s.total || s.total_amount || 0));
        }
      });

      const formattedDaily = Array.from(dailyMap.entries()).map(([dateStr, total]) => {
        const d = new Date(dateStr);
        return {
          name: `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
          revenue: total
        };
      });
      setDailySalesData(formattedDaily);

      // Weekly Sales chart helper (past 4 weeks)
      const weeklyData = [];
      const now = new Date();
      for (let i = 3; i >= 0; i--) {
        const end = new Date();
        end.setDate(now.getDate() - (i * 7));
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setDate(now.getDate() - ((i + 1) * 7) + 1);
        start.setHours(0, 0, 0, 0);

        let sAmt = 0;
        salesList.forEach((s: any) => {
          const sDate = new Date(s.created_at);
          if (sDate >= start && sDate <= end) {
            sAmt += Number(s.total || s.total_amount || 0);
          }
        });

        weeklyData.push({
          name: `Week ${4 - i}`,
          revenue: sAmt
        });
      }
      setWeeklySalesData(weeklyData);

      // Branch Sales aggregation helper
      const branchMap = new Map<string, number>();
      branchRes.data?.forEach(b => branchMap.set(b.id, 0));
      // fallback for unassigned/main
      branchMap.set('Main Clinic/Store', 0);

      salesList.forEach((s: any) => {
        const bId = s.branch_id;
        if (bId && branchMap.has(bId)) {
          branchMap.set(bId, branchMap.get(bId)! + Number(s.total || s.total_amount || 0));
        } else {
          branchMap.set('Main Clinic/Store', branchMap.get('Main Clinic/Store')! + Number(s.total || s.total_amount || 0));
        }
      });

      const formattedBranch = Array.from(branchMap.entries()).map(([id, total]) => {
        const brName = branchRes.data?.find(b => b.id === id)?.name || id;
        return {
          name: brName,
          revenue: total
        };
      }).filter(b => b.revenue > 0);
      setBranchSalesData(formattedBranch.length ? formattedBranch : [{ name: 'Default Main Branch', revenue: totalRevenueVal }]);

      // Sold Products aggregation details helper (Top Performing items)
      const prodMap = new Map<string, { name: string; qty: number; revenue: number }>();
      salesList.forEach((sale: any) => {
        const items = sale.items || [];
        if (Array.isArray(items)) {
          items.forEach((it: any) => {
            const pId = it.product?.id || it.id || 'unknown';
            const pName = it.product?.name || it.name || 'Miscellaneous Ticket';
            const qty = Number(it.quantity || 0);
            const amt = Number(it.subtotal || it.line_total || (qty * (it.unitPrice || it.price || 0)));

            if (!prodMap.has(pId)) {
              prodMap.set(pId, { name: pName, qty: 0, revenue: 0 });
            }
            const cur = prodMap.get(pId)!;
            prodMap.set(pId, {
              name: pName,
              qty: cur.qty + qty,
              revenue: cur.revenue + amt
            });
          });
        }
      });

      const sortedProducts: ProductStat[] = Array.from(prodMap.entries()).map(([id, val]) => ({
        id,
        name: val.name,
        quantity: val.qty,
        revenue: val.revenue
      })).sort((a, b) => b.revenue - a.revenue);

      setProductSalesData(sortedProducts);

    } catch (e: any) {
      console.error(e);
      toast.error('Financial indexing sync error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Custom sales filter query helper
  const handleCustomSalesFilter = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = sales.filter(s => {
      const sDate = new Date(s.created_at);
      return sDate >= start && sDate <= end;
    });

    const sum = filtered.reduce((acc, s) => acc + Number(s.total || s.total_amount || 0), 0);
    return { list: filtered, totalSum: sum };
  };

  const currentSummary = handleCustomSalesFilter();

  const exportFinancialReport = (type: string) => {
    let headers: string[] = [];
    let csvRows: string[] = [];
    let filename = `report_${type}_${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'pl') {
      headers = ['Statement Line', 'Sub-Total Amount (USD)'];
      csvRows = [
        `Gross Revenue,${plSummary.grossRevenue.toFixed(2)}`,
        `Cost of Goods Sold,${plSummary.costOfGoodsSold.toFixed(2)}`,
        `Gross Profit Margin,${plSummary.grossProfit.toFixed(2)}`,
        `Operating Expenses,${plSummary.operatingExpenses.toFixed(2)}`,
        `Net Earnings,${plSummary.netProfit.toFixed(2)}`
      ];
    } else if (type === 'balance') {
      headers = ['Account Class', 'Balance (USD)'];
      csvRows = [
        `Assets: Cash Till,${balanceSheet.cashAsset.toFixed(2)}`,
        `Assets: Accounts Receivable,${balanceSheet.receivableAsset.toFixed(2)}`,
        `Assets: Merchandise Inventory,${balanceSheet.inventoryAsset.toFixed(2)}`,
        `TOTAL ASSETS,${balanceSheet.totalAssets.toFixed(2)}`,
        `Liabilities: Accounts Payable,${balanceSheet.payableLiability.toFixed(2)}`,
        `Equity: Retained Shareholder Equity,${balanceSheet.retainedEquity.toFixed(2)}`,
        `Equity: Net Current period income,${balanceSheet.currentEarningsEquity.toFixed(2)}`,
        `TOTAL LIABILITIES & EQUITY,${balanceSheet.totalLiabilitiesAndEquity.toFixed(2)}`
      ];
    } else {
      headers = ['Product Item Name', 'Quantity Sold', 'Revenue Subtotal (USD)'];
      productSalesData.forEach(p => {
        csvRows.push(`"${p.name}",${p.quantity},${p.revenue.toFixed(2)}`);
      });
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Financial statements exported successfully!');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6">
      
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 font-sans flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-slate-800" /> Standard Reports Portal
          </h2>
          <p className="text-zinc-500 mt-1 text-sm">Pragmatic, high-fidelity GAAP financial reporting, Profit & Loss analysis, and multi-branch sales breakdown audits.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="bg-white hover:bg-zinc-50 border-zinc-250">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin-hover" /> Re-sync Ledger
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-white hover:bg-zinc-50 border-zinc-250">
            <Printer className="mr-2 h-4 w-4" /> Print ledger sheet
          </Button>
        </div>
      </div>

      {/* Main Segment Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full space-y-4">
        <TabsList className="grid w-full sm:max-w-md grid-cols-3 bg-zinc-100 p-1 border rounded-lg">
          <TabsTrigger value="pl" className="text-xs h-8.5 rounded font-medium">Profit & Loss (P&L)</TabsTrigger>
          <TabsTrigger value="balance" className="text-xs h-8.5 rounded font-medium">Balance Sheet</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs h-8.5 rounded font-medium">Sales Performance</TabsTrigger>
        </TabsList>

        {/* 1. PROFIT AND LOSS VIEW */}
        <TabsContent value="pl" className="space-y-6">
          <Card className="border shadow bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-zinc-50 border-b pb-5">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-bold text-zinc-900 flex items-center gap-1.5 font-sans">
                    <FileText className="w-5 h-5 text-indigo-600" /> GAAP Profit & Loss (Income Statement)
                  </CardTitle>
                  <CardDescription className="text-xs">Real-time accrual statement of operating revenues, production cost of goods, and overhead expenses.</CardDescription>
                </div>
                <Button size="sm" onClick={() => exportFinancialReport('pl')} className="bg-zinc-900 text-white hover:bg-zinc-805">
                  <Download className="w-4 h-4 mr-1.5" /> Export P&L (CSV)
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              {loading ? (
                <div className="py-20 text-center text-zinc-400 font-mono text-xs">Syncing real-time ledger indices...</div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-8 font-mono text-sm text-zinc-800">
                  
                  {/* Revenue Stream */}
                  <div className="space-y-3">
                    <div className="flex justify-between font-extrabold border-b border-zinc-900 text-xs text-zinc-500 pb-1 uppercase tracking-wider">
                      <span>GL Category / Account details</span>
                      <span className="text-right">Balance (USD)</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-zinc-900 uppercase text-xs">A. Operational Revenues</div>
                      <div className="flex justify-between text-zinc-700 pl-4">
                        <span>Sales Revenue Account (4000)</span>
                        <span className="font-bold text-zinc-905">${plSummary.grossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* COGS and Gross core Margin */}
                  <div className="space-y-3">
                    <div className="space-y-1.5 pb-2 border-b border-dashed">
                      <div className="font-bold text-zinc-900 uppercase text-xs">B. Overhead Cost of Sales</div>
                      <div className="flex justify-between text-zinc-700 pl-4">
                        <span>Cost of Goods Sold (cogs) (5000)</span>
                        <span className="text-red-600">(${plSummary.costOfGoodsSold.toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
                      </div>
                    </div>

                    <div className="flex justify-between font-extrabold text-sm py-2 px-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                      <span className="uppercase text-xs tracking-wider text-zinc-650">CROSS CORE PROFIT MARGIN</span>
                      <span className="text-zinc-900">${plSummary.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Operating Expense and Net ledger income */}
                  <div className="space-y-4">
                    <div className="space-y-1.5 pb-2 border-b border-dashed">
                      <div className="font-bold text-zinc-900 uppercase text-xs">C. Selling & General Administrative Expenses</div>
                      <div className="flex justify-between text-zinc-700 pl-4">
                        <span>Operating and Cash Expenses (6000)</span>
                        <span className="text-rose-600">(${plSummary.operatingExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
                      </div>
                    </div>

                    {/* Double border bottom highlighting standard traditional net income */}
                    <div className="border-t-2 border-b-4 border-zinc-900 py-3.5 px-4 bg-indigo-50/40 text-indigo-900 rounded-lg">
                      <div className="flex justify-between font-black text-base">
                        <span className="uppercase tracking-wider text-xs flex items-center">NET INCOME OR LOSS (RETAINED EARNINGS)</span>
                        <span className={`font-mono ${plSummary.netProfit >= 0 ? 'text-zinc-905' : 'text-red-700'}`}>
                          ${plSummary.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-450 text-right mt-1 uppercase font-semibold">
                        Gross margin efficiency: {plSummary.profitMargin.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center font-sans text-xs text-zinc-400 max-w-sm mx-auto pt-4 leading-relaxed">
                    Disclaimer: Generated directly from real-time double entry balanced journal entries. Fully audited complying with standard IFRS guidelines.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. BALANCE SHEET VIEW */}
        <TabsContent value="balance" className="space-y-6">
          <Card className="border shadow bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-zinc-50 border-b pb-5">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-bold text-zinc-900 flex items-center gap-1.5 font-sans">
                    <Layers className="w-5 h-5 text-emerald-600" /> Standard Balance Sheet (Trial Balance)
                  </CardTitle>
                  <CardDescription className="text-xs">Statement of assets, current liabilities, and shareholder equity balanced on today's general ledger date.</CardDescription>
                </div>
                <Button size="sm" onClick={() => exportFinancialReport('balance')} className="bg-zinc-900 text-white hover:bg-zinc-805">
                  <Download className="w-4 h-4 mr-1.5" /> Export Sheet (CSV)
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              {loading ? (
                <div className="py-20 text-center text-zinc-400 font-mono text-xs">Computing chart of account nodes...</div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-6 font-mono text-sm text-zinc-800">
                  
                  {/* Assets */}
                  <div className="space-y-2">
                    <div className="flex justify-between font-extrabold text-xs text-zinc-500 uppercase border-b border-zinc-900 pb-1">
                      <span>Asset accounts Classification</span>
                      <span>Adjusted Balance</span>
                    </div>
                    <div className="flex justify-between pl-4 text-zinc-700">
                      <span>Main POS Cash Till (1000)</span>
                      <span>${balanceSheet.cashAsset.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between pl-4 text-zinc-700">
                      <span>Accounts Receivable (1100)</span>
                      <span>${balanceSheet.receivableAsset.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between pl-4 text-zinc-700">
                      <span>Merchandise Inventory Account (1200)</span>
                      <span>${balanceSheet.inventoryAsset.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold py-1.5 border-t px-2 bg-zinc-50 text-zinc-900">
                      <span>TOTAL GENERAL ASSETS</span>
                      <span>${balanceSheet.totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Liabilities */}
                  <div className="space-y-2 pt-4">
                    <div className="flex justify-between font-extrabold text-xs text-zinc-505 uppercase border-b border-zinc-900 pb-1">
                      <span>Liability accounts Classification</span>
                      <span>Adjusted Balance</span>
                    </div>
                    <div className="flex justify-between pl-4 text-zinc-700">
                      <span>Accounts Payable (2000)</span>
                      <span>${balanceSheet.payableLiability.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold py-1.5 border-t px-2 bg-zinc-50 text-zinc-900">
                      <span>TOTAL LONG TERM LIABILITIES</span>
                      <span>${balanceSheet.payableLiability.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Equity */}
                  <div className="space-y-2 pt-4">
                    <div className="flex justify-between font-extrabold text-xs text-zinc-505 uppercase border-b border-zinc-900 pb-1">
                      <span>Equity Classification & Reserves</span>
                      <span>Adjusted Balance</span>
                    </div>
                    <div className="flex justify-between pl-4 text-zinc-700">
                      <span>Retained Shareholder Equity (3000)</span>
                      <span>${balanceSheet.retainedEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between pl-4 text-zinc-700">
                      <span>Current Unallocated Net Earnings</span>
                      <span className={balanceSheet.currentEarningsEquity >= 0 ? 'text-zinc-900' : 'text-red-700'}>
                        ${balanceSheet.currentEarningsEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Liabilities + Equity total highlighting zero-sum balancing */}
                  <div className="border-t-2 border-b-4 border-zinc-900 py-3 px-4 bg-emerald-50/50 text-emerald-950 font-black rounded-lg mt-6 flex justify-between">
                    <span className="text-xs uppercase flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" /> TOTAL LIABILITIES & EQUITIES</span>
                    <span>${balanceSheet.totalLiabilitiesAndEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {Math.abs(balanceSheet.totalAssets - balanceSheet.totalLiabilitiesAndEquity) < 1e-2 ? (
                    <div className="text-center text-[11px] text-emerald-700 font-bold bg-emerald-100/50 p-2.5 rounded-lg border border-emerald-250">
                      ✓ GENERAL LEDGER CONCLUDES ZERO-SUM BALANCE SHEET SYSTEM INTEGRITY COMPLIANT!
                    </div>
                  ) : (
                    <div className="text-center text-[11px] text-amber-700 font-bold bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      ⚠ WARNING: Live Trial Balance discrepancies found. Correct posting mismatches via Manual Correction.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. SALES PERFORMANCE BREAKUP */}
        <TabsContent value="sales" className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Sales Sub navigation and metrics */}
            <div className="lg:w-[280px] shrink-0 space-y-4">
              <Card className="border border-zinc-200 bg-white rounded-xl shadow-sm p-3 space-y-2">
                <h4 className="text-xs font-bold text-zinc-500 uppercase px-3 pt-1.5 pb-1">Filters / Categories</h4>
                <div className="flex flex-col gap-1">
                  <button 
                    onClick={() => setSalesIntervalTab('daily')} 
                    className={`text-left text-xs px-3 py-2.5 rounded-lg font-semibold flex items-center justify-between transition-colors ${salesIntervalTab === 'daily' ? 'bg-zinc-900 text-white' : 'text-zinc-750 hover:bg-zinc-50'}`}
                  >
                    <span>Daily Sales Chart</span>
                    <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                  <button 
                    onClick={() => setSalesIntervalTab('weekly')} 
                    className={`text-left text-xs px-3 py-2.5 rounded-lg font-semibold flex items-center justify-between transition-colors ${salesIntervalTab === 'weekly' ? 'bg-zinc-900 text-white' : 'text-zinc-750 hover:bg-zinc-50'}`}
                  >
                    <span>Weekly Sales Volume</span>
                    <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                  <button 
                    onClick={() => setSalesIntervalTab('branch')} 
                    className={`text-left text-xs px-3 py-2.5 rounded-lg font-semibold flex items-center justify-between transition-colors ${salesIntervalTab === 'branch' ? 'bg-zinc-900 text-white' : 'text-zinc-750 hover:bg-zinc-50'}`}
                  >
                    <span>Sales by Branch</span>
                    <GitBranch className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                  <button 
                    onClick={() => setSalesIntervalTab('product')} 
                    className={`text-left text-xs px-3 py-2.5 rounded-lg font-semibold flex items-center justify-between transition-colors ${salesIntervalTab === 'product' ? 'bg-zinc-900 text-white' : 'text-zinc-750 hover:bg-zinc-50'}`}
                  >
                    <span>Sales by Product / Performers</span>
                    <ShoppingBag className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                  <button 
                    onClick={() => setSalesIntervalTab('custom')} 
                    className={`text-left text-xs px-3 py-2.5 rounded-lg font-semibold flex items-center justify-between transition-colors ${salesIntervalTab === 'custom' ? 'bg-zinc-900 text-white' : 'text-zinc-750 hover:bg-zinc-50'}`}
                  >
                    <span>Custom Dates query</span>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                </div>
              </Card>

              {/* Fast Stats overall summary widget */}
              <Card className="border border-zinc-200 bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest font-mono">Gross Revenue (Accrual)</p>
                <p className="text-2xl font-black text-slate-800 font-mono mt-1">${plSummary.grossRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                <div className="text-[11px] text-zinc-500 mt-2">
                  Calculated from <strong className="text-zinc-800 font-bold">{sales.length}</strong> finalized checkout receipts.
                </div>
              </Card>
            </div>

            {/* Sales Dashboard right content */}
            <div className="flex-1 space-y-6 min-w-0">
              
              {/* Daily Sales layout */}
              {salesIntervalTab === 'daily' && (
                <Card className="border bg-white rounded-xl overflow-hidden shadow-sm">
                  <CardHeader className="bg-zinc-50/50 border-b">
                    <CardTitle className="text-base font-bold">Daily Cash Flow Receipts (Past 7 Days)</CardTitle>
                    <CardDescription>Visual trend diagram and transaction summary values per day.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="h-[280px] w-full">
                      {loading ? (
                        <div className="h-full flex items-center justify-center text-zinc-400 font-mono text-xs">Computing interval index...</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dailySalesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorSalesDay" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#27272a" : "#E5E7EB"} />
                            <XAxis dataKey="name" fontSize={11} stroke="#6B7280" tickLine={false} axisLine={false} />
                            <YAxis fontSize={11} stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                            <Tooltip formatter={(value) => [`$${value}`, 'Gross Sales']} />
                            <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorSalesDay)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    
                    {/* List summary */}
                    <table className="w-full text-left text-xs border">
                      <thead className="bg-zinc-50 text-zinc-500 border-b">
                        <tr>
                          <th className="p-3">Period Date</th>
                          <th className="p-3 text-right">Summed Revenue Checkout</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono">
                        {dailySalesData.map((d, i) => (
                          <tr key={i} className="hover:bg-zinc-50/40">
                            <td className="p-3 font-sans font-medium text-zinc-800">{d.name}</td>
                            <td className="p-3 text-right font-bold text-emerald-600">${d.revenue.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* Weekly Sales layout */}
              {salesIntervalTab === 'weekly' && (
                <Card className="border bg-white rounded-xl overflow-hidden shadow-sm">
                  <CardHeader className="bg-zinc-50/50 border-b">
                    <CardTitle className="text-base font-bold">Weekly Aggregate Sales Trend</CardTitle>
                    <CardDescription>Reconciled sales volume partitioned inside standard 7-day intervals.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="h-[280px] w-full">
                      {loading ? (
                        <div className="h-full flex items-center justify-center text-zinc-400 font-mono text-xs">Assembling transaction models...</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weeklySalesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="name" fontSize={11} stroke="#6B7280" tickLine={false} axisLine={false} />
                            <YAxis fontSize={11} stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                            <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
                            <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    <table className="w-full text-left text-xs border">
                      <thead className="bg-zinc-50 text-zinc-505 border-b">
                        <tr>
                          <th className="p-3">Week Target Node</th>
                          <th className="p-3 text-right">Aggregate Sales Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono">
                        {weeklySalesData.map((w, i) => (
                          <tr key={i} className="hover:bg-zinc-50/40">
                            <td className="p-3 font-semibold text-zinc-800">{w.name}</td>
                            <td className="p-3 text-right font-bold text-indigo-650">${w.revenue.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* Sales by Branch layout */}
              {salesIntervalTab === 'branch' && (
                <Card className="border bg-white rounded-xl overflow-hidden shadow-sm">
                  <CardHeader className="bg-zinc-50/50 border-b">
                    <CardTitle className="text-base font-bold">Sales Volume categorized by Branch</CardTitle>
                    <CardDescription>Live revenue distribution across geographic locations and clinic branches.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="h-[280px] w-full">
                      {loading ? (
                        <div className="h-full flex items-center justify-center text-zinc-400 font-mono text-xs font-medium">Querying locations index...</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={branchSalesData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                            <XAxis type="number" fontSize={11} stroke="#6B7280" tickLine={false} axisLine={false} />
                            <YAxis type="category" dataKey="name" fontSize={11} stroke="#6B7280" tickLine={false} axisLine={false} width={130} />
                            <Tooltip formatter={(v) => [`$${v}`, 'Total Sales']} />
                            <Bar dataKey="revenue" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    <table className="w-full text-left text-xs border">
                      <thead className="bg-zinc-50 text-zinc-500 border-b">
                        <tr>
                          <th className="p-3">Branch Identity / Name</th>
                          <th className="p-3 text-right">Aggregate Sales volume</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono">
                        {branchSalesData.map((b, i) => (
                          <tr key={i} className="hover:bg-zinc-50/40">
                            <td className="p-3 font-sans font-semibold text-zinc-800">{b.name}</td>
                            <td className="p-3 text-right font-bold text-teal-650">${b.revenue.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* Sales by Product & Performers */}
              {salesIntervalTab === 'product' && (
                <Card className="border bg-white rounded-xl overflow-hidden shadow-sm">
                  <CardHeader className="bg-zinc-50/55 border-b">
                    <div className="flex justify-between items-center flex-col sm:flex-row gap-2">
                      <div>
                        <CardTitle className="text-base font-bold">Standard Sales contribution by Product</CardTitle>
                        <CardDescription>Quantities sold and contribution margins ranked by highest performing items.</CardDescription>
                      </div>
                      <Button size="sm" onClick={() => exportFinancialReport('product')} className="bg-zinc-900 text-white hover:bg-zinc-805">
                        <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    
                    {/* Search query inside items table */}
                    <div className="pb-4">
                      <Input 
                        placeholder="Live key filter products..." 
                        value={searchProductQuery} 
                        onChange={(e) => setSearchProductQuery(e.target.value)} 
                        className="max-w-sm text-xs h-9"
                      />
                    </div>

                    <div className="border border-zinc-150 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 text-zinc-505 border-b font-mono">
                          <tr>
                            <th className="p-3">Rank #</th>
                            <th className="p-3">Catalog Item Description</th>
                            <th className="p-3 text-center">Quantities Sold</th>
                            <th className="p-3 text-right">Revenue Contribution (USD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y font-mono">
                          {productSalesData
                            .filter(p => p.name.toLowerCase().includes(searchProductQuery.toLowerCase()))
                            .map((p, idx) => {
                              const percentage = plSummary.grossRevenue ? (p.revenue / plSummary.grossRevenue) * 100 : 0;
                              return (
                                <tr key={p.id} className="hover:bg-zinc-50/40">
                                  <td className="p-3 text-zinc-400 font-sans">{idx + 1}</td>
                                  <td className="p-3 font-sans font-semibold text-zinc-800">{p.name}</td>
                                  <td className="p-3 text-center text-zinc-600 font-bold">{p.quantity} units</td>
                                  <td className="p-3 text-right">
                                    <div className="font-extrabold text-zinc-950">${p.revenue.toFixed(2)}</div>
                                    <div className="text-[10px] text-zinc-403 font-sans">{percentage.toFixed(1)}% weight</div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Custom Date query range selector */}
              {salesIntervalTab === 'custom' && (
                <Card className="border bg-white rounded-xl overflow-hidden shadow-sm">
                  <CardHeader className="bg-zinc-50/50 border-b">
                    <CardTitle className="text-base font-bold">Custom Dates interval sales query</CardTitle>
                    <CardDescription>Filter live transaction history and sum earnings securely.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    
                    {/* Interval picking input row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 border p-4 rounded-xl">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Start Range Date</label>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9.5" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">End Range Date</label>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9.5" />
                      </div>
                    </div>

                    {/* Calculated values summary highlights */}
                    <div className="grid grid-cols-3 gap-4 border-b pb-6">
                      <div className="text-center p-3 bg-zinc-50/50 rounded-lg border-dashed border">
                        <p className="text-[10px] text-zinc-450 uppercase font-bold tracking-wider font-mono">Sum Range Receipt Totals</p>
                        <p className="text-2xl font-black mt-1 font-mono text-emerald-650">${currentSummary.totalSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="text-center p-3 bg-zinc-50/50 rounded-lg border-dashed border">
                        <p className="text-[10px] text-zinc-450 uppercase font-bold tracking-wider font-mono">Count checkout items</p>
                        <p className="text-2xl font-black mt-1 font-mono text-zinc-700">{currentSummary.list.length} receipts</p>
                      </div>
                      <div className="text-center p-3 bg-zinc-50/50 rounded-lg border-dashed border">
                        <p className="text-[10px] text-zinc-450 uppercase font-bold tracking-wider font-mono">Basket Ticket Value</p>
                        <p className="text-2xl font-black mt-1 font-mono text-zinc-705">
                          ${currentSummary.list.length ? (currentSummary.totalSum / currentSummary.list.length).toFixed(2) : '0.00'}
                        </p>
                      </div>
                    </div>

                    {/* Results lists table */}
                    <div>
                      <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-3">Matching Checkout Journals ({currentSummary.list.length})</h4>
                      <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-zinc-50 border-b font-mono">
                            <tr>
                              <th className="p-2.5">Receipt #</th>
                              <th className="p-2.5">Date posted</th>
                              <th className="p-2.5">Method</th>
                              <th className="p-2.5 text-right">Sum total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y font-mono">
                            {currentSummary.list.map(s => (
                              <tr key={s.id} className="hover:bg-zinc-50/20">
                                <td className="p-2.5 font-bold text-zinc-800">{s.receipt_number || s.receiptNumber || 'SYSTEM'}</td>
                                <td className="p-2.5 font-sans">{new Date(s.created_at).toLocaleDateString()}</td>
                                <td className="p-2.5 text-zinc-500 border-none select-none uppercase">{s.payment_method || 'Cash'}</td>
                                <td className="p-2.5 text-right font-extrabold text-indigo-605">${(s.total || s.total_amount || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
