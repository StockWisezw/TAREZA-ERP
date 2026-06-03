import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Search, Plus, Filter, ClipboardList, CheckCircle2, Play, AlertTriangle, Settings, Calendar as CalendarIcon, Tag, Trash2, Check, RotateCcw, Landmark, Sparkles, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

export function Stocktake() {
  const [stocktakes, setStocktakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [reviewItem, setReviewItem] = useState<any>(null);
  const [reviewItemsData, setReviewItemsData] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isCounting, setIsCounting] = useState(false);

  // New products and active count state variables
  const [products, setProducts] = useState<any[]>([]);
  const [activeStocktake, setActiveStocktake] = useState<any | null>(null);
  const [countedItems, setCountedItems] = useState<any[]>([]);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [countQty, setCountQty] = useState('1');
  
  // Custom stocktake options
  const [prePopulate, setPrePopulate] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [onlyShowVariances, setOnlyShowVariances] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [reconciliationValuation, setReconciliationValuation] = useState<'cost' | 'sales'>('cost');

  useEffect(() => {
    fetchStocktakes();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          barcode,
          retail_price,
          wholesale_price,
          is_active,
          inventory (
            id,
            branch_id,
            quantity
          )
        `)
        .eq('is_active', true)
        .order('name');
      if (data) {
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products inside stocktake component:', err);
    }
  };

  const fetchStocktakes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stocktakes_advanced')
        .select(`
          id,
          status,
          type,
          started_at,
          completed_at,
          business_id,
          branch_id,
          branches ( id, name )
        `)
        .order('started_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('relation') || error.code === '404') {
          setStocktakes([]);
          return;
        }
        console.error('Error fetching stocktakes:', error);
      } else if (data) {
        setStocktakes(data);
      }
    } catch (err: any) {
      if (err?.code !== '404' && err?.code !== '42P01') {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveCountedItemsToDB = async (stocktakeId: string, items: any[]) => {
    try {
      setSavingProgress(true);
      
      // Delete existing records to sync properly
      await supabase
        .from('stocktake_items')
        .delete()
        .eq('stocktake_id', stocktakeId);

      if (items.length === 0) {
        setSavingProgress(false);
        return;
      }

      // Map rows
      const insertRows = items.map(item => {
        const sysQty = item.product?.inventory?.[0]?.quantity || 0;
        const cntQty = Number(item.counted_qty || 0);
        return {
          stocktake_id: stocktakeId,
          product_id: item.product.id,
          system_qty: sysQty,
          counted_qty: cntQty,
          variance: cntQty - sysQty,
          notes: item.notes || ''
        };
      });

      const { error } = await supabase
        .from('stocktake_items')
        .insert(insertRows);

      if (error) {
        console.error('Error saving stocktake items inside db:', error);
      }
    } catch (err) {
      console.error('Error syncing count state in db:', err);
    } finally {
      setSavingProgress(false);
    }
  };

  const loadCountedItemsFromDB = async (stocktakeId: string) => {
    try {
      const { data, error } = await supabase
        .from('stocktake_items')
        .select(`
          id,
          system_qty,
          counted_qty,
          notes,
          product_id,
          products (
            id,
            name,
            sku,
            barcode,
            retail_price,
            wholesale_price,
            inventory ( quantity, branch_id )
          )
        `)
        .eq('stocktake_id', stocktakeId);

      if (error) {
        console.error('Error reading stocktake items:', error);
        return null;
      }

      if (data && data.length > 0) {
        const mappedItems = data.map(row => {
          const rawProd: any = row.products;
          // Format product levels properly
          const mappedProd = {
            ...rawProd,
            inventory: rawProd?.inventory || [{ quantity: Number(row.system_qty) }]
          };
          return {
            product: mappedProd,
            counted_qty: Number(row.counted_qty || 0),
            notes: row.notes || ''
          };
        });
        return mappedItems;
      }
    } catch (err) {
      console.error('Error in loading stocktake products:', err);
    }
    return null;
  };

  const handleApprove = async () => {
    if (!reviewItem) return;
    try {
      // 1. Update advanced header
      const { error: errorAdv } = await supabase
        .from('stocktakes_advanced')
        .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
        .eq('id', reviewItem.id);
      
      if (errorAdv) throw errorAdv;

      // 2. Update mirror stocktake status to COMPLETED
      await supabase
        .from('stocktakes')
        .update({ status: 'COMPLETED' })
        .eq('id', reviewItem.id);

      // 3. Update active inventory quantities inside actual Inventory model.
      const branchId = reviewItem.branch_id || reviewItem.branches?.id;
      const businessId = reviewItem.business_id;

      if (!branchId) {
        throw new Error("Could not identify target branch for inventory adjustment.");
      }

      if (reviewItemsData && reviewItemsData.length > 0) {
        for (const item of reviewItemsData) {
          const prodId = item.product?.id;
          const countVal = Number(item.counted_qty);
          if (!prodId || isNaN(countVal)) continue;

          // Find if there is an inventory record for this product and branch
          const { data: existing } = await supabase
            .from('inventory')
            .select('*')
            .eq('product_id', prodId)
            .eq('branch_id', branchId);

          if (existing && existing.length > 0) {
            // Update
            const { error: updateError } = await supabase
              .from('inventory')
              .update({
                quantity: countVal,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing[0].id);

            if (updateError) console.error("Error updating stock segment:", updateError);
          } else {
            // Insert
            const { error: insertError } = await supabase
              .from('inventory')
              .insert({
                business_id: businessId,
                branch_id: branchId,
                product_id: prodId,
                quantity: countVal,
                created_at: new Date().toISOString()
              });

            if (insertError) console.error("Error inserting stock segment:", insertError);
          }
        }
      }
      
      toast.success(`Success! Quantities approved, mirror logs updated and live branch catalog adjusted.`);
      setReviewItem(null);
      fetchStocktakes();
    } catch (err: any) {
      toast.error(err.message || 'Error occurred during stocktake approval');
    }
  };

  const handleReject = async () => {
    if (!reviewItem) return;
    try {
      const { error } = await supabase
        .from('stocktakes_advanced')
        .update({ status: 'IN_PROGRESS' })
        .eq('id', reviewItem.id);
        
      if (error) throw error;
      toast.info(`Stocktake rejected and reset back to in-progress count state.`);
      setReviewItem(null);
      fetchStocktakes();
    } catch (err: any) {
      toast.error(err.message || 'Error rejecting stocktake');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        throw new Error('You must be logged in to create a stocktake.');
      }

      let businessId = null;
      let branchId = null;

      const { data: businessUserData } = await supabase
        .from('business_users')
        .select('business_id, branch_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      if (businessUserData?.business_id) {
        businessId = businessUserData.business_id;
        branchId = businessUserData.branch_id;
      }

      // Fallbacks
      if (!businessId) {
        const { data: bData } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
        if (bData?.id) businessId = bData.id;
      }
      if (!branchId && businessId) {
        const { data: brData } = await supabase.from('branches').select('id').eq('business_id', businessId).limit(1).maybeSingle();
        if (brData?.id) branchId = brData.id;
      }

      if (!businessId || !branchId) {
        throw new Error('Could not resolve business or branch context. Please ensure your user profile is fully configured.');
      }

      const insertData = {
        status: 'IN_PROGRESS',
        type: formData.get('type') as string,
        business_id: businessId,
        branch_id: branchId,
        started_at: new Date().toISOString()
      };
      
      const { data: newSt, error } = await supabase
        .from('stocktakes_advanced')
        .insert(insertData)
        .select()
        .single();
        
      if (error) throw error;

      // Mirror onto public.stocktakes to support stocktake_items relation
      await supabase
        .from('stocktakes')
        .insert({
          id: newSt.id,
          business_id: businessId,
          branch_id: branchId,
          status: 'DRAFT',
          created_at: newSt.started_at
        });

      // Handle prepopulate logic
      let initialCountedItems: any[] = [];
      if (prePopulate && products.length > 0) {
        initialCountedItems = products
          .filter(p => !branchId || p.inventory?.some((i: any) => i.branch_id === branchId) || p.inventory?.length === 0 || !p.inventory)
          .map(p => {
            const branchInventory = p.inventory?.find((i: any) => i.branch_id === branchId);
            const sysQty = branchInventory ? branchInventory.quantity : 0;
            return {
              product: p,
              counted_qty: sysQty, // initialize to system stock for faster adjustments!
              notes: ''
            };
          });
      }

      toast.success('Stocktake created successfully');
      setIsCreating(false);
      fetchStocktakes();
      if (newSt) {
        setActiveStocktake(newSt);
        setCountedItems(initialCountedItems);
        setIsCounting(true);
        if (initialCountedItems.length > 0) {
          await saveCountedItemsToDB(newSt.id, initialCountedItems);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to initialize stocktake');
    }
  };

  const openReview = async (stk: any) => {
    setReviewItem(stk);
    let loaded = await loadCountedItemsFromDB(stk.id);
    if (loaded) {
      setReviewItemsData(loaded);
    } else {
      const stored = localStorage.getItem(`stocktake_counted_${stk.id}`);
      if (stored) {
        setReviewItemsData(JSON.parse(stored));
      } else {
        setReviewItemsData([]);
      }
    }
  };

  // Helper filters for active count sheet
  const filteredCountItems = countedItems.filter(item => {
    const pName = (item.product?.name || '').toLowerCase();
    const pSku = (item.product?.sku || '').toLowerCase();
    const pBar = (item.product?.barcode || '').toLowerCase();
    const term = filterQuery.toLowerCase().trim();
    
    const matchesQuery = pName.includes(term) || pSku.includes(term) || pBar.includes(term);
    
    if (onlyShowVariances) {
      const sysQty = item.product?.inventory?.find((i: any) => i.branch_id === activeStocktake?.branch_id)?.quantity || 0;
      const cntQty = Number(item.counted_qty || 0);
      return matchesQuery && sysQty !== cntQty;
    }
    
    return matchesQuery;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 font-sans">Advanced Stocktaking</h2>
          <p className="text-sm text-zinc-500">Perform cycle counts or full audits with physical adjustments sync.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={fetchStocktakes} className="h-10 bg-white">
            <RefreshCw className="mr-2 h-4 w-4 text-zinc-500 animate-hover" /> Refresh
          </Button>
          <Button onClick={() => setIsCreating(true)} className="w-full sm:w-auto h-10 bg-zinc-900 text-white hover:bg-zinc-800">
            <Plus className="mr-2 h-4 w-4" /> Start Directed Count
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-100 bg-emerald-50/40 shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wider uppercase text-emerald-800">In Progress Audits</p>
              <p className="text-2xl font-black text-emerald-900">{stocktakes.filter(s => s.status === 'IN_PROGRESS').length}</p>
            </div>
            <div className="h-11 w-11 bg-emerald-100 rounded-full flex items-center justify-center">
              <Play className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-amber-100 bg-amber-50/40 shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wider uppercase text-amber-800">Pending Review</p>
              <p className="text-2xl font-black text-amber-900">{stocktakes.filter(s => s.status === 'REVIEW').length}</p>
            </div>
            <div className="h-11 w-11 bg-amber-100 rounded-full flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 bg-zinc-50/40 shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wider uppercase text-zinc-500">Completed (Total)</p>
              <p className="text-2xl font-black text-zinc-900">{stocktakes.filter(s => s.status === 'COMPLETED').length}</p>
            </div>
            <div className="h-11 w-11 bg-zinc-200 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-zinc-700" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200 shadow-sm bg-white">
        <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-50/50 rounded-t-xl">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input placeholder="Search active or historical stocktakes..." className="pl-9 bg-white border-zinc-200" />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Badge variant="outline" className="py-1 px-3 text-zinc-600 border-zinc-250 bg-white">
              <Landmark className="h-3 w-3 mr-1 text-zinc-400" /> Standard Ledger Sync Mode
            </Badge>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/55">
              <TableRow>
                <TableHead>Identifier ID</TableHead>
                <TableHead>Count Type</TableHead>
                <TableHead>Assigned Branch</TableHead>
                <TableHead>Date Initiated</TableHead>
                <TableHead>Status Code</TableHead>
                <TableHead className="text-right">Action Panel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-zinc-500">Loading master stocktakes registry...</TableCell>
                </TableRow>
              ) : stocktakes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-zinc-500">No active stocktakes catalogued.</TableCell>
                </TableRow>
              ) : stocktakes.map((stk) => (
                <TableRow key={stk.id} className="hover:bg-zinc-50/50">
                  <TableCell className="font-mono text-xs font-semibold text-zinc-600">{stk.id?.substring(0, 8)}...</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-zinc-700">
                      <Settings className="h-3.5 w-3.5 text-zinc-400" /> {stk.type || 'FULL'}
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-700 font-medium">{stk.branches?.name || 'Main Branch'}</TableCell>
                  <TableCell className="text-zinc-500 text-xs font-mono">{stk.started_at ? new Date(stk.started_at).toLocaleString() : '-'}</TableCell>
                  <TableCell>
                    {stk.status === 'IN_PROGRESS' && <Badge className="bg-emerald-100 text-emerald-800 border-0">In Progress</Badge>}
                    {stk.status === 'REVIEW' && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-150 border-0 animate-pulse">Needs Review</Badge>}
                    {stk.status === 'COMPLETED' && <Badge className="bg-zinc-100 text-zinc-600 border-0">Audit Completed</Badge>}
                    {stk.status === 'DRAFT' && <Badge className="bg-gray-100 text-gray-800 border-0">Draft Count</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {stk.status === 'REVIEW' ? (
                      <Button variant="outline" size="sm" onClick={() => openReview(stk)} className="border-amber-200 text-amber-900 bg-amber-50 hover:bg-amber-100 h-8 font-semibold">
                        Review Variances
                      </Button>
                    ) : stk.status === 'IN_PROGRESS' ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={async () => {
                          setActiveStocktake(stk);
                          let dbItems = await loadCountedItemsFromDB(stk.id);
                          if (dbItems) {
                            setCountedItems(dbItems);
                          } else {
                            const stored = localStorage.getItem(`stocktake_counted_${stk.id}`);
                            if (stored) {
                              setCountedItems(JSON.parse(stored));
                            } else {
                              setCountedItems([]);
                            }
                          }
                          setProductSearchInput('');
                          setSelectedProduct(null);
                          setCountQty('1');
                          setIsCounting(true);
                        }} 
                        className="border-emerald-250 text-emerald-900 bg-emerald-55/70 hover:bg-emerald-100/80 h-8 font-semibold"
                      >
                        Enter Count Screen
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => openReview(stk)} className="text-zinc-600 hover:bg-zinc-100 text-xs">
                        View Audit Report
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Review Modal */}
      <Dialog open={!!reviewItem} onOpenChange={(open) => !open && setReviewItem(null)}>
        <DialogContent className="max-w-[100vw] w-screen h-screen md:h-[95vh] md:max-w-[98vw] p-0 gap-0 bg-white border-zinc-200 md:rounded-xl overflow-hidden flex flex-col">
          <div className="p-6 bg-zinc-50 border-b border-zinc-200 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-zinc-900">Review Count & Approve Adjustments</DialogTitle>
              <DialogDescription className="text-zinc-500">
                Detailed variance audit for count #{reviewItem?.id?.substring(0, 8)}. Approving will commit system adjustments.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col overflow-hidden min-h-0 bg-zinc-50/40">
            {reviewItem?.status === 'REVIEW' ? (
              <div className="bg-amber-55/40 border border-amber-200/70 rounded-xl p-4 flex items-start gap-3 text-amber-900 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold mb-0.5">Physical Level Adjustment Sync</p>
                  <p className="text-zinc-650 text-xs">Approving these figures will write the counted levels dynamically into active inventory and create historical balance logs.</p>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex items-start gap-2.5 text-zinc-700 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-zinc-500 mt-0.5" />
                <div>
                  <p className="font-bold mb-0.5">Historical Snapshot Records</p>
                  <p className="text-zinc-505 text-xs">This audit session is completed. Displaying matched counts compared to initial expected stock levels.</p>
                </div>
              </div>
            )}

            {/* Reconciliation Valuation Basis Selector & Aggregate Summary */}
            {(() => {
              const reviewCalcs = reviewItemsData.reduce((acc, item) => {
                const systemQty = item.product?.inventory?.[0]?.quantity || 0;
                const countedQty = Number(item.counted_qty || 0);
                const price = reconciliationValuation === 'cost' 
                  ? Number(item.product?.wholesale_price || 0) 
                  : Number(item.product?.retail_price || 0);
                return {
                  expected: acc.expected + (systemQty * price),
                  counted: acc.counted + (countedQty * price),
                  variance: acc.variance + ((countedQty - systemQty) * price)
                };
              }, { expected: 0, counted: 0, variance: 0 });

              return (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-zinc-600 tracking-wider block">Valuation Basis</span>
                    <div className="flex bg-zinc-200/60 p-0.5 rounded-lg border border-zinc-300 w-fit">
                      <button
                        type="button"
                        onClick={() => setReconciliationValuation('cost')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          reconciliationValuation === 'cost' 
                            ? 'bg-white text-zinc-900 shadow-xs' 
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        Cost (Wholesale)
                      </button>
                      <button
                        type="button"
                        onClick={() => setReconciliationValuation('sales')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          reconciliationValuation === 'sales' 
                            ? 'bg-white text-zinc-900 shadow-xs' 
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        Sales (Retail)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 w-full md:w-auto md:min-w-[420px] text-right">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider block">Expected Stock</span>
                      <p className="text-sm font-bold font-mono text-zinc-700">${reviewCalcs.expected.toFixed(2)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider block">Counted Stock</span>
                      <p className="text-sm font-bold font-mono text-indigo-700">${reviewCalcs.counted.toFixed(2)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider block">Est. Variance</span>
                      <p className={`text-sm font-black font-mono ${reviewCalcs.variance < 0 ? 'text-red-500' : reviewCalcs.variance > 0 ? 'text-emerald-700' : 'text-zinc-500'}`}>
                        {reviewCalcs.variance > 0 ? '+' : ''}${reviewCalcs.variance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="border border-zinc-200 rounded-xl overflow-y-auto bg-white shadow-xs flex-1 min-h-[220px]">
              <Table>
                <TableHeader className="bg-zinc-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Product Name & SKU</TableHead>
                    <TableHead className="text-right w-24">Recorded Stock</TableHead>
                    <TableHead className="text-right w-24">Physical Count</TableHead>
                    <TableHead className="text-right w-24">Variance Delta</TableHead>
                    <TableHead className="text-right w-24">Unit Price</TableHead>
                    <TableHead className="text-right w-28">Valuation Delta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewItemsData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-zinc-400 py-8 italic text-xs">
                        No product lines counted during this physical count auditing.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reviewItemsData.map((item: any, idx) => {
                      const systemQty = item.product?.inventory?.[0]?.quantity || 0;
                      const countedQty = Number(item.counted_qty || 0);
                      const variance = countedQty - systemQty;
                      const price = reconciliationValuation === 'cost' 
                        ? Number(item.product?.wholesale_price || 0) 
                        : Number(item.product?.retail_price || 0);
                      const varValue = variance * price;

                      return (
                        <TableRow key={idx} className="hover:bg-zinc-50/40">
                          <TableCell className="py-2.5">
                            <div className="font-bold text-zinc-900 text-sm">{item.product?.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              SKU: {item.product?.sku || 'Unassigned'} | Barcode: {item.product?.barcode || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-zinc-650 text-sm">{systemQty}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-indigo-700 text-sm">{countedQty}</TableCell>
                          <TableCell className={`text-right font-mono text-sm font-semibold ${variance < 0 ? 'text-red-650' : variance > 0 ? 'text-emerald-700' : 'text-zinc-400'}`}>
                            {variance > 0 ? `+${variance}` : variance === 0 ? 'OK' : variance}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-zinc-500">${price.toFixed(2)}</TableCell>
                          <TableCell className={`text-right font-mono text-xs font-bold ${varValue < 0 ? 'text-rose-600' : varValue > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                            {varValue > 0 ? '+' : ''}${varValue.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="p-6 bg-zinc-50 border-t border-zinc-200 flex justify-between items-center rounded-b-xl shrink-0">
            <Button variant="outline" className="bg-white border-zinc-200" onClick={() => setReviewItem(null)}>Cancel</Button>
            {reviewItem?.status === 'REVIEW' && (
              <div className="flex gap-2">
                <Button variant="outline" className="border-red-200 text-red-600 bg-red-50 hover:bg-red-100" onClick={handleReject}>Reject & Recount</Button>
                <Button onClick={handleApprove} className="bg-zinc-900 text-white hover:bg-zinc-800">Approve & Write Changes</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Create Stocktake Modal */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-md bg-white border-zinc-250 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">Initialize Stock Audit</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Create a physical stock count sheet for your branch's products catalog.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-xs font-semibold uppercase text-zinc-600">Audit Strategy Category</Label>
              <Select name="type" defaultValue="FULL">
                <SelectTrigger className="border-zinc-200 bg-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="FULL">Full Store Count (Recommended)</SelectItem>
                  <SelectItem value="CYCLE">Cycle Count (High-Value Items)</SelectItem>
                  <SelectItem value="PARTIAL">Spot Count / Expiry Log</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start space-x-2.5 p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70 mt-2">
              <input 
                type="checkbox" 
                id="prePopulate" 
                checked={prePopulate} 
                onChange={(e) => setPrePopulate(e.target.checked)} 
                className="h-4 w-4 text-zinc-900 border-zinc-300 rounded focus:ring-zinc-900 cursor-pointer mt-0.5" 
              />
              <div className="grid gap-1 leading-none">
                <Label htmlFor="prePopulate" className="text-xs font-bold text-zinc-800 cursor-pointer">
                  Pre-populate Count Sheet
                </Label>
                <span className="text-[10px] text-zinc-500 leading-normal">
                  Auto-load your complete product catalog with actual recorded stock. You only have to type correct values where discrepancies actually exist!
                </span>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" className="border-zinc-250 bg-white h-9" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button type="submit" className="bg-zinc-900 text-white hover:bg-zinc-800 h-9 font-semibold">Start Physical Counting</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Guided Stock Counting Interface */}
      <Dialog open={isCounting} onOpenChange={(open) => {
        if (!open) {
          setIsCounting(false);
          setActiveStocktake(null);
        }
      }}>
        <DialogContent className="max-w-[100vw] w-screen h-screen md:h-[95vh] md:max-w-[98vw] p-0 gap-0 bg-white border-zinc-250 md:rounded-xl overflow-hidden flex flex-col">
          {/* Header Panel */}
          <div className="px-6 py-4 border-b flex justify-between items-center bg-zinc-900 text-white shrink-0">
            <div>
              <h3 className="font-bold text-base flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-400" /> Active Count Sheet Audit ({activeStocktake?.type || 'FULL'})
              </h3>
              <p className="text-xs text-zinc-400">Scan SKU barcodes, search, or update counted quantities directly.</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={savingProgress}
                className="bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700" 
                onClick={async () => {
                  if (activeStocktake) {
                    await saveCountedItemsToDB(activeStocktake.id, countedItems);
                    localStorage.setItem(`stocktake_counted_${activeStocktake.id}`, JSON.stringify(countedItems));
                  }
                  setIsCounting(false);
                  setActiveStocktake(null);
                  toast.success('Count progress synced successfully!');
                }}
              >
                {savingProgress ? 'Saving...' : 'Draft (Save Progress)'}
              </Button>
            </div>
          </div>
          
          <div className="p-4 sm:p-6 bg-zinc-50 space-y-4 flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Quick Actions & Barcode Input */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-white p-4 rounded-xl border border-zinc-200">
              <div className="md:col-span-6 relative space-y-1.5">
                <Label className="text-xs text-zinc-600 font-bold">Gun Scanner / Search Catalog</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input 
                    placeholder="Zap barcode, search SKU, tag code, or product name..." 
                    className="pl-9 bg-white border-zinc-200 h-10 text-zinc-800"
                    value={productSearchInput}
                    onChange={(e) => {
                      const inp = e.target.value;
                      setProductSearchInput(inp);
                      
                      // Auto barcode / exact SKU shooting
                      if (inp.trim()) {
                        const exactMatch = products.find(p => 
                          (p.barcode && p.barcode.trim().toLowerCase() === inp.trim().toLowerCase()) ||
                          (p.sku && p.sku.trim().toLowerCase() === inp.trim().toLowerCase())
                        );
                        if (exactMatch) {
                          setSelectedProduct(exactMatch);
                          setProductSearchInput(exactMatch.name);
                          toast.success(`Scanned: ${exactMatch.name}`);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = productSearchInput.trim().toLowerCase();
                        if (val && !selectedProduct) {
                          const matched = products.filter(p => 
                            p.name.toLowerCase().includes(val) ||
                            (p.sku || '').toLowerCase().includes(val) ||
                            (p.barcode || '').toLowerCase().includes(val)
                          );
                          if (matched.length === 1) {
                            setSelectedProduct(matched[0]);
                            setProductSearchInput(matched[0].name);
                          }
                        }
                      }
                    }}
                  />
                </div>

                {/* Dropdown Suggestions */}
                {productSearchInput.trim() !== '' && !selectedProduct && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-white border border-zinc-250 rounded-lg shadow-lg z-50 animate-in fade-in duration-200">
                    {(() => {
                      const list = products.filter(p => {
                        const term = productSearchInput.toLowerCase();
                        return p.name.toLowerCase().includes(term) ||
                          (p.sku || '').toLowerCase().includes(term) ||
                          (p.barcode || '').toLowerCase().includes(term);
                      });
                      if (list.length === 0) {
                        return <div className="p-3 text-xs text-zinc-500 text-center">No products match. Let's write another term.</div>;
                      }
                      return list.slice(0, 10).map(p => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3.5 py-2.5 hover:bg-zinc-50 border-b border-zinc-100 last:border-0 block transition-colors"
                          onClick={() => {
                            setSelectedProduct(p);
                            setProductSearchInput(p.name);
                          }}
                        >
                          <div className="font-bold text-xs text-zinc-900">{p.name}</div>
                          <div className="text-[10px] text-zinc-505 font-mono">
                            SKU: {p.sku || 'N/A'} | Barcode: {p.barcode || 'N/A'}
                          </div>
                        </button>
                      ));
                    })()}
                  </div>
                )}
                
                {selectedProduct && (
                  <div className="flex items-center justify-between bg-zinc-100 border border-zinc-255 rounded-md px-3 py-1.5 mt-1 animate-in fade-in duration-150">
                    <div className="text-xs font-semibold text-zinc-700">
                      Matched: {selectedProduct.name} <span className="font-mono text-[9px] text-zinc-505">({selectedProduct.sku || 'No SKU'})</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        setSelectedProduct(null);
                        setProductSearchInput('');
                      }} 
                      className="text-zinc-400 hover:text-zinc-600 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs text-zinc-650 font-bold">Gun Qty</Label>
                <Input 
                  type="number" 
                  value={countQty} 
                  min="1"
                  onChange={e => setCountQty(e.target.value)} 
                  className="bg-white font-black text-center h-10 border-zinc-200" 
                />
              </div>

              <div className="md:col-span-3">
                <Button 
                  type="button"
                  onClick={() => {
                    if (!selectedProduct) {
                      toast.error('Scan a product or pick from current auto-suggestions dropdown.');
                      return;
                    }
                    const num = Number(countQty);
                    if (isNaN(num) || num <= 0) {
                      toast.error('Please verify counted quantity value');
                      return;
                    }

                    const idx = countedItems.findIndex(x => x.product.id === selectedProduct.id);
                    const updated = [...countedItems];
                    if (idx > -1) {
                      updated[idx].counted_qty += num;
                      setCountedItems(updated);
                    } else {
                      updated.push({ product: selectedProduct, counted_qty: num, notes: '' });
                      setCountedItems(updated);
                    }

                    saveCountedItemsToDB(activeStocktake.id, updated);
                    toast.success(`Incremented count of ${selectedProduct.name} by ${num}`);
                    setSelectedProduct(null);
                    setProductSearchInput('');
                    setCountQty('1');
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10"
                >
                  Increment
                </Button>
              </div>
            </div>

            {/* Mass Utilities Row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-zinc-100 p-3 rounded-lg border border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-wide">Quick helpers:</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white text-zinc-700 h-8 font-semibold"
                  onClick={async () => {
                    const mapped = countedItems.map(item => {
                      const branchInventory = item.product?.inventory?.find((i: any) => i.branch_id === activeStocktake?.branch_id);
                      const sysQty = branchInventory ? branchInventory.quantity : 0;
                      return {
                        ...item,
                        counted_qty: sysQty
                      };
                    });
                    setCountedItems(mapped);
                    await saveCountedItemsToDB(activeStocktake.id, mapped);
                    toast.success("All counted quantities pre-filled with current system values!");
                  }}
                >
                  <CopyAllIcon className="h-3.5 w-3.5 mr-1" /> Match System quantities
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white text-zinc-700 h-8 font-semibold"
                  onClick={async () => {
                    const mapped = countedItems.map(item => ({
                      ...item,
                      counted_qty: 0
                    }));
                    setCountedItems(mapped);
                    await saveCountedItemsToDB(activeStocktake.id, mapped);
                    toast.warning("All counted quantities reset to zero.");
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1 text-zinc-400" /> Reset All to Zero
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs text-zinc-650 flex items-center font-bold cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={onlyShowVariances} 
                    onChange={e => setOnlyShowVariances(e.target.checked)} 
                    className="mr-1.5 h-3.5 w-3.5 text-zinc-900 border-zinc-300 rounded" 
                  />
                  Only show variances (Discrepancy audit)
                </label>
                <div className="h-4 w-[1px] bg-zinc-300 hidden sm:block" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Basis:</span>
                  <div className="flex bg-zinc-200/60 p-0.5 rounded-md border border-zinc-300/80">
                    <button
                      type="button"
                      onClick={() => setReconciliationValuation('cost')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                        reconciliationValuation === 'cost' 
                          ? 'bg-white text-zinc-900 shadow-xs' 
                          : 'text-zinc-500 hover:text-zinc-805'
                      }`}
                    >
                      Cost
                    </button>
                    <button
                      type="button"
                      onClick={() => setReconciliationValuation('sales')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                        reconciliationValuation === 'sales' 
                          ? 'bg-white text-zinc-900 shadow-xs' 
                          : 'text-zinc-500 hover:text-zinc-805'
                      }`}
                    >
                      Sales
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Guided Grid Count List */}
            <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center px-1 shrink-0">
                <Label className="text-xs font-black uppercase text-zinc-600 tracking-wider">Guided Active Count Sheet Details</Label>
                <div className="text-[11px] font-mono font-bold text-zinc-500">
                  Showing {filteredCountItems.length} of {countedItems.length} catalog lines
                </div>
              </div>
              
              <div className="border border-zinc-200 rounded-xl overflow-y-auto bg-white shadow-xs flex-1 min-h-[220px]">
                <Table>
                  <TableHeader className="bg-zinc-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="py-2.5">Product Info</TableHead>
                      <TableHead className="py-2.5 text-right w-24">System Expected</TableHead>
                      <TableHead className="py-2.5 text-right w-36 row-qty-header">Physically Counted Qty</TableHead>
                      <TableHead className="py-2.5 text-right w-20">Delta</TableHead>
                      <TableHead className="py-2.5 text-right w-28">Valuation Delta</TableHead>
                      <TableHead className="py-2.5 w-14 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCountItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-zinc-400 text-xs italic">
                          {countedItems.length === 0 
                            ? "No products mapped. Tap pre-populate helpers or use gun scanner above." 
                            : "No items match your search term / variance toggle filters."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCountItems.map((item, index) => {
                        const branchInventory = item.product?.inventory?.find((i: any) => i.branch_id === activeStocktake?.branch_id);
                        const systemExpected = branchInventory ? branchInventory.quantity : 0;
                        const countedQty = Number(item.counted_qty || 0);
                        const variance = countedQty - systemExpected;
                        const price = reconciliationValuation === 'cost' 
                          ? Number(item.product?.wholesale_price || 0) 
                          : Number(item.product?.retail_price || 0);
                        const varVal = variance * price;
                        
                        return (
                          <TableRow key={index} className="hover:bg-zinc-50/50">
                            <TableCell className="py-2">
                              <div className="font-bold text-zinc-900 text-xs">{item.product?.name}</div>
                              <div className="text-[10px] text-zinc-500 font-mono">
                                SKU: {item.product?.sku || 'N/A'} | Bar: {item.product?.barcode || 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-right font-mono font-bold text-zinc-500 text-xs">{systemExpected}</TableCell>
                            <TableCell className="py-2 text-right">
                              <input 
                                type="number" 
                                min="0"
                                value={item.counted_qty} 
                                onChange={(e) => {
                                  // Locate item in global index and write update to react state for lag-free rendering
                                  const realIdx = countedItems.findIndex(x => x.product.id === item.product.id);
                                  if (realIdx > -1) {
                                    const updated = [...countedItems];
                                    updated[realIdx].counted_qty = Number(e.target.value || 0);
                                    setCountedItems(updated);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Tab') {
                                    e.preventDefault();
                                    const currentInputs = Array.from(document.querySelectorAll('.stocktake-qty-input'));
                                    const currIdx = currentInputs.indexOf(e.currentTarget);
                                    if (currIdx > -1) {
                                      const nextIdx = e.shiftKey ? currIdx - 1 : currIdx + 1;
                                      const targetInput = currentInputs[nextIdx] as HTMLInputElement | undefined;
                                      if (targetInput) {
                                        targetInput.focus();
                                        targetInput.select();
                                      }
                                    }
                                  }
                                }}
                                onBlur={async () => {
                                  // Sync state to DB on blur (when field is exited)
                                  await saveCountedItemsToDB(activeStocktake.id, countedItems);
                                }}
                                className="stocktake-qty-input w-24 text-right font-mono font-black text-xs border border-zinc-200 rounded-md px-2 h-7 focus:ring-1 focus:ring-zinc-900 focus:outline-none focus:bg-indigo-55/40"
                              />
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              {variance === 0 ? (
                                <Badge className="bg-zinc-100 text-zinc-500 hover:bg-zinc-100 border-0 text-[10px] font-bold">Match</Badge>
                              ) : variance > 0 ? (
                                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-55 border-0 text-[10px] font-mono font-bold">+{variance}</Badge>
                              ) : (
                                <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-55 border-0 text-[10px] font-mono font-bold">{variance}</Badge>
                              )}
                            </TableCell>
                            <TableCell className={`py-2 text-right font-mono text-xs font-bold ${varVal < 0 ? 'text-rose-600' : varVal > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                              {varVal > 0 ? '+' : ''}${varVal.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2 text-center">
                              <Button 
                                type="button"
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                onClick={async () => {
                                  const updated = countedItems.filter(x => x.product.id !== item.product.id);
                                  setCountedItems(updated);
                                  await saveCountedItemsToDB(activeStocktake.id, updated);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          
          <div className="px-6 py-4 bg-zinc-100 border-t border-zinc-200 flex justify-between items-center rounded-b-xl shrink-0">
            <Button 
              variant="ghost" 
              className="text-zinc-600 hover:text-red-650"
              onClick={() => {
                setIsCounting(false);
                setActiveStocktake(null);
              }}
            >
              Close count (Changes pre-saved)
            </Button>
            <Button 
              onClick={async () => {
                if (!activeStocktake) return;
                try {
                  await saveCountedItemsToDB(activeStocktake.id, countedItems);
                  localStorage.setItem(`stocktake_counted_${activeStocktake.id}`, JSON.stringify(countedItems));
                  
                  const { error } = await supabase
                    .from('stocktakes_advanced')
                    .update({ status: 'REVIEW' })
                    .eq('id', activeStocktake.id);

                  if (error) throw error;
                  toast.success('Physical level checks submitted successfully! Waiting for leadership variance approval.');
                  setIsCounting(false);
                  setActiveStocktake(null);
                  setCountedItems([]);
                  fetchStocktakes();
                } catch (err: any) {
                  toast.error(err.message || 'Error occurred during audit completion');
                }
              }} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              Submit Completed Audited Sheet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Inline helper icons to handle clean rendering
function CopyAllIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}
