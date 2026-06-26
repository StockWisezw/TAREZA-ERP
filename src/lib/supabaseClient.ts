import { v4 as uuidv4 } from 'uuid';
import { supabase as firebaseSupabase, auth as fbAuth, SupabaseQueryBuilder as FirebaseQueryBuilder } from './firebaseClient';

export const supabase = firebaseSupabase;
export const auth = fbAuth;
export const SupabaseQueryBuilder = FirebaseQueryBuilder;


// ============================================================================
// INVENTORY OPERATIONS (CRITICAL SECTION)
// ============================================================================

export const inventory = {
  /**
   * Get inventory for a specific branch-product combination
   */
  async getInventory(businessId: string, branchId: string, productId: string) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('product_id', productId)
      .single();

    return { data, error };
  },

  /**
   * Get all inventory for a branch
   */
  async getBranchInventory(businessId: string, branchId: string) {
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        *,
        products(id, name, sku, barcode, retail_price, cost_price)
      `)
      .eq('business_id', businessId)
      .eq('branch_id', branchId);

    return { data, error };
  },

  /**
   * Get low stock items
   */
  async getLowStockItems(businessId: string, branchId?: string) {
    let query = supabase
      .from('inventory')
      .select(`
        *,
        products(id, name, sku)
      `)
      .eq('business_id', businessId);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (data) {
      return {
        data: data.filter((item: any) => item.quantity <= item.reorder_level),
        error
      };
    }

    return { data, error };
  },

  /**
   * Update inventory quantity
   * CRITICAL: Has validation to prevent negative quantities
   */
  async updateQuantity(
    businessId: string,
    branchId: string,
    productId: string,
    newQuantity: number,
    notes?: string
  ) {
    if (newQuantity < 0) {
      return {
        data: null,
        error: new Error('Inventory quantity cannot be negative')
      };
    }

    const { data, error } = await supabase
      .from('inventory')
      .update({ quantity: newQuantity })
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('product_id', productId)
      .select();

    // Log the movement
    if (!error && data) {
      await supabase.from('stock_movements').insert({
        business_id: businessId,
        branch_id: branchId,
        product_id: productId,
        movement_type: 'ADJUST',
        quantity_changed: newQuantity,
        notes: notes || 'Manual adjustment'
      });
    }

    return { data, error };
  },

  /**
   * Adjust inventory by delta
   */
  async adjustQuantity(
    businessId: string,
    branchId: string,
    productId: string,
    delta: number,
    movementType: 'IN' | 'OUT' | 'RETURN' | 'ADJUST' = 'ADJUST',
    reference?: { type: string; id: string }
  ) {
    // Get current quantity
    const { data: current } = await this.getInventory(businessId, branchId, productId);
    const currentQty = (current as any)?.quantity || 0;
    const newQty = currentQty + delta;

    if (newQty < 0) {
      return {
        data: null,
        error: new Error(
          `Cannot reduce inventory by ${delta}. Current stock: ${currentQty}, would result in: ${newQty}`
        )
      };
    }

    // Update inventory
    const { data, error } = await supabase
      .from('inventory')
      .update({ quantity: newQty })
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('product_id', productId)
      .select();

    // Log movement
    if (!error) {
      await supabase.from('stock_movements').insert({
        business_id: businessId,
        branch_id: branchId,
        product_id: productId,
        movement_type: movementType,
        quantity_changed: delta,
        quantity_before: currentQty,
        quantity_after: newQty,
        reference_type: reference?.type,
        reference_id: reference?.id,
        created_at: new Date().toISOString()
      });
    }

    return { data, error };
  }
};

// ============================================================================
// INVENTORY BATCH OPERATIONS (CRITICAL SECTION)
// ============================================================================

export const inventoryBatches = {
  /**
   * Get batches for a product at a branch
   */
  async getBatches(businessId: string, branchId: string, productId: string) {
    const { data, error } = await supabase
      .from('inventory_batches')
      .select('*')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('product_id', productId)
      .order('expiry_date', { ascending: true });

    return { data, error };
  },

  /**
   * Get expired batches
   */
  async getExpiredBatches(businessId: string, branchId?: string) {
    let query = supabase
      .from('inventory_batches')
      .select(`
        *,
        products(id, name, sku)
      `)
      .eq('business_id', businessId)
      .lt('expiry_date', new Date().toISOString().split('T')[0]);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    return query;
  },

  /**
   * Get batches expiring within N days
   */
  async getExpiringBatches(businessId: string, daysThreshold: number = 30, branchId?: string) {
    const today = new Date();
    const futureDate = new Date(today.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];

    let query = supabase
      .from('inventory_batches')
      .select(`
        *,
        products(id, name, sku)
      `)
      .eq('business_id', businessId)
      .gte('expiry_date', todayStr)
      .lte('expiry_date', futureStr)
      .gt('quantity', 0)
      .order('expiry_date', { ascending: true });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    return query;
  },

  /**
   * Add a new batch
   */
  async addBatch(
    businessId: string,
    branchId: string,
    productId: string,
    batchNumber: string,
    expiryDate: string,
    quantity: number
  ) {
    if (quantity < 0) {
      return { data: null, error: new Error('Batch quantity cannot be negative') };
    }

    const { data, error } = await supabase
      .from('inventory_batches')
      .insert({
        id: uuidv4(),
        business_id: businessId,
        branch_id: branchId,
        product_id: productId,
        batch_number: batchNumber,
        expiry_date: expiryDate,
        quantity: quantity,
        created_at: new Date().toISOString()
      })
      .select();

    return { data, error };
  },

  /**
   * Update batch quantity
   */
  async updateBatchQuantity(
    batchId: string,
    newQuantity: number
  ) {
    if (newQuantity < 0) {
      return { data: null, error: new Error('Batch quantity cannot be negative') };
    }

    const { data, error } = await supabase
      .from('inventory_batches')
      .update({ quantity: newQuantity })
      .eq('id', batchId)
      .select();

    return { data, error };
  }
};

// ============================================================================
// PRODUCT OPERATIONS
// ============================================================================

export const products = {
  async getProducts(businessId: string, filters?: any) {
    let query = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    return query;
  },

  async getProductBySku(businessId: string, sku: string) {
    return supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('sku', sku)
      .single();
  },

  async getProductByBarcode(businessId: string, barcode: string) {
    return supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('barcode', barcode)
      .single();
  }
};

// ============================================================================
// SALES OPERATIONS
// ============================================================================

export const sales = {
  async recordSale(
    businessId: string,
    branchId: string,
    items: any[],
    totals: any
  ) {
    const receiptNumber = `RCP-${Date.now()}`;
    const userId = auth.currentUser?.id;

    const { data, error } = await supabase
      .from('sales')
      .insert({
        id: uuidv4(),
        business_id: businessId,
        branch_id: branchId,
        user_id: userId,
        receipt_number: receiptNumber,
        subtotal: totals.subtotal,
        vat_total: totals.vat,
        discount_total: totals.discount,
        total: totals.total,
        payment_method: totals.paymentMethod || 'cash',
        status: 'completed',
        created_at: new Date().toISOString()
      })
      .select();

    return { data: data?.[0], error, receiptNumber };
  }
};

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

export const realtime = {
  /**
   * Subscribe to inventory changes
   */
  onInventoryChange(
    businessId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`inventory:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `business_id=eq.${businessId}`
        },
        callback
      )
      .subscribe();
  },

  /**
   * Subscribe to batch changes
   */
  onBatchChange(
    businessId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`batches:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_batches',
          filter: `business_id=eq.${businessId}`
        },
        callback
      )
      .subscribe();
  }
};

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

export const account = {
  get: async () => {
    return {
      $id: auth.currentUser?.id || '',
      email: auth.currentUser?.email || '',
      name: auth.currentUser?.displayName || '',
      created_at: auth.currentUser?.metadata?.creationTime || '',
      updated_at: auth.currentUser?.metadata?.lastSignInTime || ''
    };
  },
  deleteSession: async (sessionId: string) => {
    await supabase.auth.signOut();
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

export const rawSupabase = supabase;
export const DATABASE_ID = 'default';
export const BUCKET_ID = 'tareza-uploads';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export const firebaseConfig = null;
export const firebaseAuth = null;
export const firestore = null;

// Legacy wrapper for compatibility
export const from = (table: string) => new SupabaseQueryBuilder(table);
