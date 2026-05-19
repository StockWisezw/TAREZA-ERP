import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Plus, Calculator, Edit2, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export function TaxationSettings() {
  const [isAdding, setIsAdding] = useState(false);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vatEnabled, setVatEnabled] = useState(false);

  useEffect(() => {
    fetchTaxRates();
    const storedVat = localStorage.getItem('tareza_vat_enabled');
    if (storedVat !== null) {
      setVatEnabled(storedVat === 'true');
    }
  }, []);

  const fetchTaxRates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tax_rates')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setTaxRates(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load tax rates');
    } finally {
      setLoading(false);
    }
  };

  const toggleVat = (enabled: boolean) => {
    setVatEnabled(enabled);
    localStorage.setItem('tareza_vat_enabled', String(enabled));
    toast.success(enabled ? 'VAT calculation enabled' : 'VAT calculation disabled');
  };

  const handleAdd = () => {
    setIsAdding(true);
    setTimeout(() => {
      setIsAdding(false);
      toast.info('Tax rate form will open here.');
    }, 400);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Taxation & VAT Configuration</h3>
           <p className="text-sm text-zinc-500 mt-1">
             Manage your tax rules, calculation methods, and VAT rates.
           </p>
        </div>
        <Button onClick={handleAdd} disabled={isAdding} className="bg-primary text-primary-foreground shadow-sm">
           <Plus className="mr-2 h-4 w-4" /> Add Tax Rate
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="border-zinc-200/60 shadow-sm h-full">
            <CardHeader className="pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-zinc-400" />
                <CardTitle className="text-lg">Tax Engine Settings</CardTitle>
              </div>
              <CardDescription className="mt-1">Global tax calculation preferences</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                  <div className="flex flex-col space-y-1">
                    <Label className="font-semibold text-zinc-900">Enable VAT</Label>
                    <span className="text-xs text-zinc-500">
                      Compute VAT for sales and purchases.
                    </span>
                  </div>
                  <Switch checked={vatEnabled} onCheckedChange={toggleVat} />
                </div>
                <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                  <div className="flex flex-col space-y-1">
                    <Label className="font-semibold text-zinc-900">Tax Inclusive Pricing</Label>
                    <span className="text-xs text-zinc-500">
                      Prices entered in the system already include tax.
                    </span>
                  </div>
                  <Switch defaultChecked disabled={!vatEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col space-y-1">
                    <Label className="font-semibold text-zinc-900">Enable Multiple Tax Types on Items</Label>
                    <span className="text-xs text-zinc-500">
                      Allow applying more than one tax rate to a single product.
                    </span>
                  </div>
                  <Switch disabled={!vatEnabled} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className={`border-zinc-200/60 shadow-sm overflow-hidden h-full ${!vatEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <CardHeader className="pb-4 border-b border-zinc-100 bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-zinc-400" />
                <CardTitle className="text-lg">Configured Tax Rates</CardTitle>
              </div>
              <CardDescription className="mt-1">Defined tax rates mapped to ZIMRA FDMS requirements.</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-50/50">
                  <TableRow>
                     <TableHead className="w-[200px]">Name</TableHead>
                     <TableHead>Rate (%)</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-zinc-500">
                         Loading...
                      </TableCell>
                    </TableRow>
                  ) : taxRates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-zinc-500">
                         No tax rates configured.
                      </TableCell>
                    </TableRow>
                  ) : taxRates.map(tax => (
                    <TableRow key={tax.id} className="group hover:bg-zinc-50/50 transition-colors">
                      <TableCell className="font-semibold text-zinc-900">
                         <div className="flex items-center gap-2">
                           {tax.name}
                           {tax.is_default && <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 text-[10px] tracking-wider uppercase">Default</Badge>}
                         </div>
                      </TableCell>
                      <TableCell className="font-mono text-zinc-700 font-medium">
                         {Number(tax.rate).toFixed(2)}%
                      </TableCell>
                      <TableCell>
                         <Badge className={`${tax.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                           {tax.is_active ? "Active" : "Inactive"}
                         </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                         <Button variant="outline" size="sm" className="h-8 border-zinc-200 text-zinc-700 hover:bg-zinc-100">
                            <Edit2 className="w-3 h-3 mr-1.5" /> Edit
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
