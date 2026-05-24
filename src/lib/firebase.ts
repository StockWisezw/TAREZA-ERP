import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  signInWithPopup, 
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  signInAnonymously as firebaseSignInAnonymously,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  User,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  QueryConstraint,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK with long-polling configured for standard robust transit in sandbox/iframe environments
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth();

// Test connection on boot as mandated by the Firebase Integration Skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("[Firestore SDK] Successfully reached Cloud Firestore backend.");
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = (error as any)?.code || '';
    
    if (errMsg.includes('the client is offline') || errCode === 'unavailable') {
      console.warn(`[Firestore SDK] Note: Connection to Firestore backend timed out or is offline (${errMsg}). The client will operate offline and auto-sync when online.`);
    } else if (errCode === 'permission-denied') {
      console.log("[Firestore SDK] Connected to Firestore (Security rules evaluated correctly).");
    } else {
      console.error("[Firestore SDK] Connection error:", error);
    }
  }
}
testConnection();

// Define clean Enum types and interfaces for error mapping
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
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
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
  purchase_orders: ['id', 'business_id', 'supplier_id', 'status', 'total_amount', 'created_at'],
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
    if (key === 'id') continue; // ID is saved as document reference
    let val = item[key];
    if (val === undefined || val === null) {
      continue;
    }

    // Handle nested lists/objects
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

  // Parse nested lists/objects
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

// Mimic the precise Appwrite SQL query interface mapping to Firebase
class FirebaseQueryBuilder implements PromiseLike<{ data: any[] | null; count: number | null; error: any }> {
  table: string;
  constraints: QueryConstraint[] = [];
  isInsert = false;
  isUpdate = false;
  isDelete = false;
  payload: any = null;
  targetId?: string;

  constructor(table: string) {
    this.table = table;
  }

  select(fields?: string | any, options?: any) {
    return this;
  }

  eq(col: string, val: any) {
    if (col === 'id' || col === '$id') {
      this.targetId = val;
    } else {
      this.constraints.push(where(col, '==', val));
    }
    return this;
  }

  gte(col: string, val: any) {
    this.constraints.push(where(col, '>=', val));
    return this;
  }

  lte(col: string, val: any) {
    this.constraints.push(where(col, '<=', val));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.constraints.push(orderBy(col, opts?.ascending === false ? 'desc' : 'asc'));
    return this;
  }

  limit(n: number) {
    this.constraints.push(limit(n));
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

  async getTargetDocIds(): Promise<string[]> {
    if (this.targetId) {
      return [this.targetId];
    }
    try {
      const q = query(collection(db, this.table), ...this.constraints);
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.id);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, this.table);
      return [];
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

  async executeSelect() {
    try {
      if (this.targetId) {
        const docRef = doc(db, this.table, this.targetId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return [normalizeOutput(docSnap.id, docSnap.data(), this.table)];
        }
        return [];
      } else {
        const q = query(collection(db, this.table), ...this.constraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(docSnap => normalizeOutput(docSnap.id, docSnap.data(), this.table));
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, this.table);
      return [];
    }
  }

  async executeInsert() {
    const results = [];
    for (const rawItem of this.payload) {
      // Prioritize setting predefined ID or create random ID client side
      const docId = rawItem.id || rawItem.$id || doc(collection(db, this.table)).id;
      const item = normalizeInput(rawItem, this.table);
      try {
        const docRef = doc(db, this.table, docId);
        await setDoc(docRef, item, { merge: true });
        results.push(normalizeOutput(docId, item, this.table));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `${this.table}/${docId}`);
      }
    }
    return results;
  }

  async executeUpdate() {
    const ids = await this.getTargetDocIds();
    const results = [];
    const item = normalizeInput(this.payload, this.table);
    for (const id of ids) {
      try {
        const docRef = doc(db, this.table, id);
        await updateDoc(docRef, item);
        // Get updated record
        const docSnap = await getDoc(docRef);
        results.push(normalizeOutput(id, docSnap.data(), this.table));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `${this.table}/${id}`);
      }
    }
    return results;
  }

  async executeDelete() {
    const ids = await this.getTargetDocIds();
    for (const id of ids) {
      try {
        await deleteDoc(doc(db, this.table, id));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `${this.table}/${id}`);
      }
    }
    return [];
  }

  then<TResult1 = { data: any[] | null; count: number | null; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any[] | null; count: number | null; error: any }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute() {
    try {
      if (this.isInsert) {
        const data = await this.executeInsert();
        return { data, count: data.length, error: null };
      } else if (this.isUpdate) {
        const data = await this.executeUpdate();
        return { data, count: data.length, error: null };
      } else if (this.isDelete) {
        await this.executeDelete();
        return { data: null, count: 0, error: null };
      } else {
        const data = await this.executeSelect();
        return { data, count: data.length, error: null };
      }
    } catch (error) {
      console.error(`Firebase query failed on ${this.table}:`, error);
      return { data: null, count: null, error };
    }
  }
}

export const firebaseService = {
  auth: {
    getUser: async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          return { data: { user: { id: currentUser.uid, email: currentUser.email } }, error: null };
        }
        return { data: { user: null }, error: null };
      } catch (error) {
        return { data: { user: null }, error };
      }
    },
    getSession: async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          return { data: { session: currentUser }, error: null };
        }
        return { data: { session: null }, error: null };
      } catch (error) {
        return { data: { session: null }, error };
      }
    },
    signUp: async ({ email, password }: any) => {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        return { data: { user: { id: user.uid, email: user.email } }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        return { data: { user: { id: user.uid, email: user.email }, session: user }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signInWithOAuth: async ({ provider }: any) => {
      try {
        let authProvider;
        if (provider === 'google') {
          authProvider = new GoogleAuthProvider();
        } else if (provider === 'github') {
          authProvider = new GithubAuthProvider();
        } else if (provider === 'microsoft') {
          authProvider = new OAuthProvider('microsoft.com');
        } else if (provider === 'apple') {
          authProvider = new OAuthProvider('apple.com');
        } else {
          throw new Error('Unsupported OAuth Provider: ' + provider);
        }
        await signInWithPopup(auth, authProvider);
        return { error: null };
      } catch (error) {
        return { error };
      }
    },
    signInAnonymously: async () => {
      try {
        const userCredential = await firebaseSignInAnonymously(auth);
        return { data: { session: userCredential.user }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    sendMagicLink: async (email: string) => {
      try {
        const actionCodeSettings = {
          url: window.location.origin + '/login',
          handleCodeInApp: true
        };
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        // Persist email locally to complete login without re-typing
        window.localStorage.setItem('emailForSignIn', email);
        return { data: true, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    sendPasswordReset: async (email: string) => {
      try {
        await sendPasswordResetEmail(auth, email);
        return { data: true, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    completeMagicLinkSession: async (userId: string, secret: string) => {
      try {
        // Complete magic link flow if active link
        if (isSignInWithEmailLink(auth, window.location.href)) {
          let email = window.localStorage.getItem('emailForSignIn');
          if (!email) {
            email = window.prompt('Please provide your email for confirmation');
          }
          if (email) {
            const result = await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            return { data: { session: result.user }, error: null };
          }
        }
        throw new Error("Invalid magic link parameters");
      } catch (error) {
        return { data: null, error };
      }
    },
    signOut: async () => {
      try {
        await firebaseSignOut(auth);
        return { error: null };
      } catch (error) {
        return { error };
      }
    },
    onAuthStateChange: (cb: (user: User | null) => void) => {
      const unsubscribe = onAuthStateChanged(auth, cb);
      return { data: { subscription: { unsubscribe } } };
    }
  },
  from: (table: string) => new FirebaseQueryBuilder(table),
  storage: {
    // Return empty mock methods during migration so that any optional storage calls do not crash
    uploadFile: async (file: File) => {
      return { data: { $id: 'upload-id' }, error: null };
    },
    getFileView: (fileId: string) => {
      return '';
    },
    getFileDownload: (fileId: string) => {
      return '';
    },
    deleteFile: async (fileId: string) => {
      return { error: null };
    },
    listFiles: async () => {
      return { data: [], error: null };
    }
  }
};

export type { FirebaseQueryBuilder };
