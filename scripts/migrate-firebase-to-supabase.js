#!/usr/bin/env node

/**
 * FIREBASE TO SUPABASE MIGRATION SCRIPT
 * 
 * This script:
 * 1. Exports all data from Firebase Firestore
 * 2. Validates data integrity (especially inventory)
 * 3. Inserts into Supabase PostgreSQL
 * 4. Verifies migration success
 * 
 * Usage:
 *   node scripts/migrate-firebase-to-supabase.js
 *   BATCH_SIZE=500 node scripts/migrate-firebase-to-supabase.js
 */

const firebaseAdmin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100');
const FIREBASE_TIMEOUT = parseInt(process.env.FIREBASE_TIMEOUT || '15000');
const SUPABASE_TIMEOUT = parseInt(process.env.SUPABASE_TIMEOUT || '15000');

console.log('🚀 Firebase to Supabase Migration Script');
console.log(`📦 Batch Size: ${BATCH_SIZE}`);
console.log(`⏱️  Timeouts - Firebase: ${FIREBASE_TIMEOUT}ms, Supabase: ${SUPABASE_TIMEOUT}ms\n`);

// ============================================================================
// INITIALIZE CLIENTS
// ============================================================================

// Firebase
const firebaseConfigPath = process.env.FIREBASE_CONFIG_PATH || './firebase-applet-config.json';
let firebaseConfig;

try {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
} catch (err) {
  console.error(`❌ Failed to read Firebase config from ${firebaseConfigPath}`);
  console.error('   Please ensure firebase-applet-config.json exists in project root');
  process.exit(1);
}

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(firebaseConfig),
  projectId: firebaseConfig.projectId
});

const firebaseDb = firebaseAdmin.firestore();

// Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// MIGRATION STATISTICS
// ============================================================================

const stats = {
  businesses: 0,
  branches: 0,
  profiles: 0,
  businessUsers: 0,
  categories: 0,
  products: 0,
  inventory: 0,
  inventoryBatches: 0,
  sales: 0,
  cashDrawerLogs: 0,
  suppliers: 0,
  purchaseOrders: 0,
  supportTickets: 0,
  currencies: 0,
  exchangeRateHistory: 0,
  errors: []
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const logProgress = (collection, current, total) => {
  const percentage = Math.round((current / total) * 100);
  process.stdout.write(`\r  ⏳ ${collection.padEnd(20)} ${current}/${total} (${percentage}%)`);
};

const logSuccess = (collection, count) => {
  console.log(`\n  ✅ ${collection.padEnd(20)} ${count} records migrated`);
};

const logError = (collection, error) => {
  console.error(`\n  ❌ ${collection.padEnd(20)} Error: ${error.message}`);
  stats.errors.push({ collection, error: error.message });
};

// ============================================================================
// DATA TRANSFORMATIONS
// ============================================================================

const transformInventory = (doc) => {
  const data = doc.data();
  
  // Validate quantity
  if (typeof data.quantity !== 'number' || data.quantity < 0) {
    throw new Error(
      `Invalid inventory quantity for product ${data.product_id}: ${data.quantity}`
    );
  }

  return {
    id: doc.id,
    business_id: data.business_id,
    branch_id: data.branch_id,
    product_id: data.product_id,
    quantity: Math.max(0, data.quantity || 0),
    reorder_level: data.reorder_level || 10,
    created_at: data.created_at?.toDate?.() || new Date(),
    updated_at: data.updated_at?.toDate?.() || new Date()
  };
};

const transformInventoryBatch = (doc) => {
  const data = doc.data();
  
  // Validate quantity
  if (typeof data.quantity !== 'number' || data.quantity < 0) {
    throw new Error(
      `Invalid batch quantity for batch ${data.batch_number}: ${data.quantity}`
    );
  }

  // Validate expiry date
  let expiryDate = data.expiry_date;
  if (expiryDate?.toDate) {
    expiryDate = expiryDate.toDate().toISOString().split('T')[0];
  } else if (typeof expiryDate === 'string') {
    // Ensure ISO format (YYYY-MM-DD)
    expiryDate = expiryDate.split('T')[0];
  } else {
    throw new Error(`Invalid expiry date for batch ${data.batch_number}`);
  }

  return {
    id: doc.id,
    business_id: data.business_id,
    branch_id: data.branch_id,
    product_id: data.product_id,
    batch_number: data.batch_number,
    expiry_date: expiryDate,
    quantity: Math.max(0, data.quantity || 0),
    created_at: data.created_at?.toDate?.() || new Date(),
    updated_at: data.updated_at?.toDate?.() || new Date()
  };
};

const transformDate = (val) => {
  if (!val) return null;
  if (val.toDate) return val.toDate().toISOString();
  return new Date(val).toISOString();
};

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

async function migrateCollection(firebaseCollection, supabaseTable, transformer = null) {
  try {
    const snapshot = await firebaseDb.collection(firebaseCollection).get();
    const docs = snapshot.docs;
    
    if (docs.length === 0) {
      logSuccess(supabaseTable, 0);
      return;
    }

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      const rows = batch.map(doc => {
        const data = doc.data();
        
        if (transformer) {
          return transformer(doc);
        }

        // Default transformation: convert Firebase timestamp
        const transformed = { ...data, id: doc.id };
        Object.keys(transformed).forEach(key => {
          if (transformed[key]?.toDate) {
            transformed[key] = transformed[key].toDate().toISOString();
          }
        });
        return transformed;
      });

      const { error } = await supabase.from(supabaseTable).insert(rows);
      
      if (error) {
        logError(supabaseTable, error);
        throw error;
      }

      logProgress(supabaseTable, Math.min(i + BATCH_SIZE, docs.length), docs.length);
      await sleep(100); // Rate limiting
    }

    stats[supabaseTable] = docs.length;
    logSuccess(supabaseTable, docs.length);
  } catch (err) {
    logError(supabaseTable, err);
    throw err;
  }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

async function validateInventory() {
  console.log('\n🔍 Validating Inventory Data...\n');

  try {
    // Check for negative quantities
    const { data: negativeQty, error: negError } = await supabase
      .from('inventory')
      .select('id, product_id, quantity')
      .lt('quantity', 0);

    if (negativeQty && negativeQty.length > 0) {
      console.warn('⚠️  Found negative inventory quantities:');
      negativeQty.forEach(row => {
        console.warn(`   - Product ${row.product_id}: ${row.quantity}`);
      });
    } else {
      console.log('  ✅ No negative quantities found');
    }

    // Check batch consistency
    const { data: batches } = await supabase
      .from('inventory_batches')
      .select('id, batch_number, expiry_date, quantity');

    if (batches) {
      const today = new Date().toISOString().split('T')[0];
      const expired = batches.filter(b => b.expiry_date < today && b.quantity > 0);
      
      if (expired.length > 0) {
        console.warn(`\n⚠️  Found ${expired.length} expired batches with stock:`);
        expired.slice(0, 5).forEach(b => {
          console.warn(`   - Batch ${b.batch_number}: ${b.quantity} units, expired ${b.expiry_date}`);
        });
      } else {
        console.log('  ✅ No problematic expired batches found');
      }
    }

    // Check referential integrity
    const { data: orphaned } = await supabase
      .from('inventory')
      .select('id, product_id')
      .then(async (result) => {
        if (result.error) return result;
        
        // Check if all product_ids exist
        const { data: products } = await supabase
          .from('products')
          .select('id');
        
        const productIds = new Set(products.map(p => p.id));
        const orphanedRecords = result.data.filter(
          inv => !productIds.has(inv.product_id)
        );
        
        return { data: orphanedRecords };
      });

    if (orphaned && orphaned.length > 0) {
      console.warn(`\n⚠️  Found ${orphaned.length} inventory records with non-existent products`);
    } else {
      console.log('  ✅ All inventory references valid');
    }
  } catch (err) {
    console.error('❌ Validation error:', err.message);
  }
}

// ============================================================================
// MAIN MIGRATION FLOW
// ============================================================================

async function runMigration() {
  console.log('📋 Starting Data Migration...\n');
  
  try {
    // Order matters: parents before children
    console.log('Step 1/7: Migrating Businesses...');
    await migrateCollection('businesses', 'businesses');

    console.log('\nStep 2/7: Migrating Branches...');
    await migrateCollection('branches', 'branches');

    console.log('\nStep 3/7: Migrating Profiles (Users)...');
    await migrateCollection('profiles', 'profiles');

    console.log('\nStep 4/7: Migrating Business Users...');
    await migrateCollection('business_users', 'business_users');

    console.log('\nStep 5/7: Migrating Categories and Products...');
    await migrateCollection('categories', 'categories');
    await migrateCollection('products', 'products');

    console.log('\nStep 6/7: Migrating Inventory (with validation)...');
    await migrateCollection('inventory', 'inventory', transformInventory);

    console.log('\nStep 6b/7: Migrating Inventory Batches (CRITICAL)...');
    await migrateCollection('inventory_batches', 'inventory_batches', transformInventoryBatch);

    console.log('\nStep 7/7: Migrating Other Collections...');
    await migrateCollection('sales', 'sales');
    await migrateCollection('cash_drawer_logs', 'cash_drawer_logs');
    await migrateCollection('suppliers', 'suppliers');
    await migrateCollection('purchase_orders', 'purchase_orders');
    await migrateCollection('support_tickets', 'support_tickets');
    await migrateCollection('currencies', 'currencies');
    await migrateCollection('exchange_rate_history', 'exchange_rate_history');

    // Validation
    console.log('\n');
    await validateInventory();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✨ MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.table(stats);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  ERRORS ENCOUNTERED:');
      stats.errors.forEach(e => {
        console.log(`   - ${e.collection}: ${e.error}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration Complete!');
    console.log('='.repeat(60));
    console.log('\n📝 Next Steps:');
    console.log('   1. Run functional tests in the application');
    console.log('   2. Verify inventory quantities are correct');
    console.log('   3. Check batch tracking for compliance items');
    console.log('   4. Monitor Supabase dashboard for any issues');
    console.log('   5. Once confirmed, decommission Firebase\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    console.error('\nDebug Info:');
    console.error('  Firebase Project:', firebaseConfig.projectId);
    console.error('  Supabase URL:', supabaseUrl);
    console.error('\nTroubleshooting:');
    console.error('  - Verify Firebase credentials are correct');
    console.error('  - Verify Supabase URL and service role key are correct');
    console.error('  - Check Supabase database is running');
    console.error('  - Check internet connection\n');
    process.exit(1);
  }
}

// ============================================================================
// SAFETY CHECKS
// ============================================================================

async function performSafetyChecks() {
  console.log('🔒 Performing Safety Checks...\n');

  // Check Firebase connection
  try {
    await firebaseDb.collection('_connection_test').doc('ping').set(
      { timestamp: new Date() },
      { merge: true }
    );
    await firebaseDb.collection('_connection_test').doc('ping').delete();
    console.log('  ✅ Firebase connection OK');
  } catch (err) {
    console.error('  ❌ Cannot connect to Firebase');
    process.exit(1);
  }

  // Check Supabase connection
  try {
    const { data } = await supabase.auth.getSession();
    console.log('  ✅ Supabase connection OK');
  } catch (err) {
    console.error('  ❌ Cannot connect to Supabase');
    process.exit(1);
  }

  console.log('\n');
}

// ============================================================================
// ENTRY POINT
// ============================================================================

(async () => {
  await performSafetyChecks();
  await runMigration();
})();
