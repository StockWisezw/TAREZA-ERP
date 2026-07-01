import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Mic, 
  MicOff, 
  Barcode, 
  Package, 
  Tag,
  LayoutGrid,
  List
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Product, getPackSize } from '../../store/posStore';

interface ProductGridProps {
  products: Product[];
  categories: any[];
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isListening: boolean;
  speechSupported: boolean;
  startVoiceSearch: () => void;
  addToCart: (product: Product, quantity: number, forcedTier: string) => void;
  isLoading: boolean;
  filteredProducts: Product[];
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  categories,
  activeCategory,
  setActiveCategory,
  searchTerm,
  setSearchTerm,
  isListening,
  speechSupported,
  startVoiceSearch,
  addToCart,
  isLoading,
  filteredProducts
}) => {
  const [selectedTiers, setSelectedTiers] = useState<Record<string, string>>({});
  const [expandedBundles, setExpandedBundles] = useState<Record<string, boolean>>({});
  const [gridScale, setGridScale] = useState<'cozy' | 'comfortable' | 'compact'>('comfortable');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 1024 ? 'list' : 'grid';
  });
  const [selectedProductForPack, setSelectedProductForPack] = useState<Product | null>(null);

  // Helper to calculate virtual stock dynamically for BOM bundles
  const getVirtualStock = (prod: Product, allProducts: Product[]): number => {
    const bomBundle = prod.bundles?.find((b: any) => b.is_bom);
    if (bomBundle && bomBundle.bom_composition && bomBundle.bom_composition.length > 0) {
      let minStock = Infinity;
      for (const comp of bomBundle.bom_composition) {
        const compProduct = allProducts.find(x => x.id === comp.product_id || x.sku === comp.sku);
        const compStock = compProduct ? (compProduct.stock ?? 0) : 0;
        const compAvailable = Math.floor(compStock / comp.quantity);
        if (compAvailable < minStock) {
          minStock = compAvailable;
        }
      }
      return minStock === Infinity ? 0 : minStock;
    }
    return prod.stock ?? 0;
  };

  // Transform products with packs/bundles into individual sub-product representations
  const sellableItems = useMemo(() => {
    const items: any[] = [];
    filteredProducts.forEach((product) => {
      const pSize = getPackSize(product.sku);
      const hasPack = pSize > 1;
      const bomBundle = product.bundles?.find((b: any) => b.is_bom);
      const hasBundles = product.bundles && product.bundles.length > 0 && !bomBundle;

      const isBOM = !!bomBundle;
      const virtualStock = getVirtualStock(product, products);

      // Always add the single/main product
      items.push({
        id: product.id,
        originalProduct: product,
        name: product.name,
        sku: product.sku,
        price: product.retailPrice,
        wholesalePrice: product.wholesalePrice,
        tier: 'retail',
        stockDisplay: isBOM 
          ? `${virtualStock} units (Virtual)` 
          : (product.stock !== undefined ? `${product.stock} units` : undefined),
        isSubProduct: false,
        pSize: 1,
        taxClass: product.taxClass,
        category: product.category,
        hasPacksOrBundles: (hasPack || hasBundles) && !isBOM,
      });

      // ONLY generate sub-products for packs and bundles if there is an active search term AND it is not a virtual BOM kit
      if (searchTerm.trim() !== '' && !isBOM) {
        // 1. Single Unit Sub-Product (for explicit search context)
        items.push({
          id: `${product.id}-single`,
          originalProduct: product,
          name: `${product.name} (Single)`,
          sku: `${product.sku}-SG`,
          price: product.retailPrice,
          wholesalePrice: product.wholesalePrice,
          tier: 'retail',
          stockDisplay: product.stock !== undefined ? `${product.stock} units` : undefined,
          isSubProduct: true,
          subType: 'single',
          pSize: 1,
          taxClass: product.taxClass,
          category: product.category,
        });

        // 2. Pack Sub-Product
        if (hasPack) {
          const packStock = product.stock !== undefined 
            ? `${Math.floor(product.stock / pSize)} packs (${product.stock} units)` 
            : undefined;
          items.push({
            id: `${product.id}-pack`,
            originalProduct: product,
            name: `${product.name} (Pack of ${pSize})`,
            sku: `${product.sku}-PK${pSize}`,
            price: product.wholesalePrice,
            wholesalePrice: product.wholesalePrice,
            tier: 'wholesale',
            stockDisplay: packStock,
            isSubProduct: true,
            subType: 'pack',
            pSize: pSize,
            taxClass: product.taxClass,
            category: product.category,
          });
        }

        // 3. Bundle Sub-Products
        if (hasBundles) {
          product.bundles?.forEach((b: any, bIdx: number) => {
            const bSize = Number(b.pack_size || b.packSize || 1);
            const bundleStock = product.stock !== undefined 
              ? `${Math.floor(product.stock / bSize)} bundles (${product.stock} units)` 
              : undefined;
            items.push({
              id: `${product.id}-bundle-${bIdx}`,
              originalProduct: product,
              name: `${product.name} (${b.name})`,
              sku: `${product.sku}-BD${bSize}`,
              price: Number(b.price || 0),
              wholesalePrice: product.wholesalePrice,
              tier: b.name,
              stockDisplay: bundleStock,
              isSubProduct: true,
              subType: 'bundle',
              pSize: bSize,
              taxClass: product.taxClass,
              category: product.category,
            });
          });
        }
      }
    });
    return items;
  }, [filteredProducts, searchTerm, products]);

  let gridColsClass = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4";
  if (gridScale === 'compact') {
    gridColsClass = "grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
  } else if (gridScale === 'cozy') {
    gridColsClass = "grid-cols-2 sm:grid-cols-2 xl:grid-cols-3";
  }

  return (
    <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden h-full">
      {/* Top Search Bar Area */}
      <div className="p-3 border-b border-zinc-200 bg-zinc-50/50">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-zinc-400">
            <Search className="h-4 w-4" />
          </span>
          <Input
            type="text"
            placeholder="Search items by Name, Barcode [F7], Brand name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-20 py-2.5 my-0.5 rounded-xl border border-zinc-200 shadow-sm focus-visible:ring-primary/20 text-xs font-semibold bg-white"
          />
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={startVoiceSearch}
            className={`absolute right-10 top-0.5 h-9 w-9 p-0 rounded-lg ${isListening ? 'bg-red-50 text-red-500 animate-pulse' : 'text-zinc-400 hover:text-zinc-600'}`}
            title="Voice Assistant Search/Checkout Commands"
          >
            {isListening ? (
              <Mic className="h-4.5 w-4.5 text-rose-500" />
            ) : (
              <MicOff className="h-4.5 w-4.5 text-zinc-400" />
            )}
          </Button>
          <Button size="icon" variant="ghost" className="absolute right-1.5 top-0.5 h-9 w-9 text-zinc-400 hover:text-zinc-650 p-0 rounded-lg">
            <Barcode className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Categories & Density/List Controls */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mt-2">
          <div className="flex-1 flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 py-1 px-3.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  activeCategory === cat.id 
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm' 
                  : 'border-zinc-200 bg-white text-zinc-650 hover:border-zinc-300 hover:bg-zinc-50/80'
                }`}
              >
                <span className="scale-75 text-zinc-400 opacity-80">{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
          
          <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-auto">
            {/* View Mode Toggle: Grid/List */}
            <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded-md cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-750'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded-md cursor-pointer transition-all ${viewMode === 'list' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-750'}`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {viewMode === 'grid' && (
              <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg select-none border border-zinc-200">
                <button 
                  type="button" 
                  onClick={() => setGridScale('cozy')}
                  className={`px-2 py-1 text-[9px] font-black rounded-md cursor-pointer transition-all ${gridScale === 'cozy' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-705'}`}
                  title="Cozy Grid (Larger Display)"
                >
                  Cozy
                </button>
                <button 
                  type="button" 
                  onClick={() => setGridScale('comfortable')}
                  className={`px-2 py-1 text-[9px] font-black rounded-md cursor-pointer transition-all ${gridScale === 'comfortable' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-705'}`}
                  title="Fit Grid (Standard Display)"
                >
                  Fit
                </button>
                <button 
                  type="button" 
                  onClick={() => setGridScale('compact')}
                  className={`px-2 py-1 text-[9px] font-black rounded-md cursor-pointer transition-all ${gridScale === 'compact' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-705'}`}
                  title="Tiny Grid (Most Products)"
                >
                  Tiny
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main product catalogue view area */}
      <div className="flex-1 overflow-y-auto p-3">
        {viewMode === 'list' ? (
          <div className="flex flex-col gap-1.5 min-w-full">
            {isLoading && filteredProducts.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-white border border-zinc-150 rounded-xl p-3 flex items-center justify-between h-14">
                  <div className="flex items-center gap-3 w-2/3">
                    <div className="w-8.5 h-8.5 bg-zinc-100 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-zinc-100 rounded w-1/2" />
                      <div className="h-2 bg-zinc-100 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="h-6 bg-zinc-100 rounded w-1/4" />
                </div>
              ))
            ) : sellableItems.map((item) => {
              const bgColors = [
                'bg-rose-50 border border-rose-100 text-rose-600', 
                'bg-blue-50 border border-blue-100 text-blue-600', 
                'bg-emerald-50 border border-emerald-100 text-emerald-600', 
                'bg-amber-50 border border-amber-100 text-amber-600', 
                'bg-purple-50 border border-purple-100 text-purple-600', 
                'bg-indigo-50 border border-indigo-100 text-indigo-600', 
                'bg-cyan-50 border border-cyan-100 text-cyan-600'
              ];
              const colorClass = bgColors[item.originalProduct.name.charCodeAt(0) % bgColors.length];

              return (
                <div 
                  key={item.id}
                  onClick={() => {
                    if (!item.isSubProduct && item.hasPacksOrBundles) {
                      setSelectedProductForPack(item.originalProduct);
                    } else {
                      addToCart(item.originalProduct, 1, item.tier);
                    }
                  }}
                  className="group flex flex-col md:flex-row md:items-center justify-between p-2.5 bg-white border border-zinc-200 hover:border-zinc-350 active:bg-zinc-50 rounded-xl transition-all cursor-pointer hover:shadow-2xs gap-2"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Package className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-350 opacity-80" />
                    </div>
                    <div className="overflow-hidden min-w-0">
                      <h4 className="font-bold text-xs text-zinc-900 group-hover:text-blue-600 transition-colors truncate">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5 whitespace-nowrap">
                        <span>{item.sku}</span>
                        {item.stockDisplay !== undefined && (
                          <span className={`${item.stockDisplay.includes('Virtual') ? 'text-indigo-600' : 'text-emerald-600'} font-bold`}>
                            • {item.stockDisplay}
                          </span>
                        )}
                        {item.isSubProduct && (
                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-zinc-50 text-zinc-650 border-zinc-200 ml-1">
                            {item.subType === 'pack' ? 'Pack' : item.subType === 'bundle' ? 'Bundle' : 'Single'}
                          </Badge>
                        )}
                      </div>
                      {(() => {
                        const bomBundle = item.originalProduct.bundles?.find((b: any) => b.is_bom);
                        if (bomBundle && bomBundle.bom_composition) {
                          return (
                            <div className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 font-semibold px-1.5 py-0.5 rounded mt-1.5 inline-block whitespace-normal break-words max-w-full">
                              <span className="font-bold">BOM:</span>{" "}
                              {bomBundle.bom_composition.map((comp: any) => `${comp.quantity}x ${comp.sku}`).join(" + ")}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="text-left md:text-right">
                      <span className="font-bold text-xs text-zinc-900">${item.price.toFixed(2)}</span>
                    </div>

                    <Button 
                      size="sm"
                      className="text-[10px] h-7 px-2.5 font-bold bg-zinc-900 hover:bg-zinc-855 text-white rounded-lg cursor-pointer flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!item.isSubProduct && item.hasPacksOrBundles) {
                          setSelectedProductForPack(item.originalProduct);
                        } else {
                          addToCart(item.originalProduct, 1, item.tier);
                        }
                      }}
                    >
                      <span>+ Add</span>
                    </Button>
                  </div>
                </div>
              );
            })}

            {sellableItems.length === 0 && !isLoading && (
              <div className="py-20 flex flex-col items-center justify-center text-zinc-500 text-center">
                <Package className="w-12 h-12 text-zinc-300 mb-4" />
                <p className="text-sm font-semibold text-zinc-700">No products found</p>
                <p className="text-xs text-zinc-400 mt-1">Try adjusting your search or category filter</p>
              </div>
            )}
          </div>
        ) : (
          <div className={`grid ${gridColsClass} gap-3 bg-white`}>
            {isLoading && filteredProducts.length === 0 ? (
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-white border border-zinc-150 rounded-xl overflow-hidden flex flex-col h-[180px]">
                  <div className="h-11 bg-zinc-100" />
                  <div className="p-2 flex flex-col flex-1 gap-2">
                    <div className="h-3 bg-zinc-100 rounded w-3/4" />
                    <div className="h-2 bg-zinc-100 rounded w-1/2" />
                    <div className="h-2 bg-zinc-50 rounded w-1/3 mt-1" />
                    <div className="mt-auto h-6 bg-zinc-100 rounded-lg w-full" />
                  </div>
                </div>
              ))
            ) : sellableItems.map((item) => {
              const bgColors = [
                'bg-rose-100 text-rose-600', 
                'bg-blue-100 text-blue-600', 
                'bg-emerald-100 text-emerald-600', 
                'bg-amber-100 text-amber-600', 
                'bg-purple-100 text-purple-600', 
                'bg-indigo-100 text-indigo-600', 
                'bg-cyan-100 text-cyan-600'
              ];
              const colorClass = bgColors[item.originalProduct.name.charCodeAt(0) % bgColors.length];

              return (
                <div 
                  key={item.id}
                  onClick={() => {
                    if (!item.isSubProduct && item.hasPacksOrBundles) {
                      setSelectedProductForPack(item.originalProduct);
                    } else {
                      addToCart(item.originalProduct, 1, item.tier);
                    }
                  }}
                  className="group relative bg-white border border-zinc-200 rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col cursor-pointer hover:border-zinc-400"
                >
                  <div className={`h-11 relative overflow-hidden flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Package className="w-5 h-5 group-hover:scale-110 transition-transform duration-300 opacity-80" />
                    {item.taxClass && item.taxClass !== 'standard' && (
                      <Badge variant="secondary" className="absolute top-1 left-1 text-[8px] h-3 px-1 bg-white/90 backdrop-blur-sm border-zinc-200 text-zinc-700">
                        {item.taxClass}
                      </Badge>
                    )}
                    {item.isSubProduct && (
                      <Badge className={`absolute top-1 right-1 text-[8px] h-3.5 px-1 border-0 text-white font-semibold shadow-sm ${
                        item.subType === 'pack' ? 'bg-purple-600' : item.subType === 'bundle' ? 'bg-pink-600' : 'bg-zinc-600'
                      }`}>
                        {item.subType === 'pack' ? 'Pack' : item.subType === 'bundle' ? 'Bundle' : 'Single'}
                      </Badge>
                    )}
                  </div>
                  <div className="p-1.5 flex flex-col flex-1">
                    <h4 className="font-semibold text-xs text-zinc-800 line-clamp-2 leading-tight min-h-[1.75rem] mb-0.5">
                      {item.name}
                    </h4>
                    <p className="text-[10px] text-zinc-400 font-mono leading-none mb-1">
                      {item.sku}
                    </p>
                    
                    {(() => {
                      const bomBundle = item.originalProduct.bundles?.find((b: any) => b.is_bom);
                      if (bomBundle && bomBundle.bom_composition) {
                        return (
                          <div className="text-[8.5px] text-indigo-650 bg-indigo-50 border border-indigo-100/60 font-semibold px-1 py-0.5 rounded mb-1.5 leading-tight whitespace-normal break-words">
                            <span className="font-extrabold">BOM:</span>{" "}
                            {bomBundle.bom_composition.map((comp: any) => `${comp.quantity}x ${comp.sku}`).join(" + ")}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {item.stockDisplay !== undefined && (
                      <div className="flex flex-col gap-0.5 mb-1 mt-auto">
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-mono font-semibold ${item.stockDisplay.includes('Virtual') ? 'text-indigo-600' : 'text-zinc-500'}`}>
                            {item.stockDisplay}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-auto pt-1 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <span className="font-bold text-xs text-zinc-950 leading-none">
                        ${item.price.toFixed(2)}
                      </span>
                      <Button 
                        size="icon" 
                        className="h-5 w-5 rounded-full bg-zinc-900 hover:bg-zinc-855 text-white flex items-center justify-center p-0 cursor-pointer"
                        onClick={() => {
                          if (!item.isSubProduct && item.hasPacksOrBundles) {
                            setSelectedProductForPack(item.originalProduct);
                          } else {
                            addToCart(item.originalProduct, 1, item.tier);
                          }
                        }}
                      >
                        <span className="text-xs leading-none font-bold">+</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {sellableItems.length === 0 && !isLoading && (
               <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-500 text-center">
                 <Package className="w-12 h-12 text-zinc-300 mb-4" />
                 <p className="text-sm font-semibold text-zinc-700">No products found</p>
                 <p className="text-xs text-zinc-400 mt-1">Try adjusting your search or category filter</p>
               </div>
            )}
          </div>
        )}
      </div>

      {/* PACK / BUNDLE SELECTOR DIALOG */}
      <Dialog open={selectedProductForPack !== null} onOpenChange={(open) => { if (!open) setSelectedProductForPack(null); }}>
        <DialogContent className="max-w-md bg-white border border-zinc-200 shadow-xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
              Select Selling Option
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 font-medium">
              Choose the package or tier to add to cart for <strong className="text-zinc-800">{selectedProductForPack?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {selectedProductForPack && (() => {
            const product = selectedProductForPack;
            const pSize = getPackSize(product.sku);
            const hasPack = pSize > 1;
            const hasBundles = product.bundles && product.bundles.length > 0;

            return (
              <div className="space-y-3 mt-4">
                {/* 1. Single Unit Option */}
                <div className="flex items-center justify-between p-3.5 bg-zinc-50/50 hover:bg-zinc-50 border border-zinc-150 rounded-xl transition-all">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-800">Single Unit</span>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
                      SKU: {product.sku} • Stock: {product.stock !== undefined ? `${product.stock} units` : 'unlimited'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-900 font-mono">${product.retailPrice.toFixed(2)}</span>
                    <Button
                      size="sm"
                      className="text-[10px] h-7.5 px-3 font-semibold bg-zinc-900 hover:bg-zinc-855 text-white rounded-lg"
                      onClick={() => {
                        addToCart(product, 1, 'retail');
                        setSelectedProductForPack(null);
                      }}
                    >
                      + Add
                    </Button>
                  </div>
                </div>

                {/* 2. Pack Option */}
                {hasPack && (
                  <div className="flex items-center justify-between p-3.5 bg-purple-50/30 hover:bg-purple-50/50 border border-purple-100 rounded-xl transition-all">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-purple-600" />
                        Pack (of {pSize})
                      </span>
                      <span className="text-[10px] text-purple-500/70 font-mono mt-0.5">
                        SKU: {product.sku}-PK{pSize} • Stock: {product.stock !== undefined ? `${Math.floor(product.stock / pSize)} packs (${product.stock} units)` : 'unlimited'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-purple-950 font-mono">${product.wholesalePrice.toFixed(2)}</span>
                      <Button
                        size="sm"
                        className="text-[10px] h-7.5 px-3 font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg border-0 cursor-pointer"
                        onClick={() => {
                          addToCart(product, 1, 'wholesale');
                          setSelectedProductForPack(null);
                        }}
                      >
                        + Add Pack
                      </Button>
                    </div>
                  </div>
                )}

                {/* 3. Bundle Options */}
                {hasBundles && product.bundles?.map((b: any, bIdx: number) => {
                  const bSize = Number(b.pack_size || b.packSize || 1);
                  return (
                    <div key={bIdx} className="flex items-center justify-between p-3.5 bg-pink-50/30 hover:bg-pink-50/50 border border-pink-100 rounded-xl transition-all">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-pink-950 flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-pink-500" />
                          {b.name} ({bSize} Units)
                        </span>
                        <span className="text-[10px] text-pink-500/70 font-mono mt-0.5">
                          SKU: {product.sku}-BD{bSize} • Stock: {product.stock !== undefined ? `${Math.floor(product.stock / bSize)} bundles (${product.stock} units)` : 'unlimited'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-pink-950 font-mono">${Number(b.price || 0).toFixed(2)}</span>
                        <Button
                          size="sm"
                          className="text-[10px] h-7.5 px-3 font-semibold bg-pink-600 hover:bg-pink-700 text-white rounded-lg border-0 cursor-pointer"
                          onClick={() => {
                            addToCart(product, 1, b.name);
                            setSelectedProductForPack(null);
                          }}
                        >
                          + Add Bundle
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
