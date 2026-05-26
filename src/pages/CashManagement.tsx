import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Lock, Unlock, DollarSign, Calculator, FileText, AlertTriangle, ArrowUpRight, ArrowDownRight, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

interface CashLog {
  id: string;
  amount: number;
  transaction_type: string;
  notes: string;
  created_at: string;
}

export default function CashManagement() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [expectedCash, setExpectedCash] = useState(0);
  const [countedCash, setCountedCash] = useState(0);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [cashLogs, setCashLogs] = useState<CashLog[]>([]);
  
  // New entry form state
  const [entryAmount, setEntryAmount] = useState('');
  const [entryType, setEntryType] = useState('expense');
  const [entryNotes, setEntryNotes] = useState('');
  
  // Starting float state
  const [startingFloat, setStartingFloat] = useState('');

  useEffect(() => {
    fetchTodayCash();
  }, []);

  const fetchTodayCash = async () => {
    setIsLoading(true);
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const isoStartOfDay = startOfDay.toISOString();

      // 1. Fetch sales
      const { data: salesData } = await supabase.from('sales')
        .select('*')
        .gte('created_at', isoStartOfDay);
      
      let totalCashSales = 0;
      if (salesData && salesData.length > 0) {
        salesData.forEach((s: any) => {
          const stat = String(s.status || '').toUpperCase();
          if (stat !== 'COMPLETED') return;

          let paymentsArray: any[] = [];
          
          if (Array.isArray(s.payments)) {
            paymentsArray = s.payments;
          } else if (typeof s.payments === 'string') {
            try {
              paymentsArray = JSON.parse(s.payments);
            } catch (e) {
              paymentsArray = [];
            }
          }

          if (paymentsArray && paymentsArray.length > 0) {
            let cashAmt = 0;
            paymentsArray.forEach((p: any) => {
              const m = String(p.method || '').toLowerCase();
              if (m === 'cash' || m === 'usd_cash') {
                cashAmt += Number(p.amount || 0);
              }
            });
            totalCashSales += cashAmt;
          } else {
            const pm = String(s.payment_method || '').toLowerCase();
            if (pm === 'cash' || pm === 'usd_cash') {
              totalCashSales += Number(s.total || 0);
            }
          }
        });
      }
      
      // 2. Fetch cash logs
      const { data: logsDocs } = await supabase.from('cash_drawer_logs')
        .select('*')
        .gte('created_at', isoStartOfDay)
        .order('created_at', { ascending: false });

      const logsData = logsDocs || [];
        
      setCashLogs(logsData);
      
      let float = 0;
      let expenses = 0;
      let restocks = 0;
      let ownerCollections = 0;
      
      let isRegisterCurrentlyClosed = false;
      
      logsData.forEach(log => {
        const amt = Number(log.amount);
        switch(log.transaction_type) {
            case 'opening_float': float += amt; break;
            case 'expense': expenses += amt; break;
            case 'restock': restocks += amt; break;
            case 'owner_collection': ownerCollections += amt; break;
            case 'closing_count': isRegisterCurrentlyClosed = true; break;
        }
      });
      
      const calculatedExpected = float + totalCashSales - expenses - restocks - ownerCollections;
      
      setExpectedCash(calculatedExpected);
      
      if (isRegisterCurrentlyClosed && float === 0 && totalCashSales === 0) {
          setIsDrawerOpen(false);
      } else {
          const hasClosing = logsData.some(l => l.transaction_type === 'closing_count');
          const hasOpeningAfterClosing = logsData
            .findIndex(l => l.transaction_type === 'opening_float') < 
            logsData.findIndex(l => l.transaction_type === 'closing_count');
            
          if (hasClosing && !hasOpeningAfterClosing) {
              setIsDrawerOpen(false);
          } else {
              setIsDrawerOpen(true);
          }
      }
      
    } catch (error) {
      console.error(error);
      toast.error('Failed to load cash data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLog = async () => {
    if (!entryAmount || parseFloat(entryAmount) <= 0) {
        toast.error('Please enter a valid amount');
        return;
    }
    
    try {
        await supabase.from('cash_drawer_logs').insert([{
            amount: parseFloat(entryAmount),
            transaction_type: entryType,
            notes: entryNotes,
            created_at: new Date().toISOString()
        }]);
        
        toast.success('Transaction logged successfully');
        setEntryAmount('');
        setEntryNotes('');
        setEntryType('expense');
        fetchTodayCash();
    } catch (e) {
        console.error(e);
        toast.error('Failed to save log');
    }
  };

  const variance = countedCash - expectedCash;

  const handleCloseRegister = async () => {
    if (countedCash === 0) {
      toast.error('Please enter the counted cash amount before closing.');
      return;
    }

    if (Math.abs(variance) > 0 && (!notes || !notes.trim())) {
      toast.error('Variance detected. Please provide an explanation in the notes.');
      return;
    }

    try {
        await supabase.from('cash_drawer_logs').insert([{
            amount: countedCash,
            transaction_type: 'closing_count',
            notes: `Counted: $${countedCash.toFixed(2)}, Expected: $${expectedCash.toFixed(2)}, Variance: $${variance.toFixed(2)}. ${notes}`,
            created_at: new Date().toISOString()
        }]);
        
        setIsDrawerOpen(false);
        setCountedCash(0);
        setNotes('');
        fetchTodayCash();
        toast.success('Register successfully closed for the day.');
    } catch (e) {
        console.error(e);
        toast.error('Failed to close register');
    }
  };

  const handleOpenRegister = async () => {
    try {
        const floatAmount = parseFloat(startingFloat) || 0;
        
        await supabase.from('cash_drawer_logs').insert([{
            amount: floatAmount,
            transaction_type: 'opening_float',
            notes: 'Register opened',
            created_at: new Date().toISOString()
        }]);
        
        setIsDrawerOpen(true);
        setStartingFloat('');
        fetchTodayCash();
        toast.success('Register successfully opened for the new shift.');
    } catch (e) {
        console.error(e);
        toast.error('Failed to open register');
    }
  };

  const formatLogType = (type: string) => {
      switch (type) {
          case 'opening_float': return 'Opening Float';
          case 'expense': return 'Expense';
          case 'restock': return 'Restock';
          case 'owner_collection': return 'Owner Collection';
          case 'closing_count': return 'Closing Count';
          case 'cash_sale': return 'Cash Sale';
          default: return type;
      }
  };

  const getLogIcon = (type: string) => {
      switch (type) {
          case 'opening_float': return <ArrowUpRight className="w-4 h-4 text-emerald-600" />;
          case 'expense': return <ArrowDownRight className="w-4 h-4 text-red-600" />;
          case 'restock': return <ArrowDownRight className="w-4 h-4 text-amber-600" />;
          case 'owner_collection': return <UserMinus className="w-4 h-4 text-purple-600" />;
          case 'closing_count': return <Lock className="w-4 h-4 text-zinc-600" />;
          case 'cash_sale': return <DollarSign className="w-4 h-4 text-emerald-600" />;
          default: return <FileText className="w-4 h-4 text-zinc-600" />;
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Cash Management</h2>
          <p className="text-zinc-500 mt-1">Manage shift registers, till drops, and cash movements.</p>
        </div>
        <Badge variant="outline" className={`px-3 py-1 ${isDrawerOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
           {isDrawerOpen ? <><Unlock className="w-3 h-3 mr-2" /> Register Open</> : <><Lock className="w-3 h-3 mr-2" /> Register Closed</>}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
            {!isDrawerOpen ? (
                <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-emerald-900">Start Shift</CardTitle>
                        <CardDescription className="text-emerald-700">Enter cash currently in the drawer to open register.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="float">Opening Float (Cash)</Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-emerald-600" />
                              <Input 
                                id="float" 
                                type="number" 
                                placeholder="0.00" 
                                className="pl-10 text-lg font-mono border-emerald-300"
                                value={startingFloat}
                                onChange={(e) => setStartingFloat(e.target.value)}
                              />
                            </div>
                         </div>
                         <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleOpenRegister}>
                            <Unlock className="w-4 h-4 mr-2" /> Open Register
                         </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-border/60 shadow-sm">
                  <CardHeader>
                    <CardTitle>End of Day Cash Count</CardTitle>
                    <CardDescription>Reconcile cash drawer at the end of your shift.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                     <div className="bg-zinc-50 p-4 rounded-lg flex justify-between items-center border">
                        <span className="font-semibold text-zinc-700">Expected Cash in Drawer</span>
                        <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-50">${expectedCash.toFixed(2)}</span>
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
                        />
                     </div>
        
                     <Button className="w-full bg-zinc-900 text-white hover:bg-zinc-800" onClick={handleCloseRegister}>
                        <Calculator className="w-4 h-4 mr-2" /> Close Register
                     </Button>
                  </CardContent>
                </Card>
            )}
        </div>

        <div className="space-y-6">
            <Card className="border-border/60 shadow-sm">
                <CardHeader>
                    <CardTitle>Cash Movements</CardTitle>
                    <CardDescription>Record expenses, deposits, or owner collections.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={entryType} onValueChange={setEntryType} className="space-y-4">
                        <TabsList className="grid grid-cols-3 w-full">
                            <TabsTrigger value="expense">Expense</TabsTrigger>
                            <TabsTrigger value="restock">Restock</TabsTrigger>
                            <TabsTrigger value="owner_collection">Collect</TabsTrigger>
                        </TabsList>
                        
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                                  <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    className="pl-10 text-lg font-mono"
                                    value={entryAmount}
                                    onChange={(e) => setEntryAmount(e.target.value)}
                                    disabled={!isDrawerOpen}
                                  />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Reason / Notes</Label>
                                <Input 
                                    placeholder={entryType === 'expense' ? "e.g., Office Supplies" : entryType === 'restock' ? "e.g., Bought more tomatoes" : "e.g., Owner withdrawal"} 
                                    value={entryNotes}
                                    onChange={(e) => setEntryNotes(e.target.value)}
                                    disabled={!isDrawerOpen}
                                />
                            </div>
                            
                            <Button className="w-full" onClick={handleAddLog} disabled={!isDrawerOpen}>
                                Record Transaction
                            </Button>
                        </div>
                    </Tabs>
                </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>Today's Register Activity</CardTitle>
                <CardDescription>History of cash movements for the current shift.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="space-y-3">
                    {cashLogs.length === 0 ? (
                        <p className="text-sm text-zinc-500 text-center py-4">No cash movements recorded today.</p>
                    ) : (
                        cashLogs.map((log) => (
                            <div key={log.id} className="flex justify-between items-center p-3 border rounded-lg bg-zinc-50/50">
                               <div className="flex items-center gap-3">
                                  <div className="p-2 bg-white shadow-sm border border-zinc-100 rounded-full">
                                    {getLogIcon(log.transaction_type)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatLogType(log.transaction_type)}</p>
                                    <p className="text-xs text-zinc-500">{new Date(log.created_at).toLocaleTimeString()} {log.notes && `• ${log.notes}`}</p>
                                  </div>
                               </div>
                               <div className="text-right shrink-0">
                                 <p className="text-sm font-bold font-mono">
                                   {['expense', 'restock', 'owner_collection'].includes(log.transaction_type) ? '-' : ''}${Number(log.amount).toFixed(2)}
                                 </p>
                               </div>
                            </div>
                        ))
                    )}
                 </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
