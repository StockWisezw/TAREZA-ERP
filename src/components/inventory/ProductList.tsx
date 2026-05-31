import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Download, MoreHorizontal, Settings2, ArrowUpDown, Printer, Edit3, Check, RotateCcw, Loader2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';

const getPackSize = (sku: string | undefined): number => {
  if (!sku) return 1;
  const match = sku.match(/\|PK:(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
};

export function ProductList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Branch configuration states
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Inline editing state
  const [isInlineEditMode, setIsInlineEditMode] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, { retail_price: string; wholesale_price: string; stock: string }>>({});
  const [isSavingInline, setIsSavingInline] = useState<Record<string, boolean>>({});
  
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

      const { data: userData } = await supabase.auth.getUser();
      let businessId = '';

      if (userData?.user) {
        const { data: businessData } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        if (businessData) {
          businessId = businessData.business_id;
        }
      }

      const [productsRes, inventoryRes, categoriesRes, branchesRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('name'),
        supabase.from('inventory').select('*'),
        supabase.from('categories').select('*'),
        businessId
          ? supabase.from('branches').select('*').eq('business_id', businessId)
          : supabase.from('branches').select('*')
      ]);
      
      if (productsRes.error) {
        throw productsRes.error;
      }
      
      const productsData = productsRes.data || [];
      const inventoryData = inventoryRes.data || [];
      const categoriesData = categoriesRes.data || [];
      const branchesData = branchesRes?.data || [];
      
      setBranches(branchesData);
      if (branchesData.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branchesData[0].id);
      }
      
      const mappedProducts = productsData.map(p => {
        const productInventory = inventoryData.filter((i: any) => i.product_id === p.id);
        const category = categoriesData.find((c: any) => c.id === p.category_id);
        
        return {
          ...p,
          inventory: productInventory.length > 0 ? productInventory : [{ quantity: 0 }],
          categories: category ? { name: category.name } : null
        };
      });
      
      setProducts(mappedProducts);
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
          .maybeSingle();

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
          .maybeSingle();
           
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
       console.error("Firebase insert error", err);
       toast.error(`Error adding product: ${err.message || 'Unknown error'}`);
    }
  };

  const handleSaveRow = async (item: any, stockRecord: any) => {
    const rowEdit = editedFields[item.id];
    if (!rowEdit) return;

    // Parse values
    const newRetail = parseFloat(rowEdit.retail_price);
    const newWholesale = parseFloat(rowEdit.wholesale_price);
    const newStock = parseInt(rowEdit.stock, 10);

    if (isNaN(newRetail) || isNaN(newWholesale) || isNaN(newStock)) {
      toast.error("Please enter valid numeric values for prices and stock");
      return;
    }

    setIsSavingInline(prev => ({ ...prev, [item.id]: true }));

    try {
      // 1. Update product retail_price & wholesale_price
      const { error: productError } = await supabase
        .from('products')
        .update({
          retail_price: newRetail,
          wholesale_price: newWholesale,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (productError) throw productError;

      // 2. Update stock quantity
      const { data: userData } = await supabase.auth.getUser();
      let businessId = null;

      if (userData?.user) {
        const { data: businessData } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        if (businessData) {
          businessId = businessData.business_id;
        }
      }

      // Determine branch ID
      const branchIdToUse = selectedBranchId || stockRecord?.branch_id || (branches.length > 0 ? branches[0].id : null);

      if (branchIdToUse) {
        // Find if inventory record exists for this product and branch
        const { data: existingRecords } = await supabase
          .from('inventory')
          .select('*')
          .eq('product_id', item.id)
          .eq('branch_id', branchIdToUse);

        if (existingRecords && existingRecords.length > 0) {
          // Update
          const { error: inventoryError } = await supabase
            .from('inventory')
            .update({
              quantity: newStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingRecords[0].id);

          if (inventoryError) throw inventoryError;
        } else {
          // Insert new
          const { error: inventoryError } = await supabase
            .from('inventory')
            .insert({
              id: crypto.randomUUID(),
              business_id: businessId,
              branch_id: branchIdToUse,
              product_id: item.id,
              quantity: newStock,
              reorder_level: 10,
              created_at: new Date().toISOString()
            });

          if (inventoryError) throw inventoryError;
        }
      }

      // Success! Update local lists so updates are immediately visible
      toast.success(`Updated "${item.name}" successfully!`);

      // Remove row edit from state
      setEditedFields(prev => {
        const updated = { ...prev };
        delete updated[item.id];
        return updated;
      });

      // Refresh list to pull latest data
      fetchProducts();
    } catch (err: any) {
      console.error("Inline save error", err);
      toast.error(`Error saving changes: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingInline(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const exportCSV = () => {
    if (products.length === 0) {
      toast.error('No products to export');
      return;
    }
    
    const selectedBranch = branches.find(b => b.id === selectedBranchId);
    const branchName = selectedBranch ? selectedBranch.name : 'All/Default Branch';
    
    // Generate CSV content
    const headers = ['SKU', 'Barcode', 'Product Name', 'Category', 'Branch', 'Stock Level', 'Retail Price ($)', 'Wholesale Price ($)', 'Tax Class', 'Active'];
    const rows = products.map(p => {
      const stockRecord = selectedBranchId 
        ? p.inventory?.find((i: any) => i.branch_id === selectedBranchId)
        : p.inventory?.[0];
      const stock = stockRecord ? stockRecord.quantity : 0;

      return [
        p.sku || '',
        p.barcode || '',
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.categories?.name || 'Uncategorized',
        `"${branchName.replace(/"/g, '""')}"`,
        stock,
        p.retail_price?.toFixed(2) || '0.00',
        p.wholesale_price?.toFixed(2) || '0.00',
        p.tax_class || '',
        p.is_active ? 'Yes' : 'No'
      ];
    });
    
    const csvContent = "\uFEFF" + headers.join(',') + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const dateStr = new Date().toISOString().split('T')[0];
    const cleanBranchName = branchName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    link.setAttribute("download", `inventory_report_${cleanBranchName}_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Inventory report for branch "${branchName}" exported successfully`);
  };

  const getStatusBadge = (stock: number) => {
    if (stock > 50) return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0">In Stock</Badge>;
    if (stock > 10) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0">Low Stock</Badge>;
    if (stock > 0) return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-0">Critical</Badge>;
    return <Badge className="bg-zinc-100 text-zinc-600 hover:bg-zinc-100 border-0">Out of Stock</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Search by name, SKU, or barcode..." 
              className="pl-9 bg-white shadow-sm border-zinc-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {branches.length > 0 && (
            <div className="w-full sm:w-48">
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="bg-white shadow-sm border-zinc-200 w-full">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Button 
            variant={isInlineEditMode ? "default" : "outline"} 
            className={`shadow-sm ${isInlineEditMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent' : 'bg-white'}`}
            onClick={() => {
              setIsInlineEditMode(!isInlineEditMode);
              if (isInlineEditMode) {
                setEditedFields({});
              }
            }}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            {isInlineEditMode ? "Exit Quick Edit" : "Quick Edit"}
          </Button>
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
              {products.filter(item => {
                const sTerm = searchTerm.toLowerCase();
                return (
                  (item.name || '').toLowerCase().includes(sTerm) ||
                  (item.sku || '').toLowerCase().includes(sTerm) ||
                  (item.barcode || '').toLowerCase().includes(sTerm) ||
                  (item.code || '').toLowerCase().includes(sTerm)
                );
              }).map((item) => {
                const stockRecord = selectedBranchId 
                  ? item.inventory?.find((i: any) => i.branch_id === selectedBranchId)
                  : item.inventory?.[0];
                const stock = stockRecord ? stockRecord.quantity : 0;

                const rowEdit = editedFields[item.id] || {
                  retail_price: item.retail_price?.toString() || '0',
                  wholesale_price: item.wholesale_price?.toString() || '0',
                  stock: stock.toString()
                };

                const isDirty = 
                  parseFloat(rowEdit.retail_price) !== item.retail_price ||
                  parseFloat(rowEdit.wholesale_price) !== item.wholesale_price ||
                  parseInt(rowEdit.stock, 10) !== stock;

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
                  
                  {/* Stock Column */}
                  <TableCell className="text-right font-mono text-zinc-900">
                    {isInlineEditMode ? (
                      <Input
                        type="number"
                        value={rowEdit.stock}
                        onChange={(e) => {
                          setEditedFields((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...rowEdit,
                              stock: e.target.value
                            }
                          }));
                        }}
                        className="w-20 ml-auto text-right font-mono text-xs h-8 px-2 border-zinc-200 bg-white"
                      />
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-zinc-900">{stock} units</span>
                        {getPackSize(item.sku) > 1 && (
                          <span className="text-[10px] text-zinc-500 font-medium">
                            (= {Math.floor(stock / getPackSize(item.sku))} packs & {stock % getPackSize(item.sku)} units)
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>

                  {/* Retail Column */}
                  <TableCell className="text-right font-mono">
                    {isInlineEditMode ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-zinc-400 text-xs">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={rowEdit.retail_price}
                          onChange={(e) => {
                            setEditedFields((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...rowEdit,
                                retail_price: e.target.value
                              }
                            }));
                          }}
                          className="w-24 text-right font-mono text-xs h-8 px-2 border-zinc-200 bg-white"
                        />
                      </div>
                    ) : (
                      `$${item.retail_price?.toFixed(2)}`
                    )}
                  </TableCell>

                  {/* Wholesale Column */}
                  <TableCell className="text-right font-mono text-zinc-500">
                    {isInlineEditMode ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-zinc-400 text-xs">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={rowEdit.wholesale_price}
                          onChange={(e) => {
                            setEditedFields((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...rowEdit,
                                wholesale_price: e.target.value
                              }
                            }));
                          }}
                          className="w-24 text-right font-mono text-xs h-8 px-2 border-zinc-200 bg-white"
                        />
                      </div>
                    ) : (
                      `$${item.wholesale_price?.toFixed(2)}`
                    )}
                  </TableCell>

                  <TableCell>{getStatusBadge(isInlineEditMode ? parseInt(rowEdit.stock, 10) || 0 : stock)}</TableCell>
                  
                  {/* Actions Column */}
                  <TableCell className="text-right">
                    {isInlineEditMode ? (
                      <div className="flex items-center gap-1.5 justify-end">
                        {isSavingInline[item.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={!isDirty}
                              onClick={() => handleSaveRow(item, stockRecord)}
                              className={`h-7 w-7 rounded-md p-0 ${isDirty ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/30' : 'text-zinc-300'}`}
                              title="Save Changes"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={!isDirty}
                              onClick={() => {
                                setEditedFields((prev) => {
                                  const updated = { ...prev };
                                  delete updated[item.id];
                                  return updated;
                                });
                              }}
                              className={`h-7 w-7 rounded-md p-0 ${isDirty ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800' : 'text-zinc-300'}`}
                              title="Revert to Original"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
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
                    )}
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
