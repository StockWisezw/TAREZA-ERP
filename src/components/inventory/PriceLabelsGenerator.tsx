import React, { useState, useRef, useEffect } from 'react';
import { Printer, X, LayoutGrid, Sliders, Type, Settings, Check, HelpCircle, ChevronRight, Copy, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';

// Code 39 representation dictionary for generating real scanable vector barcodes.
const CODE39_PATTERNS: Record<string, string> = {
  '0': 'N N N W W N W N N', '1': 'W N N W N N N N W',
  '2': 'N N W W N N N N W', '3': 'W N W W N N N N N',
  '4': 'N N N W W N N N W', '5': 'W N N W W N N N N',
  '6': 'N N W W W N N N N', '7': 'N N N W N N W N W',
  '8': 'W N N W N N W N N', '9': 'N N W W N N W N N',
  'A': 'W N N N N W N N W', 'B': 'N N W N N W N N W',
  'C': 'W N W N N W N N N', 'D': 'N N N N W W N N W',
  'E': 'W N N N W W N N N', 'F': 'N N W N W W N N N',
  'G': 'N N N N N W W N W', 'H': 'W N N N N W W N N',
  'I': 'N N W N N W W N N', 'J': 'N N N N W W W N N',
  'K': 'W N N N N N N W W', 'L': 'N N W N N N N W W',
  'M': 'W N W N N N N W N', 'N': 'N N N N W N N W W',
  'O': 'W N N N W N N W N', 'P': 'N N W N W N N W N',
  'Q': 'N N N N N N W W W', 'R': 'W N N N N N W W N',
  'S': 'N N W N N N W W N', 'T': 'N N N N W N W W N',
  'U': 'W W N N N N N N W', 'V': 'N W W N N N N N W',
  'W': 'W W W N N N N N N', 'X': 'N W N N W N N N W',
  'Y': 'W W N N W N N N N', 'Z': 'N W W N N W N N N',
  '-': 'N W N N N N W N W', '.': 'W W N N N N W N N',
  ' ': 'N W W N N N W N N', '*': 'N W N N W N W N N',
  '$': 'N W N W N W N N N', '/': 'N W N W N N N W N',
  '+': 'N W N N N W N W N', '%': 'N N N W N W N W N'
};

// SvgBarcode renders actual high-contrast vector lines for scanning
export function SvgBarcode({ value, height = 32 }: { value: string; height?: number }) {
  if (!value) return null;
  const safeStr = value.toUpperCase().replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '');
  if (!safeStr) return null;
  
  const normValue = `*${safeStr}*`;
  let x = 0;
  const bars: { x: number; width: number }[] = [];
  const narrowWidth = 1.35;
  const wideWidth = 3.2;
  const interCharacterSpacing = narrowWidth;

  for (let i = 0; i < normValue.length; i++) {
    const char = normValue[i];
    const pattern = CODE39_PATTERNS[char];
    if (!pattern) continue;

    const parts = pattern.split(' ');
    for (let j = 0; j < parts.length; j++) {
      const isBar = j % 2 === 0;
      const isWide = parts[j] === 'W';
      const width = isWide ? wideWidth : narrowWidth;

      if (isBar) {
        bars.push({ x, width });
      }
      x += width;
    }
    x += interCharacterSpacing;
  }

  const padding = 6;
  const totalWidth = x + padding * 2;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${totalWidth} ${height}`} preserveAspectRatio="none" className="block">
      <rect width="100%" height={height} fill="white" />
      <g transform={`translate(${padding}, 0)`}>
        {bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y={0}
            width={bar.width}
            height={height}
            fill="black"
          />
        ))}
      </g>
    </svg>
  );
}

export interface PriceLabelProduct {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  retail_price: number;
  wholesale_price: number;
  categories?: { name: string } | null;
  inventory?: { quantity: number; branch_id: string }[];
}

interface PriceLabelsGeneratorProps {
  selectedProducts: PriceLabelProduct[];
  onClose: () => void;
  selectedBranchId?: string;
}

export function PriceLabelsGenerator({ selectedProducts, onClose, selectedBranchId }: PriceLabelsGeneratorProps) {
  // Configurable states
  const [storeName, setStoreName] = useState('TAREZA RETAIL');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [layoutMode, setLayoutMode] = useState<'grid-21' | 'grid-24' | 'grid-40' | 'roll-single'>('grid-24');
  const [quantityMode, setQuantityMode] = useState<'fixed' | 'stock' | 'custom'>('fixed');
  const [fixedQty, setFixedQty] = useState(1);
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  
  // Toggles for metadata fields
  const [showStoreHeader, setShowStoreHeader] = useState(true);
  const [showRetailPrice, setShowRetailPrice] = useState(true);
  const [showWholesalePrice, setShowWholesalePrice] = useState(false);
  const [showSKU, setShowSKU] = useState(true);
  const [showBarcodeVal, setShowBarcodeVal] = useState(true);
  const [showCategory, setShowCategory] = useState(false);
  const [codeType, setCodeType] = useState<'barcode' | 'qrcode' | 'none'>('barcode');
  const [showBorder, setShowBorder] = useState(true);
  
  // Style Themes
  const [designTheme, setDesignTheme] = useState<'classic' | 'modern' | 'bold-price' | 'two-tone'>('classic');

  // Load custom quantities set initially to 1 or matching stock as dynamic state
  useEffect(() => {
    const qtys: Record<string, number> = {};
    selectedProducts.forEach(p => {
      const stockRecord = selectedBranchId 
        ? p.inventory?.find((i: any) => i.branch_id === selectedBranchId)
        : p.inventory?.[0];
      const stockQty = stockRecord ? stockRecord.quantity : 0;
      qtys[p.id] = Math.max(1, stockQty);
    });
    setCustomQuantities(qtys);
  }, [selectedProducts, selectedBranchId]);

  // Map products to their final individual labels listing
  const generateLabelList = () => {
    const finalLabels: { product: PriceLabelProduct; index: number }[] = [];
    selectedProducts.forEach(product => {
      let qty = 1;
      if (quantityMode === 'fixed') {
        qty = fixedQty;
      } else if (quantityMode === 'stock') {
        const stockRecord = selectedBranchId 
          ? product.inventory?.find((i: any) => i.branch_id === selectedBranchId)
          : product.inventory?.[0];
        const stockQty = stockRecord ? stockRecord.quantity : 0;
        qty = Math.max(0, stockQty);
      } else {
        qty = customQuantities[product.id] ?? 1;
      }

      for (let i = 0; i < qty; i++) {
        finalLabels.push({ product, index: i });
      }
    });
    return finalLabels;
  };

  const labels = generateLabelList();

  // Standard layouts configuration
  // Grid models define columns count, size styles, and spacing
  const getLayoutSpecs = () => {
    switch (layoutMode) {
      case 'grid-40': // 4 columns x 10 rows
        return {
          gridClass: 'grid grid-cols-4 gap-1.5 p-3',
          cardStyle: 'h-[105px] text-[10px] p-2 flex flex-col justify-between overflow-hidden',
          titleClass: 'text-[10px] font-bold truncate text-zinc-900 leading-tight',
          cols: 4,
          rows: 10,
          labelName: 'Compact Sheet (40 Labels/Page, e.g. A4 52.5 x 29.7mm)'
        };
      case 'grid-21': // 3 columns x 7 rows
        return {
          gridClass: 'grid grid-cols-3 gap-3 p-4',
          cardStyle: 'h-[145px] text-xs p-3 flex flex-col justify-between overflow-hidden',
          titleClass: 'text-xs font-bold line-clamp-2 text-zinc-900 leading-tight',
          cols: 3,
          rows: 7,
          labelName: 'Standard Sheet (21 Labels/Page, e.g. A4 70 x 42.4mm)'
        };
      case 'roll-single': // Single continuous barcode sticker (thermal format)
        return {
          gridClass: 'flex flex-col gap-4 p-4 max-w-[280px] mx-auto',
          cardStyle: 'w-full aspect-[4/3] p-4 text-xs flex flex-col justify-between overflow-hidden',
          titleClass: 'text-sm font-bold text-zinc-900 leading-snug',
          cols: 1,
          rows: 1,
          labelName: 'Continuous Roll Sticker (Thermal roll for Dymo/Brother)'
        };
      case 'grid-24': // 3 columns x 8 rows (Default layout)
      default:
        return {
          gridClass: 'grid grid-cols-3 gap-2.5 p-4',
          cardStyle: 'h-[135px] text-[11px] p-2.5 flex flex-col justify-between overflow-hidden',
          titleClass: 'text-[11px] font-bold line-clamp-2 text-zinc-900 leading-tight',
          cols: 3,
          rows: 8,
          labelName: 'Standard Sheet (24 Labels/Page, e.g. A4 70 x 37mm)'
        };
    }
  };

  const layout = getLayoutSpecs();

  // Print function
  const handlePrint = () => {
    if (labels.length === 0) {
      toast.error('No labels to print! Please adjust quantities.');
      return;
    }

    // Capture dynamic styles based on themes & specs
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Could not open print tab. Please disable popup blocker.');
      return;
    }

    const compiledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${storeName} - Price Labels</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
            @media print {
              @page {
                size: A4;
                margin: 6mm 6mm;
              }
              body {
                margin: 0;
                padding: 0;
                background-color: white;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print {
                display: none !important;
              }
            }
            body {
              font-family: 'Inter', system-ui, sans-serif;
              color: #111827;
              padding: 20px;
              background-color: #f4f4f5;
            }
            .paper-sheet {
              background-color: white;
              width: 210mm;
              min-height: 297mm;
              box-sizing: border-box;
              margin: 0 auto;
              padding: 4mm;
              box-shadow: 0 4px 10px rgba(0,0,0,0.15);
              page-break-after: always;
            }
            @media print {
              body {
                padding: 0;
                background-color: white;
              }
              .paper-sheet {
                box-shadow: none !important;
                padding: 0mm !important;
                margin: 0 !important;
                width: 100% !important;
                min-height: auto !important;
              }
            }
            
            /* Grid layouts */
            .grid-40 {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 1.5mm;
            }
            .grid-21 {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 3mm;
            }
            .grid-24 {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 2.2mm;
            }
            .roll-single {
              display: flex;
              flex-direction: column;
              gap: 4mm;
              width: 58mm; /* Standard label roll width */
              margin: 0 auto;
            }
            
            /* Sticker Cards */
            .sticker {
              box-sizing: border-box;
              background-color: white;
              border: ${showBorder ? '1px solid #e4e4e7' : '1px dashed transparent'};
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
              position: relative;
            }
            .sticker-grid-40 {
              height: 27.5mm;
              padding: 1.5mm;
              font-size: 8px;
            }
            .sticker-grid-24 {
              height: 35.5mm;
              padding: 2.5mm;
              font-size: 10px;
            }
            .sticker-grid-21 {
              height: 41mm;
              padding: 3.5mm;
              font-size: 11px;
            }
            .sticker-roll-single {
              width: 58mm;
              height: 40mm;
              padding: 3.5mm;
              font-size: 11px;
              border: 1px solid #111827;
              page-break-after: always;
            }
            
            /* Design Themes */
            .bg-two-tone-header {
              background-color: #111827 !important;
              color: white !important;
              text-align: center;
              font-size: 8px;
              font-weight: bold;
              padding: 1px 4px;
              margin: -2.5mm -2.5mm 1.5mm -2.5mm;
              letter-spacing: 0.5px;
            }
            .bg-two-tone-header-grid-40 {
              margin: -1.5mm -1.5mm 1mm -1.5mm;
            }
            .bg-two-tone-header-grid-21 {
              margin: -3.5mm -3.5mm 2mm -3.5mm;
              font-size: 9px;
            }
            
            .badge-category {
              background-color: #f3f4f6 !important;
              color: #4b5563;
              padding: 1px 4px;
              border-radius: 3px;
              font-size: 7.5px;
              display: inline-block;
              width: fit-content;
            }

            .price-bold {
              font-size: 14px;
              font-weight: 800;
              color: #000;
              letter-spacing: -0.5px;
            }
            .price-bold-lg {
              font-size: 18px;
              font-weight: 800;
            }
            .label-title {
              font-weight: 700;
              line-height: 1.15;
              color: #111827;
              margin-bottom: 2px;
            }
            
            .barcode-container {
              width: 100%;
              text-align: center;
              margin: 1px 0;
            }
            
            /* Utilities */
            .mono {
              font-family: 'JetBrains Mono', monospace;
              font-size: 8px;
              color: #4b5563;
            }
            
            .floating-print-btn {
              position: fixed;
              bottom: 24px;
              right: 24px;
              background-color: #4f46e5;
              color: white;
              border: none;
              border-radius: 30px;
              padding: 12px 24px;
              font-family: 'Inter', sans-serif;
              font-size: 14px;
              font-weight: 600;
              box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 8px;
              z-index: 9999;
            }
            .floating-print-btn:hover {
              background-color: #4338ca;
            }
            .floating-print-btn:active {
              transform: translateY(1px);
            }
          </style>
        </head>
        <body>
          <button class="no-print floating-print-btn" onclick="window.print()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Start Printing
          </button>
          
          <div id="print-canvas"></div>
          
          <script>
            // Chunk labels into pages based on grid config
            const labelsCount = ${labels.length};
            const cols = ${layout.cols};
            const rows = ${layout.rows};
            const labelsPerPage = cols * rows;
            const layoutMode = "${layoutMode}";
            const designTheme = "${designTheme}";
            
            const rawLabels = ${JSON.stringify(labels)};
            const canvas = document.getElementById('print-canvas');
            
            if (layoutMode === 'roll-single') {
              // Roll printer mode has no sheet constraints
              const listDiv = document.createElement('div');
              listDiv.className = 'roll-single';
              
              rawLabels.forEach((lbl, idx) => {
                const sticker = document.createElement('div');
                sticker.className = 'sticker sticker-roll-single';
                sticker.innerHTML = renderStickerHtml(lbl.product, idx);
                listDiv.appendChild(sticker);
              });
              canvas.appendChild(listDiv);
            } else {
              // Sheet printer mode: distribute into multiple standard A4 sheet modules
              let offset = 0;
              while (offset < rawLabels.length) {
                const pageSheet = document.createElement('div');
                pageSheet.className = 'paper-sheet';
                
                const grid = document.createElement('div');
                grid.className = layoutMode;
                
                const pageLabels = rawLabels.slice(offset, offset + labelsPerPage);
                pageLabels.forEach((lbl, idx) => {
                  const sticker = document.createElement('div');
                  sticker.className = 'sticker sticker-' + layoutMode;
                  sticker.innerHTML = renderStickerHtml(lbl.product, offset + idx);
                  grid.appendChild(sticker);
                });
                
                // Add empty spacer placeholders if there are partial grids to hold layout perfectly aligned
                const missing = labelsPerPage - pageLabels.length;
                for (let k = 0; k < missing; k++) {
                  const spacer = document.createElement('div');
                  spacer.style.border = '1px dashed #f4f4f5';
                  spacer.style.backgroundColor = 'transparent';
                  spacer.style.height = layoutMode === 'grid-40' ? '27.5mm' : (layoutMode === 'grid-24' ? '35.5mm' : '41mm');
                  grid.appendChild(spacer);
                }
                
                pageSheet.appendChild(grid);
                canvas.appendChild(pageSheet);
                offset += labelsPerPage;
              }
            }
            
            function renderStickerHtml(product, keyIdx) {
              const skuStr = product.sku || '';
              const barcodeStr = product.barcode || product.sku || '';
              const catName = product.categories ? product.categories.name : '';
              
              let headerHtml = '';
              if (${showStoreHeader}) {
                if (designTheme === 'two-tone') {
                  const isCompact = layoutMode === 'grid-40' ? ' bg-two-tone-header-grid-40' : (layoutMode === 'grid-21' ? ' bg-two-tone-header-grid-21' : '');
                  headerHtml = '<div class="bg-two-tone-header' + isCompact + '">' + ${JSON.stringify(storeName)} + '</div>';
                } else {
                  headerHtml = '<div class="mono" style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #4b5563; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-bottom: 2px;">' + ${JSON.stringify(storeName)} + '</div>';
                }
              }
              
              let categoryHtml = '';
              if (${showCategory} && catName) {
                categoryHtml = '<div><span class="badge-category">' + catName + '</span></div>';
              }
              
              let footerHtml = '';
              const showSkuSec = ${showSKU} && skuStr;
              const showBCValSec = ${showBarcodeVal} && barcodeStr;
              
              if (showSkuSec || showBCValSec) {
                let textValue = '';
                if (showSkuSec && showBCValSec) {
                  textValue = 'SKU: ' + skuStr + ' | ' + barcodeStr;
                } else if (showSkuSec) {
                  textValue = 'SKU: ' + skuStr;
                } else {
                  textValue = barcodeStr;
                }
                footerHtml = '<div class="mono" style="text-align: center; margin-top: 1.5px; font-weight: 500; font-size: 7.5px;">' + textValue + '</div>';
              }
              
              // Pricing representation
              let pricesHtml = '';
              const formattedRetail = "${currencySymbol}" + (product.retail_price ? product.retail_price.toFixed(2) : '0.00');
              const formattedWholesale = "${currencySymbol}" + (product.wholesale_price ? product.wholesale_price.toFixed(2) : '0.00');
              
              if (${showRetailPrice} && ${showWholesalePrice}) {
                pricesHtml = \`
                  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px;">
                    <div>
                      <span class="mono" style="font-size: 7px; display:block;">RETAIL</span>
                      <strong class="price-bold" style="color: #000;">\${formattedRetail}</strong>
                    </div>
                    <div style="text-align: right;">
                      <span class="mono" style="font-size: 7px; display:block;">WHOLESALE</span>
                      <strong class="price-bold" style="color: #4b5563; font-size: 11px;">\${formattedWholesale}</strong>
                    </div>
                  </div>
                \`;
              } else if (${showRetailPrice}) {
                if (designTheme === 'bold-price') {
                  pricesHtml = \`
                    <div style="display: flex; justify-content: space-between; align-items: center; background-color: #f9fafb; padding: 2px 4px; border-radius: 4px; border-left: 3px solid #111827; margin: 2px 0;">
                      <span class="mono" style="font-size: 7px; font-weight: bold; color: #111827;">RETAIL</span>
                      <strong class="price-bold price-bold-lg text-black">\${formattedRetail}</strong>
                    </div>
                  \`;
                } else {
                  pricesHtml = \`
                    <div style="margin-top: 1.5px;">
                      <strong class="price-bold" style="font-size: 15px; color:#111827;">\${formattedRetail}</strong>
                    </div>
                  \`;
                }
              } else if (${showWholesalePrice}) {
                pricesHtml = \`
                  <div style="margin-top: 1.5px;">
                    <span class="mono" style="font-size: 7px; display:block;">WHOLESALE</span>
                    <strong class="price-bold" style="font-size: 14px; color:#414bb2;">\${formattedWholesale}</strong>
                  </div>
                \`;
              }
              
              // Code representation (SVG Barcode or QR Code SVG chunk)
              let codeSectionHtml = '';
              if ("${codeType}" === 'barcode' && barcodeStr) {
                codeSectionHtml = \`
                  <div class="barcode-container" id="svg-bc-\${keyIdx}">
                    <!-- Custom built inline dynamic clean lines representing barcode -->
                    <svg id="raw-bc-\${keyIdx}" style="width: 100%; height: \${layoutMode === 'grid-40' ? '20' : '28'}px;"></svg>
                  </div>
                \`;
              } else if ("${codeType}" === 'qrcode' && barcodeStr) {
                // Return a clean simple image using QR Code canvas payload representable locally
                codeSectionHtml = \`
                  <div style="display: flex; justify-content: center; align-items: center; margin: 3px 0;">
                    <div id="svg-qr-\${keyIdx}"></div>
                  </div>
                \`;
              }
              
              // Assemble card contents
              return \`
                <div>
                  \${headerHtml}
                  \${categoryHtml}
                  <div class="label-title" style="font-size: \${layoutMode === 'grid-40' ? '8.5' : '10.5'}px;">\${product.name}</div>
                </div>
                <div>
                  \${pricesHtml}
                  \${codeSectionHtml}
                  \${footerHtml}
                </div>
              \`;
            }
            
            // Build real barcode visuals using SVG generation directly compiled in HTML engine
            const code39Patterns = ${JSON.stringify(CODE39_PATTERNS)};
            
            rawLabels.forEach((lbl, keyIdx) => {
              const product = lbl.product;
              const barcodeStr = (product.barcode || product.sku || '').toUpperCase().replace(/[^A-Z0-9\\-\\.\\ \\$\\s\\/\\+\\%]/g, '');
              
              if (layoutMode !== 'roll-single' && !barcodeStr) return;
              
              if ("${codeType}" === 'barcode' && barcodeStr) {
                const normVal = '*' + barcodeStr + '*';
                let x = 0;
                const bars = [];
                const narrowWidth = 1.2;
                const wideWidth = 2.8;
                const interSpacing = narrowWidth;
                
                for(let i=0; i<normVal.length; i++) {
                  const char = normVal[i];
                  const pattern = code39Patterns[char];
                  if(!pattern) continue;
                  
                  const parts = pattern.split(' ');
                  for(let j=0; j<parts.length; j++) {
                    const isBar = j % 2 === 0;
                    const isWide = parts[j] === 'W';
                    const width = isWide ? wideWidth : narrowWidth;
                    
                    if(isBar) {
                      bars.push({ x, width });
                    }
                    x += width;
                  }
                  x += interSpacing;
                }
                
                const padding = 5;
                const totalWidth = x + padding * 2;
                const elementHeight = layoutMode === 'grid-40' ? 22 : 32;
                
                const svgNode = document.getElementById('raw-bc-' + keyIdx);
                if (svgNode) {
                  svgNode.setAttribute('viewBox', '0 0 ' + totalWidth + ' ' + elementHeight);
                  svgNode.innerHTML = '<rect width="100%" height="' + elementHeight + '" fill="white" />';
                  
                  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                  group.setAttribute('transform', 'translate(' + padding + ', 0)');
                  
                  bars.forEach(bar => {
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('x', bar.x);
                    rect.setAttribute('y', '0');
                    rect.setAttribute('width', bar.width);
                    rect.setAttribute('height', elementHeight);
                    rect.setAttribute('fill', 'black');
                    group.appendChild(rect);
                  });
                  svgNode.appendChild(group);
                }
              } else if ("${codeType}" === 'qrcode' && barcodeStr) {
                const qrContainer = document.getElementById('svg-qr-' + keyIdx);
                if (qrContainer) {
                  // Direct clean QR rendering
                  const apiEndpoint = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(barcodeStr);
                  qrContainer.innerHTML = '<img src="' + apiEndpoint + '" style="height: ' + (layoutMode === 'grid-40' ? '30' : '42') + 'px; aspect-ratio: 1/1;" referrerpolicy="no-referrer" />';
                }
              }
            });
            
            // Auto trigger native print menu
            window.addEventListener('load', () => {
              // Soft timeout to guarantee all assets/images load perfectly prior to execution
              setTimeout(() => {
                window.print();
              }, 500);
            });
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(compiledHtml);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-6xl shadow-2xl border border-zinc-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold font-mono">LABELS BUILDER</span>
              <CardTitle className="text-xl font-bold text-zinc-900">Print Store Price Labels</CardTitle>
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              Select layouts, configure visual assets, and print adhesive pricing labels sheet for <strong className="text-zinc-700">{selectedProducts.length}</strong> checked products.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Modal Core Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Left Configuration Sidebar */}
          <div className="col-span-1 lg:col-span-5 p-6 border-r border-zinc-100 space-y-6 overflow-y-auto bg-zinc-50/30">
            {/* Store details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-zinc-100">
                <Type className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Branding Text</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-medium text-zinc-700">Retail Brand Title</Label>
                  <Input 
                    value={storeName} 
                    onChange={e => setStoreName(e.target.value)} 
                    placeholder="e.g. TAREZA CO-OP"
                    className="bg-white border-zinc-200" 
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-medium text-zinc-700">Currency Symbol</Label>
                  <Select value={currencySymbol} onValueChange={setCurrencySymbol}>
                    <SelectTrigger className="bg-white border-zinc-200">
                      <SelectValue placeholder="Select Currency" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="$">USD ($)</SelectItem>
                      <SelectItem value="ZiG">ZiG (ZiG)</SelectItem>
                      <SelectItem value="ZWG">ZWG (ZWG)</SelectItem>
                      <SelectItem value="R">ZAR (R)</SelectItem>
                      <SelectItem value="£">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Layout parameters */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-zinc-100">
                <LayoutGrid className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Sheet Layout Definition</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-700">Select Standard Sticker Format</Label>
                <Select value={layoutMode} onValueChange={(v: any) => setLayoutMode(v)}>
                  <SelectTrigger className="bg-white border-zinc-200">
                    <SelectValue placeholder="Select Layout" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="grid-24">A4 Sheet: 3 x 8 (24 Labels, 70 x 37mm)</SelectItem>
                    <SelectItem value="grid-21">A4 Sheet: 3 x 7 (21 Labels, 70 x 42.4mm)</SelectItem>
                    <SelectItem value="grid-40">A4 Sheet: 4 x 10 (40 Labels, 52.5 x 29.7mm)</SelectItem>
                    <SelectItem value="roll-single">Thermal Roll: Continuous 58 x 40mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-700">Visual Styling Badge</Label>
                <Select value={designTheme} onValueChange={(v: any) => setDesignTheme(v)}>
                  <SelectTrigger className="bg-white border-zinc-200">
                    <SelectValue placeholder="Select Style Theme" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="classic">Classic Minimalist</SelectItem>
                    <SelectItem value="bold-price">High-Contrast Highlighted Price</SelectItem>
                    <SelectItem value="two-tone">Classic Dark Branding Header Stripe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Print Quantity settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-zinc-100">
                <Sliders className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Quantities configuration</span>
              </div>
              
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    type="button"
                    variant={quantityMode === 'fixed' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setQuantityMode('fixed')}
                  >
                    Fixed Copies
                  </Button>
                  <Button 
                    type="button" 
                    variant={quantityMode === 'stock' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setQuantityMode('stock')}
                  >
                    Mirror Stock
                  </Button>
                  <Button 
                    type="button"
                    variant={quantityMode === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setQuantityMode('custom')}
                  >
                    Set Individually
                  </Button>
                </div>
              </div>

              {quantityMode === 'fixed' && (
                <div className="space-y-1.5 p-3 rounded-lg bg-zinc-100/60 border border-zinc-200">
                  <Label className="text-xs font-medium text-zinc-700">Uniform Sticker Copies Per Product</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      min="1" 
                      max="100" 
                      value={fixedQty} 
                      onChange={e => setFixedQty(Math.max(1, parseInt(e.target.value) || 1))} 
                      className="bg-white border-zinc-200 w-24 h-9 font-mono" 
                    />
                    <span className="text-xs text-zinc-500 font-medium">Total: {selectedProducts.length * fixedQty} price labels</span>
                  </div>
                </div>
              )}

              {quantityMode === 'stock' && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-900 text-xs leading-relaxed space-y-1">
                  <p className="font-semibold text-indigo-950">Dynamic Quantity Matching:</p>
                  <p className="text-[11px] text-zinc-600">
                    The machine automatically pulls real-time inventory values globally. Products out-of-stock will default to 1 label fallback placeholder.
                  </p>
                </div>
              )}

              {quantityMode === 'custom' && (
                <div className="space-y-2 bg-zinc-100/60 border border-zinc-200 rounded-lg p-3 max-h-[180px] overflow-y-auto">
                  <Label className="text-xs font-semibold text-zinc-800">Assign Quantity Per Product</Label>
                  <div className="space-y-1.5 divide-y divide-zinc-200/50">
                    {selectedProducts.map(p => (
                      <div key={p.id} className="flex justify-between items-center gap-2 pt-1.5 first:pt-0">
                        <span className="text-[11px] font-medium text-zinc-700 truncate max-w-[170px]">{p.name}</span>
                        <Input 
                          type="number" 
                          min="0" 
                          max="200" 
                          value={customQuantities[p.id] ?? 1} 
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setCustomQuantities(prev => ({ ...prev, [p.id]: val }));
                          }} 
                          className="bg-white border-zinc-200 w-16 h-7 text-center font-mono text-xs px-1" 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Visual configuration details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-zinc-100">
                <Settings className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Metadata Field Toggles</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-store" className="text-xs font-medium cursor-pointer text-zinc-700">Header Title</Label>
                  <Switch id="toggle-store" checked={showStoreHeader} onCheckedChange={setShowStoreHeader} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-retail" className="text-xs font-medium cursor-pointer text-zinc-700">Retail Price</Label>
                  <Switch id="toggle-retail" checked={showRetailPrice} onCheckedChange={setShowRetailPrice} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-wholesale" className="text-xs font-medium cursor-pointer text-zinc-700">Wholesale Price</Label>
                  <Switch id="toggle-wholesale" checked={showWholesalePrice} onCheckedChange={setShowWholesalePrice} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-sku" className="text-xs font-medium cursor-pointer text-zinc-700">Product SKU</Label>
                  <Switch id="toggle-sku" checked={showSKU} onCheckedChange={setShowSKU} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-bc-val" className="text-xs font-medium cursor-pointer text-zinc-700">Barcode Value</Label>
                  <Switch id="toggle-bc-val" checked={showBarcodeVal} onCheckedChange={setShowBarcodeVal} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-cat" className="text-xs font-medium cursor-pointer text-zinc-700">Category Tag</Label>
                  <Switch id="toggle-cat" checked={showCategory} onCheckedChange={setShowCategory} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-border" className="text-xs font-medium cursor-pointer text-zinc-700">Sticker Border</Label>
                  <Switch id="toggle-border" checked={showBorder} onCheckedChange={setShowBorder} />
                </div>
              </div>
              
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-medium text-zinc-700">Code Format Style</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button 
                    type="button"
                    variant={codeType === 'barcode' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-7 px-1"
                    onClick={() => setCodeType('barcode')}
                  >
                    1D Barcode
                  </Button>
                  <Button 
                    type="button"
                    variant={codeType === 'qrcode' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-7 px-1"
                    onClick={() => setCodeType('qrcode')}
                  >
                    QR Code
                  </Button>
                  <Button 
                    type="button"
                    variant={codeType === 'none' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-7 px-1"
                    onClick={() => setCodeType('none')}
                  >
                    None
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive live blueprint page preview right */}
          <div className="col-span-1 lg:col-span-7 p-6 bg-zinc-900 border-t lg:border-t-0 flex flex-col min-h-[450px]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Live Sticker Grid Preview</span>
              </div>
              <div className="px-2.5 py-1 bg-zinc-800 rounded-md border border-zinc-700 font-mono text-[10px] text-zinc-300">
                {labels.length} Total Sticker Labels Generated (Layout specs: {layout.cols} x {layout.rows})
              </div>
            </div>

            {/* Interactive blueprint sheet panel */}
            <div className="flex-1 mt-6 flex justify-center items-start overflow-y-auto max-h-[58vh] bg-zinc-950 p-4 rounded-xl border border-zinc-800 shadow-inner">
              {labels.length === 0 ? (
                <div className="self-center text-center p-8">
                  <HelpCircle className="h-10 w-10 text-zinc-600 mx-auto stroke-1" />
                  <p className="text-zinc-400 font-medium mt-2.5">No price labels to preview</p>
                  <p className="text-xs text-zinc-600 mt-1">Check quantities or products selector settings.</p>
                </div>
              ) : (
                <div className="w-full bg-white text-zinc-900 shadow-2xl rounded-sm max-w-[595px] border border-zinc-200">
                  <div className={layout.gridClass}>
                    {labels.slice(0, layoutMode === 'roll-single' ? 6 : (layout.cols * layout.rows)).map((lbl, idx) => {
                      const product = lbl.product;
                      const skuVal = product.sku || '';
                      const barcodeVal = product.barcode || product.sku || '';
                      
                      return (
                        <div 
                          key={`${product.id}-${idx}`} 
                          className={`${layout.cardStyle} ${showBorder ? 'border border-zinc-200' : 'border border-dashed border-zinc-100'} bg-white text-zinc-900 font-sans`}
                        >
                          {/* Inner Label structure */}
                          <div>
                            {showStoreHeader && (
                              designTheme === 'two-tone' ? (
                                <div className={`bg-zinc-900 text-white font-bold tracking-widest text-[8px] py-0.5 px-2 text-center select-none uppercase -mx-2.5 -mt-2.5 mb-1.5`}>
                                  {storeName}
                                </div>
                              ) : (
                                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider truncate mb-0.5">{storeName}</div>
                              )
                            )}
                            
                            {showCategory && product.categories?.name && (
                              <div className="mb-0.5">
                                <span className="bg-zinc-100 text-zinc-600 rounded px-1 py-0.2 text-[8px] font-medium inline-block truncate max-w-full">
                                  {product.categories.name}
                                </span>
                              </div>
                            )}

                            <div className={`${layout.titleClass} text-zinc-950 font-bold select-auto font-sans leading-tight`}>
                              {product.name}
                            </div>
                          </div>

                          <div>
                            {/* Standard structural spaces for prices */}
                            {showRetailPrice && showWholesalePrice ? (
                              <div className="flex justify-between items-end mt-1 mb-1.5">
                                <div>
                                  <span className="text-[7px] text-zinc-500 block leading-none font-mono">RETAIL</span>
                                  <strong className="text-zinc-950 text-xs font-extrabold">{currencySymbol}{product.retail_price?.toFixed(2)}</strong>
                                </div>
                                <div className="text-right">
                                  <span className="text-[7px] text-zinc-500 block leading-none font-mono font-medium">WHOLESALER</span>
                                  <strong className="text-zinc-600 text-[10px] font-bold">{currencySymbol}{product.wholesale_price?.toFixed(2)}</strong>
                                </div>
                              </div>
                            ) : showRetailPrice ? (
                              designTheme === 'bold-price' ? (
                                <div className="flex items-center justify-between bg-zinc-50/80 p-1.5 rounded border-l-2 border-zinc-900/85 my-1">
                                  <span className="text-[7px] font-mono font-bold text-zinc-500 uppercase leading-none">RETAIL</span>
                                  <strong className="text-zinc-950 text-base font-black tracking-tight leading-none">
                                    {currencySymbol}{product.retail_price?.toFixed(2)}
                                  </strong>
                                </div>
                              ) : (
                                <div className="my-0.5">
                                  <strong className="text-zinc-950 text-sm font-extrabold">{currencySymbol}{product.retail_price?.toFixed(2)}</strong>
                                </div>
                              )
                            ) : showWholesalePrice ? (
                              <div className="my-0.5">
                                <span className="text-[7.5px] text-zinc-500 block font-mono">WHOLESALE</span>
                                <strong className="text-zinc-900 text-xs font-bold">{currencySymbol}{product.wholesale_price?.toFixed(2)}</strong>
                              </div>
                            ) : null}

                            {/* Verification Code structure */}
                            {codeType === 'barcode' && barcodeVal ? (
                              <div className="w-full mt-1">
                                <SvgBarcode value={barcodeVal} height={layoutMode === 'grid-40' ? 18 : 28} />
                              </div>
                            ) : codeType === 'qrcode' && barcodeVal ? (
                              <div className="flex justify-center my-0.5">
                                <QRCodeSVG value={barcodeVal} size={layoutMode === 'grid-40' ? 24 : 36} />
                              </div>
                            ) : null}

                            {(showSKU && skuVal) || (showBarcodeVal && barcodeVal) ? (
                              <div className="text-[8px] text-zinc-500 font-mono text-center truncate mt-1">
                                {showSKU && skuVal ? `SKU: ${skuVal}` : ''} 
                                {showSKU && skuVal && showBarcodeVal && barcodeVal ? ' | ' : ''}
                                {showBarcodeVal && barcodeVal ? barcodeVal : ''}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            
            {labels.length > (layoutMode === 'roll-single' ? 6 : (layout.cols * layout.rows)) && (
              <p className="text-[11px] text-zinc-500 text-center mt-2.5 leading-snug">
                Showing the first {layoutMode === 'roll-single' ? '6' : (layout.cols * layout.rows)} stickers in live preview. Click printing to print all {labels.length} sticker labels.
              </p>
            )}

            {/* Print Guide Notes */}
            <div className="mt-auto pt-6 border-t border-zinc-800 text-zinc-500 text-xs flex gap-3.5 items-start">
              <div className="p-1 min-w-[20px] rounded bg-indigo-950/40 border border-indigo-900 text-indigo-400 font-mono text-[10px] text-center font-bold">INFO</div>
              <p className="leading-relaxed">
                <strong>Printer Instructions:</strong> Load adhesive continuous roll or standard pre-cut sticker paper in your device. Under print options, lock <strong>Scales: 100% (Default)</strong> and check <strong>"Hide headers and footers"</strong> to maintain beautiful margin metrics.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <Button variant="outline" onClick={onClose} className="border-zinc-200">
            Cancel
          </Button>

          <Button 
            disabled={labels.length === 0}
            onClick={handlePrint}
            className="shadow-md bg-indigo-600 hover:bg-indigo-700 text-white border-transparent px-6 font-semibold"
          >
            <Printer className="mr-2 h-4.5 w-4.5" />
            Generate Printable PDF Page
          </Button>
        </div>
      </div>
    </div>
  );
}
