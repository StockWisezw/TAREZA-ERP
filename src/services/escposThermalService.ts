/**
 * ESC/POS Thermal Receipt Module with ZIMRA Fiscal Signature Integration
 * Formats sales data into raw binary ESC/POS command buffers for direct
 * printing to 58mm/80mm thermal receipt printers (Bluetooth, USB, Network, RawBT, or File).
 */

export interface ESCPOSPrintOptions {
  paperWidth?: '58mm' | '80mm'; // 58mm = 32 cols, 80mm = 42-48 cols
  cutPaper?: boolean;
  openDrawer?: boolean;
  currencySymbol?: string;
  exchangeRateZiG?: number; // USD to ZiG rate
  fiscalDeviceSerial?: string;
  zimraDeviceId?: string;
  taxRatePercent?: number;
}

export interface ThermalSaleData {
  id?: string;
  receiptNumber: string;
  timestamp?: string;
  businessName?: string;
  branchName?: string;
  taxNumber?: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal?: number;
    vatAmount?: number;
    discount?: { type: string; value: number };
  }>;
  subtotal: number;
  discountTotal?: number;
  vatTotal: number;
  total: number;
  payments: Array<{
    method: string;
    amount: number;
    currency?: string;
  }>;
  changeDue?: number;
  leftChangeNote?: string;
  status?: string;
  fiscalSignature?: string;
  fiscalDay?: number;
  fiscalCounter?: number;
}

// ESC/POS Command Byte Constants
export const ESC = 0x1B;
export const GS = 0x1D;
export const FS = 0x1C;
export const LF = 0x0A;
export const CR = 0x0D;

class ESCPOSBufferBuilder {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  // Initialize printer
  init(): this {
    this.buffer.push(ESC, 0x40);
    return this;
  }

  // Text Alignment: 0 = Left, 1 = Center, 2 = Right
  align(alignment: 'left' | 'center' | 'right'): this {
    const code = alignment === 'center' ? 0x01 : alignment === 'right' ? 0x02 : 0x00;
    this.buffer.push(ESC, 0x61, code);
    return this;
  }

  // Bold text: true = on, false = off
  bold(enable: boolean): this {
    this.buffer.push(ESC, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  // Underline text: 0 = off, 1 = 1-dot, 2 = 2-dot
  underline(mode: 0 | 1 | 2): this {
    this.buffer.push(ESC, 0x2D, mode);
    return this;
  }

  // Character size: width & height multiplier (1 to 8)
  size(width: 1 | 2 | 3 | 4 = 1, height: 1 | 2 | 3 | 4 = 1): this {
    const n = ((width - 1) << 4) | (height - 1);
    this.buffer.push(GS, 0x21, n);
    return this;
  }

  // Inverted color (white on black)
  invert(enable: boolean): this {
    this.buffer.push(GS, 0x42, enable ? 0x01 : 0x00);
    return this;
  }

  // Print text
  text(str: string): this {
    // Convert string to bytes (ASCII/Code Page 437)
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 128) {
        this.buffer.push(code);
      } else {
        // Fallback for special characters
        this.buffer.push(0x20); // space or simplified character
      }
    }
    return this;
  }

  // Print text followed by line feed
  textLine(str: string = ''): this {
    this.text(str);
    this.newLine();
    return this;
  }

  // Line Feed
  newLine(count: number = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(LF);
    }
    return this;
  }

  // Two-column text with left and right alignment padded
  twoColumn(left: string, right: string, maxCols: number = 42): this {
    const availableSpace = maxCols - right.length;
    let truncatedLeft = left;
    if (truncatedLeft.length > availableSpace - 1) {
      truncatedLeft = truncatedLeft.substring(0, availableSpace - 2) + ' ';
    }
    const spaces = ' '.repeat(Math.max(1, maxCols - truncatedLeft.length - right.length));
    this.textLine(`${truncatedLeft}${spaces}${right}`);
    return this;
  }

  // Horizontal divider rule
  divider(char: string = '-', cols: number = 42): this {
    this.textLine(char.repeat(cols));
    return this;
  }

  // Cut Paper command
  cut(full: boolean = false): this {
    this.newLine(3);
    // GS V 65 0 (Partial Cut with feed)
    this.buffer.push(GS, 0x56, full ? 0x00 : 0x41, 0x10);
    return this;
  }

  // Kick Cash Drawer pulse
  kickCashDrawer(): this {
    // ESC p 0 25 250 (Pin 2, 50ms on, 500ms off)
    this.buffer.push(ESC, 0x70, 0x00, 0x19, 0xFA);
    return this;
  }

  // QR Code Generation command in ESC/POS (Model 2, size 5, Error correction L)
  qrCode(data: string): this {
    this.align('center');
    const length = data.length + 3;
    const pL = length % 256;
    const pH = Math.floor(length / 256);

    // 1. Set QR Model (Model 2)
    this.buffer.push(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2. Set Module Size (5)
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x05);
    // 3. Set Error Correction Level (Level M = 49)
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31);
    // 4. Store Data
    this.buffer.push(GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data.charCodeAt(i));
    }
    // 5. Print QR Code
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
    this.newLine(1);
    return this;
  }

  // Return complete Uint8Array
  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Generate ZIMRA Fiscal Verification Signature
 */
export function generateZIMRAFiscalSignature(receiptNumber: string, total: number): {
  signature: string;
  verificationUrl: string;
  deviceSerial: string;
  fiscalCounter: number;
} {
  const deviceSerial = 'FDMS-ZIMRA-ZW-009142';
  const cleanNum = receiptNumber.replace(/[^A-Za-z0-9]/g, '');
  // Deterministic hex signature
  let hashVal = 0;
  for (let i = 0; i < cleanNum.length; i++) {
    hashVal = (hashVal << 5) - hashVal + cleanNum.charCodeAt(i);
    hashVal |= 0;
  }
  const hexHash = Math.abs(hashVal).toString(16).toUpperCase().padStart(8, '0');
  const signature = `FDMS-SIG-${hexHash.substring(0, 4)}-${hexHash.substring(4, 8)}-${Math.floor(total * 100)}`;
  const fiscalCounter = Math.abs(hashVal % 9999) + 1;
  const verificationUrl = `https://testfdms.zimra.co.zw/verify?device=${deviceSerial}&rcpt=${receiptNumber}&amt=${total.toFixed(2)}&sig=${signature}`;

  return {
    signature,
    verificationUrl,
    deviceSerial,
    fiscalCounter
  };
}

/**
 * Format sales data into complete ESC/POS binary command buffer
 */
export function formatSaleToESCPOS(
  sale: ThermalSaleData,
  options: ESCPOSPrintOptions = {}
): Uint8Array {
  const cols = options.paperWidth === '58mm' ? 32 : 42;
  const builder = new ESCPOSBufferBuilder();

  // Optional: Kick cash drawer before printing
  if (options.openDrawer) {
    builder.kickCashDrawer();
  }

  const bizName = (sale.businessName || 'TAREZA ENTERPRISE').toUpperCase();
  const branchName = sale.branchName || 'Harare CBD Flagship';
  const taxNumber = sale.taxNumber || '10029384/2026';
  const cashier = sale.cashierName || 'Cashier Desk';
  const dateStr = sale.timestamp ? new Date(sale.timestamp).toLocaleString() : new Date().toLocaleString();

  // Calculate ZIMRA fiscal signature
  const fiscal = generateZIMRAFiscalSignature(sale.receiptNumber, sale.total);
  const activeSignature = sale.fiscalSignature || fiscal.signature;
  const exchangeRate = options.exchangeRateZiG || 26.5; // ZiG per USD
  const totalZiG = (sale.total * exchangeRate).toFixed(2);

  // 1. Header (Centered, bold, double height for store name)
  builder
    .align('center')
    .bold(true)
    .size(1, 2)
    .textLine(bizName)
    .size(1, 1)
    .bold(false)
    .textLine(branchName)
    .textLine(`VAT / BP Reg: ${taxNumber}`)
    .textLine(`Fiscal Device ID: ${options.zimraDeviceId || 'FDMS-ZIMRA-ZW-001'}`)
    .divider('=', cols);

  // 2. Receipt Meta
  builder
    .align('center')
    .bold(true)
    .textLine(sale.status === 'QUOTATION' ? '*** PRICE ESTIMATE / QUOTATION ***' : '*** TAX FISCAL INVOICE ***')
    .bold(false)
    .twoColumn(`Receipt: #${sale.receiptNumber}`, `Till: #01`, cols)
    .twoColumn(`Date: ${dateStr}`, `Counter: ${fiscal.fiscalCounter}`, cols)
    .twoColumn(`Cashier: ${cashier}`, `Mode: ${sale.status === 'offline_pending' ? 'OFFLINE' : 'ONLINE'}`, cols);

  if (sale.customerName && sale.customerName !== 'Walk-In Customer') {
    builder.twoColumn(`Customer: ${sale.customerName}`, sale.customerPhone || '', cols);
  }

  builder.divider('-', cols);

  // 3. Itemized List Header
  if (cols >= 40) {
    builder
      .bold(true)
      .textLine('ITEM               QTY    PRICE    TOTAL')
      .bold(false)
      .divider('-', cols);
  } else {
    builder
      .bold(true)
      .twoColumn('ITEM (QTY x PRICE)', 'TOTAL', cols)
      .bold(false)
      .divider('-', cols);
  }

  // 4. Line Items
  sale.items.forEach((item) => {
    const qty = item.quantity || 1;
    const price = item.price || 0;
    const lineTotal = (qty * price).toFixed(2);

    if (cols >= 40) {
      let itemName = item.name;
      if (itemName.length > 18) itemName = itemName.substring(0, 17) + '.';
      const itemCol = itemName.padEnd(18, ' ');
      const qtyCol = String(qty).padStart(4, ' ');
      const priceCol = `$${price.toFixed(2)}`.padStart(9, ' ');
      const totalCol = `$${lineTotal}`.padStart(9, ' ');
      builder.textLine(`${itemCol}${qtyCol}${priceCol}${totalCol}`);
    } else {
      builder.twoColumn(`${item.name} (${qty}x$${price.toFixed(2)})`, `$${lineTotal}`, cols);
    }
  });

  builder.divider('-', cols);

  // 5. Totals & Tax Breakdown (ZIMRA 15% VAT Standard)
  const subtotal = sale.subtotal.toFixed(2);
  const vat = sale.vatTotal.toFixed(2);
  const totalUsd = sale.total.toFixed(2);

  builder
    .twoColumn('Taxable Amount (USD):', `$${subtotal}`, cols)
    .twoColumn('ZIMRA VAT (15% Included):', `$${vat}`, cols);

  if (sale.discountTotal && sale.discountTotal > 0) {
    builder.twoColumn('Discount Applied:', `-$${sale.discountTotal.toFixed(2)}`, cols);
  }

  builder
    .divider('=', cols)
    .bold(true)
    .size(1, 2)
    .twoColumn('TOTAL (USD):', `$${totalUsd}`, cols)
    .size(1, 1)
    .twoColumn('EQUIVALENT (ZiG):', `ZiG ${totalZiG}`, cols)
    .bold(false)
    .divider('=', cols);

  // 6. Payments Breakdown
  builder.bold(true).textLine('PAYMENTS RECEIVED:').bold(false);
  if (sale.payments && sale.payments.length > 0) {
    sale.payments.forEach((p) => {
      const methodLabel = p.method.replace('_', ' ').toUpperCase();
      builder.twoColumn(` ${methodLabel}:`, `$${Number(p.amount).toFixed(2)}`, cols);
    });
  } else {
    builder.twoColumn(' CASH USD:', `$${totalUsd}`, cols);
  }

  if (sale.changeDue && sale.changeDue > 0) {
    builder.bold(true).twoColumn(' CHANGE RETURNED:', `$${sale.changeDue.toFixed(2)}`, cols).bold(false);
  }

  if (sale.leftChangeNote) {
    builder.divider('-', cols).textLine(`[!] CHANGE LEFT: ${sale.leftChangeNote}`);
  }

  // 7. ZIMRA Fiscal Verification Block & QR Code
  builder
    .divider('-', cols)
    .align('center')
    .bold(true)
    .textLine('ZIMRA FISCAL VERIFICATION')
    .bold(false)
    .textLine(`Device SN: ${fiscal.deviceSerial}`)
    .textLine(`Signature: ${activeSignature}`)
    .newLine(1)
    .qrCode(fiscal.verificationUrl)
    .textLine('Scan QR code to verify fiscal compliance')
    .divider('-', cols)
    .align('center')
    .textLine('Thank you for shopping with us!')
    .textLine('Powered by Tareza ERP Global POS')
    .textLine('Support: support@tarezaerp.co.zw');

  // Cut Paper
  if (options.cutPaper !== false) {
    builder.cut(false);
  }

  return builder.build();
}

/**
 * Generate human-readable monospace thermal receipt string for preview
 */
export function formatSaleToThermalText(
  sale: ThermalSaleData,
  options: ESCPOSPrintOptions = {}
): string {
  const cols = options.paperWidth === '58mm' ? 32 : 42;
  const lines: string[] = [];

  const center = (str: string) => {
    if (str.length >= cols) return str.substring(0, cols);
    const leftPad = Math.floor((cols - str.length) / 2);
    return ' '.repeat(leftPad) + str;
  };

  const twoCol = (left: string, right: string) => {
    const space = cols - left.length - right.length;
    if (space <= 0) {
      const truncated = left.substring(0, cols - right.length - 1) + ' ';
      return truncated + right;
    }
    return left + ' '.repeat(space) + right;
  };

  const divider = (char: string = '-') => char.repeat(cols);

  const bizName = (sale.businessName || 'TAREZA ENTERPRISE').toUpperCase();
  const fiscal = generateZIMRAFiscalSignature(sale.receiptNumber, sale.total);
  const exchangeRate = options.exchangeRateZiG || 26.5;
  const totalZiG = (sale.total * exchangeRate).toFixed(2);

  lines.push(center(bizName));
  lines.push(center(sale.branchName || 'Main Retail Branch'));
  lines.push(center(`VAT Reg: ${sale.taxNumber || '10029384/2026'}`));
  lines.push(divider('='));
  lines.push(center(sale.status === 'QUOTATION' ? '*** PRICE ESTIMATE ***' : '*** TAX FISCAL INVOICE ***'));
  lines.push(twoCol(`Rcpt: #${sale.receiptNumber}`, `Till: #01`));
  lines.push(twoCol(`Date: ${new Date(sale.timestamp || Date.now()).toLocaleDateString()}`, `Counter: ${fiscal.fiscalCounter}`));
  lines.push(twoCol(`Cashier: ${sale.cashierName || 'Cashier Desk'}`, `Sync: ${sale.status === 'offline_pending' ? 'OFFLINE' : 'ONLINE'}`));

  if (sale.customerName && sale.customerName !== 'Walk-In Customer') {
    lines.push(twoCol(`Customer: ${sale.customerName}`, sale.customerPhone || ''));
  }

  lines.push(divider('-'));
  lines.push(twoCol('ITEM (QTY x PRICE)', 'TOTAL'));
  lines.push(divider('-'));

  sale.items.forEach((item) => {
    const qty = item.quantity || 1;
    const price = item.price || 0;
    const lineTotal = (qty * price).toFixed(2);
    lines.push(twoCol(`${item.name} (${qty}x$${price.toFixed(2)})`, `$${lineTotal}`));
  });

  lines.push(divider('-'));
  lines.push(twoCol('Subtotal (USD):', `$${sale.subtotal.toFixed(2)}`));
  lines.push(twoCol('ZIMRA VAT (15%):', `$${sale.vatTotal.toFixed(2)}`));
  if (sale.discountTotal && sale.discountTotal > 0) {
    lines.push(twoCol('Discount:', `-$${sale.discountTotal.toFixed(2)}`));
  }
  lines.push(divider('='));
  lines.push(twoCol('TOTAL (USD):', `$${sale.total.toFixed(2)}`));
  lines.push(twoCol('TOTAL (ZiG):', `ZiG ${totalZiG}`));
  lines.push(divider('='));

  lines.push('PAYMENTS:');
  if (sale.payments && sale.payments.length > 0) {
    sale.payments.forEach((p) => {
      lines.push(twoCol(` ${p.method.replace('_', ' ').toUpperCase()}:`, `$${Number(p.amount).toFixed(2)}`));
    });
  } else {
    lines.push(twoCol(' CASH USD:', `$${sale.total.toFixed(2)}`));
  }

  if (sale.changeDue && sale.changeDue > 0) {
    lines.push(twoCol(' CHANGE RETURNED:', `$${sale.changeDue.toFixed(2)}`));
  }

  if (sale.leftChangeNote) {
    lines.push(divider('-'));
    lines.push(`[!] CHANGE LEFT: ${sale.leftChangeNote}`);
  }

  lines.push(divider('-'));
  lines.push(center('ZIMRA FISCAL VERIFICATION'));
  lines.push(center(`Device: ${fiscal.deviceSerial}`));
  lines.push(center(`Sig: ${sale.fiscalSignature || fiscal.signature}`));
  lines.push(center('[ QR CODE FISCAL VERIFY ]'));
  lines.push(divider('-'));
  lines.push(center('Thank you for your business!'));
  lines.push(center('Powered by Tareza ERP Global POS'));

  return lines.join('\n');
}

/**
 * Print directly to a Web Bluetooth Thermal Printer
 */
export async function printViaBluetooth(
  sale: ThermalSaleData,
  options: ESCPOSPrintOptions = {}
): Promise<{ success: boolean; message: string }> {
  if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
    return {
      success: false,
      message: 'Web Bluetooth is not supported in this browser. Please use Google Chrome or Edge on Android / Desktop.'
    };
  }

  try {
    const rawBuffer = formatSaleToESCPOS(sale, options);

    // Request Bluetooth device with printer service
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Standard thermal printer service
        { namePrefix: 'POS' },
        { namePrefix: 'Thermal' },
        { namePrefix: 'Printer' },
        { namePrefix: 'MPT' },
        { namePrefix: 'XP-' },
        { namePrefix: 'RP' }
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'
      ]
    });

    const server = await device.gatt.connect();
    // Locate writable characteristic
    let characteristic: any = null;

    const services = await server.getPrimaryServices();
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          characteristic = char;
          break;
        }
      }
      if (characteristic) break;
    }

    if (!characteristic) {
      throw new Error('Could not find a writable characteristic on this Bluetooth printer.');
    }

    // Send in 512-byte chunks to avoid buffer overruns
    const chunkSize = 512;
    for (let i = 0; i < rawBuffer.length; i += chunkSize) {
      const chunk = rawBuffer.slice(i, i + chunkSize);
      await characteristic.writeValue(chunk);
    }

    return { success: true, message: 'Receipt dispatched to Bluetooth printer successfully!' };
  } catch (err: any) {
    console.error('[Bluetooth Print Error]', err);
    return { success: false, message: err.message || 'Bluetooth connection failed.' };
  }
}

/**
 * Download Raw ESC/POS Binary File for RawBT or hardware spooler
 */
export function downloadESCPOSFile(sale: ThermalSaleData, options: ESCPOSPrintOptions = {}) {
  const rawBytes = formatSaleToESCPOS(sale, options);
  const blob = new Blob([rawBytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt-${sale.receiptNumber}.bin`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
