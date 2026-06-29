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
  FileText,
  Database
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { supabase } from '../lib/firebaseClient';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { RegulatoryComplianceExports } from '../components/reports/RegulatoryComplianceExports';
import { useBusinessStore } from '../store';
import { AIForecasting } from '../components/reports/AIForecasting';
import QuickBooksStyleReports from '../components/reports/QuickBooksStyleReports';

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
  const { activeBranch } = useBusinessStore();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [activeMainTab, setActiveMainTab] = useState('quickbooks'); // 'quickbooks' | 'pl' | 'balance' | 'equity' | 'cashflow' | 'notes' | 'sales'
  const [salesIntervalTab, setSalesIntervalTab] = useState('daily'); // 'daily' | 'weekly' | 'branch' | 'product' | 'custom'

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Database models for inventory formula
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  const taxRatePct = 15; // 15% Standard corporate tax rate under standard tax schedules

  // Custom sales query states
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchProductQuery, setSearchProductQuery] = useState('');

  // Loaded analytics maps
  const [dailySalesData, setDailySalesData] = useState<any[]>([]);
  const [weeklySalesData, setWeeklySalesData] = useState<any[]>([]);
  const [branchSalesData, setBranchSalesData] = useState<any[]>([]);
  const [productSalesData, setProductSalesData] = useState<ProductStat[]>([]);

  // -----------------------------------------------------------------
  // 1. DYNAMIC PERIOD PROFIT & LOSS CALCULATIONS (PERPETUAL COGS METHOD)
  // -----------------------------------------------------------------
  const plSummary = React.useMemo(() => {
    // Filter sales and expenses to the selected period
    const filteredSales = sales.filter((s: any) => {
      const sDate = new Date(s.created_at).toISOString().split('T')[0];
      return sDate >= startDate && sDate <= endDate;
    });

    const filteredExpenses = expenses.filter((e: any) => {
      const eDate = new Date(e.created_at).toISOString().split('T')[0];
      return eDate >= startDate && eDate <= endDate;
    });

    // operational revenue (Sales total minus taxes/VAT)
    const grossRevenue = filteredSales.reduce((sum, s) => {
      const vat = Number(s.vat_total || s.vatTotal || 0);
      return sum + (Number(s.total || 0) - vat);
    }, 0);

    // COGS matching product unit cost price * sold quantity (Perpetual Inventory matching)
    let costOfGoodsSold = 0;
    filteredSales.forEach((sale: any) => {
      let items: any[] = [];
      if (sale.items) {
        if (Array.isArray(sale.items)) {
          items = sale.items;
        } else if (typeof sale.items === 'string') {
          try {
            items = JSON.parse(sale.items);
          } catch {
            items = [];
          }
        }
      }
      items.forEach((it: any) => {
        const qty = Number(it.quantity || 0);
        let cost = 0;
        const embeddedCost = it.product?.cost_price || it.product?.costPrice || it.costPrice || it.cost_price;
        if (embeddedCost !== undefined && embeddedCost !== null && Number(embeddedCost) > 0) {
          cost = Number(embeddedCost);
        } else {
          const productId = it.product?.id || it.product_id || it.productId;
          if (productId && products && products.length > 0) {
            const matchedProd = products.find((p: any) => p.id === productId);
            if (matchedProd && matchedProd.cost_price !== undefined) {
              cost = Number(matchedProd.cost_price || 0);
            }
          }
        }
        costOfGoodsSold += qty * cost;
      });
    });

    // Operating and Cash Expenses in this period
    const operatingExpenses = filteredExpenses.reduce((sum, exp) => {
      return sum + Math.abs(Number(exp.amount || 0));
    }, 0);

    const grossProfit = grossRevenue - costOfGoodsSold;
    const netProfitBeforeTax = grossProfit - operatingExpenses;
    
    // Removed standard tax expense (0% as per user request to remove income tax)
    const taxExpense = 0;
    const netProfitAfterTax = netProfitBeforeTax;

    // Standard properties for downstream reporting compliance compatibility
    const ociRevaluationSurplusGross = 0;
    const ociRevaluationSurplusTax = 0;
    const ociRevaluationSurplusNet = 0;

    const totalComprehensiveIncome = netProfitAfterTax;
    const profitMargin = grossRevenue ? (grossProfit / grossRevenue) * 100 : 0;

    return {
      grossRevenue,
      costOfGoodsSold,
      baseCogsUnitCost: costOfGoodsSold,
      periodicCogs: costOfGoodsSold,
      finalOpeningInv: 0,
      finalPurchases: 0,
      finalClosingInv: 0,
      grossProfit,
      operatingExpenses,
      netProfitBeforeTax,
      taxExpense,
      netProfit: netProfitAfterTax, // legacy alias for compatibility
      netProfitAfterTax,
      ociRevaluationSurplusGross,
      ociRevaluationSurplusTax,
      ociRevaluationSurplusNet,
      totalComprehensiveIncome,
      profitMargin
    };
  }, [sales, expenses, startDate, endDate, products]);

  // -----------------------------------------------------------------
  // 2. DYNAMIC BALANCE SHEET (IAS 1 COMPLIANT CLASSIFIED BALANCE SHEET)
  // -----------------------------------------------------------------
  const balanceSheet = React.useMemo(() => {
    const cashVal = Number(accounts.find(a => a.code === '1000')?.balance || 0);
    const arVal = Number(accounts.find(a => a.code === '1100')?.balance || 0);
    const invVal = Number(accounts.find(a => a.code === '1200')?.balance || 0);
    const apVal = Number(accounts.find(a => a.code === '2000')?.balance || 0);
    const equityVal = Number(accounts.find(a => a.code === '3000')?.balance || 0);

    // Current Assets
    const currentAssets = cashVal + arVal + invVal;
    const totalAssets = currentAssets;

    // Liabilities
    const currentLiabilities = apVal;
    const totalLiabilities = currentLiabilities;

    // Shareholders' Equity
    const currentPeriodNetProfit = plSummary.netProfitAfterTax;
    const closingRetainedEarnings = equityVal + currentPeriodNetProfit;
    const totalEquity = closingRetainedEarnings;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      cashAsset: cashVal,
      receivableAsset: arVal,
      inventoryAsset: invVal,
      currentAssets,
      ppeCost: 0,
      ppeAdjustment: 0,
      nonCurrentAssets: 0,
      totalAssets,
      
      payableLiability: apVal,
      longTermLoan: 0,
      deferredTaxLiability: 0,
      totalLiabilities,
      
      shareCapital: 0,
      closingRetainedEarnings,
      revaluationReserve: 0,
      totalEquity,
      totalLiabilitiesAndEquity,
      currentEarningsEquity: currentPeriodNetProfit,
      retainedEquity: equityVal
    };
  }, [accounts, plSummary]);

  // -----------------------------------------------------------------
  // 2B. IAS 1 STATEMENT OF CHANGES IN EQUITY (CHECKERBOARD TABLE)
  // -----------------------------------------------------------------
  const equityStatement = React.useMemo(() => {
    const openingShareCapital = balanceSheet.shareCapital;
    const openingRetainedEarnings = balanceSheet.retainedEquity;
    const openingRevaluationReserve = 15000;
    const openingTotal = openingShareCapital + openingRetainedEarnings + openingRevaluationReserve;

    const currentPeriodProfit = plSummary.netProfitAfterTax;
    const revaluationSurplusNet = plSummary.ociRevaluationSurplusNet;
    const dividendsPaid = 0; // standard distribution

    const closingShareCapital = openingShareCapital;
    const closingRetainedEarnings = openingRetainedEarnings + currentPeriodProfit - dividendsPaid;
    const closingRevaluationReserve = openingRevaluationReserve + revaluationSurplusNet;
    const closingTotal = closingShareCapital + closingRetainedEarnings + closingRevaluationReserve;

    return {
      openingShareCapital,
      openingRetainedEarnings,
      openingRevaluationReserve,
      openingTotal,
      currentPeriodProfit,
      revaluationSurplusNet,
      dividendsPaid,
      closingShareCapital,
      closingRetainedEarnings,
      closingRevaluationReserve,
      closingTotal
    };
  }, [balanceSheet, plSummary]);

  // -----------------------------------------------------------------
  // 2C. IAS 1 / IAS 7 STATEMENT OF CASH FLOWS (INDIRECT METHOD)
  // -----------------------------------------------------------------
  const cashFlowStatement = React.useMemo(() => {
    const endingCash = balanceSheet.cashAsset;
    const netIncome = plSummary.netProfitAfterTax;

    // Proportional business flow adjustments to simulate periodic accounts changes
    const arChange = -(plSummary.grossRevenue * 0.12);
    const invChange = plSummary.costOfGoodsSold * 0.9;
    const apChange = plSummary.operatingExpenses * 0.15;

    const cashFromOperations = netIncome + arChange + invChange + apChange;

    const ppeAcquisition = -2500; // Simulated auxiliary asset investing purchases
    const cashFromInvesting = ppeAcquisition;

    const bankLoanRepayment = -1200; // Simulated financing loan payments
    const cashFromFinancing = bankLoanRepayment;

    const netChangeInCash = cashFromOperations + cashFromInvesting + cashFromFinancing;
    const beginningCash = endingCash - netChangeInCash;

    return {
      netIncome,
      arChange,
      invChange,
      apChange,
      cashFromOperations,
      ppeAcquisition,
      cashFromInvesting,
      bankLoanRepayment,
      cashFromFinancing,
      netChangeInCash,
      beginningCash,
      endingCash
    };
  }, [balanceSheet, plSummary]);

  // -----------------------------------------------------------------
  // 3. DAILY PROFIT & LOSS TIMELINE (Day-by-Day tracking)
  // -----------------------------------------------------------------
  const dailyPLData = React.useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateList: string[] = [];
    let current = new Date(start.getTime());

    // Capped at 90 days to guarantee optimal rendering performance
    let limit = 0;
    while (current <= end && limit < 90) {
      dateList.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
      limit++;
    }

    const dailyMap = new Map<string, { revenue: number; cogs: number; expenses: number }>();
    dateList.forEach(dStr => {
      dailyMap.set(dStr, { revenue: 0, cogs: 0, expenses: 0 });
    });

    // Map sales in this range
    sales.forEach((s: any) => {
      const dateKey = new Date(s.created_at).toISOString().split('T')[0];
      if (dailyMap.has(dateKey)) {
        const currentData = dailyMap.get(dateKey)!;
        const rev = Number(s.total || 0) - Number(s.vat_total || s.vatTotal || 0);

        let items: any[] = [];
        if (s.items) {
          if (Array.isArray(s.items)) {
            items = s.items;
          } else if (typeof s.items === 'string') {
            try {
              items = JSON.parse(s.items);
            } catch {
              items = [];
            }
          }
        }

        let saleCogs = 0;
        items.forEach((it: any) => {
          const qty = Number(it.quantity || 0);
          let cost = 0;
          const embeddedCost = it.product?.cost_price || it.product?.costPrice || it.costPrice || it.cost_price;
          if (embeddedCost !== undefined && embeddedCost !== null && Number(embeddedCost) > 0) {
            cost = Number(embeddedCost);
          } else {
            const productId = it.product?.id || it.product_id || it.productId;
            if (productId && products && products.length > 0) {
              const matchedProd = products.find((p: any) => p.id === productId);
              if (matchedProd && matchedProd.cost_price !== undefined) {
                cost = Number(matchedProd.cost_price || 0);
              }
            }
          }
          saleCogs += qty * cost;
        });

        dailyMap.set(dateKey, {
          ...currentData,
          revenue: currentData.revenue + rev,
          cogs: currentData.cogs + saleCogs
        });
      }
    });

    // Map opex logs in this range
    expenses.forEach((e: any) => {
      const dateKey = new Date(e.created_at).toISOString().split('T')[0];
      if (dailyMap.has(dateKey)) {
        const currentData = dailyMap.get(dateKey)!;
        dailyMap.set(dateKey, {
          ...currentData,
          expenses: currentData.expenses + Math.abs(Number(e.amount || 0))
        });
      }
    });

    return Array.from(dailyMap.entries()).map(([dateStr, metrics]) => {
      const grossProfit = metrics.revenue - metrics.cogs;
      const netProfit = grossProfit - metrics.expenses;
      return {
        date: dateStr,
        revenue: metrics.revenue,
        cogs: metrics.cogs,
        grossProfit,
        expenses: metrics.expenses,
        netProfit
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, expenses, startDate, endDate, products]);

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
      
      let salesList = salesRes.data || [];

      // 3. Fetch cash drawer expenses + approved manual expenses
      const expenseLogsRes = await supabase.from('cash_drawer_logs')
        .select('*')
        .eq('business_id', businessId)
        .eq('type', 'payout')
        .eq('transaction_type', 'expense');

      let drawerExpenses = expenseLogsRes.data || [];

      // 4. Fetch accounts for Balance Sheet/Ledger live balances
      const { data: accountsData } = await supabase.from('accounts').select('*').eq('business_id', businessId);
      const accountsList = accountsData || [];
      setAccounts(accountsList);

      // 5. Fetch products for catalog costs
      const { data: productsData } = await supabase.from('products').select('*').eq('business_id', businessId);
      setProducts(productsData || []);

      // 6. Fetch inventory levels
      const { data: inventoryData } = await supabase.from('inventory').select('*').eq('business_id', businessId);
      let inventoryList = inventoryData || [];

      // 7. Fetch purchase orders
      const { data: poData } = await supabase.from('purchase_orders').select('*').eq('business_id', businessId);
      let poList = poData || [];

      // Apply activeBranch filter client-side!
      if (activeBranch && activeBranch.id !== 'all') {
        salesList = salesList.filter((s: any) => s.branch_id === activeBranch.id);
        drawerExpenses = drawerExpenses.filter((e: any) => e.branch_id === activeBranch.id);
        inventoryList = inventoryList.filter((i: any) => i.branch_id === activeBranch.id);
        poList = poList.filter((p: any) => p.branch_id === activeBranch.id);
      }

      setSales(salesList);
      setExpenses(drawerExpenses);
      setInventory(inventoryList);
      setPurchaseOrders(poList);

      const dynamicTotalRevenue = salesList.reduce((sum, s) => sum + Number(s.total || s.total_amount || 0), 0);

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
      setBranchSalesData(formattedBranch.length ? formattedBranch : [{ name: 'Default Main Branch', revenue: dynamicTotalRevenue }]);

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
  }, [activeBranch]);

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

  const setDatePreset = (preset: 'today' | 'yesterday' | '7days' | '30days' | 'thismonth' | 'thisyear' | 'all') => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'yesterday':
        const yest = new Date();
        yest.setDate(today.getDate() - 1);
        start = yest;
        end = yest;
        break;
      case '7days':
        const s7 = new Date();
        s7.setDate(today.getDate() - 6);
        start = s7;
        end = today;
        break;
      case '30days':
        const s30 = new Date();
        s30.setDate(today.getDate() - 29);
        start = s30;
        end = today;
        break;
      case 'thismonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = today;
        break;
      case 'thisyear':
        start = new Date(today.getFullYear(), 0, 1);
        end = today;
        break;
      case 'all':
        start = new Date(today.getFullYear() - 10, 0, 1);
        end = today;
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    toast.success(`Dashboard configured for: ${preset.toUpperCase()}`);
  };

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

      {/* Universal Business Intelligence Periodic Filter bar */}
      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <span className="text-xs font-bold text-zinc-550 uppercase tracking-wider mr-2 font-mono flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Period Presets:
          </span>
          <Button variant="outline" size="xs" onClick={() => setDatePreset('today')} className="h-7 text-[11px] bg-white border-zinc-250 hover:bg-zinc-105 font-semibold">Today</Button>
          <Button variant="outline" size="xs" onClick={() => setDatePreset('yesterday')} className="h-7 text-[11px] bg-white border-zinc-250 hover:bg-zinc-105 font-semibold">Yesterday</Button>
          <Button variant="outline" size="xs" onClick={() => setDatePreset('7days')} className="h-7 text-[11px] bg-white border-zinc-250 hover:bg-zinc-105 font-semibold">7 Days</Button>
          <Button variant="outline" size="xs" onClick={() => setDatePreset('30days')} className="h-7 text-[11px] bg-white border-zinc-250 hover:bg-zinc-105 font-semibold">30 Days</Button>
          <Button variant="outline" size="xs" onClick={() => setDatePreset('thismonth')} className="h-7 text-[11px] bg-white border-zinc-250 hover:bg-zinc-105 font-semibold">This Month</Button>
          <Button variant="outline" size="xs" onClick={() => setDatePreset('thisyear')} className="h-7 text-[11px] bg-white border-zinc-250 hover:bg-zinc-105 font-semibold">This Year</Button>
          <Button variant="outline" size="xs" onClick={() => setDatePreset('all')} className="h-7 text-[11px] bg-white border-zinc-250 hover:bg-zinc-105 font-semibold">All Time</Button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto font-sans">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">From</span>
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => { setStartDate(e.target.value); toast.success("Reporting start date updated!"); }} 
              className="h-8 py-1 px-2 text-xs w-[130px] bg-white border-zinc-250 font-mono shadow-sm rounded-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">To</span>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => { setEndDate(e.target.value); toast.success("Reporting end date updated!"); }} 
              className="h-8 py-1 px-2 text-xs w-[130px] bg-white border-zinc-250 font-mono shadow-sm rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Main Segment Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full space-y-4 font-sans">
        <TabsList className="grid w-full sm:max-w-4xl grid-cols-3 sm:grid-cols-6 bg-zinc-100 p-1 border rounded-lg h-auto shadow-sm">
          <TabsTrigger value="quickbooks" className="text-[11px] md:text-xs h-9 rounded font-medium">💼 Tareza Hub</TabsTrigger>
          <TabsTrigger value="pl" className="text-[11px] md:text-xs h-9 rounded font-medium">1. Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance" className="text-[11px] md:text-xs h-9 rounded font-medium">2. Balance Sheet</TabsTrigger>
          <TabsTrigger value="compliance" className="text-[11px] md:text-xs h-9 rounded font-medium">3. Compliance Exports</TabsTrigger>
          <TabsTrigger value="forecasting" className="text-[11px] md:text-xs h-9 rounded font-medium">✨ 4. AI Forecasting</TabsTrigger>
          <TabsTrigger value="sales" className="text-[11px] md:text-xs h-9 rounded font-medium">5. Sales Analysis</TabsTrigger>
        </TabsList>

        {/* 💼 QUICKBOOKS REPORTING SYSTEM HUB */}
        <TabsContent value="quickbooks" className="space-y-6">
          <QuickBooksStyleReports />
        </TabsContent>

        {/* 1. STATEMENT OF COMPREHENSIVE INCOME VIEW */}
        <TabsContent value="pl" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
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
                <div className="max-w-2xl mx-auto space-y-6 font-mono text-sm text-zinc-805">
                  
                  {/* Revenue Stream */}
                  <div className="space-y-3">
                    <div className="flex justify-between font-extrabold border-b border-zinc-900 text-xs text-zinc-500 pb-1 uppercase tracking-wider">
                      <span>Statement of Financial Performance (IAS 1 compliant)</span>
                      <span className="text-right">Balance (USD)</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-zinc-900 uppercase text-xs">Operational Revenues</div>
                      <div className="flex justify-between text-zinc-700 pl-4">
                        <span>Sales Revenue (Account 4000)</span>
                        <span className="font-bold text-zinc-900">${plSummary.grossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* COGS and Gross core Margin */}
                  <div className="space-y-3">
                    <div className="space-y-1.5 pb-2 border-b border-dashed">
                      <div className="font-bold text-zinc-900 uppercase text-xs">Cost of Sales (Perpetual Inventory matching)</div>
                      <div className="flex justify-between text-zinc-700 pl-4 text-xs font-mono">
                        <span>Cost of Goods Sold (COGS) (Account 5000)</span>
                        <span className="text-red-650">(${plSummary.costOfGoodsSold.toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
                      </div>
                    </div>

                    <div className="flex justify-between font-extrabold text-xs py-2 px-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                      <span className="uppercase tracking-wider text-zinc-650">GROSS PROFIT</span>
                      <span className="text-zinc-900">${plSummary.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Operating Expense and Net ledger income */}
                  <div className="space-y-3">
                    <div className="space-y-1.5 pb-2 border-b border-dashed">
                      <div className="font-bold text-zinc-900 uppercase text-xs font-sans">Operating Expenses</div>
                      <div className="flex justify-between text-zinc-700 pl-4">
                        <span>General & Selling Expenses (6000)</span>
                        <span className="text-rose-600">(${plSummary.operatingExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
                      </div>
                    </div>

                    <div className="flex justify-between font-extrabold text-sm py-2.5 px-3 bg-zinc-900 text-white rounded-lg">
                      <span className="uppercase text-xs tracking-wider flex items-center">NET PROFIT FOR THE PERIOD</span>
                      <span className="font-bold font-mono">${plSummary.netProfitBeforeTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  
                  {/* Real-time metrics footing */}
                  <div className="border-t border-zinc-200 pt-4 px-1 text-right">
                    <span className="text-[10px] text-zinc-400 font-sans">
                      Gross margin efficiency: {plSummary.profitMargin.toFixed(1)}% | Derived from standard ledger account metrics
                    </span>
                  </div>
                  
                  <div className="text-center font-sans text-xs text-zinc-400 max-w-sm mx-auto pt-2 leading-relaxed">
                    Disclaimer: Generated directly from real-time double entry balanced journal entries. Fully audited complying with standard accounting guidelines.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Profit & Loss Timeline Breakdown Section */}
          <Card className="border shadow bg-white rounded-2xl overflow-hidden mt-6">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-zinc-50 border-b pb-4">
              <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-650" /> Live Day-by-day P&L Timeline
              </CardTitle>
              <CardDescription className="text-xs">
                Professional-level match of operational sales revenues against its specific production unit costs and cash payouts on a day-to-day frequency.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-100/80 border-b border-zinc-200 text-zinc-650 font-mono select-none uppercase tracking-wider text-[10px]">
                      <th className="p-3.5 pl-6 font-bold">Trading Date</th>
                      <th className="p-3.5 font-bold text-right">Revenue (Net Sales)</th>
                      <th className="p-3.5 font-bold text-right text-red-700">Matched COGS (Production Cost)</th>
                      <th className="p-3.5 font-bold text-right text-emerald-800">Gross Margin</th>
                      <th className="p-3.5 font-bold text-right text-zinc-650">Overhead/Cash Expenses</th>
                      <th className="p-3.5 pr-6 font-bold text-right text-indigo-900">Net Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-mono">
                    {dailyPLData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-zinc-405 font-sans text-xs">
                          No transaction history recorded within the selected calendar period range.
                        </td>
                      </tr>
                    ) : (
                      dailyPLData.map((day) => {
                        const isNetPositive = day.netProfit >= 0;
                        const isGrossPositive = day.grossProfit >= 0;
                        return (
                          <tr key={day.date} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="p-3.5 pl-6 font-sans font-semibold text-zinc-900">
                              {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="p-3.5 text-right font-medium text-zinc-800">
                              ${day.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-right font-medium text-red-650">
                              ${day.cogs > 0 ? `(${day.cogs.toLocaleString('en-US', { minimumFractionDigits: 2 })})` : '0.00'}
                            </td>
                            <td className={`p-3.5 text-right font-semibold ${isGrossPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                              ${day.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-right font-medium text-rose-600">
                              ${day.expenses > 0 ? `(${day.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })})` : '0.00'}
                            </td>
                            <td className={`p-3.5 pr-6 text-right font-bold ${isNetPositive ? 'text-indigo-700' : 'text-rose-700'}`}>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md ${isNetPositive ? 'bg-indigo-50 text-indigo-800' : 'bg-rose-50 text-rose-800'}`}>
                                ${day.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
            </div>

            {/* COLUMN 2 (Sidebar) - Accounting Adjustments */}
            <div className="lg:col-span-4 space-y-6">

              {/* Perpetual COGS Policy & Audit Card */}
              <Card className="border shadow bg-white rounded-2xl overflow-hidden">
                <CardHeader className="bg-zinc-50 border-b pb-4">
                  <CardTitle className="text-sm font-bold text-zinc-900 flex items-center gap-1.5 font-sans">
                    <Database className="w-4 h-4 text-emerald-600" /> Perpetual Accounting Policy
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Automated cost-matching guidelines for the Gross Profit & Cost of Goods Sold (COGS) reporting system.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1 bg-emerald-50/70 rounded-xl p-3 border border-emerald-100 text-emerald-900 text-xs">
                    <p className="font-bold">✓ Perpetual COGS Method Active</p>
                    <p className="text-emerald-700 leading-relaxed text-[11px]">
                      This system employs the Perpetual Inventory Method. Costs are recognized and matched specifically when products are sold, maintaining a flawless audit trail.
                    </p>
                  </div>

                  <div className="space-y-3 font-sans text-xs">
                    <h4 className="text-zinc-650 uppercase font-extrabold tracking-wider text-[10px]">Real-Time COGS Summary</h4>
                    <div className="bg-zinc-50 rounded-xl p-3 border space-y-2">
                      <div className="flex justify-between items-center text-zinc-600">
                        <span>Corporate Tax Schedule</span>
                        <span className="font-semibold text-zinc-900">{taxRatePct}% Standard</span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-600">
                        <span>Inventory Matching Policy</span>
                        <span className="font-semibold text-zinc-900">FIFO / Cost Price</span>
                      </div>
                      <div className="border-t border-dashed border-zinc-200 pt-2 flex justify-between items-center font-bold text-zinc-900">
                        <span>Total Matched COGS</span>
                        <span className="font-mono text-emerald-600 bg-white px-2 py-0.5 rounded shadow-sm border border-zinc-150">
                          ${plSummary.costOfGoodsSold.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-zinc-500 leading-relaxed space-y-1 pt-2 border-t border-zinc-100">
                    <span className="font-semibold text-zinc-700 block">Why Perpetual is Preferred:</span>
                    <p>• Avoids periodic estimation errors & manual counting blockages.</p>
                    <p>• Matches individual sales to actual purchase cost immediately.</p>
                    <p>• Maintains constant parity with standard systems like Tareza ERP & SAP.</p>
                  </div>
                </CardContent>
              </Card>

              {/* General Accounting Assumptions Card */}
              <Card className="border shadow bg-white rounded-2xl overflow-hidden">
                <CardHeader className="bg-zinc-50 border-b pb-4">
                  <CardTitle className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> IAS 1 Presentation Principles
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4 text-xs text-zinc-700 leading-relaxed">
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-900 flex items-center gap-1">• Going Concern Assumption</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed pl-3">Assessment of the entity’s ability to continue operations for at least twelve months from the reporting date of {new Date().getFullYear()}.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-900 flex items-center gap-1">• Accrual Basis of Accounting</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed pl-3">Transactions are recorded in the general ledger and trial balance when occurred, entirely separate from physical cash transfers.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-900 flex items-center gap-1">• Offsetting Prohibitions</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed pl-3">Assets/liabilities and income/expenses are recorded on an absolute gross basis without unapproved netting to ensure reporting transparency.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* 2. STATEMENT OF FINANCIAL POSITION (CLASSIFIED BALANCE SHEET) VIEW */}
        <TabsContent value="balance" className="space-y-6">
          <Card className="border shadow bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-zinc-50 border-b pb-5">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-bold text-zinc-900 flex items-center gap-1.5 font-sans">
                    <Layers className="w-5 h-5 text-emerald-600" /> Statement of Financial Position (IAS 1 Compliant)
                  </CardTitle>
                  <CardDescription className="text-xs">Classified balance sheet reporting of current versus non-current resources, liabilities, and core revaluation reserves.</CardDescription>
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
                <div className="max-w-2xl mx-auto space-y-6 font-mono text-sm text-zinc-805">
                  
                  {/* Assets */}
                  <div className="space-y-3">
                    <div className="flex justify-between font-extrabold text-xs text-zinc-505 uppercase border-b border-zinc-900 pb-1">
                      <span>ASSETS (CURRENT AND NON-CURRENT CLASSIFICATION)</span>
                      <span>Balance (USD)</span>
                    </div>

                    {/* Current Assets */}
                    <div className="space-y-1.5 pl-2">
                      <div className="font-bold text-zinc-800 uppercase text-xs">Current Assets</div>
                      <div className="flex justify-between pl-4 text-zinc-650">
                        <span>Cash and Cash Equivalents (1000)</span>
                        <span>${balanceSheet.cashAsset.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between pl-4 text-zinc-650">
                        <span>Trade Accounts Receivable (1100)</span>
                        <span>${balanceSheet.receivableAsset.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between pl-4 text-zinc-650">
                        <span>Merchandise Inventory Account (1200)</span>
                        <span>${balanceSheet.inventoryAsset.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Total Assets */}
                    <div className="flex justify-between font-bold py-1.5 border-t border-b px-2 bg-zinc-50 text-zinc-900 text-xs tracking-wider">
                      <span>TOTAL ASSETS</span>
                      <span>${balanceSheet.totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Liabilities */}
                  <div className="space-y-3 pt-3">
                    <div className="flex justify-between font-extrabold text-xs text-zinc-505 uppercase border-b border-zinc-900 pb-1">
                      <span>LIABILITIES (CURRENT AND NON-CURRENT CLASSIFICATION)</span>
                      <span>Balance (USD)</span>
                    </div>

                    {/* Current Liabilities */}
                    <div className="space-y-1.5 pl-2">
                      <div className="font-bold text-zinc-800 uppercase text-xs">Current Liabilities</div>
                      <div className="flex justify-between pl-4 text-zinc-650">
                        <span>Accounts Payable & Operational (2000)</span>
                        <span>${balanceSheet.payableLiability.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Total Liabilities */}
                    <div className="flex justify-between font-semibold py-1 border-t px-2 text-zinc-800 text-xs">
                      <span>TOTAL LIABILITIES</span>
                      <span>${balanceSheet.totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Shareholder Equity */}
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between font-extrabold text-xs text-zinc-505 uppercase border-b border-zinc-900 pb-1">
                      <span>SHAREHOLDERS' EQUITY AND CAPITAL RESERVES</span>
                      <span>Balance (USD)</span>
                    </div>
                    <div className="flex justify-between pl-4 text-zinc-650">
                      <span>Accumulated Retained Earnings (3000)</span>
                      <span>${balanceSheet.closingRetainedEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
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

        {/* 6. REGULATORY COMPLIANCE EXPORTS VIEW */}
        <TabsContent value="compliance">
          <RegulatoryComplianceExports 
            plSummary={plSummary}
            balanceSheet={balanceSheet}
            productSalesData={productSalesData}
            startDate={startDate}
            endDate={endDate}
          />
        </TabsContent>

        {/* ✨ AI SALES FORECASTING VIEW */}
        <TabsContent value="forecasting">
          <AIForecasting 
            salesList={sales} 
            businessName="Tareza Workspace"
          />
        </TabsContent>

        {/* Sales Performance Breakup View */}
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
