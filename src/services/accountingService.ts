import { supabase } from '../lib/firebaseClient';
import { ARInvoice, APBill, BankAccount, BankTransaction, FixedAsset, TaxReturnPeriod, BudgetRecord } from '../types/erp';
import { postJournalEntry } from './ledgerService';
import { toast } from 'sonner';

const STORAGE_KEYS = {
  INVOICES: 'tareza_erp_ar_invoices',
  BILLS: 'tareza_erp_ap_bills',
  BANK_ACCOUNTS: 'tareza_erp_bank_accounts',
  BANK_TXNS: 'tareza_erp_bank_transactions',
  FIXED_ASSETS: 'tareza_erp_fixed_assets',
  TAX_RETURNS: 'tareza_erp_tax_returns',
  BUDGETS: 'tareza_erp_budgets'
};

export const accountingService = {
  // ----------------------------------------------------
  // ACCOUNTS RECEIVABLE (A/R) & INVOICES
  // ----------------------------------------------------
  async getInvoices(businessId: string): Promise<ARInvoice[]> {
    const key = `${STORAGE_KEYS.INVOICES}_${businessId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        // ignore
      }
    }

    // Default sample corporate invoices
    const defaults: ARInvoice[] = [
      {
        id: 'inv-001',
        business_id: businessId,
        customer_name: 'Delta Beverages Distribution',
        customer_email: 'finance@deltabev.co.zw',
        customer_phone: '+263 77 100 2000',
        invoice_number: 'INV-2026-0081',
        issue_date: '2026-08-01',
        due_date: '2026-08-31',
        subtotal: 3200.00,
        tax_rate: 15.0,
        tax_amount: 480.00,
        discount_amount: 0,
        total_amount: 3680.00,
        amount_paid: 2000.00,
        balance_due: 1680.00,
        status: 'partially_paid',
        notes: 'Monthly corporate wholesale supply consignment.',
        items: [
          { description: 'Premium Commercial Bulk Pack Supply', quantity: 20, unit_price: 120.00, tax_rate: 15, amount: 2400.00 },
          { description: 'Logistics handling & Express Delivery', quantity: 1, unit_price: 800.00, tax_rate: 15, amount: 800.00 }
        ],
        created_at: new Date(Date.now() - 20 * 86400000).toISOString()
      },
      {
        id: 'inv-002',
        business_id: businessId,
        customer_name: 'Meikles Hospitality Group',
        customer_email: 'procurement@meikles.co.zw',
        customer_phone: '+263 71 300 4000',
        invoice_number: 'INV-2026-0082',
        issue_date: '2026-08-10',
        due_date: '2026-09-10',
        subtotal: 1850.00,
        tax_rate: 15.0,
        tax_amount: 277.50,
        discount_amount: 50.00,
        total_amount: 2077.50,
        amount_paid: 0,
        balance_due: 2077.50,
        status: 'sent',
        notes: 'Hotel retail replenishment batch.',
        items: [
          { description: 'Specialty Retail Consumables (Grade A)', quantity: 50, unit_price: 37.00, tax_rate: 15, amount: 1850.00 }
        ],
        created_at: new Date(Date.now() - 11 * 86400000).toISOString()
      }
    ];

    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  },

  async createInvoice(
    businessId: string, 
    branchId: string, 
    userId: string, 
    invoice: Partial<ARInvoice>,
    postToGL: boolean = true
  ): Promise<ARInvoice> {
    const list = await this.getInvoices(businessId);
    const invNum = invoice.invoice_number || `INV-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, '0')}`;

    const subtotal = Number(invoice.subtotal) || 0;
    const taxRate = Number(invoice.tax_rate) || 15.0;
    const taxAmount = (subtotal * taxRate) / 100;
    const discount = Number(invoice.discount_amount) || 0;
    const totalAmount = subtotal + taxAmount - discount;
    const amountPaid = Number(invoice.amount_paid) || 0;
    const balanceDue = totalAmount - amountPaid;

    const newInv: ARInvoice = {
      id: `inv-${Date.now()}`,
      business_id: businessId,
      customer_id: invoice.customer_id,
      customer_name: invoice.customer_name || 'Valued Customer',
      customer_email: invoice.customer_email || '',
      customer_phone: invoice.customer_phone || '',
      invoice_number: invNum,
      issue_date: invoice.issue_date || new Date().toISOString().split('T')[0],
      due_date: invoice.due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      discount_amount: discount,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      status: balanceDue === 0 ? 'paid' : (amountPaid > 0 ? 'partially_paid' : 'sent'),
      notes: invoice.notes || '',
      items: invoice.items || [{ description: 'General Goods/Services', quantity: 1, unit_price: subtotal, tax_rate: taxRate, amount: subtotal }],
      created_at: new Date().toISOString()
    };

    list.unshift(newInv);
    localStorage.setItem(`${STORAGE_KEYS.INVOICES}_${businessId}`, JSON.stringify(list));

    if (postToGL && totalAmount > 0) {
      // Dr 1100 Accounts Receivable (Total Invoice)
      // Cr 4000 Sales Revenue (Subtotal - Discount)
      // Cr 2100 Output VAT Payable (Tax Amount)
      const glLines = [
        {
          accountCode: '1100', // Accounts Receivable
          debit: Number(totalAmount.toFixed(2)),
          credit: 0,
          description: `Invoice ${invNum} to ${newInv.customer_name}`
        },
        {
          accountCode: '4000', // Sales Revenue
          debit: 0,
          credit: Number((subtotal - discount).toFixed(2)),
          description: `Sales revenue for ${invNum}`
        },
        {
          accountCode: '2100', // Output VAT Payable
          debit: 0,
          credit: Number(taxAmount.toFixed(2)),
          description: `15% VAT on ${invNum}`
        }
      ];

      try {
        await postJournalEntry(
          businessId,
          branchId,
          userId,
          invNum,
          `Customer Sales Invoice ${invNum} - ${newInv.customer_name}`,
          glLines
        );
      } catch (e) {
        console.warn('Invoice GL post fallback:', e);
      }
    }

    return newInv;
  },

  async recordInvoicePayment(
    businessId: string, 
    branchId: string, 
    userId: string, 
    invoiceId: string, 
    paymentAmount: number,
    paymentMethod: string = 'Cash Till'
  ): Promise<boolean> {
    const list = await this.getInvoices(businessId);
    const inv = list.find(i => i.id === invoiceId);
    if (!inv) return false;

    inv.amount_paid += paymentAmount;
    inv.balance_due = Math.max(0, inv.total_amount - inv.amount_paid);
    inv.status = inv.balance_due === 0 ? 'paid' : 'partially_paid';

    localStorage.setItem(`${STORAGE_KEYS.INVOICES}_${businessId}`, JSON.stringify(list));

    // Post GL payment:
    // Dr 1000 Cash / Bank
    // Cr 1100 Accounts Receivable
    const glLines = [
      {
        accountCode: '1000',
        debit: Number(paymentAmount.toFixed(2)),
        credit: 0,
        description: `Payment received on ${inv.invoice_number} via ${paymentMethod}`
      },
      {
        accountCode: '1100',
        debit: 0,
        credit: Number(paymentAmount.toFixed(2)),
        description: `Settle A/R for ${inv.invoice_number}`
      }
    ];

    try {
      await postJournalEntry(
        businessId,
        branchId,
        userId,
        `PAY-${inv.invoice_number}`,
        `Payment receipt on ${inv.invoice_number} from ${inv.customer_name}`,
        glLines
      );
    } catch (e) {
      console.warn('Payment GL post fallback:', e);
    }

    return true;
  },

  // ----------------------------------------------------
  // ACCOUNTS PAYABLE (A/P) & VENDOR BILLS
  // ----------------------------------------------------
  async getBills(businessId: string): Promise<APBill[]> {
    const key = `${STORAGE_KEYS.BILLS}_${businessId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        // ignore
      }
    }

    const defaults: APBill[] = [
      {
        id: 'bill-001',
        business_id: businessId,
        supplier_name: 'National Foods Holdings Ltd',
        bill_number: 'NF-992318',
        bill_date: '2026-08-05',
        due_date: '2026-08-25',
        expense_account_code: '5000',
        expense_account_name: 'Cost of Goods Sold (Inventory Purchase)',
        subtotal: 4100.00,
        tax_amount: 615.00,
        total_amount: 4715.00,
        amount_paid: 4715.00,
        balance_due: 0,
        status: 'paid',
        notes: 'Bulk flour and grain supply consignment.',
        created_at: new Date(Date.now() - 16 * 86400000).toISOString()
      },
      {
        id: 'bill-002',
        business_id: businessId,
        supplier_name: 'City of Harare Commercial Utilities',
        bill_number: 'UTIL-HAR-AUG-26',
        bill_date: '2026-08-12',
        due_date: '2026-08-28',
        expense_account_code: '6200',
        expense_account_name: 'Rent & Utilities Expense',
        subtotal: 580.00,
        tax_amount: 87.00,
        total_amount: 667.00,
        amount_paid: 0,
        balance_due: 667.00,
        status: 'approved',
        notes: 'Monthly power and municipal water service bill.',
        created_at: new Date(Date.now() - 9 * 86400000).toISOString()
      }
    ];

    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  },

  async createBill(
    businessId: string, 
    branchId: string, 
    userId: string, 
    bill: Partial<APBill>,
    postToGL: boolean = true
  ): Promise<APBill> {
    const list = await this.getBills(businessId);
    const subtotal = Number(bill.subtotal) || 0;
    const taxAmount = Number(bill.tax_amount) || (subtotal * 0.15);
    const totalAmount = subtotal + taxAmount;
    const amountPaid = Number(bill.amount_paid) || 0;
    const balanceDue = totalAmount - amountPaid;

    const newBill: APBill = {
      id: `bill-${Date.now()}`,
      business_id: businessId,
      supplier_id: bill.supplier_id,
      supplier_name: bill.supplier_name || 'Vendor Supplier',
      bill_number: bill.bill_number || `BILL-${Date.now().toString().slice(-6)}`,
      bill_date: bill.bill_date || new Date().toISOString().split('T')[0],
      due_date: bill.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      expense_account_code: bill.expense_account_code || '6000',
      expense_account_name: bill.expense_account_name || 'Operating Expenses',
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      status: balanceDue === 0 ? 'paid' : 'approved',
      notes: bill.notes || '',
      created_at: new Date().toISOString()
    };

    list.unshift(newBill);
    localStorage.setItem(`${STORAGE_KEYS.BILLS}_${businessId}`, JSON.stringify(list));

    if (postToGL && totalAmount > 0) {
      // Dr Expense / Asset Account (Subtotal)
      // Dr Input VAT Account / 2100 (Tax Amount)
      // Cr 2000 Accounts Payable (Total Amount)
      const glLines = [
        {
          accountCode: newBill.expense_account_code,
          debit: Number(subtotal.toFixed(2)),
          credit: 0,
          description: `Vendor bill ${newBill.bill_number} - ${newBill.supplier_name}`
        },
        {
          accountCode: '2100', // Input Tax credit
          debit: Number(taxAmount.toFixed(2)),
          credit: 0,
          description: `Input VAT claim on ${newBill.bill_number}`
        },
        {
          accountCode: '2000', // Accounts Payable
          debit: 0,
          credit: Number(totalAmount.toFixed(2)),
          description: `Vendor liability for ${newBill.bill_number}`
        }
      ];

      try {
        await postJournalEntry(
          businessId,
          branchId,
          userId,
          newBill.bill_number,
          `Vendor Bill ${newBill.bill_number} - ${newBill.supplier_name}`,
          glLines
        );
      } catch (e) {
        console.warn('Bill GL post fallback:', e);
      }
    }

    return newBill;
  },

  async recordBillPayment(
    businessId: string, 
    branchId: string, 
    userId: string, 
    billId: string, 
    paymentAmount: number,
    paymentMethod: string = 'Bank Transfer'
  ): Promise<boolean> {
    const list = await this.getBills(businessId);
    const bill = list.find(b => b.id === billId);
    if (!bill) return false;

    bill.amount_paid += paymentAmount;
    bill.balance_due = Math.max(0, bill.total_amount - bill.amount_paid);
    bill.status = bill.balance_due === 0 ? 'paid' : 'partially_paid';

    localStorage.setItem(`${STORAGE_KEYS.BILLS}_${businessId}`, JSON.stringify(list));

    // Post GL payment:
    // Dr 2000 Accounts Payable
    // Cr 1000 Cash / Bank Account
    const glLines = [
      {
        accountCode: '2000',
        debit: Number(paymentAmount.toFixed(2)),
        credit: 0,
        description: `Disbursement to settle ${bill.bill_number} (${bill.supplier_name})`
      },
      {
        accountCode: '1000',
        debit: 0,
        credit: Number(paymentAmount.toFixed(2)),
        description: `Cash disbursement via ${paymentMethod}`
      }
    ];

    try {
      await postJournalEntry(
        businessId,
        branchId,
        userId,
        `DISB-${bill.bill_number}`,
        `Vendor Payment on ${bill.bill_number} to ${bill.supplier_name}`,
        glLines
      );
    } catch (e) {
      console.warn('Bill payment GL post fallback:', e);
    }

    return true;
  },

  // ----------------------------------------------------
  // BANKING & BANK RECONCILIATION
  // ----------------------------------------------------
  async getBankAccounts(businessId: string): Promise<BankAccount[]> {
    const key = `${STORAGE_KEYS.BANK_ACCOUNTS}_${businessId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        // ignore
      }
    }

    const defaults: BankAccount[] = [
      {
        id: 'bank-01',
        business_id: businessId,
        account_name: 'Main Operating Current Account',
        bank_name: 'Standard Chartered Bank',
        account_number: '8700-1122-3344-01',
        gl_account_code: '1000',
        currency: 'USD',
        book_balance: 14850.00,
        statement_balance: 14850.00,
        last_reconciled_date: '2026-08-15',
        status: 'active',
        created_at: new Date().toISOString()
      },
      {
        id: 'bank-02',
        business_id: businessId,
        account_name: 'Retail POS Cash Till Drawer',
        bank_name: 'Physical Cash Till Float',
        account_number: 'TILL-REG-01',
        gl_account_code: '1000',
        currency: 'USD',
        book_balance: 1250.00,
        statement_balance: 1250.00,
        last_reconciled_date: '2026-08-20',
        status: 'active',
        created_at: new Date().toISOString()
      }
    ];

    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  },

  async getBankTransactions(bankAccountId: string): Promise<BankTransaction[]> {
    const key = `${STORAGE_KEYS.BANK_TXNS}_${bankAccountId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        // ignore
      }
    }

    const defaults: BankTransaction[] = [
      {
        id: 'btx-001',
        bank_account_id: bankAccountId,
        date: '2026-08-18',
        reference: 'DEP-POS-0818',
        payee_payer: 'Daily POS Sales Settlement',
        description: 'End-of-day credit card and cash banking deposit',
        type: 'deposit',
        amount: 2450.00,
        is_reconciled: true,
        reconciled_at: '2026-08-18T18:00:00Z',
        created_at: '2026-08-18T18:00:00Z'
      },
      {
        id: 'btx-002',
        bank_account_id: bankAccountId,
        date: '2026-08-19',
        reference: 'EFT-SUP-441',
        payee_payer: 'National Foods Holdings',
        description: 'Supplier stock replenishment payment',
        type: 'withdrawal',
        amount: 1800.00,
        is_reconciled: true,
        reconciled_at: '2026-08-19T10:00:00Z',
        created_at: '2026-08-19T10:00:00Z'
      },
      {
        id: 'btx-003',
        bank_account_id: bankAccountId,
        date: '2026-08-20',
        reference: 'FEE-CHRG-AUG',
        payee_payer: 'Standard Chartered Bank',
        description: 'Monthly electronic ledger maintenance & RTGS service fee',
        type: 'fee',
        amount: 35.00,
        is_reconciled: false,
        created_at: '2026-08-20T08:00:00Z'
      },
      {
        id: 'btx-004',
        bank_account_id: bankAccountId,
        date: '2026-08-20',
        reference: 'INT-CR-0820',
        payee_payer: 'Commercial Overnight Deposit',
        description: 'Monthly interest earned on positive cash reserves',
        type: 'interest',
        amount: 62.50,
        is_reconciled: false,
        created_at: '2026-08-20T09:00:00Z'
      }
    ];

    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  },

  async toggleReconcileTransaction(bankAccountId: string, txnId: string, isReconciled: boolean): Promise<boolean> {
    const list = await this.getBankTransactions(bankAccountId);
    const item = list.find(t => t.id === txnId);
    if (!item) return false;

    item.is_reconciled = isReconciled;
    item.reconciled_at = isReconciled ? new Date().toISOString() : undefined;

    localStorage.setItem(`${STORAGE_KEYS.BANK_TXNS}_${bankAccountId}`, JSON.stringify(list));
    return true;
  },

  // ----------------------------------------------------
  // FIXED ASSETS & DEPRECIATION ENGINE
  // ----------------------------------------------------
  async getFixedAssets(businessId: string): Promise<FixedAsset[]> {
    const key = `${STORAGE_KEYS.FIXED_ASSETS}_${businessId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        // ignore
      }
    }

    const defaults: FixedAsset[] = [
      {
        id: 'fa-001',
        business_id: businessId,
        asset_code: 'FA-POS-001',
        name: 'Dual-Screen POS Terminal & Thermal Hardware',
        category: 'Equipment',
        purchase_date: '2024-01-10',
        purchase_cost: 2400.00,
        salvage_value: 200.00,
        useful_life_years: 3,
        depreciation_method: 'straight_line',
        accumulated_depreciation: 1200.00,
        current_book_value: 1200.00,
        asset_account_code: '1500',
        deprec_expense_account_code: '6500',
        accum_deprec_account_code: '1510',
        last_depreciation_date: '2026-07-31',
        status: 'active',
        created_at: '2024-01-10T08:00:00Z'
      },
      {
        id: 'fa-002',
        business_id: businessId,
        asset_code: 'FA-VEH-002',
        name: 'Toyota Hilux Logistics Delivery Van',
        category: 'Vehicles',
        purchase_date: '2023-05-15',
        purchase_cost: 18500.00,
        salvage_value: 3500.00,
        useful_life_years: 5,
        depreciation_method: 'straight_line',
        accumulated_depreciation: 9000.00,
        current_book_value: 9500.00,
        asset_account_code: '1500',
        deprec_expense_account_code: '6500',
        accum_deprec_account_code: '1510',
        last_depreciation_date: '2026-07-31',
        status: 'active',
        created_at: '2023-05-15T08:00:00Z'
      },
      {
        id: 'fa-003',
        business_id: businessId,
        asset_code: 'FA-FRN-003',
        name: 'Commercial Display Shelving & Glass Showcases',
        category: 'Furniture & Fixtures',
        purchase_date: '2023-08-20',
        purchase_cost: 4800.00,
        salvage_value: 400.00,
        useful_life_years: 4,
        depreciation_method: 'straight_line',
        accumulated_depreciation: 3300.00,
        current_book_value: 1500.00,
        asset_account_code: '1500',
        deprec_expense_account_code: '6500',
        accum_deprec_account_code: '1510',
        last_depreciation_date: '2026-07-31',
        status: 'active',
        created_at: '2023-08-20T08:00:00Z'
      }
    ];

    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  },

  async addFixedAsset(businessId: string, asset: Partial<FixedAsset>): Promise<FixedAsset> {
    const list = await this.getFixedAssets(businessId);
    const cost = Number(asset.purchase_cost) || 0;
    const salvage = Number(asset.salvage_value) || 0;
    const years = Number(asset.useful_life_years) || 3;

    const newAsset: FixedAsset = {
      id: `fa-${Date.now()}`,
      business_id: businessId,
      asset_code: asset.asset_code || `FA-${Date.now().toString().slice(-4)}`,
      name: asset.name || 'Fixed Asset Item',
      category: asset.category || 'Equipment',
      purchase_date: asset.purchase_date || new Date().toISOString().split('T')[0],
      purchase_cost: cost,
      salvage_value: salvage,
      useful_life_years: years,
      depreciation_method: 'straight_line',
      accumulated_depreciation: 0,
      current_book_value: cost,
      asset_account_code: '1500',
      deprec_expense_account_code: '6500',
      accum_deprec_account_code: '1510',
      status: 'active',
      created_at: new Date().toISOString()
    };

    list.unshift(newAsset);
    localStorage.setItem(`${STORAGE_KEYS.FIXED_ASSETS}_${businessId}`, JSON.stringify(list));
    return newAsset;
  },

  async runMonthlyDepreciation(
    businessId: string,
    branchId: string,
    userId: string,
    periodMonth: string = 'August 2026'
  ): Promise<{ totalDepreciation: number; journalRef: string }> {
    const assets = (await this.getFixedAssets(businessId)).filter(a => a.status === 'active');
    let totalDeprec = 0;

    assets.forEach(a => {
      // Monthly straight line depreciation = (Cost - Salvage) / (Years * 12)
      const depreciableBasis = Math.max(0, a.purchase_cost - a.salvage_value);
      const monthlyRate = depreciableBasis / (a.useful_life_years * 12);
      
      const maxPossibleDeprec = Math.max(0, a.current_book_value - a.salvage_value);
      const actualDeprec = Math.min(monthlyRate, maxPossibleDeprec);

      a.accumulated_depreciation += actualDeprec;
      a.current_book_value = Math.max(a.salvage_value, a.purchase_cost - a.accumulated_depreciation);
      a.last_depreciation_date = new Date().toISOString().split('T')[0];

      totalDeprec += actualDeprec;
    });

    localStorage.setItem(`${STORAGE_KEYS.FIXED_ASSETS}_${businessId}`, JSON.stringify(assets));

    const refCode = `DEPREC-${periodMonth.toUpperCase().replace(/\s+/g, '-')}`;

    if (totalDeprec > 0) {
      // Dr 6500 Depreciation Expense
      // Cr 1510 Accumulated Depreciation
      const glLines = [
        {
          accountCode: '6500',
          debit: Number(totalDeprec.toFixed(2)),
          credit: 0,
          description: `Fixed Asset Depreciation Expense for ${periodMonth}`
        },
        {
          accountCode: '1510',
          debit: 0,
          credit: Number(totalDeprec.toFixed(2)),
          description: `Accumulated Depreciation Allowance for ${periodMonth}`
        }
      ];

      try {
        await postJournalEntry(
          businessId,
          branchId,
          userId,
          refCode,
          `Monthly Fixed Assets Straight-Line Depreciation for ${periodMonth}`,
          glLines
        );
      } catch (e) {
        console.warn('Depreciation GL post fallback:', e);
      }
    }

    return { totalDepreciation: totalDeprec, journalRef: refCode };
  },

  // ----------------------------------------------------
  // TAX & VAT RETURNS MANAGER
  // ----------------------------------------------------
  async getTaxReturns(businessId: string): Promise<TaxReturnPeriod[]> {
    const key = `${STORAGE_KEYS.TAX_RETURNS}_${businessId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        // ignore
      }
    }

    const defaults: TaxReturnPeriod[] = [
      {
        id: 'tax-01',
        business_id: businessId,
        period_name: 'July 2026 (Monthly VAT Return)',
        tax_type: 'VAT',
        start_date: '2026-07-01',
        end_date: '2026-07-31',
        taxable_sales: 34500.00,
        output_tax_collected: 5175.00,
        taxable_purchases: 18200.00,
        input_tax_paid: 2730.00,
        net_tax_payable: 2445.00,
        filing_status: 'settled',
        filed_at: '2026-08-10T14:30:00Z',
        payment_reference: 'ZIMRA-VAT-778921',
        created_at: '2026-08-01T00:00:00Z'
      },
      {
        id: 'tax-02',
        business_id: businessId,
        period_name: 'August 2026 (Current VAT Accrual)',
        tax_type: 'VAT',
        start_date: '2026-08-01',
        end_date: '2026-08-31',
        taxable_sales: 28900.00,
        output_tax_collected: 4335.00,
        taxable_purchases: 15400.00,
        input_tax_paid: 2310.00,
        net_tax_payable: 2025.00,
        filing_status: 'pending',
        created_at: new Date().toISOString()
      }
    ];

    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  },

  // ----------------------------------------------------
  // BUDGETING & VARIANCE ANALYSIS
  // ----------------------------------------------------
  async getBudgets(businessId: string): Promise<BudgetRecord[]> {
    const key = `${STORAGE_KEYS.BUDGETS}_${businessId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        // ignore
      }
    }

    const defaults: BudgetRecord[] = [
      {
        id: 'bdg-001',
        business_id: businessId,
        account_code: '4000',
        account_name: 'Gross Retail Sales Revenue',
        category: 'Revenue',
        period_year: 2026,
        budget_amount: 35000.00,
        actual_amount: 38400.00,
        variance_amount: 3400.00,
        variance_percent: 9.71,
        created_at: new Date().toISOString()
      },
      {
        id: 'bdg-002',
        business_id: businessId,
        account_code: '5000',
        account_name: 'Cost of Goods Sold (COGS)',
        category: 'COGS',
        period_year: 2026,
        budget_amount: 21000.00,
        actual_amount: 22800.00,
        variance_amount: -1800.00,
        variance_percent: -8.57,
        created_at: new Date().toISOString()
      },
      {
        id: 'bdg-003',
        business_id: businessId,
        account_code: '6100',
        account_name: 'Salaries & Staff Remuneration',
        category: 'Operating_Expense',
        period_year: 2026,
        budget_amount: 4500.00,
        actual_amount: 4200.00,
        variance_amount: 300.00,
        variance_percent: 6.67,
        created_at: new Date().toISOString()
      },
      {
        id: 'bdg-004',
        business_id: businessId,
        account_code: '6200',
        account_name: 'Store Rent & Commercial Utilities',
        category: 'Operating_Expense',
        period_year: 2026,
        budget_amount: 1500.00,
        actual_amount: 1480.00,
        variance_amount: 20.00,
        variance_percent: 1.33,
        created_at: new Date().toISOString()
      }
    ];

    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }
};
