import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Search, Receipt, RefreshCcw, Download, ChevronRight, Plus } from 'lucide-react';
import { usePOSStore, SaleRecord } from '../store/posStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { useReactToPrint } from 'react-to-print';
import { ReceiptPrint } from '../components/pos/ReceiptPrint';
import { toast } from 'sonner';

export default function ReceiptHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const { offlineQueue } = usePOSStore(); // Mocking recent sales via offlineQueue for demo
  const receiptRef = useRef<HTMLDivElement>(null);

  const setSaleAndPrint = (sale: SaleRecord) => {
    setSelectedSale(sale);
    setTimeout(() => {
      handlePrint();
    }, 100);
  };

  const handlePrint = useReactToPrint({
    contentRef: receiptRef
  });

  const exportCSV = () => {
    if (offlineQueue.length === 0) {
      alert('No receipts to export');
      return;
    }
    
    const headers = ['Receipt #', 'Date', 'Total Amount', 'Items', 'Status'];
    const rows = offlineQueue.map(s => [
      s.receiptNumber,
      new Date(s.timestamp).toLocaleString(),
      s.total.toFixed(2),
      s.items.map(i => `${i.product.name} (x${i.quantity})`).join('; '),
      s.status
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + "\n" 
      + rows.map(e => `"${e.join('","')}"`).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `receipts_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Receipt History</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-white shadow-sm" onClick={() => window.print()}>
            Print All
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm" onClick={() => toast.info('Invoice creation wizard will open')}>
            <Plus className="mr-2 h-4 w-4" /> Create Invoice
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between bg-zinc-50 border-b pb-4">
          <CardTitle className="text-lg font-semibold">Past Transactions</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Search by receipt # or date" 
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / Time</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offlineQueue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-zinc-500">
                    No past transactions found. Complete a sale to see it here.
                  </TableCell>
                </TableRow>
              ) : (
                offlineQueue.map(sale => (
                  <TableRow key={sale.id} className="hover:bg-zinc-50 transition-colors cursor-pointer group">
                    <TableCell className="font-mono text-sm">{new Date(sale.timestamp).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-primary font-medium">{sale.receiptNumber}</TableCell>
                    <TableCell>{sale.items.length} items</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Completed</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold font-mono">${sale.total.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            View <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Receipt Validation</DialogTitle>
                          </DialogHeader>
                          <div className="py-6 px-10 border rounded-lg bg-zinc-50 font-mono text-sm text-center">
                            <h3 className="font-bold text-lg">TAREZA RETAIL</h3>
                            <p>Receipt: {sale.receiptNumber}</p>
                            <p>{new Date(sale.timestamp).toLocaleString()}</p>
                            <div className="my-4 border-t border-dashed border-zinc-400"></div>
                            {sale.items.map(item => (
                              <div key={item.id} className="flex justify-between py-1">
                                <span>{item.quantity}x {item.product.name}</span>
                                <span>${item.subtotal.toFixed(2)}</span>
                              </div>
                            ))}
                            <div className="my-4 border-t border-dashed border-zinc-400"></div>
                            <div className="flex justify-between font-bold text-lg">
                              <span>TOTAL</span>
                              <span>${sale.total.toFixed(2)}</span>
                            </div>
                            <div className="mt-8 pt-4 flex gap-4">
                              <Button className="w-full" onClick={() => setSaleAndPrint(sale)}>
                                <Receipt className="mr-2 h-4 w-4" /> Reprint
                              </Button>
                              <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50">
                                <RefreshCcw className="mr-2 h-4 w-4" /> Refund
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Hidden print component */}
      <ReceiptPrint ref={receiptRef} sale={selectedSale} />
    </div>
  );
}
