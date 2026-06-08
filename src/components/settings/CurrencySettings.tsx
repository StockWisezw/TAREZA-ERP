import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Plus, ArrowRightLeft, TrendingUp, RefreshCcw, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { rawSupabase, supabase } from '../../lib/firebaseClient';
import { syncRBZExchangeRates, Currency } from '../../services/currencyService';
import { logAuditEvent } from '../../services/ledgerService';

export function CurrencySettings() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [rbzDailySync, setRbzDailySync] = useState(localStorage.getItem('rbz_daily_sync') !== 'false');

  useEffect(() => {
    async function loadCurrencies() {
      try {
        setLoading(true);
        // Load currencies without forcing API hits
        const res = await syncRBZExchangeRates(false);
        if (res.success && res.data) {
          setCurrencies(res.data);
        } else {
          // Fallback to fetching directly if sync reports an issue
          const { data: userData } = await supabase.auth.getUser();
          let businessId: string | null = null;
          if (userData?.user) {
            const { data: busUser } = await supabase
              .from('business_users')
              .select('business_id')
              .eq('user_id', userData.user.id)
              .limit(1)
              .maybeSingle();
            businessId = busUser?.business_id || null;
          }
          if (!businessId) {
            const { data: fallbackB } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
            businessId = fallbackB?.id || null;
          }
          if (businessId) {
            const { data: dbCurrencies } = await supabase
              .from('currencies')
              .select('*')
              .eq('business_id', businessId);
            if (dbCurrencies && dbCurrencies.length > 0) {
              setCurrencies(dbCurrencies as Currency[]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load currencies in settings:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCurrencies();
  }, []);

  const handleSyncNow = async () => {
    setIsUpdating(true);
    const syncToast = toast.loading('Syncing latest exchange rates with RBZ and open market rate feeds...');
    try {
      const res = await syncRBZExchangeRates(true);
      if (res.success && res.data) {
        setCurrencies(res.data);
        toast.success('Exchange rates synchronized successfully', { id: syncToast });
      } else {
        toast.error(res.error || 'Sync failed', { id: syncToast });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Sync operation failed', { id: syncToast });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleSync = (checked: boolean) => {
    setRbzDailySync(checked);
    localStorage.setItem('rbz_daily_sync', checked ? 'true' : 'false');
    toast.success(
      checked 
        ? 'Automatic RBZ Daily Sync scheduled at 08:00 AM' 
        : 'Automatic RBZ Daily Sync disabled'
    );
  };

  const handleEdit = (id: string, currentRate: number) => {
    setEditingId(id);
    setEditRate(currentRate.toString());
  };

  const handleSave = async (id: string, code: string, oldRate: number) => {
    if (!editRate || isNaN(Number(editRate)) || Number(editRate) <= 0) {
      toast.error('Please enter a valid rate greater than 0');
      return;
    }

    setIsUpdating(true);
    try {
      const targetRate = parseFloat(editRate);
      
      // Update local storage checkpoint policy
      localStorage.setItem('tareza_currencies_policy', JSON.stringify({
        updated_at: new Date().toISOString()
      }));

      // Update in Supabase Database
      const { error: dbError } = await supabase
        .from('currencies')
        .update({ exchange_rate: targetRate })
        .eq('id', id);

      if (dbError) throw dbError;

      // Add to exchange rate history in Supabase
      await supabase.from('exchange_rate_history').insert({
        currency_id: id,
        rate: targetRate,
        effective_date: new Date().toISOString()
      });

      // Log in audit trail
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || '00000000-0000-0000-0000-000000000000';
      let businessId: string | null = null;
      if (userData?.user) {
        const { data: busUser } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();
        businessId = busUser?.business_id || null;
      }
      if (!businessId) {
        const { data: fallbackB } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
        businessId = fallbackB?.id || null;
      }

      if (businessId) {
        await logAuditEvent(
          businessId,
          userId,
          'ADJUST',
          'SYSTEM',
          { currency: code, old_exchange_rate: oldRate, source: 'Manual adjustments panel' },
          { currency: code, new_exchange_rate: targetRate, source: 'Manual adjustments panel' }
        );

        // Touch business updated_at
        await rawSupabase.from('businesses').update({ updated_at: new Date().toISOString() }).eq('id', businessId);
      }

      // Update local React state
      setCurrencies(prev => prev.map(c => c.id === id ? { ...c, exchange_rate: targetRate } : c));
      setEditingId(null);
      toast.success(`Exchange rate for ${code} updated successfully`);

    } catch (err: any) {
      console.error('Error saving manual exchange rate edit:', err);
      toast.error('Failed to update exchange rate: ' + (err?.message || 'Database error'));
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-500 bg-white rounded-xl border border-zinc-200">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500 mb-2" />
        <p className="text-sm font-medium">Loading Multi-Currency Configuration...</p>
      </div>
    );
  }

  const baseCurrency = currencies.find(c => c.is_base) || { symbol: '$', code: 'USD', name: 'US Dollar' };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Multi-Currency Engine</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Configure exchange rates, base currency, and payment preferences.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white border-zinc-200"
            onClick={handleSyncNow}
            disabled={isUpdating}
          >
            <RefreshCcw className={`mr-2 h-4 w-4 text-zinc-500 ${isUpdating ? 'animate-spin' : ''}`} /> Sync Market Rates
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Add Currency
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-zinc-200/60 shadow-sm overflow-hidden group hover:border-zinc-300 transition-colors">
          <div className="h-1 bg-primary/20 group-hover:bg-primary/40 transition-colors" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <CardTitle className="text-lg">Base Currency</CardTitle>
            </div>
            <CardDescription>Primary currency for all accounting & reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="font-bold text-2xl text-zinc-800">{baseCurrency.symbol}</div>
                <div>
                  <div className="font-semibold text-zinc-900">{baseCurrency.code} - {baseCurrency.name}</div>
                  <div className="text-xs text-zinc-500 font-mono">System Default</div>
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Automation</CardTitle>
            <CardDescription>Manage how exchange rates are updated</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="flex flex-col space-y-1">
                <Label className="text-sm font-semibold">RBZ Daily Sync</Label>
                <span className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">
                  Automatically fetch and apply RBZ mid-rates every morning at 08:00 AM.
                </span>
              </div>
              <Switch checked={rbzDailySync} onCheckedChange={handleToggleSync} />
            </div>
            <div className="flex items-center justify-between space-x-2">
              <div className="flex flex-col space-y-1">
                <Label className="text-sm font-semibold">Allow POS Overrides</Label>
                <span className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">
                  Let cashiers manually adjust exchange rates during checkout.
                </span>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200/60 shadow-sm">
        <CardHeader className="pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-zinc-400" />
            <CardTitle className="text-lg">Exchange Rates Configuration</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow>
                <TableHead className="w-[80px]">Code</TableHead>
                <TableHead>Currency Name</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="w-[180px]">Exchange Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.map(c => (
                <TableRow key={c.id} className="group">
                  <TableCell className="font-bold text-zinc-900">
                    {c.code}
                  </TableCell>
                  <TableCell className="font-medium text-zinc-600">
                    {c.name}
                    {c.is_base && <Badge className="ml-2 bg-primary/10 text-primary border-0 hover:bg-primary/20 text-[10px] py-0">BASE</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-zinc-500">{c.symbol}</TableCell>
                  <TableCell>
                    {editingId === c.id ? (
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number" 
                          step="0.0001" 
                          value={editRate} 
                          onChange={(e) => setEditRate(e.target.value)}
                          className="h-8 w-28 text-sm font-mono text-right border-zinc-300"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <span className="font-mono font-medium text-zinc-800">
                        {c.is_base ? '1.0000' : Number(c.exchange_rate).toFixed(4)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${c.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-xs font-medium text-zinc-600">{c.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === c.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 text-zinc-500" onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button size="sm" className="h-8 bg-zinc-900 text-white hover:bg-zinc-800" onClick={() => handleSave(c.id, c.code, Number(c.exchange_rate))} disabled={isUpdating}>
                          <Save className="w-3 h-3 mr-1" /> Save
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 opacity-0 group-hover:opacity-100 transition-opacity" 
                        disabled={c.is_base}
                        onClick={() => handleEdit(c.id, Number(c.exchange_rate))}
                      >
                        Edit Rate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {currencies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-zinc-400 py-6">
                    No currencies configured. Click "Sync Market Rates" above to seed.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
