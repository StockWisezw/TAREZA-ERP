import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export interface InventoryPDFOptions {
  products: any[];
  businessName?: string;
  branchName?: string;
  type?: 'valuation' | 'pricelist';
}

export function exportInventoryPDF({
  products = [],
  businessName = 'TAREZA ENTERPRISE WORKSPACE',
  branchName = 'Main Store Branch',
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

    const dateStr = new Date().toLocaleDateString();
    const title = type === 'valuation' ? 'INVENTORY STOCK VALUATION AUDIT' : 'OFFICIAL RETAIL PRICE CATALOGUE';

    let totalStockQty = 0;
    let totalCostVal = 0;
    let totalRetailVal = 0;

    products.forEach((p: any) => {
      const qty = Number(p.stock_quantity ?? p.stockQuantity ?? 0);
      const cost = Number(p.cost_price ?? p.costPrice ?? 0);
      const price = Number(p.price ?? 0);

      totalStockQty += qty;
      totalCostVal += (qty * cost);
      totalRetailVal += (qty * price);
    });

    // 1. Header Banner
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, 210, 34, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(businessName.toUpperCase(), 14, 13);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(212, 212, 216);
    doc.text(`BRANCH: ${branchName.toUpperCase()} | CATALOG SIZE: ${products.length} PRODUCTS`, 14, 19);
    doc.text(title, 14, 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(type === 'valuation' ? 'STOCK VALUATION' : 'PRICE LIST', 196, 13, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`AS AT: ${dateStr}`, 196, 19, { align: 'right' });

    // 2. Metrics Summary Box
    let y = 40;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 18, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text('Total Units in Stock:', 20, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(totalStockQty.toLocaleString(), 20, y + 13);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Total Inventory Cost Value:', 80, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`$${totalCostVal.toFixed(2)}`, 80, y + 13);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Total Retail Potential Value:', 140, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`$${totalRetailVal.toFixed(2)}`, 140, y + 13);

    // 3. Products Table
    const head = type === 'valuation'
      ? [['SKU', 'Product Name', 'Category', 'Stock Qty', 'Unit Cost', 'Retail Price', 'Total Cost Value']]
      : [['SKU', 'Product Name', 'Category', 'Stock Available', 'Selling Price (USD)']];

    const tableData = products.map((p: any) => {
      const sku = p.sku || '---';
      const name = p.name || 'Unnamed';
      const cat = p.category?.name || p.category_name || (typeof p.category === 'string' ? p.category : 'General');
      const qty = Number(p.stock_quantity ?? p.stockQuantity ?? 0);
      const cost = Number(p.cost_price ?? p.costPrice ?? 0);
      const price = Number(p.price ?? 0);

      if (type === 'valuation') {
        return [
          sku,
          name,
          cat,
          String(qty),
          `$${cost.toFixed(2)}`,
          `$${price.toFixed(2)}`,
          `$${(qty * cost).toFixed(2)}`
        ];
      } else {
        return [
          sku,
          name,
          cat,
          qty > 0 ? `${qty} In Stock` : 'Out of Stock',
          `$${price.toFixed(2)}`
        ];
      }
    });

    callAutoTable({
      startY: y + 24,
      margin: { left: 14, right: 14 },
      head: head,
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [39, 39, 42],
        textColor: [255, 255, 255],
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

    doc.save(`Inventory_${type}_${dateStr.replace(/\//g, '-')}.pdf`);
    toast.success(`Inventory ${type === 'valuation' ? 'Valuation' : 'Price List'} PDF exported!`);
  } catch (err: any) {
    console.error('Error generating inventory PDF:', err);
    toast.error('Failed to generate Inventory PDF: ' + (err.message || 'Unknown error'));
  }
}
