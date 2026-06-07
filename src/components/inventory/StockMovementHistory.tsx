import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Search, Filter, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle } from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

export function StockMovementHistory() {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchMovements();
  }, []);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      // Try to fetch advanced stock movements first, fallback to standard if not found/error
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          id,
          type,
          quantity,
          notes,
          created_at,
          products ( name, sku )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) {
        console.error('Error fetching stock movements:', error);
      } else if (data) {
        setMovements(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    const t = type?.toUpperCase();
    switch (t) {
      case 'SALE':
      case 'TRANSFER_OUT':
      case 'OUT':
        return <ArrowDownRight className="h-4 w-4 text-red-500" />;
      case 'RESTOCK':
      case 'RETURN':
      case 'TRANSFER_IN':
      case 'IN':
        return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
      case 'ADJUSTMENT':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-zinc-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const t = type?.toUpperCase();
    switch (t) {
      case 'SALE': return <Badge className="bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border-0">Sale</Badge>;
      case 'RESTOCK': return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0">Restock</Badge>;
      case 'TRANSFER_OUT': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-0">Transfer Out</Badge>;
      case 'TRANSFER_IN': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-0">Transfer In</Badge>;
      case 'ADJUSTMENT': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0">Adjustment</Badge>;
      case 'RETURN': return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0">Return</Badge>;
      case 'IN': return <Badge className="bg-emerald-100 text-emerald-800 border-0">In</Badge>;
      case 'OUT': return <Badge className="bg-red-100 text-red-800 border-0">Out</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Audit Trails & History</h2>
          <p className="text-sm text-zinc-500">Comprehensive history of all stock movements and adjustments.</p>
        </div>
        <Button variant="outline" onClick={fetchMovements}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <Card className="border-zinc-200 shadow-sm">
        <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-50/50 rounded-t-xl">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Search movements..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white" 
            />
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Movement ID</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-zinc-500">Loading movements...</TableCell>
              </TableRow>
            ) : movements.filter((mv) => {
              const q = searchQuery.toLowerCase();
              const name = (mv.products?.name || '').toLowerCase();
              const sku = (mv.products?.sku || '').toLowerCase();
              const type = (mv.type || '').toLowerCase();
              const notes = (mv.notes || '').toLowerCase();
              return name.includes(q) || sku.includes(q) || type.includes(q) || notes.includes(q);
            }).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-zinc-500">No stock movements found.</TableCell>
              </TableRow>
            ) : movements.filter((mv) => {
              const q = searchQuery.toLowerCase();
              const name = (mv.products?.name || '').toLowerCase();
              const sku = (mv.products?.sku || '').toLowerCase();
              const type = (mv.type || '').toLowerCase();
              const notes = (mv.notes || '').toLowerCase();
              return name.includes(q) || sku.includes(q) || type.includes(q) || notes.includes(q);
            }).map((movement) => (
              <TableRow key={movement.id}>
                <TableCell className="font-mono text-xs text-zinc-500">{movement.id?.substring(0, 8)}...</TableCell>
                <TableCell className="text-zinc-600 whitespace-nowrap">
                  {new Date(movement.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-zinc-900">{movement.products?.name || 'Unknown Product'}</div>
                  <div className="font-mono text-xs text-zinc-500">{movement.products?.sku || 'N/A'}</div>
                </TableCell>
                <TableCell>{getTypeBadge(movement.type)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5 font-medium">
                    {getTypeIcon(movement.type)}
                    <span className={movement.quantity > 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-zinc-500 text-sm max-w-[200px] truncate" title={movement.notes}>
                  {movement.notes || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
