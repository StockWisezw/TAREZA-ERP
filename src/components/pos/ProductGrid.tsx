import React from 'react';
import { 
  Search, 
  Mic, 
  MicOff, 
  Barcode, 
  Package, 
  Tag 
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
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
            placeholder="Search items by Name, Barcode [F7], Brand name, category..."
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
        
        {/* Categories */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1.5 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 py-1 px-3.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                activeCategory === cat.id 
                ? 'border-zinc-900 bg-zinc-90 w text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm' 
                : 'border-zinc-200 bg-white text-zinc-650 hover:border-zinc-300 hover:bg-zinc-50/80'
              }`}
            >
              <span className="scale-75 text-zinc-400 opacity-80">{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main product catalogue view area */}
      <ScrollArea className="flex-1 p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 bg-white">
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
          ) : filteredProducts.map((product) => {
            const bgColors = [
              'bg-rose-100 text-rose-600', 
              'bg-blue-100 text-blue-600', 
              'bg-emerald-100 text-emerald-600', 
              'bg-amber-100 text-amber-600', 
              'bg-purple-100 text-purple-600', 
              'bg-indigo-100 text-indigo-600', 
              'bg-cyan-100 text-cyan-600'
            ];
            const colorClass = bgColors[product.name.charCodeAt(0) % bgColors.length];
            const pSize = getPackSize(product.sku);
            const hasPack = pSize > 1;

            return (
              <div 
                key={product.id}
                onClick={() => addToCart(product, 0, 'retail')}
                className="group relative bg-white border border-zinc-200 rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col cursor-pointer hover:border-zinc-400"
              >
                <div className={`h-11 relative overflow-hidden flex items-center justify-center shrink-0 ${colorClass}`}>
                  <Package className="w-5 h-5 group-hover:scale-110 transition-transform duration-300 opacity-80" />
                  {product.taxClass && product.taxClass !== 'standard' && (
                    <Badge variant="secondary" className="absolute top-1 left-1 text-[8px] h-3 px-1 bg-white/90 backdrop-blur-sm border-zinc-200 text-zinc-700">
                      {product.taxClass}
                    </Badge>
                  )}
                  {hasPack && (
                    <Badge className="absolute top-1 right-1 text-[8px] h-3 px-1 bg-purple-600 text-white font-semibold shadow-sm border-0">
                      Pack ({pSize})
                    </Badge>
                  )}
                </div>
                <div className="p-1.5 flex flex-col flex-1">
                  <h4 className="font-semibold text-xs text-zinc-800 line-clamp-2 leading-tight min-h-[1.75rem] mb-0.5">
                    {product.name}
                  </h4>
                  <p className="text-[10px] text-zinc-400 font-mono leading-none mb-1">
                    {product.sku}
                  </p>
                  
                  {product.stock !== undefined && (
                    <div className="flex flex-col gap-0.5 mb-1">
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-mono font-semibold ${(product.stock || 0) > 0 ? 'text-zinc-500' : 'text-rose-500 font-bold'}`}>
                          Stock: {product.stock}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {((product.bundles && product.bundles.length > 0) || hasPack) ? (
                    <div className="space-y-1 mt-auto pt-1 select-none" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full text-[10px] h-6 flex justify-between px-1.5 text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-950 transition-all rounded-md"
                        onClick={() => addToCart(product, 0, 'retail')}
                      >
                        <span>+1 Unit</span>
                        <span className="font-mono font-bold">${product.retailPrice.toFixed(2)}</span>
                      </Button>
                      {hasPack && (
                        <Button 
                          size="sm" 
                          className="w-full text-[10px] h-6 flex justify-between px-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-all rounded-md"
                          onClick={() => addToCart(product, 0, 'wholesale')}
                        >
                          <span>+Pack ({pSize})</span>
                          <span className="font-mono font-bold">${product.wholesalePrice.toFixed(2)}</span>
                        </Button>
                      )}
                      {product.bundles?.map((b: any, index: number) => (
                        <Button 
                          key={index}
                          size="sm" 
                          className="w-full text-[10px] h-6 flex justify-between px-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-all rounded-md"
                          onClick={() => addToCart(product, 0, b.name)}
                        >
                          <span>+{b.name} ({b.pack_size || b.packSize})</span>
                          <span className="font-mono font-bold">${Number(b.price || 0).toFixed(2)}</span>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-auto pt-1 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <span className="font-bold text-xs text-zinc-950 leading-none">
                        ${product.retailPrice.toFixed(2)}
                      </span>
                      <Button 
                        size="icon" 
                        className="h-5 w-5 rounded-full bg-zinc-900 hover:bg-zinc-850 text-white flex items-center justify-center p-0 cursor-pointer"
                        onClick={() => addToCart(product, 0, 'retail')}
                      >
                        <span className="text-xs leading-none font-bold">+</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {filteredProducts.length === 0 && !isLoading && (
             <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-500 text-center">
               <Package className="w-12 h-12 text-zinc-300 mb-4" />
               <p className="text-sm font-semibold text-zinc-700">No products found</p>
               <p className="text-xs text-zinc-400 mt-1">Try adjusting your search or category filter</p>
             </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
