import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export interface InventoryPDFOptions {
  products: any[];
  businessName?: string;
  branchName?: string;
  branchId?: string;
  type?: 'valuation' | 'pricelist';
}

/**
 * Universal extractor for product quantities, costs, and selling prices
 * supporting database records, joined tables, and client state structures.
 */
export function extractProductInventoryMetrics(p: any, branchId?: string) {
  // 1. Quantity extraction
  let qty = 0;
  let hasInventoryArray = false;

  if (Array.isArray(p.inventory) && p.inventory.length > 0) {
    hasInventoryArray = true;
    if (branchId && branchId !== 'all') {
      const match = p.inventory.find((i: any) => i.branch_id === branchId);
      if (match && match.quantity !== undefined && match.quantity !== null) {
        qty = Number(match.quantity) || 0;
      } else if (p.inventory[0] && p.inventory[0].quantity !== undefined) {
        qty = Number(p.inventory[0].quantity) || 0;
      }
    } else {
      // Sum all branch quantities
      qty = p.inventory.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0);
    }
  } else if (p.inventory && typeof p.inventory === 'object' && p.inventory.quantity !== undefined) {
    qty = Number(p.inventory.quantity) || 0;
  } else if (p.stock_quantity !== undefined && p.stock_quantity !== null && !isNaN(Number(p.stock_quantity))) {
    qty = Number(p.stock_quantity);
  } else if (p.stockQuantity !== undefined && p.stockQuantity !== null && !isNaN(Number(p.stockQuantity))) {
    qty = Number(p.stockQuantity);
  } else if (p.stock !== undefined && p.stock !== null && !isNaN(Number(p.stock))) {
    qty = Number(p.stock);
  } else if (p.quantity !== undefined && p.quantity !== null && !isNaN(Number(p.quantity))) {
    qty = Number(p.quantity);
  } else if (p.current_stock !== undefined && p.current_stock !== null && !isNaN(Number(p.current_stock))) {
    qty = Number(p.current_stock);
  } else if (p.total_stock !== undefined && p.total_stock !== null && !isNaN(Number(p.total_stock))) {
    qty = Number(p.total_stock);
  }

  // 2. Cost extraction
  let cost = 0;
  if (p.cost_price !== undefined && p.cost_price !== null && !isNaN(Number(p.cost_price))) {
    cost = Number(p.cost_price);
  } else if (p.costPrice !== undefined && p.costPrice !== null && !isNaN(Number(p.costPrice))) {
    cost = Number(p.costPrice);
  } else if (p.unit_cost !== undefined && p.unit_cost !== null && !isNaN(Number(p.unit_cost))) {
    cost = Number(p.unit_cost);
  } else if (p.purchase_cost !== undefined && p.purchase_cost !== null && !isNaN(Number(p.purchase_cost))) {
    cost = Number(p.purchase_cost);
  } else if (p.buying_price !== undefined && p.buying_price !== null && !isNaN(Number(p.buying_price))) {
    cost = Number(p.buying_price);
  }

  // 3. Retail selling price extraction
  let price = 0;
  if (p.retail_price !== undefined && p.retail_price !== null && !isNaN(Number(p.retail_price))) {
    price = Number(p.retail_price);
  } else if (p.retailPrice !== undefined && p.retailPrice !== null && !isNaN(Number(p.retailPrice))) {
    price = Number(p.retailPrice);
  } else if (p.price !== undefined && p.price !== null && !isNaN(Number(p.price))) {
    price = Number(p.price);
  } else if (p.selling_price !== undefined && p.selling_price !== null && !isNaN(Number(p.selling_price))) {
    price = Number(p.selling_price);
  } else if (p.unit_price !== undefined && p.unit_price !== null && !isNaN(Number(p.unit_price))) {
    price = Number(p.unit_price);
  }

  // 4. Category extraction
  let category = 'General';
  if (p.categories?.name) {
    category = p.categories.name;
  } else if (p.category?.name) {
    category = p.category.name;
  } else if (typeof p.category === 'string' && p.category.trim()) {
    category = p.category;
  } else if (p.category_name) {
    category = p.category_name;
  }

  return {
    qty,
    cost: Math.max(0, cost),
    price: Math.max(0, price),
    category
  };
}

export function exportInventoryPDF({
  products = [],
  businessName = 'TAREZA ENTERPRISE WORKSPACE',
  branchName = 'Main Store Branch',
  branchId,
  type = 'valuation'
}: InventoryPDFOptions) {
  if (!products || products.length === 0) {
    toast.error('Cannot generate PDF: No inventory products available.');
    return;
  }

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const callAutoTable = (options: any) => {
      if (typeof autoTable === 'function') {
        autoTable(doc, options);
      } else if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(options);
      }
    };

    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const title = type === 'valuation' ? 'INVENTORY STOCK VALUATION AUDIT' : 'OFFICIAL RETAIL PRICE CATALOGUE';

    let totalStockQty = 0;
    let totalCostVal = 0;
    let totalRetailVal = 0;

    products.forEach((p: any) => {
      const { qty, cost, price } = extractProductInventoryMetrics(p, branchId);
      totalStockQty += qty;
      totalCostVal += (qty * cost);
      totalRetailVal += (qty * price);
    });

    const totalPotentialProfit = Math.max(0, totalRetailVal - totalCostVal);
    const overallMarginPct = totalRetailVal > 0 ? (totalPotentialProfit / totalRetailVal) * 100 : 0;

    // 1. Header Banner
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, 210, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(businessName.toUpperCase(), 14, 12);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(212, 212, 216);
    doc.text(`BRANCH: ${branchName.toUpperCase()} | CATALOG SIZE: ${products.length} PRODUCTS`, 14, 18);
    doc.text(title, 14, 24);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(type === 'valuation' ? 'STOCK VALUATION' : 'PRICE LIST', 196, 12, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`AS AT: ${dateStr}`, 196, 18, { align: 'right' });
    doc.text('METHOD: Perpetual FIFO / Unit Cost', 196, 24, { align: 'right' });

    // 2. Metrics Summary Box
    let y = 41;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 20, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text('Total Units in Stock:', 18, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(totalStockQty.toLocaleString(), 18, y + 14);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Total Inventory Cost Value:', 65, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(225, 29, 72); // Rose/red accent for cost outlay
    doc.setFontSize(10);
    doc.text(`$${totalCostVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 65, y + 14);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Total Retail Potential Value:', 118, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // Emerald accent for retail value
    doc.setFontSize(10);
    doc.text(`$${totalRetailVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 118, y + 14);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Potential Margin:', 168, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // Blue accent for margin
    doc.setFontSize(10);
    doc.text(`${overallMarginPct.toFixed(1)}%`, 168, y + 14);

    // 3. Products Table
    const head = type === 'valuation'
      ? [['SKU', 'Product Name', 'Category', 'Stock Qty', 'Unit Cost', 'Retail Price', 'Total Cost Value']]
      : [['SKU', 'Product Name', 'Category', 'Stock Available', 'Selling Price (USD)']];

    const tableData = products.map((p: any) => {
      const sku = p.sku || '---';
      const name = p.name || 'Unnamed Product';
      const { qty, cost, price, category } = extractProductInventoryMetrics(p, branchId);
      const lineCostVal = qty * cost;

      if (type === 'valuation') {
        return [
          sku,
          name,
          category,
          qty.toLocaleString(),
          `$${cost.toFixed(2)}`,
          `$${price.toFixed(2)}`,
          `$${lineCostVal.toFixed(2)}`
        ];
      } else {
        return [
          sku,
          name,
          category,
          qty > 0 ? `${qty.toLocaleString()} in stock` : 'Out of stock',
          `$${price.toFixed(2)}`
        ];
      }
    });

    const foot = type === 'valuation'
      ? [[
          'TOTALS',
          `Count: ${products.length} Products`,
          '',
          totalStockQty.toLocaleString(),
          '',
          `$${totalRetailVal.toFixed(2)}`,
          `$${totalCostVal.toFixed(2)}`
        ]]
      : undefined;

    callAutoTable({
      startY: y + 25,
      margin: { left: 14, right: 14 },
      head: head,
      body: tableData,
      foot: foot,
      theme: 'striped',
      headStyles: {
        fillColor: [39, 39, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontSize: 8,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [15, 23, 42]
      },
      columnStyles: type === 'valuation' ? {
        0: { cellWidth: 24, fontStyle: 'bold' },
        1: { cellWidth: 50 },
        2: { cellWidth: 26 },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
      } : {
        0: { cellWidth: 32, fontStyle: 'bold' },
        1: { cellWidth: 70 },
        2: { cellWidth: 36 },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
      }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Tareza Cloud ERP • ${title} • Page ${i} of ${pageCount} • Generated ${dateStr}`,
        105,
        290,
        { align: 'center' }
      );
    }

    doc.save(`Inventory_${type}_${dateStr.replace(/\s+/g, '_').replace(/,/g, '')}.pdf`);
    toast.success(`Inventory ${type === 'valuation' ? 'Valuation' : 'Price List'} PDF exported successfully!`);
  } catch (err: any) {
    console.error('Error generating inventory PDF:', err);
    toast.error('Failed to generate Inventory PDF: ' + (err.message || 'Unknown error'));
  }
}
