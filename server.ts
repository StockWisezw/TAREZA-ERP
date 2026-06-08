import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Paynow } from "paynow";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, collection, addDoc } from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  const firebaseApp = initializeApp(firebaseConfig);
  const firestoreDb = getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId);

  // 1. Paynow Initiation Endpoint
  app.post("/api/paynow/initiate", async (req, res) => {
    const { business_id, email, amount, phone, method } = req.body;

    if (!business_id || !email || !amount || !method) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      const paynowId = process.env.PAYNOW_INTEGRATION_ID;
      const paynowKey = process.env.PAYNOW_INTEGRATION_KEY;

      if (!paynowId || !paynowKey) {
        throw new Error(
          "Paynow Integration ID or Key is missing. Please set PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY environment variables in your Vercel Project Settings."
        );
      }

      const host = req.headers.host || "localhost:3000";
      const protocol = req.headers["x-forwarded-proto"] || "http";
      const resultUrl = `${protocol}://${host}/api/paynow/callback`;
      const returnUrl = `${protocol}://${host}/dashboard`;

      const paynow = new Paynow(paynowId, paynowKey, resultUrl, returnUrl);
      const payment = paynow.createPayment(`SUB-${business_id}-${Date.now()}`, email);
      payment.add(`Tareza ERP Premium Subscription - ${business_id}`, parseFloat(amount));

      if (method === "visa") {
        const response = await paynow.send(payment);
        if (response && response.success) {
          return res.json({
            success: true,
            method: "visa",
            redirectUrl: response.redirectUrl,
            pollUrl: response.pollUrl
          });
        } else {
          return res.status(400).json({ error: response.error || "Initiation failed on Paynow." });
        }
      } else {
        const provider = method === "onemoney" ? "onemoney" : "ecocash";
        const response = await paynow.sendMobile(payment, phone, provider);
        
        if (response && response.success) {
          return res.json({
            success: true,
            method: provider,
            status: response.status,
            instructions: response.instructions,
            pollUrl: response.pollUrl
          });
        } else {
          return res.status(400).json({ error: response.error || "Mobile wallet transaction failed to initialize on Paynow." });
        }
      }
    } catch (error: any) {
      console.error("Paynow integration error:", error);
      res.status(500).json({ error: error.message || "Internal Paynow server error" });
    }
  });

  // 2. Paynow Webhook Callback (Verified by Paynow endpoints)
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

          const businessRef = doc(firestoreDb, "businesses", businessId);
          await updateDoc(businessRef, {
            subscription_status: "ACTIVE",
            subscription_end_date: expiryDate.toISOString()
          });

          const subscriptionsCol = collection(firestoreDb, "subscriptions");
          await addDoc(subscriptionsCol, {
            business_id: businessId,
            plan_name: "pro",
            status: "active",
            created_at: new Date().toISOString()
          });

          console.log(`Successfully updated subscription for tenant business: ${businessId}`);
        }
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("Callback Firestore update error:", err);
      res.status(500).send("Internal processing error");
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
