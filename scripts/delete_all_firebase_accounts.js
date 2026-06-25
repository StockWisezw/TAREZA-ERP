import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

console.log('🧹 Starting Firebase Cleanup Service...');

// Load Firebase applet configuration
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig = {};

try {
  const fileContent = fs.readFileSync(configPath, 'utf8');
  firebaseConfig = JSON.parse(fileContent);
} catch (err) {
  console.warn('⚠️ Could not find or read firebase-applet-config.json, using environment variables instead.');
  firebaseConfig = {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    firestoreDatabaseId: process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)'
  };
}

const projectId = firebaseConfig.projectId;
const databaseId = firebaseConfig.firestoreDatabaseId || 'ai-studio-12a2bf43-b592-4fb4-8c2d-283e781c23ce';

if (!projectId) {
  console.error('❌ Project ID is not found. Cannot proceed.');
  process.exit(1);
}

console.log(`📡 Connecting to Firebase Project: "${projectId}"`);
console.log(`🗄️ Database ID: "${databaseId}"`);

const adminApp = initializeApp({
  projectId: projectId
});

const auth = getAuth(adminApp);
const db = getFirestore(adminApp, databaseId);

// 1. DELETE ALL FIREBASE AUTH ACCOUNTS
async function deleteAllAuthUsers() {
  console.log('\n👤 Auditing Firebase Auth Users...');
  let totalDeleted = 0;
  
  try {
    let nextPageToken;
    do {
      const listUsersResult = await auth.listUsers(100, nextPageToken);
      const uids = listUsersResult.users.map(user => user.uid);
      
      if (uids.length > 0) {
        console.log(`🗑️ Deleting a batch of ${uids.length} auth user accounts...`);
        const deleteResult = await auth.deleteUsers(uids);
        totalDeleted += uids.length;
        console.log(`✅ Deleted ${deleteResult.successCount} users successfully. Failures: ${deleteResult.failureCount}`);
        
        if (deleteResult.errors.length > 0) {
          console.error('Errors details:', deleteResult.errors);
        }
      }
      
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    console.log(`🎉 Auth Cleanup Completed! Total Firebase users deleted: ${totalDeleted}`);
  } catch (error) {
    console.error('❌ Error during Auth Cleanup:', error);
  }
}

// 2. DELETE FIRESTORE DOCUMENTS
const collections = [
  'businesses',
  'branches',
  'profiles',
  'business_users',
  'categories',
  'products',
  'inventory',
  'inventory_batches',
  'sales',
  'cash_drawer_logs',
  'suppliers',
  'purchase_orders',
  'support_tickets',
  'currencies',
  'exchange_rate_history',
  'test' // connection test path
];

async function deleteCollectionDocs(collectionName) {
  try {
    const colRef = db.collection(collectionName);
    const snapshot = await colRef.limit(200).get();
    
    if (snapshot.empty) {
      return 0;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    const count = snapshot.size;
    console.log(`   - Deleted ${count} documents from "${collectionName}"`);
    
    // Recurse to handle any additional batches
    const remainingCount = await deleteCollectionDocs(collectionName);
    return count + remainingCount;
  } catch (err) {
    console.error(`❌ Error clearing collection "${collectionName}":`, err.message);
    return 0;
  }
}

async function clearAllFirestoreData() {
  console.log('\n🗄️ Auditing Firestore Collections...');
  let totalDocsDeleted = 0;
  
  for (const col of collections) {
    console.log(`🧹 Clearing collection: "${col}"...`);
    const count = await deleteCollectionDocs(col);
    totalDocsDeleted += count;
  }
  
  console.log(`🎉 Firestore Data Cleanup Completed! Total documents deleted: ${totalDocsDeleted}`);
}

async function run() {
  console.log('====================================================');
  await deleteAllAuthUsers();
  await clearAllFirestoreData();
  console.log('====================================================');
  console.log('💎 Firebase has been perfectly cleaned of all user accounts and documents!');
}

run();
