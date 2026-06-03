import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Download, MoreHorizontal, Settings2, ArrowUpDown, Printer, Edit3, Check, RotateCcw, Loader2, Tag } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../ui/dialog';
import { PriceLabelsGenerator } from './PriceLabelsGenerator';
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

interface ProductListProps {
  onImportClick?: () => void;
}

export function ProductList({ onImportClick }: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isLabelsOpen, setIsLabelsOpen] = useState(false);
  
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

  // Multiple Custom Bundles
  const [bundles, setBundles] = useState<any[]>([]);
  const [editBundles, setEditBundles] = useState<any[]>([]);
  const [newBundleName, setNewBundleName] = useState('');
  const [newBundleSize, setNewBundleSize] = useState('');
  const [newBundlePrice, setNewBundlePrice] = useState('');
  const [editBundleName, setEditBundleName] = useState('');
  const [editBundleSize, setEditBundleSize] = useState('');
  const [editBundlePrice, setEditBundlePrice] = useState('');

  // Categories list state map
  const [categories, setCategories] = useState<any[]>([]);

  // Edit Product Dialog Form State
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editSKU, setEditSKU] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editRetailPrice, setEditRetailPrice] = useState('');
  const [editWholesalePrice, setEditWholesalePrice] = useState('');

  // Adjust Product Stock Dialog Form State
  const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null);
  const [adjType, setAdjType] = useState<'add' | 'subtract' | 'set'>('add');
  const [adjQty, setAdjQty] = useState('1');

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
      setCategories(categoriesData);
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

    // Subscribe to realtime changes on products and inventory
    const channel = supabase
      .channel('public:products_inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        fetchProducts(); // Refresh list on change
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
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

  const handleAddBundleToNew = () => {
    if (!newBundleName.trim() || !newBundleSize || !newBundlePrice) {
      toast.error("Please fill in Bundle Name, Pack Size, and Price!");
      return;
    }
    const size = parseInt(newBundleSize, 10);
    const price = parseFloat(newBundlePrice);
    if (isNaN(size) || size <= 1) {
      toast.error("Pack size must be a number greater than 1!");
      return;
    }
    if (isNaN(price) || price <= 0) {
      toast.error("Bundle price must be a valid positive number!");
      return;
    }
    setBundles([...bundles, { name: newBundleName.trim(), pack_size: size, price }]);
    setNewBundleName('');
    setNewBundleSize('');
    setNewBundlePrice('');
  };

  const handleRemoveBundleFromNew = (index: number) => {
    setBundles(bundles.filter((_, i) => i !== index));
  };

  const handleAddBundleToEdit = () => {
    if (!editBundleName.trim() || !editBundleSize || !editBundlePrice) {
      toast.error("Please fill in Bundle Name, Pack Size, and Price!");
      return;
    }
    const size = parseInt(editBundleSize, 10);
    const price = parseFloat(editBundlePrice);
    if (isNaN(size) || size <= 1) {
      toast.error("Pack size must be a number greater than 1!");
      return;
    }
    if (isNaN(price) || price <= 0) {
      toast.error("Bundle price must be a valid positive number!");
      return;
    }
    setEditBundles([...editBundles, { name: editBundleName.trim(), pack_size: size, price }]);
    setEditBundleName('');
    setEditBundleSize('');
    setEditBundlePrice('');
  };

  const handleRemoveBundleFromEdit = (index: number) => {
    setEditBundles(editBundles.filter((_, i) => i !== index));
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
         bundles: bundles,
         is_active: true
       }).select().single();

       if (productError) throw productError;

       // Set initial stock if required
       const stock = parseFloat(newProductStock);
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
       setBundles([]);
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

  const handleEditProduct = async () => {
    if (!editingProduct) return;
    if (!editName || !editRetailPrice) {
      toast.error("Please fill in required fields (Name, Price)!");
      return;
    }

    try {
      const retail = parseFloat(editRetailPrice);
      const wholesale = parseFloat(editWholesalePrice);

      if (isNaN(retail)) {
        toast.error("Retail price must be a valid number");
        return;
      }

      const { error } = await supabase
        .from('products')
        .update({
          name: editName,
          sku: editSKU || null,
          barcode: editBarcode || null,
          retail_price: retail,
          wholesale_price: isNaN(wholesale) ? (retail * 0.9) : wholesale,
          category_id: editCategory || null,
          bundles: editBundles,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingProduct.id);

      if (error) throw error;

      toast.success(`Product "${editName}" updated successfully!`);
      setEditingProduct(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Error updating product");
    }
  };

  const handleAdjustStock = async () => {
    if (!adjustingProduct) return;
    const qtyVal = parseFloat(adjQty);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      toast.error("Please specify a valid positive quantity to adjust");
      return;
    }

    // Get current inventory record
    const stockRecord = selectedBranchId 
      ? adjustingProduct.inventory?.find((i: any) => i.branch_id === selectedBranchId)
      : adjustingProduct.inventory?.[0];
    const currentQty = stockRecord ? stockRecord.quantity : 0;

    let targetQty = currentQty;
    let deltaQty = qtyVal;

    if (adjType === 'add') {
      targetQty = currentQty + qtyVal;
      deltaQty = qtyVal;
    } else if (adjType === 'subtract') {
      if (currentQty < qtyVal) {
        toast.error(`Insufficient stock! Cannot hollow out ${qtyVal} units when current level is ${currentQty} units.`);
        return;
      }
      targetQty = currentQty - qtyVal;
      deltaQty = -qtyVal;
    } else if (adjType === 'set') {
      targetQty = qtyVal;
      deltaQty = qtyVal - currentQty;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      let businessId = adjustingProduct.business_id;

      if (userData?.user && !businessId) {
        const { data: bData } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();
        if (bData) businessId = bData.business_id;
      }

      const branchIdToUse = selectedBranchId || (branches.length > 0 ? branches[0].id : null);

      if (!branchIdToUse) {
        toast.error("No active branch context resolved.");
        return;
      }

      // 1. Update/upsert the inventory row
      if (stockRecord && stockRecord.id) {
        const { error } = await supabase
          .from('inventory')
          .update({
            quantity: targetQty,
            updated_at: new Date().toISOString()
          })
          .eq('id', stockRecord.id);

        if (error) throw error;
      } else {
        // Find existing record manually just in case
        const { data: existing } = await supabase
          .from('inventory')
          .select('*')
          .eq('product_id', adjustingProduct.id)
          .eq('branch_id', branchIdToUse);

        if (existing && existing.length > 0) {
          const { error } = await supabase
            .from('inventory')
            .update({
              quantity: targetQty,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing[0].id);

          if (error) throw error;
        } else {
          // Insert
          const { error } = await supabase
            .from('inventory')
            .insert({
              business_id: businessId,
              branch_id: branchIdToUse,
              product_id: adjustingProduct.id,
              quantity: targetQty,
              created_at: new Date().toISOString()
            });

          if (error) throw error;
        }
      }

      // 2. Insert into stock_movements for logging audits
      const { error: mvmtError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: adjustingProduct.id,
          branch_id: branchIdToUse,
          quantity: deltaQty,
          type: deltaQty >= 0 ? 'receiving' : 'sale',
          created_at: new Date().toISOString()
        });

      if (mvmtError) {
        console.error("Audit movement tracking error:", mvmtError);
      }

      toast.success(`Stock level adjusted for "${adjustingProduct.name}". New quantities: ${targetQty} units.`);
      setAdjustingProduct(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Error adjusting stock");
    }
  };

  const handleSaveRow = async (item: any, stockRecord: any) => {
    const rowEdit = editedFields[item.id];
    if (!rowEdit) return;

    // Parse values
    const newRetail = parseFloat(rowEdit.retail_price);
    const newWholesale = parseFloat(rowEdit.wholesale_price);
    const newStock = parseFloat(rowEdit.stock);

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

  const filteredProducts = products.filter(item => {
    const sTerm = searchTerm.toLowerCase();
    return (
      (item.name || '').toLowerCase().includes(sTerm) ||
      (item.sku || '').toLowerCase().includes(sTerm) ||
      (item.barcode || '').toLowerCase().includes(sTerm) ||
      (item.code || '').toLowerCase().includes(sTerm)
    );
  });

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
          <Button 
            variant="outline" 
            className="bg-white shadow-sm border-indigo-200 text-indigo-700 hover:bg-indigo-50/40" 
            onClick={() => {
              if (onImportClick) {
                onImportClick();
              } else {
                toast.info('Please use the "Bulk Import" tab to import products.');
              }
            }}
          >
            Bulk Add / Import
          </Button>
          <Button 
            variant="outline" 
            className={`shadow-sm bg-white ${selectedProductIds.length > 0 ? 'border-indigo-300 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/50' : 'text-zinc-600'}`}
            onClick={() => {
              if (selectedProductIds.length === 0) {
                toast.info('Please select at least one product using the checkboxes first.');
                return;
              }
              setIsLabelsOpen(true);
            }}
          >
            <Tag className="mr-2 h-4 w-4 text-indigo-500" />
            Print Price Labels {selectedProductIds.length > 0 && `(${selectedProductIds.length})`}
          </Button>
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

                {/* Custom Bundles section */}
                <div className="space-y-3 pt-3 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold text-zinc-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                      <Tag className="h-3.5 w-3.5 text-amber-500" />
                      Custom Bundles / Tier Prices
                    </Label>
                    <span className="text-[10px] text-zinc-400 font-medium font-mono">Multiple allowed</span>
                  </div>
                  
                  {/* Bundles List */}
                  {bundles.length > 0 && (
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {bundles.map((b, bIdx) => (
                        <div key={bIdx} className="flex justify-between items-center text-xs p-2 rounded bg-amber-50/55 border border-amber-100">
                          <div className="flex flex-col">
                            <span className="font-semibold text-zinc-800">{b.name}</span>
                            <span className="text-[10px] text-zinc-500">Pack Size: {b.pack_size} units | Price: ${b.price.toFixed(2)}</span>
                          </div>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRemoveBundleFromNew(bIdx)}
                            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Bundle Mini-Form */}
                  <div className="p-3 bg-zinc-50 border border-zinc-150 rounded-lg space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-zinc-500">Bundle Name</Label>
                        <Input 
                          placeholder="e.g. Six-Pack" 
                          value={newBundleName} 
                          onChange={e => setNewBundleName(e.target.value)}
                          className="h-7 text-xs px-2 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-zinc-500">Size (Units)</Label>
                        <Input 
                          type="number" 
                          placeholder="e.g. 6" 
                          value={newBundleSize} 
                          onChange={e => setNewBundleSize(e.target.value)}
                          className="h-7 text-xs px-2 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-zinc-500">Price ($)</Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          value={newBundlePrice} 
                          onChange={e => setNewBundlePrice(e.target.value)}
                          className="h-7 text-xs px-2 bg-white font-mono"
                        />
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      onClick={handleAddBundleToNew}
                      className="w-full h-7 text-xs bg-zinc-850 hover:bg-zinc-800 text-white font-medium"
                    >
                      + Add Bundle Option
                    </Button>
                  </div>
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
                <TableHead className="w-[45px] px-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 rounded border-zinc-350 bg-white focus:ring-indigo-500 cursor-pointer"
                    checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = selectedProductIds.length > 0 && selectedProductIds.length < filteredProducts.length;
                      }
                    }}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProductIds(filteredProducts.map(p => p.id));
                      } else {
                        setSelectedProductIds([]);
                      }
                    }}
                    title="Select all products"
                  />
                </TableHead>
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
              {filteredProducts.map((item) => {
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
                  parseFloat(rowEdit.stock) !== stock;

                const isChecked = selectedProductIds.includes(item.id);

                return (
                <TableRow 
                  key={item.id} 
                  className={`hover:bg-zinc-50/50 cursor-pointer group ${isChecked ? 'bg-indigo-50/30' : ''}`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('input') || target.closest('button') || target.closest('[role="menuitem"]')) {
                      return;
                    }
                    if (isChecked) {
                      setSelectedProductIds(prev => prev.filter(id => id !== item.id));
                    } else {
                      setSelectedProductIds(prev => [...prev, item.id]);
                    }
                  }}
                >
                  <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProductIds(prev => [...prev, item.id]);
                        } else {
                          setSelectedProductIds(prev => prev.filter(id => id !== item.id));
                        }
                      }}
                    />
                  </TableCell>
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
                  <TableCell className="font-semibold text-zinc-900">
                    <div>{item.name}</div>
                    {item.bundles && item.bundles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 font-sans">
                        {item.bundles.map((b: any, bIdx: number) => (
                          <span key={bIdx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {b.name} ({b.pack_size || b.packSize}): ${Number(b.price || 0).toFixed(2)}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
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

                  <TableCell>{getStatusBadge(isInlineEditMode ? parseFloat(rowEdit.stock) || 0 : stock)}</TableCell>
                  
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
                        <DropdownMenuContent align="end" className="w-48 bg-white">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProduct(item);
                              setEditName(item.name || '');
                              setEditSKU(item.sku || '');
                              setEditBarcode(item.barcode || '');
                              setEditCategory(item.category_id || '');
                              setEditRetailPrice(item.retail_price?.toString() || '0');
                              setEditWholesalePrice(item.wholesale_price?.toString() || '0');
                              setEditBundles(item.bundles ? JSON.parse(JSON.stringify(item.bundles)) : []);
                            }}
                          >
                            Edit Product
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdjustingProduct(item);
                              setAdjType('add');
                              setAdjQty('1');
                            }}
                          >
                            Adjust Stock
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="text-red-600">Delete Product</DropdownMenuItem>
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

      {isLabelsOpen && (
        <PriceLabelsGenerator
          selectedProducts={products.filter((p: any) => selectedProductIds.includes(p.id))}
          selectedBranchId={selectedBranchId}
          onClose={() => setIsLabelsOpen(false)}
        />
      )}

      {/* Dynamic Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="bg-white border-zinc-250">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900 animate-in fade-in">Edit Product Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-600">Product Name *</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Mazoe Blackberry 2L" className="bg-white border-zinc-200" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-600">SKU Code</Label>
                <Input value={editSKU} onChange={e => setEditSKU(e.target.value)} placeholder="e.g. BV-MZB-2L" className="bg-white border-zinc-200 font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-600">Barcode Identifier</Label>
                <Input value={editBarcode} onChange={e => setEditBarcode(e.target.value)} placeholder="e.g. 6001234567890" className="bg-white border-zinc-200 font-mono text-xs" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-600">Inventory Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger className="bg-white border-zinc-200">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="none_clear">Uncategorized / General Catalog</SelectItem>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-600">Retail Price ($) *</Label>
                <Input type="number" step="0.01" value={editRetailPrice} onChange={e => setEditRetailPrice(e.target.value)} placeholder="0.00" className="bg-white border-zinc-200 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-600">Wholesale Price ($)</Label>
                <Input type="number" step="0.01" value={editWholesalePrice} onChange={e => setEditWholesalePrice(e.target.value)} placeholder="0.00" className="bg-white border-zinc-200 font-mono" />
              </div>
            </div>

            {/* Edit Custom Bundles section */}
            <div className="space-y-3 pt-3 border-t border-zinc-100">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-zinc-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Tag className="h-3.5 w-3.5 text-amber-500" />
                  Custom Bundles / Tier Prices
                </Label>
                <span className="text-[10px] text-zinc-400 font-medium font-mono">Multiple allowed</span>
              </div>
              
              {/* Edit Bundles List */}
              {editBundles.length > 0 && (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {editBundles.map((b, bIdx) => (
                    <div key={bIdx} className="flex justify-between items-center text-xs p-2 rounded bg-amber-50/55 border border-amber-100">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-800">{b.name}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">Pack Size: {b.pack_size || b.packSize} units | Price: ${Number(b.price || 0).toFixed(2)}</span>
                      </div>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveBundleFromEdit(bIdx)}
                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Bundle to Edit Mini-Form */}
              <div className="p-3 bg-zinc-50 border border-zinc-150 rounded-lg space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-zinc-500">Bundle Name</Label>
                    <Input 
                      placeholder="e.g. Six-Pack" 
                      value={editBundleName} 
                      onChange={e => setEditBundleName(e.target.value)}
                      className="h-7 text-xs px-2 bg-white border-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-zinc-500">Size (Units)</Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 6" 
                      value={editBundleSize} 
                      onChange={e => setEditBundleSize(e.target.value)}
                      className="h-7 text-xs px-2 bg-white border-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-zinc-500">Price ($)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      value={editBundlePrice} 
                      onChange={e => setEditBundlePrice(e.target.value)}
                      className="h-7 text-xs px-2 bg-white font-mono border-zinc-200"
                    />
                  </div>
                </div>
                <Button 
                  type="button" 
                  onClick={handleAddBundleToEdit}
                  className="w-full h-7 text-xs bg-zinc-850 hover:bg-zinc-800 text-white font-medium"
                >
                  + Add Bundle Option
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button variant="outline" className="bg-white border-zinc-200 text-zinc-600" onClick={() => setEditingProduct(null)}>Cancel</Button>
            <Button onClick={handleEditProduct} className="bg-zinc-900 text-white hover:bg-zinc-800">Save Product Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Inventory Stock Level Dialog */}
      <Dialog open={!!adjustingProduct} onOpenChange={(open) => !open && setAdjustingProduct(null)}>
        <DialogContent className="bg-white border-zinc-250 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">Adjust Stock Level</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3">
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200/60 flex flex-col gap-1 text-xs">
              <div><span className="font-semibold text-zinc-500">Product:</span> <span className="font-bold text-zinc-900">{adjustingProduct?.name}</span></div>
              <div><span className="font-semibold text-zinc-500">Branch:</span> <span className="font-bold text-zinc-900">{branches.find(b => b.id === selectedBranchId)?.name || 'Default Branch'}</span></div>
              <div>
                <span className="font-semibold text-zinc-500">Current Level:</span>{' '}
                <span className="font-black text-indigo-755 font-mono text-[13px]">
                  {(() => {
                    const rec = selectedBranchId 
                      ? adjustingProduct?.inventory?.find((i: any) => i.branch_id === selectedBranchId)
                      : adjustingProduct?.inventory?.[0];
                    return rec ? rec.quantity : 0;
                  })()}{' '}
                  units
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-600 font-bold uppercase text-[10px] tracking-wider">Adjustment Action Type</Label>
              <Select value={adjType} onValueChange={(val: any) => setAdjType(val)}>
                <SelectTrigger className="bg-white border-zinc-200">
                  <SelectValue placeholder="Select Action" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="add">Add Stock Segment (+)</SelectItem>
                  <SelectItem value="subtract">Deduct / Shrink Stock (-)</SelectItem>
                  <SelectItem value="set">Overrule / Set Exact Stock (=)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-650 font-bold uppercase text-[10px] tracking-wider">Adjustment Quantity (units)</Label>
              <Input type="number" min="1" value={adjQty} onChange={e => setAdjQty(e.target.value)} className="bg-white font-mono text-sm border-zinc-200" />
            </div>
          </div>
          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button variant="outline" className="bg-white border-zinc-200" onClick={() => setAdjustingProduct(null)}>Cancel</Button>
            <Button onClick={handleAdjustStock} className="bg-zinc-900 text-white hover:bg-zinc-800 font-semibold">Apply Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
