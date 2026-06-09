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
