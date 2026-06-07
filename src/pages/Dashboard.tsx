import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Activity, CreditCard, DollarSign, Package, Sparkles, Clock, Lock, Unlock, Play, RefreshCw, AlertTriangle, CheckCircle2, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend, PieChart, Pie } from 'recharts';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  const [chartData, setChartData] = useState<{name: string, sales: number}[]>([]);
  const [stats, setStats] = useState({ totalSales: 0, transactions: 0, lowStock: 0, activeBranches: 0 });
  const [branchSalesData, setBranchSalesData] = useState<{ name: string; sales: number; transactions: number }[]>([]);
  const [branchStockData, setBranchStockData] = useState<{ name: string; stock: number }[]>([]);
  const [branchesList, setBranchesList] = useState<{ id: string; name: string }[]>([]);

  const [activeSession, setActiveSession] = useState<any>(null);
  const [sessionDuration, setSessionDuration] = useState<string>('00h 00m');
  const [sessionLoading, setSessionLoading] = useState<boolean>(true);
  const [isClosingOpen, setIsClosingOpen] = useState(false);
  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [closingCashInput, setClosingCashInput] = useState('');
  const [closingNotesInput, setClosingNotesInput] = useState('');
  const [openingFloatInput, setOpeningFloatInput] = useState('0');
  const [businessContext, setBusinessContext] = useState<{ business_id: string; branch_id: string; user_id: string } | null>(null);

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

        // Fetch branches
        const { data: branchesData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('business_id', bizId);

        const branches = branchesData || [];
        setBranchesList(branches);

        // Fetch sales
        const { data: salesInfo } = await supabase
          .from('sales')
          .select('total, branch_id, created_at')
          .eq('business_id', bizId);

        // Fetch active products
        const { data: activeProducts } = await supabase
          .from('products')
          .select('id')
          .eq('business_id', bizId)
          .eq('is_active', true);

        // Fetch inventory
        const { data: inventoryData } = await supabase
          .from('inventory')
          .select('product_id, quantity, reorder_level, branch_id')
          .eq('business_id', bizId);

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

        if (salesInfo && salesInfo.length > 0) {
           realSales = salesInfo.reduce((acc: number, sale: any) => acc + Number(sale.total || 0), 0);
           
           salesInfo.forEach((sale: any) => {
              if (!sale.created_at) return;
               const d = new Date(sale.created_at);
               const dayName = days[d.getDay()];
               if (chartPoints[dayName] !== undefined) {
                   chartPoints[dayName] += Number(sale.total || 0);
               }
           });
        }
        
        setChartData(Object.keys(chartPoints).map(key => ({ name: key, sales: chartPoints[key] })));

        setStats({
          totalSales: realSales,
          transactions: salesInfo?.length || 0,
          lowStock: lowStockCount || 0,
          activeBranches: branchesCount
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

      } catch (err) {
        console.error(err);
      }
    }
    loadStats();
  }, [businessContext]);

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

        if (businessData) {
          finalBusId = businessData.business_id;
          finalBrId = businessData.branch_id;
        }

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
          finalBusId = bData.id;
          
          // Create role
          const { data: rData, error: rErr } = await supabase.from('roles').insert({ business_id: bData.id, name: 'Admin', description: 'System Administrator' }).select().single();
          if (rErr || !rData) throw rErr || new Error("Failed to create role");

          // Create branch
          const { data: brData, error: brErr } = await supabase.from('branches').insert({ business_id: bData.id, name: 'Main Branch', type: 'retail' }).select().single();
          if (brErr || !brData) throw brErr || new Error("Failed to create branch");
          finalBrId = brData.id;

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

        const context = {
          business_id: finalBusId || '',
          branch_id: finalBrId || '',
          user_id: userData.user.id
        };
        setBusinessContext(context);
        if (context.business_id) {
          fetchOpenSession(context.business_id);
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
