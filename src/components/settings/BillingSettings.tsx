import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Check, AlertTriangle, CreditCard, ChevronRight, Download, HelpCircle } from 'lucide-react';
import { Table, TableHead, TableHeader, TableRow, TableCell, TableBody } from '../ui/table';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';

export function BillingSettings() {
  const [businessData, setBusinessData] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [userCount, setUserCount] = useState(1);
  
  useEffect(() => {
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      
      const { data: buData } = await supabase.from('business_users').select('business_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
      if (!buData) return;

      const { data: business } = await supabase.from('businesses').select('*').eq('id', buData.business_id).single();
      if (business) {
         setBusinessData(business);
         const { data: sub } = await supabase.from('subscriptions').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
         if (sub) setSubscription(sub);

         const { data: bUsers } = await supabase.from('business_users').select('id').eq('business_id', business.id);
         setUserCount(bUsers?.length || 1);
      }
    }
    loadData();
  }, []);

  const planStatus = businessData?.subscription_status === 'GRACE_PERIOD' ? 'GRACE_PERIOD' : subscription?.status === 'active' ? 'ACTIVE' : 'TRIAL';
  const expiresAt = businessData?.subscription_end_date ? new Date(businessData.subscription_end_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 
  const gracePeriodEnd = new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const daysLeftInGrace = Math.floor((gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const planName = subscription?.plan_name === 'free_trial' ? 'Free Trial' : subscription?.plan_name === 'starter' ? 'Starter' : subscription?.plan_name === 'pro' ? 'Consultancy Pro' : subscription?.plan_name === 'enterprise' ? 'Enterprise' : (subscription?.plan_name || 'Free Trial');
  const planNameRaw = subscription?.plan_name || 'free_trial';
  const maxUsers = planNameRaw === 'starter' ? 3 : planNameRaw === 'pro' ? 10 : planNameRaw === 'enterprise' ? 100 : (businessData?.max_users || 5);
  const planCost = planNameRaw === 'starter' ? '$15.00' : planNameRaw === 'pro' ? '$50.00' : planNameRaw === 'enterprise' ? '$99.00' : '$0.00';
  const userPercent = Math.min((userCount / maxUsers) * 100, 100);

  
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Billing & Subscription</h3>
          <p className="text-sm text-zinc-500 mt-1">Manage your subscription plan, branches, and user limits.</p>
        </div>
        <Button variant="outline" className="text-zinc-600" onClick={() => window.location.href = 'mailto:admin@tarezaerp.co.zw?subject=Billing Support - Tareza ERP'}>
          <HelpCircle className="w-4 h-4 mr-2" /> Billing Support
        </Button>
      </div>

      <Card className={`border shadow-sm overflow-hidden ${planStatus === 'GRACE_PERIOD' ? 'border-amber-200/60 bg-amber-50/30' : 'border-zinc-200/60 bg-white'}`}>
        <CardHeader className="pb-4 border-b border-zinc-100/50 bg-white">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">Subscription Overview</CardTitle>
                <Badge variant={planStatus === 'ACTIVE' || planStatus === 'TRIAL' ? 'default' : 'destructive'} className={`${planStatus === 'GRACE_PERIOD' ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100' : ''} uppercase tracking-wider text-[10px]`}>
                  {planStatus === 'GRACE_PERIOD' ? 'Payment Overdue' : planStatus === 'TRIAL' ? 'Trial' : 'Active'}
                </Badge>
              </div>
              <CardDescription className={planStatus === 'GRACE_PERIOD' ? "text-amber-700 font-medium mt-1.5 flex items-center" : "mt-1.5"}>
                {planStatus === 'GRACE_PERIOD' ? (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-1.5" /> 
                    Grace period ends in {daysLeftInGrace} days. System will lock automatically.
                  </>
                ) : (
                  `Your subscription expires on ${expiresAt.toLocaleDateString()}.`
                )}
              </CardDescription>
            </div>
            <Button variant="outline" className="shrink-0 bg-white shadow-sm border-zinc-200 hover:bg-zinc-50">
               <CreditCard className="w-4 h-4 mr-2 text-zinc-400" /> Manage Payment Method
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
           <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100 bg-white">
              <div className="p-6 flex flex-col justify-center">
                 <p className="text-sm font-medium text-zinc-500 mb-1">Current Plan</p>
                 <div className="flex items-end gap-2">
                   <h4 className="text-2xl font-bold text-zinc-900 capitalize">{planName}</h4>
                 </div>
              </div>
              <div className="p-6 flex flex-col justify-center">
                 <p className="text-sm font-medium text-zinc-500 mb-1">Seat Usage</p>
                 <div className="flex items-end gap-2">
                   <h4 className="text-2xl font-bold text-zinc-900">{userCount} <span className="text-lg font-medium text-zinc-400">/ {maxUsers}</span></h4>
                 </div>
                 <div className="w-full h-1.5 bg-zinc-100 rounded-full mt-3 overflow-hidden">
                    <div className={"h-full rounded-full " + (userPercent > 80 ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${userPercent}%` }} />
                 </div>
              </div>
              <div className="p-6 flex flex-col justify-center">
                 <p className="text-sm font-medium text-zinc-500 mb-1">Billing Cycle</p>
                 <div className="flex items-end gap-2">
                   <h4 className="text-xl font-bold text-zinc-900">{planCost} <span className="text-xs font-semibold text-zinc-400">/mo</span></h4>
                 </div>
                 <p className="text-xs text-zinc-500 mt-2 font-medium">Billed on the 1st of every month.</p>
              </div>
           </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-widest px-1">Available Plans</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="relative overflow-hidden border-zinc-200 shadow-sm flex flex-col">
            <CardHeader className="bg-zinc-50/50 pb-6 border-b border-zinc-100">
              <CardTitle className="text-lg font-bold text-zinc-800">Starter</CardTitle>
              <div className="mt-4 flex items-baseline text-4xl font-extrabold text-zinc-900 tracking-tight">
                $15
                <span className="ml-1 text-base font-medium text-zinc-500">/mo</span>
              </div>
              <CardDescription className="pt-3 text-zinc-600 leading-relaxed font-medium">Perfect for small, single-location shops or kiosks.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 flex-1">
              <ul className="space-y-3 shrink-0 text-sm">
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 font-medium">1 Branch / Warehouse</span></li>
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 font-medium">3 User Accounts</span></li>
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 font-medium">Core POS & Inventory</span></li>
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 font-medium">Standard Support</span></li>
              </ul>
            </CardContent>
            <CardFooter className="pt-6 border-t border-zinc-100">
              <Button variant="outline" className="w-full border-zinc-200 text-zinc-700 hover:bg-zinc-50" onClick={() => toast("Redirecting to Paynow checkout...")}>Downgrade to Starter</Button>
            </CardFooter>
          </Card>

          <Card className="relative overflow-hidden border-primary/50 shadow-md flex flex-col scale-[1.02] bg-white ring-1 ring-primary/20">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 uppercase tracking-widest rounded-bl-lg">
              Current Plan
            </div>
            <CardHeader className="bg-primary/5 pb-6 border-b border-primary/10">
              <CardTitle className="text-lg font-bold text-primary">Consultancy Pro</CardTitle>
              <div className="mt-4 flex items-baseline text-4xl font-extrabold text-zinc-900 tracking-tight">
                $50
                <span className="ml-1 text-base font-medium text-zinc-500">/mo</span>
              </div>
              <CardDescription className="pt-3 text-zinc-600 leading-relaxed font-medium">Physical stocktake support plus total Cloud ERP access.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 flex-1">
              <ul className="space-y-3 shrink-0 text-sm">
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary shrink-0" /> <span className="text-zinc-800 font-medium">1 Monthly On-Site Visit (Stocktake)</span></li>
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary shrink-0" /> <span className="text-zinc-800 font-medium">Up to 3 Branches / Warehouses</span></li>
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary shrink-0" /> <span className="text-zinc-800 font-medium">Up to 10 User Accounts</span></li>
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-primary shrink-0" /> <span className="text-zinc-800 font-medium">ZIMRA & universal tax readiness</span></li>
              </ul>
            </CardContent>
            <CardFooter className="pt-6 border-t border-primary/10">
              <Button className="w-full font-semibold shadow-sm" disabled>Current Plan</Button>
            </CardFooter>
          </Card>

          <Card className="relative overflow-hidden border-zinc-200 shadow-sm flex flex-col">
            <CardHeader className="bg-zinc-50/50 pb-6 border-b border-zinc-100">
              <CardTitle className="text-lg font-bold text-zinc-800">Enterprise</CardTitle>
              <div className="mt-4 flex items-baseline text-4xl font-extrabold text-zinc-900 tracking-tight">
                $99
                <span className="ml-1 text-base font-medium text-zinc-500">/mo</span>
              </div>
              <CardDescription className="pt-3 text-zinc-600 leading-relaxed font-medium">Unlimited limits for huge volume operations.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 flex-1">
              <ul className="space-y-3 shrink-0 text-sm">
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 font-medium">Unlimited Branches</span></li>
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 font-medium">Unlimited Users</span></li>
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 font-medium">Custom API Access</span></li>
                <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 font-medium">Priority 24/7 Support</span></li>
              </ul>
            </CardContent>
            <CardFooter className="pt-6 border-t border-zinc-100">
              <Button className="w-full bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm" onClick={() => toast("Redirecting to Paynow checkout...")}>Upgrade to Enterprise</Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Card className="border-zinc-200/60 shadow-sm overflow-hidden">
         <CardHeader className="pb-4 border-b border-zinc-100 bg-zinc-50/50">
           <CardTitle className="text-lg">Billing History</CardTitle>
           <CardDescription>View and download past invoices.</CardDescription>
         </CardHeader>
         <div className="overflow-x-auto">
            <Table>
               <TableHeader className="bg-zinc-50/50">
                  <TableRow>
                     <TableHead className="w-[150px]">Date</TableHead>
                     <TableHead>Invoice ID</TableHead>
                     <TableHead>Amount</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="text-right">Download</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  <TableRow className="group hover:bg-zinc-50/50">
                     <TableCell className="font-medium text-zinc-900">Oct 1, 2024</TableCell>
                     <TableCell className="text-zinc-500 font-mono text-sm">INV-2024-0042</TableCell>
                     <TableCell className="text-zinc-800 font-medium">$40.00</TableCell>
                     <TableCell><Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">Paid</Badge></TableCell>
                     <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900"><Download className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
                  <TableRow className="group hover:bg-zinc-50/50">
                     <TableCell className="font-medium text-zinc-900">Sep 1, 2024</TableCell>
                     <TableCell className="text-zinc-500 font-mono text-sm">INV-2024-0038</TableCell>
                     <TableCell className="text-zinc-800 font-medium">$40.00</TableCell>
                     <TableCell><Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">Paid</Badge></TableCell>
                     <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900"><Download className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
               </TableBody>
            </Table>
         </div>
      </Card>
    </div>
  );
}
