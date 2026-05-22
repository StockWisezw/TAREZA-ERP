import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, FileText, PackageCheck, AlertCircle, RefreshCw, Printer, Download } from 'lucide-react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table as ShadcnTable,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../ui/table';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function Procurement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          order_date,
          expected_delivery_date,
          status,
          total_amount,
          suppliers_advanced(name)
        `)
        .order('order_date', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('relation') || error.code === '404') {
           setPos([]);
           return;
        }
        throw error;
      }
      setPos(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'DRAFT': return <Badge variant="outline" className="text-zinc-500">Draft</Badge>;
      case 'PENDING_APPROVAL': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0">Pending Approval</Badge>;
      case 'APPROVED': 
      case 'SENT': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-0">Approved / Sent</Badge>;
      case 'PARTIAL_RECEIVED': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-0">Partial Receipt</Badge>;
      case 'RECEIVED': return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0">Fully Received</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const exportCSV = () => {
    if (!pos || pos.length === 0) {
      toast.error('No purchase orders to export');
      return;
    }
    const headers = ['PO Number', 'Supplier', 'Order Date', 'Expected Delivery', 'Status', 'Total'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + pos.map(p => `"${p.po_number || ''}","${p.suppliers_advanced?.name || ''}","${p.order_date || ''}","${p.expected_delivery_date || ''}","${p.status || ''}",${p.total_amount || 0}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `purchase_orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Purchase orders exported successfully');
  };

  const filteredPOs = pos.filter(po => 
    po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    po.suppliers_advanced?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search POs by number, supplier..." 
            className="pl-9 bg-white shadow-sm border-zinc-200 h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" className="bg-white shadow-sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <Button variant="outline" className="bg-white shadow-sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button variant="outline" onClick={fetchPOs} className="bg-white shadow-sm"><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm" onClick={() => toast.info('PO creation wizard will open')}><Plus className="mr-2 h-4 w-4" /> Create PO</Button>
        </div>
      </div>

      <Card className="border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <ShadcnTable>
            <TableHeader className="bg-zinc-50/80 border-b border-zinc-200">
              <TableRow>
                <TableHead className="w-[120px]">PO Number</TableHead>
                <TableHead className="w-[200px]">Supplier</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                   <TableCell colSpan={7} className="text-center py-6 text-zinc-500">
                      Loading purchase orders...
                   </TableCell>
                </TableRow>
              ) : filteredPOs.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={7} className="text-center py-6 text-zinc-500">
                      No purchase orders found.
                   </TableCell>
                </TableRow>
              ) : filteredPOs.map((po) => (
                <TableRow key={po.id} className="hover:bg-zinc-50/50 cursor-pointer">
                  <TableCell className="font-mono text-sm font-medium text-blue-600">{po.po_number}</TableCell>
                  <TableCell className="font-semibold text-zinc-900">{po.suppliers_advanced?.name || 'Unknown Supplier'}</TableCell>
                  <TableCell className="text-sm text-zinc-600">{new Date(po.order_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm text-zinc-600">{po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : '-'}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-zinc-900">${(po.total_amount || 0).toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(po.status)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ShadcnTable>
        </div>
      </Card>
    </div>
  );
}
