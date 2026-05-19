import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Store, Warehouse, MapPin, MoreHorizontal, LayoutGrid, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function BranchWarehouseSettings() {
  const [isAdding, setIsAdding] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  
  // New branch form state
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchType, setNewBranchType] = useState('branch');
  const [newBranchAddress, setNewBranchAddress] = useState('');

  useEffect(() => {
    async function loadBranches() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data: buData } = await supabase.from('business_users').select('business_id').eq('user_id', userData.user.id).limit(1).single();
        if (!buData) return;
        setBusinessId(buData.business_id);

        const { data: bData } = await supabase.from('branches').select('*').eq('business_id', buData.business_id).order('created_at', { ascending: true });
        if (bData) {
            setLocations(bData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadBranches();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    if (!newBranchName) {
        toast.error("Branch name is required");
        return;
    }
    setIsAdding(true);
    try {
        const { data, error } = await supabase.from('branches').insert({
            business_id: businessId,
            name: newBranchName,
            type: newBranchType,
            address: newBranchAddress,
            is_active: true
        });
        if (error) throw error;
        toast.success("Branch created successfully");
        
        // Reload
        const { data: bData } = await supabase.from('branches').select('*').eq('business_id', businessId).order('created_at', { ascending: true });
        if (bData) setLocations(bData);
        
        // Reset form
        setNewBranchName('');
        setNewBranchAddress('');
    } catch(err: any) {
        toast.error(err.message || "Failed to create branch");
    } finally {
        setIsAdding(false);
    }
  };

  const activeBranches = locations.filter(l => l.type === 'branch' || l.type === 'retail').length;
  const activeWarehouses = locations.filter(l => l.type === 'warehouse').length;

  if (loading) {
     return <div className="p-8 text-center text-zinc-500"><Loader2 className="animate-spin w-6 h-6 mx-auto mb-2" /> Loading branches...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Branches & Warehouses</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your physical locations, POS tills, and warehouse storage.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Location</DialogTitle>
              <DialogDescription>Add a new branch or warehouse to your business.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 pt-4">
               <div className="space-y-2">
                 <Label htmlFor="b-name">Location Name</Label>
                 <Input id="b-name" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="e.g. Harare CBD" required />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="b-type">Location Type</Label>
                 <select id="b-type" value={newBranchType} onChange={e => setNewBranchType(e.target.value)} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="branch">Retail Branch</option>
                    <option value="warehouse">Warehouse</option>
                 </select>
               </div>
               <div className="space-y-2">
                 <Label htmlFor="b-addr">Address</Label>
                 <Input id="b-addr" value={newBranchAddress} onChange={e => setNewBranchAddress(e.target.value)} placeholder="Physical address" />
               </div>
               <Button type="submit" className="w-full" disabled={isAdding}>
                 {isAdding ? 'Creating...' : 'Create Location'}
               </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-zinc-200/60 shadow-sm p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Store className="w-6 h-6" /></div>
            <Badge variant="outline" className="bg-white">Active</Badge>
          </div>
          <div className="mt-4">
            <h4 className="text-3xl font-bold text-zinc-900">{activeBranches}</h4>
            <p className="text-sm font-medium text-zinc-500 mt-1">Retail Branches</p>
          </div>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Warehouse className="w-6 h-6" /></div>
            <Badge variant="outline" className="bg-white">Active</Badge>
          </div>
          <div className="mt-4">
            <h4 className="text-3xl font-bold text-zinc-900">{activeWarehouses}</h4>
            <p className="text-sm font-medium text-zinc-500 mt-1">Warehouses / Depots</p>
          </div>
        </Card>
      </div>

      <Card className="border-zinc-200/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">Configured Locations</CardTitle>
              <CardDescription className="mt-1">Setup operational rules and inventory logic for each branch.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow>
                <TableHead className="w-[300px]">Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Physical Address</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={4} className="text-center py-8 text-zinc-500">No locations found. Add your first branch above.</TableCell>
                 </TableRow>
              ) : locations.map((loc) => (
                <TableRow key={loc.id} className="group hover:bg-zinc-50/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg border shadow-sm ${loc.type === 'branch' || loc.type === 'retail' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                        {loc.type === 'branch' || loc.type === 'retail' ? <Store className="w-4 h-4" /> : <Warehouse className="w-4 h-4" />}
                      </div>
                      <div className="flex flex-col">
                        <div className="font-semibold text-zinc-900 group-hover:text-primary transition-colors flex items-center gap-2">
                          {loc.name}
                        </div>
                        <span className="text-xs text-zinc-500 font-medium capitalize mt-0.5">
                          {loc.is_active !== false ? 'Operational' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="capitalize font-medium text-zinc-700">{loc.type}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-zinc-600 text-sm">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate max-w-[200px]">{loc.address || 'No address set'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900">
                        <MoreHorizontal className="w-4 h-4" />
                     </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
