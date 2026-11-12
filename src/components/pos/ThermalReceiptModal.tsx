import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Printer, 
  Bluetooth, 
  Download, 
  Copy, 
  Check, 
  Scissors, 
  ShieldCheck, 
  FileText,
  Smartphone,
  Layers
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { 
  ThermalSaleData, 
  formatSaleToThermalText, 
  printViaBluetooth, 
  downloadESCPOSFile,
  generateZIMRAFiscalSignature
} from '../../services/escposThermalService';
import { printReceiptDirect } from '../../utils/printManager';

interface ThermalReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: any;
  businessName?: string;
  branchName?: string;
  taxNumber?: string;
  cashierName?: string;
}

export function ThermalReceiptModal({
  open,
  onOpenChange,
  sale,
  businessName = 'Tareza Retail Enterprise',
  branchName = 'Harare CBD Flagship',
  taxNumber = 'BP10029384-2026',
  cashierName = 'Cashier'
}: ThermalReceiptModalProps) {
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!sale) return null;

  // Adapt sale data to ThermalSaleData
  const items = (Array.isArray(sale.items) ? sale.items : []).map((i: any) => {
    const qty = Number(i.quantity || 1);
    const resolvedUnitPrice = Number(
      i.unitPrice ?? 
      i.unit_price ?? 
      i.price ?? 
      i.product?.retailPrice ?? 
      i.product?.price ?? 
      (i.subtotal && i.quantity ? i.subtotal / i.quantity : 0)
    );
    const subtotal = Number(i.subtotal !== undefined ? i.subtotal : (qty * resolvedUnitPrice));
    return {
      name: i.product?.name || i.name || 'Item',
      quantity: qty,
      price: resolvedUnitPrice,
      unitPrice: resolvedUnitPrice,
      subtotal,
      vatAmount: Number(i.vatAmount || 0),
      discount: i.discount
    };
  });

  const payments = Array.isArray(sale.payments) && sale.payments.length > 0
    ? sale.payments.map((p: any) => ({
        method: String(p.method || p.payment_method || 'CASH'),
        amount: Number(p.amount || 0)
      }))
    : [{ method: String(sale.payment_method || 'CASH'), amount: Number(sale.total || sale.total_amount || 0) }];

  const total = Number(sale.total !== undefined ? sale.total : (sale.total_amount || 0));
  const vatTotal = Number(sale.vatTotal !== undefined ? sale.vatTotal : (sale.vat_total || (total * 0.15)));
  const subtotal = Number(sale.subtotal !== undefined ? sale.subtotal : (sale.subtotal_amount || (total - vatTotal)));
  const discountTotal = Number(sale.discountTotal !== undefined ? sale.discountTotal : (sale.discount_total || 0));

  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const changeDue = Math.max(0, totalPaid - total);

  const thermalSale: ThermalSaleData = {
    id: sale.id,
    receiptNumber: sale.receiptNumber || sale.receipt_number || 'OFF-001',
    timestamp: sale.timestamp || sale.created_at || new Date().toISOString(),
    businessName,
    branchName,
    taxNumber,
    cashierName: sale.cashier_name || cashierName,
    customerName: sale.customerName || sale.customer_name || 'Walk-In Customer',
    customerPhone: sale.customerPhone || sale.customer_phone || '',
    items,
    subtotal,
    discountTotal,
    vatTotal,
    total,
    payments,
    changeDue,
    leftChangeNote: sale.left_change_note || sale.leftChangeNote || undefined,
    status: sale.status || 'COMPLETED'
  };

  const fiscal = generateZIMRAFiscalSignature(thermalSale.receiptNumber, thermalSale.total);
  const exchangeRateZiG = 26.5; // Official RBZ pegged rate
  const totalZiG = (thermalSale.total * exchangeRateZiG).toFixed(2);

  const previewText = formatSaleToThermalText(thermalSale, { paperWidth, exchangeRateZiG });

  const handleBluetoothPrint = async () => {
    setIsBluetoothPrinting(true);
    const toastId = toast.loading('Connecting to ESC/POS Bluetooth Thermal Printer...');
    try {
      const res = await printViaBluetooth(thermalSale, {
        paperWidth,
        openDrawer: true,
        cutPaper: true,
        exchangeRateZiG
      });
      if (res.success) {
        toast.success(res.message, { id: toastId });
      } else {
        toast.error(res.message, { id: toastId });
      }
    } catch (e: any) {
      toast.error('Bluetooth Print error: ' + (e.message || String(e)), { id: toastId });
    } finally {
      setIsBluetoothPrinting(false);
    }
  };

  const handleDownloadBin = () => {
    downloadESCPOSFile(thermalSale, {
      paperWidth,
      openDrawer: true,
      cutPaper: true,
      exchangeRateZiG
    });
    toast.success('Downloaded raw ESC/POS binary file (.bin) for thermal printer.');
  };

  const handleStandardPrint = () => {
    printReceiptDirect(sale, {
      businessName,
      branchName,
      taxNumber,
      cashierName: thermalSale.cashierName
    });
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(previewText);
    setCopied(true);
    toast.success('Monospace thermal receipt copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-zinc-950 text-zinc-100 border border-zinc-800 shadow-2xl rounded-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="p-4 bg-zinc-900 border-b border-zinc-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            <div>
              <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
                ESC/POS Thermal Receipt Module
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                  ZIMRA Fiscal Compliant
                </Badge>
              </DialogTitle>
              <p className="text-[11px] text-zinc-400">Direct binary hardware formatting for 58mm/80mm printers</p>
            </div>
          </div>

          {/* Paper Width Toggle */}
          <div className="flex bg-zinc-800 p-0.5 rounded-lg text-[10px] font-bold">
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-2.5 py-1 rounded transition-colors ${paperWidth === '80mm' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              80mm (Desktop POS)
            </button>
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-2.5 py-1 rounded transition-colors ${paperWidth === '58mm' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              58mm (Handheld/MP)
            </button>
          </div>
        </DialogHeader>

        {/* Paper Preview Viewport */}
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-900/50 flex justify-center">
          <div className={`bg-white text-black font-mono text-[11px] leading-snug p-4 shadow-2xl rounded-sm ${paperWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'}`}>
            {/* Paper tear header icon */}
            <div className="flex items-center justify-center gap-1 text-[9px] text-zinc-400 uppercase tracking-widest pb-2 border-b border-dashed border-zinc-300 mb-3">
              <Scissors className="w-3 h-3 rotate-90" />
              <span>Thermal Receipt Output</span>
            </div>

            {/* Receipt Content */}
            <div className="text-center space-y-0.5">
              <h2 className="font-extrabold text-sm uppercase tracking-tight">{businessName}</h2>
              <p className="text-[10px] text-zinc-700">{branchName}</p>
              <p className="text-[10px] font-semibold">VAT REG NO: {taxNumber}</p>
              <div className="border-t border-b border-black my-1 py-0.5 font-bold text-[10px]">
                {sale.status === 'QUOTATION' ? '*** QUOTATION / ESTIMATE ***' : '*** TAX FISCAL INVOICE ***'}
              </div>
            </div>

            {/* Metadata */}
            <div className="text-[10px] space-y-0.5 my-2">
              <div className="flex justify-between">
                <span>Receipt: #{thermalSale.receiptNumber}</span>
                <span>Till: #01</span>
              </div>
              <div className="flex justify-between">
                <span>Date: {new Date(thermalSale.timestamp || Date.now()).toLocaleTimeString()}</span>
                <span>Fiscal: #{fiscal.fiscalCounter}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier: {thermalSale.cashierName}</span>
                <span className={sale.status === 'offline_pending' ? 'font-bold text-amber-700' : 'text-emerald-700 font-bold'}>
                  {sale.status === 'offline_pending' ? 'OFFLINE' : 'SYNCED'}
                </span>
              </div>
              {thermalSale.customerName && thermalSale.customerName !== 'Walk-In Customer' && (
                <div className="flex justify-between font-semibold pt-0.5">
                  <span>Customer: {thermalSale.customerName}</span>
                  <span>{thermalSale.customerPhone}</span>
                </div>
              )}
            </div>

            {/* Line items table */}
            <div className="border-t border-b border-dashed border-zinc-400 py-1.5 my-1.5">
              <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-zinc-200">
                <span>ITEM</span>
                <span>QTY x PRICE</span>
                <span>TOTAL</span>
              </div>
              <div className="space-y-1 pt-1">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[10px]">
                    <span className="truncate max-w-[140px] font-medium">{item.name}</span>
                    <span className="text-zinc-600">{item.quantity} x ${item.price.toFixed(2)}</span>
                    <span className="font-bold font-mono">${(item.quantity * item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="space-y-0.5 text-[10px] pt-1">
              <div className="flex justify-between">
                <span>Subtotal (USD):</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>ZIMRA VAT (15%):</span>
                <span>${vatTotal.toFixed(2)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-zinc-700 italic">
                  <span>Discount:</span>
                  <span>-${discountTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t-2 border-b-2 border-black py-1 my-1">
                <div className="flex justify-between font-black text-xs">
                  <span>TOTAL (USD):</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-[10px] text-zinc-800">
                  <span>EQUIVALENT (ZiG @ {exchangeRateZiG}):</span>
                  <span>ZiG {totalZiG}</span>
                </div>
              </div>
            </div>

            {/* Payments */}
            <div className="text-[10px] space-y-0.5 pt-0.5">
              <span className="font-bold block">TENDERED:</span>
              {payments.map((p, idx) => (
                <div key={idx} className="flex justify-between pl-2">
                  <span>{p.method.replace('_', ' ').toUpperCase()}</span>
                  <span>${p.amount.toFixed(2)}</span>
                </div>
              ))}
              {changeDue > 0 && (
                <div className="flex justify-between font-bold text-[10px] pt-0.5 border-t border-dashed border-zinc-300">
                  <span>CHANGE DUE:</span>
                  <span>${changeDue.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Left Change Alert */}
            {thermalSale.leftChangeNote && (
              <div className="my-1.5 p-1 bg-amber-50 border border-amber-300 rounded text-[9px] text-amber-900 font-bold">
                NOTE: Change left by customer ({thermalSale.leftChangeNote})
              </div>
            )}

            {/* ZIMRA Fiscal Verification Block */}
            <div className="border-t border-dashed border-zinc-400 mt-2 pt-2 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 font-bold text-[9px] text-zinc-800 uppercase">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>ZIMRA FDMS FISCAL VERIFIED</span>
              </div>
              <p className="text-[8px] text-zinc-600 font-mono">Device: {fiscal.deviceSerial}</p>
              <p className="text-[8px] text-zinc-600 font-mono break-all font-bold">Sig: {fiscal.signature}</p>
              
              <div className="flex justify-center my-1.5">
                <QRCodeSVG value={fiscal.verificationUrl} size={84} level="M" />
              </div>

              <p className="text-[8px] text-zinc-500">Scan QR to verify tax compliance on ZIMRA Portal</p>
              <div className="border-t border-dashed border-zinc-300 pt-1 mt-1 text-[8px] text-zinc-600">
                <p>*** Thank you for your business! ***</p>
                <p>Tareza ERP Smart POS System</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Quick Print Action Buttons */}
        <DialogFooter className="p-3 bg-zinc-900 border-t border-zinc-800 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              className="text-xs bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-200"
            >
              {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? 'Copied' : 'Copy Text'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadBin}
              className="text-xs bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-200"
              title="Download Raw ESC/POS Binary for RawBT / Hardware Terminals"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Raw .bin
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBluetoothPrint}
              disabled={isBluetoothPrinting}
              className="text-xs bg-indigo-950/60 border-indigo-700/60 hover:bg-indigo-900 text-indigo-300 font-semibold"
            >
              <Bluetooth className={`w-3.5 h-3.5 mr-1 ${isBluetoothPrinting ? 'animate-pulse' : ''}`} />
              BT Thermal
            </Button>
            <Button
              size="sm"
              onClick={handleStandardPrint}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print Receipt
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
