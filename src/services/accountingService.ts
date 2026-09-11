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
        const parsed: ARInvoice[] = JSON.parse(local);
        return parsed.filter(inv => !inv.id.startsWith('inv-00'));
      } catch (e) {
        // ignore
      }
    }
    return [];
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
        const parsed: APBill[] = JSON.parse(local);
        return parsed.filter(bill => !bill.id.startsWith('bill-00'));
      } catch (e) {
        // ignore
      }
    }
    return [];
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
        const parsed: BankAccount[] = JSON.parse(local);
        return parsed.filter(bank => !bank.id.startsWith('bank-0'));
      } catch (e) {
        // ignore
      }
    }
    return [];
  },

  async getBankTransactions(bankAccountId: string): Promise<BankTransaction[]> {
    const key = `${STORAGE_KEYS.BANK_TXNS}_${bankAccountId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        const parsed: BankTransaction[] = JSON.parse(local);
        return parsed.filter(t => !t.id.startsWith('btx-00'));
      } catch (e) {
        // ignore
      }
    }
    return [];
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
        const parsed: FixedAsset[] = JSON.parse(local);
        return parsed.filter(fa => !fa.id.startsWith('fa-00'));
      } catch (e) {
        // ignore
      }
    }
    return [];
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
        const parsed: TaxReturnPeriod[] = JSON.parse(local);
        return parsed.filter(tax => !tax.id.startsWith('tax-0'));
      } catch (e) {
        // ignore
      }
    }
    return [];
  },

  // ----------------------------------------------------
  // BUDGETING & VARIANCE ANALYSIS
  // ----------------------------------------------------
  async getBudgets(businessId: string): Promise<BudgetRecord[]> {
    const key = `${STORAGE_KEYS.BUDGETS}_${businessId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        const parsed: BudgetRecord[] = JSON.parse(local);
        return parsed.filter(b => !b.id.startsWith('bdg-00'));
      } catch (e) {
        // ignore
      }
    }
    return [];
  }
};
