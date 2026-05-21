import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, CheckCircle, XCircle, Mail, MessageSquare, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { ThemeToggle } from '../components/ThemeToggle';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export default function DeveloperPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@tarezaerp.co.zw' && password === 'taps1302??') {
      setIsAuthenticated(true);
      fetchBusinesses();
    } else {
      toast.error("Invalid credentials.");
    }
  };

  const fetchBusinesses = async () => {
    setLoading(true);
    try {
      // Need to fetch all businesses for dev. 
      // This bypasses RLS if using service role, but since it's client side, we need standard fetch.
      // If RLS prevents it, this might return empty. I will add a fallback mock if it fails.
      const { data, error } = await supabase.from('businesses').select('*');
      if (error) {
        throw error;
      }
      setBusinesses(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load businesses. RLS might be blocking or network error.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSubscription = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'GRACE_PERIOD' : 'ACTIVE';
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ subscription_status: newStatus })
        .eq('id', id);
      
      if (error) throw error;

      toast.success(`Account status updated to ${newStatus}`);
      fetchBusinesses();
    } catch (err: any) {
      toast.error(`Failed to update account: ${err.message}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-16 h-16 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Developer Portal</CardTitle>
            <CardDescription>Enter admin credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <Input 
                   type="email" 
                   value={email} 
                   onChange={e => setEmail(e.target.value)} 
                   placeholder="admin@tarezaerp.33mail.com" 
                   required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input 
                   type="password" 
                   value={password} 
                   onChange={e => setPassword(e.target.value)} 
                   required
                />
              </div>
              <Button type="submit" className="w-full">Sign In</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-foreground flex flex-col">
      <nav className="w-full border-b bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold">Tareza Developer Panel</span>
        </div>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <Button variant="ghost" onClick={() => setIsAuthenticated(false)}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Accounts & Subscriptions</CardTitle>
              <CardDescription>Manage active tenants, activate or deactivate accounts.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-4 text-center text-sm text-zinc-500">Loading accounts...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {businesses.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-zinc-500 py-4">No businesses found or missing RLS bypass.</TableCell>
                        </TableRow>
                      )}
                      {businesses.map(b => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.name}</TableCell>
                          <TableCell>
                            <Badge variant={b.subscription_status === 'ACTIVE' || b.subscription_status === 'TRIAL' ? 'default' : 'destructive'} className="text-xs uppercase">
                              {b.subscription_status || 'UNKNOWN'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant={b.subscription_status === 'ACTIVE' ? 'destructive' : 'default'} 
                              size="sm"
                              onClick={() => toggleSubscription(b.id, b.subscription_status)}
                            >
                              {b.subscription_status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Support Queries</CardTitle>
              <CardDescription>Customer tickets and inquiries</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4">
                  {/* Mock Data for support queries as requested by "design where I answer querries" */}
                  {[
                    { id: 1, user: 'Acme Retail', subject: 'Fiscalisation Not Reaching Zimra', status: 'Pending', time: '10m ago' },
                    { id: 2, user: 'John Doe', subject: 'How to add a new branch?', status: 'Resolved', time: '2h ago' },
                  ].map(ticket => (
                    <div key={ticket.id} className="p-4 rounded-xl border border-border bg-card flex flex-col gap-2">
                       <div className="flex justify-between items-start">
                         <div className="space-y-1">
                           <h4 className="font-semibold text-sm">{ticket.subject}</h4>
                           <p className="text-xs text-muted-foreground">From: {ticket.user} • {ticket.time}</p>
                         </div>
                         <Badge variant={ticket.status === 'Pending' ? 'destructive' : 'secondary'} className="text-[10px] uppercase">
                            {ticket.status}
                         </Badge>
                       </div>
                       {ticket.status === 'Pending' && (
                         <div className="flex gap-2 mt-2">
                            <Input placeholder="Type your response..." className="h-8 text-sm" />
                            <Button size="sm" className="h-8">Reply</Button>
                         </div>
                       )}
                    </div>
                  ))}
               </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Licensing & Billing Setup</CardTitle>
              <CardDescription>Setup live licensing and payment webhooks</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-300">
                  <p>
                    Tareza ERP is currently using manual billing checks (checking the `subscription_status` field on the `businesses` table). To automate live licensing, you need to configure a webhook.
                  </p>
                  
                  <div className="p-4 border border-border rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                     <h4 className="font-bold text-zinc-900 dark:text-zinc-50 mb-2">1. Choose a Payment Gateway</h4>
                     <ul className="list-disc pl-5 space-y-1 mb-4">
                       <li><strong>Paynow / EcoCash</strong> - Best for local Zimbabwe RTGS/USD payments.</li>
                       <li><strong>Stripe</strong> - Best for international cards processing.</li>
                       <li><strong>Paystack</strong> - Good alternative for Africa-wide processing.</li>
                     </ul>
                     
                     <h4 className="font-bold text-zinc-900 dark:text-zinc-50 mb-2">2. Implement Webhook Endpoint</h4>
                     <p className="mb-2">
                       Set up a serverless function (e.g., using Supabase Edge Functions) to map payment events back to the database:
                     </p>
                     <pre className="bg-zinc-950 p-3 rounded-md text-xs text-green-400 overflow-x-auto">
{`// Supabase Edge Function to handle Paynow/Stripe Webhook
import { createClient } from '@supabase/supabase-js'

export async function handlePaymentWebhook(req) {
  const { business_id, status } = await req.json()
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  
  if(status === 'PAID') {
    await supabase.from('businesses')
      .update({ subscription_status: 'ACTIVE' })
      .eq('id', business_id)
  }
}`}
                     </pre>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20">
                     <h4 className="font-bold flex items-center gap-2 mb-2 text-indigo-900 dark:text-indigo-400">
                       <AlertCircle className="w-4 h-4" /> Next Steps to go Live
                     </h4>
                     <ol className="list-decimal pl-5 space-y-1">
                       <li>Create a Supabase Edge function for webhooks.</li>
                       <li>Provide the Edge function URL to your Paynow/Stripe dashboard.</li>
                       <li>Integrate the "Checkout" button on the billing page to redirect to the gateway.</li>
                     </ol>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
