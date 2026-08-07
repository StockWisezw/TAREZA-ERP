# Tareza ERP SaaS Architecture

## 1. System Architecture Overview

Tareza ERP is designed as a modern, multi-tenant Cloud POS and Inventory Management SaaS. 

*   **Frontend:** React + Vite (Single Page Application). Tailored for fast client-side navigation.
*   **Styling:** Tailwind CSS for a premium, accessible design.
*   **Backend & Database:** Supabase (PostgreSQL with Row Level Security and Authentication).
*   **AI Engine:** Google Gemini API for predictive inventory insights and sales forecasting.
*   **Hosting:** Google Cloud Run.

## 2. Multi-tenant & Branch-based Structure

The architecture revolves around a strict hierarchy:
`Tenant (Company)` -> `Branch (Location)` -> `User (Employee)`

To ensure absolute database security and data isolation between companies, we rely on **PostgreSQL Row Level Security (RLS)** policies. Every query and table access is gated to ensure:
1. Users can only read/write records linked to their assigned business (`business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid())`).
2. Sensitive profile details are restricted strictly to authorized sessions (`id = auth.uid()`).

## 3. Database Schema Design (PostgreSQL / Supabase)

### Core Tables:
*   **`profiles`**: User details (first name, last name, phone, email) keyed by user ID.
*   **`businesses`**: Tenant details (name, currency, subscription status, plan settings, max users, max branches).
*   **`branches`**: Branch locations (business reference, name, address, active status).
*   **`roles` & `role_permissions`**: Fine-grained access control mappings for business users.
*   **`business_users`**: Maps users to their specific businesses, branches, and roles.
*   **`categories` & `products`**: Inventory taxonomy and retail/wholesale pricing matrices.
*   **`inventory`**: Stocks tracked per product per branch, with reorder alert thresholds.
*   **`sales` & `sale_items`**: Finalized POS transaction documents, tax records, and payments.
*   **`register_sessions`**: Open/close balances and daily cashier register drawer logs.
*   **`accounts`**, **`journal_entries`**, **`journal_lines`**: Double-entry general ledger.
*   **`audit_logs`**: System audit trail logging all actions.
*   **`marketing_assets`** & **`tutorial_videos`**: Asset management and staff training tutorials.

## 4. Role-Based Access Control (RBAC)

*   **System Admin:** Manages SaaS platform (internal).
*   **Tenant Admin (Owner):** Full access to their company, billing, and global settings.
*   **Branch Manager:** Access to specific branch reporting, inventory adjustments, and POS.
*   **Cashier:** Limited strictly to POS interface and shift reporting for their branch.

## 5. Offline Sync Strategy (Offline-First POS)

Internet reliability in Zimbabwe can fluctuate. The POS must work offline.
*   **Local Caching:** We use IndexedDB (Dexie) and LocalStorage to cache the active product catalog and active branch registers.
*   **Offline Transactions:** When a sale occurs offline, it is saved locally to a pending queue in Dexie.
*   **Background Sync:** `offlineSyncEngine.ts` monitors connectivity and automatically pushes queued mutations when online.
*   **Sync Resolution:** Once online, mutations are pushed to Supabase. Sales records are append-only to prevent historical data loss.

## 6. ZIMRA FDMS Fiscalisation Architecture

*   **Requirement:** ZIMRA requires receipts to be digitally signed and transmitted to their fiscal servers in real-time (or within an allowed offline window).
*   **Flow:** 
    1. Sale is completed on POS.
    2. Node.js backend creates the specific ZIMRA payload.
    3. Payload is securely sent to the ZIMRA FDMS API.
    4. ZIMRA responds with a signature/QR code string.
    5. Receipt is printed locally with the QR code.
*   **Offline Handling:** If offline, the transaction is marked "deferred" and must be transmitted within ZIMRA's allowed grace period once connectivity is restored.

## 7. AI Insights Architecture

*   **Trigger:** On-demand analytical triggers from the administration dashboard.
*   **Data Aggregation:** The client aggregates inventory count and sales velocity metrics.
*   **Gemini AI:** Sends the metrics to a secure backend route proxying Gemini with a contextual prompt ("Act as a Zimbabwe retail analyst...").
*   **Output:** Actionable advice (e.g., "Mazoe Orange Crush velocity increased by 20% due to summer. Suggested reorder: 50 cases.") rendered gracefully in the insights panel.

## 8. Security Considerations

*   **PostgreSQL Row Level Security (RLS)**: The absolute law of the database. Zero client queries can bypass multi-tenant isolation.
*   **Verified Users**: Mandatory authentication session constraints for secure access.
*   **Audit Trails**: Critical cash register activities and financial journal entries are locked once recorded.

## Folder Structure

```
/src
  /components
    /ui          (reusable atomic UI components)
    /pos         (POS specific terminal components)
    /dashboard   (Charts, KPI cards)
  /hooks         (useAuth, useSubscription)
  /lib           (Supabase adapter, offline DB engines)
  /pages         (Route entry points)
  /services      (ZIMRA API, ledgerService, offlineSyncEngine)
  /types         (TypeScript interfaces matching database schema)
```
