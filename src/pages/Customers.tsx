import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { CustomerDashboard } from '../components/customers/CustomerDashboard';
import { CustomerDirectory } from '../components/customers/CustomerDirectory';
import { CreditManagement } from '../components/customers/CreditManagement';
import { Button } from '../components/ui/button';
import { Download, Plus } from 'lucide-react';

export default function Customers() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Customers (CRM)</h2>
          <p className="text-zinc-500 mt-1">Manage relationships, credit accounts, and loyalty programs.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-zinc-100/80 p-1 rounded-xl w-full justify-start overflow-x-auto border border-zinc-200/50 hidden sm:inline-flex mb-6 h-12">
          <TabsTrigger value="dashboard" className="rounded-lg px-6 h-10 data-[state=active]:shadow-sm">Dashboard</TabsTrigger>
          <TabsTrigger value="directory" className="rounded-lg px-6 h-10 data-[state=active]:shadow-sm">Directory</TabsTrigger>
          <TabsTrigger value="credit" className="rounded-lg px-6 h-10 data-[state=active]:shadow-sm">Credit & Receivables</TabsTrigger>
          <TabsTrigger value="loyalty" className="rounded-lg px-6 h-10 data-[state=active]:shadow-sm">Loyalty & Rewards</TabsTrigger>
          <TabsTrigger value="communications" className="rounded-lg px-6 h-10 data-[state=active]:shadow-sm">Communications</TabsTrigger>
        </TabsList>
        
        {/* Mobile quick tabs */}
        <div className="sm:hidden grid grid-cols-2 gap-2 mb-6">
          <Button variant={activeTab === 'dashboard' ? 'default' : 'outline'} onClick={() => setActiveTab('dashboard')} className="w-full text-xs h-9">Dashboard</Button>
          <Button variant={activeTab === 'directory' ? 'default' : 'outline'} onClick={() => setActiveTab('directory')} className="w-full text-xs h-9">Directory</Button>
          <Button variant={activeTab === 'credit' ? 'default' : 'outline'} onClick={() => setActiveTab('credit')} className="w-full text-xs h-9">Credit</Button>
          <Button variant={activeTab === 'loyalty' ? 'default' : 'outline'} onClick={() => setActiveTab('loyalty')} className="w-full text-xs h-9">Loyalty</Button>
        </div>

        <div className="animate-in fade-in duration-500">
          <TabsContent value="dashboard" className="mt-0 outline-none">
            <CustomerDashboard />
          </TabsContent>
          
          <TabsContent value="directory" className="mt-0 outline-none">
            <CustomerDirectory />
          </TabsContent>
          
          <TabsContent value="credit" className="mt-0 outline-none">
            <CreditManagement />
          </TabsContent>

          <TabsContent value="loyalty" className="mt-0 outline-none">
            <div className="p-12 text-center border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">Loyalty & Rewards</h3>
              <p className="text-zinc-500 max-w-md mx-auto">Manage customer tiers, loyalty points, and cashbacks. Reward your best customers.</p>
              <Button className="mt-6">Configure Loyalty Program</Button>
            </div>
          </TabsContent>

          <TabsContent value="communications" className="mt-0 outline-none">
            <div className="p-12 text-center border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">Customer Communications</h3>
              <p className="text-zinc-500 max-w-md mx-auto">Send SMS, WhatsApp, and email campaigns. Automate payment reminders.</p>
              <Button className="mt-6">Create Campaign</Button>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
