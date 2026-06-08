import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ShoppingBag, CreditCard, FileSpreadsheet, Key, Play } from 'lucide-react';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { rawSupabase } from '../../lib/firebaseClient';

export function IntegrationSettings() {
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  const handleConnect = async (id: string) => {
    setIsConnecting(id);
    try {
      localStorage.setItem('tareza_integration_state', JSON.stringify({
        last_id: id,
        updated_at: new Date().toISOString()
      }));

      const { data: fallbackB } = await rawSupabase.from('businesses').select('id').limit(1).maybeSingle();
      if (fallbackB?.id) {
        await rawSupabase.from('businesses').update({ updated_at: new Date().toISOString() }).eq('id', fallbackB.id);
      }

      toast.info(`OAuth flow for ${id} would begin here.`);
    } catch (err) {
      toast.error('Failed to update integration settings');
    } finally {
      setIsConnecting(null);
    }
  };

  const integrations = [
    { id: '1', name: 'InnBucks Merchant', type: 'Payment Gateway', status: 'connected', icon: <CreditCard className="w-5 h-5 text-indigo-500" />, desc: 'Process InnBucks mobile wallet payments in POS.' },
    { id: '2', name: 'EcoCash Biller', type: 'Payment Gateway', status: 'available', icon: <CreditCard className="w-5 h-5 text-emerald-500" />, desc: 'Direct EcoCash merchant integration.' },
    { id: '3', name: 'WooCommerce', type: 'E-commerce', status: 'available', icon: <ShoppingBag className="w-5 h-5 text-purple-500" />, desc: 'Sync inventory and sales with your web store.' },
    { id: '4', name: 'Xero', type: 'Accounting', status: 'available', icon: <FileSpreadsheet className="w-5 h-5 text-blue-400" />, desc: 'Push daily journals and reconciliations to Xero.' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Integrations</h3>
          <p className="text-sm text-zinc-500 mt-1">Connect third-party services, payment gateways, and accounting software.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-zinc-200/60 shadow-sm md:col-span-2">
          <CardHeader className="pb-4 border-b border-zinc-100 bg-zinc-50/50">
             <CardTitle className="text-lg">Connected & Available Services</CardTitle>
             <CardDescription>Manage active API integrations and webhooks.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            <div className="divide-y divide-zinc-100">
               {integrations.map((init) => (
                 <div key={init.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-white border border-zinc-100 shadow-sm rounded-xl">
                        {init.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-zinc-900">{init.name}</h4>
                          {init.status === 'connected' ? (
                             <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 uppercase tracking-widest text-[10px]">Connected</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-zinc-500 mt-1">{init.desc}</p>
                        <p className="text-xs font-medium text-zinc-400 mt-1 uppercase tracking-wider">{init.type}</p>
                      </div>
                    </div>
                    <div>
                      {init.status === 'connected' ? (
                        <Button variant="outline" size="sm" className="w-[120px] text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900">
                          Configure
                        </Button>
                      ) : (
                        <Button onClick={() => handleConnect(init.id)} disabled={isConnecting === init.id} size="sm" className="w-[120px] bg-zinc-900 text-white shadow-sm hover:bg-zinc-800">
                          {isConnecting === init.id ? 'Connecting...' : 'Connect'}
                        </Button>
                      )}
                    </div>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm md:col-span-2 bg-gradient-to-br from-indigo-50/30 to-purple-50/30">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-500" />
              <CardTitle className="text-lg">Developer API Access</CardTitle>
            </div>
            <CardDescription>Generate API keys to build custom integrations with Tareza ERP.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="p-6 border border-indigo-100 bg-white rounded-xl flex items-center justify-between">
                <div>
                  <h5 className="font-semibold text-zinc-900 border-b border-zinc-100 pb-2 mb-2">Private Access Token</h5>
                  <div className="font-mono text-zinc-400 select-all sm:text-sm text-xs truncate max-w-[200px] sm:max-w-md">
                    trz_live_***********************************
                  </div>
                </div>
                <Button variant="outline" size="sm" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">Generate New Key</Button>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
