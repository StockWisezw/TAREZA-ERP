import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Environment variables for Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// Initialize live low-level Supabase Client
export const rawSupabase = createClient(supabaseUrl, supabaseAnonKey);

export const db = {}; // Mock DB descriptor for compatibility

// Dynamic user caching for seamless synchronous access to auth.currentUser
let supabaseClientUser: any = null;

// Populate current user immediately
rawSupabase.auth.getSession().then(({ data }) => {
  supabaseClientUser = data.session?.user || null;
});

// Watch authentication changes to update currentUser cache
rawSupabase.auth.onAuthStateChange((_event, session) => {
  supabaseClientUser = session?.user || null;
});

export const auth = {
  get currentUser() {
    if (!supabaseClientUser) return null;
    return {
      uid: supabaseClientUser.id,
      email: supabaseClientUser.email,
      displayName: supabaseClientUser.user_metadata?.full_name || supabaseClientUser.email?.split('@')[0] || '',
      emailVerified: true,
      isAnonymous: false,
      providerData: [],
      metadata: {
        creationTime: supabaseClientUser.created_at,
        lastSignInTime: supabaseClientUser.last_sign_in_at || ''
      }
    };
  },
  onAuthStateChanged(callback: (user: any) => void) {
    const { data: { subscription } } = rawSupabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) {
        callback({
          uid: user.id,
          email: user.email,
          displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
          emailVerified: true,
          isAnonymous: false,
          providerData: [],
          metadata: {
            creationTime: user.created_at,
            lastSignInTime: user.last_sign_in_at || ''
          }
        });
      } else {
        callback(null);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }
};

console.log("[Supabase Client] Initialized successfully.");

// Standard OperationType enums for compatibility
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Map database column types for integrity
const ALLOWED_KEYS: Record<string, string[]> = {
  businesses: ['id', 'name', 'tax_number', 'email', 'phone', 'currency', 'subscription_plan', 'subscription_status', 'subscription_end_date', 'max_users', 'max_branches', 'created_at', 'updated_at'],
  branches: ['id', 'business_id', 'name', 'address', 'phone', 'type', 'is_active', 'created_at', 'updated_at'],
  profiles: ['id', 'first_name', 'last_name', 'phone', 'email', 'created_at', 'updated_at'],
  roles: ['id', 'business_id', 'name', 'description', 'created_at', 'updated_at'],
  role_permissions: ['id', 'role_id', 'permissions', 'created_at'],
  business_users: ['id', 'business_id', 'user_id', 'branch_id', 'role_id', 'is_active', 'created_at', 'updated_at'],
  categories: ['id', 'business_id', 'name', 'parent_id', 'created_at'],
  products: ['id', 'business_id', 'category_id', 'name', 'description', 'sku', 'barcode', 'retail_price', 'wholesale_price', 'cost_price', 'price', 'tax_class', 'tax_rate_id', 'is_active', 'created_at'],
  inventory: ['id', 'business_id', 'branch_id', 'product_id', 'quantity', 'reorder_level', 'created_at', 'updated_at'],
  customers: ['id', 'business_id', 'name', 'email', 'phone', 'address', 'vat_number', 'customer_type', 'balance', 'credit_limit', 'created_at'],
  suppliers: ['id', 'business_id', 'name', 'contact_person', 'email', 'phone', 'address', 'created_at'],
  sales: ['id', 'business_id', 'branch_id', 'user_id', 'customer_id', 'customerId', 'customerName', 'receiptNumber', 'items', 'payments', 'subtotal', 'vat_total', 'vatTotal', 'discount_total', 'discountTotal', 'total', 'total_amount', 'total_tax_amount', 'payment_method', 'status', 'timestamp', 'created_at'],
  sale_items: ['id', 'sale_id', 'product_id', 'quantity', 'price', 'unit_price', 'line_total', 'vat_amount'],
  expense_categories: ['id', 'business_id', 'name', 'description', 'created_at'],
  cash_drawer_logs: ['id', 'business_id', 'branch_id', 'amount', 'type', 'transaction_type', 'notes', 'created_at'],
  tax_rates: ['id', 'business_id', 'name', 'rate', 'is_active'],
  purchase_orders: ['id', 'business_id', 'supplier_id', 'status', 'total_amount', 'po_number', 'order_date', 'expected_delivery_date', 'items', 'created_at'],
  stocktakes_advanced: ['id', 'business_id', 'branch_id', 'status', 'created_at'],
  inventory_transfers: ['id', 'business_id', 'from_branch_id', 'to_branch_id', 'status', 'created_at'],
  stock_movements: ['id', 'product_id', 'branch_id', 'quantity', 'type', 'created_at'],
  subscriptions: ['id', 'business_id', 'plan_name', 'status', 'start_date', 'end_date', 'created_at'],
  accounts: ['id', 'business_id', 'code', 'name', 'type', 'balance', 'is_system', 'created_at'],
  journal_entries: ['id', 'business_id', 'branch_id', 'date', 'reference', 'description', 'created_at', 'user_id'],
  journal_lines: ['id', 'journal_entry_id', 'account_id', 'debit', 'credit', 'description'],
  register_sessions: ['id', 'business_id', 'branch_id', 'user_id', 'opening_balance', 'closing_balance', 'expected_balance', 'variance', 'status', 'opened_at', 'closed_at', 'sales_count', 'sales_total', 'refunds_total', 'payouts_total', 'created_at'],
  audit_logs: ['id', 'business_id', 'user_id', 'user_email', 'action', 'module', 'old_value', 'new_value', 'created_at']
};

function normalizeInput(item: any, table: string): any {
  const allowed = ALLOWED_KEYS[table];
  if (!allowed) return item;

  const copy: any = {};
  for (const key of allowed) {
    if (key === 'id') continue;
    let val = item[key];
    if (val === undefined || val === null) {
      continue;
    }

    if ((key === 'items' || key === 'payments' || key === 'permissions') && typeof val !== 'string') {
      try {
        val = JSON.stringify(val);
      } catch (e) {
        val = '';
      }
    }
    copy[key] = val;
  }
  return copy;
}

function normalizeOutput(id: string, data: any, table: string): any {
  if (!data) return null;
  const copy = { ...data, id, $id: id };

  if (table === 'sales') {
    if (typeof copy.items === 'string') {
      try { copy.items = JSON.parse(copy.items); } catch (e) {}
    }
    if (typeof copy.payments === 'string') {
      try { copy.payments = JSON.parse(copy.payments); } catch (e) {}
    }
  } else if (table === 'role_permissions') {
    if (typeof copy.permissions === 'string') {
      try { copy.permissions = JSON.parse(copy.permissions); } catch (e) {}
    }
  }
  return copy;
}

// Low-level Firestore emulation on top of Supabase tables
export function doc(...args: any[]): any {
  let table = '';
  let id = '';
  
  if (args.length === 1) {
    table = args[0].table;
    id = uuidv4();
  } else if (args.length === 2) {
    if (args[0] && typeof args[0] === 'object' && 'table' in args[0]) {
      table = args[0].table;
      id = args[1];
    } else {
      table = args[1];
      id = uuidv4();
    }
  } else if (args.length >= 3) {
    table = args[1];
    id = args[2];
  }

  return { table, id };
}

export function collection(...args: any[]): any {
  let table = '';
  if (args.length === 1) {
    table = args[0];
  } else if (args.length >= 2) {
    table = args[1];
  }
  return { table };
}

export async function getDoc(docRef: any) {
  const { id, table } = docRef;
  const { data, error } = await rawSupabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error(`getDoc error on ${table}:`, error);
    throw error;
  }
  return {
    exists: () => !!data,
    data: () => data,
    id
  };
}

export async function updateDoc(docRef: any, data: any) {
  const { id, table } = docRef;
  const { error } = await rawSupabase.from(table).update(normalizeInput(data, table)).eq('id', id);
  if (error) {
    console.error(`updateDoc error on ${table}:`, error);
    throw error;
  }
}

export function writeBatch(_db: any) {
  const operations: { docRef: any; data: any; type: 'set' | 'update' | 'delete' }[] = [];
  return {
    set: (docRef: any, data: any) => {
      operations.push({ docRef, data, type: 'set' });
    },
    update: (docRef: any, data: any) => {
      operations.push({ docRef, data, type: 'update' });
    },
    delete: (docRef: any) => {
      operations.push({ docRef, data: null, type: 'delete' });
    },
    commit: async () => {
      for (const op of operations) {
        const { id, table } = op.docRef;
        if (op.type === 'set') {
          const { error } = await rawSupabase.from(table).upsert({ id, ...normalizeInput(op.data, table) });
          if (error) throw error;
        } else if (op.type === 'update') {
          const { error } = await rawSupabase.from(table).update(normalizeInput(op.data, table)).eq('id', id);
          if (error) throw error;
        } else if (op.type === 'delete') {
          const { error } = await rawSupabase.from(table).delete().eq('id', id);
          if (error) throw error;
        }
      }
    }
  };
}

export function query(collectionRef: any, ...constraints: any[]) {
  return { table: collectionRef.table, constraints };
}

export function where(col: string, op: string, val: any) {
  return { col, op, val };
}

export async function getDocs(queryObj: any) {
  const { table, constraints } = queryObj;
  let req: any = rawSupabase.from(table).select('*');
  for (const c of constraints) {
    if (c.op === '==') {
      req = req.eq(c.col, c.val);
    } else if (c.op === '>=') {
      req = req.gte(c.col, c.val);
    } else if (c.op === '<=') {
      req = req.lte(c.col, c.val);
    }
  }
  const { data, error } = await req;
  if (error) {
    console.error(`getDocs error on ${table}:`, error);
    throw error;
  }
  const docs = (data || []).map(item => ({
    id: item.id,
    data: () => item
  }));
  return {
    docs,
    forEach: (callback: (doc: any) => void) => {
      docs.forEach(callback);
    }
  };
}

// Low-level query emulator
class SupabaseQueryBuilder {
  table: string;
  isInsert = false;
  isUpdate = false;
  isDelete = false;
  payload: any = null;
  targetId?: string;
  orderCol?: string;
  orderAscending = true;
  limitNum?: number;
  eqFilters: { col: string; val: any }[] = [];
  gteFilters: { col: string; val: any }[] = [];
  lteFilters: { col: string; val: any }[] = [];

  constructor(table: string) {
    this.table = table;
  }

  select(_fields?: string | any, _options?: any) {
    return this;
  }

  eq(col: string, val: any) {
    if (col === 'id' || col === '$id') {
      this.targetId = val;
    } else {
      this.eqFilters.push({ col, val });
    }
    return this;
  }

  gte(col: string, val: any) {
    this.gteFilters.push({ col, val });
    return this;
  }

  lte(col: string, val: any) {
    this.lteFilters.push({ col, val });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAscending = opts?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this.limitNum = n;
    return this;
  }

  insert(data: any | any[]) {
    this.isInsert = true;
    this.payload = Array.isArray(data) ? data : [data];
    return this;
  }

  upsert(data: any | any[]) {
    this.isInsert = true;
    this.payload = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data: any) {
    this.isUpdate = true;
    this.payload = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  async execute() {
    try {
      if (this.isInsert) {
        const itemsToInsert = this.payload.map((item: any) => {
          const docId = item.id || item.$id || uuidv4();
          const cleanItem = normalizeInput(item, this.table);
          return { id: docId, ...cleanItem };
        });

        const { data, error } = await rawSupabase
          .from(this.table)
          .upsert(itemsToInsert)
          .select();

        if (error) throw error;
        return { data: (data || []).map(d => normalizeOutput(d.id, d, this.table)), count: data?.length || 0, error: null };
      } 
      
      if (this.isUpdate) {
        let req: any = rawSupabase.from(this.table).update(normalizeInput(this.payload, this.table));
        if (this.targetId) {
          req = req.eq('id', this.targetId);
        }
        for (const filter of this.eqFilters) {
          req = req.eq(filter.col, filter.val);
        }
        const { data, error } = await req.select();
        if (error) throw error;
        return { data: (data || []).map(d => normalizeOutput(d.id, d, this.table)), count: data?.length || 0, error: null };
      }

      if (this.isDelete) {
        let req: any = rawSupabase.from(this.table).delete();
        if (this.targetId) {
          req = req.eq('id', this.targetId);
        }
        for (const filter of this.eqFilters) {
          req = req.eq(filter.col, filter.val);
        }
        const { error } = await req;
        if (error) throw error;
        return { data: null, count: 0, error: null };
      }

      // SELECT
      let req: any = rawSupabase.from(this.table).select('*');
      if (this.targetId) {
        req = req.eq('id', this.targetId);
      }
      for (const filter of this.eqFilters) {
        req = req.eq(filter.col, filter.val);
      }
      for (const filter of this.gteFilters) {
        req = req.gte(filter.col, filter.val);
      }
      for (const filter of this.lteFilters) {
        req = req.lte(filter.col, filter.val);
      }
      if (this.orderCol) {
        req = req.order(this.orderCol, { ascending: this.orderAscending });
      }
      if (this.limitNum !== undefined) {
        req = req.limit(this.limitNum);
      }

      const { data, error } = await req;
      if (error) throw error;
      return { 
        data: (data || []).map(d => normalizeOutput(d.id, d, this.table)), 
        count: data?.length || 0, 
        error: null 
      };
    } catch (error) {
      console.error(`Supabase query failed on ${this.table}:`, error);
      return { data: null, count: null, error };
    }
  }

  async maybeSingle() {
    const result = await this.execute();
    return { data: result.data?.[0] || null, error: result.error };
  }

  async single() {
    const result = await this.execute();
    if (result.error) {
      return { data: null, error: result.error };
    }
    if (!result.data || !result.data[0]) {
      return { data: null, error: new Error('Document not found') };
    }
    return { data: result.data[0], error: null };
  }

  then(
    onfulfilled?: ((value: { data: any[] | null; count: number | null; error: any }) => any) | null,
    onrejected?: ((reason: any) => any) | null
  ): Promise<any> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// backwards compatibility keys for UI definitions
export const DATABASE_ID = 'default';
export const BUCKET_ID = 'tareza-uploads';

export const account = {
  get: (): Promise<any> => {
    return new Promise((resolve, reject) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        if (user) {
          resolve({
            $id: user.uid,
            email: user.email,
            name: user.displayName || '',
            created_at: user.metadata.creationTime,
            updated_at: user.metadata.lastSignInTime
          });
        } else {
          reject(new Error('No authenticated session found'));
        }
      });
    });
  },
  deleteSession: async (sessionId: string) => {
    try {
      const { error } = await rawSupabase.auth.signOut();
      if (error) {
        throw error;
      }
      supabaseClientUser = null;
    } catch (err) {
      console.error('[Supabase Client] Exception in deleteSession:', err);
      throw err;
    }
  }
};

export const client = {
  setEndpoint: () => client,
  setProject: () => client
};

export const databases = {};

// Unified compatibility client mock/wrapper
export const supabase = {
  auth: {
    getUser: async () => {
      try {
        const { data: { user }, error } = await rawSupabase.auth.getUser();
        if (error) return { data: { user: null }, error };
        return { data: { user: user ? { id: user.id, email: user.email } : null }, error: null };
      } catch (error) {
        return { data: { user: null }, error };
      }
    },
    getSession: async () => {
      try {
        const { data: { session }, error } = await rawSupabase.auth.getSession();
        if (error) return { data: { session: null }, error };
        return { data: { session }, error: null };
      } catch (error) {
        return { data: { session: null }, error };
      }
    },
    signUp: async ({ email, password }: any) => {
      try {
        const { data: { user }, error } = await rawSupabase.auth.signUp({ email, password });
        if (error) throw error;
        return { data: { user: user ? { id: user.id, email: user.email } : null }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const { data: { user, session }, error } = await rawSupabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { data: { user: user ? { id: user.id, email: user.email } : null, session }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signInWithOAuth: async ({ provider }: any) => {
      try {
        const { error } = await rawSupabase.auth.signInWithOAuth({ provider });
        return { error };
      } catch (error) {
        return { error };
      }
    },
    signInAnonymously: async () => {
      try {
        const anonId = 'anon-' + uuidv4();
        const anonSession = { user: { id: anonId, email: 'anonymous@tareza.co.zw', isAnonymous: true } };
        supabaseClientUser = anonSession.user;
        return { data: { session: anonSession }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    sendMagicLink: async (email: string) => {
      try {
        const { error } = await rawSupabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin + '/login',
          }
        });
        if (error) throw error;
        return { data: true, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    sendPasswordReset: async (email: string) => {
      try {
        const { error } = await rawSupabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/login',
        });
        if (error) throw error;
        return { data: true, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    completeMagicLinkSession: async (_userId: string, _secret: string) => {
      try {
        const { data: { session }, error } = await rawSupabase.auth.getSession();
        if (error) throw error;
        return { data: { session }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signOut: async () => {
      try {
        const { error } = await rawSupabase.auth.signOut();
        supabaseClientUser = null;
        return { error };
      } catch (error) {
        return { error };
      }
    },
    onAuthStateChange: (cb: (user: any) => void) => {
      const { data: { subscription } } = rawSupabase.auth.onAuthStateChange((_event, session) => {
        cb(session?.user ? { user: { id: session.user.id, email: session.user.email } } : null);
      });
      return { data: { subscription: { unsubscribe: () => subscription.unsubscribe() } } };
    }
  },
  from: (table: string) => new SupabaseQueryBuilder(table),
  storage: {
    uploadFile: async (file: File) => {
      try {
        const fileId = uuidv4();
        const { error } = await rawSupabase.storage.from('tareza-uploads').upload(fileId, file);
        if (error) throw error;
        return { data: { $id: fileId }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    getFileView: (fileId: string) => {
      const { data } = rawSupabase.storage.from('tareza-uploads').getPublicUrl(fileId);
      return data.publicUrl || '';
    },
    getFileDownload: (fileId: string) => {
      const { data } = rawSupabase.storage.from('tareza-uploads').getPublicUrl(fileId);
      return data.publicUrl || '';
    },
    deleteFile: async (fileId: string) => {
      const { error } = await rawSupabase.storage.from('tareza-uploads').remove([fileId]);
      return { error };
    },
    listFiles: async () => {
      const { data, error } = await rawSupabase.storage.from('tareza-uploads').list();
      return { data: data || [], error };
    }
  },
  channel: (name: string) => {
    return {
      on: (event: string, filter: any, callback: any) => ({
        subscribe: () => {}
      }),
      subscribe: () => {}
    };
  },
  removeChannel: (channel: any) => {}
};

export type SupabaseQueryBuilderType = SupabaseQueryBuilder;

export namespace Models {
  export interface User<T = any> {
    $id: string;
    email: string;
    name?: string;
    created_at?: string;
    updated_at?: string;
  }
  export type Preferences = any;
}

