/**
 * Tareza ERP - Firestore Database Schema Types
 * This file replaces the previous SQL/Supabase schema with the type definitions
 * for Firestore Collections.
 */

export interface FirestoreProfile {
  id: string; // Document ID: Matches Auth User UID
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  created_at: string;
  updated_at?: string;
}

export interface FirestoreBusiness {
  id: string; // Document ID
  name: string;
  tax_number?: string;
  email?: string;
  phone?: string;
  currency?: string;
  subscription_plan?: string;
  subscription_status?: string;
  max_users?: number;
  max_branches?: number;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  created_at: string;
  updated_at?: string;
}

export interface FirestoreBranch {
  id: string; // Document ID
  business_id: string; // References /businesses/{id}
  name: string;
  address?: string;
  phone?: string;
  type: "retail" | "warehouse" | "office";
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface FirestoreBusinessUser {
  id: string; // Document ID
  business_id: string; // References /businesses/{id}
  user_id: string; // References /profiles/{id}
  branch_id: string; // References /branches/{id}
  role_id: string; // 'admin' | 'manager' | 'cashier'
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface FirestoreCategory {
  id: string; // Document ID
  business_id: string; // References /businesses/{id}
  name: string;
  parent_id?: string | null; // References self for nested hierarchies
  created_at: string;
  updated_at?: string;
}

export interface FirestoreProduct {
  id: string; // Document ID
  business_id: string; // References /businesses/{id}
  category_id?: string | null; // References /categories/{id}
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  retail_price: number;
  wholesale_price: number;
  cost_price: number;
  tax_class: "standard" | "zero" | "exempt";
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface FirestoreInventory {
  id: string; // Document ID (usually business_id + "_" + branch_id + "_" + product_id or UUID)
  business_id: string; // References /businesses/{id}
  branch_id: string; // References /branches/{id}
  product_id: string; // References /products/{id}
  quantity: number;
  reorder_level: number;
  created_at: string;
  updated_at: string;
}

export interface FirestoreInventoryBatch {
  id: string; // Document ID
  business_id: string; // References /businesses/{id}
  branch_id: string; // References /branches/{id}
  product_id: string; // References /products/{id}
  batch_number: string;
  expiry_date: string; // ISO String (for healthcare/regulatory compliance)
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface FirestoreSaleItem {
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

export interface FirestoreSale {
  id: string; // Document ID
  business_id: string; // References /businesses/{id}
  branch_id: string; // References /branches/{id}
  user_id: string; // References /profiles/{id}
  customer_id?: string | null; // References /customers/{id}
  receiptNumber: string;
  subtotal: number;
  vat_total: number;
  discount_total: number;
  total: number;
  payment_method: string;
  status: "completed" | "refunded" | "voided";
  created_at: string;
  updated_at?: string;
  items?: FirestoreSaleItem[]; // Embedded items subcollection or array
}

export interface FirestoreCashDrawerLog {
  id: string; // Document ID
  business_id: string;
  branch_id: string;
  amount: number;
  type: "cash_in" | "cash_out" | "till_addition" | "till_payout";
  transaction_type?: string;
  notes?: string;
  created_at: string;
}

export interface FirestoreSupplier {
  id: string; // Document ID
  business_id: string;
  name: string;
  contact_person?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  payment_terms?: string;
  balance: number;
  status: "active" | "inactive";
  tax_number?: string;
  created_at: string;
  updated_at?: string;
}

export interface FirestorePurchaseOrder {
  id: string; // Document ID
  business_id: string;
  supplier_id: string; // References /suppliers/{id}
  status: "draft" | "ordered" | "received" | "cancelled";
  total_amount: number;
  po_number: string;
  order_date: string;
  expected_delivery_date?: string;
  items: string; // JSON serialized string of ordered items
  created_at: string;
  updated_at?: string;
}

export interface FirestoreSupportTicket {
  id: string; // Document ID
  user_id: string; // References /profiles/{id}
  user_email: string;
  business_id: string; // References /businesses/{id}
  business_name: string;
  subject: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  description: string;
  response?: string;
  created_at: string;
  updated_at: string;
}

export interface FirestoreCurrency {
  id: string; // Document ID
  business_id: string; // References /businesses/{id}
  code: string; // e.g. "USD", "EUR", "ZWG"
  name: string;
  symbol: string;
  exchange_rate: number;
  is_base: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface FirestoreExchangeRateHistory {
  id: string; // Document ID
  currency_id: string; // References /currencies/{id}
  rate: number;
  effective_date: string; // ISO date
}

/**
 * Root Firestore Schema Definition representing all root collections
 */
export interface FirestoreSchema {
  profiles: {
    [userId: string]: FirestoreProfile;
  };
  businesses: {
    [businessId: string]: FirestoreBusiness;
  };
  branches: {
    [branchId: string]: FirestoreBranch;
  };
  business_users: {
    [bUserId: string]: FirestoreBusinessUser;
  };
  categories: {
    [categoryId: string]: FirestoreCategory;
  };
  products: {
    [productId: string]: FirestoreProduct;
  };
  inventory: {
    [inventoryId: string]: FirestoreInventory;
  };
  inventory_batches: {
    [batchId: string]: FirestoreInventoryBatch;
  };
  sales: {
    [saleId: string]: FirestoreSale;
  };
  cash_drawer_logs: {
    [logId: string]: FirestoreCashDrawerLog;
  };
  suppliers: {
    [supplierId: string]: FirestoreSupplier;
  };
  purchase_orders: {
    [poId: string]: FirestorePurchaseOrder;
  };
  support_tickets: {
    [ticketId: string]: FirestoreSupportTicket;
  };
  currencies: {
    [currencyId: string]: FirestoreCurrency;
  };
  exchange_rate_history: {
    [historyId: string]: FirestoreExchangeRateHistory;
  };
}
