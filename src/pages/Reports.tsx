import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from 'next-themes';

export default function Reports() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [activeTab, setActiveTab] = useState('daily');
  const [chartData, setChartData] = useState<{name: string, sales: number, costs: number}[]>([]);
  const [metrics, setMetrics] = useState({
    grossRevenue: 0,
    netProfit: 0,
    expenses: 0,
    avgTxn: 0,
  });

  useEffect(() => {
    async function fetchReports() {
      try {
        const { data: salesInfo } = await supabase.from('sales').select('total, created_at, vat_total');
        const { data: expensesInfo } = await supabase.from('expenses').select('amount, status, created_at');
        
        let revenue = 0;
        let expenses = 0;

        let chartPoints: Record<string, {sales: number, costs: number}> = {};
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // init last 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            chartPoints[days[d.getDay()]] = { sales: 0, costs: 0 };
        }

        if (salesInfo && salesInfo.length > 0) {
            salesInfo.forEach((sale: any) => {
                const amt = Number(sale.total || 0);
                revenue += amt;

                if (sale.created_at) {
                    const d = new Date(sale.created_at);
                    const dayName = days[d.getDay()];
                    if (chartPoints[dayName]) {
                        chartPoints[dayName].sales += amt;
                    }
                }
            });
        }

        if (expensesInfo && expensesInfo.length > 0) {
            expensesInfo.forEach((exp: any) => {
                if (exp.status === 'rejected') return;
                const amt = Number(exp.amount || 0);
                expenses += amt;

                if (exp.created_at) {
                    const d = new Date(exp.created_at);
                    const dayName = days[d.getDay()];
                    if (chartPoints[dayName]) {
                        chartPoints[dayName].costs += amt;
                    }
                }
            });
        }
        
        setChartData(Object.keys(chartPoints).map(key => ({
            name: key,
            sales: chartPoints[key].sales,
            costs: chartPoints[key].costs
        })));

        setMetrics({
            grossRevenue: revenue,
            expenses: expenses,
            netProfit: revenue - expenses,
            avgTxn: salesInfo?.length ? revenue / salesInfo.length : 0
        });

      } catch(err) {
        console.error(err);
      }
    }
    fetchReports();
  }, []);

  const MetricCard = ({ title, value, change, isPositive }: { title: string, value: string, change: string, isPositive: boolean }) => (
    <Card className="border-border/60 shadow-sm shadow-zinc-200/50 dark:shadow-none hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
         <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">{title}</CardTitle>
         {isPositive ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
      </CardHeader>
      <CardContent>
         <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">{value}</div>
         <p className={`text-xs font-medium mt-1 ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
           {isPositive ? '+' : '-'}{change} from previous period
         </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Reports & Analytics</h2>
          <p className="text-zinc-500 mt-1">Financial performance and sales insights.</p>
        </div>
        <Button className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/95">
          <Download className="mr-2 h-4 w-4" /> Export Report
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Gross Revenue" value={`$${metrics.grossRevenue.toFixed(2)}`} change="12.5%" isPositive={true} />
            <MetricCard title="Net Profit" value={`$${metrics.netProfit.toFixed(2)}`} change="8.3%" isPositive={true} />
            <MetricCard title="Expenses" value={`$${metrics.expenses.toFixed(2)}`} change="4.1%" isPositive={false} />
            <MetricCard title="Avg Transaction" value={`$${metrics.avgTxn.toFixed(2)}`} change="2.9%" isPositive={true} />
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Revenue vs Expenses</CardTitle>
              <CardDescription>Performance over the selected period ({activeTab} view).</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="h-[400px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                       </linearGradient>
                       <linearGradient id="colorCosts" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#27272a" : "#E5E7EB"} />
                     <XAxis dataKey="name" stroke={isDark ? "#a1a1aa" : "#6B7280"} fontSize={12} tickLine={false} axisLine={false} dy={10} />
                     <YAxis stroke={isDark ? "#a1a1aa" : "#6B7280"} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} dx={-10} />
                     <Tooltip 
                       contentStyle={{ 
                         borderRadius: '12px', 
                         border: isDark ? '1px solid #27272a' : '1px solid #E5E7EB', 
                         boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                         backgroundColor: isDark ? '#18181b' : '#FFFFFF',
                         color: isDark ? '#f4f4f5' : '#18181b'
                       }}
                       itemStyle={{ fontSize: '14px', fontWeight: 600 }}
                     />
                     <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                     <Area type="monotone" dataKey="costs" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCosts)" />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  );
}
