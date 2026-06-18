import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Bar,
  Cell
} from 'recharts';
import {
  TrendingUp,
  Package,
  Loader2,
  AlertCircle,
  Building2,
  DollarSign,
  BarChart3,
  Calendar,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { supabase } from '../../lib/firebaseClient';
import { toast } from 'sonner';

interface Branch {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  cost_price: number;
  retail_price: number;
}

interface InventoryItem {
  product_id: string;
  quantity: number;
  branch_id: string;
}

interface SaleRecord {
  total: number;
  branch_id: string;
  created_at: string;
}

interface StockMovement {
  product_id: string;
  quantity: number;
  branch_id: string;
  created_at: string;
  type: string;
}

interface ChartMonthPoint {
  monthKey: string; // e.g. "2026-06"
  monthName: string; // e.g. "Jun 26"
  revenue: number;
  stockValuation: number;
  stockUnits: number;
}

export function DynamicBranchOverview() {
  const [loading, setLoading] = useState<boolean>(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  
  // RAW Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  // Period ranges: Past 6 Months
  const pastMonths = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      list.push({
        key: `${year}-${month}`,
        name: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        startDate: new Date(year, d.getMonth(), 1, 0, 0, 0, 0),
        endDate: new Date(year, d.getMonth() + 1, 0, 23, 59, 59, 999)
      });
    }
    return list;
  }, []);

  // Bulk Data Loader
  useEffect(() => {
    async function loadSaaSMetrics() {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData || !userData.user) return;

        // Fetch User Business Association
        const { data: bizUserData, error: bizUserErr } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        if (bizUserErr || !bizUserData) {
          throw new Error("Could not construct operating business context.");
        }

        const bizId = bizUserData.business_id;

        // Parallel Query Pipeline (Optimized SaaS standard)
        const [branchesRes, productsRes, inventoryRes, salesRes, movementsRes] = await Promise.all([
          supabase.from('branches').select('id, name').eq('business_id', bizId),
          supabase.from('products').select('id, name, cost_price, retail_price').eq('business_id', bizId),
          supabase.from('inventory').select('product_id, quantity, branch_id').eq('business_id', bizId),
          supabase.from('sales').select('total, branch_id, created_at').eq('business_id', bizId),
          supabase.from('stock_movements').select('product_id, quantity, branch_id, created_at, type').eq('business_id', bizId)
        ]);

        if (branchesRes.data) setBranches(branchesRes.data);
        if (productsRes.data) setProducts(productsRes.data);
        if (inventoryRes.data) setInventories(inventoryRes.data);
        if (salesRes.data) setSales(salesRes.data);
        if (movementsRes.data) setMovements(movementsRes.data);

      } catch (err: any) {
        console.error("Dynamic Branch Overview Loader failed:", err);
        toast.error("Telemetry failed to aggregate branch metrics: " + (err.message || err));
      } finally {
        setLoading(false);
      }
    }

    loadSaaSMetrics();
  }, []);

  // Compute stats based on selected branch
  const computedTrends = useMemo(() => {
    if (loading) return [];

    // Map product prices for high performance lookup
    const productsMap = new Map<string, Product>();
    products.forEach(p => productsMap.set(p.id, p));

    // Construct trend points for past 6 months
    return pastMonths.map(month => {
      // 1. FILTER SALES FOR THIS MONTH AND BRANCH
      const monthSales = sales.filter(s => {
        const saleDate = new Date(s.created_at);
        const inMonth = saleDate >= month.startDate && saleDate <= month.endDate;
        const branchMatches = selectedBranchId === 'all' || s.branch_id === selectedBranchId;
        return inMonth && branchMatches;
      });

      const totalRevenue = monthSales.reduce((sum, s) => sum + Number(s.total || 0), 0);

      // 2. RECONSTRUCT INVENTORY LEVELS AND VALUATIONS AT MONTH-END
      // We take the current on-hand quantities for the selected branch as the baseline
      const inventoryBasis: Record<string, number> = {};
      
      // Seed current inventory for selected branch and products
      inventories.forEach(inv => {
        if (selectedBranchId !== 'all' && inv.branch_id !== selectedBranchId) return;
        
        // Sum current stock across branches if 'all' is chosen
        inventoryBasis[inv.product_id] = (inventoryBasis[inv.product_id] || 0) + Number(inv.quantity || 0);
      });

      // Filter movements that happened AFTER the end of this month
      const movementsAfterMonthEnd = movements.filter(mov => {
        const movDate = new Date(mov.created_at);
        const isAfter = movDate > month.endDate;
        const branchMatches = selectedBranchId === 'all' || mov.branch_id === selectedBranchId;
        return isAfter && branchMatches;
      });

      // Reverse movements to calculate past inventory at month end
      // PastInventory = CurrentInventory - QuantityChange
      movementsAfterMonthEnd.forEach(mov => {
        if (inventoryBasis[mov.product_id] === undefined) {
          inventoryBasis[mov.product_id] = 0;
        }
        inventoryBasis[mov.product_id] -= Number(mov.quantity || 0);
      });

      // Calculate total stock valuation and unit levels for this month point
      let totalStockValuation = 0;
      let totalStockUnits = 0;

      Object.entries(inventoryBasis).forEach(([pId, qty]) => {
        const prod = productsMap.get(pId);
        const cost = prod ? Number(prod.cost_price || 0) : 0;
        
        // Disallow negative logical inventory reconstructions
        const sanitizedQty = Math.max(0, qty);
        totalStockValuation += sanitizedQty * cost;
        totalStockUnits += sanitizedQty;
      });

      return {
        monthKey: month.key,
        monthName: month.name,
        revenue: Math.round(totalRevenue * 100) / 100,
        stockValuation: Math.round(totalStockValuation * 100) / 100,
        stockUnits: totalStockUnits
      };
    });

  }, [loading, selectedBranchId, products, inventories, sales, movements, pastMonths]);

  // Current Metrics display
  const branchKPI = useMemo(() => {
    if (computedTrends.length === 0) return { revenue: 0, stock: 0, units: 0 };
    const latest = computedTrends[computedTrends.length - 1];
    
    // Total current inventory valuation
    const currentValuation = inventories.reduce((sum, inv) => {
      if (selectedBranchId !== 'all' && inv.branch_id !== selectedBranchId) return sum;
      const prod = products.find(p => p.id === inv.product_id);
      const cost = prod ? Number(prod.cost_price || 0) : 0;
      return sum + (Number(inv.quantity || 0) * cost);
    }, 0);

    const currentUnits = inventories.reduce((sum, inv) => {
      if (selectedBranchId !== 'all' && inv.branch_id !== selectedBranchId) return sum;
      return sum + Number(inv.quantity || 0);
    }, 0);

    return {
      revenue: latest?.revenue || 0,
      stockValuation: currentValuation,
      stockUnits: currentUnits
    };
  }, [computedTrends, inventories, products, selectedBranchId]);

  if (loading) {
    return (
      <Card className="border border-zinc-200 dark:border-zinc-800 shadow-xs p-6 bg-white dark:bg-zinc-950 rounded-2xl min-h-[300px] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs text-zinc-500 font-mono mt-3">Synthesizing multidimensional branch telemetry...</span>
      </Card>
    );
  }

  return (
    <Card className="border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl overflow-hidden font-sans">
      <div className="bg-gradient-to-r from-zinc-50 to-zinc-100/50 dark:from-zinc-900/40 dark:to-zinc-900/10 p-5 border-b border-zinc-200 dark:border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-md font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Unified Branch Revenue & Stock Valuation Trends
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">
            Compare monthly sales receipts (Revenue) against inventory assets (Stock Valuation) with chronological back-ledger trace.
          </CardDescription>
        </div>

        {/* Branch Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-zinc-200/60 dark:bg-zinc-900 border border-zinc-300/50 dark:border-zinc-800 p-1 rounded-xl flex items-center gap-1.5 shadow-inner">
            <Button
              variant={selectedBranchId === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedBranchId('all')}
              className={`h-7.5 px-3 rounded-lg text-[11px] font-bold tracking-tight cursor-pointer ${
                selectedBranchId === 'all'
                  ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-black shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-300/40 dark:hover:bg-zinc-800/50'
              }`}
              id="branch-all-btn"
            >
              All Workspace Branches
            </Button>
            {branches.map(branch => (
              <Button
                key={branch.id}
                variant={selectedBranchId === branch.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedBranchId(branch.id)}
                className={`h-7.5 px-3 rounded-lg text-[11px] font-bold tracking-tight cursor-pointer ${
                  selectedBranchId === branch.id
                    ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-black shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-300/40 dark:hover:bg-zinc-800/50'
                }`}
                id={`branch-${branch.id}-btn`}
              >
                {branch.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Dynamic Branch Status Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-850 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">Latest Month Revenue</span>
              <span className="text-xl font-extrabold font-mono text-indigo-650 dark:text-indigo-400 mt-1 block">
                ${branchKPI.revenue?.toLocaleString()}
              </span>
            </div>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/45 rounded-lg border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-850 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">Current Stock Valuation (Cost)</span>
              <span className="text-xl font-extrabold font-mono text-emerald-650 dark:text-emerald-400 mt-1 block">
                ${branchKPI.stockValuation?.toLocaleString()}
              </span>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/45 rounded-lg border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400">
              <Package className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-850 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">Total physical units</span>
              <span className="text-xl font-extrabold font-mono text-amber-650 dark:text-amber-400 mt-1 block">
                {branchKPI.stockUnits?.toLocaleString()} Units
              </span>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/45 rounded-lg border border-amber-100 dark:border-amber-900 text-amber-600 dark:text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Dynamic Composed Visualizer */}
        <div className="h-[360px] w-full p-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={computedTrends} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4338ca" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#4338ca" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorStockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:stroke-zinc-800" />
              <XAxis
                dataKey="monthName"
                stroke="#71717A"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={6}
              />
              <YAxis
                stroke="#71717A"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
                dx={-6}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as ChartMonthPoint;
                    return (
                      <div className="bg-zinc-950 text-white p-3.5 border border-zinc-800 rounded-xl shadow-2xl space-y-2 text-xs">
                        <span className="font-extrabold text-[11px] text-zinc-400 block border-b border-zinc-800 pb-1.5 uppercase font-mono tracking-wider">
                          🗓️ {data.monthName} Performance
                        </span>
                        <div className="flex justify-between items-center gap-6">
                          <span className="text-zinc-350 font-medium flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            Monthly Revenue:
                          </span>
                          <span className="font-bold font-mono text-indigo-400">${data.revenue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center gap-6">
                          <span className="text-zinc-350 font-medium flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Stock Valuation:
                          </span>
                          <span className="font-bold font-mono text-emerald-400">${data.stockValuation.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center gap-6 text-[10px] text-zinc-500">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Physical Units:
                          </span>
                          <span className="font-mono">{data.stockUnits.toLocaleString()} units</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              
              {/* Revenue Area overlay */}
              <Area
                type="monotone"
                name="Monthly Revenue"
                dataKey="revenue"
                fill="url(#colorRevenueGrad)"
                stroke="#4f46e5"
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 1.5, fill: "#FFF" }}
                activeDot={{ r: 6 }}
              />

              {/* Stock Valuation Line */}
              <Line
                type="monotone"
                name="Asset Stock Valuation (At Cost)"
                dataKey="stockValuation"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#10b981" }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Proportional Insight Banner */}
        <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900 p-4 rounded-xl flex items-start gap-3.5 text-xs">
          <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-indigo-950 dark:text-indigo-350 block">SaaS Architectural Insight — Valuation & Inventory Gearing ratio</span>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
              Monitoring monthly stock asset reserves alongside sales is critical to prevent over-capitalization. By looking at these trends, you can adjust your replenishment triggers dynamically based on active consumer velocity indicators, decreasing ZIG / USD exchange-rate exposure on non-moving shelf items.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
