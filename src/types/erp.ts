export interface Business {
  id: string;
  name: string;
  tax_number: string | null;
  currency?: string;
  subscription_status?: string;
  subscription_end_date?: string;
  created_at: string;
}

export interface Branch {
  id: string;
  business_id: string;
  name: string;
  type: 'retail' | 'warehouse' | 'office';
  location?: string | null;
  created_at: string;
}

export interface Role {
  id: string;
  business_id: string;
  name: string;
  description: string;
  permissions?: string[];
  created_at: string;
}

export interface BusinessUser {
  id: string;
  business_id: string;
  user_id: string;
  branch_id: string;
  role_id: string;
  is_active: boolean;
  status?: 'pending_registration' | 'active';
  created_at?: string;
}

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at?: string;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  created_at?: string;
}

export interface Product {
  id: string;
  business_id: string;
  category_id?: string | null;
  name: string;
  sku: string;
  barcode?: string | null;
  retail_price: number;
  wholesale_price: number;
  cost_price: number;
  is_active: boolean;
  created_at: string;
}

export interface Inventory {
  id: string;
  business_id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  reorder_level: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  vat_number?: string | null;
  customer_type: 'individual' | 'corporate';
  balance: number;
  credit_limit: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  contact_person?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  balance: number;
  status: 'active' | 'inactive';
  tax_number?: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  business_id: string;
  branch_id: string;
  user_id: string;
  customer_id?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  receiptNumber: string;
  subtotal: number;
  vat_total: number;
  discount_total: number;
  total: number;
  total_amount?: number;
  total_tax_amount?: number;
  payment_method: string;
  status: 'completed' | 'refunded' | 'voided';
  created_at: string;
  timestamp?: string;
}

export interface SaleItem {
  id: string;
  business_id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  price: number;
  unit_price: number;
  line_total: number;
  vat_amount: number;
}

export interface StockMovement {
  id: string;
  business_id: string;
  product_id: string;
  branch_id: string;
  quantity: number;
  type: 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  business_id: string;
  plan_name: 'free_trial' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'expired';
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface Account {
  id: string;
  business_id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  balance: number;
  is_system: boolean;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  business_id: string;
  branch_id: string;
  date: string;
  reference: string;
  description: string;
  user_id: string;
  created_at: string;
}

export interface JournalLine {
  id: string;
  business_id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface RegisterSession {
  id: string;
  business_id: string;
  branch_id: string;
  user_id: string;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  variance: number | null;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string;
  sales_count?: number;
  sales_total?: number;
  refunds_total?: number;
  payouts_total?: number;
  created_at: string;
}

// ----------------------------------------------------
// HR & PAYROLL MODULE TYPES
// ----------------------------------------------------

export interface Employee {
  id: string;
  business_id: string;
  branch_id?: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  national_id: string;
  department: 'Operations' | 'Sales & POS' | 'Accounting & Finance' | 'Inventory & Logistics' | 'Management' | 'Customer Support' | 'HR';
  job_title: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'probation';
  hire_date: string;
  base_salary: number; // monthly USD
  hourly_rate?: number;
  currency: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_branch_code?: string;
  tax_number?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  status: 'active' | 'on_leave' | 'terminated' | 'suspended';
  created_at: string;
  avatar_url?: string;
}

export interface AttendanceRecord {
  id: string;
  business_id: string;
  employee_id: string;
  employee_name?: string;
  date: string; // YYYY-MM-DD
  clock_in: string; // ISO or HH:mm
  clock_out?: string; // ISO or HH:mm
  total_hours: number;
  overtime_hours: number;
  status: 'present' | 'late' | 'half_day' | 'absent' | 'on_leave';
  notes?: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  business_id: string;
  employee_id: string;
  employee_name?: string;
  leave_type: 'annual' | 'sick' | 'maternity' | 'paternity' | 'compassionate' | 'unpaid';
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  approval_date?: string;
  comments?: string;
  created_at: string;
}

export interface PayrollRun {
  id: string;
  business_id: string;
  branch_id?: string;
  period_start: string;
  period_end: string;
  month_year: string; // e.g. "August 2026"
  total_gross_pay: number;
  total_allowances: number;
  total_deductions: number;
  total_tax_paye: number;
  total_pension_nssa: number;
  total_net_pay: number;
  status: 'draft' | 'processed' | 'posted_to_gl';
  gl_journal_id?: string;
  payment_date?: string;
  created_by?: string;
  created_at: string;
  payslips_count: number;
}

export interface Payslip {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string;
  job_title: string;
  bank_name?: string;
  bank_account?: string;
  base_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  overtime_pay: number;
  bonus: number;
  gross_earnings: number;
  tax_paye: number;
  pension_nssa: number;
  medical_aid: number;
  loan_deduction: number;
  total_deductions: number;
  net_pay: number;
  payment_method: 'bank_transfer' | 'cash' | 'ecocash' | 'cheque';
  status: 'generated' | 'paid';
  created_at: string;
}

export interface HRPerformanceReview {
  id: string;
  business_id: string;
  employee_id: string;
  employee_name: string;
  review_date: string;
  reviewer_name: string;
  rating: number; // 1 to 5
  key_achievements: string;
  areas_for_improvement: string;
  goals: string;
  type: 'appraisal' | 'commendation' | 'warning';
  created_at: string;
}

// ----------------------------------------------------
// ADVANCED ACCOUNTING MODULE TYPES
// ----------------------------------------------------

export interface ARInvoice {
  id: string;
  business_id: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  invoice_number: string; // e.g. "INV-2026-001"
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number; // e.g. 15%
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    amount: number;
  }>;
  created_at: string;
}

export interface APBill {
  id: string;
  business_id: string;
  supplier_id?: string;
  supplier_name: string;
  bill_number: string; // Vendor invoice #
  bill_date: string;
  due_date: string;
  expense_account_code: string; // e.g. "6000", "5000", "6200"
  expense_account_name?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: 'draft' | 'approved' | 'partially_paid' | 'paid' | 'overdue';
  notes?: string;
  created_at: string;
}

export interface BankAccount {
  id: string;
  business_id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  gl_account_code: string; // e.g. "1000", "1050"
  currency: string;
  book_balance: number;
  statement_balance: number;
  last_reconciled_date?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  date: string;
  reference: string;
  payee_payer: string;
  description: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'fee' | 'interest';
  amount: number;
  is_reconciled: boolean;
  reconciled_at?: string;
  created_at: string;
}

export interface FixedAsset {
  id: string;
  business_id: string;
  asset_code: string; // e.g. "FA-EQP-001"
  name: string;
  category: 'Equipment' | 'Vehicles' | 'Computer Hardware' | 'Furniture & Fixtures' | 'Buildings' | 'Leasehold';
  purchase_date: string;
  purchase_cost: number;
  salvage_value: number;
  useful_life_years: number;
  depreciation_method: 'straight_line' | 'reducing_balance';
  accumulated_depreciation: number;
  current_book_value: number;
  asset_account_code: string; // "1500"
  deprec_expense_account_code: string; // "6500"
  accum_deprec_account_code: string; // "1510"
  last_depreciation_date?: string;
  status: 'active' | 'disposed' | 'written_off';
  created_at: string;
}

export interface TaxReturnPeriod {
  id: string;
  business_id: string;
  period_name: string; // e.g. "Q2 2026 (Apr - Jun)"
  tax_type: 'VAT' | 'PAYE' | 'Corporate_Income_Tax' | 'Withholding_Tax';
  start_date: string;
  end_date: string;
  taxable_sales: number;
  output_tax_collected: number;
  taxable_purchases: number;
  input_tax_paid: number;
  net_tax_payable: number; // Output - Input
  filing_status: 'pending' | 'filed' | 'settled';
  filed_at?: string;
  payment_reference?: string;
  created_at: string;
}

export interface BudgetRecord {
  id: string;
  business_id: string;
  account_code: string;
  account_name: string;
  category: 'Revenue' | 'COGS' | 'Operating_Expense' | 'Capital_Expenditure';
  period_year: number;
  budget_amount: number;
  actual_amount: number;
  variance_amount: number;
  variance_percent: number;
  created_at: string;
}

