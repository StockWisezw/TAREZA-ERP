import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fireSignOut, 
  sendEmailVerification, 
  sendPasswordResetEmail, 
  updatePassword as fireUpdatePassword, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc as fireDoc, 
  collection as fireCollection, 
  query as fireQuery, 
  where as fireWhere, 
  limit as fireLimit, 
  orderBy as fireOrderBy, 
  getDoc as fireGetDoc, 
  getDocs as fireGetDocs, 
  setDoc as fireSetDoc, 
  updateDoc as fireUpdateDoc, 
  deleteDoc as fireDeleteDoc, 
  addDoc as fireAddDoc, 
  writeBatch as fireWriteBatch, 
  onSnapshot as fireOnSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import firebaseConfig from '../../firebase-applet-config.json';

// ============================================================================
// REAL FIREBASE INITIALIZATION
// ============================================================================

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const fireAuth = getAuth(app);
export { firebaseConfig };

export const isRealSupabaseEnabled = false;

// Validate Connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(fireDoc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// ============================================================================
// FIRESTORE ERROR HANDLING (8 PILLARS MANDATE)
// ============================================================================

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
      userId: fireAuth.currentUser?.uid,
      email: fireAuth.currentUser?.email,
      emailVerified: fireAuth.currentUser?.emailVerified,
      isAnonymous: fireAuth.currentUser?.isAnonymous,
      tenantId: fireAuth.currentUser?.tenantId,
      providerInfo: fireAuth.currentUser?.providerData?.map(provider => ({
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

// ============================================================================
// EMULATED AUTH HELPER (COMPOUNDS FIREBASE AND SUPABASE AUTHENTICATION FIELDS)
// ============================================================================

export const auth = {
  get currentUser() {
    const user = fireAuth.currentUser;
    if (!user) return null;
    return {
      id: user.uid,
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || '',
      emailVerified: user.emailVerified,
      isAnonymous: user.isAnonymous,
      providerData: user.providerData,
      metadata: {
        creationTime: user.metadata.creationTime || '',
        lastSignInTime: user.metadata.lastSignInTime || '',
      }
    };
  },
  onAuthStateChanged(callback: (user: any) => void) {
    return onAuthStateChanged(fireAuth, (user) => {
      if (user) {
        callback({
          id: user.uid,
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || '',
          emailVerified: user.emailVerified,
          isAnonymous: user.isAnonymous,
          providerData: user.providerData,
          metadata: {
            creationTime: user.metadata.creationTime || '',
            lastSignInTime: user.metadata.lastSignInTime || '',
          }
        });
      } else {
        callback(null);
      }
    });
  }
};

// ============================================================================
// NATIVE FIRESTORE API RE-EXPORTS WITH ERROR WRAPPERS
// ============================================================================

export function collection(first: any, ...rest: any[]): any {
  if (typeof first === 'string') {
    return fireCollection(db, first);
  }
  const [path, ...more] = rest;
  return fireCollection(first, path, ...(more as [any, ...any[]]));
}

export function doc(first: any, ...rest: any[]): any {
  if (typeof first === 'string') {
    return fireDoc(db, first);
  }
  if (rest.length === 1 && typeof rest[0] === 'string') {
    return fireDoc(first, rest[0]);
  }
  const [path, ...more] = rest;
  return fireDoc(first, path, ...(more as [any, ...any[]]));
}

export function query(collectionRef: any, ...constraints: any[]) {
  return fireQuery(collectionRef, ...(constraints as any));
}

export function where(field: string, op: any, val: any) {
  return fireWhere(field, op, val);
}

export function limit(n: number) {
  return fireLimit(n);
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
  return fireOrderBy(field, dir);
}

export async function getDoc(docRef: any): Promise<any> {
  try {
    const snap = await fireGetDoc(docRef);
    return {
      exists: () => snap.exists(),
      get existsProperty() {
        return snap.exists();
      },
      id: snap.id,
      data: () => snap.data() || null
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docRef.path || null);
  }
}

export async function setDoc(docRef: any, data: any, options?: any) {
  try {
    return await fireSetDoc(docRef, data, options);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docRef.path || null);
  }
}

export async function updateDoc(docRef: any, data: any) {
  try {
    return await fireUpdateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docRef.path || null);
  }
}

export async function deleteDoc(docRef: any) {
  try {
    return await fireDeleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docRef.path || null);
  }
}

export async function addDoc(collectionRef: any, data: any) {
  try {
    const snap = await fireAddDoc(collectionRef, data);
    return {
      id: snap.id,
      path: snap.path
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionRef.path || null);
  }
}

export async function getDocs(queryObj: any) {
  try {
    const snap = await fireGetDocs(queryObj);
    const docs = snap.docs.map(d => ({
      id: d.id,
      data: () => d.data(),
      exists: () => true
    }));
    return {
      docs,
      empty: snap.empty,
      size: snap.size,
      forEach: (callback: (doc: any) => void) => {
        docs.forEach(callback);
      }
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, queryObj.path || null);
  }
}

export function onSnapshot(queryObj: any, onNext: (snapshot: any) => void, onError?: (error: any) => void) {
  return fireOnSnapshot(
    queryObj,
    (snap) => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        data: () => d.data(),
        exists: () => true
      }));
      onNext({
        docs,
        empty: snap.empty,
        size: snap.size,
        forEach: (callback: (doc: any) => void) => {
          docs.forEach(callback);
        }
      });
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.GET, queryObj.path || null);
      }
    }
  );
}

export function writeBatch(_db?: any) {
  const batch = fireWriteBatch(db);
  return {
    set: (docRef: any, data: any, options?: any) => batch.set(docRef, data, options),
    update: (docRef: any, data: any) => batch.update(docRef, data),
    delete: (docRef: any) => batch.delete(docRef),
    commit: () => batch.commit()
  };
}

// ============================================================================
// SECURE AUTHENTICATION WRAPPERS (REAL FIREBASE AUTH)
// ============================================================================

export async function secureSignUp(email: string, pass: string, name?: string) {
  try {
    const userCred = await createUserWithEmailAndPassword(fireAuth, email, pass);
    if (userCred.user) {
      const profileRef = fireDoc(db, 'profiles', userCred.user.uid);
      await fireSetDoc(profileRef, {
        id: userCred.user.uid,
        email,
        first_name: name?.split(' ')[0] || '',
        last_name: name?.split(' ').slice(1).join(' ') || '',
        created_at: new Date().toISOString()
      });
    }
    return {
      user: userCred.user ? {
        uid: userCred.user.uid,
        email: userCred.user.email,
        emailVerified: userCred.user.emailVerified
      } : null
    };
  } catch (error) {
    console.error('Error in secureSignUp:', error);
    throw error;
  }
}

export async function secureSignIn(email: string, pass: string) {
  try {
    const userCred = await signInWithEmailAndPassword(fireAuth, email, pass);
    return {
      user: userCred.user ? {
        uid: userCred.user.uid,
        email: userCred.user.email,
        emailVerified: userCred.user.emailVerified
      } : null
    };
  } catch (error) {
    console.error('Error in secureSignIn:', error);
    throw error;
  }
}

export async function secureSignOut() {
  try {
    await fireSignOut(fireAuth);
  } catch (error) {
    console.error('Error in secureSignOut:', error);
    throw error;
  }
}

export async function secureSendEmailVerification(_user: any) {
  try {
    if (fireAuth.currentUser) {
      await sendEmailVerification(fireAuth.currentUser);
    }
  } catch (error) {
    console.error('Error in secureSendEmailVerification:', error);
  }
}

export async function secureSendPasswordResetEmail(email: string) {
  try {
    await sendPasswordResetEmail(fireAuth, email);
  } catch (error) {
    console.error('Error in secureSendPasswordResetEmail:', error);
    throw error;
  }
}

export async function secureUpdatePassword(newPass: string) {
  try {
    if (fireAuth.currentUser) {
      await fireUpdatePassword(fireAuth.currentUser, newPass);
    } else {
      throw new Error('No authenticated user found');
    }
  } catch (error) {
    console.error('Error in secureUpdatePassword:', error);
    throw error;
  }
}

export function setActiveBusinessId(id: string) {
  localStorage.setItem('tareza_active_business_id', id);
}

export function getActiveBusinessId(): string | null {
  return localStorage.getItem('tareza_active_business_id');
}

// ============================================================================
// SUPABASE CLIENT PROXY EMULATOR (STORES & READS DIRECTLY IN FIRESTORE!)
// ============================================================================

export class SupabaseQueryBuilder {
  private table: string;
  private filters: Array<{ column: string; operator: string; value: any }> = [];
  private orderCol: string | null = null;
  private orderAscending: boolean = true;
  private limitNum: number | undefined;
  private selectCols: string = '*';
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private actionPayload: any = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = '*'): this {
    this.selectCols = columns;
    this.action = 'select';
    return this;
  }

  eq(column: string, value: any): this {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: any): this {
    this.filters.push({ column, operator: 'neq', value });
    return this;
  }

  gt(column: string, value: any): this {
    this.filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column: string, value: any): this {
    this.filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column: string, value: any): this {
    this.filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column: string, value: any): this {
    this.filters.push({ column, operator: 'lte', value });
    return this;
  }

  in(column: string, values: any[]): this {
    this.filters.push({ column, operator: 'in', value: values });
    return this;
  }

  contains(column: string, value: any): this {
    this.filters.push({ column, operator: 'contains', value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderCol = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number): this {
    this.limitNum = count;
    return this;
  }

  insert(payload: any): this {
    this.action = 'insert';
    this.actionPayload = payload;
    return this;
  }

  update(payload: any): this {
    this.action = 'update';
    this.actionPayload = payload;
    return this;
  }

  delete(): this {
    this.action = 'delete';
    return this;
  }

  upsert(payload: any): this {
    this.action = 'upsert';
    this.actionPayload = payload;
    return this;
  }

  async execute(): Promise<{ data: any; error: any; count: number | null }> {
    try {
      if (this.action === 'select') {
        const colRef = fireCollection(db, this.table);
        const qConstraints: any[] = [];
        
        for (const f of this.filters) {
          if (f.operator === 'eq') qConstraints.push(fireWhere(f.column, '==', f.value));
          else if (f.operator === 'neq') qConstraints.push(fireWhere(f.column, '!=', f.value));
          else if (f.operator === 'gt') qConstraints.push(fireWhere(f.column, '>', f.value));
          else if (f.operator === 'gte') qConstraints.push(fireWhere(f.column, '>=', f.value));
          else if (f.operator === 'lt') qConstraints.push(fireWhere(f.column, '<', f.value));
          else if (f.operator === 'lte') qConstraints.push(fireWhere(f.column, '<=', f.value));
          else if (f.operator === 'in') {
            const arr = Array.isArray(f.value) ? f.value : [f.value];
            if (arr.length > 0) {
              qConstraints.push(fireWhere(f.column, 'in', arr.slice(0, 10)));
            }
          }
          else if (f.operator === 'contains') qConstraints.push(fireWhere(f.column, 'array-contains', f.value));
        }

        if (this.orderCol) {
          qConstraints.push(fireOrderBy(this.orderCol, this.orderAscending ? 'asc' : 'desc'));
        }

        if (this.limitNum !== undefined) {
          qConstraints.push(fireLimit(this.limitNum));
        }

        const q = fireQuery(colRef, ...qConstraints);
        const snap = await fireGetDocs(q);
        let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Relational product joins emulation (for inventory and batch systems)
        if (this.selectCols.includes('products') && (this.table === 'inventory' || this.table === 'inventory_batches')) {
          const productIds = Array.from(new Set(items.map((it: any) => it.product_id).filter(Boolean)));
          const productMap: Record<string, any> = {};
          
          if (productIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < productIds.length; i += 10) {
              chunks.push(productIds.slice(i, i + 10));
            }
            for (const chunk of chunks) {
              const prodQ = fireQuery(fireCollection(db, 'products'), fireWhere('id', 'in', chunk));
              const prodSnap = await fireGetDocs(prodQ);
              prodSnap.docs.forEach(doc => {
                productMap[doc.id] = { id: doc.id, ...doc.data() };
              });
            }
          }

          items = items.map((it: any) => ({
            ...it,
            products: productMap[it.product_id] || null
          }));
        }

        return { data: items, error: null, count: items.length };
      }

      if (this.action === 'insert') {
        const payloadArray = Array.isArray(this.actionPayload) ? this.actionPayload : [this.actionPayload];
        const writtenItems: any[] = [];

        for (const item of payloadArray) {
          const docId = item.id || (this.table === 'business_users' ? item.user_id : null) || uuidv4();
          const itemWithId = { ...item, id: docId };
          const docRef = fireDoc(db, this.table, docId);
          await fireSetDoc(docRef, itemWithId);
          writtenItems.push(itemWithId);
        }

        return { 
          data: Array.isArray(this.actionPayload) ? writtenItems : writtenItems[0], 
          error: null, 
          count: writtenItems.length 
        };
      }

      if (this.action === 'update') {
        const selectResult = await this.select(this.selectCols).execute();
        if (selectResult.error) throw selectResult.error;

        const itemsToUpdate = selectResult.data || [];
        const updatedItems: any[] = [];

        for (const it of itemsToUpdate) {
          const docRef = fireDoc(db, this.table, it.id);
          const updateData = { ...this.actionPayload, updated_at: new Date().toISOString() };
          await fireUpdateDoc(docRef, updateData);
          updatedItems.push({ ...it, ...updateData });
        }

        return { 
          data: updatedItems, 
          error: null, 
          count: updatedItems.length 
        };
      }

      if (this.action === 'delete') {
        const selectResult = await this.select(this.selectCols).execute();
        if (selectResult.error) throw selectResult.error;

        const itemsToDelete = selectResult.data || [];
        for (const it of itemsToDelete) {
          const docRef = fireDoc(db, this.table, it.id);
          await fireDeleteDoc(docRef);
        }

        return { 
          data: itemsToDelete, 
          error: null, 
          count: itemsToDelete.length 
        };
      }

      if (this.action === 'upsert') {
        const payloadArray = Array.isArray(this.actionPayload) ? this.actionPayload : [this.actionPayload];
        const writtenItems: any[] = [];

        for (const item of payloadArray) {
          const docId = item.id || (this.table === 'business_users' ? item.user_id : null) || uuidv4();
          const itemWithId = { ...item, id: docId };
          const docRef = fireDoc(db, this.table, docId);
          await fireSetDoc(docRef, itemWithId, { merge: true });
          writtenItems.push(itemWithId);
        }

        return { 
          data: Array.isArray(this.actionPayload) ? writtenItems : writtenItems[0], 
          error: null, 
          count: writtenItems.length 
        };
      }

      throw new Error(`Unsupported query action: ${this.action}`);
    } catch (err: any) {
      console.error(`[Supabase Compatibility Engine] Error in table "${this.table}" ${this.action}:`, err);
      return { data: null, error: err, count: null };
    }
  }

  async maybeSingle() {
    const result = await this.execute();
    return { data: Array.isArray(result.data) ? (result.data[0] || null) : (result.data || null), error: result.error };
  }

  async single() {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    const item = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!item) return { data: null, error: new Error('No records found') };
    return { data: item, error: null };
  }

  then(
    onfulfilled?: ((value: any) => any) | null,
    onrejected?: ((reason: any) => any) | null
  ): Promise<any> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

const authProxy = {
  async getSession() {
    const currentUser = fireAuth.currentUser;
    if (!currentUser) {
      return { data: { session: null }, error: null };
    }
    const session = {
      user: {
        id: currentUser.uid,
        uid: currentUser.uid,
        email: currentUser.email || '',
        user_metadata: { name: currentUser.displayName || '' },
        email_confirmed_at: currentUser.emailVerified ? new Date().toISOString() : null
      }
    };
    return { data: { session }, error: null };
  },

  async getUser() {
    const currentUser = fireAuth.currentUser;
    if (!currentUser) {
      return { data: { user: null }, error: null };
    }
    const user = {
      id: currentUser.uid,
      uid: currentUser.uid,
      email: currentUser.email || '',
      user_metadata: { name: currentUser.displayName || '' },
      email_confirmed_at: currentUser.emailVerified ? new Date().toISOString() : null
    };
    return { data: { user }, error: null };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    const unsubscribe = onAuthStateChanged(fireAuth, async (user) => {
      if (user) {
        const session = {
          user: {
            id: user.uid,
            uid: user.uid,
            email: user.email || '',
            user_metadata: { name: user.displayName || '' },
            email_confirmed_at: user.emailVerified ? new Date().toISOString() : null
          }
        };
        callback('SIGNED_IN', session);
      } else {
        callback('SIGNED_OUT', null);
      }
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => unsubscribe()
        }
      }
    };
  },

  async signUp(options: { email: string; password?: string; options?: { data?: any } }) {
    const name = options.options?.data?.name || '';
    const res = await secureSignUp(options.email, options.password || '', name);
    return {
      data: {
        user: res.user ? {
          id: res.user.uid,
          email: res.user.email,
          email_confirmed_at: res.user.emailVerified ? new Date().toISOString() : null
        } : null,
        session: null
      },
      error: null
    };
  },

  async signInWithPassword(options: { email: string; password?: string }) {
    const res = await secureSignIn(options.email, options.password || '');
    const session = res.user ? {
      user: {
        id: res.user.uid,
        email: res.user.email,
        email_confirmed_at: res.user.emailVerified ? new Date().toISOString() : null
      }
    } : null;
    return {
      data: {
        user: session?.user || null,
        session
      },
      error: null
    };
  },

  async signOut() {
    await secureSignOut();
    return { error: null };
  },

  async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
    await secureSendPasswordResetEmail(email);
    return { data: {}, error: null };
  },

  async sendPasswordReset(email: string) {
    await secureSendPasswordResetEmail(email);
    return { data: {}, error: null };
  },

  async signInWithOAuth(options: { provider: string }) {
    console.warn(`OAuth sign in requested with provider: ${options.provider}. Emulating success.`);
    return { data: {}, error: null };
  },

  async updateUser(options: { password?: string }) {
    if (options.password) {
      await secureUpdatePassword(options.password);
    }
    return { data: { user: {} }, error: null };
  }
};

export const supabase = {
  auth: authProxy,
  from(table: string) {
    return new SupabaseQueryBuilder(table);
  },
  channel(_name: string) {
    return {
      on(_event: string, _config: any, callback: (...args: any[]) => void) {
        return this;
      },
      subscribe() {
        return this;
      }
    };
  },
  removeChannel(_channel: any) {
    // No-op
  }
};

export const rawSupabase = supabase;
