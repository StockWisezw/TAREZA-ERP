import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Search, Plus, Filter, ClipboardList, CheckCircle2, Play, AlertTriangle } from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';

const initialStocktakes = [
  { id: 'STK-2024-001', name: 'Q1 Full Inventory Count', status: 'IN_PROGRESS', date: 'Oct 24, 2024', type: 'Full Count', branch: 'Main Warehouse' },
  { id: 'STK-2024-002', name: 'Beverages Cycle Count', status: 'COMPLETED', date: 'Oct 15, 2024', type: 'Cycle Count', branch: 'Harare Store' },
  { id: 'STK-2024-003', name: 'Electronics Spot Check', status: 'REVIEW', date: 'Oct 10, 2024', type: 'Partial', branch: 'Main Warehouse' },
];

export function Stocktake() {
  const [stocktakes, setStocktakes] = useState(initialStocktakes);
  const [reviewItem, setReviewItem] = useState<any>(null);

  const handleApprove = () => {
    setStocktakes(prev => 
      prev.map(stk => 
        stk.id === reviewItem.id ? { ...stk, status: 'COMPLETED' } : stk
      )
    );
    toast.success(`Variances approved and inventory updated for ${reviewItem.id}`);
    setReviewItem(null);
  };

  const handleReject = () => {
    toast.error(`Variances rejected for ${reviewItem.id}. Count needs to be redone.`);
    setStocktakes(prev => 
      prev.map(stk => 
        stk.id === reviewItem.id ? { ...stk, status: 'IN_PROGRESS' } : stk
      )
    );
    setReviewItem(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Stocktakes</h2>
          <p className="text-sm text-zinc-500">Manage cycle counts, full stocktakes, and variance approvals.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> New Stocktake</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-100 bg-emerald-50/50">
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
        
        <Card className="border-amber-100 bg-amber-50/50">
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

        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-800">Completed (30d)</p>
              <p className="text-2xl font-bold text-blue-900">{stocktakes.filter(s => s.status === 'COMPLETED').length + 3}</p>
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
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stocktakes.map((stk) => (
              <TableRow key={stk.id}>
                <TableCell className="font-mono text-xs">{stk.id}</TableCell>
                <TableCell className="font-medium">{stk.name}</TableCell>
                <TableCell>{stk.type}</TableCell>
                <TableCell className="text-zinc-500">{stk.branch}</TableCell>
                <TableCell>{stk.date}</TableCell>
                <TableCell>
                  {stk.status === 'IN_PROGRESS' && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0">In Progress</Badge>}
                  {stk.status === 'REVIEW' && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0">Review Variances</Badge>}
                  {stk.status === 'COMPLETED' && <Badge className="bg-zinc-100 text-zinc-600 border-0 hover:bg-zinc-200">Completed</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {stk.status === 'REVIEW' ? (
                    <Button variant="outline" size="sm" onClick={() => setReviewItem(stk)} className="border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100">
                      Review & Approve
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm">View</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!reviewItem} onOpenChange={(open) => !open && setReviewItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review Stocktake Variances</DialogTitle>
            <DialogDescription>
              Review the differences between system quantities and counted quantities for {reviewItem?.name} ({reviewItem?.id}).
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-2 flex items-start gap-3 text-amber-800 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold mb-1">Warning: Irreversible Action</p>
              <p>Approving these variances will permanently modify current inventory levels to match the counted quantities. This will create adjusting entries in the stock movement ledger.</p>
            </div>
          </div>

          <div className="border rounded-md mt-4 max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">System Qty</TableHead>
                  <TableHead className="text-right">Counted Qty</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">Est. Value (ZIG)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-xs text-zinc-500">SKU-1029</TableCell>
                  <TableCell>Samsung Galaxy A54</TableCell>
                  <TableCell className="text-right">12</TableCell>
                  <TableCell className="text-right font-medium text-amber-600">10</TableCell>
                  <TableCell className="text-right text-red-600 font-bold">-2</TableCell>
                  <TableCell className="text-right text-red-600">-$640.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs text-zinc-500">SKU-9381</TableCell>
                  <TableCell>USB-C Charging Cable 2m</TableCell>
                  <TableCell className="text-right">45</TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">47</TableCell>
                  <TableCell className="text-right text-emerald-600 font-bold">+2</TableCell>
                  <TableCell className="text-right text-emerald-600">+$10.00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="mt-6 flex justify-between sm:justify-between items-center w-full">
            <Button variant="ghost" className="text-zinc-500" onClick={() => setReviewItem(null)}>Cancel</Button>
            <div className="flex gap-2">
              <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleReject}>Reject Count</Button>
              <Button onClick={handleApprove} className="bg-primary text-primary-foreground hover:bg-primary/90">Approve & Adjust Inventory</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
