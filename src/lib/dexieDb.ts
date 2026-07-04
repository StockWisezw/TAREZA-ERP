import Dexie, { type Table } from 'dexie';

export interface BaseOfflineRecord {
  id: string;
  uuid?: string;
  deviceId?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  deleted?: boolean;
  syncedAt?: string;
}

export interface OfflineQueueRecord {
  id: string; // uuid
  type: string; // e.g. 'sale', 'product_update', 'expense'
  recordId: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  priority?: 'high' | 'normal' | 'low';
  lastError?: string;
}

export interface SyncLogRecord extends BaseOfflineRecord {
  timestamp: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  syncedCount: number;
  failedCount: number;
  details?: string;
}

class TarezaOfflineDatabase extends Dexie {
  businesses!: Table<any, string>;
  branches!: Table<any, string>;
  profiles!: Table<any, string>;
  roles!: Table<any, string>;
  role_permissions!: Table<any, string>;
  business_users!: Table<any, string>;
  categories!: Table<any, string>;
  products!: Table<any, string>;
  inventory!: Table<any, string>;
  inventory_batches!: Table<any, string>;
  customers!: Table<any, string>;
  suppliers!: Table<any, string>;
  sales!: Table<any, string>;
  sale_items!: Table<any, string>;
  expense_categories!: Table<any, string>;
  cash_drawer_logs!: Table<any, string>;
  tax_rates!: Table<any, string>;
  purchase_orders!: Table<any, string>;
  stocktakes_advanced!: Table<any, string>;
  inventory_transfers!: Table<any, string>;
  stock_movements!: Table<any, string>;
  subscriptions!: Table<any, string>;
  accounts!: Table<any, string>;
  journal_entries!: Table<any, string>;
  journal_lines!: Table<any, string>;
  register_sessions!: Table<any, string>;
  audit_logs!: Table<any, string>;
  support_tickets!: Table<any, string>;
  trial_bookkeepings!: Table<any, string>;
  currencies!: Table<any, string>;
  exchange_rate_history!: Table<any, string>;
  offlineQueue!: Table<OfflineQueueRecord, string>;
  syncLogs!: Table<SyncLogRecord, string>;
  settings!: Table<any, string>;

  constructor() {
    super('TarezaEnterpriseOfflineDB');
    this.version(1).stores({
      businesses: 'id, name, syncStatus',
      branches: 'id, business_id, name, syncStatus',
      profiles: 'id, email, syncStatus',
      roles: 'id, business_id, name, syncStatus',
      role_permissions: 'id, role_id, syncStatus',
      business_users: 'id, business_id, user_id, branch_id, syncStatus',
      categories: 'id, business_id, name, syncStatus',
      products: 'id, business_id, category_id, name, sku, barcode, syncStatus',
      inventory: 'id, business_id, branch_id, product_id, syncStatus',
      inventory_batches: 'id, business_id, branch_id, product_id, syncStatus',
      customers: 'id, business_id, name, email, phone, syncStatus',
      suppliers: 'id, business_id, name, syncStatus',
      sales: 'id, business_id, branch_id, receiptNumber, status, syncStatus',
      sale_items: 'id, business_id, sale_id, product_id, syncStatus',
      expense_categories: 'id, business_id, name, syncStatus',
      cash_drawer_logs: 'id, business_id, branch_id, type, transaction_type, syncStatus',
      tax_rates: 'id, business_id, name, syncStatus',
      purchase_orders: 'id, business_id, supplier_id, status, syncStatus',
      stocktakes_advanced: 'id, business_id, branch_id, status, syncStatus',
      inventory_transfers: 'id, business_id, status, syncStatus',
      stock_movements: 'id, business_id, product_id, type, syncStatus',
      subscriptions: 'id, business_id, plan_name, status, syncStatus',
      accounts: 'id, business_id, code, name, syncStatus',
      journal_entries: 'id, business_id, branch_id, reference, syncStatus',
      journal_lines: 'id, business_id, journal_entry_id, account_id, syncStatus',
      register_sessions: 'id, business_id, user_id, status, syncStatus',
      audit_logs: 'id, business_id, user_id, action, syncStatus',
      support_tickets: 'id, user_id, business_id, status, syncStatus',
      trial_bookkeepings: 'id, business_id, account_id, syncStatus',
      currencies: 'id, business_id, code, syncStatus',
      exchange_rate_history: 'id, currency_id, syncStatus',
      offlineQueue: 'id, type, recordId, timestamp, status, priority',
      syncLogs: 'id, timestamp, status, syncStatus',
      settings: 'id, key, syncStatus'
    });
  }
}

export const db = new TarezaOfflineDatabase();
export default db;
