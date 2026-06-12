import { getFirestore, collection, getDocs } from "firebase/firestore";
import { sendWhatsAppNotification, notificationAuditLogs } from "./server-notification-service.js";

interface InventoryItem {
  id: string;
  business_id?: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  reorder_level: number;
}

interface ProductItem {
  id: string;
  name: string;
  sku: string;
}

interface BranchItem {
  id: string;
  name: string;
}

/**
 * Checks all inventory stock levels against their reorder thresholds and dispatches a prioritized WhatsApp alert.
 */
export async function checkLowStockAndNotify(db: any): Promise<{ success: boolean; count: number; message: string; notes?: string }> {
  try {
    console.log("[StockChecker] Querying Firestore for inventory, products and branches...");
    
    // 1. Fetch branches for branch-name resolution
    const branchesCol = collection(db, "branches");
    const branchesSnap = await getDocs(branchesCol);
    const branchesMap = new Map<string, string>();
    branchesSnap.forEach((doc) => {
      const data = doc.data();
      branchesMap.set(doc.id, data.name || "Default Branch");
    });

    // 2. Fetch products for readable product names & SKU values
    const productsCol = collection(db, "products");
    const productsSnap = await getDocs(productsCol);
    const productsMap = new Map<string, { name: string; sku: string }>();
    productsSnap.forEach((doc) => {
      const data = doc.data();
      productsMap.set(doc.id, {
        name: data.name || "Unnamed Product",
        sku: data.sku || "N/A"
      });
    });

    // 3. Fetch current inventory stock quantities
    const inventoryCol = collection(db, "inventory");
    const inventorySnap = await getDocs(inventoryCol);
    
    // 4. Identify low stock items
    const lowStockItemsByBranch = new Map<string, Array<{ product: string; sku: string; qty: number; limit: number }>>();
    let lowStockTotalCount = 0;

    inventorySnap.forEach((doc) => {
      const item = doc.data() as InventoryItem;
      const quantity = Number(item.quantity ?? 0);
      const reorderLevel = Number(item.reorder_level ?? 5);

      if (quantity <= reorderLevel) {
        const branchName = branchesMap.get(item.branch_id) || `Branch (${item.branch_id?.substring(0, 8)})`;
        const prodData = productsMap.get(item.product_id) || { name: `Product (${item.product_id?.substring(0, 8)})`, sku: "N/A" };

        const list = lowStockItemsByBranch.get(branchName) || [];
        list.push({
          product: prodData.name,
          sku: prodData.sku,
          qty: quantity,
          limit: reorderLevel
        });
        lowStockItemsByBranch.set(branchName, list);
        lowStockTotalCount++;
      }
    });

    if (lowStockTotalCount === 0) {
      console.log("[StockChecker] Verification completed: All inventory items possess healthy stock quantities.");
      return {
        success: true,
        count: 0,
        message: "Stock levels checked. No items are below the defined reorder threshold."
      };
    }

    // 5. Construct highly readable multi-branch WhatsApp message
    let message = `*🚨 Tareza ERP - Low Stock Alert! 🚨*\n\nThe following items have fallen below their defined reorder thresholds:\n\n`;

    lowStockItemsByBranch.forEach((items, branchName) => {
      message += `📍 *Branch: ${branchName}*\n`;
      items.forEach((item) => {
        message += `• *${item.product}* (SKU: \`${item.sku}\`)\n  ⚠️ Current Stock: *${item.qty}* (Reorder: ${item.limit})\n`;
      });
      message += `\n`;
    });

    message += `Please initiate replenishment purchase orders with suppliers immediately to prevent potential stockouts.\n`;
    message += `_Report Generated: ${new Date().toLocaleString()}_`;

    console.log(`[StockChecker] Detected ${lowStockTotalCount} items below threshold. Raising alert over WhatsApp...`);
    const result = await sendWhatsAppNotification(message);

    // Record logs in internal array for developer UI inspection
    notificationAuditLogs.unshift({
      timestamp: new Date().toLocaleString(),
      type: "ticket", // Fits audit view categorization
      channel: "whatsapp",
      recipient: process.env.NOTIFICATION_WHATSAPP_PHONE || "Default WhatsApp Group",
      message: `Low Stock Check failed for ${lowStockTotalCount} items. Dispatched Alert overview.`,
      success: result.success,
      notes: result.notes
    });

    return {
      success: result.success,
      count: lowStockTotalCount,
      message,
      notes: result.notes
    };
  } catch (err: any) {
    console.error("[StockChecker] Critical error running background stock check:", err);
    return {
      success: false,
      count: 0,
      message: `Stock check execution failed: ${err.message || String(err)}`
    };
  }
}

/**
 * Initializes the background scheduled cron-interval running every 12 hours.
 * Also initiates a lightweight startup test 30 seconds after launch for quick verify.
 */
export function initBackgroundStockTracker(db: any) {
  console.log("[StockChecker] Initializing low-stock background checker job...");

  // Startup timer check (triggers after 30 seconds for verification ease, without locking startup process)
  setTimeout(() => {
    console.log("[StockChecker] Executing automated startup inventory analysis...");
    checkLowStockAndNotify(db).catch((err) => {
      console.error("[StockChecker] Startup stock analysis check failed:", err);
    });
  }, 30000);

  // Core scheduled interval ticker (Checks every 12 hours)
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  setInterval(() => {
    console.log("[StockChecker] Starting scheduled 12-hour background stock check cycle...");
    checkLowStockAndNotify(db).catch((err) => {
      console.error("[StockChecker] Background scheduled stock check failed:", err);
    });
  }, TWELVE_HOURS_MS);
}
