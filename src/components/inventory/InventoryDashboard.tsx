import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Package, TrendingUp, AlertCircle, Clock, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Mon', value: 4000 },
  { name: 'Tue', value: 3000 },
  { name: 'Wed', value: 2000 },
  { name: 'Thu', value: 2780 },
  { name: 'Fri', value: 1890 },
  { name: 'Sat', value: 2390 },
  { name: 'Sun', value: 3490 },
];

export function InventoryDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-100 bg-emerald-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Total Inventory Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">$45,231.89</div>
            <p className="text-xs text-emerald-600 mt-1 flex items-center">
              <ArrowUpRight className="h-3 w-3 mr-1" /> +20.1% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-amber-100 bg-amber-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">Low Stock Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">12</div>
            <p className="text-xs text-amber-600 mt-1">Requires immediate reorder</p>
          </CardContent>
        </Card>

        <Card className="border-red-100 bg-red-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Out of Stock</CardTitle>
            <Package className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900">3</div>
            <p className="text-xs text-red-600 mt-1 flex items-center">
              <ArrowDownRight className="h-3 w-3 mr-1" /> -2 from last week
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Expiring Soon (30d)</CardTitle>
            <Clock className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900">8</div>
            <p className="text-xs text-zinc-500 mt-1">Primarily Dairy & Bakery</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Inventory Valuation Trend</CardTitle>
            <CardDescription>Value of stock on hand over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} dx={-10} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`$${value}`, 'Value']}
                  />
                  <Line type="monotone" dataKey="value" stroke="#18181b" strokeWidth={2} dot={{ r: 4, fill: '#18181b' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-secondary text-secondary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <CardHeader className="relative z-10">
            <CardTitle className="flex items-center space-x-2 text-white">
               <div className="p-1-5 bg-primary/20 rounded-md">
                   <TrendingUp className="h-4 w-4 text-primary" />
               </div>
               <span>Tareza Insights</span>
            </CardTitle>
            <CardDescription className="text-zinc-400">Automated inventory analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg backdrop-blur-sm">
              <h4 className="font-semibold text-primary text-sm mb-1 flex items-center space-x-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                 <span>High Demand Alert</span>
              </h4>
              <p className="text-xs text-zinc-300">"Mazoe Orange Crush 2L" sales have spiked by 45%. Recommend increasing reorder level by 20 units before Friday.</p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg backdrop-blur-sm">
              <h4 className="font-semibold text-amber-400 text-sm mb-1 flex items-center space-x-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                 <span>Dead Stock Detected</span>
              </h4>
              <p className="text-xs text-zinc-300">"Generic Phone Cases" haven't moved in 90 days. Recommend applying a 30% discount to clear $450 in tied-up capital.</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg backdrop-blur-sm">
              <h4 className="font-semibold text-emerald-400 text-sm mb-1 flex items-center space-x-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                 <span>Optimal Stock Levels</span>
              </h4>
              <p className="text-xs text-zinc-300">Overall warehouse utilization is at 82%. You are well-optimized for the upcoming month-end rush.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
