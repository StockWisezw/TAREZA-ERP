import React, { useState, useEffect } from 'react';
import { Search, Filter, MoreHorizontal, Mail, Phone, MapPin, Star, Building2, User, Plus, Download, Printer } from 'lucide-react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import {
  Table as ShadcnTable,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '../ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export function CustomerDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // New Customer Form State
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
        
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        setCustomers(data);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      toast.success("Customer deleted successfully");
      setIsProfileOpen(false);
      fetchCustomers();
    } catch (err) {
      toast.error("Could not delete customer");
    }
  };

  const exportCSV = () => {
    if (!customers || customers.length === 0) {
      toast.error('No customers to export');
      return;
    }
    const headers = ['Name', 'Email', 'Phone', 'Address', 'Balance'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + customers.map(c => `${c.name || ''},${c.email || ''},${c.phone || ''},"${c.address || ''}",${c.balance || 0}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Customers exported successfully');
  };

  const handleAddCustomer = async () => {
    if(!newCustomerName) {
      toast.error("Name is required");
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
         toast.error("You are not part of any business. Cannot add customer.");
         return;
       }

      const { data, error } = await supabase.from('customers').insert({
        business_id: businessData.business_id,
        name: newCustomerName,
        email: newCustomerEmail,
        phone: newCustomerPhone,
        customer_type: 'retail'
      }).select().single();

      if(error) throw error;
      toast.success("Customer added");
      setIsAddOpen(false);
      setNewCustomerName('');
      setNewCustomerEmail('');
      setNewCustomerPhone('');
      fetchCustomers();
    } catch (err: any) {
      console.error("Supabase insert error", err);
      toast.error(`Error adding customer: ${err.message || 'Unknown error'}`);
    }
  };

  const getTierBadge = (tier: string) => {
    switch(tier?.toUpperCase()) {
      case 'VIP': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-0"><Star className="w-3 h-3 mr-1 fill-purple-800" /> VIP</Badge>;
      case 'GOLD': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0">Gold</Badge>;
      case 'SILVER': return <Badge className="bg-zinc-200 text-zinc-800 hover:bg-zinc-300 border-0">Silver</Badge>;
      default: return <Badge variant="outline" className="text-zinc-500">Standard</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type?.toUpperCase()) {
      case 'WHOLESALE': return <Building2 className="w-4 h-4 text-blue-500" />;
      case 'BUSINESS': return <Building2 className="w-4 h-4 text-emerald-500" />;
      default: return <User className="w-4 h-4 text-zinc-400" />;
    }
  };

  const openProfile = (cust: any) => {
    setSelectedCustomer(cust);
    setIsProfileOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search by name, company, phone, email..." 
            className="pl-9 bg-white shadow-sm border-zinc-200 h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" className="bg-white shadow-sm"><Filter className="mr-2 h-4 w-4" /> Filters</Button>
          <DropdownMenu>
            <DropdownMenuTrigger 
              render={<Button variant="outline" className="bg-white shadow-sm">Customer Type</Button>}
            />
            <DropdownMenuContent>
              <DropdownMenuItem>All Customers</DropdownMenuItem>
              <DropdownMenuItem>Wholesale Only</DropdownMenuItem>
              <DropdownMenuItem>Retail Only</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="outline" className="bg-white shadow-sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <Button variant="outline" className="bg-white shadow-sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Export</Button>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm"><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="e.g. Tendai Moyo" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} placeholder="+263..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} placeholder="email@example.com" />
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAddCustomer}>Save Customer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      <Card className="border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <ShadcnTable>
            <TableHeader className="bg-zinc-50/80 border-b border-zinc-200">
              <TableRow>
                <TableHead className="w-[280px]">Customer</TableHead>
                <TableHead>Contact Details</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase())).map((cust) => (
                <TableRow key={cust.id} className="hover:bg-zinc-50/50 cursor-pointer group" onClick={() => openProfile(cust)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 flex-shrink-0 bg-zinc-100 rounded-full border border-zinc-200 flex items-center justify-center">
                        {getTypeIcon(cust.customer_type)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900">{cust.name}</span>
                        <span className="text-xs text-zinc-500 mt-0.5">{cust.customer_type?.toUpperCase() || 'RETAIL'}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {cust.phone && (
                        <span className="text-xs text-zinc-600 flex items-center"><Phone className="w-3 h-3 mr-1.5 text-zinc-400"/>{cust.phone}</span>
                      )}
                      {cust.email && (
                        <span className="text-xs text-zinc-600 flex items-center"><Mail className="w-3 h-3 mr-1.5 text-zinc-400"/>{cust.email}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getTierBadge(cust.tier || 'STANDARD')}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-mono font-bold ${(cust.balance || 0) > 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                      ${(cust.balance || 0).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center text-xs font-medium text-emerald-600">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Active
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger 
                        render={
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4 text-zinc-500" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openProfile(cust)}>View Profile</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(cust.id)} className="text-red-600">Delete Customer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ShadcnTable>
        </div>
      </Card>

      {/* Customer Profile Sheet */}
      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto sm:border-l-0">
          <SheetHeader className="pb-6 border-b border-zinc-100">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 bg-zinc-100 rounded-xl flex items-center justify-center border border-zinc-200">
                  {getTypeIcon(selectedCustomer?.customer_type)}
                </div>
                <div>
                  <SheetTitle className="text-2xl">{selectedCustomer?.name}</SheetTitle>
                  <SheetDescription className="text-zinc-500 mt-1 capitalize">
                    {(selectedCustomer?.customer_type || 'Retail').toLowerCase()} Customer
                  </SheetDescription>
                </div>
              </div>
              <div>{getTierBadge(selectedCustomer?.tier || 'STANDARD')}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="flex items-center text-sm text-zinc-600">
                <Phone className="w-4 h-4 mr-2 text-zinc-400" />
                {selectedCustomer?.phone || 'No phone'}
              </div>
              <div className="flex items-center text-sm text-zinc-600">
                <Mail className="w-4 h-4 mr-2 text-zinc-400" />
                {selectedCustomer?.email || 'No email'}
              </div>
              <div className="flex items-center text-sm text-zinc-600 col-span-2">
                <MapPin className="w-4 h-4 mr-2 text-zinc-400" />
                {selectedCustomer?.address || 'No address provided'}
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="overview" className="mt-6">
            <TabsList className="w-full justify-start border-b border-zinc-200 rounded-none bg-transparent p-0 h-auto space-x-6 overflow-x-auto">
              <TabsTrigger value="overview" className="border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:shadow-none rounded-none bg-transparent px-0 py-2">Overview</TabsTrigger>
              <TabsTrigger value="history" className="border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:shadow-none rounded-none bg-transparent px-0 py-2">Purchase History</TabsTrigger>
              <TabsTrigger value="credit" className="border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:shadow-none rounded-none bg-transparent px-0 py-2">Credit & Ledger</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-6 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-zinc-200 shadow-sm p-4">
                  <p className="text-sm text-zinc-500 font-medium">Current Balance</p>
                  <p className={`text-2xl font-bold font-mono mt-1 ${selectedCustomer?.balance > 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                    ${(selectedCustomer?.balance || 0).toFixed(2)}
                  </p>
                </Card>
                <Card className="border-zinc-200 shadow-sm p-4">
                  <p className="text-sm text-zinc-500 font-medium">Credit Limit</p>
                  <p className="text-2xl font-bold font-mono mt-1">${(selectedCustomer?.credit_limit || 0).toFixed(2)}</p>
                </Card>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">Recent Transactions</h4>
                <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                  <ShadcnTable>
                    <TableHeader className="bg-zinc-50">
                      <TableRow>
                         <TableHead>Date</TableHead>
                         <TableHead>Type</TableHead>
                         <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                         <TableCell colSpan={3} className="text-sm text-center text-zinc-500">No recent transactions.</TableCell>
                      </TableRow>
                    </TableBody>
                  </ShadcnTable>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="history" className="pt-6">
              <div className="text-center p-8 bg-zinc-50 border border-zinc-100 rounded-xl">
                <p className="text-zinc-500">Full purchase history will appear here.</p>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4 -mx-6 -mb-6 mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleDelete(selectedCustomer?.id)} className="text-red-600 border-red-200 hover:bg-red-50">Delete Customer</Button>
            <Button>New Order</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
