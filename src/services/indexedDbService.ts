import { RegisterSession } from '../hooks/usePOSSession';
import { CartItem, Payment, Customer, Discount } from '../store/posStore';

export interface ActiveTransactionState {
  id: string; // e.g. "current_active_transaction"
  cart: CartItem[];
  payments: Payment[];
  pricingTier: string;
  currentCustomer: Customer | null;
  globalDiscount?: Discount;
  updatedAt: string;
}

class IndexedDbService {
  private dbName = 'tareza_pos_indexed_db';
  private dbVersion = 2;

  private getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported in this environment'));
        return;
      }
      
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB database'));
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Create store for shifts
        if (!db.objectStoreNames.contains('shifts')) {
          db.createObjectStore('shifts', { keyPath: 'id' });
        }
        // Create store for transactions/carts
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'id' });
        }
        // Create store for offline queue
        if (!db.objectStoreNames.contains('offline_queue')) {
          db.createObjectStore('offline_queue', { keyPath: 'id' });
        }
      };
    });
  }

  // Shift state persistence
  async saveActiveShift(shift: any): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('shifts', 'readwrite');
        const store = transaction.objectStore('shifts');
        // We use a constant key to always represent the current active/paused shift
        const valueToSave = { ...shift, id: 'current_active_shift', updatedAt: new Date().toISOString() };
        const request = store.put(valueToSave);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('IndexedDB saveActiveShift error:', e);
    }
  }

  async getActiveShift(): Promise<any | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('shifts', 'readonly');
        const store = transaction.objectStore('shifts');
        const request = store.get('current_active_shift');
        request.onsuccess = () => {
          resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('IndexedDB getActiveShift error:', e);
      return null;
    }
  }

  async clearActiveShift(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('shifts', 'readwrite');
        const store = transaction.objectStore('shifts');
        const request = store.delete('current_active_shift');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('IndexedDB clearActiveShift error:', e);
    }
  }

  // Active Transaction state persistence
  async saveActiveTransaction(tx: ActiveTransactionState): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('transactions', 'readwrite');
        const store = transaction.objectStore('transactions');
        const request = store.put(tx);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('IndexedDB saveActiveTransaction error:', e);
    }
  }

  async getActiveTransaction(): Promise<ActiveTransactionState | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('transactions', 'readonly');
        const store = transaction.objectStore('transactions');
        const request = store.get('current_active_transaction');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('IndexedDB getActiveTransaction error:', e);
      return null;
    }
  }

  async clearActiveTransaction(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('transactions', 'readwrite');
        const store = transaction.objectStore('transactions');
        const request = store.delete('current_active_transaction');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('IndexedDB clearActiveTransaction error:', e);
    }
  }

  // Offline Queue Persistence for full offline capability
  async addQueuedTransaction(queuedTx: any): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('offline_queue', 'readwrite');
        const store = transaction.objectStore('offline_queue');
        const request = store.put(queuedTx);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('IndexedDB addQueuedTransaction error:', e);
      throw e;
    }
  }

  async getQueuedTransactions(): Promise<any[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('offline_queue', 'readonly');
        const store = transaction.objectStore('offline_queue');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('IndexedDB getQueuedTransactions error:', e);
      return [];
    }
  }

  async removeQueuedTransaction(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('offline_queue', 'readwrite');
        const store = transaction.objectStore('offline_queue');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('IndexedDB removeQueuedTransaction error:', e);
    }
  }

  async updateQueuedTransaction(queuedTx: any): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('offline_queue', 'readwrite');
        const store = transaction.objectStore('offline_queue');
        const request = store.put(queuedTx);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('IndexedDB updateQueuedTransaction error:', e);
    }
  }
}

export const indexedDbService = new IndexedDbService();
