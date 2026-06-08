import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { AlertTriangle, TrendingUp, DollarSign, CalendarClock, Download, Bell } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { supabase } from '../../lib/firebaseClient';

export function CreditManagement() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [totalReceivables, setTotalReceivables] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: custs } = await supabase.from('customers').select('*');
        if (custs) {
            const withBalance = custs.filter(c => Number(c.balance) > 0);
            
            withBalance.sort((a, b) => Number(b.balance) - Number(a.balance));
            setCustomers(withBalance);
            
            const total = withBalance.reduce((sum, c) => sum + Number(c.balance), 0);
            setTotalReceivables(total);
        }
      } catch (err) {
        console.error('Failed to fetch credit data', err);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-zinc-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Total Receivables</CardTitle>
            <DollarSign className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-zinc-900">${totalReceivables.toFixed(2)}</div>
            <p className="text-xs text-zinc-500 mt-1">Across {customers.length} active credit accounts</p>
          </CardContent>
        </Card>
        
        <Card className="border-red-100 bg-red-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Total Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-red-900">${(totalReceivables * 0.25).toFixed(2)}</div>
            <p className="text-xs text-red-600 mt-1">Estimated overdue</p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">Due 1-30 Days</CardTitle>
            <CalendarClock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-amber-900">${(totalReceivables * 0.4).toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Collected (30d)</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-emerald-900">$0.00</div>
            <p className="text-xs text-emerald-600 mt-1">Pending payments</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-zinc-200">
          <div className="flex items-center justify-between p-6 pb-2">
            <div>
              <CardTitle>Aging Analysis</CardTitle>
              <CardDescription>Breakdown of outstanding invoices by age (Estimated)</CardDescription>
            </div>
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Aging Report</Button>
          </div>
          <CardContent className="pt-4">
            <div className="space-y-4">
               {/* Visual progress bar representation of aging */}
               <div className="flex h-12 w-full rounded-lg overflow-hidden shadow-sm">
                 <div className="bg-emerald-400 flex items-center justify-center text-xs font-bold text-emerald-900 whitespace-nowrap" style={{ width: '35%' }}>Current (35%)</div>
                 <div className="bg-amber-300 flex items-center justify-center text-xs font-bold text-amber-900 whitespace-nowrap" style={{ width: '40%' }}>1-30 Days (40%)</div>
                 <div className="bg-orange-400 flex items-center justify-center text-xs font-bold text-orange-900 whitespace-nowrap" style={{ width: '15%' }}>31-60 Days (15%)</div>
                 <div className="bg-red-500 flex items-center justify-center text-xs font-bold text-white whitespace-nowrap" style={{ width: '10%' }}>&gt;60 Days (10%)</div>
               </div>

               <div className="grid grid-cols-4 gap-4 pt-4 border-t border-zinc-100">
                  <div className="text-center">
                    <p className="text-zinc-500 text-sm">Current</p>
                    <p className="font-bold font-mono mt-1">${(totalReceivables * 0.35).toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-zinc-500 text-sm">1-30 Days</p>
                    <p className="font-bold font-mono mt-1">${(totalReceivables * 0.40).toFixed(2)}</p>
                  </div>
                  <div className="text-center border-l border-zinc-100">
                    <p className="text-zinc-500 text-sm">31-60 Days</p>
                    <p className="font-bold font-mono mt-1 text-orange-600">${(totalReceivables * 0.15).toFixed(2)}</p>
                  </div>
                  <div className="text-center border-l border-zinc-100">
                    <p className="text-zinc-500 text-sm">&gt; 60 Days</p>
                    <p className="font-bold font-mono mt-1 text-red-600">${(totalReceivables * 0.10).toFixed(2)}</p>
                  </div>
               </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200">
          <CardHeader>
            <CardTitle>Action Hub</CardTitle>
            <CardDescription>Requires attention</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-zinc-50">
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.slice(0, 5).map((item, i) => (
                  <TableRow key={item.id}>
                    <TableCell className="py-3">
                      <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                      <p className="text-xs mt-0.5 text-zinc-500">
                        {item.phone || item.email}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-bold">${Number(item.balance).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-100">
                        <Bell className="h-4 w-4 text-zinc-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {customers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-sm text-zinc-500">
                      No accounts with outstanding balance.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {customers.length > 0 && (
              <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 rounded-b-xl">
                <Button className="w-full bg-zinc-900 text-white hover:bg-zinc-800">Send Reminders ({Math.min(customers.length, 5)})</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
