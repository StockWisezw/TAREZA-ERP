import nodemailer from "nodemailer";

// Configuration defaults with fallback systems
const TARGET_WHATSAPP_PHONE = process.env.NOTIFICATION_WHATSAPP_PHONE || "263784553570"; // Country code 263 for Zimbabwe as default for 0784553570
const TARGET_EMAIL = process.env.NOTIFICATION_RECEIVER_EMAIL || "admin@tarezaerp.co.zw, sales@tarezaerp.co.zw";

export interface LoggedNotification {
  timestamp: string;
  type: "signup" | "ticket" | "subscription";
  channel: "email" | "whatsapp" | "console";
  recipient: string;
  message: string;
  success: boolean;
  notes?: string;
}

// Global in-memory log cache for auditing alerts directly within the Developer Help Desk or UI
export const notificationAuditLogs: LoggedNotification[] = [];

function formatPhoneForCallmebot(rawPhone: string): string {
  let cleaned = rawPhone.replace(/\D/g, "");
  // If it starts with 07, convert to standard Zimbabwe code +263
  if (cleaned.startsWith("07") && cleaned.length === 10) {
    cleaned = "263" + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Sends a real WhatsApp message using Callmebot or Twilio REST endpoints
 */
export async function sendWhatsAppNotification(message: string): Promise<{ success: boolean; notes: string }> {
  const callmebotApiKey = process.env.CALLMEBOT_API_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM || "+14155238886"; // Default Twilio Sandbox sender

  const phone = formatPhoneForCallmebot(TARGET_WHATSAPP_PHONE);

  // If Callmebot is enabled
  if (callmebotApiKey) {
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${callmebotApiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        return { 
          success: true, 
          notes: `Callmebot response: ${text?.substring(0, 100) || "OK"}` 
        };
      } else {
        throw new Error(`Callmebot API responded with status ${res.status}`);
      }
    } catch (err: any) {
      console.error("[WhatsApp Callmebot Error]", err);
      return { success: false, notes: `Callmebot delivery failed: ${err.message}` };
    }
  }

  // If Twilio is enabled
  if (twilioSid && twilioAuthToken) {
    try {
      const authHeader = "Basic " + Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString("base64");
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      
      const toPhone = phone.startsWith("+") ? phone : `+${phone}`;
      const fromPhone = twilioFrom.startsWith("whatsapp:") ? twilioFrom : `whatsapp:${twilioFrom}`;

      const params = new URLSearchParams();
      params.append("To", `whatsapp:${toPhone}`);
      params.append("From", fromPhone);
      params.append("Body", message);

      const res = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      });

      if (res.ok) {
        const data = await res.json();
        return { 
          success: true, 
          notes: `Twilio delivery success. SID: ${data.sid || "N/A"}` 
        };
      } else {
        const errorText = await res.text();
        throw new Error(`Twilio API responded with status ${res.status}: ${errorText}`);
      }
    } catch (err: any) {
      console.error("[WhatsApp Twilio Error]", err);
      return { success: false, notes: `Twilio delivery failed: ${err.message}` };
    }
  }

  // Fallback simulator for smooth sandboxed deployment
  console.log(`[WhatsApp Simulation] To ${phone}: "${message}"`);
  return { 
    success: true, 
    notes: "Simulation. Set CALLMEBOT_API_KEY or TWILIO_ACCOUNT_SID inside secrets to send live WhatsApp." 
  };
}

/**
 * Sends a real Email notification
 */
export async function sendEmailNotification(
  subject: string, 
  htmlContent: string, 
  plainText: string,
  customSmtp?: { host: string; port: number; user: string; pass: string }
): Promise<{ success: boolean; notes: string }> {
  const smtpHost = customSmtp?.host || process.env.SMTP_HOST;
  const smtpPort = customSmtp?.port !== undefined ? customSmtp.port : (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587);
  const smtpUser = customSmtp?.user || process.env.SMTP_USER;
  const smtpPass = customSmtp?.pass || process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const info = await transporter.sendMail({
        from: `"Tareza ERP Alerts" <${smtpUser}>`,
        to: TARGET_EMAIL,
        subject: subject,
        text: plainText,
        html: htmlContent
      });

      return { 
        success: true, 
        notes: `SMTP delivery successful. MsgID: ${info.messageId}` 
      };
    } catch (err: any) {
      console.error("[SMTP Mailer Error]", err);
      return { success: false, notes: `SMTP failed: ${err.message}` };
    }
  }

  // Mock standard developer setup log
  console.log(`[Email Simulation] To ${TARGET_EMAIL}: "${subject}"`);
  return { 
    success: true, 
    notes: "Simulation. Configure SMTP_HOST, SMTP_USER, SMTP_PASS to send real emails via your own server." 
  };
}

/**
 * Main wrapper dispatching alerts across both WhatsApp and Email
 */
export async function dispatchAlert(
  type: "signup" | "ticket" | "subscription", 
  payload: any,
  customSmtp?: { host: string; port: number; user: string; pass: string }
): Promise<{ email: any; whatsapp: any }> {
  const timestamp = new Date().toLocaleString();
  let emailSubject = "";
  let emailHtml = "";
  let emailText = "";
  let whatsappMsg = "";

  if (type === "signup") {
    const { email, firstName, lastName, businessName, plan } = payload;
    const name = [firstName, lastName].filter(Boolean).join(" ") || "New User";
    const biz = businessName || "N/A";
    const chosenPlan = plan || "Trial Plan";

    emailSubject = `🚀 [Tareza ERP] New User Signup Alert! - ${name}`;
    emailText = `Hello,

A new user register has been completed on Tareza ERP:
- Registered Name: ${name}
- Email Account: ${email}
- Company Workspace: ${biz}
- Choice Plan Option: ${chosenPlan}
- Registration Time: ${timestamp}

Best Regards,
Tareza Automated ERP Monitor`;

    emailHtml = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px; max-width: 600px; margin: 0 auto; color: #18181b;">
        <h2 style="color: #4f46e5; margin-top: 0; font-weight: 800;">🚀 New User Registrations Activation</h2>
        <p style="font-size: 14px; line-height: 1.5; color: #3f3f46;">A brand-new corporate workspace and administrator account have been initialized:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Name</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Email</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-family: monospace;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Business Tenant</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-weight: bold;">${biz}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Package Plan</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">${chosenPlan}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Registered Date</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-family: monospace;">${timestamp}</td>
          </tr>
        </table>
        <p style="font-size: 11px; color: #a1a1aa; margin-top: 25px; border-top: 1px solid #e4e4e7; padding-top: 10px;">This alert is dispatched to tapsforex@gmail.com on Tareza ERP platform activities.</p>
      </div>
    `;

    whatsappMsg = `*Tareza ERP - New Signup Alert!* 🚀\n\n👤 *Name:* ${name}\n📧 *Email:* ${email}\n🏢 *Business:* ${biz}\n📋 *Plan:* ${chosenPlan}\n⏰ *Time:* ${timestamp}`;

  } else if (type === "ticket") {
    const { id, user_email, business_name, subject, category, priority, description } = payload;
    const biz = business_name || "N/A";
    const tickId = id || Math.floor(Math.random() * 90000);

    emailSubject = `🛠️ [Tareza ERP] Support Ticket Generated: #[${tickId}]`;
    emailText = `Hello,

A new help desk support ticket has been created on the system:
- Ticket ID: #${tickId}
- Sender User Email: ${user_email}
- Association Workspace: ${biz}
- Subject Line: ${subject}
- Category: ${category}
- Priority SLA: ${priority}
- Message Details: ${description}
- Raised Date: ${timestamp}

Best Regards,
Tareza Automated Support Ticket Center`;

    emailHtml = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px; max-width: 600px; margin: 0 auto; color: #18181b;">
        <h2 style="color: #ea580c; margin-top: 0; font-weight: 800;">🛠️ Support Help Desk Ticket Opened</h2>
        <p style="font-size: 14px; line-height: 1.5; color: #3f3f46;">A user has submitted a system advisory or technical support report ticket details:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Ticket ID</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-family: monospace; font-weight: bold; color: #ea580c;">#${tickId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">User Account</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-family: monospace;">${user_email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Workspace</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-weight: bold;">${biz}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Subject</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-weight: bold; color: #4f46e5;">${subject}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Priority SLA</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px;"><span style="background: #fef2f2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">${priority}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Category Group</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; text-transform: capitalize;">${category}</td>
          </tr>
        </table>
        <div style="background: #fafafa; border: 1px solid #f4f4f5; padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 13px; line-height: 1.5; color: #52525b;">
          <strong>Description Message:</strong><br/>
          ${description.replace(/\n/g, "<br/>")}
        </div>
        <p style="font-size: 11px; color: #a1a1aa; margin-top: 25px; border-top: 1px solid #e4e4e7; padding-top: 10px;">Submitted securely via developer tools on Tareza Help Center.</p>
      </div>
    `;

    whatsappMsg = `*Tareza ERP - Support Ticket Raised!* 🛠️\n\n🎫 *Ticket ID:* #${tickId}\n📧 *User:* ${user_email}\n🏢 *Business:* ${biz}\n📌 *Subject:* ${subject}\n⚠️ *Priority:* ${priority.toUpperCase()}\n📝 *Desc:* ${description?.substring(0, 160)}${description?.length > 160 ? "..." : ""}\n⏰ *Time:* ${timestamp}`;

  } else if (type === "subscription") {
    const { business_id, business_name, plan_name, status, amount, paynow_reference } = payload;
    const biz = business_name || `Business ID: ${business_id}`;
    const pName = plan_name || "Pro Plan";
    const stat = status || "Active";
    const fee = amount ? `$${amount} USD` : "Varies";
    const ref = paynow_reference || "Direct Gateway Link";

    emailSubject = `💳 [Tareza ERP] Premium Subscription Activation - ${biz}`;
    emailText = `Hello,

A premium subscription action or callback status adjustment has registered:
- Business Entity: ${biz}
- Choice Plan Option: ${pName}
- Billing Status: ${stat}
- Amount Value: ${fee}
- Paynow Transaction Ref: ${ref}
- Time of Action: ${timestamp}

Best Regards,
Tareza Automated Billing Monitor`;

    emailHtml = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px; max-width: 600px; margin: 0 auto; color: #18181b;">
        <h2 style="color: #059669; margin-top: 0; font-weight: 800;">💳 Premium Subscription Event</h2>
        <p style="font-size: 14px; line-height: 1.5; color: #3f3f46;">A user subscription has been registered, extended, or completed successfully:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Corporate Accounts</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-weight: bold;">${biz}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Gateway Plan</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; text-transform: uppercase; font-weight: bold; color: #059669;">${pName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Payment Status</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px;"><span style="background: #ecfdf5; color: #065f46; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">${stat}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">SLA Amount</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-weight: bold;">${fee}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-weight: bold; font-size: 13px; color: #71717a;">Integration Reference</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-family: monospace;">${ref}</td>
          </tr>
        </table>
        <p style="font-size: 11px; color: #a1a1aa; margin-top: 25px; border-top: 1px solid #e4e4e7; padding-top: 10px;">Verified and locked down safely via official Paynow Zimbabwe callbacks.</p>
      </div>
    `;

    whatsappMsg = `*Tareza ERP - Premium Subscription Event!* 💳\n\n🏢 *Business:* ${biz}\n💎 *Plan:* ${pName.toUpperCase()}\n✅ *Status:* ${stat.toUpperCase()}\n💰 *Value:* ${fee}\n🔗 *Gateway Ref:* ${ref}\n⏰ *Time:* ${timestamp}`;
  }

  // Execute both in parallel and swallow fine failures, recording them to internal audit logs array
  const [emailRes, whatsappRes] = await Promise.all([
    sendEmailNotification(emailSubject, emailHtml, emailText, customSmtp),
    sendWhatsAppNotification(whatsappMsg)
  ]);

  // Record logs in internal array for live developer inspection
  notificationAuditLogs.unshift({
    timestamp,
    type,
    channel: "email",
    recipient: TARGET_EMAIL,
    message: emailSubject,
    success: emailRes.success,
    notes: emailRes.notes
  });

  notificationAuditLogs.unshift({
    timestamp,
    type,
    channel: "whatsapp",
    recipient: TARGET_WHATSAPP_PHONE,
    message: whatsappMsg,
    success: whatsappRes.success,
    notes: whatsappRes.notes
  });

  // Keep audit items memory list to last 20 elements
  if (notificationAuditLogs.length > 20) {
    notificationAuditLogs.splice(20);
  }

  return { email: emailRes, whatsapp: whatsappRes };
}
