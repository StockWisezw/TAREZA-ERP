import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { ShoppingCart, Printer, ShieldCheck, Save, MonitorPlay, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { rawSupabase } from '../../lib/firebaseClient';

export function PosSettings() {
  const [isSaving, setIsSaving] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [initialOfflineMode, setInitialOfflineMode] = useState(false);
  const [strictInventory, setStrictInventory] = useState(false);
  const [requireFloat, setRequireFloat] = useState(false);
  const [pricingToggle, setPricingToggle] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('tareza_offline_mode');
    if (stored !== null) {
      const mode = stored === 'true';
      setOfflineMode(mode);
      setInitialOfflineMode(mode);
    }
    const strictStored = localStorage.getItem('tareza_strict_inventory');
    setStrictInventory(strictStored === 'true');
    const floatStored = localStorage.getItem('tareza_require_float');
    setRequireFloat(floatStored === 'true');
    const pricingStored = localStorage.getItem('tareza_pricing_toggle');
    setPricingToggle(pricingStored === null || pricingStored === 'true');
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('tareza_offline_mode', String(offlineMode));
      localStorage.setItem('tareza_strict_inventory', String(strictInventory));
      localStorage.setItem('tareza_require_float', String(requireFloat));
      localStorage.setItem('tareza_pricing_toggle', String(pricingToggle));
      
      // Register service worker if offline mode is enabled
      if (offlineMode && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then((registration) => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }).catch((err) => {
          console.log('ServiceWorker registration failed: ', err);
        });
      }

      const { data: fallbackB } = await rawSupabase.from('businesses').select('id').limit(1).maybeSingle();
      if (fallbackB?.id) {
        await rawSupabase.from('businesses').update({ updated_at: new Date().toISOString() }).eq('id', fallbackB.id);
      }

      toast.success('POS settings updated successfully. Reloading to apply changes...');
      
      // If toggled, reload the page to apply changes
      if (initialOfflineMode !== offlineMode) {
        setTimeout(() => {
          window.location.reload();
        }, 800);
      }
    } catch (err) {
      toast.error('Failed to update POS settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Point of Sale (POS) Settings</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Control terminal behaviors, receipt printing, and cashier restrictions.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-primary-foreground shadow-sm px-6">
          {isSaving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Config</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-zinc-200/60 shadow-sm md:col-span-2">
          <CardHeader className="pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <MonitorPlay className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-lg">Checkout Experience</CardTitle>
            </div>
            <CardDescription>Rules for scanning, pricing, options and completing sales at the terminal.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-zinc-100 bg-zinc-50/50">
                <div className="flex flex-col space-y-1">
                  <Label className="font-semibold text-zinc-900">Enable Retail / Wholesale Toggle</Label>
                  <span className="text-sm text-zinc-500">
                    Allow cashiers to switch pricing tiers for bulk shoppers.
                  </span>
                </div>
                <Switch checked={pricingToggle} onCheckedChange={setPricingToggle} />
              </div>

              <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-zinc-100 bg-zinc-50/50">
                <div className="flex flex-col space-y-1">
                  <Label className="font-semibold text-zinc-900">Auto-Return to Search</Label>
                  <span className="text-sm text-zinc-500">
                    Focus the search bar automatically after scanning an item.
                  </span>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-zinc-100 bg-zinc-50/50 md:col-span-2">
                <div className="flex flex-col space-y-1">
                  <Label className="font-semibold text-zinc-900">Enforce Strict Stock Levels</Label>
                  <span className="text-sm text-zinc-500">
                    Block transactions and output alerts if products in cart exceed available branch warehouse stocks. Keep of of stock selling simple by turning this off.
                  </span>
                </div>
                <Switch checked={strictInventory} onCheckedChange={setStrictInventory} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm">
          <CardHeader className="pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-lg">Till & Cash Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-50">
              <div className="flex flex-col space-y-1 pr-4">
                <Label className="font-semibold text-zinc-900">Require Floating Balance</Label>
                <span className="text-xs text-zinc-500 max-w-[200px]">
                  Cashiers must declare their opening floating cash before starting a shift.
                </span>
              </div>
              <Switch checked={requireFloat} onCheckedChange={setRequireFloat} />
            </div>
            
            <div className="flex items-center justify-between pb-4 border-b border-zinc-50">
              <div className="flex flex-col space-y-1 pr-4">
                <Label className="font-semibold text-zinc-900">Blind Closeout</Label>
                <span className="text-xs text-zinc-500 max-w-[200px]">
                  Hide system expected cash totals when closing till to force accurate counting.
                </span>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between pb-4 border-b border-zinc-50">
              <div className="flex flex-col space-y-1 pr-4">
                <Label className="font-semibold text-zinc-900">Require Manager PIN for Refunds</Label>
                <span className="text-xs text-zinc-500 max-w-[200px]">
                  Requires supervisor authorization to issue cash or card refunds.
                </span>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1 pr-4">
                <Label className="font-semibold text-zinc-900">Offline Fallback Mode</Label>
                <span className="text-xs text-zinc-500 max-w-[200px]">
                  Allow POS to continue operating without internet. Queues transactions and syncs in background via ServiceWorker when connectivity is restored.
                </span>
              </div>
              <Switch checked={offlineMode} onCheckedChange={setOfflineMode} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-zinc-200/60 shadow-sm">
          <CardHeader className="pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-lg">Receipt Operations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-50">
              <div className="flex flex-col space-y-1 pr-4">
                <Label className="font-semibold text-zinc-900">Auto-Print Receipts</Label>
                <span className="text-xs text-zinc-500 max-w-[200px]">
                  Automatically fire the thermal receipt printer when a transaction is completed.
                </span>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between pb-4 border-b border-zinc-50">
              <div className="flex flex-col space-y-1 pr-4">
                <Label className="font-semibold text-zinc-900">Print Store Logo</Label>
                <span className="text-xs text-zinc-500 max-w-[200px]">
                  Include the business logo at the top of the thermal receipt.
                </span>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1 pr-4">
                <Label className="font-semibold text-zinc-900">Print Return Barcode</Label>
                <span className="text-xs text-zinc-500 max-w-[200px]">
                  Print a scannable barcode at the bottom of the receipt for fast refunds.
                </span>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
