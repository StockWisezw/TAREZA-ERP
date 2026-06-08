import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Download, TrendingUp, TrendingDown, DollarSign, Calendar, TrendingUp as MarginIcon, ShoppingBag, ArrowUpRight, BarChart3, PieChart as PieIcon, RefreshCw, Printer } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/firebaseClient';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

interface ProductStat {
  name: string;
  quantity: number;
  revenue: number;
}

export default function Reports() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [activeTab, setActiveTab] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ name: string; sales: number; costs: number; profit: number }[]>([]);
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);
  
  const [metrics, setMetrics] = useState({
    grossRevenue: 0,
    grossChange: 0,
    netProfit: 0,
    profitChange: 0,
    expenses: 0,
    expensesChange: 0,
    avgTxn: 0,
    avgChange: 0,
    txnUnitsSold: 0
  });

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data: salesInfo } = await supabase.from('sales').select('total, total_amount, created_at, items, payments');
      const { data: expensesInfo } = await supabase.from('expenses').select('amount, status, created_at');
      
      const now = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      let chartPoints: { name: string; sales: number; costs: number; profit: number }[] = [];
      let currentGrossRevenue = 0;
      let currentExpenses = 0;
      let priorGrossRevenue = 0;
      let priorExpenses = 0;
      
      let startOfCurrentPeriod = new Date();
      let startOfPriorPeriod = new Date();
      
      if (activeTab === 'daily') {
        // Last 7 days including today
        startOfCurrentPeriod = new Date();
        startOfCurrentPeriod.setDate(now.getDate() - 6);
        startOfCurrentPeriod.setHours(0, 0, 0, 0);
        
        startOfPriorPeriod = new Date();
        startOfPriorPeriod.setDate(now.getDate() - 13);
        startOfPriorPeriod.setHours(0, 0, 0, 0);
        
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          last7Days.push(d);
        }
        
        chartPoints = last7Days.map(d => {
          const label = `${months[d.getMonth()]} ${d.getDate()}`;
          
          let sAmt = 0;
          salesInfo?.forEach((s: any) => {
            const sDate = new Date(s.created_at || s.timestamp);
            if (sDate.toDateString() === d.toDateString()) {
              sAmt += Number(s.total || s.total_amount || 0);
            }
          });
          
          let eAmt = 0;
          expensesInfo?.forEach((e: any) => {
            if (e.status === 'rejected') return;
            const eDate = new Date(e.created_at);
            if (eDate.toDateString() === d.toDateString()) {
              eAmt += Number(e.amount || 0);
            }
          });
          
          return {
            name: label,
            sales: sAmt,
            costs: eAmt,
            profit: sAmt - eAmt
          };
        });
        
      } else if (activeTab === 'weekly') {
        // Last 4 weeks (28 days)
        startOfCurrentPeriod = new Date();
        startOfCurrentPeriod.setDate(now.getDate() - 27);
        startOfCurrentPeriod.setHours(0, 0, 0, 0);
        
        startOfPriorPeriod = new Date();
        startOfPriorPeriod.setDate(now.getDate() - 55);
        startOfPriorPeriod.setHours(0, 0, 0, 0);
        
        for (let i = 3; i >= 0; i--) {
          const end = new Date();
          end.setDate(now.getDate() - (i * 7));
          end.setHours(23, 59, 59, 999);
          
          const start = new Date();
          start.setDate(now.getDate() - ((i + 1) * 7) + 1);
          start.setHours(0, 0, 0, 0);
          
          const startStr = `${months[start.getMonth()]} ${start.getDate()}`;
          
          let sAmt = 0;
          salesInfo?.forEach((s: any) => {
            const sDate = new Date(s.created_at || s.timestamp);
            if (sDate >= start && sDate <= end) {
              sAmt += Number(s.total || s.total_amount || 0);
            }
          });
          
          let eAmt = 0;
          expensesInfo?.forEach((e: any) => {
            if (e.status === 'rejected') return;
            const eDate = new Date(e.created_at);
            if (eDate >= start && eDate <= end) {
              eAmt += Number(e.amount || 0);
            }
          });
          
          chartPoints.push({
            name: `Wk ${4-i} (${startStr})`,
            sales: sAmt,
            costs: eAmt,
            profit: sAmt - eAmt
          });
        }
        
      } else if (activeTab === 'monthly') {
        // Last 6 months
        startOfCurrentPeriod = new Date();
        startOfCurrentPeriod.setMonth(now.getMonth() - 5);
        startOfCurrentPeriod.setDate(1);
        startOfCurrentPeriod.setHours(0, 0, 0, 0);
        
        startOfPriorPeriod = new Date();
        startOfPriorPeriod.setMonth(now.getMonth() - 11);
        startOfPriorPeriod.setDate(1);
        startOfPriorPeriod.setHours(0, 0, 0, 0);
        
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(now.getMonth() - i);
          const m = d.getMonth();
          const y = d.getFullYear();
          
          let sAmt = 0;
          salesInfo?.forEach((s: any) => {
            const sDate = new Date(s.created_at || s.timestamp);
            if (sDate.getMonth() === m && sDate.getFullYear() === y) {
              sAmt += Number(s.total || s.total_amount || 0);
            }
          });
          
          let eAmt = 0;
          expensesInfo?.forEach((e: any) => {
            if (e.status === 'rejected') return;
            const eDate = new Date(e.created_at);
            if (eDate.getMonth() === m && eDate.getFullYear() === y) {
              eAmt += Number(e.amount || 0);
            }
          });
          
          chartPoints.push({
            name: months[m],
            sales: sAmt,
            costs: eAmt,
            profit: sAmt - eAmt
          });
        }
      }
      
      // Sum current & prior windows
      salesInfo?.forEach((s: any) => {
        const sDate = new Date(s.created_at || s.timestamp);
        const amt = Number(s.total || s.total_amount || 0);
        if (sDate >= startOfCurrentPeriod && sDate <= now) {
          currentGrossRevenue += amt;
        } else if (sDate >= startOfPriorPeriod && sDate < startOfCurrentPeriod) {
          priorGrossRevenue += amt;
        }
      });
      
      expensesInfo?.forEach((e: any) => {
        if (e.status === 'rejected') return;
        const eDate = new Date(e.created_at);
        const amt = Number(e.amount || 0);
        if (eDate >= startOfCurrentPeriod && eDate <= now) {
          currentExpenses += amt;
        } else if (eDate >= startOfPriorPeriod && eDate < startOfCurrentPeriod) {
          priorExpenses += amt;
        }
      });
      
      const currentNetProfit = currentGrossRevenue - currentExpenses;
      const priorNetProfit = priorGrossRevenue - priorExpenses;
      
      // Count transactions in current vs prior
      const currentTxns = salesInfo?.filter((s: any) => {
        const sDate = new Date(s.created_at || s.timestamp);
        return sDate >= startOfCurrentPeriod && sDate <= now;
      }) || [];
      
      const priorTxns = salesInfo?.filter((s: any) => {
        const sDate = new Date(s.created_at || s.timestamp);
        return sDate >= startOfPriorPeriod && sDate < startOfCurrentPeriod;
      }) || [];
      
      const currentAvg = currentTxns.length ? currentGrossRevenue / currentTxns.length : 0;
      const priorAvg = priorTxns.length ? priorGrossRevenue / priorTxns.length : 0;
      
      // Top Products for current window
      const productStats: Record<string, ProductStat> = {};
      let totalQtySold = 0;
      
      currentTxns.forEach((sale: any) => {
        const items = sale.items || [];
        if (Array.isArray(items)) {
          items.forEach((it: any) => {
            const prodName = it.product?.name || it.name || 'Generic Item';
            const qty = Number(it.quantity || 0);
            const itemTotal = Number(it.subtotal || it.line_total || (qty * (it.unitPrice || it.price || 0)));
            
            if (!productStats[prodName]) {
              productStats[prodName] = { name: prodName, quantity: 0, revenue: 0 };
            }
            productStats[prodName].quantity += qty;
            productStats[prodName].revenue += itemTotal;
            totalQtySold += qty;
          });
        }
      });
      
      const sortedProducts = Object.values(productStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
        
      setTopProducts(sortedProducts);
      setChartData(chartPoints);
      
      setMetrics({
        grossRevenue: currentGrossRevenue,
        grossChange: priorGrossRevenue ? ((currentGrossRevenue - priorGrossRevenue) / priorGrossRevenue) * 100 : 0,
        expenses: currentExpenses,
        expensesChange: priorExpenses ? ((currentExpenses - priorExpenses) / priorExpenses) * 100 : 0,
        netProfit: currentNetProfit,
        profitChange: priorNetProfit ? ((currentNetProfit - priorNetProfit) / Math.abs(priorNetProfit)) * 100 : 0,
        avgTxn: currentAvg,
        avgChange: priorAvg ? ((currentAvg - priorAvg) / priorAvg) * 100 : 0,
        txnUnitsSold: totalQtySold
      });
      
    } catch (err) {
      console.error(err);
      toast.error('Failed to load transaction reports data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeTab]);

  const exportCSV = () => {
    if (chartData.length === 0) {
      toast.error('No analytics data available to export');
      return;
    }
    const headers = ['Period', 'Gross Sales Revenue', 'Total Expenses', 'Net Profit Margin'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + chartData.map(c => `"${c.name}",${c.sales.toFixed(2)},${c.costs.toFixed(2)},${c.profit.toFixed(2)}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reports_summary_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Financial summary exported successfully');
  };

  const MetricCard = ({ title, value, change, isPositive, extraDesc }: { title: string; value: string; change: number; isPositive: boolean; extraDesc?: string }) => (
    <Card className="border-border/60 shadow-sm bg-white dark:bg-zinc-950/70 hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
         <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{title}</CardTitle>
         {isPositive ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-rose-500" />}
      </CardHeader>
      <CardContent>
         <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">{value}</div>
         <p className="text-[11px] font-medium mt-1.5 flex items-center gap-1.5">
           <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono font-bold ${change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
             {change >= 0 ? '+' : ''}{change.toFixed(1)}%
           </span>
           <span className="text-zinc-500">vs prior period</span>
         </p>
         {extraDesc && (
           <p className="text-[10px] text-zinc-400 font-mono mt-1 border-t border-zinc-100 pt-1 leading-none">{extraDesc}</p>
         )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200/50 pb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-sans">Reports & Analytics</h2>
          <p className="text-zinc-500 mt-1 text-sm">Pragmatic, real-time visual cash flow audits and revenue analytics.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReports} className="bg-white hover:bg-zinc-50">
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Synchronize values
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-white hover:bg-zinc-50">
            <Printer className="mr-2 h-3.5 w-3.5" /> Print Statement
          </Button>
          <Button size="sm" onClick={exportCSV} className="bg-zinc-900 border border-zinc-800 text-white shadow-sm hover:bg-zinc-800">
            <Download className="mr-2 h-3.5 w-3.5" /> Export Report CSV
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-between items-center bg-zinc-100/80 p-1 rounded-xl max-w-[340px] border border-zinc-200/30">
          <TabsList className="grid w-full grid-cols-3 bg-transparent h-9 p-0">
            <TabsTrigger value="daily" className="text-xs font-semibold rounded-lg h-7 data-[state=active]:shadow-sm">7 Days</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs font-semibold rounded-lg h-7 data-[state=active]:shadow-sm">4 Weeks</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs font-semibold rounded-lg h-7 data-[state=active]:shadow-sm">6 Months</TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard 
              title="Gross Sales Revenue" 
              value={`$${metrics.grossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              change={metrics.grossChange} 
              isPositive={metrics.grossChange >= 0}
              extraDesc={`${metrics.txnUnitsSold} discrete items sold`}
            />
            <MetricCard 
              title="Net Operating Profit" 
              value={`$${metrics.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              change={metrics.profitChange} 
              isPositive={metrics.profitChange >= 0}
              extraDesc={`Margin: ${(metrics.grossRevenue ? (metrics.netProfit / metrics.grossRevenue) * 100 : 0).toFixed(1)}%`}
            />
            <MetricCard 
              title="Operational Expenses" 
              value={`$${metrics.expenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              change={metrics.expensesChange} 
              isPositive={metrics.expensesChange < 0} // Positive if expense went down
              extraDesc="Approved general and system debits"
            />
            <MetricCard 
              title="Average Ticket Value" 
              value={`$${metrics.avgTxn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              change={metrics.avgChange} 
              isPositive={metrics.avgChange >= 0}
              extraDesc="Average checkout basket value"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-border/60 shadow-sm bg-white">
              <CardHeader className="border-b border-zinc-100/80 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>Revenue vs Operational Expenses Flow Chart</span>
                </CardTitle>
                <CardDescription>Financial performance metrics and net margins visualization.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                 <div className="h-[340px] w-full">
                   {loading ? (
                     <div className="h-full flex items-center justify-center font-mono text-zinc-400 text-xs">
                       Calculating transaction nodes...
                     </div>
                   ) : chartData.length === 0 ? (
                     <div className="h-full flex items-center justify-center text-zinc-400 text-xs">
                       No transactions generated within this period.
                     </div>
                   ) : (
                     <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <defs>
                           <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                             <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                           </linearGradient>
                           <linearGradient id="colorCosts" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                             <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                           </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#27272a" : "#E5E7EB"} />
                         <XAxis dataKey="name" stroke={isDark ? "#a1a1aa" : "#6B7280"} fontSize={11} tickLine={false} axisLine={false} dy={10} />
                         <YAxis stroke={isDark ? "#a1a1aa" : "#6B7280"} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                         <Tooltip 
                           contentStyle={{ 
                             borderRadius: '12px', 
                             border: isDark ? '1px solid #27272a' : '1px solid #E5E7EB', 
                             boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                             backgroundColor: isDark ? '#18181b' : '#FFFFFF',
                             color: isDark ? '#f4f4f5' : '#18181b',
                             fontSize: '12px'
                           }}
                         />
                         <Area type="monotone" name="Sales Revenue" dataKey="sales" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                         <Area type="monotone" name="Expenses & At-Cost" dataKey="costs" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorCosts)" />
                       </AreaChart>
                     </ResponsiveContainer>
                   )}
                 </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm bg-white">
              <CardHeader className="border-b border-zinc-100/80 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-500" />
                  <span>Top-Selling Inventory Items</span>
                </CardTitle>
                <CardDescription>Highest revenue generators in current period.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="h-[280px] flex items-center justify-center font-mono text-zinc-400 text-xs">
                    Summing merchandise receipts...
                  </div>
                ) : topProducts.length === 0 ? (
                  <div className="h-[280px] flex flex-col justify-center items-center text-zinc-400 text-xs">
                    <p>No products sold in this period.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {topProducts.map((p, idx) => {
                      const percentage = metrics.grossRevenue ? (p.revenue / metrics.grossRevenue) * 100 : 0;
                      return (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-zinc-800 line-clamp-1">{p.name}</span>
                            <span className="font-mono text-zinc-500 font-medium">{p.quantity} units · <strong className="text-zinc-950 font-semibold">${p.revenue.toFixed(2)}</strong></span>
                          </div>
                          <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(8, percentage))}%` }}></div>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
                            <span>Contribution margin</span>
                            <span>{percentage.toFixed(1)}% of total sales</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Audit Breakdown Table */}
          <Card className="border-border/60 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 pb-4">
              <CardTitle className="text-base flex items-center gap-1.5 font-semibold text-zinc-900">
                <Calendar className="w-4 h-4 text-zinc-500" /> Complete Periodic Cash Breakdown Summary
              </CardTitle>
              <CardDescription>Formatted double-entry subtotal audit ledger ledger points.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse font-sans">
                   <thead className="bg-zinc-50 border-b border-zinc-200">
                     <tr className="text-zinc-500 text-xs font-semibold uppercase font-mono">
                       <th className="py-3 px-5">Reporting Period Target</th>
                       <th className="py-3 px-5 text-right">Gross Sales Revenue</th>
                       <th className="py-3 px-5 text-right">Debit Cash Outflow</th>
                       <th className="py-3 px-5 text-right">Operating Net Ledger Margin</th>
                       <th className="py-3 px-5 text-right">Operational Efficiency</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-100 text-sm">
                     {loading ? (
                       <tr>
                         <td colSpan={5} className="py-12 text-center text-zinc-400 font-mono text-xs">Syncing table indices...</td>
                       </tr>
                     ) : chartData.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="py-12 text-center text-zinc-400 text-xs">No entries for chosen interval.</td>
                       </tr>
                     ) : (
                       chartData.map((row, idx) => {
                         const profitMargin = row.sales ? (row.profit / row.sales) * 100 : 0;
                         return (
                           <tr key={idx} className="hover:bg-zinc-50/40 transition-colors">
                             <td className="py-3.5 px-5 font-semibold text-zinc-700">{row.name}</td>
                             <td className="py-3.5 px-5 text-right font-mono text-emerald-600 font-bold">${row.sales.toFixed(2)}</td>
                             <td className="py-3.5 px-5 text-right font-mono text-rose-500 font-bold">${row.costs.toFixed(2)}</td>
                             <td className={`py-3.5 px-5 text-right font-mono font-bold ${row.profit >= 0 ? 'text-zinc-900' : 'text-red-600'}`}>
                               ${row.profit.toFixed(2)}
                             </td>
                             <td className="py-3.5 px-5 text-right font-mono">
                               <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${profitMargin >= 30 ? 'bg-emerald-100 text-emerald-800' : profitMargin > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                                 {row.sales ? `${profitMargin.toFixed(0)}%` : '0%'}
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
      </Tabs>
    </div>
  );
}
