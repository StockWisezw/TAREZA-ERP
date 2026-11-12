import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  AlertCircle, 
  Package, 
  TrendingDown, 
  TrendingUp, 
  FileSpreadsheet,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { supabase as firebaseDb } from '../../lib/firebaseClient';
import { db as dexieDb } from '../../lib/dexieDb';
import { toast } from 'sonner';

export function StockMovementHistory() {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const fetchMovements = async () => {
    try {
      setLoading(true);

      // 1. Fetch products map from Firebase & Dexie
      const productsMap: Record<string, { name: string; sku: string; barcode?: string }> = {};
      try {
        const { data: remoteProds } = await firebaseDb.from('products').select('id, name, sku, barcode');
        (remoteProds || []).forEach((p: any) => {
          productsMap[p.id] = { name: p.name || 'Unnamed Product', sku: p.sku || 'N/A', barcode: p.barcode };
        });
      } catch (e) {}

      try {
        const localProds = await dexieDb.products.toArray();
        localProds.forEach((p: any) => {
          if (!productsMap[p.id]) {
            productsMap[p.id] = { name: p.name || 'Unnamed Product', sku: p.sku || 'N/A', barcode: p.barcode };
          }
        });
      } catch (e) {}

      // 2. Fetch branches map
      const branchesMap: Record<string, string> = {};
      try {
        const { data: bData } = await firebaseDb.from('branches').select('id, name');
        (bData || []).forEach((b: any) => {
          branchesMap[b.id] = b.name;
        });
      } catch (e) {}

      // 3. Fetch movements from Firebase Firestore
      let remoteMovements: any[] = [];
      try {
        const { data, error } = await firebaseDb
          .from('stock_movements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(150);

        if (error) {
          console.warn('[Firebase] Stock movements notice:', error);
        } else if (data) {
          remoteMovements = data;
        }
      } catch (fErr) {
        console.warn('[Firebase] Remote movements fetch notice:', fErr);
      }

      // 4. Fetch movements from local Dexie database
      let localMovements: any[] = [];
      try {
        localMovements = await dexieDb.stock_movements.toArray();
      } catch (dErr) {
        console.warn('[Dexie] Local movements fetch notice:', dErr);
      }

      // 5. Merge and deduplicate
      const combinedMap = new Map<string, any>();
      [...remoteMovements, ...localMovements].forEach((m: any) => {
        if (!combinedMap.has(m.id)) {
          const prodInfo = productsMap[m.product_id] || { 
            name: m.product_name || m.products?.name || 'Item #' + (m.product_id?.substring(0, 8) || 'N/A'), 
            sku: m.product_sku || m.products?.sku || 'N/A' 
          };
          combinedMap.set(m.id, {
            ...m,
            productName: prodInfo.name,
            productSku: prodInfo.sku,
            branchName: branchesMap[m.branch_id] || 'Main Branch'
          });
        }
      });

      const merged = Array.from(combinedMap.values()).sort((a, b) => {
        const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
        const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      setMovements(merged);
    } catch (err) {
      console.error('Error fetching stock movements:', err);
      toast.error('Failed to load stock movements history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();

    const handleRefresh = () => {
      fetchMovements();
    };

    window.addEventListener('stock-movement-recorded', handleRefresh);
    window.addEventListener('inventory-update-needed', handleRefresh);

    return () => {
      window.removeEventListener('stock-movement-recorded', handleRefresh);
      window.removeEventListener('inventory-update-needed', handleRefresh);
    };
  }, []);

  const getTypeIcon = (type: string) => {
    const t = String(type || '').toUpperCase();
    if (t.includes('SALE') || t === 'OUT' || t === 'TRANSFER_OUT' || t === 'DAMAGE') {
      return <ArrowDownRight className="h-4 w-4 text-rose-500" />;
    }
    if (t.includes('RESTOCK') || t.includes('RECEIVED') || t === 'IN' || t === 'TRANSFER_IN' || t === 'RETURN' || t.includes('RETURN')) {
      return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
    }
    if (t.includes('ADJUST') || t === 'AUDIT') {
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
    return <RefreshCw className="h-4 w-4 text-zinc-500" />;
  };

  const getTypeBadge = (type: string) => {
    const t = String(type || '').toUpperCase();
    if (t.includes('SALE')) {
      return <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800">Sale (POS)</Badge>;
    }
    if (t.includes('RESTOCK') || t.includes('RECEIVED')) {
      return <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">Restock</Badge>;
    }
    if (t.includes('RETURN')) {
      return <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800">Customer Return</Badge>;
    }
    if (t.includes('TRANSFER')) {
      return <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800">Branch Transfer</Badge>;
    }
    if (t.includes('ADJUST')) {
      return <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800">Stock Adjustment</Badge>;
    }
    return <Badge variant="outline">{type || 'Movement'}</Badge>;
  };

  // Filter movements
  const filteredMovements = movements.filter((mv) => {
    const q = searchQuery.toLowerCase();
    const name = (mv.productName || '').toLowerCase();
    const sku = (mv.productSku || '').toLowerCase();
    const notes = (mv.notes || '').toLowerCase();
    const type = (mv.type || '').toLowerCase();
    const branch = (mv.branchName || '').toLowerCase();

    const matchesSearch = !q || name.includes(q) || sku.includes(q) || notes.includes(q) || type.includes(q) || branch.includes(q);

    if (!matchesSearch) return false;

    if (typeFilter === 'ALL') return true;
    if (typeFilter === 'SALE') return mv.type?.toUpperCase().includes('SALE');
    if (typeFilter === 'RESTOCK') return mv.type?.toUpperCase().includes('RESTOCK') || mv.type?.toUpperCase().includes('RECEIVED');
    if (typeFilter === 'ADJUSTMENT') return mv.type?.toUpperCase().includes('ADJUST');
    if (typeFilter === 'TRANSFER') return mv.type?.toUpperCase().includes('TRANSFER');
    if (typeFilter === 'RETURN') return mv.type?.toUpperCase().includes('RETURN');

    return true;
  });

  // KPI Metrics Calculation
  const totalMovementsCount = movements.length;
  let totalUnitsSold = 0;
  let totalUnitsRestocked = 0;

  movements.forEach((m) => {
    const q = Number(m.quantity || 0);
    if (q < 0 || String(m.type || '').toUpperCase().includes('SALE')) {
      totalUnitsSold += Math.abs(q);
    } else if (q > 0) {
      totalUnitsRestocked += q;
    }
  });

  const exportCSV = () => {
    if (filteredMovements.length === 0) {
      toast.error('No movements to export.');
      return;
    }
    const headers = ['Movement ID,Date & Time,Product Name,SKU,Branch,Type,Quantity,Notes'];
    const rows = filteredMovements.map(m => [
      `"${m.id}"`,
      `"${new Date(m.created_at).toLocaleString()}"`,
      `"${(m.productName || '').replace(/"/g, '""')}"`,
      `"${m.productSku || ''}"`,
      `"${m.branchName || ''}"`,
      `"${m.type || ''}"`,
      m.quantity,
      `"${(m.notes || '').replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Movements_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Stock movements exported to CSV!');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Stock Movement History & Audit Trail
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Full audit log of inventory deductions, POS sales, restocks, and warehouse transfers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportCSV}
            className="text-xs font-semibold rounded-xl cursor-pointer bg-white dark:bg-zinc-900"
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchMovements}
            disabled={loading}
            className="text-xs font-semibold rounded-xl cursor-pointer bg-white dark:bg-zinc-900"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Log
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-zinc-200/80 dark:border-zinc-800 shadow-xs bg-white dark:bg-zinc-900">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total Movements</span>
              <Layers className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-xl font-black text-zinc-900 dark:text-zinc-100 mt-1 font-mono">{totalMovementsCount}</p>
            <span className="text-[10px] text-zinc-400">Recorded stock events</span>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 dark:border-zinc-800 shadow-xs bg-white dark:bg-zinc-900">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Total Outflow (Sold)</span>
              <TrendingDown className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">-{totalUnitsSold} units</p>
            <span className="text-[10px] text-zinc-400">Sold via POS checkouts</span>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 dark:border-zinc-800 shadow-xs bg-white dark:bg-zinc-900">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Inflow (Restocked)</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">+{totalUnitsRestocked} units</p>
            <span className="text-[10px] text-zinc-400">Purchases & returns</span>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 dark:border-zinc-800 shadow-xs bg-white dark:bg-zinc-900">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Net Movement</span>
              <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
            </div>
            <p className={`text-xl font-black mt-1 font-mono ${totalUnitsRestocked - totalUnitsSold >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totalUnitsRestocked - totalUnitsSold >= 0 ? '+' : ''}{totalUnitsRestocked - totalUnitsSold} units
            </p>
            <span className="text-[10px] text-zinc-400">Current balance flux</span>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-zinc-200/80 dark:border-zinc-800 shadow-xs bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden">
        {/* Search and Filters */}
        <div className="p-3.5 border-b border-zinc-150 dark:border-zinc-800 flex flex-col md:flex-row gap-3 justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input 
              placeholder="Search product, SKU, receipt #, or notes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-white dark:bg-zinc-950 rounded-xl border-zinc-200 dark:border-zinc-800" 
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {['ALL', 'SALE', 'RESTOCK', 'ADJUSTMENT', 'TRANSFER', 'RETURN'].map((fType) => (
              <Button
                key={fType}
                type="button"
                variant={typeFilter === fType ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter(fType)}
                className={`text-[11px] h-7 px-2.5 rounded-lg font-bold cursor-pointer transition-all ${
                  typeFilter === fType 
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-none' 
                    : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {fType === 'ALL' ? 'All Movements' : fType === 'SALE' ? 'Sales' : fType === 'RESTOCK' ? 'Restocks' : fType === 'ADJUSTMENT' ? 'Adjustments' : fType === 'TRANSFER' ? 'Transfers' : 'Returns'}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-[500px]">
          <Table>
            <TableHeader className="bg-zinc-50 dark:bg-zinc-900/90 sticky top-0 z-10 border-b border-zinc-150 dark:border-zinc-800">
              <TableRow>
                <TableHead className="w-[120px] text-xs font-bold text-zinc-700 dark:text-zinc-300">Movement Ref</TableHead>
                <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Date & Time</TableHead>
                <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Product & SKU</TableHead>
                <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Branch</TableHead>
                <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Type</TableHead>
                <TableHead className="text-right text-xs font-bold text-zinc-700 dark:text-zinc-300">Quantity</TableHead>
                <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Audit Notes / Receipt Ref</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-zinc-400 text-xs">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-zinc-400" />
                    Loading stock movements trail...
                  </TableCell>
                </TableRow>
              ) : filteredMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-zinc-400 text-xs">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40 text-zinc-400" />
                    <p className="font-semibold text-zinc-600 dark:text-zinc-400">No stock movements found.</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Sales made in POS and restocks will appear here automatically.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovements.map((movement, idx) => {
                  const qty = Number(movement.quantity || 0);
                  const isNegative = qty < 0;
                  const dateStr = movement.created_at || movement.timestamp ? new Date(movement.created_at || movement.timestamp).toLocaleString() : 'Recent';

                  return (
                    <TableRow key={movement.id || idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-xs">
                      <TableCell className="font-mono text-[11px] text-zinc-500 font-bold">
                        #{movement.id?.substring(0, 8) || `MOV-${idx + 1}`}
                      </TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-300 whitespace-nowrap font-medium">
                        {dateStr}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">{movement.productName || 'Unnamed Product'}</div>
                        <div className="font-mono text-[10px] text-zinc-400">{movement.productSku || 'SKU: N/A'}</div>
                      </TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-400">
                        {movement.branchName || 'Main Branch'}
                      </TableCell>
                      <TableCell>{getTypeBadge(movement.type)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 font-mono font-bold text-xs">
                          {getTypeIcon(movement.type)}
                          <span className={isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                            {qty > 0 ? `+${qty}` : qty}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-400 max-w-[240px] truncate" title={movement.notes}>
                        {movement.notes || 'POS transaction stock deduction'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
