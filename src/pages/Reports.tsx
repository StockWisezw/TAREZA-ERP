import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';

export default function Reports() {
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
        const { data: salesInfo } = await supabase.from('sales').select('total_amount, created_at, total_tax_amount');
        
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
                const amt = Number(sale.total_amount || 0);
                const tax = Number(sale.total_tax_amount || 0);
                revenue += amt;
                expenses += tax; // using tax as a placeholder for expenses

                if (sale.created_at) {
                    const d = new Date(sale.created_at);
                    const dayName = days[d.getDay()];
                    if (chartPoints[dayName]) {
                        chartPoints[dayName].sales += amt;
                        chartPoints[dayName].costs += tax;
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
    <Card className="border-zinc-200/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
         <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">{title}</CardTitle>
         {isPositive ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
      </CardHeader>
      <CardContent>
         <div className="text-2xl font-bold tracking-tight text-zinc-900">{value}</div>
         <p className={`text-xs font-medium mt-1 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
           {isPositive ? '+' : '-'}{change} from previous period
         </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Reports & Analytics</h2>
          <p className="text-zinc-500 mt-1">Financial performance and sales insights.</p>
        </div>
        <Button className="bg-primary text-primary-foreground shadow-sm">
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
            <MetricCard title="Gross Revenue" value={`$${metrics.grossRevenue.toFixed(2)}`} change="-" isPositive={true} />
            <MetricCard title="Net Profit" value={`$${metrics.netProfit.toFixed(2)}`} change="-" isPositive={true} />
            <MetricCard title="Expenses" value={`$${metrics.expenses.toFixed(2)}`} change="-" isPositive={false} />
            <MetricCard title="Avg Transaction" value={`$${metrics.avgTxn.toFixed(2)}`} change="-" isPositive={true} />
          </div>

          <Card className="border-zinc-200/60 shadow-sm">
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
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                     <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                     <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} dx={-10} />
                     <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                       itemStyle={{ fontSize: '14px', fontWeight: 600 }}
                     />
                     <Area type="monotone" dataKey="sales" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" />
                     <Area type="monotone" dataKey="costs" stroke="#ef4444" fillOpacity={1} fill="url(#colorCosts)" />
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
