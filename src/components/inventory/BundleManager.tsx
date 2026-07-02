import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/firebaseClient';
import { 
  Package, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  Search, 
  Settings2, 
  Edit3, 
  ArrowRight, 
  CornerDownRight, 
  Sparkles, 
  RefreshCw,
  TrendingUp,
  DollarSign,
  AlertCircle,
  HelpCircle,
  FolderTree,
  BadgeAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { recordStockMovement } from '../../services/ledgerService';
import { useBusinessStore } from '../../store';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';

export function BundleManager() {
  const { activeBranch, currentBusiness } = useBusinessStore();
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal / Creator states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<any | null>(null);

  // Form states (Create/Edit)
  const [kitName, setKitName] = useState('');
  const [kitSku, setKitSku] = useState('');
  const [kitPrice, setKitPrice] = useState('');
  const [kitCost, setKitCost] = useState('');
  const [kitCategory, setKitCategory] = useState('');
  const [kitDescription, setKitDescription] = useState('');
  const [bomComponents, setBomComponents] = useState<any[]>([]);
  
  // Form temp component adder
  const [tempCompId, setTempCompId] = useState('');
  const [tempCompQty, setTempCompQty] = useState(1);

  // Fast restock inline state
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockComponent, setRestockComponent] = useState<any | null>(null);
  const [restockQty, setRestockQty] = useState<string>('50');

  useEffect(() => {
    if (activeBranch) {
      setSelectedBranchId(activeBranch.id);
    }
  }, [activeBranch]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      let businessId = '';

      if (userData?.user) {
        const { data: bizData } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        if (bizData) {
          businessId = bizData.business_id;
        }
      }

      if (!businessId && currentBusiness) {
        businessId = currentBusiness.id;
      }

      // Fetch all required data
      const [productsRes, inventoryRes, categoriesRes, branchesRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('name'),
        supabase.from('inventory').select('*'),
        supabase.from('categories').select('*'),
        supabase.from('branches').select('*')
      ]);

      if (productsRes.error) throw productsRes.error;

      const pData = productsRes.data || [];
      const iData = inventoryRes.data || [];
      const cData = categoriesRes.data || [];
      const bData = branchesRes.data || [];

      setBranches(bData);
      setCategories(cData);
      if (bData.length > 0 && !selectedBranchId) {
        setSelectedBranchId(bData[0].id);
      }

      // Map products with inventory and categories
      const mapped = pData.map((p: any) => {
        const pInv = iData.filter((inv: any) => inv.product_id === p.id);
        const cat = cData.find((c: any) => c.id === p.category_id);
        return {
          ...p,
          inventory: pInv.length > 0 ? pInv : [{ quantity: 0, reorder_level: 10, branch_id: selectedBranchId }],
          category_name: cat ? cat.name : 'General'
        };
      });

      setProducts(mapped);
    } catch (err: any) {
      console.error('[BundleManager] Error fetching data:', err);
      toast.error('Failed to load bundle catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranchId]);

  // Helper to resolve specific product stock and reorder level for selected branch
  const getProductStockAndReorder = (prod: any) => {
    const invRecord = prod.inventory?.find((i: any) => i.branch_id === selectedBranchId) || prod.inventory?.[0];
    return {
      stock: invRecord ? (invRecord.quantity ?? 0) : 0,
      reorderLevel: invRecord ? (invRecord.reorder_level ?? 10) : 10
    };
  };

  // Helper to compute virtual stock for a kit/bundle
  const getVirtualStock = (prod: any) => {
    const bomBundle = prod.bundles?.find((b: any) => b.is_bom);
    if (!bomBundle || !bomBundle.bom_composition || bomBundle.bom_composition.length === 0) {
      return null;
    }

    let minStock = Infinity;
    for (const comp of bomBundle.bom_composition) {
      const compProd = products.find(p => p.id === comp.product_id || p.sku === comp.sku);
      if (!compProd) {
        minStock = 0;
        break;
      }
      const { stock } = getProductStockAndReorder(compProd);
      const availableKits = Math.floor(stock / comp.quantity);
      if (availableKits < minStock) {
        minStock = availableKits;
      }
    }

    return minStock === Infinity ? 0 : minStock;
  };

  // Find all virtual kits (products containing an 'is_bom' bundle definition)
  const virtualKits = products.filter((p: any) => {
    const bom = p.bundles?.find((b: any) => b.is_bom);
    return !!bom;
  });

  // Filter kits based on search
  const filteredKits = virtualKits.filter((k: any) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return k.name.toLowerCase().includes(query) || k.sku.toLowerCase().includes(query);
  });

  // Compile active low stock component alerts specifically inside bundle components
  const lowStockAlerts = React.useMemo(() => {
    const alertsMap = new Map<string, {
      componentProduct: any;
      stock: number;
      reorderLevel: number;
      affectedKits: { kitName: string; requiredQty: number }[];
    }>();

    virtualKits.forEach((kit: any) => {
      const bomBundle = kit.bundles?.find((b: any) => b.is_bom);
      if (bomBundle && bomBundle.bom_composition) {
        bomBundle.bom_composition.forEach((comp: any) => {
          const compProd = products.find(p => p.id === comp.product_id || p.sku === comp.sku);
          if (compProd) {
            const { stock, reorderLevel } = getProductStockAndReorder(compProd);
            if (stock <= reorderLevel) {
              if (!alertsMap.has(compProd.id)) {
                alertsMap.set(compProd.id, {
                  componentProduct: compProd,
                  stock,
                  reorderLevel,
                  affectedKits: []
                });
              }
              alertsMap.get(compProd.id)!.affectedKits.push({
                kitName: kit.name,
                requiredQty: comp.quantity
              });
            }
          }
        });
      }
    });

    return Array.from(alertsMap.values());
  }, [products, virtualKits, selectedBranchId]);

  // Handle Save of New Virtual Kit
  const handleCreateKit = async () => {
    if (!kitName.trim()) {
      toast.error('Kit Name is required');
      return;
    }
    if (!kitSku.trim()) {
      toast.error('SKU is required');
      return;
    }
    const price = parseFloat(kitPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Price must be a positive number');
      return;
    }
    if (bomComponents.length === 0) {
      toast.error('Please add at least one component to define the kit');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      let businessId = '';
      if (userData?.user) {
        const { data: bizData } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();
        if (bizData) {
          businessId = bizData.business_id;
        }
      }

      if (!businessId && currentBusiness) {
        businessId = currentBusiness.id;
      }

      // Check if SKU already exists
      const existingSku = products.find(p => p.sku === kitSku);
      if (existingSku) {
        toast.error(`SKU "${kitSku}" already exists in the enterprise catalog.`);
        return;
      }

      const bundlePayload = [
        {
          name: 'BOM Kit',
          is_bom: true,
          bom_composition: bomComponents
        }
      ];

      const costVal = parseFloat(kitCost) || bomComponents.reduce((sum, comp) => {
        const prod = products.find(p => p.id === comp.product_id);
        const cost = prod?.cost_price || 0;
        return sum + (cost * comp.quantity);
      }, 0);

      // Create product
      const { data: newProd, error: prodErr } = await supabase
        .from('products')
        .insert({
          business_id: businessId,
          name: kitName,
          sku: kitSku,
          retail_price: price,
          wholesale_price: price * 0.9,
          cost_price: costVal,
          category_id: kitCategory || null,
          description: kitDescription || null,
          bundles: bundlePayload,
          is_active: true
        })
        .select()
        .single();

      if (prodErr) throw prodErr;

      // Establish empty physical inventory row (Kits always have 0 physical stock)
      if (selectedBranchId && newProd) {
        await supabase.from('inventory').insert({
          business_id: businessId,
          branch_id: selectedBranchId,
          product_id: newProd.id,
          quantity: 0,
          reorder_level: 0
        });
      }

      toast.success('BOM Virtual Kit created successfully!');
      setIsCreateOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create kit');
    }
  };

  // Handle Save of Editing Virtual Kit
  const handleEditKit = async () => {
    if (!editingKit) return;
    if (!kitName.trim()) {
      toast.error('Kit Name is required');
      return;
    }
    const price = parseFloat(kitPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Price must be a positive number');
      return;
    }
    if (bomComponents.length === 0) {
      toast.error('Please add at least one component');
      return;
    }

    try {
      const bundlePayload = [
        {
          name: 'BOM Kit',
          is_bom: true,
          bom_composition: bomComponents
        }
      ];

      const costVal = parseFloat(kitCost) || bomComponents.reduce((sum, comp) => {
        const prod = products.find(p => p.id === comp.product_id);
        const cost = prod?.cost_price || 0;
        return sum + (cost * comp.quantity);
      }, 0);

      const { error: updateErr } = await supabase
        .from('products')
        .update({
          name: kitName,
          retail_price: price,
          wholesale_price: price * 0.9,
          cost_price: costVal,
          category_id: kitCategory || null,
          description: kitDescription || null,
          bundles: bundlePayload
        })
        .eq('id', editingKit.id);

      if (updateErr) throw updateErr;

      toast.success('BOM Virtual Kit updated successfully!');
      setIsEditOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update kit');
    }
  };

  // Handle delete/de-activate kit
  const handleDeleteKit = async (kitId: string) => {
    if (!confirm('Are you sure you want to deactivate this BOM kit?')) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', kitId);

      if (error) throw error;
      toast.success('Kit deactivated successfully');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to deactivate kit');
    }
  };

  // Restock Component quick action
  const handleRestock = async () => {
    if (!restockComponent || !selectedBranchId) return;
    const qty = parseInt(restockQty, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid positive quantity');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      let businessId = '';
      if (userData?.user) {
        const { data: bizData } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();
        if (bizData) businessId = bizData.business_id;
      }

      if (!businessId && currentBusiness) {
        businessId = currentBusiness.id;
      }

      const result = await recordStockMovement(
        businessId,
        selectedBranchId,
        restockComponent.id,
        qty,
        'ADJUSTMENT',
        userData?.user?.id || 'unknown',
        `QUICK_RESTOCK_${Date.now().toString().slice(-6)}`,
        restockComponent.cost_price || 0,
        'Quick restock via Bundle Manager Alert Console'
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(`Restocked ${qty} units of ${restockComponent.name}!`);
      setIsRestockOpen(false);
      setRestockComponent(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to perform restock');
    }
  };

  const startEdit = (kit: any) => {
    setEditingKit(kit);
    setKitName(kit.name);
    setKitSku(kit.sku);
    setKitPrice(kit.retail_price?.toString() || '');
    setKitCost(kit.cost_price?.toString() || '');
    setKitCategory(kit.category_id || '');
    setKitDescription(kit.description || '');
    
    const bomBundle = kit.bundles?.find((b: any) => b.is_bom);
    setBomComponents(bomBundle ? JSON.parse(JSON.stringify(bomBundle.bom_composition || [])) : []);
    
    setTempCompId('');
    setTempCompQty(1);
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setEditingKit(null);
    setKitName('');
    setKitSku('');
    setKitPrice('');
    setKitCost('');
    setKitCategory('');
    setKitDescription('');
    setBomComponents([]);
    setTempCompId('');
    setTempCompQty(1);
  };

  // Auto-calculate cost when components list changes
  const computedCost = React.useMemo(() => {
    return bomComponents.reduce((sum, comp) => {
      const prod = products.find(p => p.id === comp.product_id);
      const cost = prod?.cost_price || 0;
      return sum + (cost * comp.quantity);
    }, 0);
  }, [bomComponents, products]);

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border-zinc-200/60 shadow-xs bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-450 uppercase tracking-wider">Total Virtual Kits</p>
              <h3 className="text-2xl font-bold text-zinc-900 font-sans mt-0.5">{virtualKits.length}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200/60 shadow-xs bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${lowStockAlerts.length > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-450 uppercase tracking-wider">Component Alerts</p>
              <h3 className="text-2xl font-bold text-zinc-900 font-sans mt-0.5">{lowStockAlerts.length}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200/60 shadow-xs bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-450 uppercase tracking-wider">Warehouse Branch</p>
              <h3 className="text-base font-bold text-zinc-850 mt-1 truncate max-w-[160px]">
                {branches.find(b => b.id === selectedBranchId)?.name || 'Loading...'}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200/60 shadow-xs bg-indigo-900 text-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-white/10 text-white rounded-xl">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">BOM Decrementing</p>
              <h3 className="text-sm font-semibold mt-1">Automatic & Real-time</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Component Alert Center */}
      {lowStockAlerts.length > 0 && (
        <Card className="border-red-150 rounded-2xl bg-red-50/20 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-red-700">
              <BadgeAlert className="h-5 w-5 text-red-500" />
              <div>
                <CardTitle className="text-base font-bold">Constituent Component Low-Stock Warning Panel</CardTitle>
                <CardDescription className="text-red-600 text-xs mt-0.5">
                  The single units below have run dry or fallen below their reorder threshold, limiting the maximum buildable virtual kits.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lowStockAlerts.map((alert) => {
                const comp = alert.componentProduct;
                return (
                  <div key={comp.id} className="bg-white border border-red-100 rounded-xl p-4 flex flex-col justify-between shadow-3xs hover:border-red-200 transition">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md uppercase font-mono tracking-wider">
                          {comp.sku}
                        </span>
                        <Badge variant="destructive" className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0">
                          {alert.stock} Left
                        </Badge>
                      </div>
                      <h4 className="font-bold text-sm text-zinc-850 mt-2 truncate">{comp.name}</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5 font-semibold">
                        Threshold: {alert.reorderLevel} units | Category: {comp.category_name}
                      </p>

                      <div className="mt-3 pt-3 border-t border-zinc-100 space-y-1">
                        <p className="text-[10px] font-bold text-indigo-900 uppercase">Affected Kits:</p>
                        <div className="max-h-[60px] overflow-y-auto space-y-1">
                          {alert.affectedKits.map((k, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[11px] text-zinc-650">
                              <span className="truncate max-w-[150px] font-medium">• {k.kitName}</span>
                              <span className="font-mono text-zinc-400 font-bold">Needs {k.requiredQty}x</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        setRestockComponent(comp);
                        setRestockQty('50');
                        setIsRestockOpen(true);
                      }}
                      className="mt-4 w-full h-8 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Restock Component
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Catalog View */}
      <Card className="rounded-2xl border-zinc-200/60 shadow-xs bg-white">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4 border-b border-zinc-100">
          <div>
            <CardTitle className="text-lg font-bold text-zinc-850">Kits & Bundles Catalog</CardTitle>
            <CardDescription className="text-zinc-500 text-xs mt-0.5">
              Define recipes and manage Bill of Materials (BOM) formulas for automated sales kit decrementing.
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search kits..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-xl border-zinc-200 bg-zinc-50/50 w-full text-xs"
              />
            </div>

            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="h-9 w-[180px] bg-white border-zinc-200 rounded-xl text-xs font-medium">
                <SelectValue placeholder="Select Warehouse" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={isCreateOpen} onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs px-4 gap-1.5 cursor-pointer">
                  <Plus className="h-4 w-4" />
                  Create New Bundle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-2xl bg-white max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-zinc-850">Create BOM Virtual Kit</DialogTitle>
                  <DialogDescription className="text-zinc-500 text-xs">
                    Virtual kits deduct component ingredients dynamically upon POS sales.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-750">Kit Name</Label>
                      <Input
                        value={kitName}
                        onChange={e => setKitName(e.target.value)}
                        placeholder="Family Pack Bundle"
                        className="h-9 border-zinc-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-750">SKU</Label>
                      <Input
                        value={kitSku}
                        onChange={e => setKitSku(e.target.value)}
                        placeholder="KIT-FAMPACK"
                        className="h-9 border-zinc-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-750">Price ($)</Label>
                      <Input
                        type="number"
                        value={kitPrice}
                        onChange={e => setKitPrice(e.target.value)}
                        placeholder="25.00"
                        className="h-9 border-zinc-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-750">Cost Price ($)</Label>
                      <Input
                        type="number"
                        value={kitCost}
                        onChange={e => setKitCost(e.target.value)}
                        placeholder={computedCost > 0 ? computedCost.toFixed(2) : '0.00'}
                        className="h-9 border-zinc-200 rounded-lg text-xs"
                      />
                      <p className="text-[10px] text-zinc-400">Leaves empty to auto-sum component costs.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-750">Category</Label>
                      <select
                        value={kitCategory}
                        onChange={e => setKitCategory(e.target.value)}
                        className="w-full text-xs h-9 px-2 bg-white border border-zinc-200 rounded-lg focus-visible:outline-hidden"
                      >
                        <option value="">General</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-750">Description</Label>
                      <Input
                        value={kitDescription}
                        onChange={e => setKitDescription(e.target.value)}
                        placeholder="Promotional sales bundle"
                        className="h-9 border-zinc-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {/* BOM Recipe Builder */}
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                    <div className="flex items-center gap-1">
                      <FolderTree className="h-4 w-4 text-indigo-500" />
                      <Label className="font-bold text-xs text-indigo-950 uppercase tracking-wide">BOM Recipe Composition</Label>
                    </div>

                    {/* Current components list */}
                    {bomComponents.length > 0 ? (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                        {bomComponents.map((comp, cIdx) => {
                          const matchedProd = products.find(p => p.id === comp.product_id || p.sku === comp.sku);
                          return (
                            <div key={cIdx} className="flex justify-between items-center text-xs p-2 rounded bg-white border border-indigo-50 shadow-3xs">
                              <div className="flex flex-col">
                                <span className="font-semibold text-zinc-800">{matchedProd?.name || comp.sku}</span>
                                <span className="text-[10px] text-zinc-450 font-mono">Qty: {comp.quantity} x SKU: {comp.sku}</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setBomComponents(prev => prev.filter((_, idx) => idx !== cIdx))}
                                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                              >
                                ×
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-zinc-450 text-center py-2">No recipe components added yet. Add some below.</p>
                    )}

                    {/* Quick add inputs */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px] font-semibold text-zinc-500">Component Product</Label>
                        <select
                          value={tempCompId}
                          onChange={e => setTempCompId(e.target.value)}
                          className="w-full text-xs h-8 px-2 bg-white border border-zinc-200 rounded-lg focus-visible:outline-hidden"
                        >
                          <option value="">-- Select Product --</option>
                          {products.filter(p => !p.bundles?.some((x: any) => x.is_bom)).map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-16 space-y-1">
                        <Label className="text-[10px] font-semibold text-zinc-500">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={tempCompQty}
                          onChange={e => setTempCompQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 text-xs bg-white text-center"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (!tempCompId) {
                            toast.error('Choose a product first');
                            return;
                          }
                          const prod = products.find(p => p.id === tempCompId);
                          if (prod) {
                            if (bomComponents.some(c => c.product_id === prod.id)) {
                              toast.error('Product already exists in BOM composition.');
                              return;
                            }
                            setBomComponents(prev => [
                              ...prev,
                              { product_id: prod.id, sku: prod.sku, quantity: tempCompQty }
                            ]);
                            setTempCompId('');
                            setTempCompQty(1);
                          }
                        }}
                        className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg px-3 flex items-center justify-center cursor-pointer"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-4 gap-2">
                  <Button variant="outline" className="rounded-xl text-xs" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold px-4 cursor-pointer" onClick={handleCreateKit}>
                    Create Virtual Kit
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-450 gap-2">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="text-xs font-semibold">Compiling BOM relations...</p>
            </div>
          ) : filteredKits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-450">
              <Layers className="h-12 w-12 text-zinc-300 mb-3" />
              <p className="text-sm font-bold text-zinc-700">No Virtual Kits Found</p>
              <p className="text-xs mt-1 text-center max-w-sm px-6">
                Define some parent products with recipe components to unlock dynamic stock management and low stock warning panels.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3 px-6">Virtual Kit Detail</th>
                    <th className="py-3 px-4">SKU / Category</th>
                    <th className="py-3 px-4">Dynamic Virtual Stock</th>
                    <th className="py-3 px-4">Cost Price / Margins</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {filteredKits.map((kit) => {
                    const virtualStock = getVirtualStock(kit);
                    const bomBundle = kit.bundles?.find((b: any) => b.is_bom);
                    const costVal = kit.cost_price || 0;
                    const margin = kit.retail_price > 0 ? ((kit.retail_price - costVal) / kit.retail_price) * 100 : 0;
                    
                    return (
                      <React.Fragment key={kit.id}>
                        <tr className="hover:bg-zinc-50/50 transition duration-150">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Layers className="h-4 w-4" />
                              </div>
                              <div>
                                <h4 className="font-bold text-zinc-850 text-sm">{kit.name}</h4>
                                <span className="text-[10px] text-zinc-450 line-clamp-1 max-w-[250px]">{kit.description || 'No description provided.'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-zinc-750">{kit.sku}</span>
                              <span className="text-[10px] text-zinc-450 mt-0.5">{kit.category_name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-100/60 font-mono font-bold py-1 px-2.5 rounded-lg">
                                {virtualStock !== null ? `${virtualStock} Kits` : '0 Kits'}
                              </Badge>
                              <span className="text-[10px] text-zinc-400 font-medium italic">Virtual</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-zinc-800">${kit.retail_price?.toFixed(2)}</span>
                                <span className="text-[10px] text-zinc-400">Retail</span>
                              </div>
                              <span className="text-[10px] text-zinc-500 font-semibold mt-0.5 flex items-center gap-1">
                                Cost: ${costVal.toFixed(2)} | 
                                <span className={margin > 20 ? 'text-emerald-600 font-bold' : 'text-zinc-600 font-bold'}>
                                  {margin.toFixed(0)}% Margin
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEdit(kit)}
                                className="h-8 w-8 text-zinc-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteKit(kit.id)}
                                className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Recipe Detail Row */}
                        <tr className="bg-zinc-50/40">
                          <td colSpan={5} className="py-3 px-6 border-b border-zinc-100">
                            <div className="pl-6 border-l-2 border-indigo-100 space-y-2">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-900 uppercase tracking-wide">
                                <FolderTree className="h-3 w-3" />
                                <span>BOM Recipe Composition</span>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-1">
                                {bomBundle?.bom_composition?.map((comp: any, idx: number) => {
                                  const compProd = products.find(p => p.id === comp.product_id || p.sku === comp.sku);
                                  const { stock, reorderLevel } = compProd ? getProductStockAndReorder(compProd) : { stock: 0, reorderLevel: 10 };
                                  const isLowStock = stock <= reorderLevel;

                                  return (
                                    <div key={idx} className="bg-white border border-zinc-150 rounded-xl p-2.5 shadow-3xs flex items-center gap-3">
                                      <div className={`p-2 rounded-lg ${isLowStock ? 'bg-red-50 text-red-500 animate-pulse' : 'bg-emerald-50 text-emerald-500'}`}>
                                        <Package className="h-3.5 w-3.5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                          <h5 className="font-bold text-zinc-850 truncate text-[11px] max-w-[100px]" title={compProd?.name || comp.sku}>
                                            {compProd?.name || comp.sku}
                                          </h5>
                                          <span className="font-mono text-[10px] text-indigo-600 font-bold bg-indigo-50/60 px-1 rounded">
                                            {comp.quantity}x
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                          <span className={`text-[10px] font-semibold ${isLowStock ? 'text-red-500' : 'text-zinc-500'}`}>
                                            Stock: {stock} / reorder {reorderLevel}
                                          </span>
                                          {isLowStock && (
                                            <Badge variant="destructive" className="text-[8px] uppercase font-bold px-1 py-0 leading-tight">
                                              Low
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Bundle Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-md rounded-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-850">Edit BOM Virtual Kit</DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              Modify details, pricing, and formula compositions for the selected virtual kit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-750">Kit Name</Label>
                <Input
                  value={kitName}
                  onChange={e => setKitName(e.target.value)}
                  className="h-9 border-zinc-200 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-750">SKU</Label>
                <Input
                  value={kitSku}
                  disabled
                  className="h-9 border-zinc-200 rounded-lg text-xs bg-zinc-50 opacity-60 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-750">Price ($)</Label>
                <Input
                  type="number"
                  value={kitPrice}
                  onChange={e => setKitPrice(e.target.value)}
                  className="h-9 border-zinc-200 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-750">Cost Price ($)</Label>
                <Input
                  type="number"
                  value={kitCost}
                  onChange={e => setKitCost(e.target.value)}
                  placeholder={computedCost > 0 ? computedCost.toFixed(2) : '0.00'}
                  className="h-9 border-zinc-200 rounded-lg text-xs"
                />
                <p className="text-[10px] text-zinc-400">Leaves empty to auto-sum component costs.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-750">Category</Label>
                <select
                  value={kitCategory}
                  onChange={e => setKitCategory(e.target.value)}
                  className="w-full text-xs h-9 px-2 bg-white border border-zinc-200 rounded-lg focus-visible:outline-hidden"
                >
                  <option value="">General</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-750">Description</Label>
                <Input
                  value={kitDescription}
                  onChange={e => setKitDescription(e.target.value)}
                  className="h-9 border-zinc-200 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* BOM Recipe Builder */}
            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
              <div className="flex items-center gap-1">
                <FolderTree className="h-4 w-4 text-indigo-500" />
                <Label className="font-bold text-xs text-indigo-950 uppercase tracking-wide">BOM Recipe Composition</Label>
              </div>

              {bomComponents.length > 0 ? (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                  {bomComponents.map((comp, cIdx) => {
                    const matchedProd = products.find(p => p.id === comp.product_id || p.sku === comp.sku);
                    return (
                      <div key={cIdx} className="flex justify-between items-center text-xs p-2 rounded bg-white border border-indigo-50 shadow-3xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-800">{matchedProd?.name || comp.sku}</span>
                          <span className="text-[10px] text-zinc-450 font-mono">Qty: {comp.quantity} x SKU: {comp.sku}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setBomComponents(prev => prev.filter((_, idx) => idx !== cIdx))}
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          ×
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-450 text-center py-2">No recipe components added yet. Add some below.</p>
              )}

              {/* Quick add inputs */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] font-semibold text-zinc-500">Component Product</Label>
                  <select
                    value={tempCompId}
                    onChange={e => setTempCompId(e.target.value)}
                    className="w-full text-xs h-8 px-2 bg-white border border-zinc-200 rounded-lg focus-visible:outline-hidden"
                  >
                    <option value="">-- Select Product --</option>
                    {products.filter(p => p.id !== editingKit?.id && !p.bundles?.some((x: any) => x.is_bom)).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-16 space-y-1">
                  <Label className="text-[10px] font-semibold text-zinc-500">Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    value={tempCompQty}
                    onChange={e => setTempCompQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-8 text-xs bg-white text-center"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!tempCompId) {
                      toast.error('Choose a product first');
                      return;
                    }
                    const prod = products.find(p => p.id === tempCompId);
                    if (prod) {
                      if (bomComponents.some(c => c.product_id === prod.id)) {
                        toast.error('Product already exists in BOM composition.');
                        return;
                      }
                      setBomComponents(prev => [
                        ...prev,
                        { product_id: prod.id, sku: prod.sku, quantity: tempCompQty }
                      ]);
                      setTempCompId('');
                      setTempCompQty(1);
                    }
                  }}
                  className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg px-3 flex items-center justify-center cursor-pointer"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl text-xs" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold px-4 cursor-pointer" onClick={handleEditKit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Restock Dialog */}
      <Dialog open={isRestockOpen} onOpenChange={(open) => {
        setIsRestockOpen(open);
        if (!open) setRestockComponent(null);
      }}>
        <DialogContent className="max-w-xs rounded-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-zinc-850 flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 text-indigo-500 animate-spin" />
              Restock Single Units
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-[11px] leading-normal">
              Log instant restock movement for component item: <span className="font-bold text-zinc-700">{restockComponent?.name}</span> ({restockComponent?.sku}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-zinc-650">Add Quantity (Units)</Label>
              <Input
                type="number"
                min="1"
                value={restockQty}
                onChange={e => setRestockQty(e.target.value)}
                className="h-9 border-zinc-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="rounded-lg text-xs h-8" onClick={() => setIsRestockOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs h-8 font-semibold" onClick={handleRestock}>
              Execute Restock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
