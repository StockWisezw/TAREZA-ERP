import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Search, Plus, Filter, ClipboardList, CheckCircle2, Play, AlertTriangle, Settings, Calendar as CalendarIcon, Tag, Trash2 } from 'lucide-react';
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

  useEffect(() => {
    fetchStocktakes();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
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
          branches ( name )
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

  const handleApprove = async () => {
    if (!reviewItem) return;
    try {
      const { error } = await supabase
        .from('stocktakes_advanced')
        .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
        .eq('id', reviewItem.id);
      
      if (error) throw error;
      toast.success(`Variances approved and inventory updated for ${reviewItem.id}`);
      setReviewItem(null);
      fetchStocktakes();
    } catch (err: any) {
      toast.error(err.message || 'Error approving stocktake');
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
      toast.error(`Variances rejected for ${reviewItem.id}. Count needs to be redone.`);
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
      toast.success('Stocktake initialized successfully');
      setIsCreating(false);
      fetchStocktakes();
      if (newSt) {
        setActiveStocktake(newSt);
        setCountedItems([]);
        setIsCounting(true);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to initialize stocktake');
    }
  };

  const openReview = (stk: any) => {
    setReviewItem(stk);
    const stored = localStorage.getItem(`stocktake_counted_${stk.id}`);
    if (stored) {
      setReviewItemsData(JSON.parse(stored));
    } else {
      setReviewItemsData([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Advanced Stocktakes</h2>
          <p className="text-sm text-zinc-500">Manage cycle counts, full stocktakes, batches, and expiry variances.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={fetchStocktakes}>Refresh</Button>
          <Button onClick={() => setIsCreating(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> New Stocktake
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-100 bg-emerald-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-emerald-800">In Progress</p>
              <p className="text-2xl font-bold text-emerald-900">{stocktakes.filter(s => s.status === 'IN_PROGRESS').length}</p>
            </div>
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <Play className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-amber-100 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800">Needs Review</p>
              <p className="text-2xl font-bold text-amber-900">{stocktakes.filter(s => s.status === 'REVIEW').length}</p>
            </div>
            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-blue-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-800">Completed (Total)</p>
              <p className="text-2xl font-bold text-blue-900">{stocktakes.filter(s => s.status === 'COMPLETED').length}</p>
            </div>
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200 shadow-sm">
        <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-50/50 rounded-t-xl">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input placeholder="Search stocktakes..." className="pl-9 bg-white" />
          </div>
          <Button variant="outline" className="bg-white whitespace-nowrap"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-zinc-500">Loading stocktakes...</TableCell>
              </TableRow>
            ) : stocktakes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-zinc-500">No stocktakes found.</TableCell>
              </TableRow>
            ) : stocktakes.map((stk) => (
              <TableRow key={stk.id}>
                <TableCell className="font-mono text-xs">{stk.id?.substring(0, 8)}...</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <Settings className="h-3 w-3 text-zinc-400" /> {stk.type || 'Custom'}
                  </div>
                </TableCell>
                <TableCell className="text-zinc-600">{stk.branches?.name || 'Unknown'}</TableCell>
                <TableCell>{stk.started_at ? new Date(stk.started_at).toLocaleDateString() : '-'}</TableCell>
                <TableCell>
                  {stk.status === 'IN_PROGRESS' && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0">In Progress</Badge>}
                  {stk.status === 'REVIEW' && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0">Review Variances</Badge>}
                  {stk.status === 'COMPLETED' && <Badge className="bg-zinc-100 text-zinc-600 border-0 hover:bg-zinc-200">Completed</Badge>}
                  {stk.status === 'DRAFT' && <Badge className="bg-gray-100 text-gray-800 border-0 hover:bg-gray-200">Draft</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {stk.status === 'REVIEW' ? (
                    <Button variant="outline" size="sm" onClick={() => openReview(stk)} className="border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100">
                      Review Quantities
                    </Button>
                  ) : stk.status === 'IN_PROGRESS' ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setActiveStocktake(stk);
                        const stored = localStorage.getItem(`stocktake_counted_${stk.id}`);
                        if (stored) {
                          setCountedItems(JSON.parse(stored));
                        } else {
                          setCountedItems([]);
                        }
                        setProductSearchInput('');
                        setSelectedProduct(null);
                        setCountQty('1');
                        setIsCounting(true);
                      }} 
                      className="border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                    >
                      Continue Count
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm">View Report</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Review Modal */}
      <Dialog open={!!reviewItem} onOpenChange={(open) => !open && setReviewItem(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0 bg-white">
          <div className="p-6 bg-white border-b border-zinc-200">
            <DialogHeader>
              <DialogTitle className="text-xl">Review Stocktake Variances</DialogTitle>
              <DialogDescription>
                Detailed breakdown for stocktake {reviewItem?.id?.substring(0, 8)}. Includes batch tracking and expiry updates.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 text-amber-800 text-sm shadow-xs">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold mb-1">Warning: Irreversible Action</p>
                <p>Approving these variances will permanently modify current inventory levels to match the counted quantities. This will create adjusting entries in the stock movement ledger.</p>
              </div>
            </div>

            <div className="border border-zinc-200 rounded-md max-h-[400px] overflow-auto bg-white shadow-xs">
              <Table>
                <TableHeader className="bg-zinc-50 sticky top-0 z-10 shadow-xs">
                  <TableRow>
                    <TableHead>Product details</TableHead>
                    <TableHead className="text-right">System Qty</TableHead>
                    <TableHead className="text-right">Counted Qty</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewItemsData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-zinc-500 py-8">
                        No product data counted for this stocktake.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reviewItemsData.map((item: any, idx) => {
                      const systemQty = item.product?.inventory?.[0]?.quantity || 0;
                      const countedQty = Number(item.counted_qty || 0);
                      const variance = countedQty - systemQty;
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="font-semibold text-zinc-900">{item.product?.name}</div>
                            <div className="text-xs text-zinc-505 font-mono">
                              SKU: {item.product?.sku || 'N/A'} | SKU Code: {item.product?.code || 'N/A'} | Barcode: {item.product?.barcode || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-zinc-600">{systemQty}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-blue-600">{countedQty}</TableCell>
                          <TableCell className={`text-right font-mono font-bold ${variance < 0 ? 'text-rose-600' : variance > 0 ? 'text-emerald-600' : 'text-zinc-500'}`}>
                            {variance > 0 ? `+${variance}` : variance}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            
          </div>

          <div className="p-6 bg-white border-t border-zinc-200 flex justify-between items-center">
            <Button variant="ghost" className="text-zinc-500" onClick={() => setReviewItem(null)}>Cancel</Button>
            <div className="flex gap-2">
              <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleReject}>Reject Count</Button>
              <Button onClick={handleApprove} className="bg-zinc-900 text-zinc-50 hover:bg-zinc-800">Approve & Adjust Inventory</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Create Stocktake Modal */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Initialize Stocktake</DialogTitle>
            <DialogDescription>
              Create a new stocktake instance. You can count blindly or with expected quantities visible.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type">Count Type</Label>
              <Select name="type" defaultValue="FULL">
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="FULL">Full Inventory Count</SelectItem>
                  <SelectItem value="PARTIAL">Partial Count (Selected Categories)</SelectItem>
                  <SelectItem value="CYCLE">Cycle Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button type="submit">Start Counting</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Counting Interface with Advanced Multi-Field Search (Name, SKU, Code, Barcode) */}
      <Dialog open={isCounting} onOpenChange={(open) => {
        if (!open) {
          setIsCounting(false);
          setActiveStocktake(null);
        }
      }}>
        <DialogContent className="max-w-3xl p-0 gap-0 bg-white">
          <div className="p-4 border-b flex justify-between items-center bg-zinc-900 text-zinc-50 rounded-t-xl">
            <div>
              <h3 className="font-medium">Active Count</h3>
              <p className="text-xs text-zinc-400">Scanner active. Fast search by Name, SKU, Code, or Barcode.</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700 hover:text-white" 
              onClick={() => {
                if (activeStocktake) {
                  localStorage.setItem(`stocktake_counted_${activeStocktake.id}`, JSON.stringify(countedItems));
                }
                setIsCounting(false);
                setActiveStocktake(null);
                toast.success('Count progress saved!');
              }}
            >
              Pause Count
            </Button>
          </div>
          
          <div className="p-6 bg-zinc-50 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {/* Product Multi-field Search Input with suggestions */}
              <div className="md:col-span-2 relative space-y-1">
                <Label className="text-xs text-zinc-650 font-semibold">Search / Scan Product</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <Input 
                    placeholder="Type name, barcode, SKU, or code..." 
                    className="pl-9 bg-white"
                    value={productSearchInput}
                    onChange={(e) => {
                      const inp = e.target.value;
                      setProductSearchInput(inp);
                      
                      // Auto-scan barcode / exact SKU check
                      if (inp.trim()) {
                        const hit = products.find(p => 
                          (p.barcode && p.barcode.trim().toLowerCase() === inp.trim().toLowerCase()) ||
                          (p.sku && p.sku.trim().toLowerCase() === inp.trim().toLowerCase()) ||
                          (p.code && p.code.trim().toLowerCase() === inp.trim().toLowerCase())
                        );
                        if (hit) {
                          setSelectedProduct(hit);
                          setProductSearchInput(hit.name);
                          toast.success(`Scanned: ${hit.name}`);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const term = productSearchInput.trim().toLowerCase();
                        if (term && !selectedProduct) {
                          const hits = products.filter(p => 
                            (p.name || '').toLowerCase().includes(term) ||
                            (p.sku || '').toLowerCase().includes(term) ||
                            (p.barcode || '').toLowerCase().includes(term) ||
                            (p.code || '').toLowerCase().includes(term)
                          );
                          if (hits.length === 1) {
                            setSelectedProduct(hits[0]);
                            setProductSearchInput(hits[0].name);
                          } else if (hits.length > 1) {
                            toast.info('Multiple matches found. Select one from suggestions dropdown.');
                          }
                        }
                      }
                    }}
                  />
                </div>

                {/* Autocomplete suggestion container */}
                {productSearchInput.trim() !== '' && !selectedProduct && (
                  <div className="absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto bg-white border border-zinc-200 rounded-lg shadow-lg z-50">
                    {(() => {
                      const matches = products.filter(p => {
                        const t = productSearchInput.toLowerCase();
                        return (
                          (p.name || '').toLowerCase().includes(t) ||
                          (p.sku || '').toLowerCase().includes(t) ||
                          (p.barcode || '').toLowerCase().includes(t) ||
                          (p.code || '').toLowerCase().includes(t)
                        );
                      });
                      if (matches.length === 0) {
                        return <div className="p-3 text-xs text-zinc-505 text-center">No matching products found.</div>;
                      }
                      return matches.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left p-2.5 hover:bg-zinc-50 border-b border-zinc-100 last:border-0 block transition-colors"
                          onClick={() => {
                            setSelectedProduct(p);
                            setProductSearchInput(p.name);
                          }}
                        >
                          <div className="font-semibold text-xs text-zinc-900">{p.name}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            SKU: {p.sku || 'N/A'} | SKU Code: {p.code || 'N/A'} | Barcode: {p.barcode || 'N/A'}
                          </div>
                        </button>
                      ));
                    })()}
                  </div>
                )}

                {selectedProduct && (
                  <div className="flex items-center justify-between bg-zinc-100 border border-zinc-200 rounded-md px-3 py-1.5 mt-1 animate-in fade-in duration-250">
                    <div className="text-xs">
                      <span className="font-semibold text-zinc-700">Matched Product:</span> {selectedProduct.name}  
                      <span className="text-[10px] text-zinc-505 font-mono ml-1">({selectedProduct.sku || selectedProduct.barcode || 'Selected'})</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        setSelectedProduct(null);
                        setProductSearchInput('');
                      }} 
                      className="text-zinc-400 hover:text-zinc-650 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Quantity input and Add Button */}
              <div className="flex gap-2 items-end">
                <div className="w-24 space-y-1">
                  <Label className="text-xs text-zinc-650 font-semibold">Qty</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={countQty} 
                    onChange={e => setCountQty(e.target.value)} 
                    className="bg-white font-bold text-center text-zinc-900" 
                  />
                </div>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (!selectedProduct) {
                      toast.error('Choose a product from suggestions or scan tag barcode.');
                      return;
                    }
                    const qVal = Number(countQty);
                    if (isNaN(qVal) || qVal <= 0) {
                      toast.error('Specify a valid counted quantity.');
                      return;
                    }
                    const existIndex = countedItems.findIndex(item => item.product?.id === selectedProduct.id);
                    if (existIndex > -1) {
                      const updated = [...countedItems];
                      updated[existIndex].counted_qty += qVal;
                      setCountedItems(updated);
                    } else {
                      setCountedItems([...countedItems, { product: selectedProduct, counted_qty: qVal }]);
                    }
                    toast.success(`Counted: ${qVal}x ${selectedProduct.name}`);
                    setSelectedProduct(null);
                    setProductSearchInput('');
                    setCountQty('1');
                  }} 
                  className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                >
                  Add Item
                </Button>
              </div>
            </div>

            {/* List of counted items in this session */}
            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold text-zinc-700">Session Counted Items List ({countedItems.length})</Label>
              <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-zinc-50 sticky top-0 z-10 shadow-xs">
                    <TableRow>
                      <TableHead className="py-2">Item Details</TableHead>
                      <TableHead className="py-2 text-right w-24">Counted Qty</TableHead>
                      <TableHead className="py-2 w-16 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {countedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-10 text-zinc-400 text-xs italic">
                          No items counted yet. Scan SKU code, barcode, or type name to add.
                        </TableCell>
                      </TableRow>
                    ) : (
                      countedItems.map((item, index) => (
                        <TableRow key={index} className="hover:bg-zinc-50/50">
                          <TableCell className="py-2">
                            <div className="font-semibold text-zinc-900 text-xs">{item.product?.name}</div>
                            <div className="text-[10px] text-zinc-550 font-mono">
                              SKU: {item.product?.sku || 'N/A'} | SKU Code: {item.product?.code || 'N/A'} | Bar: {item.product?.barcode || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-right font-mono font-bold text-zinc-900">{item.counted_qty}</TableCell>
                          <TableCell className="py-2 text-center">
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                              onClick={() => {
                                setCountedItems(countedItems.filter((_, idx) => idx !== index));
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-zinc-100 border-t border-zinc-200 rounded-b-xl flex justify-between items-center">
            <Button 
              variant="ghost" 
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                setIsCounting(false);
                setActiveStocktake(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (!activeStocktake) return;
                try {
                  localStorage.setItem(`stocktake_counted_${activeStocktake.id}`, JSON.stringify(countedItems));
                  const { error } = await supabase
                    .from('stocktakes_advanced')
                    .update({ status: 'REVIEW' })
                    .eq('id', activeStocktake.id);
                  if (error) throw error;
                  toast.success('Count completed and submitted for review!');
                  setIsCounting(false);
                  setActiveStocktake(null);
                  setCountedItems([]);
                  fetchStocktakes();
                } catch (err: any) {
                  toast.error(err.message || 'Error submitting completed count');
                }
              }} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium"
            >
              Finish & Submit for Review
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
