import React, { useState, useEffect } from 'react';
import { Search, Filter, MoreHorizontal, FileText, Truck, MapPin, Building2, Plus, Printer, Download } from 'lucide-react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table as ShadcnTable,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export function SupplierDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');

  const exportCSV = () => {
    if (!suppliers || suppliers.length === 0) {
      toast.error('No suppliers to export');
      return;
    }
    const headers = ['Code', 'Name', 'Contact', 'Phone', 'Balance'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + suppliers.map(s => `"${s.id}","${s.name || ''}","${s.contact_name || ''}","${s.phone || ''}",${s.balance || 0}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `suppliers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Suppliers exported successfully');
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName) {
      toast.error("Supplier name is required");
      return;
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error("Not authenticated");

      const { data: businessData, error: businessError } = await supabase
        .from('business_users')
        .select('business_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .single();

      if (businessError || !businessData) {
        toast.error("You are not part of any business.");
        return;
      }

      const { data, error } = await supabase.from('suppliers').insert({
        business_id: businessData.business_id,
        name: newSupplierName,
        contact_name: newSupplierContact,
      }).select().single();

      if (error) throw error;
      
      toast.success("Supplier added successfully");
      setIsAddOpen(false);
      setNewSupplierName('');
      setNewSupplierContact('');
      setSuppliers(prev => [data, ...prev]);
    } catch (err: any) {
      toast.error(`Error adding supplier: ${err.message}`);
    }
  };

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setSuppliers(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load suppliers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    
    const channel = supabase
      .channel('public:suppliers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, () => {
        fetchSuppliers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openProfile = (sup: any) => {
    setSelectedSupplier(sup);
    setIsProfileOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search suppliers by name, code, contact..." 
            className="pl-9 bg-white shadow-sm border-zinc-200 h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" className="bg-white shadow-sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <Button variant="outline" className="bg-white shadow-sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button onClick={() => setIsAddOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Supplier</Button>
        </div>
      </div>

      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add Supplier</SheetTitle>
            <SheetDescription>Enter the details for the new supplier.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name</label>
              <Input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Acme Logistics" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Person</label>
              <Input value={newSupplierContact} onChange={(e) => setNewSupplierContact(e.target.value)} placeholder="John Doe" />
            </div>
            <Button className="w-full" onClick={handleAddSupplier}>Save Supplier</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Card className="border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <ShadcnTable>
            <TableHeader className="bg-zinc-50/80 border-b border-zinc-200">
              <TableRow>
                <TableHead className="w-[80px]">Code</TableHead>
                <TableHead className="w-[250px]">Supplier Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Terms</TableHead>
                <TableHead className="text-right">Outstanding Bal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-zinc-500">Loading suppliers...</TableCell>
                </TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-zinc-500">No suppliers found.</TableCell>
                </TableRow>
              ) : suppliers.map((sup) => (
                <TableRow key={sup.id} className="hover:bg-zinc-50/50 cursor-pointer group" onClick={() => openProfile(sup)}>
                  <TableCell className="font-mono text-xs text-zinc-500">{sup.id.substring(0, 8)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-900">{sup.name}</span>
                      <span className="text-xs text-zinc-500 mt-0.5">{sup.contact_name} {sup.phone ? `• ${sup.phone}` : ''}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="font-normal text-xs">{sup.tax_number || 'Standard'}</Badge></TableCell>
                  <TableCell className="text-sm">{sup.payment_terms || 'Net 30'}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-mono font-bold ${sup.balance > 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                      ${(sup.balance || 0).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {sup.status === 'ACTIVE' ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0">Active</Badge>
                    ) : (
                      <Badge className="bg-zinc-100 text-zinc-600 border-0">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger 
                        render={
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4 text-zinc-500" />
                          </Button>
                        } 
                      />
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem>View Dashboard</DropdownMenuItem>
                        <DropdownMenuItem>Create Purchase Order</DropdownMenuItem>
                        <DropdownMenuItem>Record Payment</DropdownMenuItem>
                        <DropdownMenuItem>View Statement</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ShadcnTable>
        </div>
      </Card>

      {/* Supplier Profile Sheet */}
      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto sm:border-l-0">
          <SheetHeader className="pb-6 border-b border-zinc-100">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <SheetTitle className="text-2xl">{selectedSupplier?.name}</SheetTitle>
                  <SheetDescription className="text-zinc-500 mt-1">
                    {selectedSupplier?.category} Supplier • Code: {selectedSupplier?.id}
                  </SheetDescription>
                </div>
              </div>
              <Badge className="bg-zinc-100 text-zinc-800 border-0">{selectedSupplier?.terms}</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="flex flex-col text-sm">
                <span className="text-zinc-500 mb-1 text-xs uppercase tracking-wider">Contact Details</span>
                <span className="text-zinc-900">{selectedSupplier?.contact}</span>
                <span className="text-zinc-600">{selectedSupplier?.phone}</span>
                <span className="text-zinc-600">{selectedSupplier?.email}</span>
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="overview" className="mt-6">
            <TabsList className="w-full justify-start border-b border-zinc-200 rounded-none bg-transparent p-0 h-auto space-x-6 overflow-x-auto">
              <TabsTrigger value="overview" className="border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:shadow-none rounded-none bg-transparent px-0 py-2">Overview</TabsTrigger>
              <TabsTrigger value="orders" className="border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:shadow-none rounded-none bg-transparent px-0 py-2">Purchase Orders</TabsTrigger>
              <TabsTrigger value="ledger" className="border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:shadow-none rounded-none bg-transparent px-0 py-2">Ledger</TabsTrigger>
              <TabsTrigger value="products" className="border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:shadow-none rounded-none bg-transparent px-0 py-2">Products</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-6 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-red-100 shadow-sm p-4 bg-red-50/50">
                  <p className="text-sm text-red-800 font-medium">Outstanding Balance</p>
                  <p className="text-2xl font-bold font-mono mt-1 text-red-900">
                    ${selectedSupplier?.balance.toFixed(2)}
                  </p>
                </Card>
                <Card className="border-zinc-200 shadow-sm p-4">
                  <p className="text-sm text-zinc-500 font-medium">YTD Purchases</p>
                  <p className="text-2xl font-bold font-mono mt-1">$45,200.00</p>
                </Card>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">Recent Purchase Orders</h4>
                <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                  <ShadcnTable>
                    <TableHeader className="bg-zinc-50">
                      <TableRow>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono text-sm text-blue-600">PO-1045</TableCell>
                        <TableCell className="text-sm">Today</TableCell>
                        <TableCell><Badge className="bg-amber-100 text-amber-800 border-0">Pending Delivery</Badge></TableCell>
                        <TableCell className="text-sm text-right font-mono font-bold">$1,450.00</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-sm text-blue-600">PO-1022</TableCell>
                        <TableCell className="text-sm">Oct 12, 2024</TableCell>
                        <TableCell><Badge className="bg-emerald-100 text-emerald-800 border-0">Received</Badge></TableCell>
                        <TableCell className="text-sm text-right font-mono font-bold">$3,200.00</TableCell>
                      </TableRow>
                    </TableBody>
                  </ShadcnTable>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="ledger" className="pt-6">
               <div className="text-center p-8 bg-zinc-50 border border-zinc-100 rounded-xl">
                <p className="text-zinc-500">Supplier financial ledger will appear here.</p>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4 -mx-6 -mb-6 mt-6 flex justify-end gap-2">
             <Button variant="outline">Statement</Button>
            <Button>New PO</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
