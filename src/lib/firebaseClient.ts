import { supabase as realSupabase, SupabaseQueryBuilder, auth as realAuth } from './supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// CONSOLIDATED SUPABASE INSTANCE & COMPATIBILITY LAYER
// ============================================================================

export const rawSupabase = realSupabase;

const supabaseAuthProxy = new Proxy(realSupabase.auth, {
  get(target, prop, receiver) {
    if (prop === 'sendPasswordReset') {
      return async (email: string) => {
        const { data, error } = await realSupabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`
        });
        return { data, error };
      };
    }
    const val = Reflect.get(target, prop, receiver);
    if (typeof val === 'function') {
      return val.bind(target);
    }
    return val;
  }
});

export const supabase = new Proxy(realSupabase, {
  get(target, prop, receiver) {
    if (prop === 'auth') {
      return supabaseAuthProxy;
    }
    const val = Reflect.get(target, prop, receiver);
    if (typeof val === 'function') {
      return val.bind(target);
    }
    return val;
  }
}) as any;

export const auth = realAuth;
export const fireAuth = realAuth;

export const db = {
  type: 'supabase-backed-firestore-emulator'
};

// ============================================================================
// EMULATED FIRESTORE API DEFINITIONS
// ============================================================================

export class FirestoreCollectionRef {
  tableName: string;
  constructor(tableName: string) {
    this.tableName = tableName;
  }
}

export class FirestoreDocRef {
  tableName: string;
  id: string;
  constructor(tableName: string, id: string) {
    this.tableName = tableName;
    this.id = id;
  }
  get path() {
    return `${this.tableName}/${this.id}`;
  }
}

export class FirestoreQuery {
  colRef: FirestoreCollectionRef;
  constraints: any[];
  constructor(colRef: FirestoreCollectionRef, constraints: any[]) {
    this.colRef = colRef;
    this.constraints = constraints;
  }
}

export function collection(...args: any[]): any {
  if (args.length === 1) {
    if (typeof args[0] === 'string') {
      return new FirestoreCollectionRef(args[0]);
    }
    return args[0];
  }
  if (args.length >= 2) {
    const name = typeof args[1] === 'string' ? args[1] : args[0]?.tableName || 'unknown';
    return new FirestoreCollectionRef(name);
  }
  return new FirestoreCollectionRef('unknown');
}

export function doc(...args: any[]): any {
  if (args.length === 1) {
    const colRef = args[0] as FirestoreCollectionRef;
    return new FirestoreDocRef(colRef.tableName, uuidv4());
  }
  if (args.length === 2) {
    if (args[0] instanceof FirestoreCollectionRef) {
      return new FirestoreDocRef(args[0].tableName, args[1]);
    } else {
      const parts = args[1].split('/');
      return new FirestoreDocRef(parts[0], parts[1] || uuidv4());
    }
  }
  if (args.length === 3) {
    return new FirestoreDocRef(args[1], args[2] || uuidv4());
  }
  return new FirestoreDocRef('unknown', uuidv4());
}

export function query(collectionRef: any, ...constraints: any[]) {
  return new FirestoreQuery(collectionRef, constraints);
}

export function where(col: string, op: string, val: any) {
  return { type: 'where', col, op, val };
}

export function limit(n: number) {
  return { type: 'limit', val: n };
}

export function orderBy(col: string, dir: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', col, dir };
}

export async function getDoc(docRef: any): Promise<any> {
  const table = docRef.tableName;
  const id = docRef.id;
  const { data, error } = await realSupabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`Error in getDoc on ${table}/${id}:`, error);
    throw error;
  }

  return {
    exists: !!data,
    existsFn: () => !!data,
    get existsProperty() {
      return !!data;
    },
    data: () => data || null,
    id: id
  };
}

export async function setDoc(docRef: any, data: any, _options?: any) {
  const table = docRef.tableName;
  const id = docRef.id;
  const payload = { ...data, id };
  
  const { error } = await realSupabase
    .from(table)
    .upsert(payload);

  if (error) {
    console.error(`Error in setDoc on ${table}/${id}:`, error);
    throw error;
  }
}

export async function updateDoc(docRef: any, data: any) {
  const table = docRef.tableName;
  const id = docRef.id;
  
  const { error } = await realSupabase
    .from(table)
    .update(data)
    .eq('id', id);

  if (error) {
    console.error(`Error in updateDoc on ${table}/${id}:`, error);
    throw error;
  }
}

export async function deleteDoc(docRef: any) {
  const table = docRef.tableName;
  const id = docRef.id;
  
  const { error } = await realSupabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error in deleteDoc on ${table}/${id}:`, error);
    throw error;
  }
}

export async function addDoc(collectionRef: any, data: any) {
  const table = collectionRef.tableName;
  const id = uuidv4();
  const payload = { ...data, id };
  
  const { data: inserted, error } = await realSupabase
    .from(table)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error(`Error in addDoc on table ${table}:`, error);
    throw error;
  }

  return {
    id: inserted?.id || id,
    path: `${table}/${inserted?.id || id}`
  };
}

export async function getDocs(queryObj: any) {
  const colRef = queryObj instanceof FirestoreQuery ? queryObj.colRef : queryObj;
  const constraints = queryObj instanceof FirestoreQuery ? queryObj.constraints : [];
  
  const table = colRef.tableName;
  let q: any = realSupabase.from(table).select('*');
  
  for (const c of constraints) {
    if (c.type === 'where') {
      const { col, op, val } = c;
      if (op === '==' || op === '===') {
        q = q.eq(col, val);
      } else if (op === '>=') {
        q = q.gte(col, val);
      } else if (op === '<=') {
        q = q.lte(col, val);
      } else if (op === '>') {
        q = q.gt(col, val);
      } else if (op === '<') {
        q = q.lt(col, val);
      } else if (op === '!=') {
        q = q.neq(col, val);
      } else if (op === 'in') {
        q = q.in(col, val);
      } else if (op === 'array-contains') {
        q = q.contains(col, [val]);
      }
    } else if (c.type === 'orderBy') {
      q = q.order(c.col, { ascending: c.dir !== 'desc' });
    } else if (c.type === 'limit') {
      q = q.limit(c.val);
    }
  }

  const { data, error } = await q;
  if (error) {
    console.error(`Error in getDocs on table ${table}:`, error);
    throw error;
  }

  const docs = (data || []).map((item: any) => ({
    id: item.id || item.uid,
    data: () => item,
    exists: true,
    existsFn: () => true
  }));

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback: (doc: any) => void) => {
      docs.forEach(callback);
    }
  };
}

export function writeBatch(_db?: any) {
  const operations: Array<() => Promise<void>> = [];
  return {
    set: (docRef: any, data: any) => {
      operations.push(async () => {
        await setDoc(docRef, data);
      });
    },
    update: (docRef: any, data: any) => {
      operations.push(async () => {
        await updateDoc(docRef, data);
      });
    },
    delete: (docRef: any) => {
      operations.push(async () => {
        await deleteDoc(docRef);
      });
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    }
  };
}

export function onSnapshot(queryObj: any, onNext: (snapshot: any) => void, onError?: (error: any) => void) {
  const colRef = queryObj instanceof FirestoreQuery ? queryObj.colRef : queryObj;
  const table = colRef.tableName;

  getDocs(queryObj).then(onNext).catch(onError);

  const channel = realSupabase
    .channel(`public-changes-${table}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: table },
      () => {
        getDocs(queryObj).then(onNext).catch(onError);
      }
    )
    .subscribe();

  return () => {
    realSupabase.removeChannel(channel);
  };
}

// ============================================================================
// SECURE AUTHENTICATION WRAPPERS
// ============================================================================

export const isRealSupabaseEnabled = true;

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "supabase_integrated_key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "supabase_integrated_auth",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "supabase_integrated_project",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "default",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "supabase_integrated_bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "none",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "none"
};

export async function secureSignUp(email: string, pass: string, name?: string) {
  const { data, error } = await realSupabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: {
        name: name || email.split('@')[0]
      }
    }
  });

  if (error) throw error;
  
  return {
    user: data.user ? {
      uid: data.user.id,
      email: data.user.email,
      emailVerified: data.user.email_confirmed_at ? true : false
    } : null
  };
}

export async function secureSignIn(email: string, pass: string) {
  const { data, error } = await realSupabase.auth.signInWithPassword({
    email,
    password: pass
  });

  if (error) throw error;

  return {
    user: data.user ? {
      uid: data.user.id,
      email: data.user.email,
      emailVerified: data.user.email_confirmed_at ? true : false
    } : null
  };
}

export async function secureSignOut() {
  const { error } = await realSupabase.auth.signOut();
  if (error) throw error;
}

export async function secureSendEmailVerification(_user: any) {
  console.log('[Verification] Skipped manual email verification in Supabase sandbox auth.');
}

export async function secureSendPasswordResetEmail(email: string) {
  const { error } = await realSupabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`
  });
  if (error) throw error;
}

export async function secureUpdatePassword(newPass: string) {
  const { error } = await realSupabase.auth.updateUser({
    password: newPass
  });
  if (error) throw error;
}

export function setActiveBusinessId(id: string) {
  localStorage.setItem('tareza_active_business_id', id);
}

export function getActiveBusinessId(): string | null {
  return localStorage.getItem('tareza_active_business_id');
}
