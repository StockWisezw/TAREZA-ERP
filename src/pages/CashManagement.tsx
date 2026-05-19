import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Lock, Unlock, DollarSign, Calculator, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function CashManagement() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [expectedCash, setExpectedCash] = useState(1243.50);
  const [countedCash, setCountedCash] = useState(0);
  const [notes, setNotes] = useState('');

  const variance = countedCash - expectedCash;

  const handleCloseRegister = () => {
    if (countedCash === 0) {
      toast.error('Please enter the counted cash amount before closing.');
      return;
    }

    if (Math.abs(variance) > 0 && !notes) {
      toast.error('Variance detected. Please provide an explanation in the notes.');
      return;
    }

    setIsDrawerOpen(false);
    toast.success('Register successfully closed for the day.');
  };

  const handleOpenRegister = () => {
    setIsDrawerOpen(true);
    setCountedCash(0);
    setNotes('');
    toast.success('Register successfully opened for the new shift.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Cash Management</h2>
          <p className="text-zinc-500 mt-1">Manage shift registers, cash counts, and till variances.</p>
        </div>
        <Badge variant="outline" className={`px-3 py-1 ${isDrawerOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
           {isDrawerOpen ? <><Unlock className="w-3 h-3 mr-2" /> Register Open</> : <><Lock className="w-3 h-3 mr-2" /> Register Closed</>}
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>End of Day Cash Count</CardTitle>
            <CardDescription>Reconcile cash drawer at the end of your shift.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="bg-zinc-50 p-4 rounded-lg flex justify-between items-center border">
                <span className="font-semibold text-zinc-700">Expected Cash in Drawer</span>
                <span className="text-xl font-bold font-mono text-zinc-900">${expectedCash.toFixed(2)}</span>
             </div>

             <div className="space-y-2">
                <Label htmlFor="counted">Actual Counted Cash</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                  <Input 
                    id="counted" 
                    type="number" 
                    placeholder="0.00" 
                    className="pl-10 text-lg font-mono"
                    value={countedCash || ''}
                    onChange={(e) => setCountedCash(parseFloat(e.target.value) || 0)}
                    disabled={!isDrawerOpen}
                  />
                </div>
             </div>

             {countedCash > 0 && (
                <div className={`p-4 rounded-lg flex items-start gap-3 border ${variance === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                   {variance === 0 ? (
                     <div className="flex-1">
                        <p className="font-semibold text-emerald-800">Perfect Match</p>
                        <p className="text-sm text-emerald-700 mt-1">Expected and counted amounts balance perfectly.</p>
                     </div>
                   ) : (
                     <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                           <p className="font-semibold text-amber-800 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" /> Variance Detected
                           </p>
                           <span className="font-bold font-mono text-amber-900">
                             {variance > 0 ? '+' : ''}${variance.toFixed(2)}
                           </span>
                        </div>
                        <p className="text-sm text-amber-700">
                          {variance > 0 ? 'Drawer is over.' : 'Drawer is short.'} Please provide a reason below.
                        </p>
                     </div>
                   )}
                </div>
             )}

             <div className="space-y-2">
                <Label htmlFor="notes">End of Shift Notes</Label>
                <textarea 
                  id="notes" 
                  rows={3} 
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter any notes about variances, refunds, or anomalies..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!isDrawerOpen}
                />
             </div>

             {isDrawerOpen ? (
                <Button className="w-full bg-zinc-900 text-white hover:bg-zinc-800" onClick={handleCloseRegister}>
                  <Calculator className="w-4 h-4 mr-2" /> Close Register
                </Button>
             ) : (
                <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleOpenRegister}>
                  <Unlock className="w-4 h-4 mr-2" /> Open New Register
                </Button>
             )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Shift Logs</CardTitle>
            <CardDescription>History of cash movements and register closures.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                <div className="flex justify-between items-center p-3 border rounded-lg bg-zinc-50/50">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-200 rounded-full"><FileText className="w-4 h-4 text-zinc-600" /></div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">Yesterday EOD</p>
                        <p className="text-xs text-zinc-500">Admin User • 6:00 PM</p>
                      </div>
                   </div>
                   <div className="text-right">
                     <p className="text-sm font-bold font-mono">$1,105.00</p>
                     <p className="text-xs text-emerald-600 font-medium tracking-tight">Matched</p>
                   </div>
                </div>
                
                <div className="flex justify-between items-center p-3 border rounded-lg bg-zinc-50/50">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-200 rounded-full"><FileText className="w-4 h-4 text-zinc-600" /></div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">Oct 24, 2024</p>
                        <p className="text-xs text-zinc-500">John Doe • 5:45 PM</p>
                      </div>
                   </div>
                   <div className="text-right">
                     <p className="text-sm font-bold font-mono">$840.50</p>
                     <p className="text-xs text-amber-600 font-medium tracking-tight">-$5.00 short</p>
                   </div>
                </div>

                <div className="flex justify-between items-center p-3 border rounded-lg bg-zinc-50/50">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-200 rounded-full"><FileText className="w-4 h-4 text-zinc-600" /></div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">Oct 23, 2024</p>
                        <p className="text-xs text-zinc-500">Jane Smith • 6:15 PM</p>
                      </div>
                   </div>
                   <div className="text-right">
                     <p className="text-sm font-bold font-mono">$2,050.00</p>
                     <p className="text-xs text-emerald-600 font-medium tracking-tight">Matched</p>
                   </div>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
