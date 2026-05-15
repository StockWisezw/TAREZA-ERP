import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Activity, CreditCard, DollarSign, Package, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Mon', sales: 4000 },
  { name: 'Tue', sales: 3000 },
  { name: 'Wed', sales: 2000 },
  { name: 'Thu', sales: 2780 },
  { name: 'Fri', sales: 1890 },
  { name: 'Sat', sales: 2390 },
  { name: 'Sun', sales: 3490 },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-secondary">Overview</h2>
          <p className="text-zinc-500 font-medium mt-1">Your business performance today.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 shadow-sm shadow-zinc-200/50 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-zinc-500">Total Sales (ZWG)</CardTitle>
            <div className="p-2 bg-primary/10 rounded-md">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-secondary">24,593.00</div>
            <p className="text-sm text-emerald-600 mt-2 flex items-center font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span> +20.1% from yesterday
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-border/60 shadow-sm shadow-zinc-200/50 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-zinc-500">Transactions</CardTitle>
            <div className="p-2 bg-zinc-100 rounded-md">
              <CreditCard className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-secondary">145</div>
            <p className="text-sm text-emerald-600 mt-2 flex items-center font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span> +4% from yesterday
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-border/60 shadow-sm shadow-zinc-200/50 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-zinc-500">Low Stock Alerts</CardTitle>
            <div className="p-2 bg-red-50 rounded-md">
              <Package className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 font-mono tracking-tight">12</div>
            <p className="text-sm text-zinc-500 mt-2 font-medium">
              Items need reordering
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-border/60 shadow-sm shadow-zinc-200/50 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-zinc-500">Active Branches</CardTitle>
            <div className="p-2 bg-secondary/5 rounded-md">
              <Activity className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-secondary">3</div>
            <p className="text-sm text-zinc-500 mt-2 font-medium">
              Harare, Bulawayo, Mutare
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Revenue Overview</CardTitle>
            <CardDescription>7-day rolling revenue across all active branches.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[320px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F0B323" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F0B323" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#6B7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    className="font-medium"
                    dy={10}
                  />
                  <YAxis
                    stroke="#6B7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                    className="font-mono"
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{
                      borderRadius: '12px', 
                      border: '1px solid #E5E7EB', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                      backgroundColor: '#FFFFFF'
                    }}
                    itemStyle={{fontFamily: 'JetBrains Mono', fontSize: '14px', fontWeight: 700, color: '#0D1B2A'}}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#F0B323" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Navy Deep Premium AI Card */}
        <Card className="col-span-3 border-0 shadow-xl bg-secondary text-secondary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <CardHeader className="relative z-10">
            <CardTitle className="flex items-center space-x-2 text-white">
              <div className="p-1.5 bg-primary/20 rounded-md">
                 <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <span className="tracking-tight">Tareza Insights</span>
            </CardTitle>
            <CardDescription className="text-zinc-400">AI-generated insights based on real-time metadata.</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-4">
              <div className="rounded-xl bg-white/5 p-4 border border-white/10 text-sm backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 text-primary font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    <span>Demand Forecast</span>
                  </div>
                </div>
                <p className="text-zinc-300 leading-relaxed">"Mazoe Orange Crush 2L" is selling 40% faster than usual. Consider restocking 50 cases before the weekend heatwave.</p>
              </div>
              
              <div className="rounded-xl bg-red-500/10 p-4 border border-red-500/20 text-sm backdrop-blur-sm">
                <div className="flex items-center space-x-2 text-red-400 font-semibold mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                  <span>Critical Stock</span>
                </div>
                <p className="text-zinc-300 leading-relaxed"><span className="text-white font-semibold">Panadol 500mg</span> down to 14 units at Harare Branch. Expected to run out by 2:00 PM tomorrow.</p>
              </div>
              
              <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20 text-sm backdrop-blur-sm">
                <div className="flex items-center space-x-2 text-emerald-400 font-semibold mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Margin Opportunity</span>
                </div>
                <p className="text-zinc-300 leading-relaxed">Wholesale prices for sugar have dropped 5%. Adjusting retail price down by 2% could increase total margin volume.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
