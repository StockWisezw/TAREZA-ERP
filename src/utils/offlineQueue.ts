import { supabase } from '../lib/firebaseClient';

export interface QueuedTransaction {
  id: string;
  type: 'sale' | 'inventory' | 'gl_entry';
  data: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  retryCount: number;
  lastError?: string;
}

export class OfflineQueue {
  private db: IDBDatabase | null = null;
  private dbName = 'tareza_offline_queue_db';

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    if (typeof window === 'undefined') return;

    const request = indexedDB.open(this.dbName, 1);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      this.db = request.result;
      console.log('[OfflineQueue] IndexedDB initialized successfully.');
    };

    request.onerror = (event) => {
      console.error('[OfflineQueue] Failed to initialize IndexedDB:', event);
    };
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error || new Error('Failed to open database'));
    });
  }

  async add(transaction: Omit<QueuedTransaction, 'id' | 'status' | 'timestamp' | 'retryCount'>): Promise<string> {
    const id = crypto.randomUUID();
    const queued: QueuedTransaction = {
      id,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      ...transaction
    };

    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['queue'], 'readwrite');
      const store = tx.objectStore('queue');
      const request = store.add(queued);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPending(): Promise<QueuedTransaction[]> {
    const db = await this.ensureDb();
    return new Promise((resolve) => {
      const tx = db.transaction(['queue'], 'readonly');
      const store = tx.objectStore('queue');
      const request = store.getAll();

      request.onsuccess = () => {
        const results: QueuedTransaction[] = request.result || [];
        resolve(results.filter(q => q.status === 'pending' || q.status === 'failed'));
      };
      request.onerror = () => resolve([]);
    });
  }

  async markAsSynced(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['queue'], 'readwrite');
      const store = tx.objectStore('queue');
      const request = store.get(id);

      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          data.status = 'synced';
          store.put(data);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markAsFailed(id: string, errorMsg: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['queue'], 'readwrite');
      const store = tx.objectStore('queue');
      const request = store.get(id);

      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          data.status = 'failed';
          data.retryCount += 1;
          data.lastError = errorMsg;
          store.put(data);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async remove(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['queue'], 'readwrite');
      const store = tx.objectStore('queue');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async sync(): Promise<{ total: number; synced: number; failed: number }> {
    const pending = await this.getPending();
    if (pending.length === 0) {
      return { total: 0, synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        await this.syncItem(item);
        await this.markAsSynced(item.id);
        synced++;
      } catch (err: any) {
        console.error(`[OfflineQueue] Sync failed for transaction ${item.id}:`, err);
        await this.markAsFailed(item.id, err?.message || String(err));
        failed++;
      }
    }

    return {
      total: pending.length,
      synced,
      failed
    };
  }

  private async syncItem(item: QueuedTransaction): Promise<any> {
    const { data, type } = item;
    
    switch (type) {
      case 'sale': {
        const { error } = await supabase.from('sales').insert([data]);
        if (error) throw error;
        break;
      }
      case 'inventory': {
        const { error } = await supabase.from('stock_movements').insert([data]);
        if (error) throw error;
        break;
      }
      case 'gl_entry': {
        const { error } = await supabase.from('trial_bookkeepings').insert([data]);
        if (error) throw error;
        break;
      }
      default:
        throw new Error(`Unsupported offline transaction type: ${type}`);
    }
  }
}

// Export singleton instance
export const globalOfflineQueue = new OfflineQueue();
export default globalOfflineQueue;
