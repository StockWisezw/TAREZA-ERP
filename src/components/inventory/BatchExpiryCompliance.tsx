import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/firebaseClient';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Trash2, 
  Search, 
  Filter, 
  ShieldAlert, 
  ArrowUpDown, 
  FileSpreadsheet, 
  Activity,
  Archive,
  AlertOctagon,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { recordStockMovement } from '../../services/ledgerService';

export function BatchExpiryCompliance() {
  const [batches, setBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [threatFilter, setThreatFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Stats Counters
  const [stats, setStats] = useState({
    expiredCount: 0,
    near30Count: 0,
    near90Count: 0,
    totalCount: 0,
    quarantinedCount: 0
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      let businessId = '';

      if (userData?.user) {
        const { data: businessData } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        if (businessData) {
          businessId = businessData.business_id;
        }
      }

      // Fetch products
      let prodQuery = supabase.from('products').select('id, name, sku, category_id').eq('is_active', true);
      if (businessId) prodQuery = prodQuery.eq('business_id', businessId);
      const prodRes = await prodQuery;

      // Fetch branches
      let branchQuery = supabase.from('branches').select('id, name');
      if (businessId) branchQuery = branchQuery.eq('business_id', businessId);
      const branchRes = await branchQuery;

      // Fetch inventory batches
      let batchQuery = supabase.from('inventory_batches').select('*');
      if (businessId) batchQuery = batchQuery.eq('business_id', businessId);
      const batchRes = await batchQuery;

      const productsData = prodRes.data || [];
      const branchesData = branchRes.data || [];
      const batchesData = batchRes.data || [];

      setProducts(productsData);
      setBranches(branchesData);

      // Map details
      const today = new Date();
      let expired = 0;
      let near30 = 0;
      let near90 = 0;
      let totalQty = 0;

      const formattedBatches = batchesData.map((b: any) => {
        const matchedProduct = productsData.find((p: any) => p.id === b.product_id);
        const matchedBranch = branchesData.find((br: any) => br.id === b.branch_id);
        
        const expiry = new Date(b.expiry_date);
        const timeDiff = expiry.getTime() - today.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        let status: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'HEALTHY' = 'HEALTHY';
        if (daysLeft <= 0) {
          status = 'EXPIRED';
          if (b.quantity > 0) expired++;
        } else if (daysLeft <= 30) {
          status = 'CRITICAL';
          if (b.quantity > 0) near30++;
        } else if (daysLeft <= 90) {
          status = 'WARNING';
          if (b.quantity > 0) near90++;
        }

        totalQty += Number(b.quantity || 0);

        return {
          ...b,
          product_name: matchedProduct ? matchedProduct.name : 'Unknown Product',
          sku: matchedProduct ? matchedProduct.sku : '-',
          branch_name: matchedBranch ? matchedBranch.name : 'Unknown Branch',
          daysLeft,
          status
        };
      }).sort((a: any, b: any) => a.daysLeft - b.daysLeft);

      setBatches(formattedBatches);
      setStats({
        expiredCount: expired,
        near30Count: near30,
        near90Count: near90,
        totalCount: totalQty,
        quarantinedCount: formattedBatches.filter(b => b.quantity === 0 && b.batch_number !== 'B-UNBATCHED').length
      });

    } catch (err: any) {
      console.error(err);
      toast.error('Failed to reload inventory batch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle disposal / quarantine action
  const handleDisposeOrQuarantine = async (batchItem: any) => {
    if (!window.confirm(`Are you sure you want to quarantine/dispose of ${batchItem.quantity} units for Batch ${batchItem.batch_number}? This will log a regulatory hazard disposal and set the batch quantity to zero.`)) {
      return;
    }

    try {
      setSubmitting(true);
      const deductQty = -Number(batchItem.quantity);

      // Write direct stock movement to clear the inventory and batch
      const result = await recordStockMovement(
        batchItem.business_id,
        batchItem.branch_id,
        batchItem.product_id,
        deductQty,
        'DAMAGE',
        'MCAZ-SOP-REMOVAL',
        `Disposal of expired/near-expiry batch stock. Batch: ${batchItem.batch_number}`,
        undefined,
        batchItem.batch_number,
        batchItem.expiry_date
      );

      if (result.success) {
        toast.success(`Success! Batch ${batchItem.batch_number} has been zeroed and logged under Hazardous Stock Scrap.`);
        await fetchData();
      } else {
        toast.error(result.error || 'Failed to complete batch disposal.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Disposal transaction encountered an error.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter batches
  const filteredBatches = batches.filter(b => {
    const matchesBranch = selectedBranchId === 'all' || b.branch_id === selectedBranchId;
    const matchesThreat = threatFilter === 'all' || b.status === threatFilter;
    const matchesSearch = b.product_name.toLowerCase().includes(search.toLowerCase()) || 
                          b.sku.toLowerCase().includes(search.toLowerCase()) || 
                          b.batch_number.toLowerCase().includes(search.toLowerCase());

    return matchesBranch && matchesThreat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Zimbabwe Health & Safety MCAZ Regulatory Top Banner */}
      <Card className="border-l-4 border-l-orange-600 bg-orange-50/50 dark:bg-orange-950/10">
        <CardHeader className="py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 text-orange-600 mt-1 shrink-0" />
            <div>
              <CardTitle className="text-sm font-bold text-orange-900 dark:text-orange-400 uppercase tracking-wider">
                Medicines Control Authority of Zimbabwe (MCAZ) & Public Health Compliance Dashboard
              </CardTitle>
              <CardDescription className="text-xs text-orange-850 dark:text-orange-300 mt-1">
                Under Zimbabwe Food and Health Standards Act and MCAZ statutory regulations, commercial vendors and pharmaceutical suppliers are legally required to verify batch numbers, ensure First Expired First Out (FEFO) automated clearing, maintain cold-chain transparency log audits, and fully quarantine expired lots.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Grid statistics highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <Card className="border-current/10 bg-red-50/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">Expired Batches</p>
              <p className="text-2xl font-black text-red-700 dark:text-red-500 mt-1.5">{stats.expiredCount}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Legally barred from sale</p>
            </div>
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-955 text-red-655 shrink-0">
              <AlertOctagon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-current/10 bg-orange-50/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">Critical Expiry (&lt; 30 Days)</p>
              <p className="text-2xl font-black text-orange-700 dark:text-orange-500 mt-1.5">{stats.near30Count}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Requires immediate disposal/FEFO</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-955 text-orange-655 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-current/10 bg-yellow-50/10">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-500">Warning Expiry (&lt; 90 Days)</p>
              <p className="text-2xl font-black text-yellow-700 dark:text-yellow-500 mt-1.5">{stats.near90Count}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Flag for promotional liquidations</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-950/50 text-yellow-600 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-current/10">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Regulated Batch Lots</p>
              <p className="text-2xl font-black text-zinc-800 dark:text-zinc-100 mt-1.5">{batches.length}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Total tracked batches in system</p>
            </div>
            <div className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Control panel and Filters */}
      <Card className="border-zinc-200">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto grow items-stretch sm:items-center">
            
            <div className="relative grow sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search batch/product/SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-white dark:bg-zinc-850"
              />
            </div>

            <div className="w-full sm:w-44">
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-850">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-850">
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(br => (
                    <SelectItem key={br.id} value={br.id}>{br.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-44">
              <Select value={threatFilter} onValueChange={setThreatFilter}>
                <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-850">
                  <SelectValue placeholder="All Expiry Grades" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-850">
                  <SelectItem value="all">All Expiry Statuses</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="CRITICAL">Critical (&lt; 30 Days)</SelectItem>
                  <SelectItem value="WARNING">Warning (30-90 Days)</SelectItem>
                  <SelectItem value="HEALTHY">Compliant lot (&gt; 90 Days)</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>

          <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="text-xs h-9"
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Sync Lots
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batches inventory table */}
      <Card className="border-zinc-200">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Batch Expiry Ledger</CardTitle>
            <CardDescription>Comprehensive tracking records of current stock grouped by lot compliance status.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="min-w-full text-left text-xs text-zinc-500">
              <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-[11px] uppercase tracking-wider font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-150 dark:border-zinc-800">
                <tr>
                  <th className="p-3">Product Name / SKU</th>
                  <th className="p-3">Warehouse / Branch</th>
                  <th className="p-3 font-mono">Batch Lot</th>
                  <th className="p-3">Expiration Date</th>
                  <th className="p-3 text-right">Remaining Stock</th>
                  <th className="p-3 text-right">Days Left / Status</th>
                  <th className="p-3 text-center w-36">Regulatory Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-zinc-400">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-zinc-300 mb-2" />
                      Loading Zimbabwe batch health ledger...
                    </td>
                  </tr>
                ) : filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-zinc-400">
                      No tracked batch records match your active search filter options.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => {
                    const isZero = Number(b.quantity || 0) <= 0;
                    
                    return (
                      <TableRowStyle key={b.id} threat={b.status} isZero={isZero}>
                        <td className="p-3">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{b.product_name}</p>
                          <p className="font-mono text-[10px] text-zinc-400 mt-0.5">{b.sku || '-'}</p>
                        </td>
                        <td className="p-3 font-medium text-zinc-700 dark:text-zinc-300">
                          {b.branch_name}
                        </td>
                        <td className="p-3 font-mono text-zinc-650 dark:text-zinc-300 font-bold">
                          {b.batch_number}
                        </td>
                        <td className="p-3 font-mono text-zinc-700 dark:text-zinc-300">
                          {b.expiry_date}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {b.quantity} units
                        </td>
                        <td className="p-3 text-right">
                          {b.daysLeft <= 0 ? (
                            <div className="space-y-1">
                              <Badge className="bg-red-50 text-red-700 border border-red-200 uppercase font-black text-[9.5px]">Expired Lot</Badge>
                              <p className="text-[10px] text-red-600 dark:text-red-400 font-bold font-mono">{-b.daysLeft} days overdue</p>
                            </div>
                          ) : b.daysLeft <= 30 ? (
                            <div className="space-y-1">
                              <Badge className="bg-orange-50 text-orange-700 border border-orange-200 uppercase font-bold text-[9.5px]">Critical Expiry</Badge>
                              <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold font-mono">{b.daysLeft} days left</p>
                            </div>
                          ) : b.daysLeft <= 90 ? (
                            <div className="space-y-1">
                              <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-200 font-medium text-[9.5px]">Warning</Badge>
                              <p className="text-[10px] text-yellow-600 dark:text-yellow-400 font-mono">{b.daysLeft} days left</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9.5px]">Compliant</Badge>
                              <p className="text-[10px] text-zinc-400 font-mono">{b.daysLeft} days remaining</p>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {!isZero ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDisposeOrQuarantine(b)}
                              disabled={submitting}
                              className="w-full text-[10px] h-7 font-semibold text-red-650 border-red-200 dark:border-red-950 hover:bg-rose-50 dark:hover:bg-red-955 flex items-center justify-center cursor-pointer select-none"
                            >
                              <Trash2 className="h-3 w-3 mr-1 shrink-0" /> Dispose/Quarantine
                            </Button>
                          ) : (
                            <Badge className="bg-zinc-100 text-zinc-400 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-805 text-[9px] select-none h-6 inline-flex items-center px-3">
                              Quarantined
                            </Badge>
                          )}
                        </td>
                      </TableRowStyle>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Zimbabwe Hazardous Waste Disposal Regulation Reference box */}
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
            <Archive className="h-4 w-4 text-blue-600" /> Statutory Hazards Handling Instructions (SOP)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400 space-y-2">
          <p>
            1. **Disposal Protocols:** Commercial stock that has reached its expired stamp must be immediately quarantined in a physically separate, marked storage room. Under no circumstances should expired lots reside in general logistics flow or shelving.
          </p>
          <p>
            2. **Recording & Scrapping:** Using the <span className="font-bold">Dispose/Quarantine</span> button triggers a secure inventory level adjustment. This action sets active warehouse counts to zero and writes an immutable regulator scrap note with UTC timestamp, preventing double-entry and fraud.
          </p>
          <p>
            3. **Hazard certification:** Once quarantined, items must be disposed of via designated health inspectors or MCAZ authorized agents, and the issued Environmental Management Agency (EMA) certificate recorded in the company's ledger file.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}

// Custom wrapper to add row highlighting based on severity level
function TableRowStyle({ children, threat, isZero }: { children: React.ReactNode; threat: string; isZero: boolean }) {
  if (isZero) {
    return (
      <tr className="hover:bg-zinc-50/25 italic dark:hover:bg-zinc-900/10 opacity-70 bg-zinc-50/10">
        {children}
      </tr>
    );
  }
  
  let bgClass = "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50";
  if (threat === 'EXPIRED') {
    bgClass = "bg-red-50/10 dark:bg-red-955/5 hover:bg-red-50/20 dark:hover:bg-red-955/10 border-l-2 border-l-red-600";
  } else if (threat === 'CRITICAL') {
    bgClass = "bg-orange-50/10 dark:bg-orange-955/5 hover:bg-orange-50/20 dark:hover:bg-orange-955/10 border-l-2 border-l-orange-500";
  } else if (threat === 'WARNING') {
    bgClass = "bg-yellow-50/5 dark:bg-yellow-950/5 hover:bg-yellow-50/10 dark:hover:bg-yellow-950/10 border-l-2 border-l-yellow-500";
  }

  return (
    <tr className={`${bgClass} border-b border-zinc-150 dark:border-zinc-800 transition-all`}>
      {children}
    </tr>
  );
}
