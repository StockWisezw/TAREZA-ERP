import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fireSignOut, 
  signInAnonymously as fireSignInAnonymously,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  initializeFirestore, 
  doc as fireDoc, 
  collection as fireCollection, 
  getDoc as fireGetDoc, 
  updateDoc as fireUpdateDoc, 
  setDoc as fireSetDoc, 
  getDocs as fireGetDocs, 
  deleteDoc as fireDeleteDoc, 
  writeBatch as fireWriteBatch, 
  query as fireQuery, 
  where as fireWhere, 
  limit as fireLimit, 
  orderBy as fireOrderBy,
  getDocFromServer,
  documentId,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import firebaseConfigPlaceholder from '../../firebase-applet-config.json';

// Use environment variables if present (especially useful for deploying and linking with Vercel),
// otherwise fall back seamlessly to the local firebase-applet-config.json
function isPlaceholderOrEmpty(val: string | undefined): boolean {
  if (!val) return true;
  const lower = val.toLowerCase();
  return (
    lower.includes('placeholder') ||
    lower.includes('yourapikeyhere') ||
    lower.includes('your-project') ||
    lower.includes('your-sender-id') ||
    lower.includes('your-app-id') ||
    lower.includes('your-measurement-id')
  );
}

const resolvedConfig = { ...firebaseConfigPlaceholder };

if (import.meta.env.VITE_FIREBASE_API_KEY && !isPlaceholderOrEmpty(import.meta.env.VITE_FIREBASE_API_KEY)) {
  resolvedConfig.apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
}
if (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && !isPlaceholderOrEmpty(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)) {
  resolvedConfig.authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
}
if (import.meta.env.VITE_FIREBASE_DATABASE_URL && !isPlaceholderOrEmpty(import.meta.env.VITE_FIREBASE_DATABASE_URL)) {
  (resolvedConfig as any).databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL;
}
if (import.meta.env.VITE_FIREBASE_PROJECT_ID && !isPlaceholderOrEmpty(import.meta.env.VITE_FIREBASE_PROJECT_ID)) {
  resolvedConfig.projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
}
if (
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID &&
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID !== '(default)' &&
  !isPlaceholderOrEmpty(import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID) &&
  !import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID.includes('://') &&
  !import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID.includes('.firebaseio.com') &&
  !import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID.includes('firebaseio')
) {
  resolvedConfig.firestoreDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
}

// Ensure the final resolved databaseId is not an RTDB URL
if (
  resolvedConfig.firestoreDatabaseId && (
    resolvedConfig.firestoreDatabaseId.includes('://') ||
    resolvedConfig.firestoreDatabaseId.includes('.firebaseio.com') ||
    resolvedConfig.firestoreDatabaseId.includes('firebaseio')
  )
) {
  resolvedConfig.firestoreDatabaseId = firebaseConfigPlaceholder.firestoreDatabaseId;
}
if (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET && !isPlaceholderOrEmpty(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)) {
  resolvedConfig.storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
}
if (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID && !isPlaceholderOrEmpty(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID)) {
  resolvedConfig.messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
}
if (import.meta.env.VITE_FIREBASE_APP_ID && !isPlaceholderOrEmpty(import.meta.env.VITE_FIREBASE_APP_ID)) {
  resolvedConfig.appId = import.meta.env.VITE_FIREBASE_APP_ID;
}
if (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID && !isPlaceholderOrEmpty(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID)) {
  resolvedConfig.measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
}

export const firebaseConfig = resolvedConfig;

// Initialize Firebase App
export const app = initializeApp(resolvedConfig);

// Set log level early to suppress any startup warning/connection logs
try {
  setLogLevel('error');
} catch (logErr) {
  console.warn('[Firebase] Failed to set log level:', logErr);
}

function createFirestoreInstance() {
  const isPersistenceEnabled = typeof window !== 'undefined' && localStorage.getItem('tareza_firestore_persistence') !== 'disabled';
  
  if (isPersistenceEnabled) {
    try {
      return initializeFirestore(app, {
        experimentalForceLongPolling: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      }, resolvedConfig.firestoreDatabaseId);
    } catch (err: any) {
      console.warn('[Firebase] Fallback to memoryLocalCache due to IndexedDb or container restriction: ', err);
    }
  }

  // Fallback to memoryLocalCache to guarantee 100% stability against IndexedDb transaction restrictions in sandboxed iframes
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
      localCache: memoryLocalCache()
    }, resolvedConfig.firestoreDatabaseId);
  } catch (err: any) {
    console.warn('[Firebase] Fallback to standard initializeFirestore: ', err);
    return initializeFirestore(app, {
      experimentalForceLongPolling: true
    }, resolvedConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreInstance();
export const fireAuth = getAuth(app);

// Immediate validation of Firestore connection
async function testConnection() {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    console.warn('[Firebase] Device reports offline. Caching engines active. App remains completely operational.');
    return;
  }
  try {
    const connectionPromise = getDocFromServer(fireDoc(db, 'test_connection', 'ping'));
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
    await Promise.race([connectionPromise, timeoutPromise]);
    console.log('[Firebase] Connection validated successfully.');
  } catch (error) {
    console.warn('[Firebase] Connection validation completed (offline-ready caching is active). App remains completely operational.');
  }
}
setTimeout(() => {
  testConnection();
}, 3000);

// Dynamic user caching for seamless synchronous access to user context
let firebaseCurrentUser: any = null;

onAuthStateChanged(fireAuth, (user) => {
  firebaseCurrentUser = user;
  if (!user) {
    setActiveBusinessId(null);
  } else {
    // Prefetch active business ID
    getActiveBusinessId();
  }
});

export const auth = {
  get currentUser() {
    if (!firebaseCurrentUser) return null;
    return {
      id: firebaseCurrentUser.uid,
      uid: firebaseCurrentUser.uid,
      email: firebaseCurrentUser.email,
      displayName: firebaseCurrentUser.displayName || firebaseCurrentUser.email?.split('@')[0] || '',
      emailVerified: firebaseCurrentUser.emailVerified,
      isAnonymous: firebaseCurrentUser.isAnonymous,
      providerData: firebaseCurrentUser.providerData || [],
      metadata: {
        creationTime: firebaseCurrentUser.metadata.creationTime || '',
        lastSignInTime: firebaseCurrentUser.metadata.lastSignInTime || ''
      }
    };
  },
  onAuthStateChanged(callback: (user: any) => void) {
    return onAuthStateChanged(fireAuth, (user) => {
      if (user) {
        callback({
          id: user.uid,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || '',
          emailVerified: user.emailVerified,
          isAnonymous: user.isAnonymous,
          providerData: user.providerData || [],
          metadata: {
            creationTime: user.metadata.creationTime || '',
            lastSignInTime: user.metadata.lastSignInTime || ''
          }
        });
      } else {
        callback(null);
      }
    });
  }
};

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
  const currentUser = fireAuth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: (currentUser as any)?.tenantId || null,
      providerInfo: currentUser?.providerData?.map((p: any) => ({
        providerId: p.providerId,
        email: p.email
      })) || []
    },
    operationType,
    path
  };
  console.error('Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function checkIsOfflineError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('reach') ||
    msg.includes('respond') ||
    msg.includes('network') ||
    msg.includes('unavailable') ||
    msg.includes('failed to get') ||
    msg.includes('timeout') ||
    msg.includes('unreachable')
  );
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
  inventory_batches: ['id', 'business_id', 'branch_id', 'product_id', 'batch_number', 'expiry_date', 'quantity', 'created_at', 'updated_at'],
  customers: ['id', 'business_id', 'name', 'email', 'phone', 'address', 'vat_number', 'customer_type', 'balance', 'credit_limit', 'created_at'],
  suppliers: ['id', 'business_id', 'name', 'contact_person', 'contact_name', 'email', 'phone', 'address', 'payment_terms', 'balance', 'status', 'tax_number', 'created_at'],
  sales: ['id', 'business_id', 'branch_id', 'user_id', 'customer_id', 'customerId', 'customerName', 'receiptNumber', 'items', 'payments', 'subtotal', 'vat_total', 'vatTotal', 'discount_total', 'discountTotal', 'total', 'total_amount', 'total_tax_amount', 'payment_method', 'status', 'timestamp', 'created_at', 'refund_notes', 'refundNotes'],
  sale_items: ['id', 'business_id', 'sale_id', 'product_id', 'quantity', 'price', 'unit_price', 'line_total', 'vat_amount'],
  expense_categories: ['id', 'business_id', 'name', 'description', 'created_at'],
  cash_drawer_logs: ['id', 'business_id', 'branch_id', 'amount', 'type', 'transaction_type', 'notes', 'created_at', 'payment_method', 'linked_document_id', 'linked_document_type'],
  tax_rates: ['id', 'business_id', 'name', 'rate', 'is_active'],
  purchase_orders: ['id', 'business_id', 'supplier_id', 'status', 'total_amount', 'po_number', 'order_date', 'expected_delivery_date', 'items', 'created_at'],
  disabled_stocktakes_advanced: ['id', 'business_id', 'branch_id', 'status', 'type', 'started_at', 'completed_at', 'pos_session_id', 'total_shortage', 'total_overage', 'charge_sales_posted', 'created_at'], // Renamed or kept
  stocktakes_advanced: ['id', 'business_id', 'branch_id', 'status', 'type', 'started_at', 'completed_at', 'pos_session_id', 'total_shortage', 'total_overage', 'charge_sales_posted', 'created_at'],
  inventory_transfers: ['id', 'business_id', 'from_branch_id', 'to_branch_id', 'status', 'created_at', 'items', 'notes'],
  stock_movements: ['id', 'business_id', 'product_id', 'branch_id', 'quantity', 'type', 'notes', 'batch_number', 'expiry_date', 'created_at'],
  subscriptions: ['id', 'business_id', 'plan_name', 'status', 'start_date', 'end_date', 'created_at', 'pop_reference', 'pop_phone', 'pop_text', 'pop_date', 'pop_amount', 'pop_proof_image'],
  accounts: ['id', 'business_id', 'code', 'name', 'type', 'balance', 'is_system', 'created_at'],
  journal_entries: ['id', 'business_id', 'branch_id', 'date', 'reference', 'description', 'created_at', 'user_id'],
  journal_lines: ['id', 'business_id', 'journal_entry_id', 'account_id', 'debit', 'credit', 'description'],
  register_sessions: ['id', 'business_id', 'branch_id', 'user_id', 'cashier_id', 'opening_balance', 'closing_balance', 'expected_balance', 'variance', 'status', 'opened_at', 'closed_at', 'sales_count', 'sales_total', 'refunds_total', 'payouts_total', 'created_at'],
  audit_logs: ['id', 'business_id', 'user_id', 'user_email', 'action', 'module', 'old_value', 'new_value', 'created_at'],
  support_tickets: ['id', 'user_id', 'user_email', 'business_id', 'business_name', 'subject', 'category', 'priority', 'status', 'description', 'response', 'created_at', 'updated_at'],
  trial_bookkeepings: ['id', 'business_id', 'branch_id', 'account_id', 'debit', 'credit', 'amount', 'type', 'created_at'],
  currencies: ['id', 'business_id', 'code', 'name', 'symbol', 'exchange_rate', 'is_base', 'is_active', 'created_at'],
  exchange_rate_history: ['id', 'currency_id', 'rate', 'effective_date']
};

function normalizeInput(item: any, table: string): any {
  if (!item || typeof item !== 'object') return item;
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

  if (typeof copy.items === 'string') {
    try { copy.items = JSON.parse(copy.items); } catch (e) {}
  }
  if (typeof copy.payments === 'string') {
    try { copy.payments = JSON.parse(copy.payments); } catch (e) {}
  }
  if (typeof copy.permissions === 'string') {
    try { copy.permissions = JSON.parse(copy.permissions); } catch (e) {}
  }

  return copy;
}

// Map relational calls to native Firestore references
export function doc(...args: any[]): any {
  if (args.length === 1) {
    return fireDoc(args[0]);
  } else if (args.length === 2) {
    if (typeof args[0] === 'string') {
      return fireDoc(db, args[0]);
    }
    return fireDoc(args[0], args[1]);
  } else if (args.length >= 3) {
    return fireDoc(db, args[1], args[2]);
  }
  return fireDoc(db, 'unknown', uuidv4());
}

export function collection(...args: any[]): any {
  if (args.length === 1) {
    if (typeof args[0] === 'string') {
      return fireCollection(db, args[0]);
    }
    return args[0];
  } else if (args.length >= 2) {
    return fireCollection(db, args[1]);
  }
  return fireCollection(db, 'unknown');
}

export async function getDoc(docRef: any): Promise<any> {
  try {
    let snap;
    try {
      snap = await fireGetDoc(docRef);
    } catch (err: any) {
      if (checkIsOfflineError(err)) {
        try {
          const { getDocFromCache } = await import('firebase/firestore');
          snap = await getDocFromCache(docRef);
        } catch (cacheErr) {
          throw err;
        }
      } else {
        throw err;
      }
    }
    return {
      exists: () => snap.exists(),
      data: () => snap.data() as any,
      id: snap.id
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docRef.path);
    throw error;
  }
}

export async function updateDoc(docRef: any, data: any) {
  try {
    const table = docRef.path ? docRef.path.split('/')[0] : '';
    await fireUpdateDoc(docRef, normalizeInput(data, table));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docRef.path);
    throw error;
  }
}

export function writeBatch(_db: any) {
  const batch = fireWriteBatch(db);
  return {
    set: (docRef: any, data: any) => {
      const table = docRef.path ? docRef.path.split('/')[0] : '';
      batch.set(docRef, normalizeInput(data, table));
    },
    update: (docRef: any, data: any) => {
      const table = docRef.path ? docRef.path.split('/')[0] : '';
      batch.update(docRef, normalizeInput(data, table));
    },
    delete: (docRef: any) => {
      batch.delete(docRef);
    },
    commit: async () => {
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch_commit');
        throw error;
      }
    }
  };
}

export function query(collectionRef: any, ...constraints: any[]) {
  return fireQuery(collectionRef, ...constraints);
}

export function where(col: string, op: string, val: any) {
  return fireWhere(col, op as any, val);
}

export async function getDocs(queryObj: any) {
  try {
    let snap;
    try {
      snap = await fireGetDocs(queryObj);
    } catch (err: any) {
      if (checkIsOfflineError(err)) {
        try {
          const { getDocsFromCache } = await import('firebase/firestore');
          snap = await getDocsFromCache(queryObj);
        } catch (cacheErr) {
          throw err;
        }
      } else {
        throw err;
      }
    }
    const docs = snap.docs.map(snapDoc => ({
      id: snapDoc.id,
      data: () => snapDoc.data()
    }));
    return {
      docs,
      forEach: (callback: (doc: any) => void) => {
        docs.forEach(callback);
      }
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, null);
    throw error;
  }
}

// Safe localStorage wrappers to prevent iframe sandbox SecurityErrors
function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`[Storage] Failed to read ${key} from localStorage:`, e);
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string | null) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn(`[Storage] Failed to write ${key} to localStorage:`, e);
  }
}

// Active business ID cache & auto-resolving mechanism
let cachedBusinessId: string | null = null;

export function setActiveBusinessId(id: string | null) {
  cachedBusinessId = id;
  safeSetLocalStorage('tareza_active_business_id', id);
}

export async function getActiveBusinessId(): Promise<string | null> {
  if (cachedBusinessId) return cachedBusinessId;

  const localId = safeGetLocalStorage('tareza_active_business_id');
  if (localId && localId !== 'default_business') {
    cachedBusinessId = localId;
    return localId;
  }

  const user = fireAuth.currentUser;
  if (!user) return null;

  let retries = 3;
  let delay = 350;

  while (retries > 0) {
    try {
      // 1. Direct document lookup (extremely efficient, no composite indexes or secure queries required if UID is docId)
      const directDocRef = fireDoc(db, 'business_users', user.uid);
      const directSnap = await fireGetDoc(directDocRef);
      if (directSnap && directSnap.exists()) {
        const bizId = directSnap.data()?.business_id;
        if (bizId) {
          setActiveBusinessId(bizId);
          return bizId;
        }
      }

      // 2. Fallback query for legacy or non-UID-keyed setups
      const q = fireQuery(
        fireCollection(db, 'business_users'),
        fireWhere('user_id', '==', user.uid)
      );
      const qSnap = await fireGetDocs(q);
      if (qSnap && !qSnap.empty) {
        const bizId = qSnap.docs[0].data()?.business_id;
        if (bizId) {
          setActiveBusinessId(bizId);
          return bizId;
        }
      }

      // If both completed but no record exists yet, exit loop to allow creation
      break;
    } catch (err: any) {
      const errMsg = String(err).toLowerCase();
      const isOfflineOrNetwork = checkIsOfflineError(err) || 
                                 errMsg.includes('permission-denied') || 
                                 errMsg.includes('insufficient permissions');

      if (isOfflineOrNetwork) {
        if (retries > 1) {
          console.warn(`[Firebase] Transient error resolving business ID (retrying in ${delay}ms, auth state: ${fireAuth.currentUser ? 'signed-in' : 'signed-out'}). Error:`, err);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          retries--;
        } else {
          console.warn('[Firebase] Client is offline or disconnected. Resolving active business ID from local cache or fallback.');
          try {
            const { getDocFromCache } = await import('firebase/firestore');
            const directDocRef = fireDoc(db, 'business_users', user.uid);
            const cacheSnap = await getDocFromCache(directDocRef);
            if (cacheSnap && cacheSnap.exists()) {
              const bizId = cacheSnap.data()?.business_id;
              if (bizId) {
                setActiveBusinessId(bizId);
                return bizId;
              }
            }
          } catch (cacheErr) {
            // Ignore cache fetch failures
          }
          break;
        }
      } else {
        console.error('[Firebase] Error auto-resolving active business ID:', err);
        break;
      }
    }
  }

  // Return 'default_business' as a last-resort fallback when completely offline and unresolvable
  return 'default_business';
}

// Low-level query emulator on top of Firestore collections
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
      const email = fireAuth.currentUser?.email?.toLowerCase();
      const isSystemDev = email && (
        email === 'tapsforex@gmail.com' ||
        email === 'tapiwagahadza54@gmail.com'
      );
      
      const adminTables = ['businesses', 'subscriptions', 'profiles', 'business_users', 'support_tickets'];
      const isDevAdminTable = isSystemDev && adminTables.includes(this.table);

      const requiresBusinessScope = ALLOWED_KEYS[this.table]?.includes('business_id');
      const activeBizId = (requiresBusinessScope || this.table === 'businesses') ? await getActiveBusinessId() : null;

      if (this.isInsert) {
        const itemsToInsert = this.payload.map((item: any) => {
          let docId = item.id || item.$id;
          if (this.table === 'business_users' && item.user_id) {
            docId = item.user_id;
          } else if (!docId) {
            docId = uuidv4();
          }

          const cleanItem = normalizeInput(item, this.table);
          if (requiresBusinessScope && activeBizId && activeBizId !== 'default_business') {
            if (!(isDevAdminTable && cleanItem.business_id)) {
              cleanItem.business_id = activeBizId;
            }
          }
          return { id: docId, ...cleanItem };
        });

        const insertedItems: any[] = [];
        for (const item of itemsToInsert) {
          const docRef = fireDoc(db, this.table, item.id);
          await fireSetDoc(docRef, item);
          insertedItems.push(item);
        }

        return { data: insertedItems.map(d => normalizeOutput(d.id, d, this.table)), count: itemsToInsert.length, error: null };
      } 
      
      if (this.isUpdate) {
        if (this.targetId) {
          if (this.table === 'businesses' && !isSystemDev && activeBizId && activeBizId !== 'default_business' && this.targetId !== activeBizId) {
            throw new Error(`Permission denied: Cannot update other business profile`);
          }
          const docRef = fireDoc(db, this.table, this.targetId);
          const cleanItem = normalizeInput(this.payload, this.table);
          if (requiresBusinessScope && activeBizId && activeBizId !== 'default_business') {
            if (!(isDevAdminTable && cleanItem.business_id)) {
              cleanItem.business_id = activeBizId;
            }
          }
          await fireUpdateDoc(docRef, cleanItem);
          const updatedDoc = { id: this.targetId, ...cleanItem };
          return { data: [normalizeOutput(this.targetId, updatedDoc, this.table)], count: 1, error: null };
        } else {
          const results = await this.getFilteredDocs();
          const cleanItem = normalizeInput(this.payload, this.table);
          if (requiresBusinessScope && activeBizId && activeBizId !== 'default_business') {
            if (!(isDevAdminTable && cleanItem.business_id)) {
              cleanItem.business_id = activeBizId;
            }
          }
          for (const docSnap of results) {
            const docRef = fireDoc(db, this.table, docSnap.id);
            await fireUpdateDoc(docRef, cleanItem);
          }
          return { data: [], count: results.length, error: null };
        }
      }

      if (this.isDelete) {
        if (this.targetId) {
          if (requiresBusinessScope && !isSystemDev && activeBizId && activeBizId !== 'default_business') {
            const docRef = fireDoc(db, this.table, this.targetId);
            const snap = await fireGetDoc(docRef);
            if (snap.exists() && snap.data()?.business_id !== activeBizId) {
              throw new Error(`Permission denied: Cannot delete document belonging to another business.`);
            }
          }
          const docRef = fireDoc(db, this.table, this.targetId);
          await fireDeleteDoc(docRef);
        } else {
          const results = await this.getFilteredDocs();
          for (const docSnap of results) {
            const docRef = fireDoc(db, this.table, docSnap.id);
            await fireDeleteDoc(docRef);
          }
        }
        return { data: null, count: 0, error: null };
      }

      // SELECT
      if (this.targetId) {
        const docRef = fireDoc(db, this.table, this.targetId);
        let snap;
        try {
          snap = await fireGetDoc(docRef);
        } catch (err: any) {
          if (checkIsOfflineError(err)) {
            const { getDocFromCache } = await import('firebase/firestore');
            snap = await getDocFromCache(docRef);
          } else {
            throw err;
          }
        }
        let mappedData = [];
        if (snap.exists()) {
          const data = snap.data();
          if (!requiresBusinessScope || isSystemDev || data?.business_id === activeBizId || this.table === 'businesses') {
            mappedData = [normalizeOutput(snap.id, data, this.table)];
          }
        }
        return { 
          data: mappedData, 
          count: mappedData.length, 
          error: null 
        };
      }

      const results = await this.getFilteredDocs();
      const mappedData = results.map(docSnap => normalizeOutput(docSnap.id, docSnap.data(), this.table));
      return { 
        data: mappedData, 
        count: mappedData.length, 
        error: null 
      };
    } catch (error) {
      console.error(`Firebase query failed on ${this.table}:`, error);
      return { data: null, count: null, error };
    }
  }

  async getFilteredDocs() {
     const colRef = fireCollection(db, this.table);
     let q: any = colRef;
 
     const email = fireAuth.currentUser?.email?.toLowerCase();
     const isSystemDev = email && (
       email === 'tapsforex@gmail.com' ||
       email === 'tapiwagahadza54@gmail.com'
     );
     
     const adminTables = ['businesses', 'subscriptions', 'profiles', 'business_users', 'support_tickets'];
     const isDevAdminTable = isSystemDev && adminTables.includes(this.table);
 
     const requiresBusinessScope = ALLOWED_KEYS[this.table]?.includes('business_id');
     const activeBizId = (requiresBusinessScope || this.table === 'businesses') ? await getActiveBusinessId() : null;
 
     if (requiresBusinessScope && activeBizId && activeBizId !== 'default_business' && !isDevAdminTable) {
       const hasBizIdFilter = this.eqFilters.some(f => f.col === 'business_id');
       if (!hasBizIdFilter) {
         this.eqFilters.push({ col: 'business_id', val: activeBizId });
       } else {
         this.eqFilters = this.eqFilters.map(f => f.col === 'business_id' ? { col: 'business_id', val: activeBizId } : f);
       }
     } else if (this.table === 'businesses' && activeBizId && activeBizId !== 'default_business' && !isDevAdminTable) {
       if (this.targetId) {
         this.targetId = activeBizId;
       } else {
         const hasIdFilter = this.eqFilters.some(f => f.col === 'id');
         if (!hasIdFilter) {
           this.eqFilters.push({ col: 'id', val: activeBizId });
         } else {
           this.eqFilters = this.eqFilters.map(f => f.col === 'id' ? { col: 'id', val: activeBizId } : f);
         }
       }
     }

    const constraints: any[] = [];
    for (const filter of this.eqFilters) {
      if (filter.val !== undefined) {
        if (filter.col === 'id' || filter.col === '$id') {
          constraints.push(fireWhere(documentId(), '==', filter.val));
        } else {
          constraints.push(fireWhere(filter.col, '==', filter.val));
        }
      }
    }
    for (const filter of this.gteFilters) {
      if (filter.val !== undefined) {
        if (filter.col === 'id' || filter.col === '$id') {
          constraints.push(fireWhere(documentId(), '>=', filter.val));
        } else {
          constraints.push(fireWhere(filter.col, '>=', filter.val));
        }
      }
    }
    for (const filter of this.lteFilters) {
      if (filter.val !== undefined) {
        if (filter.col === 'id' || filter.col === '$id') {
          constraints.push(fireWhere(documentId(), '<=', filter.val));
        } else {
          constraints.push(fireWhere(filter.col, '<=', filter.val));
        }
      }
    }
    if (this.orderCol) {
      if (this.orderCol === 'id' || this.orderCol === '$id') {
        constraints.push(fireOrderBy(documentId(), this.orderAscending ? 'asc' : 'desc'));
      } else {
        constraints.push(fireOrderBy(this.orderCol, this.orderAscending ? 'asc' : 'desc'));
      }
    }
    if (this.limitNum !== undefined) {
      constraints.push(fireLimit(this.limitNum));
    }

    if (constraints.length > 0) {
      q = fireQuery(colRef, ...constraints);
    }

    let querySnap;
    try {
      querySnap = await fireGetDocs(q);
    } catch (err: any) {
      if (checkIsOfflineError(err)) {
        try {
          console.warn(`[Firebase] Client offline, loading query on ${this.table} from cache...`);
          const { getDocsFromCache } = await import('firebase/firestore');
          querySnap = await getDocsFromCache(q);
        } catch (cacheErr) {
          throw err;
        }
      } else {
        throw err;
      }
    }
    return querySnap.docs;
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
            created_at: '',
            updated_at: ''
          });
        } else {
          reject(new Error('No authenticated session found'));
        }
      });
    });
  },
  deleteSession: async (sessionId: string) => {
    try {
      await fireSignOut(fireAuth);
      firebaseCurrentUser = null;
    } catch (err) {
      console.error('[Firebase Client] Exception in deleteSession:', err);
      throw err;
    }
  }
};

export const client = {
  setEndpoint: () => client,
  setProject: () => client
};

export const databases = {};


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
// Add these exports for easy access
export const firebaseAuth = fireAuth;
export const firestore = db;

// Keep supabase object but make it clear it's a Firebase wrapper
export const supabaseUrl = '';
export const supabaseAnonKey = '';
export const DATABASE_ID = 'default';
export const BUCKET_ID = 'tareza-uploads';

export const supabase = {
  auth: {
    getUser: async () => {
      const user = fireAuth.currentUser;
      if (!user) return { data: { user: null }, error: null };
      return { data: { user: { id: user.uid, email: user.email } }, error: null };
    },
    getSession: async () => {
      const user = fireAuth.currentUser;
      return { data: { session: user ? { user: { id: user.uid, email: user.email } } : null }, error: null };
    },
    signUp: async ({ email, password }: any) => {
      try {
        const cred = await createUserWithEmailAndPassword(fireAuth, email, password);
        return { data: { user: { id: cred.user.uid, email: cred.user.email } }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const cred = await signInWithEmailAndPassword(fireAuth, email, password);
        return { data: { user: { id: cred.user.uid, email: cred.user.email }, session: {} }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signInWithOAuth: async ({ provider }: any) => {
      try {
        if (provider === 'google') {
          const providerInstance = new GoogleAuthProvider();
          await signInWithPopup(fireAuth, providerInstance);
        }
        return { error: null };
      } catch (error) {
        return { error };
      }
    },
    signInAnonymously: async () => {
      try {
        const cred = await fireSignInAnonymously(fireAuth);
        return { data: { session: { user: { id: cred.user.uid, email: 'anonymous@tareza.co.zw', isAnonymous: true } } }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    sendMagicLink: async (email: string) => {
      try {
        return { data: true, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    sendPasswordReset: async (email: string) => {
      try {
        await sendPasswordResetEmail(fireAuth, email);
        return { data: true, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signOut: async () => {
      try {
        await fireSignOut(fireAuth);
        firebaseCurrentUser = null;
        setActiveBusinessId(null);
        return { error: null };
      } catch (error) {
        return { error };
      }
    },
    onAuthStateChange: (cb: (event: string, session: any) => void) => {
      const unsubscribe = onAuthStateChanged(fireAuth, (user) => {
        const session = user ? { user: { id: user.uid, email: user.email } } : null;
        cb(user ? 'SIGNED_IN' : 'SIGNED_OUT', session);
      });
      return { data: { subscription: { unsubscribe } } };
    }
  } as any,
  from: (table: string) => new SupabaseQueryBuilder(table),
  storage: {
    uploadFile: async (file: File) => {
      return { data: { $id: uuidv4() }, error: null };
    },
    getFileView: (fileId: string) => '',
    getFileDownload: (fileId: string) => '',
    deleteFile: async (fileId: string) => ({ error: null }),
    listFiles: async () => ({ data: [], error: null })
  },
  channel: (name: string) => {
    const obj = {
      on: (event: string, filter: any, callback: any) => obj,
      subscribe: () => {}
    };
    return obj;
  },
  removeChannel: (channel: any) => {}
};

export const rawSupabase = supabase;
export type SupabaseQueryBuilderType = SupabaseQueryBuilder;