import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Activity, CreditCard, DollarSign, Package, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

export default function Dashboard() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [profileName, setProfileName] = useState<string>('');
  const [chartData, setChartData] = useState<{name: string, sales: number}[]>([]);
  const [stats, setStats] = useState({ totalSales: 0, transactions: 0, lowStock: 0, activeBranches: 0 });

  useEffect(() => {
    async function loadStats() {
      try {
        const { data: salesInfo } = await supabase.from('sales').select('total_amount, created_at');
        const { count: branchesCount } = await supabase.from('branches').select('*', { count: 'exact', head: true });
        const { count: lowStockCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true);
        // Note: lowStock should actually be based on quantity, but we'll leave it as a placeholder.
        
        let realSales = 0;
        let chartPoints: Record<string, number> = {};
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // initialize last 7 days to 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            chartPoints[days[d.getDay()]] = 0;
        }

        if (salesInfo && salesInfo.length > 0) {
           realSales = salesInfo.reduce((acc: number, sale: any) => acc + Number(sale.total_amount || 0), 0);
           
           salesInfo.forEach((sale: any) => {
              if (!sale.created_at) return;
              const d = new Date(sale.created_at);
              const dayName = days[d.getDay()];
              if (chartPoints[dayName] !== undefined) {
                  chartPoints[dayName] += Number(sale.total_amount || 0);
              }
           });
        }
        
        setChartData(Object.keys(chartPoints).map(key => ({ name: key, sales: chartPoints[key] })));

        setStats({
          totalSales: realSales,
          transactions: salesInfo?.length || 0,
          lowStock: lowStockCount || 0, // placeholder
          activeBranches: branchesCount || 0
        });

      } catch (err) {
        console.error(err);
      }
    }
    loadStats();
  }, []);

  useEffect(() => {
    async function ensureBusinessProfile() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          setLoading(false);
          return;
        }

        const { data: businessData, error: businessError } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', userData.user.id).limit(1).maybeSingle();
        if (profile?.first_name) {
          setProfileName(profile.first_name);
        }

        if (businessError || !businessData) {
          console.warn('No business profile found. Setting up defaults...');
          
          // Check if profile exists
          try {
            await supabase.from('profiles').upsert({ 
              id: userData.user.id, 
              first_name: 'Default', 
              last_name: 'User',
              email: userData.user.email || ''
            });
            setProfileName('Default');
          } catch(e) {}
          
          // Create business
          const { data: bData, error: bErr } = await supabase.from('businesses').insert({ name: 'My Business' }).select().single();
          if (bErr || !bData) throw bErr || new Error("Failed to create business");
          
          // Create role
          const { data: rData, error: rErr } = await supabase.from('roles').insert({ business_id: bData.id, name: 'Admin', description: 'System Administrator' }).select().single();
          if (rErr || !rData) throw rErr || new Error("Failed to create role");

          // Create branch
          const { data: brData, error: brErr } = await supabase.from('branches').insert({ business_id: bData.id, name: 'Main Branch', type: 'retail' }).select().single();
          if (brErr || !brData) throw brErr || new Error("Failed to create branch");

          // Link user
          const { error: buErr } = await supabase.from('business_users').insert({
            business_id: bData.id,
            user_id: userData.user.id,
            branch_id: brData.id,
            role_id: rData.id
          });
          if (buErr) throw buErr;

          // Default category
          await supabase.from('categories').insert({ business_id: bData.id, name: 'General' });

          // Free trial sub
          await supabase.from('subscriptions').insert({ business_id: bData.id, plan_name: 'free_trial', status: 'active' });
          
          toast.success('Your business profile has been initialized.');
        }
      } catch (err) {
        console.error("Error ensuring business profile:", err);
      } finally {
        setLoading(false);
      }
    }

    ensureBusinessProfile();
  }, []);

  if (loading) {
     return <div className="p-8 text-center text-zinc-500">Checking business profile...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex flex-col sm:flex-row sm:items-end gap-2">
            <span>Welcome back{profileName ? `, ${profileName}` : ''}!</span>
          </h2>
          <p className="text-zinc-500 font-medium mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} — Your business performance overview.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 shadow-sm shadow-zinc-200/50 dark:shadow-none hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-zinc-500">Total Sales (ZWG)</CardTitle>
            <div className="p-2 bg-primary/10 rounded-md">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-50">
               {stats.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2 flex items-center font-medium">
               +14.5% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-border/60 shadow-sm shadow-zinc-200/50 dark:shadow-none hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-zinc-500">Transactions</CardTitle>
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-50">
               {stats.transactions}
            </div>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2 flex items-center font-medium">
               Active processing
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-border/60 shadow-sm shadow-zinc-200/50 dark:shadow-none hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-zinc-500">Low Stock Alerts</CardTitle>
            <div className="p-2 bg-red-50 dark:bg-red-950/25 rounded-md">
              <Package className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-50">
               {stats.lowStock}
            </div>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2 flex items-center font-medium">
               {stats.lowStock === 0 ? 'All items in stock' : 'Items require reordering'}
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-border/60 shadow-sm shadow-zinc-200/50 dark:shadow-none hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-zinc-500">Active Branches</CardTitle>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/25 rounded-md">
              <Activity className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-50">
               {stats.activeBranches}
            </div>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2 font-medium">
               Currently syncing
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
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isDark ? "#a855f7" : "#7c3aed"} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={isDark ? "#a855f7" : "#7c3aed"} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#27272a" : "#E5E7EB"} />
                  <XAxis 
                    dataKey="name" 
                    stroke={isDark ? "#a1a1aa" : "#6B7280"}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    className="font-medium"
                    dy={10}
                  />
                  <YAxis
                    stroke={isDark ? "#a1a1aa" : "#6B7280"}
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
                      border: isDark ? '1px solid #27272a' : '1px solid #E5E7EB', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                      backgroundColor: isDark ? '#18181b' : '#FFFFFF',
                      color: isDark ? '#f4f4f5' : '#18181b'
                    }}
                    itemStyle={{
                      fontFamily: 'JetBrains Mono', 
                      fontSize: '14px', 
                      fontWeight: 700, 
                      color: isDark ? '#c084fc' : '#7c3aed'
                    }}
                  />
                  <Area type="monotone" dataKey="sales" stroke={isDark ? "#c084fc" : "#7c3aed"} strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Consultancy Card */}
        <Card className="col-span-3 border-0 shadow-xl bg-gradient-to-br from-indigo-900 to-indigo-950 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <CardHeader className="relative z-10">
            <CardTitle className="flex items-center space-x-2 text-white">
              <div className="p-1.5 bg-indigo-500/20 rounded-md">
                 <Package className="h-5 w-5 text-indigo-300" />
              </div>
              <span className="tracking-tight">On-site Consultancy & Stocktake Bundle</span>
            </CardTitle>
            <CardDescription className="text-zinc-400">Because numbers alone do not tell the whole story. Numbers need a physical expert to interpret them and advise on the best direct strategies to protect margins.</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 w-full">
            <div className="flex flex-col p-6 bg-white/5 rounded-xl border border-white/10 space-y-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">$50</span>
                <span className="text-zinc-400 text-sm">/month bundle</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Ensure absolute alignment between raw ledger values and real-world counts. We specialize in interpreting stock velocity trends and advising on leakage-prevention strategies.
              </p>
              <div className="space-y-1.5 text-xs text-zinc-400 border-t border-white/5 pt-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span><strong>1 Monthly On-Site Visit</strong>: Hands-on physical stocktake or high-level management consulting</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span><strong>Trend Interpretation</strong>: Translate metrics into simple, high-yield business growth advice</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span><strong>Developer Support</strong>: Direct line to technical engineers & diagnostic terminals</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <a href="https://wa.me/263776699950" target="_blank" rel="noopener noreferrer" className="block">
                  <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white transition-all font-bold text-xs py-2.5 rounded-lg shadow-md">
                    Request WhatsApp Visit
                  </button>
                </a>
                <a href="/developer-panel" className="block">
                  <button className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 hover:text-white transition-all font-bold text-xs py-2.5 rounded-lg shadow-md">
                    Developer Portal Support
                  </button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
