import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Activity, CreditCard, DollarSign, Package, Sparkles, Clock, Lock, Unlock, Play, RefreshCw, AlertTriangle, CheckCircle2, BarChart3, PieChart as PieChartIcon, Check, TrendingUp, Coins } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend, PieChart, Pie, LineChart, Line } from 'recharts';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/firebaseClient';
import { DynamicBranchOverview } from '../components/dashboard/DynamicBranchOverview';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

export default function Dashboard() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [profileName, setProfileName] = useState<string>('');
  const [businessName, setBusinessName] = useState<string>('');
  const [chartData, setChartData] = useState<{name: string, sales: number}[]>([]);
  const [dailyTrendData, setDailyTrendData] = useState<{ date: string; revenue: number; txCount: number }[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    todayRevenue: 0,
    todayTransactions: 0,
    averageOrderValue: 0,
    peakSalesHour: '12:00 - 13:00',
    weeklyRunrate: 0
  });
  const [stats, setStats] = useState({ totalSales: 0, transactions: 0, lowStock: 0, activeBranches: 0, salesTrend: 'Real-time sales' });
  const [branchSalesData, setBranchSalesData] = useState<{ name: string; sales: number; transactions: number }[]>([]);
  const [branchStockData, setBranchStockData] = useState<{ name: string; stock: number }[]>([]);
  const [branchesList, setBranchesList] = useState<{ id: string; name: string }[]>([]);
  const [trendMetric, setTrendMetric] = useState<'revenue' | 'transactions'>('revenue');

  const [activeSession, setActiveSession] = useState<any>(null);
  const [sessionDuration, setSessionDuration] = useState<string>('00h 00m');
  const [sessionLoading, setSessionLoading] = useState<boolean>(true);
  const [isClosingOpen, setIsClosingOpen] = useState(false);
  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [closingCashInput, setClosingCashInput] = useState('');
  const [closingNotesInput, setClosingNotesInput] = useState('');
  const [openingFloatInput, setOpeningFloatInput] = useState('0');
  const [businessContext, setBusinessContext] = useState<{ business_id: string; branch_id: string; user_id: string } | null>(null);

  // Subscription verification states
  const [bizSubscriptionStatus, setBizSubscriptionStatus] = useState<string>('');
  const [pendingSubscription, setPendingSubscription] = useState<any>(null);
  const [verificationCountdown, setVerificationCountdown] = useState<number>(300);

  const renderFormattedInsight = (text: string) => {
    if (!text) return null;
    const sections = text.split('\n\n');
    return (
      <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans mt-1">
        {sections.map((sec, i) => {
          const trimmedSec = sec.trim();
          if (trimmedSec.startsWith('###') || trimmedSec.startsWith('##')) {
            const headingText = trimmedSec.replace(/^#+\s*/, '').trim();
            return (
              <h4 key={i} className="text-sm font-bold text-zinc-900 dark:text-zinc-50 tracking-tight border-b border-zinc-150 dark:border-zinc-800 pb-1 mt-3">
                {headingText}
              </h4>
            );
          }
          if (trimmedSec.match(/^[1-3]\.\s/) || trimmedSec.startsWith('*') || trimmedSec.startsWith('-')) {
            const lines = trimmedSec.split('\n');
            const titleLine = lines[0].replace(/^[1-3]\.\s+\*\*|^-\s+\*\*|^\*\s+\*\*/, '').replace(/\*\*:/, ':').trim();
            const restOfLines = lines.slice(1).join(' ').trim();
            return (
              <div key={i} className="bg-zinc-50 dark:bg-zinc-900/20 p-4 rounded-xl border border-zinc-150/60 dark:border-zinc-850">
                <h5 className="font-bold text-zinc-850 dark:text-zinc-100 flex items-center gap-1.5 text-xs">
                  <span className="w-1.5 h-1.5 bg-violet-500 rounded-full inline-block shrink-0"></span>
                  {titleLine.replace(/\*\*/g, '')}
                </h5>
                {restOfLines && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 pl-3 font-medium">
                    {restOfLines.replace(/\*\*/g, '')}
                  </p>
                )}
              </div>
            );
          }
          return (
            <p key={i} className="text-[11px] text-zinc-605 dark:text-zinc-350 leading-relaxed font-normal">
              {trimmedSec.replace(/\*\*/g, '')}
            </p>
          );
        })}
      </div>
    );
  };

  const fetchOpenSession = async (busId: string) => {
    if (!busId) return;
    setSessionLoading(true);
    try {
      const { data: activeSess, error } = await supabase
        .from('register_sessions')
        .eq('business_id', busId)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setActiveSession(activeSess || null);
      if (activeSess) {
        setClosingCashInput(Number(activeSess.expected_balance ?? activeSess.opening_balance ?? 0).toFixed(2));
      }
    } catch (err) {
      console.error('Error fetching open session for dashboard:', err);
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSession?.opened_at) {
      setSessionDuration('00h 00m');
      return;
    }

    const update = () => {
      const openedTime = new Date(activeSession.opened_at).getTime();
      const diffMs = Math.max(0, new Date().getTime() - openedTime);
      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      setSessionDuration(`${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`);
    };

    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleOpenSession = async () => {
    if (!businessContext) {
      toast.error("Business context not loaded yet.");
      return;
    }
    const floatVal = parseFloat(openingFloatInput) || 0;
    try {
      await supabase.from('cash_drawer_logs').insert([{
        business_id: businessContext.business_id,
        branch_id: businessContext.branch_id || null,
        amount: floatVal,
        type: 'opening',
        transaction_type: 'opening_float',
        notes: 'Register opened via Dashboard Shift Summary widget quick action.',
        created_at: new Date().toISOString()
      }]);

      const sessId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      const sessionItem = {
        id: sessId,
        business_id: businessContext.business_id,
        branch_id: businessContext.branch_id || null,
        user_id: businessContext.user_id,
        opening_balance: floatVal,
        closing_balance: 0,
        expected_balance: floatVal,
        variance: 0,
        status: 'OPEN' as const,
        opened_at: new Date().toISOString(),
        closed_at: null,
        sales_count: 0,
        sales_total: 0,
        refunds_total: 0,
        payouts_total: 0,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('register_sessions').insert(sessionItem);
      if (error) throw error;

      toast.success("Register shift session opened successfully!");
      setIsOpeningOpen(false);
      fetchOpenSession(businessContext.business_id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to open register session.");
    }
  };

  const handleCloseSession = async () => {
    if (!businessContext || !activeSession) {
      toast.error("No active session to close.");
      return;
    }
    const countedCash = parseFloat(closingCashInput) || 0;
    const expectedCash = Number(activeSession.expected_balance ?? activeSession.opening_balance ?? 0);
    const calculatedVariance = countedCash - expectedCash;
    const notesStr = closingNotesInput || "Quick closed from dashboard shift summary widget";

    try {
      await supabase.from('cash_drawer_logs').insert([{
        business_id: businessContext.business_id,
        branch_id: businessContext.branch_id || null,
        amount: countedCash,
        type: 'closing',
        transaction_type: 'closing_count',
        notes: `Counted: $${countedCash.toFixed(2)}, Expected: $${expectedCash.toFixed(2)}, Variance: $${calculatedVariance.toFixed(2)}. ${notesStr}`,
        created_at: new Date().toISOString()
      }]);

      const patches = {
        closing_balance: countedCash,
        expected_balance: expectedCash,
        variance: calculatedVariance,
        status: 'CLOSED' as const,
        closed_at: new Date().toISOString(),
        sales_total: activeSession.sales_total || 0,
        payouts_total: activeSession.payouts_total || 0
      };

      const { error } = await supabase
        .from('register_sessions')
        .eq('id', activeSession.id)
        .update(patches);

      if (error) throw error;

      toast.success("Register shift session closed safely. Reconciled summary saved.");
      setIsClosingOpen(false);
      setClosingNotesInput('');
      setActiveSession(null);
      fetchOpenSession(businessContext.business_id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Could not freeze register session.");
    }
  };

  useEffect(() => {
    async function loadStats() {
      if (!businessContext?.business_id) return;
      try {
        const bizId = businessContext.business_id;

        // Fetch all required data in parallel to optimize load time
        const [branchesRes, salesRes, activeProductsRes, inventoryRes] = await Promise.all([
          supabase.from('branches').select('id, name').eq('business_id', bizId),
          supabase.from('sales').select('total, branch_id, created_at').eq('business_id', bizId),
          supabase.from('products').select('id').eq('business_id', bizId).eq('is_active', true),
          supabase.from('inventory').select('product_id, quantity, reorder_level, branch_id').eq('business_id', bizId)
        ]);

        if (branchesRes.error) throw new Error(`[Branches Error] ${branchesRes.error.message}`);
        if (salesRes.error) throw new Error(`[Sales Error] ${salesRes.error.message}`);
        if (activeProductsRes.error) throw new Error(`[Products Error] ${activeProductsRes.error.message}`);
        if (inventoryRes.error) throw new Error(`[Inventory Error] ${inventoryRes.error.message}`);

        const branches = branchesRes.data || [];
        setBranchesList(branches);

        const salesInfo = salesRes.data || [];
        const activeProducts = activeProductsRes.data || [];
        const inventoryData = inventoryRes.data || [];

        const branchesCount = branches.length;
        
        const activeProductIds = new Set(activeProducts?.map((p: any) => p.id) || []);
        const lowStockCount = (inventoryData || []).filter((inv: any) => {
          return activeProductIds.has(inv.product_id) && Number(inv.quantity || 0) <= Number(inv.reorder_level || 0);
        }).length;
        
        let realSales = 0;
        let chartPoints: Record<string, number> = {};
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // initialize last 7 days to 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            chartPoints[days[d.getDay()]] = 0;
        }

        const last7Days: { date: string; fullDate: string; revenue: number; txCount: number }[] = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dayName = days[d.getDay()];
          const formattedKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
          last7Days.push({
            date: `${dayName} ${d.getDate()}`,
            fullDate: formattedKey,
            revenue: 0,
            txCount: 0
          });
        }

        if (salesInfo && salesInfo.length > 0) {
           realSales = salesInfo.reduce((acc: number, sale: any) => acc + Number(sale.total || 0), 0);
           
           salesInfo.forEach((sale: any) => {
              if (!sale.created_at) return;
               const d = new Date(sale.created_at);
               const dayName = days[d.getDay()];
               if (chartPoints[dayName] !== undefined) {
                   chartPoints[dayName] += Number(sale.total || 0);
               }

               // Match daily chronological trend
               const saleDate = sale.created_at.split('T')[0];
               const match = last7Days.find(day => day.fullDate === saleDate);
               if (match) {
                 match.revenue += Number(sale.total || 0);
                 match.txCount += 1;
               }
           });
        }
        
        setChartData(Object.keys(chartPoints).map(key => ({ name: key, sales: chartPoints[key] })));
        setDailyTrendData(last7Days.map(item => ({ date: item.date, revenue: item.revenue, txCount: item.txCount })));

        // Today's stats calculation
        const todayStr = new Date().toISOString().split('T')[0];
        const todaySales = (salesInfo || []).filter((sale: any) => sale.created_at && sale.created_at.startsWith(todayStr));
        const todayRevenue = todaySales.reduce((acc: number, sale: any) => acc + Number(sale.total || 0), 0);
        const todayTransactions = todaySales.length;

        const totalSales = realSales;
        const totalTx = salesInfo?.length || 0;
        const averageOrderValue = totalTx > 0 ? (totalSales / totalTx) : 0;

        // Compute hourly profile
        const hourCounts = Array(24).fill(0);
        (salesInfo || []).forEach((sale: any) => {
          if (!sale.created_at) return;
          const hr = new Date(sale.created_at).getHours();
          hourCounts[hr] += Number(sale.total || 0);
        });
        let peakHour = 12; // default
        let peakSalesAmount = 0;
        hourCounts.forEach((amt, hr) => {
          if (amt > peakSalesAmount) {
            peakSalesAmount = amt;
            peakHour = hr;
          }
        });
        const peakSalesHour = `${peakHour.toString().padStart(2, '0')}:00 - ${(peakHour + 1).toString().padStart(2, '0')}:00`;
        const weeklyRunrate = last7Days.reduce((sum, d) => sum + d.revenue, 0);

        setSummaryStats({
          todayRevenue,
          todayTransactions,
          averageOrderValue,
          peakSalesHour,
          weeklyRunrate
        });

        // Dynamic month-over-month sales trend calculation
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const thisMonthSales = (salesInfo || []).filter((sale: any) => {
          if (!sale.created_at) return false;
          const d = new Date(sale.created_at);
          return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        }).reduce((acc: number, sale: any) => acc + Number(sale.total || 0), 0);

        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const lastMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthSales = (salesInfo || []).filter((sale: any) => {
          if (!sale.created_at) return false;
          const d = new Date(sale.created_at);
          return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonthIndex;
        }).reduce((acc: number, sale: any) => acc + Number(sale.total || 0), 0);

        let calculatedTrend = "All-time cumulative sales";
        if (lastMonthSales > 0) {
          const change = ((thisMonthSales - lastMonthSales) / lastMonthSales) * 100;
          calculatedTrend = `${change >= 0 ? '+' : ''}${change.toFixed(1)}% compared to last month`;
        } else if (thisMonthSales > 0) {
          calculatedTrend = "Initial month of sales records";
        } else if (realSales > 0) {
          calculatedTrend = "All-time cumulative total";
        } else {
          calculatedTrend = "No sales records captured yet";
        }

        setStats({
          totalSales: realSales,
          transactions: salesInfo?.length || 0,
          lowStock: lowStockCount || 0,
          activeBranches: branchesCount,
          salesTrend: calculatedTrend
        });

        // Compute Branch Sales Performance Data
        const branchesMap: Record<string, string> = {};
        branches.forEach((b: any) => {
          branchesMap[b.id] = b.name;
        });

        const salesByBranch: Record<string, number> = {};
        const transactionsByBranch: Record<string, number> = {};
        branches.forEach((b: any) => {
          salesByBranch[b.id] = 0;
          transactionsByBranch[b.id] = 0;
        });

        let unassignedSales = 0;
        let unassignedTx = 0;

        (salesInfo || []).forEach((sale: any) => {
          const bId = sale.branch_id;
          if (bId && salesByBranch[bId] !== undefined) {
            salesByBranch[bId] += Number(sale.total || 0);
            transactionsByBranch[bId] += 1;
          } else {
            unassignedSales += Number(sale.total || 0);
            unassignedTx += 1;
          }
        });

        const salesChart = branches.map((b: any) => ({
          name: b.name,
          sales: salesByBranch[b.id] || 0,
          transactions: transactionsByBranch[b.id] || 0
        }));

        if (unassignedSales > 0) {
          salesChart.push({ name: 'Unassigned', sales: unassignedSales, transactions: unassignedTx });
        }
        setBranchSalesData(salesChart);

        // Compute Branch Stock Distribution Data
        const stockByBranch: Record<string, number> = {};
        branches.forEach((b: any) => {
          stockByBranch[b.id] = 0;
        });

        let unassignedStock = 0;

        (inventoryData || []).forEach((inv: any) => {
          const bId = inv.branch_id;
          if (bId && stockByBranch[bId] !== undefined) {
            stockByBranch[bId] += Number(inv.quantity || 0);
          } else {
            unassignedStock += Number(inv.quantity || 0);
          }
        });

        const stockChart = branches.map((b: any) => ({
          name: b.name,
          stock: stockByBranch[b.id] || 0
        }));

        if (unassignedStock > 0) {
          stockChart.push({ name: 'Unassigned', stock: unassignedStock });
        }
        setBranchStockData(stockChart);

      } catch (err: any) {
        console.error("Dashboard stats telemetry error:", err);
        const errMsg = err?.message || String(err);
        if (errMsg.includes('offline') || errMsg.includes('Failed to fetch') || errMsg.includes('network')) {
          toast.warning("Working Offline: Using cached business indicators.");
        } else {
          toast.error("Telemetry Sync Error: Unable to refresh some dashboard indicators.", {
            description: errMsg.substring(0, 100)
          });
        }
      }
    }
    loadStats();
  }, [businessContext]);

  useEffect(() => {
    if (!businessContext?.business_id) {
      setAiLoading(false);
      return;
    }

    async function fetchAdvisorInsights() {
      setAiLoading(true);
      try {
        const response = await fetch("/api/ai/insights", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            totalSales: stats.totalSales,
            transactions: stats.transactions,
            lowStock: stats.lowStock,
            activeBranches: stats.activeBranches
          })
        });
        const data = await response.json();
        if (data.insight) {
          setAiInsight(data.insight);
        } else {
          setAiInsight("AI copilot advisor temporarily offline.");
        }
      } catch (err) {
        console.error("AI insight fetch failed:", err);
        setAiInsight("Unable to connect to predictive advisory server at this time. Please check your internet connection.");
      } finally {
        setAiLoading(false);
      }
    }

    const timer = setTimeout(fetchAdvisorInsights, 300);
    return () => clearTimeout(timer);
  }, [businessContext, stats.totalSales, stats.transactions, stats.lowStock, stats.activeBranches]);

  useEffect(() => {
    async function ensureBusinessProfile() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          setLoading(false);
          return;
        }

        let finalBusId = '';
        let finalBrId = '';

        const { data: businessData, error: businessError } = await supabase
          .from('business_users')
          .select('business_id, branch_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        let bizExists = false;
        if (businessData) {
          finalBusId = businessData.business_id;
          finalBrId = businessData.branch_id;
          
          const { data: bizDoc } = await supabase.from('businesses').select('id').eq('id', finalBusId).limit(1).maybeSingle();
          if (bizDoc) bizExists = true;
        }

        const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', userData.user.id).limit(1).maybeSingle();
        if (profile?.first_name) {
          setProfileName(profile.first_name);
        }

        if (businessError || !businessData || !bizExists) {
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
          
          const regNo = `TZ-${Math.floor(100000 + Math.random() * 900000)}/${new Date().getFullYear()}`;
          const newBusinessId = regNo.replace(/\//g, '-');
          const newRoleId = crypto.randomUUID();
          const newBranchId = crypto.randomUUID();

          // Step 1: Establish tenancy link in business_users FIRST to satisfy belongsToUserBusiness rule
          const { error: buErr } = await supabase.from('business_users').insert({
            id: userData.user.id,
            business_id: newBusinessId,
            user_id: userData.user.id,
            branch_id: newBranchId,
            role_id: newRoleId,
            is_active: true
          });
          if (buErr) throw buErr;

          // Step 2: Set target active business ID cache
          const { setActiveBusinessId } = await import('../lib/firebaseClient');
          setActiveBusinessId(newBusinessId);

          // Step 3: Create business
          const { error: bErr } = await supabase.from('businesses').insert({
            id: newBusinessId,
            name: `My Business (${regNo})`,
            tax_number: regNo,
            created_at: new Date().toISOString()
          });
          if (bErr) throw bErr || new Error("Failed to create business");
          finalBusId = newBusinessId;
          
          // Step 4: Create role
          const { error: rErr } = await supabase.from('roles').insert({
            id: newRoleId,
            business_id: newBusinessId,
            name: 'Admin',
            description: 'System Administrator'
          });
          if (rErr) throw rErr || new Error("Failed to create role");

          // Step 5: Create branch
          const { error: brErr } = await supabase.from('branches').insert({
            id: newBranchId,
            business_id: newBusinessId,
            name: 'Main Branch',
            type: 'retail'
          });
          if (brErr) throw brErr || new Error("Failed to create branch");
          finalBrId = newBranchId;

          // Default category
          await supabase.from('categories').insert({ business_id: newBusinessId, name: 'General' });

          // Free trial sub
          await supabase.from('subscriptions').insert({ business_id: newBusinessId, plan_name: 'free_trial', status: 'active' });
          
          toast.success('Your business profile has been initialized.');
        }

        const context = {
          business_id: finalBusId || '',
          branch_id: finalBrId || '',
          user_id: userData.user.id
        };
        setBusinessContext(context);
        if (context.business_id) {
          fetchOpenSession(context.business_id);
          
          const { data: bData } = await supabase.from('businesses')
            .select('name, subscription_status')
            .eq('id', context.business_id)
            .limit(1)
            .maybeSingle();
            
          if (bData) {
            setBusinessName(bData.name || '');
            setBizSubscriptionStatus(bData.subscription_status || '');
          }

          // Fetch latest subscription to check if it's pending review
          const { data: latestSub } = await supabase.from('subscriptions')
            .select('*')
            .eq('business_id', context.business_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestSub) {
            setPendingSubscription(latestSub);
            if (latestSub.status === 'pending_pop_verification') {
              const createdTime = new Date(latestSub.created_at || Date.now()).getTime();
              const elapsedSeconds = Math.floor((Date.now() - createdTime) / 1000);
              const remaining = Math.max(300 - elapsedSeconds, 0);
              setVerificationCountdown(remaining);
            }
          }
        }
      } catch (err) {
        console.error("Error ensuring business profile:", err);
      } finally {
        setLoading(false);
      }
    }

    ensureBusinessProfile();
  }, []);

  // Real-time verification countdown clock simulation on the dashboard
  useEffect(() => {
    if (bizSubscriptionStatus !== 'PENDING_VERIFICATION') return;

    const timer = setInterval(() => {
      setVerificationCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [bizSubscriptionStatus]);

  const handleSimulateAutoApprove = async () => {
    try {
      if (!businessContext?.business_id || !pendingSubscription) return;
      
      const { error: subErr } = await supabase.from('subscriptions').update({
        status: 'active'
      }).eq('id', pendingSubscription.id);

      if (subErr) throw subErr;

      const { error: bizErr } = await supabase.from('businesses').update({
        subscription_status: 'ACTIVE'
      }).eq('id', businessContext.business_id);

      if (bizErr) throw bizErr;

      toast.success("EcoCash Proof of Payment Verified!", {
        description: `Your subscription has been verified. Welcome to Pro ERP!`,
        duration: 8000
      });

      setBizSubscriptionStatus('ACTIVE');
      setPendingSubscription({ ...pendingSubscription, status: 'active' });
    } catch (err) {
      console.error("Auto approve simulation error on dashboard:", err);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
     return <div className="p-8 text-center text-zinc-500">Checking business profile...</div>;
  }

  const getGreeting = () => {
    if (businessName) {
      return `Welcome back, ${businessName}`;
    } else {
      return 'Welcome back to your workspace';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex flex-col sm:flex-row sm:items-end gap-2">
            <span>{getGreeting()}!</span>
          </h2>
          <p className="text-zinc-500 font-medium mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} — Your business performance overview.
          </p>
        </div>
      </div>

      {/* 🔒 Subscription Verification Alert */}
      {bizSubscriptionStatus === 'PENDING_VERIFICATION' && (
        <div className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-in zoom-in-95 duration-300 ${
          verificationCountdown === 0 
            ? 'border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-950/60' 
            : 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/40 dark:border-amber-950/60'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl shrink-0 ${
              verificationCountdown === 0 
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' 
                : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
            }`}>
              <RefreshCw className={`w-5 h-5 ${verificationCountdown > 0 ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tracking-tight flex items-center gap-2">
                <span>🔒 Subscription Review in Progress</span>
                {verificationCountdown === 0 && (
                  <span className="bg-rose-100 text-rose-800 text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full dark:bg-rose-950/55 dark:text-rose-400">
                    Delayed
                  </span>
                )}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl font-medium leading-relaxed">
                {verificationCountdown === 0 ? (
                  <>
                    <span className="font-extrabold text-rose-600 dark:text-rose-400">Verification Lag Detected:</span> Your EcoCash Proof of Payment verification is taking longer than expected. Standard 5-minute audit window has passed (Ref: <span className="font-mono font-bold text-zinc-805 dark:text-zinc-200 bg-black/5 dark:bg-black/20 px-1 rounded">{pendingSubscription?.pop_reference || 'REF-PENDING'}</span>). Please wait or use administrative simulation below to approve immediately in sandbox mode.
                  </>
                ) : (
                  <>
                    Your EcoCash Proof of Payment (POP) of <span className="font-bold text-zinc-850 dark:text-zinc-200">{pendingSubscription?.pop_amount || 'license fee'}</span> (Reference Code: <span className="font-mono font-bold text-zinc-850 dark:text-zinc-200 bg-black/5 dark:bg-black/20 px-1 rounded">{pendingSubscription?.pop_reference || 'Pending'}</span>) is being audited. Standard verification completes in <span className="font-extrabold text-amber-600 dark:text-amber-400">{formatCountdown(verificationCountdown)}</span> minutes.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button 
              variant="outline"
              onClick={handleSimulateAutoApprove}
              className={`font-bold text-xs h-10 px-5 rounded-xl shadow-sm flex items-center gap-2 border-none cursor-pointer ${
                verificationCountdown === 0 
                  ? 'text-rose-700 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/45 dark:text-rose-400' 
                  : 'text-amber-700 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/45 dark:text-amber-450'
              }`}
            >
              <Check className="w-4 h-4" /> Simulate Immediate Admin Approval
            </Button>
          </div>
        </div>
      )}

      {/* 🧾 Register Shift Summary Dashboard Widget */}
      {sessionLoading ? (
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-3 animate-pulse">
          <RefreshCw className="h-4 w-4 text-zinc-400 animate-spin" />
          <span className="text-xs text-zinc-500 font-medium">Syncing checkout shift session telemetry...</span>
        </div>
      ) : activeSession ? (
        <Card className="border border-emerald-500/20 dark:border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 overflow-hidden relative group rounded-2xl shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
          <CardContent className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
              {/* Badge Icon */}
              <div className="p-3 bg-emerald-500/15 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0 select-none max-w-fit">
                <Unlock className="h-5 w-5 animate-pulse" />
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">Active Register Shift</h4>
                  <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide font-sans animate-pulse">
                    OPEN
                  </span>
                </div>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Active Shift ID: <span className="font-mono text-zinc-700 dark:text-zinc-300 font-bold bg-zinc-200/50 dark:bg-zinc-800 px-1.5 py-0.5 rounded">#{activeSession.id.substring(0, 8)}</span> — cashier register is online.
                </p>
              </div>

              {/* Stat 1: Duration */}
              <div className="md:border-l border-zinc-200 dark:border-zinc-800 md:pl-4 min-w-[120px]">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Shift Duration</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Clock className="h-4 w-4 text-zinc-500" />
                  <span className="text-sm font-extrabold font-mono text-zinc-800 dark:text-zinc-100">{sessionDuration}</span>
                </div>
              </div>

              {/* Stat 2: Expected Cash */}
              <div className="md:border-l border-zinc-200 dark:border-zinc-800 md:pl-4 min-w-[150px]">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-sans">Expected Cash-In-Hand</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-400">
                    ${Number(activeSession.expected_balance ?? activeSession.opening_balance ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 w-full lg:w-auto self-stretch lg:self-center items-center justify-end">
              <Button
                type="button"
                onClick={() => {
                  setClosingCashInput(Number(activeSession.expected_balance ?? activeSession.opening_balance ?? 0).toFixed(2));
                  setIsClosingOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-extrabold text-xs h-9.5 px-4 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 w-full sm:w-auto whitespace-nowrap border-0"
              >
                <Lock className="h-3.5 w-3.5" />
                Quick-Close Register
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden relative group rounded-2xl shadow-sm">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="p-3 bg-zinc-200 dark:bg-zinc-800 rounded-xl text-zinc-500 shrink-0 select-none">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">No Active Register Shift</h4>
                  <span className="bg-zinc-200 text-zinc-600 dark:bg-zinc-850 dark:text-zinc-400 px-2 py-0.5 rounded-full text-[10px] font-bold font-sans">
                    OFFLINE
                  </span>
                </div>
                <p className="text-xs text-zinc-500 max-w-xl">
                  Retail checkout actions and stock audit adjustments are frozen when the register shift is offline. Start shift window below.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => {
                setOpeningFloatInput('0');
                setIsOpeningOpen(true);
              }}
              className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-xs h-9.5 px-4 rounded-xl shadow-sm flex items-center gap-1.5 w-full sm:w-auto border-0"
            >
              <Play className="h-3.5 w-3.5" />
              Open Cashier Register
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 🚀 Opening Register Dialog */}
      <Dialog open={isOpeningOpen} onOpenChange={setIsOpeningOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <Unlock className="h-5 w-5 text-emerald-600" />
              Open Cashier Register
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Verify your starting cash float amounts on hand before putting the checkout register online.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="openingFloat" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                Starting Cash Float ($ USD)
              </Label>
              <Input
                id="openingFloat"
                type="number"
                placeholder="0.00"
                value={openingFloatInput}
                onChange={(e) => setOpeningFloatInput(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:ring-emerald-500 text-sm font-mono text-zinc-900 dark:text-zinc-50"
              />
              <p className="text-[10px] text-zinc-400">
                This amount represents the opening change float cash on hand in the physical cash drawer.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpeningOpen(false)}
              className="border border-zinc-250 hover:bg-zinc-50 font-bold text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleOpenSession}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 border-0"
            >
              Confirm & Open Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔒 Closing Register Dialog */}
      <Dialog open={isClosingOpen} onOpenChange={setIsClosingOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <Lock className="h-5 w-5 text-rose-600 animate-pulse" />
              Close Register & Shift
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Complete the shift reconciliation audit by confirming the counted physical cash in hand.
            </DialogDescription>
          </DialogHeader>
          {activeSession && (
            <div className="space-y-4 py-3 text-zinc-900 dark:text-zinc-50">
              <div className="bg-zinc-50 dark:bg-zinc-905 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-semibold">Expected Balance:</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100 font-extrabold">
                    ${Number(activeSession.expected_balance ?? activeSession.opening_balance ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-450 font-semibold font-sans">Opening Float:</span>
                  <span className="font-mono text-zinc-750 dark:text-zinc-300">
                    ${Number(activeSession.opening_balance || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="countedCash" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                  Counted Cash-In-Hand ($ USD)
                </Label>
                <Input
                  id="countedCash"
                  type="number"
                  placeholder="0.00"
                  value={closingCashInput}
                  onChange={(e) => setClosingCashInput(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-mono text-zinc-900 dark:text-zinc-50 font-bold"
                />
              </div>

              {(() => {
                const countedVal = parseFloat(closingCashInput) || 0;
                const expectedVal = Number(activeSession.expected_balance ?? activeSession.opening_balance ?? 0);
                const varianceVal = countedVal - expectedVal;
                
                if (varianceVal !== 0) {
                  return (
                    <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 text-[11px] rounded-xl flex items-start gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Shift Variance Alert:</strong> Counted cash differs from system expectations by{" "}
                        <span className="font-bold underline">
                          {varianceVal > 0 ? `+$${varianceVal.toFixed(2)}` : `-$${Math.abs(varianceVal).toFixed(2)}`}
                        </span>
                        . An automatic audit event log will be committed.
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 text-[11px] rounded-xl flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Perfect Reconciliation:</strong> Cash drawer counts perfectly match digital cashier shift expectations.
                      </div>
                    </div>
                  );
                }
              })()}

              <div className="space-y-2">
                <Label htmlFor="closingNotes" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                  Reconciliation Notes
                </Label>
                <Input
                  id="closingNotes"
                  placeholder="e.g. End of shift drawer count checkout"
                  value={closingNotesInput}
                  onChange={(e) => setClosingNotesInput(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-50"
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsClosingOpen(false)}
              className="border border-zinc-250 hover:bg-zinc-50 font-bold text-xs h-9 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCloseSession}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-9 border-0"
            >
              Reconcile & Close Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 shadow-sm shadow-zinc-200/50 dark:shadow-none hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-zinc-500">Total Sales (USD)</CardTitle>
            <div className="p-2 bg-primary/10 rounded-md">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-50">
               {stats.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2 flex items-center font-medium">
               {stats.salesTrend}
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

      {/* 🔮 Tareza GPT — Predictive AI Advisor */}
      <Card className="border border-violet-500/20 bg-gradient-to-r from-violet-500/5 via-fuchsia-500/5 to-transparent dark:from-violet-950/15 dark:via-fuchsia-950/10 overflow-hidden relative rounded-2xl shadow-sm my-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -mr-12 -mt-12"></div>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-950 dark:text-zinc-50">
              <div className="p-1.5 bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 rounded-lg shrink-0">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
              <span className="tracking-tight">Tareza GPT Predictive AI Advisor</span>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Dynamic demand forecasting and stock reordering priority models powered by Gemini 3.5.
            </CardDescription>
          </div>
          <span className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
            Active Predictor
          </span>
        </CardHeader>
        <CardContent className="pb-5">
          {aiLoading ? (
            <div className="py-8 text-center space-y-2">
              <RefreshCw className="h-5 w-5 text-violet-500 animate-spin mx-auto" />
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold animate-pulse">Running planning algorithms...</p>
            </div>
          ) : aiInsight ? (
            <div className="space-y-4">
              {renderFormattedInsight(aiInsight)}
            </div>
          ) : (
            <div className="text-xs text-zinc-405 py-3">
              No predictive insights has been compiled for this period yet. Try refreshing later.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 📊 Dynamic Branch-wise Revenue vs Stock Valuation Overview */}
      {businessContext?.business_id && (
        <DynamicBranchOverview businessId={businessContext.business_id} />
      )}

      {/* 🚀 Daily Operations Performance Summary Cards & Daily Revenue Trend Section */}
      <div className="space-y-6 my-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            <span>Daily Performance & Operational Metrics</span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time transactional and billing performance tracking for the current business operations.
          </p>
        </div>

        {/* Summary Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-colors"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-bold tracking-wider uppercase text-zinc-500">Today's Revenue</CardTitle>
              <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <DollarSign className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-50">
                ${summaryStats.todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2 flex items-center gap-1 font-semibold">
                <span className="text-emerald-500 font-bold">100% accurate</span> from live cash register
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-bold tracking-wider uppercase text-zinc-500">Processed Tickets (Today)</CardTitle>
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <CreditCard className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-50">
                {summaryStats.todayTransactions}
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2 flex items-center gap-1 font-semibold">
                <span>Active counter checkouts</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-bold tracking-wider uppercase text-zinc-500">Average Order Value (AOV)</CardTitle>
              <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
                <Coins className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-50">
                ${summaryStats.averageOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2 flex items-center gap-1 font-semibold">
                <span>Mean ticket spending size</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl group-hover:bg-violet-500/10 transition-colors"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-bold tracking-wider uppercase text-zinc-500">Peak Transaction window</CardTitle>
              <div className="p-1.5 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-lg">
                <Clock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-black font-sans tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
                {summaryStats.peakSalesHour}
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2.5 flex items-center gap-1 font-semibold">
                <span>Highest concentration of traffic</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Linear Trend Line Chart */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500 animate-pulse" />
                <span>7-Day Daily Operations Trend Engine</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Line chart tracking incremental daily gross volumes and receipts generated dynamically.
              </CardDescription>
            </div>
            {/* Metric Toggle Switches */}
            <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 self-start">
              <button
                onClick={() => setTrendMetric('revenue')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  trendMetric === 'revenue'
                    ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                Gross revenue ($ USD)
              </button>
              <button
                onClick={() => setTrendMetric('transactions')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  trendMetric === 'transactions'
                    ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                Receipt Transactions
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 pl-2">
            <div className="h-[280px] w-full">
              {dailyTrendData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs">
                  <RefreshCw className="h-5 w-5 animate-spin mb-2 text-zinc-300" />
                  <p>Assembling daily historical run times...</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#27272a" : "#E5E7EB"} />
                    <XAxis
                      dataKey="date"
                      stroke={isDark ? "#a1a1aa" : "#6B7280"}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis
                      stroke={isDark ? "#a1a1aa" : "#6B7280"}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => trendMetric === 'revenue' ? `$${value}` : value}
                      dx={-10}
                      className="font-mono"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: isDark ? '1px solid #27272a' : '1px solid #E5E7EB',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#18181b' : '#FFFFFF',
                        color: isDark ? '#f4f4f5' : '#18181b',
                      }}
                      itemStyle={{
                        fontFamily: 'JetBrains Mono',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: isDark ? '#818cf8' : '#4f46e5',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={trendMetric === 'revenue' ? 'revenue' : 'txCount'}
                      name={trendMetric === 'revenue' ? 'Gross Revenue' : 'Transactions'}
                      stroke={isDark ? "#818cf8" : "#4f46e5"}
                      strokeWidth={3}
                      dot={{ stroke: isDark ? "#818cf8" : "#4f46e5", strokeWidth: 2, r: 4, fill: isDark ? "#121214" : "#ffffff" }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: isDark ? "#a5b4fc" : "#312e81" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
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
        
        {/* Enterprise Upgrade & Stock Take Audit Card */}
        <Card className="col-span-3 border-0 shadow-xl bg-gradient-to-br from-indigo-900 to-indigo-950 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <CardHeader className="relative z-10">
            <CardTitle className="flex items-center space-x-2 text-white">
              <div className="p-1.5 bg-indigo-500/20 rounded-md">
                 <Package className="h-5 w-5 text-indigo-300" />
              </div>
              <span className="tracking-tight">Enterprise Sync & Stock Take Auditing Hub</span>
            </CardTitle>
            <CardDescription className="text-zinc-400">Scale your retail chain with our comprehensive Stock Take Auditing Module and real-time Multi-Branch Sync engine built directly into the central cloud ledger.</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 w-full">
            <div className="flex flex-col p-6 bg-white/5 rounded-xl border border-white/10 space-y-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">$15</span>
                <span className="text-zinc-400 text-sm">/month plan fee</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Connect your warehouses and physical retail branches automatically. Manage stocktakes, review discrepancies, and minimize cash or product leakages with easy physical-to-digital inventory reconciliations.
              </p>
              <div className="space-y-1.5 text-xs text-zinc-400 border-t border-white/5 pt-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span><strong>Comprehensive Stock Taking</strong>: Automatic physical-to-digital inventory reconciling with margin protection</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span><strong>Multi-Branch Sync Engine</strong>: Instantly link warehouses, brick-and-mortar storefronts, and offices</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span><strong>Developer Support Coverage</strong>: Support line to engineering teams & API Diagnostic consoles</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <a href="https://wa.me/263776699950" target="_blank" rel="noopener noreferrer" className="block">
                  <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white transition-all font-bold text-xs py-2.5 rounded-lg shadow-md">
                    Inquire via WhatsApp
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

      {/* 📊 Multi-Branch Performance & Inventory Diagnostics */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Branch Sales Performance Comparison */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span>Branch Sales Performance</span>
            </CardTitle>
            <CardDescription>Comparative gross revenue ($ USD) and receipts across active branches.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full mt-2">
              {branchSalesData.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-zinc-400 text-xs">
                  <p>No sales records registered across branches yet.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchSalesData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#27272a" : "#E5E7EB"} />
                    <XAxis 
                      dataKey="name" 
                      stroke={isDark ? "#a1a1aa" : "#6B7280"}
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke={isDark ? "#a1a1aa" : "#6B7280"}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                      className="font-mono"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px', 
                        border: isDark ? '1px solid #27272a' : '1px solid #E5E7EB', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#18181b' : '#FFFFFF',
                        color: isDark ? '#f4f4f5' : '#18181b'
                      }}
                      formatter={(val: any, name: any) => {
                        if (name === 'sales') return [`$${Number(val).toFixed(2)}`, 'Gross Sales'];
                        if (name === 'transactions') return [val, 'Receipts'];
                        return [val, name];
                      }}
                    />
                    <Bar dataKey="sales" name="sales" fill={isDark ? "#c084fc" : "#7c3aed"} radius={[4, 4, 0, 0]}>
                      {branchSalesData.map((entry, index) => {
                        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
                        const color = colors[index % colors.length];
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Branch Stock Distribution */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-emerald-500" />
              <span>Stock Distribution by Branch</span>
            </CardTitle>
            <CardDescription>Physical layout of total product quantities across branches & warehouses.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full mt-2">
              {branchStockData.length === 0 || branchStockData.every(b => b.stock === 0) ? (
                <div className="h-full flex flex-col justify-center items-center text-zinc-400 text-xs">
                  <p>No stock quantities registered across warehouses yet.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={branchStockData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="stock"
                      nameKey="name"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {branchStockData.map((entry, index) => {
                        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
                        const color = colors[index % colors.length];
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px', 
                        border: isDark ? '1px solid #27272a' : '1px solid #E5E7EB', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#18181b' : '#FFFFFF',
                        color: isDark ? '#f4f4f5' : '#18181b'
                      }}
                      formatter={(val: any) => [`${Number(val).toLocaleString()} Units`, 'Stock Quantity']}
                    />
                    <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
