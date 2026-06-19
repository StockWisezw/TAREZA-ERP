import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Download, MoreHorizontal, Settings2, ArrowUpDown, Printer, Edit3, Check, RotateCcw, Loader2, Tag, Trash2 } from 'lucide-react';
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
import { supabase } from '../../lib/firebaseClient';
import { toast } from 'sonner';
import { ProductSchema } from '../../utils/validation';

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
  
  // Sorting State
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortAscending, setSortAscending] = useState<boolean>(true);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortAscending(!sortAscending);
    } else {
      setSortColumn(column);
      setSortAscending(true);
    }
  };
  
  // Branch configuration states
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Inline editing state
  const [isInlineEditMode, setIsInlineEditMode] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, { retail_price: string; wholesale_price: string; cost_price: string; stock: string }>>({});
  const [isSavingInline, setIsSavingInline] = useState<Record<string, boolean>>({});
  
  // Add Product Form State
  const [newProductName, setNewProductName] = useState('');
  const [newProductSKU, setNewProductSKU] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCostPrice, setNewProductCostPrice] = useState('');
  const [newProductStock, setNewProductStock] = useState('0');
  const [newReorderLevel, setNewReorderLevel] = useState('10');
  
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
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editReorderLevel, setEditReorderLevel] = useState('10');

  // Adjust Product Stock Dialog Form State
  const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null);
  const [adjType, setAdjType] = useState<'add' | 'subtract' | 'set'>('add');
  const [adjQty, setAdjQty] = useState('1');

  // Real-time Validation States
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // User Font Sizing & Table Density Fit Settings
  const [fontSize, setFontSize] = useState<number>(() => {
    const val = localStorage.getItem('products_font_size');
    return val ? parseInt(val, 10) : 11; // Default to 11px for a clean, highly compact look
  });
  const [rowPadding, setRowPadding] = useState<'normal' | 'compact' | 'supertyght'>(() => {
    return (localStorage.getItem('products_row_density') as 'normal' | 'compact' | 'supertyght') || 'supertyght'; // Default to supertyght to fit everything on one page immediately
  });
  const [fitToScreen, setFitToScreen] = useState<boolean>(() => {
    return localStorage.getItem('products_fit_to_screen') !== 'false'; // Defaults to true to stay on a single screen
  });
  const [showImages, setShowImages] = useState<boolean>(() => {
    return localStorage.getItem('products_show_images') === 'true'; // Default to false to fit better on one page, toggleable in View menu
  });

  useEffect(() => {
    if (!isAddOpen) {
      setValidationErrors({});
      return;
    }

    const dataToValidate = {
      name: newProductName,
      sku: newProductSKU || 'SKU-TEMP',
      retail_price: parseFloat(newProductPrice) || 0,
      wholesale_price: isPack ? (parseFloat(wholesalePrice) || undefined) : undefined,
      cost_price: newProductCostPrice ? (parseFloat(newProductCostPrice) || undefined) : undefined,
    };

    const result = ProductSchema.safeParse(dataToValidate);
    const newErrors: Record<string, string> = {};

    if (!result.success) {
      result.error.issues.forEach(issue => {
        const path = issue.path[0] as string;
        newErrors[path] = issue.message;
      });
    }

    if (!newProductName.trim()) {
      newErrors.name = 'Product name is required';
    }
    if (!newProductPrice) {
      newErrors.retail_price = 'Retail price is required';
    } else if (isNaN(parseFloat(newProductPrice)) || parseFloat(newProductPrice) <= 0) {
      newErrors.retail_price = 'Retail price must be positive';
    }

    if (newProductCostPrice && (isNaN(parseFloat(newProductCostPrice)) || parseFloat(newProductCostPrice) <= 0)) {
      newErrors.cost_price = 'Cost price must be positive';
    }

    setValidationErrors(newErrors);
  }, [newProductName, newProductSKU, newProductPrice, wholesalePrice, newProductCostPrice, isAddOpen, isPack]);

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

      let productsQuery = supabase.from('products').select('*').eq('is_active', true).order('name');
      if (businessId) {
        productsQuery = productsQuery.eq('business_id', businessId);
      }

      let inventoryQuery = supabase.from('inventory').select('*');
      if (businessId) {
        inventoryQuery = inventoryQuery.eq('business_id', businessId);
      }

      let categoriesQuery = supabase.from('categories').select('*');
      if (businessId) {
        categoriesQuery = categoriesQuery.eq('business_id', businessId);
      }

      const [productsRes, inventoryRes, categoriesRes, branchesRes] = await Promise.all([
        productsQuery,
        inventoryQuery,
        categoriesQuery,
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
    let isMounted = true;
    let subscriptionChannel: any = null;

    const setupSubscription = async () => {
      try {
        // Initial data load
        await fetchProducts();

        if (!isMounted) return;

        // Setup realtime subscription
        subscriptionChannel = supabase
          .channel(`inventory_${Date.now()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
            if (isMounted) {
              setTimeout(() => { if (isMounted) fetchProducts(); }, 500);
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
            if (isMounted) {
              console.log('[Inventory] Stock changed - refreshing');
              setTimeout(() => { if (isMounted) fetchProducts(); }, 300);
            }
          })
          .subscribe();
      } catch (err) {
        console.error('[Inventory] Subscription setup failed:', err);
      }
    };

    setupSubscription();

    // Handle inventory updates from POS
    const handleInventoryUpdate = () => {
      if (isMounted) fetchProducts();
    };
    window.addEventListener('inventory-update-needed', handleInventoryUpdate);

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (subscriptionChannel) {
        supabase.removeChannel(subscriptionChannel);
      }
      window.removeEventListener('inventory-update-needed', handleInventoryUpdate);
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

  const handleBatchDelete = async () => {
    if (selectedProductIds.length === 0) return;
    
    const count = selectedProductIds.length;
    if (!window.confirm(`Are you sure you want to delete the ${count} selected product(s)?`)) {
      return;
    }

    try {
      setLoading(true);
      
      const updatePromises = selectedProductIds.map(id => 
        supabase.from('products').update({ is_active: false }).eq('id', id)
      );
      
      await Promise.all(updatePromises);

      toast.success(`Successfully deleted ${count} product(s)`);
      setSelectedProductIds([]);
      await fetchProducts();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to batch delete products");
    } finally {
      setLoading(false);
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
          cost_price: parseFloat(newProductCostPrice || "0") || 0,
         bundles: bundles,
         is_active: true
       }).select().single();

       if (productError) throw productError;

       // Always establish inventory record with custom reorder level
       const stock = parseFloat(newProductStock) || 0;
       if (true) {
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
             quantity: stock,
             reorder_level: parseInt(newReorderLevel, 10) || 10,
             created_at: new Date().toISOString(),
             updated_at: new Date().toISOString()
           });
         }
       }

       toast.success("Product added successfully");
       setIsAddOpen(false);
       setBundles([]);
       setNewProductName('');
       setNewProductPrice('');
        setNewProductCostPrice('');
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
          cost_price: parseFloat(editCostPrice || "0") || 0,
          category_id: editCategory || null,
          bundles: editBundles,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingProduct.id);

      if (error) throw error;

      // Update / upsert reorder_level in the branch's inventory
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data: businessData } = await supabase
          .from('business_users')
          .select('business_id, branch_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        const branchIdToUse = selectedBranchId || businessData?.branch_id;
        const businessId = businessData?.business_id;

        if (branchIdToUse && businessId) {
          const parsedReorder = parseInt(editReorderLevel, 10);
          if (!isNaN(parsedReorder)) {
            const { data: existingRecords } = await supabase
              .from('inventory')
              .select('*')
              .eq('product_id', editingProduct.id)
              .eq('branch_id', branchIdToUse);

            if (existingRecords && existingRecords.length > 0) {
              await supabase
                .from('inventory')
                .update({
                  reorder_level: parsedReorder,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingRecords[0].id);
            } else {
              await supabase
                .from('inventory')
                .insert({
                  business_id: businessId,
                  branch_id: branchIdToUse,
                  product_id: editingProduct.id,
                  quantity: 0,
                  reorder_level: parsedReorder,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
            }
          }
        }
      }

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
    const newCost = parseFloat(rowEdit.cost_price || "0") || 0;
    const newStock = parseFloat(rowEdit.stock);

    if (isNaN(newRetail) || isNaN(newWholesale) || isNaN(newCost) || isNaN(newStock)) {
      toast.error("Please enter valid numeric values for prices, cost, and stock");
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
          cost_price: newCost,
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

  const getStatusBadge = (stock: number, reorderLevel: number = 10) => {
    if (stock <= 0) return <Badge className="bg-zinc-100 text-zinc-600 hover:bg-zinc-150 border-0">Out of Stock</Badge>;
    if (stock <= Math.max(1, Math.floor(reorderLevel / 2))) return <Badge className="bg-red-100 text-red-800 hover:bg-red-150 border-0 animate-pulse">Critical</Badge>;
    if (stock <= reorderLevel) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-150 border-0">Low Stock</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-150 border-0">In Stock</Badge>;
  };

  const filteredProducts = products.filter(item => {
    const sTerm = searchTerm.toLowerCase();
    return (
      (item.name || '').toLowerCase().includes(sTerm) ||
      (item.sku || '').toLowerCase().includes(sTerm) ||
      (item.barcode || '').toLowerCase().includes(sTerm) ||
      (item.code || '').toLowerCase().includes(sTerm)
    );
  }).sort((a, b) => {
    let valA: any = a[sortColumn];
    let valB: any = b[sortColumn];

    // Handle special computed properties like stock and category
    if (sortColumn === 'stock') {
      const stockA = selectedBranchId 
        ? a.inventory?.find((i: any) => i.branch_id === selectedBranchId)?.quantity || 0
        : a.inventory?.[0]?.quantity || 0;
      const stockB = selectedBranchId 
        ? b.inventory?.find((i: any) => i.branch_id === selectedBranchId)?.quantity || 0
        : b.inventory?.[0]?.quantity || 0;
      valA = stockA;
      valB = stockB;
    } else if (sortColumn === 'category') {
      valA = a.categories?.name || '';
      valB = b.categories?.name || '';
    }

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (valA < valB) return sortAscending ? -1 : 1;
    if (valA > valB) return sortAscending ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {/* 🚀 Dynamic High-Fidelity Custom style block for screen-fitting and font-sizes */}
      <style>{`
        .dense-table-custom th, 
        .dense-table-custom td {
          font-size: ${fontSize}px !important;
        }
        .dense-table-custom td {
          padding-top: ${rowPadding === 'supertyght' ? '3px' : rowPadding === 'compact' ? '6px' : '12px'} !important;
          padding-bottom: ${rowPadding === 'supertyght' ? '3px' : rowPadding === 'compact' ? '6px' : '12px'} !important;
          height: auto !important;
        }
        .dense-table-custom td input {
          font-size: ${fontSize}px !important;
          height: ${rowPadding === 'supertyght' ? '22px' : rowPadding === 'compact' ? '28px' : '36px'} !important;
          padding-top: 2px !important;
          padding-bottom: 2px !important;
        }
        .dense-table-custom th {
          padding-top: ${rowPadding === 'supertyght' ? '4px' : rowPadding === 'compact' ? '7px' : '12px'} !important;
          padding-bottom: ${rowPadding === 'supertyght' ? '4px' : rowPadding === 'compact' ? '7px' : '12px'} !important;
          font-size: ${fontSize}px !important;
        }
        ${!showImages ? `
          .dense-table-custom th:nth-child(2), 
          .dense-table-custom td:nth-child(2) {
            display: none !important;
          }
        ` : ''}
      `}</style>
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
                  <SelectValue placeholder="Select Branch">
                    {branches.find(b => b.id === selectedBranchId)?.name || 'Select Branch'}
                  </SelectValue>
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
          {selectedProductIds.length > 0 && (
            <Button
              variant="outline"
              className="shadow-sm border-red-200 text-red-700 bg-red-50 hover:bg-red-100/85 hover:text-red-800 transition-all font-semibold h-9 text-xs"
              onClick={handleBatchDelete}
            >
              <Trash2 className="mr-1.5 h-4 w-4 text-red-650" />
              Delete Selection ({selectedProductIds.length})
            </Button>
          )}
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
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" className="bg-white shadow-sm hover:bg-zinc-50 flex items-center gap-1.5 h-9 text-xs">
                <Settings2 className="h-4 w-4 text-zinc-500" />
                <span>View Options</span>
              </Button>
            } />
            <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 p-4 shadow-xl rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" style={{ animationDuration: '3s' }} /> Page Fit Optimizer
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">Real-time Layout</span>
              </div>

              {/* 1. Fit to Screen Switch */}
              <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex flex-col gap-0.5 max-w-[80%]">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                    Fit perfectly on one page
                  </span>
                  <span className="text-[10px] text-zinc-400 leading-normal">
                    Lock body view to screen height with internal scrolling
                  </span>
                </div>
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 text-indigo-600 rounded border-zinc-300 bg-white focus:ring-indigo-550 cursor-pointer shrink-0"
                  checked={fitToScreen}
                  onChange={(e) => {
                    setFitToScreen(e.target.checked);
                    localStorage.setItem('products_fit_to_screen', String(e.target.checked));
                  }}
                />
              </div>

              {/* 2. Font Size scale slider */}
              <div className="space-y-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Font Sizing</span>
                  <span className="font-mono font-black text-indigo-650 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded text-[11px] leading-none">
                    {fontSize}px
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase font-mono">A- (10)</span>
                  <input
                    type="range"
                    min="10"
                    max="15"
                    step="1"
                    value={fontSize}
                    onChange={(e) => {
                      setFontSize(Number(e.target.value));
                      localStorage.setItem('products_font_size', e.target.value);
                    }}
                    className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg cursor-pointer accent-indigo-605"
                  />
                  <span className="text-xs font-bold text-zinc-400 font-mono">A+ (15)</span>
                </div>
              </div>

              {/* 3. Padding density */}
              <div className="space-y-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Row Packing Density</span>
                <div className="grid grid-cols-3 gap-1.5 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-850">
                  {(['normal', 'compact', 'supertyght'] as const).map((density) => (
                    <button
                      key={density}
                      onClick={() => {
                        setRowPadding(density);
                        localStorage.setItem('products_row_density', density);
                      }}
                      className={`text-[10px] font-bold py-1.5 px-2 rounded-lg capitalize transition-all ${
                        rowPadding === density
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm font-black border border-zinc-200/50'
                          : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                    >
                      {density === 'supertyght' ? 'Ultra Compact' : density}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Optional images toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="flex flex-col gap-0.5 max-w-[80%]">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Show Product Images</span>
                  <span className="text-[10px] text-zinc-400">Omit to save screen space</span>
                </div>
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 text-indigo-600 rounded border-zinc-300 bg-white focus:ring-indigo-550 cursor-pointer shrink-0"
                  checked={showImages}
                  onChange={(e) => {
                    setShowImages(e.target.checked);
                    localStorage.setItem('products_show_images', String(e.target.checked));
                  }}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm"><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl md:max-w-2xl bg-white border-zinc-200 flex flex-col max-h-[90vh] overflow-hidden p-6 shadow-2xl rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-zinc-900">Add New Product</DialogTitle>
                <div className="mt-2.5 pb-1 flex items-center justify-between">
                  {(() => {
                    const unfilled = [
                      !!newProductName.trim(),
                      !!newProductPrice && !isNaN(parseFloat(newProductPrice)) && parseFloat(newProductPrice) > 0
                    ].filter(x => !x).length;
                    return unfilled > 0 ? (
                      <div className="w-full flex items-center justify-between bg-amber-50 border border-amber-250/60 p-2.5 rounded-xl text-[11px] text-amber-800 animate-in fade-in slide-in-from-top-1">
                        <span className="font-semibold flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                          {unfilled} required field{unfilled > 1 ? 's' : ''} left to fill
                        </span>
                        <span className="font-mono text-[10px] bg-amber-100 px-1.5 py-0.5 rounded font-bold">Progress: {((2 - unfilled) / 2 * 100).toFixed(0)}%</span>
                      </div>
                    ) : (
                      <div className="w-full flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-[11px] text-emerald-800 animate-in fade-in zoom-in-95">
                        <span className="font-semibold flex items-center gap-1.5">
                          ✓ All core information validated!
                        </span>
                        <span className="font-mono text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded font-bold">Ready</span>
                      </div>
                    );
                  })()}
                </div>
              </DialogHeader>
              <div className="space-y-4 pt-4 overflow-y-auto pr-1.5 flex-1 max-h-[calc(90vh-160px)]">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-zinc-650 flex items-center justify-between">
                    <span>Product Name *</span>
                    {validationErrors.name && (
                      <span className="text-[10px] text-red-500 font-medium font-sans animate-pulse">{validationErrors.name}</span>
                    )}
                  </Label>
                  <Input 
                    value={newProductName} 
                    onChange={e => setNewProductName(e.target.value)} 
                    className={`bg-white h-10 rounded-xl transition-all ${validationErrors.name ? 'border-red-400 focus-visible:ring-red-400 bg-red-50/10' : 'border-zinc-200'}`} 
                    placeholder="e.g. Mazoe Blackberry 2L" 
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-zinc-650">SKU</Label>
                    <Input 
                      value={newProductSKU} 
                      onChange={e => setNewProductSKU(e.target.value)} 
                      className="bg-white h-10 rounded-xl border-zinc-200 font-mono text-xs" 
                      placeholder="e.g. BV-MZB-2L" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-zinc-650 flex items-center justify-between">
                      <span>Cost ($)</span>
                    </Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={newProductCostPrice} 
                      onChange={e => setNewProductCostPrice(e.target.value)} 
                      onBlur={() => {
                        const parsed = parseFloat(newProductCostPrice);
                        if (!isNaN(parsed)) setNewProductCostPrice(parsed.toFixed(2));
                      }}
                      className={`bg-white h-10 rounded-xl transition-all font-mono text-center ${validationErrors.cost_price ? 'border-red-400' : 'border-zinc-200'}`} 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-zinc-650 flex items-center justify-between">
                      <span>Retail ($)*</span>
                    </Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={newProductPrice} 
                      onChange={e => setNewProductPrice(e.target.value)} 
                      onBlur={() => {
                        const parsed = parseFloat(newProductPrice);
                        if (!isNaN(parsed)) setNewProductPrice(parsed.toFixed(2));
                      }}
                      className={`bg-white h-10 rounded-xl transition-all font-mono text-center ${validationErrors.retail_price ? 'border-red-400 focus-visible:ring-red-400 bg-red-50/10' : 'border-zinc-200'}`} 
                      placeholder="0.00" 
                    />
                  </div>
                </div>

                {validationErrors.retail_price && (
                  <p className="text-[10px] text-red-500 font-medium text-right -mt-1.5 animate-pulse">{validationErrors.retail_price}</p>
                )}
                
                <div className="flex items-center space-x-2 pt-1">
                  <input type="checkbox" id="isPack" checked={isPack} onChange={(e) => setIsPack(e.target.checked)} className="h-4 w-4 text-primary rounded border-zinc-300" />
                  <Label htmlFor="isPack" className="font-semibold cursor-pointer text-xs text-zinc-700">Configure as Bundle/Pack</Label>
                </div>

                {isPack && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50/40 rounded-xl border border-purple-100">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-purple-950">Pack Size (Units)</Label>
                      <Input type="number" value={packSize} onChange={e => setPackSize(e.target.value)} placeholder="e.g. 10" className="h-9 text-xs border-purple-200/85" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-purple-950">Wholesale Price ($)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={wholesalePrice} 
                        onChange={e => setWholesalePrice(e.target.value)} 
                        onBlur={() => {
                          const parsed = parseFloat(wholesalePrice);
                          if (!isNaN(parsed)) setWholesalePrice(parsed.toFixed(2));
                        }}
                        placeholder="0.00" 
                        className="h-9 text-xs border-purple-200/85 font-mono" 
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-zinc-650">Initial Stock Quantity</Label>
                  <Input type="number" value={newProductStock} onChange={e => setNewProductStock(e.target.value)} className="bg-white h-10 rounded-xl border-zinc-200" placeholder="0" />
                  {isPack && <p className="text-[10px] text-zinc-450 -mt-1">Stock is measured in units. If you have 5 packs of 10, enter 50.</p>}
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
                          onBlur={() => {
                            const parsed = parseFloat(newBundlePrice);
                            if (!isNaN(parsed)) setNewBundlePrice(parsed.toFixed(2));
                          }}
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
                <Button variant="outline" className="rounded-xl" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleAddProduct} 
                  disabled={Object.keys(validationErrors).length > 0}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl"
                >
                  Save Product
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      <Card className={`border-zinc-200 shadow-sm overflow-hidden dense-table-custom ${fitToScreen ? 'flex flex-col' : ''}`}>
        <div className={fitToScreen ? "overflow-auto max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-320px)] relative" : "overflow-x-auto"}>
          <ShadcnTable>
            <TableHeader className="bg-zinc-50/95 dark:bg-zinc-900/95 border-b border-zinc-200 sticky top-0 z-10">
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
                <TableHead className="w-[140px] cursor-pointer hover:bg-zinc-100/50 select-none transition-colors" onClick={() => handleSort('sku')}>
                  <div className="flex items-center gap-1 font-semibold text-zinc-700">
                    SKU/Barcode {sortColumn === 'sku' ? (sortAscending ? '↑' : '↓') : '↕'}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-zinc-100/50 select-none transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1 font-semibold text-zinc-700">
                    Product {sortColumn === 'name' ? (sortAscending ? '↑' : '↓') : '↕'}
                  </div>
                </TableHead>
                <TableHead className="w-[120px] cursor-pointer hover:bg-zinc-100/50 select-none transition-colors" onClick={() => handleSort('category')}>
                  <div className="flex items-center gap-1 font-semibold text-zinc-700">
                    Category {sortColumn === 'category' ? (sortAscending ? '↑' : '↓') : '↕'}
                  </div>
                </TableHead>
                <TableHead className="text-right w-[95px] cursor-pointer hover:bg-zinc-100/50 select-none transition-colors" onClick={() => handleSort('stock')}>
                  <div className="flex items-center gap-1 justify-end font-semibold text-zinc-700">
                    Stock {sortColumn === 'stock' ? (sortAscending ? '↑' : '↓') : '↕'}
                  </div>
                </TableHead>
                <TableHead className="text-right w-[110px] cursor-pointer hover:bg-zinc-100/50 select-none transition-colors" onClick={() => handleSort('cost_price')}>
                  <div className="flex items-center gap-1 justify-end font-semibold text-zinc-700">
                    Cost {sortColumn === 'cost_price' ? (sortAscending ? '↑' : '↓') : '↕'}
                  </div>
                </TableHead>
                <TableHead className="text-right w-[110px] cursor-pointer hover:bg-zinc-100/50 select-none transition-colors" onClick={() => handleSort('retail_price')}>
                  <div className="flex items-center gap-1 justify-end font-semibold text-zinc-700">
                    Retail {sortColumn === 'retail_price' ? (sortAscending ? '↑' : '↓') : '↕'}
                  </div>
                </TableHead>
                <TableHead className="text-right w-[110px] cursor-pointer hover:bg-zinc-100/50 select-none transition-colors" onClick={() => handleSort('wholesale_price')}>
                  <div className="flex items-center gap-1 justify-end font-semibold text-zinc-700">
                    Wholesale {sortColumn === 'wholesale_price' ? (sortAscending ? '↑' : '↓') : '↕'}
                  </div>
                </TableHead>
                <TableHead className="text-right w-[90px] font-semibold text-zinc-700">Margin</TableHead>
                <TableHead className="text-right w-[120px] font-semibold text-zinc-700">Potential Profit</TableHead>
                <TableHead className="w-[110px] font-semibold text-zinc-700">Status</TableHead>
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
                  cost_price: item.cost_price?.toString() || '0',
                  stock: stock.toString()
                };

                const isDirty = 
                  parseFloat(rowEdit.retail_price) !== item.retail_price ||
                  parseFloat(rowEdit.wholesale_price) !== item.wholesale_price ||
                  parseFloat(rowEdit.cost_price || '0') !== (item.cost_price || 0) ||
                  parseFloat(rowEdit.stock) !== stock;

                const retailVal = isInlineEditMode ? parseFloat(rowEdit.retail_price || "0") : (item.retail_price || 0);
                const costVal = isInlineEditMode ? parseFloat(rowEdit.cost_price || "0") : (item.cost_price || 0);
                const marginPercent = retailVal > 0 ? ((retailVal - costVal) / retailVal) * 100 : 0;
                const currentStock = isInlineEditMode ? parseFloat(rowEdit.stock || "0") : stock;
                const potentialProfit = (retailVal - costVal) * currentStock;

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

                  {/* Cost Column */}
                  <TableCell className="text-right font-mono text-zinc-600">
                    {isInlineEditMode ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-zinc-400 text-xs">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={rowEdit.cost_price}
                          onChange={(e) => {
                            setEditedFields((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...rowEdit,
                                cost_price: e.target.value
                              }
                            }));
                          }}
                          className="w-20 text-right font-mono text-xs h-8 px-2 border-zinc-200 bg-white"
                        />
                      </div>
                    ) : (
                      `$${(item.cost_price || 0).toFixed(2)}`
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

                  {/* Margin Column */}
                  <TableCell className="text-right font-mono">
                    <span className={`text-xs font-semibold ${marginPercent > 0 ? 'text-emerald-600' : marginPercent < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                      {marginPercent.toFixed(1)}%
                    </span>
                  </TableCell>

                  {/* Potential Profit Column */}
                  <TableCell className="text-right font-mono font-semibold text-zinc-900">
                    <span className={potentialProfit > 0 ? 'text-emerald-700' : potentialProfit < 0 ? 'text-red-500' : 'text-zinc-400'}>
                      ${(potentialProfit > 0 ? potentialProfit : 0).toFixed(2)}
                    </span>
                  </TableCell>

                  <TableCell>
                    {getStatusBadge(
                      isInlineEditMode ? parseFloat(rowEdit.stock) || 0 : stock,
                      stockRecord ? (stockRecord.reorder_level ?? 10) : 10
                    )}
                  </TableCell>
                  
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
                              setEditCostPrice(item.cost_price?.toString() || '0');
                              setEditBundles(item.bundles ? JSON.parse(JSON.stringify(item.bundles)) : []);
                              const stockRec = selectedBranchId 
                                ? item.inventory?.find((i: any) => i.branch_id === selectedBranchId)
                                : item.inventory?.[0];
                              setEditReorderLevel(stockRec ? (stockRec.reorder_level ?? 10).toString() : '10');
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
        <DialogContent className="sm:max-w-xl md:max-w-2xl bg-white border-zinc-250 flex flex-col max-h-[90vh] overflow-hidden p-6 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900 animate-in fade-in">Edit Product Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3 overflow-y-auto pr-1.5 flex-1 max-h-[calc(90vh-160px)]">
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
                  <SelectValue placeholder="Select Category">
                    {editCategory === 'none_clear' ? 'Uncategorized / General Catalog' : (categories.find((c: any) => c.id === editCategory)?.name || 'Select Category')}
                  </SelectValue>
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

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-600">Cost Price ($)</Label>
                <Input type="number" step="0.01" value={editCostPrice} onChange={e => setEditCostPrice(e.target.value)} placeholder="0.00" className="bg-white border-zinc-200 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-600">Retail Price ($) *</Label>
                <Input type="number" step="0.01" value={editRetailPrice} onChange={e => setEditRetailPrice(e.target.value)} placeholder="0.00" className="bg-white border-zinc-200 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-600">Wholesale Price ($)</Label>
                <Input type="number" step="0.01" value={editWholesalePrice} onChange={e => setEditWholesalePrice(e.target.value)} placeholder="0.00" className="bg-white border-zinc-200 font-mono" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-600">Reorder Level (Low Stock Threshold) *</Label>
              <Input type="number" value={editReorderLevel} onChange={e => setEditReorderLevel(e.target.value)} placeholder="10" className="bg-white border-zinc-200 font-mono" />
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
        <DialogContent className="bg-white border-zinc-250 sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col p-6 shadow-xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">Adjust Stock Level</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3 overflow-y-auto pr-1 flex-1 max-h-[calc(85vh-120px)]">
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
