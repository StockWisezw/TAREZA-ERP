import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Search, Plus, ArrowRightLeft, MapPin, Truck, CheckCircle2, Clock } from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export function Transfers() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_transfers')
        .select(`
          id,
          status,
          created_at,
          from_branch:from_branch_id ( name ),
          to_branch:to_branch_id ( name )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching transfers:', error);
      } else if (data) {
        setTransfers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('inventory_transfers')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      toast.success(`Transfer status updated to ${newStatus}`);
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update transfer');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Branch Transfers</h2>
          <p className="text-sm text-zinc-500">Move inventory between warehouses and track in-transit stock.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <Button variant="outline" onClick={fetchTransfers}>Refresh</Button>
           <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> New Transfer</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-100 bg-blue-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-800">In Transit</p>
              <p className="text-2xl font-bold text-blue-900">{transfers.filter(t => t.status === 'IN_TRANSIT').length}</p>
            </div>
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-amber-100 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800">Pending Approval</p>
              <p className="text-2xl font-bold text-amber-900">{transfers.filter(t => t.status === 'PENDING').length}</p>
            </div>
            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-emerald-800">Completed (Total)</p>
              <p className="text-2xl font-bold text-emerald-900">{transfers.filter(t => t.status === 'COMPLETED' || t.status === 'RECEIVED').length}</p>
            </div>
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200 shadow-sm">
        <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-50/50 rounded-t-xl">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input placeholder="Search transfers..." className="pl-9 bg-white" />
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfer ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-zinc-500">Loading transfers...</TableCell>
              </TableRow>
            ) : transfers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-zinc-500">No transfers found.</TableCell>
              </TableRow>
             ) : transfers.map((trf) => (
              <TableRow key={trf.id}>
                <TableCell className="font-mono text-xs">{trf.id?.substring(0, 8)}...</TableCell>
                <TableCell>{new Date(trf.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <MapPin className="h-3 w-3 text-zinc-400" /> {trf.from_branch?.name || 'Unknown'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-medium">
                    <ArrowRightLeft className="h-3 w-3 text-emerald-500" /> {trf.to_branch?.name || 'Unknown'}
                  </div>
                </TableCell>
                <TableCell>
                  {trf.status === 'IN_TRANSIT' && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-0">In Transit</Badge>}
                  {trf.status === 'PENDING' && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0">Pending</Badge>}
                  {(trf.status === 'COMPLETED' || trf.status === 'RECEIVED') && <Badge className="bg-zinc-100 text-zinc-600 border-0 hover:bg-zinc-200">Completed</Badge>}
                  {trf.status === 'DRAFT' && <Badge className="bg-zinc-100 text-zinc-500 border-0 hover:bg-zinc-200">Draft</Badge>}
                  {trf.status === 'CANCELLED' && <Badge className="bg-red-100 text-red-600 border-0 hover:bg-red-200">Cancelled</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {trf.status === 'IN_TRANSIT' ? (
                     <Button variant="outline" size="sm" className="border-blue-200 text-blue-800 bg-blue-50 hover:bg-blue-100" onClick={() => handleUpdateStatus(trf.id, 'RECEIVED')}>Receive</Button>
                  ) : trf.status === 'PENDING' ? (
                     <Button variant="outline" size="sm" className="border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100" onClick={() => handleUpdateStatus(trf.id, 'IN_TRANSIT')}>Dispatch</Button>
                  ) : (
                    <Button variant="ghost" size="sm">View</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
