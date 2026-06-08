import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Loader2, 
  Check, 
  Sparkles, 
  FileText, 
  ArrowRight,
  Info 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '../../lib/firebaseClient';
import { toast } from 'sonner';

interface ProductImportCandidate {
  name: string;
  sku: string;
  barcode: string;
  retailPrice: string;
  wholesalePrice: string;
  costPrice: string;
  stock: string;
  category: string;
  validationError?: string;
}

export function BulkImport() {
  const [activeSubTab, setActiveSubTab] = useState<'csv' | 'manual'>('csv');
  const [importStrategy, setImportStrategy] = useState<'create' | 'update' | 'merge'>('create');
  const [businessId, setBusinessId] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [existingCategories, setExistingCategories] = useState<any[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // CSV States
  const [csvText, setCsvText] = useState('');
  const [parsedItems, setParsedItems] = useState<ProductImportCandidate[]>([]);
  const [isCsvUploaded, setIsCsvUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Spreadsheet Form Rows State
  const [manualRows, setManualRows] = useState<ProductImportCandidate[]>([
    { name: '', sku: '', barcode: '', retailPrice: '', wholesalePrice: '', costPrice: '', stock: '0', category: '' },
    { name: '', sku: '', barcode: '', retailPrice: '', wholesalePrice: '', costPrice: '', stock: '0', category: '' },
    { name: '', sku: '', barcode: '', retailPrice: '', wholesalePrice: '', costPrice: '', stock: '0', category: '' },
  ]);

  // General Processing State
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoadingConfig(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          toast.error("Authentication required to import products.");
          return;
        }

        const { data: businessData, error: businessError } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        if (businessError || !businessData) {
          toast.error("Could not trace active enterprise business details.");
          return;
        }

        const bid = businessData.business_id;
        setBusinessId(bid);

        const [branchesRes, categoriesRes] = await Promise.all([
          supabase.from('branches').select('*').eq('business_id', bid),
          supabase.from('categories').select('*').eq('business_id', bid)
        ]);

        const branchesData = branchesRes.data || [];
        setBranches(branchesData);
        if (branchesData.length > 0) {
          setSelectedBranchId(branchesData[0].id);
        }

        setExistingCategories(categoriesRes.data || []);
      } catch (err) {
        console.error("Failed to lead import settings:", err);
        toast.error("Failed loading inventory configuration.");
      } finally {
        setLoadingConfig(false);
      }
    }

    loadConfig();
  }, []);

  // Download template
  const downloadTemplate = () => {
    const headers = ['Product Name', 'SKU', 'Barcode', 'Category', 'Retail Price', 'Wholesale Price', 'Cost Price', 'Opening Stock'];
    const sampleRows = [
      ['Mazoe Blackberry 2L', 'BV-MZB-2L', '6001234567890', 'Beverages', '3.50', '3.15', '2.45', '100'],
      ['Sunlight Liquid Soap 750ml', 'HW-SLS-750', '6007654321098', 'Household', '2.20', '1.98', '1.50', '50'],
      ['Colgate Toothpaste 100ml', 'HW-CGT-100', '6009876543210', 'Personal Care', '1.80', '1.62', '1.20', '0']
    ];

    const csvContent = "\uFEFF" + headers.join(',') + "\n" + sampleRows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "tareza_product_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Standard import template downloaded successfully.");
  };

  // Helper to parse dynamic delimiter CSV
  const parseCSVContent = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0 || !lines[0].trim()) {
      toast.error("CSV text appears empty.");
      return;
    }

    // Delimiter check
    const headerLine = lines[0];
    let delimiter = ',';
    if (headerLine.includes('\t')) delimiter = '\t';
    else if (headerLine.includes(';') && !headerLine.includes(',')) delimiter = ';';

    const result: string[][] = [];
    
    // Parse considering quotes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row: string[] = [];
      let inQuotes = false;
      let cell = '';

      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        const nextChar = line[charIndex + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            cell += '"';
            charIndex++; // skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          row.push(cell.trim());
          cell = '';
        } else {
          cell += char;
        }
      }
      row.push(cell.trim());
      result.push(row);
    }

    if (result.length < 2) {
      toast.error("No product items data found besides header.");
      return;
    }

    const headers = result[0].map(h => h.toLowerCase().trim());
    
    // Auto-map indices
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('prod') || h.includes('desc'));
    const skuIdx = headers.findIndex(h => h.includes('sku') || h.includes('code') || h.includes('part'));
    const barcodeIdx = headers.findIndex(h => h.includes('barcode') || h.includes('ean') || h.includes('upc'));
    const categoryIdx = headers.findIndex(h => h.includes('cat') || h.includes('group') || h.includes('type'));
    const retailIdx = headers.findIndex(h => h.includes('retail') || h.includes('selling') || h.includes('price'));
    const wholesaleIdx = headers.findIndex(h => h.includes('wholesale') || h.includes('pack_price') || h.includes('trade'));
    const costIdx = headers.findIndex(h => h.includes('cost') || h.includes('buy') || h.includes('purchase'));
    const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('qty') || h.includes('opening'));

    if (nameIdx === -1) {
      toast.error("Required column 'Product Name' was not found in the CSV headers.");
      return;
    }

    const candidates: ProductImportCandidate[] = [];

    for (let i = 1; i < result.length; i++) {
      const row = result[i];
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;

      const name = nameIdx !== -1 ? row[nameIdx] || '' : '';
      const sku = skuIdx !== -1 ? row[skuIdx] || '' : '';
      const barcode = barcodeIdx !== -1 ? row[barcodeIdx] || '' : '';
      const category = categoryIdx !== -1 ? row[categoryIdx] || '' : '';
      const retailPrice = retailIdx !== -1 ? row[retailIdx] || '' : '';
      const wholesalePrice = wholesaleIdx !== -1 ? row[wholesaleIdx] || '' : '';
      const costPrice = costIdx !== -1 ? row[costIdx] || '' : '';
      const stock = stockIdx !== -1 ? row[stockIdx] || '0' : '0';

      // Live validation
      let error = '';
      if (!name) {
        error = "Name is required.";
      } else if (retailPrice && isNaN(parseFloat(retailPrice))) {
        error = "Retail price must be numeric.";
      } else if (wholesalePrice && isNaN(parseFloat(wholesalePrice))) {
        error = "Wholesale price must be numeric.";
      } else if (costPrice && isNaN(parseFloat(costPrice))) {
        error = "Cost price must be numeric.";
      } else if (stock && isNaN(parseFloat(stock))) {
        error = "Opening stock must be numeric.";
      }

      candidates.push({
        name,
        sku,
        barcode,
        category,
        retailPrice,
        wholesalePrice,
        costPrice,
        stock,
        validationError: error || undefined
      });
    }

    setParsedItems(candidates);
    setIsCsvUploaded(true);
    toast.success(`Succesfully parsed ${candidates.length} products from CSV. Please verify data below.`);
  };

  // CSV file change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCSVContent(text);
    };
    reader.readAsText(file);
  };

  // Manual Entry Form rows management
  const addManualRow = () => {
    setManualRows([...manualRows, {
      name: '', sku: '', barcode: '', retailPrice: '', wholesalePrice: '', costPrice: '', stock: '0', category: ''
    }]);
  };

  const removeManualRow = (index: number) => {
    if (manualRows.length <= 1) {
      toast.error("At least one row is required.");
      return;
    }
    const updated = [...manualRows];
    updated.splice(index, 1);
    setManualRows(updated);
  };

  const editManualRow = (index: number, field: keyof ProductImportCandidate, value: string) => {
    const updated = [...manualRows];
    updated[index] = {
      ...updated[index],
      [field]: value
    };

    // Recalculate validations on modification
    let error = '';
    const name = updated[index].name;
    const retail = updated[index].retailPrice;
    const wholesale = updated[index].wholesalePrice;
    const cost = updated[index].costPrice;
    const stock = updated[index].stock;

    if (!name) {
      error = "Name is required.";
    } else if (retail && isNaN(parseFloat(retail))) {
      error = "Retail price must be numeric.";
    } else if (wholesale && isNaN(parseFloat(wholesale))) {
      error = "Wholesale price must be numeric.";
    } else if (cost && isNaN(parseFloat(cost))) {
      error = "Cost price must be numeric.";
    } else if (stock && isNaN(parseFloat(stock))) {
      error = "Stock must be numeric.";
    }

    updated[index].validationError = error || undefined;
    setManualRows(updated);
  };

  // Core processing batch saver
  const executeBatchSave = async (itemsToSave: ProductImportCandidate[]) => {
    const validItems = itemsToSave.filter(i => !i.validationError && i.name);
    if (validItems.length === 0) {
      toast.error("No valid product records are filled out to import.");
      return;
    }

    if (!selectedBranchId) {
      toast.error("A target branch is required for assigning initial stock level.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveProgress({ current: 0, total: validItems.length });

      // Fetch all existing products to check for duplicates by SKU (case-insensitive)
      const { data: existingProducts, error: extProdsErr } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId);
      
      if (extProdsErr) {
        console.error("Error retrieving existing products:", extProdsErr);
      }

      const skuToProductMap = new Map<string, any>();
      if (existingProducts) {
        existingProducts.forEach(p => {
          if (p.sku) {
            skuToProductMap.set(p.sku.trim().toUpperCase(), p);
          }
        });
      }

      // Fetch existing inventory for checking stock updates
      const { data: existingInventory, error: extInvErr } = await supabase
        .from('inventory')
        .select('*')
        .eq('business_id', businessId)
        .eq('branch_id', selectedBranchId);

      if (extInvErr) {
        console.error("Error retrieving existing inventory:", extInvErr);
      }

      const productIdToInventoryMap = new Map<string, any>();
      if (existingInventory) {
        existingInventory.forEach(inv => {
          productIdToInventoryMap.set(inv.product_id, inv);
        });
      }

      // Build or fetch category mapping cache
      const categoryMapCache: Record<string, string> = {};
      const localCategories = [...existingCategories];

      // Counters
      let productsAddedCount = 0;
      let productsUpdatedCount = 0;
      let productsSkippedCount = 0;
      let inventoryUpdatedCount = 0;

      for (let k = 0; k < validItems.length; k++) {
        setSaveProgress({ current: k + 1, total: validItems.length });
        const item = validItems[k];

        // 1. Map/Create Category
        let finalCategoryId: string | null = null;
        const normCategoryName = (item.category || 'General').trim();

        if (normCategoryName) {
          // Check local cache
          if (categoryMapCache[normCategoryName]) {
            finalCategoryId = categoryMapCache[normCategoryName];
          } else {
            // Check pre-fetched categories
            const match = localCategories.find(c => c.name.toLowerCase() === normCategoryName.toLowerCase());
            if (match) {
              finalCategoryId = match.id;
              categoryMapCache[normCategoryName] = match.id;
            } else {
              // Creating Category on the fly
              const newCatId = crypto.randomUUID();
              const { data: newCat, error: catErr } = await supabase.from('categories').insert({
                id: newCatId,
                business_id: businessId,
                name: normCategoryName
              }).select().single();

              if (!catErr && newCat) {
                finalCategoryId = newCat.id;
                categoryMapCache[normCategoryName] = newCat.id;
                localCategories.push(newCat);
              } else {
                console.error("Failed on-the-fly category generation:", catErr);
              }
            }
          }
        }

        const derivedSku = (item.sku || `SKU-${normCategoryName.substring(0,2).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`).trim();
        const rPrice = parseFloat(item.retailPrice) || 0;
        const wPrice = item.wholesalePrice ? parseFloat(item.wholesalePrice) : (rPrice * 0.9);
        const cPrice = item.costPrice ? parseFloat(item.costPrice) : (rPrice * 0.7);
        const stockQty = parseFloat(item.stock) || 0;

        // Check if SKU already exists
        const existingProd = skuToProductMap.get(derivedSku.toUpperCase());
        let prodId = '';

        if (existingProd) {
          if (importStrategy === 'create') {
            productsSkippedCount++;
            continue;
          }

          // Update/Merge details of existing product
          prodId = existingProd.id;
          const { error: updateErr } = await supabase.from('products').update({
            name: item.name.trim(),
            barcode: item.barcode.trim() || null,
            category_id: finalCategoryId,
            retail_price: rPrice,
            wholesale_price: wPrice,
            cost_price: cPrice,
            is_active: true
          }).eq('id', prodId);

          if (updateErr) {
            console.error(`Failed to update product "${item.name}":`, updateErr);
            continue;
          }
          productsUpdatedCount++;
        } else {
          // Insert new product
          prodId = crypto.randomUUID();
          const { error: prodErr } = await supabase.from('products').insert({
            id: prodId,
            business_id: businessId,
            name: item.name.trim(),
            sku: derivedSku,
            barcode: item.barcode.trim() || null,
            category_id: finalCategoryId,
            retail_price: rPrice,
            wholesale_price: wPrice,
            cost_price: cPrice,
            is_active: true,
            created_at: new Date().toISOString()
          });

          if (prodErr) {
            console.error(`Failed to insert product "${item.name}":`, prodErr);
            continue;
          }
          productsAddedCount++;
        }

        // Manage inventory stock & stock movement records
        const existingInv = productIdToInventoryMap.get(prodId);

        if (existingInv) {
          let newQty = stockQty;
          if (importStrategy === 'merge') {
            newQty = (existingInv.quantity || 0) + stockQty;
          }

          const { error: invErr } = await supabase.from('inventory').update({
            quantity: newQty,
            updated_at: new Date().toISOString()
          }).eq('id', existingInv.id);

          if (!invErr) {
            inventoryUpdatedCount++;

            // Insert stock movement tracking if value adjusted
            const diff = newQty - (existingInv.quantity || 0);
            if (diff !== 0) {
              await supabase.from('stock_movements').insert({
                id: crypto.randomUUID(),
                product_id: prodId,
                branch_id: selectedBranchId,
                quantity: diff,
                type: importStrategy === 'merge' ? 'STOCK_ADJUSTMENT' : 'STOCK_CONSOLIDATION',
                created_at: new Date().toISOString()
              });
            }
          } else {
            console.error(`Failed to update inventory for product "${item.name}":`, invErr);
          }
        } else {
          // No current stock record for this branch; create it
          const { error: invErr } = await supabase.from('inventory').insert({
            id: crypto.randomUUID(),
            business_id: businessId,
            branch_id: selectedBranchId,
            product_id: prodId,
            quantity: stockQty,
            reorder_level: 5,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

          if (!invErr) {
            inventoryUpdatedCount++;

            if (stockQty > 0) {
              await supabase.from('stock_movements').insert({
                id: crypto.randomUUID(),
                product_id: prodId,
                branch_id: selectedBranchId,
                quantity: stockQty,
                type: 'STOCK_CONSOLIDATION',
                created_at: new Date().toISOString()
              });
            }
          } else {
            console.error(`Failed to create inventory for product "${item.name}":`, invErr);
          }
        }
      }

      // Build informative Toast
      let msg = `Bulk upload complete! `;
      if (productsAddedCount > 0) msg += `Created ${productsAddedCount} new products. `;
      if (productsUpdatedCount > 0) msg += `Updated/Merged ${productsUpdatedCount} existing products. `;
      if (productsSkippedCount > 0) msg += `Skipped ${productsSkippedCount} duplicates. `;
      msg += `Adjusted initial warehouse stock records for ${inventoryUpdatedCount} items.`;
      
      toast.success(msg);
      
      // Reset state based on tabs
      if (activeSubTab === 'csv') {
        setParsedItems([]);
        setCsvText('');
        setIsCsvUploaded(false);
      } else {
        setManualRows([
          { name: '', sku: '', barcode: '', retailPrice: '', wholesalePrice: '', costPrice: '', stock: '0', category: '' },
          { name: '', sku: '', barcode: '', retailPrice: '', wholesalePrice: '', costPrice: '', stock: '0', category: '' },
          { name: '', sku: '', barcode: '', retailPrice: '', wholesalePrice: '', costPrice: '', stock: '0', category: '' },
        ]);
      }

      // Re-fetch category schema configs
      const categoriesRes = await supabase.from('categories').select('*').eq('business_id', businessId);
      setExistingCategories(categoriesRes.data || []);

    } catch (err: any) {
      console.error(err);
      toast.error(`A server error occurred during product batch creation: ${err.message || 'Unknown'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingConfig) {
    return (
      <Card className="border-zinc-200">
        <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
          <p className="text-zinc-500 text-sm">Synchronizing bulk ingestion configuration...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header and Layout */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" /> Bulk Product Onboarding
          </h2>
          <p className="text-sm text-zinc-500 mt-1">Incorporate multiple catalog listings simultaneously via spreadsheet layouts or structured CSV uploads.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white shadow-sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Download Ingestion Template
          </Button>
        </div>
      </div>

      {/* Configuration context */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50 p-5 rounded-2xl border border-zinc-200/60 shadow-xs">
        <div className="space-y-2">
          <Label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Assign Initial Inventory Stock to Branch</Label>
          {branches.length > 0 ? (
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="bg-white shadow-xs border-zinc-200 mt-1 h-11 rounded-xl">
                <SelectValue placeholder="Choose target warehouse/branch" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name} ({b.address || 'No Address'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-red-500 mt-1 font-semibold">⚠️ No active business branches detected. Please create a branch in settings before importing catalog stock.</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Import Action & Duplicate SKU Strategy</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <button
              type="button"
              onClick={() => setImportStrategy('create')}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer h-16 ${
                importStrategy === 'create'
                  ? 'border-indigo-650 bg-indigo-50/50 ring-1 ring-indigo-500 text-indigo-950 font-bold'
                  : 'bg-white border-zinc-200 hover:bg-zinc-50/50 text-zinc-650'
              }`}
            >
              <span className="text-xs font-semibold">Skip Duplicates</span>
              <span className="text-[9px] text-zinc-400 mt-0.5">Create only</span>
            </button>
            
            <button
              type="button"
              onClick={() => setImportStrategy('update')}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer h-16 ${
                importStrategy === 'update'
                  ? 'border-indigo-650 bg-indigo-50/50 ring-1 ring-indigo-500 text-indigo-950 font-bold'
                  : 'bg-white border-zinc-200 hover:bg-zinc-50/50 text-zinc-650'
              }`}
            >
              <span className="text-xs font-semibold">Update details</span>
              <span className="text-[9px] text-zinc-400 mt-0.5">Overwrite stock</span>
            </button>
            
            <button
              type="button"
              onClick={() => setImportStrategy('merge')}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer h-16 ${
                importStrategy === 'merge'
                  ? 'border-indigo-650 bg-indigo-50/50 ring-1 ring-indigo-500 text-indigo-950 font-bold'
                  : 'bg-white border-zinc-200 hover:bg-zinc-50/50 text-zinc-650'
              }`}
            >
              <span className="text-xs font-semibold">Merge details</span>
              <span className="text-[9px] text-zinc-400 mt-0.5">Add stock</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic strategy description */}
      <div className="text-xs text-zinc-500 flex flex-col md:flex-row md:items-start gap-2.5 bg-zinc-50 p-4 rounded-xl border border-zinc-200/50">
        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <div>
          {importStrategy === 'create' && (
            <p>
              <strong>Skip Duplicates Strategy:</strong> For existing matching SKUs, no details are overwritten and no stock is updated. Great for safely adding only net-new items.
            </p>
          )}
          {importStrategy === 'update' && (
            <p>
              <strong>Update Details & Overwrite Stock Strategy:</strong> Updates prices, name, and barcode for matching SKUs. Stock levels at the chosen branch will be <strong>replaced/overwritten</strong> with the imported stock.
            </p>
          )}
          {importStrategy === 'merge' && (
            <p>
              <strong>Merge Details & Add Stock Strategy:</strong> Updates product details for matching SKUs, and <strong>adds/integrates</strong> the imported stock quantity directly into your existing store levels.
            </p>
          )}
        </div>
      </div>

      {/* Sub tabs view trigger */}
      <div className="flex border-b border-zinc-200">
        <button 
          onClick={() => setActiveSubTab('csv')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeSubTab === 'csv' ? 'border-zinc-950 text-zinc-950' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
        >
          <FileSpreadsheet className="w-4 h-4" /> CSV/Spreadsheet Bulk Upload
        </button>
        <button 
          onClick={() => setActiveSubTab('manual')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeSubTab === 'manual' ? 'border-zinc-950 text-zinc-950' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
        >
          <Plus className="w-4 h-4" /> Fast Multi-Row Form Grid
        </button>
      </div>

      {isSaving && (
        <Card className="border-indigo-150 bg-indigo-50/20 shadow-sm animate-pulse">
          <CardContent className="flex items-center gap-4 py-4 justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <p className="text-sm font-medium text-zinc-900">
                Saving inventory batch: <span className="font-bold text-indigo-700">{saveProgress.current}</span> of <span className="font-bold">{saveProgress.total}</span> products created...
              </p>
            </div>
            <div className="w-1/3 bg-zinc-200 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(saveProgress.current / saveProgress.total) * 100}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Panel Ingest */}
      {activeSubTab === 'csv' && (
        <div className="space-y-6">
          {!isCsvUploaded ? (
            <div className="space-y-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".csv" 
                className="hidden" 
              />
              <Card 
                className="border-2 border-dashed border-zinc-300 bg-white hover:bg-zinc-50/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="h-16 w-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                    <UploadCloud className="h-8 w-8 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 mb-1">Click to upload spreadsheet or drag & drop</h3>
                  <p className="text-sm text-zinc-500 mb-5 text-center max-w-sm">
                    Support for CSV document formats. Ensure headers map logically to standard fields.
                  </p>
                  <Button type="button" variant="outline" className="bg-white">Browse Local System</Button>
                </CardContent>
              </Card>

              {/* Paste raw option */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1"><FileText className="w-4 h-4 text-zinc-400" /> Alternately: Paste raw CSV/Tab-Separated text values</Label>
                <textarea 
                  rows={4}
                  className="w-full rounded-lg border border-zinc-200 p-3 text-xs font-mono focus:border-zinc-300 focus:outline-none"
                  placeholder="&quot;Product Name&quot;,&quot;SKU&quot;,&quot;Barcode&quot;,&quot;Category&quot;,&quot;Retail Price&quot;&#10;My Product,MY-SKU-1,1234567,Beverages,3.99"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
                {csvText.trim() && (
                  <Button size="sm" className="shadow-sm" onClick={() => parseCSVContent(csvText)}>Parse Text Values</Button>
                )}
              </div>
            </div>
          ) : (
            <Card className="border-zinc-200">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-50/80 border-b pb-4">
                <div>
                  <CardTitle className="text-lg">CSV Review & Validate</CardTitle>
                  <CardDescription>Verify raw contents extracted from file. Click rows to edit values directly, then click finalize.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    setParsedItems([]);
                    setCsvText('');
                    setIsCsvUploaded(false);
                  }}>Discard & Upload New</Button>
                  <Button 
                    size="sm" 
                    className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold"
                    onClick={() => executeBatchSave(parsedItems)}
                    disabled={isSaving}
                  >
                    Confirm Import ({parsedItems.filter(i => !i.validationError).length} valid items) <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto max-h-[450px]">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-zinc-50 border-b font-semibold text-zinc-700 sticky top-0">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Product Name *</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3 text-right">Retail ($) *</th>
                      <th className="p-3 text-right">Wholesale ($)</th>
                      <th className="p-3 text-right">Cost ($)</th>
                      <th className="p-3 text-right">Stock</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-zinc-50/30">
                        <td className="p-3 font-mono text-zinc-400 text-xs">{idx + 1}</td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            className="bg-transparent border-0 border-b border-transparent focus:border-zinc-300 focus:outline-none w-full font-semibold"
                            value={item.name} 
                            onChange={(e) => {
                              const updated = [...parsedItems];
                              updated[idx].name = e.target.value;
                              updated[idx].validationError = e.target.value ? undefined : "Name is required.";
                              setParsedItems(updated);
                            }}
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            className="bg-transparent border-0 border-b border-transparent focus:border-zinc-300 focus:outline-none w-28 font-mono text-xs"
                            value={item.sku} 
                            onChange={(e) => {
                              const updated = [...parsedItems];
                              updated[idx].sku = e.target.value;
                              setParsedItems(updated);
                            }}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input 
                            type="text" 
                            className="bg-transparent border-0 border-b border-transparent focus:border-zinc-300 focus:outline-none w-16 text-right font-mono"
                            value={item.retailPrice} 
                            onChange={(e) => {
                              const updated = [...parsedItems];
                              updated[idx].retailPrice = e.target.value;
                              const val = parseFloat(e.target.value);
                              updated[idx].validationError = isNaN(val) ? "Price must be numeric." : undefined;
                              setParsedItems(updated);
                            }}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input 
                            type="text" 
                            className="bg-transparent border-0 border-b border-transparent focus:border-zinc-300 focus:outline-none w-16 text-right font-mono text-zinc-500"
                            value={item.wholesalePrice} 
                            placeholder={item.retailPrice ? (parseFloat(item.retailPrice) * 0.9).toFixed(2) : '-'}
                            onChange={(e) => {
                              const updated = [...parsedItems];
                              updated[idx].wholesalePrice = e.target.value;
                              setParsedItems(updated);
                            }}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input 
                            type="text" 
                            className="bg-transparent border-0 border-b border-transparent focus:border-zinc-300 focus:outline-none w-16 text-right font-mono text-zinc-500"
                            value={item.costPrice} 
                            placeholder={item.retailPrice ? (parseFloat(item.retailPrice) * 0.7).toFixed(2) : '-'}
                            onChange={(e) => {
                              const updated = [...parsedItems];
                              updated[idx].costPrice = e.target.value;
                              setParsedItems(updated);
                            }}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input 
                            type="text" 
                            className="bg-transparent border-0 border-b border-transparent focus:border-zinc-300 focus:outline-none w-14 text-right font-mono"
                            value={item.stock} 
                            onChange={(e) => {
                              const updated = [...parsedItems];
                              updated[idx].stock = e.target.value;
                              setParsedItems(updated);
                            }}
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            className="bg-transparent border-0 border-b border-transparent focus:border-zinc-300 focus:outline-none w-24 text-zinc-600"
                            value={item.category} 
                            onChange={(e) => {
                              const updated = [...parsedItems];
                              updated[idx].category = e.target.value;
                              setParsedItems(updated);
                            }}
                          />
                        </td>
                        <td className="p-3">
                          {item.validationError ? (
                            <Badge className="bg-red-50 text-red-700 border border-red-200/50 hover:bg-red-50 font-normal">
                              {item.validationError}
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200/40 hover:bg-emerald-50">
                              Ready
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeSubTab === 'manual' && (
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader className="bg-zinc-50/50 border-b">
            <CardTitle className="text-lg">Spreadsheet Manual Multi-Add Form</CardTitle>
            <CardDescription aria-level={2}>
              Instantly type multiple rows of products down the board. Click "Add Row" to append more slots, and save everything with one single press.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-zinc-50 border-b font-medium text-zinc-700">
                  <tr>
                    <th className="p-3 w-[50px]">#</th>
                    <th className="p-3 min-w-[220px]">Product Name *</th>
                    <th className="p-3 w-[140px]">SKU</th>
                    <th className="p-3 w-[130px]">Barcode</th>
                    <th className="p-3 w-[110px] text-right">Retail ($) *</th>
                    <th className="p-3 w-[110px] text-right">Wholesale ($)</th>
                    <th className="p-3 w-[110px] text-right">Cost ($)</th>
                    <th className="p-3 w-[90px] text-right">Opening Stock</th>
                    <th className="p-3 min-w-[130px]">Category</th>
                    <th className="p-3 text-center w-[60px]">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {manualRows.map((row, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-zinc-50/30">
                      <td className="p-3 text-zinc-400 font-mono text-xs">{idx + 1}</td>
                      <td className="p-3">
                        <Input 
                          placeholder="e.g. Sprite Zero 300ml" 
                          className={`h-9 text-xs font-semibold ${row.validationError && !row.name ? 'border-red-400' : 'border-zinc-200'}`}
                          value={row.name}
                          onChange={(e) => editManualRow(idx, 'name', e.target.value)}
                        />
                      </td>
                      <td className="p-3">
                        <Input 
                          placeholder="SKU Code" 
                          className="h-9 text-xs font-mono border-zinc-200"
                          value={row.sku}
                          onChange={(e) => editManualRow(idx, 'sku', e.target.value)}
                        />
                      </td>
                      <td className="p-3">
                        <Input 
                          placeholder="UPC Barcode" 
                          className="h-9 text-xs font-mono border-zinc-200"
                          value={row.barcode}
                          onChange={(e) => editManualRow(idx, 'barcode', e.target.value)}
                        />
                      </td>
                      <td className="p-3 text-right">
                        <Input 
                          placeholder="0.00" 
                          type="number" 
                          step="0.01"
                          className="h-9 text-xs font-mono text-right border-zinc-200"
                          value={row.retailPrice}
                          onChange={(e) => editManualRow(idx, 'retailPrice', e.target.value)}
                        />
                      </td>
                      <td className="p-3 text-right">
                        <Input 
                          placeholder="Default 90%" 
                          type="number" 
                          step="0.01"
                          className="h-9 text-xs font-mono text-right text-zinc-500 border-zinc-200"
                          value={row.wholesalePrice}
                          onChange={(e) => editManualRow(idx, 'wholesalePrice', e.target.value)}
                        />
                      </td>
                      <td className="p-3 text-right">
                        <Input 
                          placeholder="Default 70%" 
                          type="number" 
                          step="0.01"
                          className="h-9 text-xs font-mono text-right text-zinc-500 border-zinc-200"
                          value={row.costPrice}
                          onChange={(e) => editManualRow(idx, 'costPrice', e.target.value)}
                        />
                      </td>
                      <td className="p-3 text-right">
                        <Input 
                          placeholder="0" 
                          type="number" 
                          className="h-9 text-xs font-mono text-right border-zinc-200"
                          value={row.stock}
                          onChange={(e) => editManualRow(idx, 'stock', e.target.value)}
                        />
                      </td>
                      <td className="p-3">
                        <Input 
                          placeholder="e.g. Beverages" 
                          list={`cats-${idx}`}
                          className="h-9 text-xs border-zinc-200"
                          value={row.category}
                          onChange={(e) => editManualRow(idx, 'category', e.target.value)}
                        />
                        <datalist id={`cats-${idx}`}>
                          {existingCategories.map((c, i) => (
                            <option key={i} value={c.name} />
                          ))}
                        </datalist>
                      </td>
                      <td className="p-3 text-center">
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 text-center"
                          onClick={() => removeManualRow(idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 p-4 justify-between items-center bg-zinc-50 border-t">
              <Button type="button" variant="outline" className="bg-white shadow-sm" onClick={addManualRow}>
                <Plus className="w-4 h-4 mr-2" /> Add Grid Row
              </Button>
              <div className="flex items-center gap-3">
                <p className="text-xs text-zinc-500">
                  {manualRows.filter(r => r.name && !r.validationError).length} valid products filled.
                </p>
                <Button 
                  type="button" 
                  className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold"
                  disabled={isSaving}
                  onClick={() => executeBatchSave(manualRows)}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Save All Product Records
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
