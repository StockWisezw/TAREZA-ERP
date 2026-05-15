# Tareza ERP SaaS Architecture

## 1. System Architecture Overview

Tareza ERP is designed as a modern, multi-tenant Cloud POS and Inventory Management SaaS. 

*   **Frontend:** React 19 + Vite (Single Page Application). Tailored for fast client-side navigation.
*   **Styling:** Tailwind CSS + shadcn/ui for a premium, accessible component library.
*   **Backend & Database:** Supabase (PostgreSQL, Go true-auth, PostgREST APIs).
*   **AI Engine:** Google Gemini API for predictive inventory insights and sales forecasting.
*   **Hosting:** Netlify (target) / Google Cloud Run (preview).

## 2. Multi-tenant & Branch-based Structure

The architecture revolves around a strict hierarchy:
`Tenant (Company)` -> `Branch (Location)` -> `User (Employee)`

To ensure absolute data isolation between companies, we rely on **Supabase Row Level Security (RLS)**. Every core table will have a `tenant_id` column. RLS policies will automatically restrict queries to only return rows where `tenant_id` matches the current authenticated user's assigned tenant.

## 3. Database Schema Design (Supabase / PostgreSQL)

### Core Tables:
*   **`tenants`**: `id`, `name`, `tax_number`, `subscription_tier`, `created_at`
*   **`branches`**: `id`, `tenant_id`, `name`, `location`, `zimra_device_id`
*   **`profiles`** (extends auth.users): `id` (references auth.users), `first_name`, `last_name`
*   **`tenant_users`** (RBAC): `tenant_id`, `user_id`, `branch_id` (optional, null = all branches), `role` (admin, manager, cashier)
*   **`products`**: `id`, `tenant_id`, `barcode`, `name`, `description`, `tax_class`, `base_price`
*   **`inventory`**: `id`, `tenant_id`, `branch_id`, `product_id`, `quantity`, `low_stock_threshold`
*   **`sales`**: `id`, `tenant_id`, `branch_id`, `user_id`, `total_amount`, `vat_amount`, `zimra_receipt_signature`, `status` (completed, synced, offline)
*   **`sale_items`**: `id`, `sale_id`, `product_id`, `quantity`, `unit_price`, `subtotal`
*   **`subscriptions`**: Tracking Stripe/Paynow billing for the SaaS model.

## 4. Role-Based Access Control (RBAC)

Defined in the `tenant_users` table:
*   **System Admin:** Manages SaaS platform (internal).
*   **Tenant Admin (Owner):** Full access to their company, billing, and global settings.
*   **Branch Manager:** Access to specific branch reporting, inventory adjustments, and POS.
*   **Cashier:** Limited strictly to POS interface and shift reporting for their branch.

## 5. Offline Sync Strategy (Offline-First POS)

Internet reliability in Zimbabwe can fluctuate. The POS must work offline.
*   **Local Database:** Use **IndexedDB** (via `Dexie.js` or `WatermelonDB`) to cache the active product catalog and inventory for the specific branch.
*   **Offline Transactions:** When a sale occurs offline, it is saved locally to a `pending_sales` queue.
*   **Service Worker:** A background sync process periodically checks for internet connectivity.
*   **Sync Resolution:** Once online, mutations are pushed to Supabase. Conflicts are resolved favoring the server state, but sales records are append-only to prevent data loss.

## 6. ZIMRA FDMS Fiscalisation Architecture

*   **Requirement:** ZIMRA requires receipts to be digitally signed and transmitted to their fiscal servers in real-time (or within an allowed offline window).
*   **Flow:** 
    1. Sale is completed on POS.
    2. Node.js backend (or Supabase Edge Function) creates the specific XML/JSON payload required by ZIMRA.
    3. Payload is sent to ZIMRA FDMS API.
    4. ZIMRA responds with a signature/QR code string.
    5. Receipt is printed locally with the QR code.
*   **Offline Handling:** If offline, the transaction is marked "deferred" and must be transmitted within ZIMRA's allowed grace period once connectivity is restored.

## 7. AI Insights Architecture

*   **Trigger:** Scheduled CRON jobs (via Supabase pg_cron) or manual dashboard triggers.
*   **Data Aggregation:** A background worker runs SQL aggregations to calculate velocity of sales per item over 7, 30, and 90 days.
*   **Gemini AI:** Sends the aggregated JSON to Gemini 3.1 Pro/Flash with a localized prompt ("Act as a Zimbabwe retail analyst...").
*   **Output:** Actionable advice (e.g., "Mazoe Orange Crush velocity increased by 20% due to summer. Suggested reorder: 50 cases.") stored in an `ai_insights` table for fast dashboard rendering.

## 8. Security Considerations

*   **RLS (Row Level Security):** The absolute law of the database. No API query can bypass tenant isolation.
*   **Audit Logging:** Database triggers automatically log updates and deletes to a `system_audit_logs` table (who, what, when) for compliance.
*   **ZIMRA Compliance:** Ensure tax IDs and signatures are immutable once saved.

## Recommended Folder Structure

```
/src
  /components
    /ui          (shadcn components)
    /pos         (POS specific components)
    /dashboard   (Charts, KPI cards)
  /hooks         (useAuth, useInventory, useOfflineSync)
  /lib           (Supabase client, AI client, utils)
  /pages         (Route entry points)
  /services      (ZIMRA API, Gemini AI wrappers)
  /store         (Zustand or Redux for complex POS local state)
  /types         (TypeScript interfaces matching DB schema)
```
