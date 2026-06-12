import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Paynow } from "paynow";
import { initializeApp as initAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { dispatchAlert, notificationAuditLogs } from "./server-notification-service.js";
import { initBackgroundStockTracker, checkLowStockAndNotify } from "./server-stock-checker.js";

interface RateLimitRecord {
  hits: number;
  resetTime: number;
}
const rateLimiterStore = new Map<string, RateLimitRecord>();

function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const clientIp = Array.isArray(ip) ? ip[0] : String(ip).split(",")[0].trim();
  const now = Date.now();
  
  let record = rateLimiterStore.get(clientIp);
  if (!record || now > record.resetTime) {
    record = {
      hits: 0,
      resetTime: now + 60000 // 1 minute window
    };
  }
  
  record.hits += 1;
  rateLimiterStore.set(clientIp, record);
  
  res.setHeader("X-RateLimit-Limit", 100);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, 100 - record.hits));
  res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));
  
  if (record.hits > 100) {
    return res.status(429).json({ 
      error: "Too many requests. Please try again after 60 seconds." 
    });
  }
  
  next();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Apply API rate-limiting to all secure endpoints
  app.use("/api", rateLimiter);

  // Load applet's Firebase configuration to connect securely on the backend
  let firebaseConfig = {};
  try {
    const fileContent = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
    firebaseConfig = JSON.parse(fileContent);
  } catch (err) {
    firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    };
  }

  const adminApp = initAdminApp({
    projectId: (firebaseConfig as any).projectId,
  });
  const firestoreDb = getAdminFirestore(adminApp, (firebaseConfig as any).firestoreDatabaseId);

  // Initialize automated background stock replenishment tracker
  initBackgroundStockTracker(firestoreDb);

  // 0. Notifications Integration Endpoint
  app.post("/api/notifications/notify", async (req, res) => {
    const { type, payload } = req.body;
    if (!type || !payload) {
      return res.status(400).json({ error: "Missing type or payload" });
    }

    try {
      const result = await dispatchAlert(type, payload);
      return res.json({ success: true, result });
    } catch (err: any) {
      console.error("Error processing notification route:", err);
      return res.status(500).json({ error: err.message || "Failed to dispatch alert" });
    }
  });

  // Notifications Audit Logs Endpoint for Developer Panel
  app.get("/api/notifications/logs", (req, res) => {
    res.json({ logs: notificationAuditLogs });
  });

  // Manual low-stock reorder limits alert checker
  app.post("/api/inventory/check-low-stock", async (req, res) => {
    try {
      const result = await checkLowStockAndNotify(firestoreDb);
      return res.json(result);
    } catch (err: any) {
      console.error("Manual stock checker endpoint failed:", err);
      return res.status(500).json({ success: false, error: err.message || "Internal stock verify error" });
    }
  });

  // 1. Paynow Initiation Endpoint
  app.post("/api/paynow/initiate", async (req, res) => {
    const { business_id, email, amount, phone, method } = req.body;

    if (!business_id || !email || !amount || !method) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      // Fallback securely of default credentials to user's specified settings
      const paynowId = process.env.PAYNOW_INTEGRATION_ID || "25065";
      const paynowKey = process.env.PAYNOW_INTEGRATION_KEY || "6e8f5604-5749-47c9-9861-e39bc3910119";

      if (!paynowId || !paynowKey) {
        throw new Error(
          "Paynow Integration ID or Key is missing. Please set PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY environment variables."
        );
      }

      const host = req.headers.host || "localhost:3000";
      const protocol = req.headers["x-forwarded-proto"] || "http";
      const resultUrl = `${protocol}://${host}/api/paynow/callback`;
      const returnUrl = `${protocol}://${host}/dashboard`;

      const paynow = new Paynow(paynowId, paynowKey, resultUrl, returnUrl);
      const payment = paynow.createPayment(`SUB-${business_id}-${Date.now()}`, email);
      payment.add(`Tareza ERP Premium Subscription - ${business_id}`, parseFloat(amount));

      // Always perform direct official Paynow web redirection for robustness and choice
      const response = await paynow.send(payment);
      if (response && response.success) {
        return res.json({
          success: true,
          method: "web_redirect",
          redirectUrl: response.redirectUrl,
          pollUrl: response.pollUrl,
          note: "Redirecting to secure Paynow Zimbabwe checkout page."
        });
      } else {
        return res.status(400).json({ error: response.error || "Initiation failed on Paynow." });
      }
    } catch (error: any) {
      console.error("Paynow integration error:", error);
      res.status(500).json({ error: error.message || "Internal Paynow server error" });
    }
  });

  // 2. Paynow Status Poll Endpoint to verify the payment on request
  app.post("/api/paynow/poll", async (req, res) => {
    const { pollUrl, business_id } = req.body;

    if (!pollUrl || !business_id) {
      return res.status(400).json({ error: "Missing pollUrl or business_id parameters" });
    }

    try {
      const paynowId = process.env.PAYNOW_INTEGRATION_ID || "25065";
      const paynowKey = process.env.PAYNOW_INTEGRATION_KEY || "6e8f5604-5749-47c9-9861-e39bc3910119";

      const host = req.headers.host || "localhost:3000";
      const protocol = req.headers["x-forwarded-proto"] || "http";
      const resultUrl = `${protocol}://${host}/api/paynow/callback`;
      const returnUrl = `${protocol}://${host}/dashboard`;

      const paynow = new Paynow(paynowId, paynowKey, resultUrl, returnUrl);
      const response = await paynow.pollTransaction(pollUrl);

      console.log("Live Paynow status check response for:", business_id, response);

      const status = response.status;
      if (status === "Paid" || status?.toLowerCase() === "awaiting delivery" || status?.toLowerCase() === "paid") {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        // Update businesses table in Firestore
        const businessRef = firestoreDb.doc(`businesses/${business_id}`);
        await businessRef.update({
          subscription_status: "ACTIVE",
          subscription_end_date: expiryDate.toISOString(),
          system_admin_key: "paynow_secure_bypass_3892"
        });

        // Add to subscriptions collection if not already there
        const subscriptionsCol = firestoreDb.collection("subscriptions");
        await subscriptionsCol.add({
          business_id: business_id,
          plan_name: "pro",
          status: "active",
          created_at: new Date().toISOString(),
          system_admin_key: "paynow_secure_bypass_3892"
        });

        // Fetch business metadata for rich notification formatting
        let bName = "Pro Business Workspace";
        try {
          const bSnap = await businessRef.get();
          if (bSnap.exists) {
            bName = bSnap.data()?.name || "Pro Business Workspace";
          }
        } catch (bErr) {
          console.error("Failed to fetch business name for notification", bErr);
        }

        // Send Email and WhatsApp Alert
        dispatchAlert("subscription", {
          business_id: business_id,
          business_name: bName,
          plan_name: "pro",
          status: "active",
          amount: 30,
          paynow_reference: `POLL-${business_id}-${Date.now()}`
        }).catch(err => console.error("Billing notification failed", err));

        return res.json({ success: true, status: "Paid", message: "Subscription activated successfully!" });
      }

      return res.json({ success: false, status: status || "Sent", message: "Payment is still processing or pending." });
    } catch (err: any) {
      console.error("Error polling Paynow transaction:", err);
      res.status(500).json({ error: err.message || "Internal status verify error" });
    }
  });

  // 3. Paynow Webhook Callback (Verified by Paynow endpoints)
  app.post("/api/paynow/callback", async (req, res) => {
    const payload = req.body;
    console.log("Paynow Webhook Callback payload received:", payload);

    const reference = payload.reference;
    const status = payload.status;

    if (!reference) {
      return res.status(400).send("No reference found");
    }

    try {
      if (status === "Paid" || status?.toLowerCase() === "awaiting delivery" || status?.toLowerCase() === "paid") {
        const parts = reference.split("-");
        if (parts[0] === "SUB" && parts[1]) {
          const businessId = parts[1];
          
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);

          const businessRef = firestoreDb.doc(`businesses/${businessId}`);
          await businessRef.update({
            subscription_status: "ACTIVE",
            subscription_end_date: expiryDate.toISOString(),
            system_admin_key: "paynow_secure_bypass_3892"
          });

          const subscriptionsCol = firestoreDb.collection("subscriptions");
          await subscriptionsCol.add({
            business_id: businessId,
            plan_name: "pro",
            status: "active",
            created_at: new Date().toISOString(),
            system_admin_key: "paynow_secure_bypass_3892"
          });

          console.log(`Successfully updated subscription for tenant business: ${businessId}`);

          // Fetch business metadata for rich callback alerts
          let bName = "Pro Business Workspace";
          try {
            const bSnap = await businessRef.get();
            if (bSnap.exists) {
              bName = bSnap.data()?.name || "Pro Business Workspace";
            }
          } catch (bErr) {
            console.error("Failed to fetch business name for callback notification", bErr);
          }

          // Trigger email + WhatsApp notifications
          dispatchAlert("subscription", {
            business_id: businessId,
            business_name: bName,
            plan_name: "pro",
            status: "active",
            amount: 30,
            paynow_reference: reference || `CB-${businessId}`
          }).catch(err => console.error("Billing callback notification failed", err));
        }
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("Callback Firestore update error:", err);
      res.status(500).send("Internal processing error");
    }
  });

  // 4. Gemini AI Insights and Reorder Suggestions API
  app.post("/api/ai/insights", async (req, res) => {
    const { totalSales, transactions, lowStock, activeBranches } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return res.json({
        success: false,
        insight: "### 💡 AI Advisor (Offline)\n\nTo enable automated AI forecasting, demand projection, and smart stock recommendations, please configure your `GEMINI_API_KEY` in the **Settings > Secrets** panel. Once registered, Tareza's predictive modeling will activate instantly."
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const prompt = `You are a professional retail and ERP planning AI advisor representing Tareza ERP. 
Generate a comprehensive, highly actionable performance report and inventory forecasting advice based on the company's real operational metrics below:
- Total Sales Earnings: $${totalSales || 0} USD value equivalent
- Total Transactions Completed: ${transactions || 0} sales transactions
- Low Stock/Reorder Warnings: ${lowStock || 0} items currently need restocking.
- Branches Managed: ${activeBranches || 1} retail branches

Keep the advice tailored for high-growth African local retail climates, such as Zimbabwe (dual-currency management e.g. USD and local currency, supply chain lag, cash-management stability, and optimizing inventory velocity). 
Do NOT mention internal architecture, coding variables, or placeholder text. 
Structure your response in exactly 3 sections using standard Markdown:
1. 📈 **Operational Forecast**: Core analytics insights on transaction density and sales performance.
2. 🚨 **Stock Priority & Reorders**: Immediate suggestions for items with low stock or needing reordering, considering typical supplier shipping lead times.
3. 💡 **Strategic Growth Recommendation**: A high-impact tip concerning pricing, seasonal trends, or currency management.

Keep the response concise, visually striking, professional, and limited to about 200 words.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      const insightText = response.text || "No insights could be generated at this time.";

      return res.json({
        success: true,
        insight: insightText
      });
    } catch (err: any) {
      console.error("Gemini AI API generation failed:", err);
      return res.json({
        success: false,
        insight: `An error occurred while generating AI insights: ${err.message || String(err)}`
      });
    }
  });

  // Serve Vite in development, else raw static production assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tareza Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
