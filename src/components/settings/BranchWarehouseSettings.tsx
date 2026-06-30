import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Store, Warehouse, MapPin, MoreHorizontal, LayoutGrid, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../lib/firebaseClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function BranchWarehouseSettings() {
  const [isAdding, setIsAdding] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  
  const [planName, setPlanName] = useState<string>('free_trial');
  
  // New branch form state
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchType, setNewBranchType] = useState('branch');
  const [newBranchAddress, setNewBranchAddress] = useState('');

  // Editing branch state
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [editBranchName, setEditBranchName] = useState('');
  const [editBranchType, setEditBranchType] = useState('branch');
  const [editBranchAddress, setEditBranchAddress] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchBranches = async (bizId: string) => {
    const { data } = await supabase.from('branches').select('*').eq('business_id', bizId);
    if (data) {
      const branches = data.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setLocations(branches);
    }
  };

  useEffect(() => {
    async function loadBranches() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: buData } = await supabase.from('business_users').select('business_id').eq('user_id', user.id);
        
        if (!buData || buData.length === 0) return;
        const bizId = buData[0].business_id;
        setBusinessId(bizId);

        // Fetch subscription plan
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('plan_name')
          .eq('business_id', bizId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (subData?.plan_name) {
          setPlanName(subData.plan_name);
        }

        await fetchBranches(bizId);
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

    // Limit check based on plan
    const maxBranches = planName === 'free' ? 999 : (planName === 'free_trial' || planName === 'starter') ? 1 : planName === 'pro' ? 3 : 100;
    if (locations.length >= maxBranches) {
      toast.error(`Branch limit reached! Your ${planName === 'free_trial' ? 'Free Trial' : planName + ' plan'} limits you to ${maxBranches} branch${maxBranches > 1 ? 'es' : ''}. Please upgrade your subscription to add more branches.`);
      return;
    }

    setIsAdding(true);
    try {
        const { error } = await supabase.from('branches').insert([{
            business_id: businessId,
            name: newBranchName,
            type: newBranchType,
            address: newBranchAddress,
            is_active: true,
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;
        toast.success("Branch created successfully");
        
        // Reload
        await fetchBranches(businessId);
        
        // Reset form
        setNewBranchName('');
        setNewBranchAddress('');
    } catch(err: any) {
        toast.error(err.message || "Failed to create branch");
    } finally {
        setIsAdding(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !editingBranch) return;
    if (!editBranchName) {
      toast.error("Location name is required");
      return;
    }
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('branches')
        .update({
          name: editBranchName,
          type: editBranchType,
          address: editBranchAddress,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingBranch.id);

      if (error) throw error;
      toast.success("Location updated successfully");
      setIsEditOpen(false);
      setEditingBranch(null);
      await fetchBranches(businessId);
    } catch (err: any) {
      toast.error(err.message || "Failed to update location");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (branchId: string) => {
    if (!businessId) return;
    if (!window.confirm("Are you sure you want to delete this location? All stock and sales linked with this branch will be kept.")) return;
    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchId);

      if (error) throw error;
      toast.success("Location deleted successfully");
      await fetchBranches(businessId);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete location");
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
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-zinc-500 hover:text-primary hover:bg-zinc-100"
                        title="Edit Location"
                        onClick={() => {
                          setEditingBranch(loc);
                          setEditBranchName(loc.name);
                          setEditBranchType(loc.type || 'branch');
                          setEditBranchAddress(loc.address || '');
                          setIsEditOpen(true);
                        }}
                      >
                         <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-zinc-500 hover:text-red-600 hover:bg-zinc-100"
                        title="Delete Location"
                        onClick={() => handleDelete(loc.id)}
                      >
                         <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Location Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>Modify details of this branch or warehouse.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 pt-4">
             <div className="space-y-2">
               <Label htmlFor="edit-b-name">Location Name</Label>
               <Input 
                 id="edit-b-name" 
                 value={editBranchName} 
                 onChange={e => setEditBranchName(e.target.value)} 
                 required 
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="edit-b-type">Location Type</Label>
               <select 
                 id="edit-b-type" 
                 value={editBranchType} 
                 onChange={e => setEditBranchType(e.target.value)} 
                 className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
               >
                  <option value="branch">Retail Branch</option>
                  <option value="warehouse">Warehouse</option>
               </select>
             </div>
             <div className="space-y-2">
               <Label htmlFor="edit-b-addr">Address</Label>
               <Input 
                 id="edit-b-addr" 
                 value={editBranchAddress} 
                 onChange={e => setEditBranchAddress(e.target.value)} 
               />
             </div>
             <Button type="submit" className="w-full" disabled={isSavingEdit}>
               {isSavingEdit ? 'Saving...' : 'Save Changes'}
             </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
