import { db, type BaseOfflineRecord, type OfflineQueueRecord, type SyncLogRecord } from '../lib/dexieDb';
import { supabase } from '../lib/firebaseClient';
import { toast } from 'sonner';

export class OfflineSyncEngine {
  private static instance: OfflineSyncEngine | null = null;
  private isSyncing = false;
  private syncInterval: any = null;

  private constructor() {
    this.setupListeners();
    this.startAutoSync();
  }

  public static getInstance(): OfflineSyncEngine {
    if (!OfflineSyncEngine.instance) {
      OfflineSyncEngine.instance = new OfflineSyncEngine();
    }
    return OfflineSyncEngine.instance;
  }

  private setupListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        toast.success('Internet connection restored! Resuming synchronization...');
        this.sync();
      });

      window.addEventListener('offline', () => {
        toast.warning('Working offline. All transactions are saved locally.');
      });

      // Support manual triggers
      window.addEventListener('tareza-trigger-sync', () => {
        this.sync();
      });
    }
  }

  private startAutoSync() {
    if (typeof window !== 'undefined') {
      // Periodic background sync check every 15 seconds
      this.syncInterval = setInterval(() => {
        if (navigator.onLine && !this.isSyncing) {
          this.sync();
        }
      }, 15000);
    }
  }

  /**
   * Helper to generate standard UUIDs for offline creation
   */
  public generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Universal Local Create / Update operation
   * Automatically saves to Dexie and appends to the offline queue
   */
  public async save<T extends BaseOfflineRecord>(
    tableName: string,
    record: T,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<T> {
    const table = (db as any)[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} does not exist in Dexie DB.`);
    }

    const now = new Date().toISOString();
    const resolvedRecord: T = {
      ...record,
      id: record.id || this.generateUUID(),
      uuid: record.uuid || record.id || this.generateUUID(),
      deviceId: record.deviceId || 'browser-client',
      createdAt: record.createdAt || now,
      updatedAt: now,
      version: (record.version || 0) + 1,
      syncStatus: 'pending',
      deleted: record.deleted || false,
    };

    // Save to IndexedDB
    await table.put(resolvedRecord);

    // Add to Offline Sync Queue
    const queueItem: OfflineQueueRecord = {
      id: this.generateUUID(),
      type: `${tableName}:save`,
      recordId: resolvedRecord.id,
      payload: resolvedRecord,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
      priority,
    };

    await db.offlineQueue.put(queueItem);

    // Trigger immediate sync asynchronously if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.sync();
    }

    return resolvedRecord;
  }

  /**
   * Universal Local Delete operation (soft delete by default to enable deletion syncing)
   */
  public async delete(
    tableName: string,
    id: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<void> {
    const table = (db as any)[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} does not exist in Dexie DB.`);
    }

    const existing = await table.get(id);
    if (!existing) return;

    // Perform soft delete locally to preserve the record for synchronization
    const now = new Date().toISOString();
    const updatedRecord = {
      ...existing,
      updatedAt: now,
      version: (existing.version || 0) + 1,
      syncStatus: 'pending',
      deleted: true,
    };

    await table.put(updatedRecord);

    // Add delete action to Offline Queue
    const queueItem: OfflineQueueRecord = {
      id: this.generateUUID(),
      type: `${tableName}:delete`,
      recordId: id,
      payload: { id, deleted: true, updatedAt: now },
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
      priority,
    };

    await db.offlineQueue.put(queueItem);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.sync();
    }
  }

  /**
   * Run the complete synchronization process
   */
  public async sync(): Promise<{ total: number; synced: number; failed: number }> {
    if (this.isSyncing) return { total: 0, synced: 0, failed: 0 };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { total: 0, synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    let failedCount = 0;

    const pendingItems = await db.offlineQueue
      .where('status')
      .anyOf(['pending', 'failed'])
      .sortBy('timestamp');

    if (pendingItems.length === 0) {
      this.isSyncing = false;
      return { total: 0, synced: 0, failed: 0 };
    }

    console.log(`[OfflineSyncEngine] Processing ${pendingItems.length} queued operations...`);

    for (const item of pendingItems) {
      try {
        item.status = 'syncing';
        await db.offlineQueue.put(item);

        const [tableName, action] = item.type.split(':');
        
        if (action === 'save') {
          await this.syncSave(tableName, item.payload);
        } else if (action === 'delete') {
          await this.syncDelete(tableName, item.recordId);
        }

        // Mark as synced and delete from local queue
        await db.offlineQueue.delete(item.id);
        syncedCount++;
      } catch (err: any) {
        console.error(`[OfflineSyncEngine] Sync failed for item ${item.id}:`, err);
        failedCount++;
        
        item.status = 'failed';
        item.retryCount += 1;
        item.lastError = err?.message || String(err);
        
        // If it failed too many times, deprioritize or hold
        if (item.retryCount >= 5) {
          item.status = 'failed'; // kept in queue but doesn't block
          console.warn(`[OfflineSyncEngine] Item ${item.id} exceeded max retries. Suspended.`);
        }
        await db.offlineQueue.put(item);
      }
    }

    // Log the sync process in IndexedDB
    const logRecord: SyncLogRecord = {
      id: this.generateUUID(),
      timestamp: new Date().toISOString(),
      status: failedCount === 0 ? 'SUCCESS' : syncedCount > 0 ? 'PARTIAL' : 'FAILED',
      syncedCount,
      failedCount,
      details: `Processed ${pendingItems.length} items. Synced: ${syncedCount}, Failed: ${failedCount}`,
    };
    await db.syncLogs.put(logRecord);

    this.isSyncing = false;
    return {
      total: pendingItems.length,
      synced: syncedCount,
      failed: failedCount,
    };
  }

  /**
   * Sync a local record save/update to Supabase/Firestore
   */
  private async syncSave(tableName: string, localRecord: any): Promise<void> {
    // 1. Conflict Resolution (Fetch existing version from database)
    const { data: remoteRecord, error: fetchErr } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', localRecord.id)
      .maybeSingle();

    if (fetchErr) {
      console.warn(`[OfflineSyncEngine] Error resolving conflicts for table ${tableName}:`, fetchErr);
    }

    if (remoteRecord) {
      const localVer = Number(localRecord.version || 0);
      const remoteVer = Number(remoteRecord.version || 0);

      const localUpdated = new Date(localRecord.updatedAt || 0).getTime();
      const remoteUpdated = new Date(remoteRecord.updatedAt || 0).getTime();

      // If remote record is newer, resolve the conflict (last-write-wins or merged fields)
      if (remoteVer > localVer || remoteUpdated > localUpdated) {
        console.log(`[OfflineSyncEngine] Conflict detected on ${tableName}:${localRecord.id}. Remote version is newer. Merging...`);
        
        // Merge strategy: update local record with newer remote values while keeping offline-only edits
        const mergedRecord = {
          ...localRecord,
          ...remoteRecord,
          version: Math.max(localVer, remoteVer) + 1,
          syncStatus: 'synced',
          syncedAt: new Date().toISOString(),
        };

        const table = (db as any)[tableName];
        if (table) {
          await table.put(mergedRecord);
        }
        return; // Skip writing outdated local values to Supabase
      }
    }

    // Prepare payload for Supabase insertion/upsertion
    const payload = {
      ...localRecord,
      syncStatus: 'synced',
      syncedAt: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from(tableName)
      .upsert([payload]);

    if (upsertErr) {
      throw upsertErr;
    }

    // Update local record to synced
    const table = (db as any)[tableName];
    if (table) {
      await table.update(localRecord.id, {
        syncStatus: 'synced',
        syncedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Sync a deletion to Supabase/Firestore
   */
  private async syncDelete(tableName: string, recordId: string): Promise<void> {
    const { error: deleteErr } = await supabase
      .from(tableName)
      .delete()
      .eq('id', recordId);

    if (deleteErr) {
      throw deleteErr;
    }

    // Permanently remove from IndexedDB after successful deletion sync
    const table = (db as any)[tableName];
    if (table) {
      await table.delete(recordId);
    }
  }

  /**
   * Hydrates the local Dexie DB with data from Cloud Firestore.
   */
  public async hydrateLocalDatabase(businessId: string): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    
    console.log('[OfflineSyncEngine] Hydrating local database from Firestore for business:', businessId);
    
    const collectionsToHydrate = [
      'businesses',
      'branches',
      'profiles',
      'roles',
      'role_permissions',
      'business_users',
      'categories',
      'products',
      'inventory',
      'inventory_batches',
      'customers',
      'suppliers',
      'sales',
      'sale_items',
      'expense_categories',
      'cash_drawer_logs',
      'tax_rates',
      'purchase_orders',
      'stocktakes_advanced',
      'inventory_transfers',
      'stock_movements',
      'subscriptions',
      'accounts',
      'journal_entries',
      'journal_lines',
      'register_sessions',
      'audit_logs',
      'support_tickets',
      'trial_bookkeepings',
      'currencies',
      'exchange_rate_history'
    ];

    const { getFirestore, collection, getDocs, query, where } = await import('firebase/firestore');
    const firestoreInstance = getFirestore();

    for (const collName of collectionsToHydrate) {
      try {
        const collRef = collection(firestoreInstance, collName);
        let q;
        
        // Filter by business_id if applicable
        if (collName !== 'businesses' && collName !== 'profiles' && collName !== 'support_tickets') {
          q = query(collRef, where('business_id', '==', businessId));
        } else {
          q = collRef;
        }

        const querySnap = await getDocs(q);
        
        if (!querySnap.empty) {
          const dexieTable = (db as any)[collName];
          if (dexieTable) {
            const records = querySnap.docs.map(doc => ({
              id: doc.id,
              ...(doc.data() as any),
              syncStatus: 'synced',
              syncedAt: new Date().toISOString()
            }));

            // Bulk put to Dexie to overwrite or insert
            await dexieTable.bulkPut(records);
            console.log(`[OfflineSyncEngine] Successfully hydrated ${records.length} records into local table: ${collName}`);
          }
        }
      } catch (err) {
        console.warn(`[OfflineSyncEngine] Could not hydrate collection ${collName}:`, err);
      }
    }
  }
}

export const offlineSyncEngine = OfflineSyncEngine.getInstance();
export default offlineSyncEngine;
