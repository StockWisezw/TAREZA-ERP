import { db, auth } from './firebase';
import { collection, query, where, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';

class SupabaseQueryBuilder {
  private table: string;
  private q: any;
  private mutationType: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private mutationData: any = null;
  private singleResult: boolean = false;

  constructor(table: string) {
    this.table = table;
    this.q = collection(db, table);
  }

  select(params: string = '*') {
    return this;
  }

  eq(field: string, value: any) {
    this.q = query(this.q, where(field, '==', value));
    return this;
  }

  order(field: string, { ascending }: any = { ascending: false }) {
    this.q = query(this.q, orderBy(field, ascending ? 'asc' : 'desc'));
    return this;
  }

  limit(l: number) {
    this.q = query(this.q, limit(l));
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  insert(data: any) {
    this.mutationType = 'insert';
    this.mutationData = data;
    return this;
  }

  update(data: any) {
    this.mutationType = 'update';
    this.mutationData = data;
    return this;
  }

  delete() {
    this.mutationType = 'delete';
    return this;
  }

  upsert(data: any) {
    this.mutationType = 'upsert';
    this.mutationData = data;
    return this;
  }

  async execute() {
    try {
      if (this.mutationType === 'insert') {
        let resData;
        if (this.mutationData.id) {
          const docRef = doc(db, this.table, this.mutationData.id);
          await setDoc(docRef, this.mutationData);
          resData = this.mutationData;
        } else {
          const ref = await addDoc(collection(db, this.table), this.mutationData);
          resData = { id: ref.id, ...this.mutationData };
        }
        return { data: this.singleResult ? resData : [resData], error: null };
      }

      const snap = await getDocs(this.q);
      
      if (this.mutationType === 'update') {
        for (const d of snap.docs) {
          await updateDoc(d.ref, this.mutationData);
        }
        return { data: null, error: null };
      }

      if (this.mutationType === 'delete') {
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
        return { data: null, error: null };
      }

      if (this.mutationType === 'upsert') {
         if (this.mutationData.id) {
           const docRef = doc(db, this.table, this.mutationData.id);
           await setDoc(docRef, this.mutationData, { merge: true });
           return { data: this.mutationData, error: null };
         } else {
           const ref = await addDoc(collection(db, this.table), this.mutationData);
           return { data: { id: ref.id, ...this.mutationData }, error: null };
         }
      }

      // SELECT
      if (this.singleResult) {
        if (snap.empty) return { data: null, error: { message: 'Not found' } };
        return { data: { id: snap.docs[0].id, ...(snap.docs[0].data() as any) }, error: null };
      }

      const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }

  then(resolve: any, reject: any) {
    this.execute().then(resolve).catch(reject);
  }
}

export const supabase: any = {
  auth: {
    getUser: async () => {
       await auth.authStateReady();
       const user = auth.currentUser;
       if (!user) return { data: { user: null }, error: { message: 'Not logged in' } };
       return { data: { user: { id: user.uid, email: user.email } }, error: null };
    },
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => auth.signOut(),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  },
  from: (table: string) => {
    return new SupabaseQueryBuilder(table);
  },
  rpc: async () => ({ error: null }),
  functions: {
    invoke: async () => ({ data: null, error: null })
  },
  channel: () => ({
    on: () => ({ subscribe: () => {} })
  }),
  removeChannel: () => {}
};
