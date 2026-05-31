# ✉️ Custom SMTP & Email Setup: Send Emails From Your Custom Identity

> ⚠️ **CRITICAL WARNING FOR SQL EDITOR USERS:**
> Do **NOT** copy or execute this markdown file (`SUPABASE_SMTP_SETUP.md`) inside your Supabase SQL Editor. Running this file in the editor will result in SQL syntax errors like:
> `ERROR: 42601: syntax error at or near "#"` (caused by markdown `#` headers).
>
> * **If you want to configure your SMTP settings:** Follow **Option 1** or **Option 2** below.
> * **If you want to set up the Automatic Receipt Email trigger in your database:** Copy and execute the contents of the file called **`supabase_email_trigger.sql`** instead.

To ensure that your authentication emails (Signups, Magic Links, Invites, Password Resets) and POS receipts come from **you** (e.g. `tapsforex@gmail.com` or `admin@tarezaerp.co.zw`) instead of being branded as sent by Supabase (`noreply@mail.supabase.co`), you must configure custom SMTP settings.

---

## 🚀 Option 1: Configure Custom SMTP in Supabase Dashboard (Recommended)

Supabase routes all user management emails through their shared SMTP server by default. To make them look like they are coming from your address:

### Step A: Configure Zoho Mail SMTP (e.g. `admin@tarezaerp.co.zw`)
Highly recommended as it provides full custom domain authority branding!

1. Open your **[Supabase Project Dashboard](https://supabase.com/dashboard)**.
2. Navigate to **Project Settings** (gear icon on sidebar) -> **Auth**.
3. Scroll down to the **SMTP Settings** section.
4. Toggle **Enable Custom SMTP** to **ON**.
5. Input the following Zoho parameters:
   - **Sender Name:** `Tareza ERP`
   - **Sender Email:** `admin@tarezaerp.co.zw` (or your Zoho address)
   - **SMTP Provider:** `Custom`
   - **SMTP Host:** `smtp.zoho.com`
   - **Port:** `587` (TLS / STARTTLS)
   - **SMTP Username:** `admin@tarezaerp.co.zw`
   - **SMTP Password:** Your Zoho login password (or App Password if 2FA is active)
6. Tap **Save** to apply!

---

### Step B: Configure Gmail SMTP (e.g. `tapsforex@gmail.com`)
Great for testing, staging, or quickly routing through your primary Google inbox!

1. Go to **Project Settings** -> **Auth** -> **SMTP Settings** in your Supabase Dashboard.
2. Toggle **Enable Custom SMTP** to **ON**.
3. Input the following Gmail configurations:
   - **Sender Name:** `Tareza ERP Support`
   - **Sender Email:** `tapsforex@gmail.com`
   - **SMTP Provider:** `Custom`
   - **SMTP Host:** `smtp.gmail.com`
   - **Port:** `587`
   - **SMTP Username:** `tapsforex@gmail.com`
   - **SMTP Password:** ⚠️ **WARNING:** You **MUST** use a **16-Character App Password**. Your standard Google Account password will fail with connection handshake errors!
4. Tap **Save** to apply!

> ### 🔑 How to Generate a Google App Password:
> 1. Open your **[Google Account Security Dashboard](https://myaccount.google.com/security)**.
> 2. Ensure **2-Step Verification** is turned **ON** (required for App Passwords).
> 3. Search for "App passwords" in the search box or scroll to find it.
> 4. Under "Select app", choose **Other (Custom name)** and enter `Tareza ERP`.
> 5. Click **Generate** and copy the resulting 16-character code (looks like `xxxx xxxx xxxx xxxx`).
> 6. Paste this code directly into the **SMTP Password** field in Supabase.

---

## 💻 Option 2: Programmatic Setup Script

If you prefer applying these settings programmatically using a command line script instead of navigating the Supabase Dashboard UI, we have created a pipeline script under `/scripts/configure_supabase_smtp.js`.

### How to use the Script:
1. Open your terminal in the root directory.
2. Run the programmatic script using your Supabase Personal Management Token and Project Ref ID:
   ```bash
   SUPABASE_TOKEN="sbp_your_personal_access_token" \
   PROJECT_REF="your_project_ref_id" \
   SMTP_HOST="smtp.gmail.com" \
   SMTP_PORT="587" \
   SMTP_USER="tapsforex@gmail.com" \
   SMTP_PASS="your_16_char_app_password" \
   SMTP_SENDER_EMAIL="tapsforex@gmail.com" \
   SMTP_SENDER_NAME="Tareza ERP" \
   node scripts/configure_supabase_smtp.js
   ```

---

## 🧪 Option 3: Local SMTP Connectivity Diagnostic Script

Before loading settings into Supabase, verify your credentials securely in 5 seconds to prevent Auth lockouts or downtime. We have created a diagnostic script in `/scripts/test_smtp_connections.js`.

### To run local test:
1. Edit the config constants inside `/scripts/test_smtp_connections.js` with your SMTP details.
2. Run the script:
   ```bash
   node scripts/test_smtp_connections.js
   ```
3. Check the console logs. It will perform a live handshake, test authentication protocols, send a verification email, and provide diagnostic feedback on failure.

---

## ⚡ Option 4: Deploying Automatic Transactional Receipt Emails (SQL Trigger)

Interested in making **POS system purchases** send email receipts dynamically under your own brand identity? 
We have created a database trigger file `/supabase_email_trigger.sql` that does exactly this.

1. **Deploy the Edge Function** located in `/supabase/functions/send-email`:
   ```bash
   supabase functions deploy send-email
   ```
2. **Execute the Database Trigger Script** inside `/supabase_email_trigger.sql` on your Supabase SQL Editor.
3. Every time a checkout occurs on the POS view on Tareza ERP for a customer, an itemised, branded invoice/receipt is dispatched immediately in the background using your custom SMTP credentials or Resend API key!

---

## ⚠️ Important Production Considerations
* **ZWG / USD Pricing:** The POS receipt will properly display rates in **USD** as your primary base currency.
* **DNS Settings / SPF / DKIM:** If sending from `admin@tarezaerp.co.zw`, ensure you have configured valid **SPF and DKIM records** in your domain registrar DNS settings. If omitted, custom emails may land in your users' spam or junk folder.
* **Gmail Limits:** Gmail SMTP restricts free accounts to 500 email dispatches per 24 hours. For high-volume POS systems, consider a transactional mailer like **Resend.com**, **SendGrid**, or **Postmark**.
