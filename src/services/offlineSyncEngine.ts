import { db, type BaseOfflineRecord, type OfflineQueueRecord, type SyncLogRecord } from '../lib/dexieDb';
import { supabase } from '../lib/firebaseClient';
import { toast } from 'sonner';

export class OfflineSyncEngine {
  private static instance: OfflineSyncEngine | null = null;
  private isSyncing = false;
  private syncInterval: any = null;

  private constructor() {
    this.setupListeners();
    // Auto-sync interval disabled: transactions are recorded offline by default and synced manually by user
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
        toast.info('Internet connection restored! You can now sync offline transactions to the cloud.');
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
    // Disabled in favor of manual user sync
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tareza-sync-completed', { detail: { synced: syncedCount, failed: failedCount } }));
    }
    return {
      total: pendingItems.length,
      synced: syncedCount,
      failed: failedCount,
    };
  }

  /**
   * Returns current count of pending/failed offline operations
   */
  public async getPendingCount(): Promise<number> {
    try {
      return await db.offlineQueue.where('status').anyOf(['pending', 'failed']).count();
    } catch {
      return 0;
    }
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

    const { supabase } = await import('../lib/firebaseClient');
    const { saveProducts, saveCategories, saveCustomers } = await import('../lib/indexedDb');

    for (const collName of collectionsToHydrate) {
      try {
        let res;
        if (collName !== 'businesses' && collName !== 'profiles' && collName !== 'support_tickets') {
          res = await supabase.from(collName).select('*').eq('business_id', businessId);
        } else {
          res = await supabase.from(collName).select('*');
        }

        const items = res.data || [];
        if (items.length > 0) {
          const dexieTable = (db as any)[collName];
          if (dexieTable) {
            const records = items.map((row: any) => ({
              ...row,
              syncStatus: 'synced',
              syncedAt: new Date().toISOString()
            }));

            // Bulk put to Dexie to overwrite or insert
            await dexieTable.bulkPut(records);
            console.log(`[OfflineSyncEngine] Successfully hydrated ${records.length} records into local table: ${collName}`);
          }

          // Mirror directly to POS offline catalog stores
          if (collName === 'products') {
            const posFormattedProds = items.map((p: any) => ({
              id: p.id,
              name: p.name || 'Unnamed',
              barcode: p.barcode || '',
              sku: p.sku || '',
              retailPrice: Number(p.retail_price || p.retailPrice || 0),
              wholesalePrice: Number(p.wholesale_price || p.wholesalePrice || 0),
              costPrice: Number(p.cost_price || 0),
              taxClass: (p.tax_class || p.taxClass || 'standard') as 'standard' | 'zero' | 'exempt',
              category: p.category_id || p.category || 'all',
              imageUrl: p.image_url || '',
              stock: Number(p.stock || p.stock_quantity || 0),
              bundles: p.bundles || []
            }));
            await saveProducts(posFormattedProds);
          } else if (collName === 'categories') {
            await saveCategories(items.map((c: any) => ({ id: c.id, name: c.name })));
          } else if (collName === 'customers') {
            await saveCustomers(items.map((c: any) => ({
              id: c.id,
              name: c.name,
              creditLimit: Number(c.credit_limit || 0),
              balance: Number(c.balance || 0)
            })));
          }
        }
      } catch (err) {
        console.warn(`[OfflineSyncEngine] Could not hydrate collection ${collName}:`, err);
      }
    }

    // Check if local Dexie products are still empty for this business; if so, populate starter retail inventory
    try {
      const existingProds = await db.products.toArray();
      if (existingProds.length === 0) {
        const starterProducts = [
          { id: 'prod-coke-330', business_id: businessId, name: 'Coca-Cola Can 330ml', sku: 'BEV-COKE-330', barcode: '5449000000996', retail_price: 1.00, wholesale_price: 0.85, cost_price: 0.70, category_id: 'beverages', stock: 120, is_active: true },
          { id: 'prod-water-500', business_id: businessId, name: 'Mineral Water 500ml', sku: 'BEV-WAT-500', barcode: '6001234567890', retail_price: 0.50, wholesale_price: 0.40, cost_price: 0.30, category_id: 'beverages', stock: 200, is_active: true },
          { id: 'prod-bread-800', business_id: businessId, name: 'White Bread 800g', sku: 'BAK-BRD-800', barcode: '6009876543210', retail_price: 1.10, wholesale_price: 0.95, cost_price: 0.85, category_id: 'bakery', stock: 50, is_active: true },
          { id: 'prod-milk-1l', business_id: businessId, name: 'Fresh Milk 1L', sku: 'DRY-MLK-1L', barcode: '6001122334455', retail_price: 1.50, wholesale_price: 1.30, cost_price: 1.15, category_id: 'dairy', stock: 65, is_active: true },
          { id: 'prod-sugar-2kg', business_id: businessId, name: 'White Sugar 2kg', sku: 'GRO-SUG-2K', barcode: '6005544332211', retail_price: 2.40, wholesale_price: 2.10, cost_price: 1.90, category_id: 'groceries', stock: 80, is_active: true },
          { id: 'prod-rice-2kg', business_id: businessId, name: 'Long Grain Rice 2kg', sku: 'GRO-RIC-2K', barcode: '6006677889900', retail_price: 2.60, wholesale_price: 2.25, cost_price: 2.00, category_id: 'groceries', stock: 95, is_active: true },
          { id: 'prod-oil-2l', business_id: businessId, name: 'Cooking Oil 2L', sku: 'GRO-OIL-2L', barcode: '6007788990011', retail_price: 3.80, wholesale_price: 3.40, cost_price: 3.10, category_id: 'groceries', stock: 45, is_active: true },
          { id: 'prod-mealie-10kg', business_id: businessId, name: 'Roller Meal 10kg', sku: 'GRO-ML-10K', barcode: '6008899001122', retail_price: 6.50, wholesale_price: 5.80, cost_price: 5.20, category_id: 'groceries', stock: 40, is_active: true }
        ];

        await db.products.bulkPut(starterProducts.map(p => ({
          ...p,
          syncStatus: 'synced',
          syncedAt: new Date().toISOString()
        })));

        const posFormat = starterProducts.map(p => ({
          id: p.id,
          name: p.name,
          barcode: p.barcode,
          sku: p.sku,
          retailPrice: p.retail_price,
          wholesalePrice: p.wholesale_price,
          costPrice: p.cost_price,
          taxClass: 'standard' as const,
          category: p.category_id,
          imageUrl: '',
          stock: p.stock,
          bundles: []
        }));
        await saveProducts(posFormat);
        console.log('[OfflineSyncEngine] Seeded local starter inventory catalog for business:', businessId);
      }
    } catch (seedErr) {
      console.warn('[OfflineSyncEngine] Starter inventory seed notice:', seedErr);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tareza-data-hydrated'));
      window.dispatchEvent(new Event('offline-mode-changed'));
    }
  }
}

export const offlineSyncEngine = OfflineSyncEngine.getInstance();
export default offlineSyncEngine;
