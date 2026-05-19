import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Download, MoreHorizontal, Settings2, ArrowUpDown, Printer } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../ui/dialog';
import {
  Table as ShadcnTable,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export function ProductList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Add Product Form State
  const [newProductName, setNewProductName] = useState('');
  const [newProductSKU, setNewProductSKU] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductStock, setNewProductStock] = useState('0');
  
  // Wholesale Pack Fields
  const [isPack, setIsPack] = useState(false);
  const [packSize, setPackSize] = useState('1');
  const [wholesalePrice, setWholesalePrice] = useState('');

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, sku, barcode, name, retail_price, wholesale_price, tax_class, is_active,
          categories(name),
          inventory(quantity)
        `)
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();

    // Subscribe to realtime changes on products
    const channel = supabase
      .channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        fetchProducts(); // Refresh list on change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      toast.success("Product deleted successfully");
      // fetchProducts() will be called automatically by Realtime if active
      fetchProducts();
    } catch (err) {
      toast.error("Could not delete product");
    }
  };

  const handleAddProduct = async () => {
    if (!newProductName || !newProductPrice) {
       toast.error("Please fill required fields (Name, Price)");
       return;
    }
    try {
       const { data: userData } = await supabase.auth.getUser();
       if (!userData?.user) throw new Error("Not authenticated");

       // Fetch user's business_id
       const { data: businessData, error: businessError } = await supabase
         .from('business_users')
         .select('business_id')
         .eq('user_id', userData.user.id)
         .limit(1)
         .single();

       if (businessError || !businessData) {
         toast.error(`Error: ${businessError?.message || 'You are not part of any business'}. Cannot add product.`);
         return;
       }

       const price = parseFloat(newProductPrice);
       const finalSku = isPack && parseInt(packSize) > 1 ? `${newProductSKU}|PK:${packSize}` : newProductSKU;
       
       const { data: newProduct, error: productError } = await supabase.from('products').insert({
         business_id: businessData.business_id,
         name: newProductName,
         sku: finalSku,
         retail_price: price,
         wholesale_price: isPack ? parseFloat(wholesalePrice) : (price * 0.9),
         is_active: true
       }).select().single();

       if (productError) throw productError;

       // Set initial stock if required
       const stock = parseInt(newProductStock, 10);
       if (stock > 0) {
         const { data: branchData } = await supabase
           .from('branches')
           .select('id')
           .eq('business_id', businessData.business_id)
           .limit(1)
           .single();
           
         if (branchData) {
           await supabase.from('inventory').insert({
             business_id: businessData.business_id,
             branch_id: branchData.id,
             product_id: newProduct.id,
             quantity: stock
           });
         }
       }

       toast.success("Product added successfully");
       setIsAddOpen(false);
       setNewProductName('');
       setNewProductPrice('');
       setNewProductSKU('');
       setNewProductStock('0');
       setIsPack(false);
       setPackSize('1');
       setWholesalePrice('');
       // fetchProducts() is also called by Realtime, but calling it here is fine as fallback
       fetchProducts();
    } catch (err: any) {
       console.error("Supabase insert error", err);
       toast.error(`Error adding product: ${err.message || 'Unknown error'}`);
    }
  };

  const exportCSV = () => {
    if (products.length === 0) {
      toast.error('No products to export');
      return;
    }
    
    // Generate CSV content
    const headers = ['SKU', 'Barcode', 'Name', 'Category', 'Retail Price', 'Wholesale Price', 'Tax Class', 'Active'];
    const rows = products.map(p => [
      p.sku || '',
      p.barcode || '',
      `"${p.name || ''}"`,
      p.categories?.name || '',
      p.retail_price || 0,
      p.wholesale_price || 0,
      p.tax_class || '',
      p.is_active ? 'Yes' : 'No'
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `products_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Products exported successfully');
  };

  const getStatusBadge = (stock: number) => {
    if (stock > 50) return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0">In Stock</Badge>;
    if (stock > 10) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0">Low Stock</Badge>;
    if (stock > 0) return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-0">Critical</Badge>;
    return <Badge className="bg-zinc-100 text-zinc-600 hover:bg-zinc-100 border-0">Out of Stock</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search by name, SKU, or barcode..." 
            className="pl-9 bg-white shadow-sm border-zinc-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" className="bg-white shadow-sm" onClick={() => toast.info('Please use the "Bulk Import" tab to import products.')}>Import</Button>
          <Button variant="outline" className="bg-white shadow-sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <Button variant="outline" className="bg-white shadow-sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button variant="outline" className="bg-white shadow-sm"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
          <Button variant="outline" className="bg-white shadow-sm"><Settings2 className="mr-2 h-4 w-4" /> View</Button>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm"><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="e.g. Mazoe Blackberry 2L" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input value={newProductSKU} onChange={e => setNewProductSKU(e.target.value)} placeholder="e.g. BV-MZB-2L" />
                  </div>
                  <div className="space-y-2">
                    <Label>Retail Price ($) *</Label>
                    <Input type="number" step="0.01" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 pt-2">
                  <input type="checkbox" id="isPack" checked={isPack} onChange={(e) => setIsPack(e.target.checked)} className="h-4 w-4 text-primary rounded border-zinc-300" />
                  <Label htmlFor="isPack" className="font-semibold cursor-pointer">Configure as Bundle/Pack</Label>
                </div>

                {isPack && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="space-y-2">
                      <Label>Pack Size (Units)</Label>
                      <Input type="number" value={packSize} onChange={e => setPackSize(e.target.value)} placeholder="e.g. 10" />
                    </div>
                    <div className="space-y-2">
                      <Label>Wholesale Pack Price ($)</Label>
                      <Input type="number" step="0.01" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} placeholder="0.00" />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>Initial Stock Quantity</Label>
                  <Input type="number" value={newProductStock} onChange={e => setNewProductStock(e.target.value)} placeholder="0" />
                  {isPack && <p className="text-xs text-zinc-500">Stock is measured in units. If you have 5 packs of 10, enter 50.</p>}
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAddProduct}>Save Product</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      <Card className="border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <ShadcnTable>
            <TableHeader className="bg-zinc-50/80 border-b border-zinc-200">
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead className="w-[120px]">SKU/Barcode</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-[140px]">Category</TableHead>
                <TableHead className="text-right w-[100px]">Stock</TableHead>
                <TableHead className="text-right w-[120px]">Retail</TableHead>
                <TableHead className="text-right w-[120px]">Wholesale</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => {
                const stock = item.inventory?.[0]?.quantity || 0;
                return (
                <TableRow key={item.id} className="hover:bg-zinc-50/50 cursor-pointer group">
                  <TableCell>
                    <div className="h-10 w-10 bg-zinc-100 rounded-md border border-zinc-200 flex items-center justify-center">
                      <span className="text-[10px] text-zinc-400">Img</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-medium text-zinc-800">{item.sku}</span>
                      <span className="font-mono text-[10px] text-zinc-500">{item.barcode}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-zinc-900">{item.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-normal text-xs">{item.categories?.name || 'Uncategorized'}</Badge></TableCell>
                  <TableCell className="text-right font-mono font-bold text-zinc-900">{stock}</TableCell>
                  <TableCell className="text-right font-mono">${item.retail_price?.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-zinc-500">${item.wholesale_price?.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(stock)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger 
                        render={
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4 text-zinc-500" />
                          </Button>
                        } 
                      />
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem>Edit Product</DropdownMenuItem>
                        <DropdownMenuItem>Adjust Stock</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600">Delete Product</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </ShadcnTable>
        </div>
      </Card>
    </div>
  );
}
