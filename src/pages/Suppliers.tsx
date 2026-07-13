import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { SupplierDashboard } from '../components/suppliers/SupplierDashboard';
import { SupplierDirectory } from '../components/suppliers/SupplierDirectory';
import { Procurement } from '../components/suppliers/Procurement';
import GoodsReceiving from '../components/suppliers/GoodsReceiving';
import { SupplierPayables } from '../components/suppliers/SupplierPayables';
import { Button } from '../components/ui/button';
import { Download, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Suppliers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'dashboard');

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };

  const handleNewPOClick = () => {
    handleTabChange('procurement');
    toast.success('Switched to Purchases tab. Please click "Create PO" to add a new Purchase Order details.');
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Procurement & Suppliers</h2>
          <p className="text-zinc-500 mt-1">Manage suppliers, purchase orders, receiving, and payables.</p>
        </div>
        <div className="flex space-x-2 w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => toast.info('Export options are available inside individual table exports.')}><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button className="w-full sm:w-auto" onClick={handleNewPOClick}><Plus className="mr-2 h-4 w-4" /> New Purchase Order</Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-zinc-100/80 p-1 rounded-xl w-full justify-start overflow-x-auto border border-zinc-200/50 hidden sm:inline-flex mb-6 h-12">
          <TabsTrigger value="dashboard" className="rounded-lg px-6 h-10 data-[state=active]:shadow-sm">Dashboard</TabsTrigger>
          <TabsTrigger value="procurement" className="rounded-lg px-6 h-10 data-[state=active]:shadow-sm">Procurement (POs)</TabsTrigger>
          <TabsTrigger value="receiving" className="rounded-lg px-6 h-10 data-[state=active]:shadow-sm">Goods Receiving</TabsTrigger>
          <TabsTrigger value="payables" className="rounded-lg px-6 h-10 data-[state=active]:shadow-sm">Payables & Statements</TabsTrigger>
          <TabsTrigger value="directory" className="rounded-lg px-6 h-10 data-[state=active]:shadow-sm">Supplier Directory</TabsTrigger>
        </TabsList>
        
        {/* Mobile quick tabs */}
        <div className="sm:hidden grid grid-cols-2 gap-2 mb-6">
          <Button variant={activeTab === 'dashboard' ? 'default' : 'outline'} onClick={() => handleTabChange('dashboard')} className="w-full text-xs h-9">Dashboard</Button>
          <Button variant={activeTab === 'procurement' ? 'default' : 'outline'} onClick={() => handleTabChange('procurement')} className="w-full text-xs h-9">Purchases</Button>
          <Button variant={activeTab === 'receiving' ? 'default' : 'outline'} onClick={() => handleTabChange('receiving')} className="w-full text-xs h-9">Receiving</Button>
          <Button variant={activeTab === 'payables' ? 'default' : 'outline'} onClick={() => handleTabChange('payables')} className="w-full text-xs h-9">Payables</Button>
        </div>

        <div className="animate-in fade-in duration-500">
          <TabsContent value="dashboard" className="mt-0 outline-none">
            <SupplierDashboard />
          </TabsContent>
          
          <TabsContent value="procurement" className="mt-0 outline-none">
            <Procurement />
          </TabsContent>

          <TabsContent value="receiving" className="mt-0 outline-none">
            <GoodsReceiving />
          </TabsContent>
          
          <TabsContent value="payables" className="mt-0 outline-none">
            <SupplierPayables />
          </TabsContent>

          <TabsContent value="directory" className="mt-0 outline-none">
            <SupplierDirectory />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
