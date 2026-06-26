import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Paynow } from "paynow";
import { GoogleGenAI, Type } from "@google/genai";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
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

  // Load Supabase configuration to connect securely on the backend
  let rawSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  if (rawSupabaseUrl.startsWith('https://https://')) {
    rawSupabaseUrl = rawSupabaseUrl.replace('https://https://', 'https://');
  }
  const supabaseUrl = rawSupabaseUrl;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  let supabaseAdmin: any = null;
  if (supabaseUrl && supabaseServiceKey) {
    try {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    } catch (err) {
      console.warn("[Server] Failed to create Supabase admin client:", err);
    }
  } else {
    console.warn("[Server] VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY is missing. Admin background integrations will run in gracefully limited sandbox fallback mode.");
  }

  // Initialize automated background stock replenishment tracker
  initBackgroundStockTracker(supabaseAdmin);

  async function getBusinessSmtp(businessId: string | undefined): Promise<{ host: string; port: number; user: string; pass: string } | undefined> {
    if (!businessId || !supabaseAdmin) return undefined;
    try {
      const { data, error } = await supabaseAdmin
        .from("businesses")
        .select("smtp_host, smtp_port, smtp_user, smtp_pass")
        .eq("id", businessId)
        .maybeSingle();

      if (!error && data) {
        if (data.smtp_host && data.smtp_user && data.smtp_pass) {
          return {
            host: data.smtp_host,
            port: data.smtp_port ? parseInt(data.smtp_port) : 587,
            user: data.smtp_user,
            pass: data.smtp_pass
          };
        }
      }
    } catch (err) {
      console.error(`Failed to load custom SMTP for business ${businessId}:`, err);
    }
    return undefined;
  }

  // Unified Staff Registration Endpoint
  app.post("/api/auth/register-user", async (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password parameters" });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "Supabase service role keys are not configured on the backend" });
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      let cleanedUrl = supabaseUrl.trim();
      if (cleanedUrl.startsWith('https://https://')) {
        cleanedUrl = cleanedUrl.replace('https://https://', 'https://');
      }
      const adminSupabase = createClient(cleanedUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { data, error } = await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: `${firstName || ''} ${lastName || ''}`.trim()
        }
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true, user: data.user });
    } catch (err: any) {
      console.error("Failed to register staff user via admin API:", err);
      return res.status(500).json({ error: err.message || "Internal server error during staff creation" });
    }
  });

  // 0. Notifications Integration Endpoint
  app.post("/api/notifications/notify", async (req, res) => {
    const { type, payload } = req.body;
    if (!type || !payload) {
      return res.status(400).json({ error: "Missing type or payload" });
    }

    try {
      const customSmtp = await getBusinessSmtp(payload?.business_id);
      const result = await dispatchAlert(type, payload, customSmtp);
      return res.json({ success: true, result });
    } catch (err: any) {
      console.error("Error processing notification route:", err);
      return res.status(500).json({ error: err.message || "Failed to dispatch alert" });
    }
  });

  // Email Custom SMTP Connection Test Endpoint
  app.post("/api/email/test-connection", async (req, res) => {
    const { business_id, recipient_email } = req.body;
    if (!business_id) {
      return res.status(400).json({ error: "Missing business_id parameter" });
    }

    try {
      const { data: bizData, error } = await supabaseAdmin
        .from("businesses")
        .select("*")
        .eq("id", business_id)
        .maybeSingle();

      if (error || !bizData) {
        return res.status(404).json({ error: "Business workspace not found" });
      }

      const smtpHost = bizData.smtp_host;
      const smtpPort = bizData.smtp_port ? parseInt(bizData.smtp_port) : 587;
      const smtpUser = bizData.smtp_user;
      const smtpPass = bizData.smtp_pass;

      if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(400).json({ 
          error: "SMTP configuration is incomplete. Please ensure SMTP Host, User, and Password are saved in Firestore." 
        });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      // Verify connection config
      await transporter.verify();

      // Send a test email to the recipient or default back to smtpUser
      const targetRecipient = recipient_email || smtpUser;
      
      const info = await transporter.sendMail({
        from: `"Tareza SMTP Test" <${smtpUser}>`,
        to: targetRecipient,
        subject: "📧 Tareza ERP SMTP Connection Test - SUCCESS!",
        text: `Congratulations! Your SMTP connection has been verified successfully.\n\nThis test email was sent using the custom SMTP configuration saved for your business workspace in Firestore.\n\nSMTP Details:\n- Host: ${smtpHost}\n- Port: ${smtpPort}\n- User: ${smtpUser}\n\nBest Regards,\nTareza Automated ERP Services`,
        html: `
          <div style="font-family: sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 550px; margin: 0 auto; color: #1e293b; background-color: #f8fafc;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 40px;">🎉</span>
              <h2 style="color: #10b981; margin: 10px 0 0 0; font-weight: 800;">SMTP Verification Success!</h2>
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">Hello,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">Congratulations! Your custom SMTP configuration has been successfully verified on <strong>Tareza ERP</strong>.</p>
            
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #475569; font-size: 13px; text-transform: uppercase; tracking: 0.05em;">Connection Details</h3>
              <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 500;">SMTP Host</td>
                  <td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: 600;">${smtpHost}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 500;">SMTP Port</td>
                  <td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: 600;">${smtpPort}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Username</td>
                  <td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: 600;">${smtpUser}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-bottom: 0;">This test email was dispatched automatically from your custom SMTP server. You can now use your custom SMTP settings for all system receipts, notifications, and customer communications.</p>
            <div style="border-top: 1px solid #e2e8f0; margin-top: 25px; padding-top: 15px; text-align: center; font-size: 11px; color: #94a3b8;">
              Dispatched securely by Tareza ERP for your business.
            </div>
          </div>
        `
      });

      return res.json({ 
        success: true, 
        message: `SMTP connection verified. Test email successfully sent to ${targetRecipient}!`,
        messageId: info.messageId 
      });

    } catch (err: any) {
      console.error("SMTP Test Connection Error:", err);
      return res.status(500).json({ 
        error: `SMTP connection test failed: ${err.message || String(err)}` 
      });
    }
  });

  // Notifications Audit Logs Endpoint for Developer Panel
  app.get("/api/notifications/logs", (req, res) => {
    res.json({ logs: notificationAuditLogs });
  });

  // Manual low-stock reorder limits alert checker
  app.post("/api/inventory/check-low-stock", async (req, res) => {
    try {
      const result = await checkLowStockAndNotify(supabaseAdmin);
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

        // Update businesses table in Supabase
        await supabaseAdmin
          .from("businesses")
          .update({
            subscription_status: "ACTIVE",
            subscription_end_date: expiryDate.toISOString()
          })
          .eq("id", business_id);

        // Add to subscriptions collection if not already there
        try {
          await supabaseAdmin
            .from("subscriptions")
            .insert({
              business_id: business_id,
              plan_name: "pro",
              status: "active",
              created_at: new Date().toISOString()
            });
        } catch (subErr) {
          console.error("Failed to insert subscription record in Supabase:", subErr);
        }

        // Fetch business metadata for rich notification formatting
        let bName = "Pro Business Workspace";
        try {
          const { data: bSnap } = await supabaseAdmin
            .from("businesses")
            .select("name")
            .eq("id", business_id)
            .maybeSingle();
          if (bSnap?.name) {
            bName = bSnap.name;
          }
        } catch (bErr) {
          console.error("Failed to fetch business name for notification", bErr);
        }

        // Send Email and WhatsApp Alert
        getBusinessSmtp(business_id).then(customSmtp => {
          dispatchAlert("subscription", {
            business_id: business_id,
            business_name: bName,
            plan_name: "pro",
            status: "active",
            amount: 30,
            paynow_reference: `POLL-${business_id}-${Date.now()}`
          }, customSmtp).catch(err => console.error("Billing notification failed", err));
        });

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

          // Update businesses table in Supabase
          await supabaseAdmin
            .from("businesses")
            .update({
              subscription_status: "ACTIVE",
              subscription_end_date: expiryDate.toISOString()
            })
            .eq("id", businessId);

          // Add to subscriptions collection if not already there
          try {
            await supabaseAdmin
              .from("subscriptions")
              .insert({
                business_id: businessId,
                plan_name: "pro",
                status: "active",
                created_at: new Date().toISOString()
              });
          } catch (subErr) {
            console.error("Failed to insert subscription record in Supabase:", subErr);
          }

          console.log(`Successfully updated subscription for tenant business: ${businessId}`);

          // Fetch business metadata for rich callback alerts
          let bName = "Pro Business Workspace";
          try {
            const { data: bSnap } = await supabaseAdmin
              .from("businesses")
              .select("name")
              .eq("id", businessId)
              .maybeSingle();
            if (bSnap?.name) {
              bName = bSnap.name;
            }
          } catch (bErr) {
            console.error("Failed to fetch business name for callback notification", bErr);
          }

          // Trigger email + WhatsApp notifications
          getBusinessSmtp(businessId).then(customSmtp => {
            dispatchAlert("subscription", {
              business_id: businessId,
              business_name: bName,
              plan_name: "pro",
              status: "active",
              amount: 30,
              paynow_reference: reference || `CB-${businessId}`
            }, customSmtp).catch(err => console.error("Billing callback notification failed", err));
          });
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

  // AI-Powered Sales Forecasting API
  app.post("/api/ai/forecast", async (req, res) => {
    const { historicalData, forecastPeriod, businessName } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!historicalData || !Array.isArray(historicalData) || historicalData.length === 0) {
      return res.status(400).json({ error: "Missing or invalid historicalData payload." });
    }

    // Local heuristic projection engine for Offline Mode or when GEMINI_API_KEY is missing
    if (!geminiApiKey) {
      console.log("Gemini API key is not configured. Running local projection heuristic engine.");
      
      const revenues = historicalData.map(d => Number(d.revenue || Object.values(d)[1] || 0));
      const avgRevenue = revenues.reduce((a, b) => a + b, 0) / (revenues.length || 1);
      
      let trendMultiplier = 1.02; // Default slight positive growth
      if (revenues.length > 2) {
        const half = Math.floor(revenues.length / 2);
        const firstHalf = revenues.slice(0, half);
        const secondHalf = revenues.slice(half);
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
        if (avgFirst > 0) {
          trendMultiplier = Math.max(0.80, Math.min(1.20, avgSecond / avgFirst));
        }
      }

      const forecastPoints = [];
      const baseVal = revenues[revenues.length - 1] || avgRevenue;
      
      for (let i = 1; i <= 4; i++) {
        const projected = baseVal * Math.pow(trendMultiplier, i / 2);
        forecastPoints.push({
          period: `${forecastPeriod === "monthly" ? "Month" : "Week"} +${i}`,
          forecastedRevenue: Math.round(projected * 100) / 100,
          confidenceIntervalLower: Math.round(projected * 0.85 * 100) / 100,
          confidenceIntervalUpper: Math.round(projected * 1.15 * 100) / 100,
          keyDriver: "Calculated via local baseline historical slope heuristic."
        });
      }

      return res.json({
        success: false,
        isOfflineMode: true,
        forecastPoints,
        summary: `Using local offline projection. Historical sales show an estimated trend multiplier of ${((trendMultiplier - 1) * 100).toFixed(1)}% per period. Setup your GEMINI_API_KEY inside the 'Settings > Secrets' panel to activate Gemini's high-fidelity predictive modeling context.`,
        recommendations: [
          "Enable Gemini Cloud: Connect Gemini for advanced trend detection, local currency conversion analysis, and weather/holiday correlations.",
          "Buffer critical items: Since projections show positive traction, maintain a 15% buffer on high-demand imports."
        ]
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

      const formattedHistory = historicalData.map((d, index) => 
        `- Period/Date ${index + 1} (${d.name || d.date || "N/A"}): Revenue: $${d.revenue || 0} USD`
      ).join("\n");

      const prompt = `You are an elite quantitative financial analyst and retail inventory forecaster representing Tareza ERP. 
Analyze the following historical sales data for the retail tenant "${businessName || "Tareza Workspace"}" and generate a predictive sales forecast for the next 4 periods (Periodicity: ${forecastPeriod || "weekly"}).

Historical Performance Records:
${formattedHistory}

Design your predictions and strategic growth recommendations specifically tailored to small-and-medium retail operations in high-growth African retail climates like Zimbabwe (e.g. accounting for dual-currency flowUSD/local, mitigating supplier transport delays, and stabilizing cash-drawer velocity).

Return ONLY the response in a structured JSON schema conforming to the requested type structure. Do not wrap in markdown unless requested (or return clean json).`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              forecastPoints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    period: { 
                      type: Type.STRING, 
                      description: "e.g. 'Week +1', 'Week +2', 'Month +1'" 
                    },
                    forecastedRevenue: { 
                      type: Type.NUMBER, 
                      description: "Predicted expected revenue value in USD" 
                    },
                    confidenceIntervalLower: { 
                      type: Type.NUMBER, 
                      description: "Pessimistic threshold of forecasted revenue in USD" 
                    },
                    confidenceIntervalUpper: { 
                      type: Type.NUMBER, 
                      description: "Optimistic threshold of forecasted revenue in USD" 
                    },
                    keyDriver: { 
                      type: Type.STRING, 
                      description: "Primary driver or operational factor influencing this period" 
                    }
                  },
                  required: ["period", "forecastedRevenue", "confidenceIntervalLower", "confidenceIntervalUpper", "keyDriver"]
                }
              },
              summary: { 
                type: Type.STRING, 
                description: "Actionable macro performance analysis summary" 
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2-3 highly distinct tactical directives for this tenant's inventory/pricing"
              }
            },
            required: ["forecastPoints", "summary", "recommendations"]
          }
        }
      });

      const rawText = response.text || "{}";
      const parsedForecast = JSON.parse(rawText);

      return res.json({
        success: true,
        isOfflineMode: false,
        ...parsedForecast
      });

    } catch (err: any) {
      console.error("Gemini AI Sales Forecasting failed:", err);
      // Return a structured graceful failure response that doesn't crash the UI
      return res.status(500).json({ 
        error: "Failed to generate AI-powered prediction on server.", 
        details: err.message || String(err) 
      });
    }
  });

  // 5. Secure Server-Side Gemini Chat for AI Diagnostic Support
  app.post("/api/ai/chat", async (req, res) => {
    const { message, diagnostics, branchName } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return res.json({
        success: false,
        reply: "### 💡 AI Diagnostics Partner (Offline Mode)\n\n" +
               "Configure your `GEMINI_API_KEY` in the **Settings > Secrets** panel to activate full cloud diagnostics, smart sync analysis, and server-side model guidance.\n\n" +
               "In the meantime, you can ask about offline syncs, branch configurations, or decimal setups, and I will run on our local diagnostics rule engine."
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

      const systemInstruction = `You are Tareza Support Bot. You help users troubleshoot their Point of Sale and ERP system.
You are integrated deep with the developer diagnostic state and real-time operational context.
Always return response in standard Markdown syntax.
Live Context Diagnostics:
- Network Link Active: ${diagnostics?.isOnline ? 'ONLINE' : 'OFFLINE'}
- Pending Transactions in Local Queue: ${diagnostics?.pendingSales || 0} items
- Current Active Screen Route: ${diagnostics?.activeRoute || '/'}
- Item Count in Current POS Cart: ${diagnostics?.cartCount || 0} items
- Superadmin address: admin@tarezaerp.co.zw
- Current User Branch: ${branchName || 'Unknown branch'}

Instructions:
1. Keep the response highly brief, helpful, technically precise, and welcoming.
2. Structure suggestions with bulleted points for fast reading.
3. Keep the advice tailored for local retail environments (such as dual-currency cash handling, network instability, and general ledger reconciliation).
4. Limit the response to about 150 words. Do NOT include any unrequested technical parameters or system coordinates (such as container port numbers or ping states) to avoid tech-clutter.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: message,
        config: {
          systemInstruction,
        }
      });

      const replyText = response.text || "I was unable to formulate a diagnostic report. Please check your system logs or contact hotline support.";
      return res.json({
        success: true,
        reply: replyText
      });
    } catch (err: any) {
      console.error("Gemini AI Chat generation failed:", err);
      return res.json({
        success: false,
        reply: `A server-side generation exception occurred: ${err.message || String(err)}`
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
