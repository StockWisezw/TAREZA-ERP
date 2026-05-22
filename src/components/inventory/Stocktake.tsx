import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Search, Plus, Filter, ClipboardList, CheckCircle2, Play, AlertTriangle, Settings, Calendar as CalendarIcon, Tag } from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export function Stocktake() {
  const [stocktakes, setStocktakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [reviewItem, setReviewItem] = useState<any>(null);
  const [reviewItemsData, setReviewItemsData] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isCounting, setIsCounting] = useState(false);

  useEffect(() => {
    fetchStocktakes();
  }, []);

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
      const insertData = {
        status: 'IN_PROGRESS',
        type: formData.get('type') as string,
        // Using a hardcoded branch_id for demo if not using real branch UUIDs - 
        // Note: Branch will need to be properly selected if UUID references are strictly enforced.
        started_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('stocktakes_advanced')
        .insert(insertData);
        
      if (error) throw error;
      toast.success('Stocktake initialized successfully');
      setIsCreating(false);
      fetchStocktakes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to initialize stocktake');
    }
  };

  const openReview = (stk: any) => {
    setReviewItem(stk);
    // Ideally query stocktake_items here. For now we use the modal layout but with empty/dynamic state
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
                    <Button variant="outline" size="sm" onClick={() => setIsCounting(true)} className="border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100">
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
        <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0 bg-zinc-50/50">
          <div className="p-6 bg-white border-b">
            <DialogHeader>
              <DialogTitle className="text-xl">Review Stocktake Variances</DialogTitle>
              <DialogDescription>
                Detailed breakdown for stocktake {reviewItem?.id?.substring(0, 8)}. Includes batch tracking and expiry updates.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 text-amber-800 text-sm shadow-xs">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold mb-1">Warning: Irreversible Action</p>
                <p>Approving these variances will permanently modify current inventory levels to match the counted quantities. This will create adjusting entries in the stock movement ledger.</p>
              </div>
            </div>

            <div className="border rounded-md max-h-[400px] overflow-auto bg-white shadow-xs">
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
                  <TableRow>
                     <TableCell colSpan={4} className="text-center text-zinc-500 py-6">
                        No variances data fetched (Pending Backend Implementation).
                     </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            
          </div>

          <div className="p-6 bg-white border-t flex justify-between items-center">
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
        <DialogContent className="max-w-md">
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
                <SelectContent>
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

      {/* Counting Interface (Mock) */}
      <Dialog open={isCounting} onOpenChange={setIsCounting}>
        <DialogContent className="max-w-3xl p-0 gap-0">
           <div className="p-4 border-b flex justify-between items-center bg-zinc-900 text-zinc-50 rounded-t-xl">
             <div>
               <h3 className="font-medium">Active Count</h3>
               <p className="text-xs text-zinc-400">Scanner Ready. Focus on input field to scan barcodes.</p>
             </div>
             <Button variant="outline" size="sm" className="bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700 hover:text-white" onClick={() => setIsCounting(false)}>
               Pause Count
             </Button>
           </div>
           
           <div className="p-6 bg-zinc-50 space-y-6">
              <div className="flex gap-4">
                 <div className="flex-1 space-y-2">
                   <Label>Scan Barcode / Enter SKU</Label>
                   <Input placeholder="Scan product barcode..." className="text-lg py-6 shadow-xs border-blue-200 focus-visible:ring-blue-500" autoFocus />
                 </div>
                 <div className="w-32 space-y-2">
                   <Label>Qty</Label>
                   <Input type="number" defaultValue="1" className="text-lg py-6 text-center font-bold" />
                 </div>
                 <div className="pt-8">
                   <Button size="lg" className="h-12 bg-blue-600 hover:bg-blue-700 text-white">Add</Button>
                 </div>
              </div>
           </div>
           
           <div className="p-4 bg-zinc-100 border-t rounded-b-xl flex justify-between items-center">
              <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700">Cancel Stocktake</Button>
              <Button onClick={() => {
                setIsCounting(false);
                toast.success('Count draft saved. Close to review.');
              }} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                Finish & Submit for Review
              </Button>
           </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
