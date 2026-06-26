# Tareza ERP - Firestore Schema Structure

This document outlines the schema structure for our Firestore collections, replacing the legacy Supabase SQL schema. While Firestore is a NoSQL, schema-less document database, we maintain structural consistency and type safety using TypeScript interfaces and formal structural blueprints.

---

## Architecture Overview

Tareza ERP is structured with **flat, root-level collections** instead of deep nested subcollections. This design enables fast queries, decoupled data retrieval, and easy pagination. Relationships are established via key references (IDs) embedded within documents.

### Flat vs. Nested Decisions
1. **Root-Level Collections**: All key entities such as `users` (`profiles`), `businesses`, `products`, and `inventory` are top-level collections.
2. **Document References**: Documents store relative parent/associated IDs (e.g., `business_id`, `product_id`, `branch_id`).
3. **Array Embedding (Optional/Small Data)**: Items that are tightly bound to a parent and do not scale infinitely (e.g., individual lines within a `sale` record) are embedded as nested arrays or objects directly inside the document.

---

## Core Collections

The database is built around four primary entities requested for this migration: **Users (Profiles)**, **Businesses**, **Products**, and **Inventory**.

```
  ┌─────────────────┐             ┌──────────────────┐
  │     Profile     │             │     Business     │
  │ (auth.users id) │             │ (org profile)    │
  └────────┬────────┘             └────────┬─────────┘
           │                               │
           │      ┌─────────────────┐      │
           ├─────►│  BusinessUser   │◄─────┤
           │      │ (role & branch) │      │
           │      └─────────────────┘      │
           ▼                               ▼
  ┌─────────────────┐             ┌──────────────────┐
  │      Sale       │             │     Product      │
  │  (transactions) │             │ (catalog item)   │
  └─────────────────┘             └────────┬─────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │    Inventory     │
                                  │ (branch stock)   │
                                  └──────────────────┘
```

---

### 1. Users Collection (`/profiles`)
Tracks user personal accounts, identity, and timestamps. The document ID matches the user's Firebase Authentication UID.

* **Collection Path**: `/profiles/{userId}`
* **Document ID**: `userId` (corresponds to Firebase Auth UID)

#### Schema Definition
| Field | Type | Description | Required |
|:---|:---|:---|:---|
| `id` | `string` | Matches Firebase Authentication user UID | Yes |
| `first_name` | `string` | User's first name | Yes |
| `last_name` | `string` | User's surname | Yes |
| `email` | `string` | Login email address | Yes |
| `phone` | `string` | Optional contact number | No |
| `created_at` | `string` | ISO 8601 creation timestamp | Yes |

#### Sample Document
```json
{
  "id": "u7v9x2K4m1PqZ5w8RtNy3B",
  "first_name": "Tareza",
  "last_name": "F",
  "email": "admin@tareza.co.zw",
  "phone": "+263771122334",
  "created_at": "2026-06-26T06:50:00.000Z"
}
```

---

### 2. Businesses Collection (`/businesses`)
Represents an enterprise organization or tenant inside Tareza ERP. It controls configuration, subscription settings, and billing scopes.

* **Collection Path**: `/businesses/{businessId}`
* **Document ID**: `businessId` (UUID)

#### Schema Definition
| Field | Type | Description | Required |
|:---|:---|:---|:---|
| `id` | `string` | Business tenant identifier | Yes |
| `name` | `string` | Registered trading name | Yes |
| `tax_number` | `string` | Zimra/IRS tax registration number | No |
| `email` | `string` | Corporate billing/contact email | No |
| `phone` | `string` | Contact phone number | No |
| `currency` | `string` | Default transactional currency (e.g., "USD") | No |
| `subscription_plan` | `string` | `"free_trial"`, `"pro"`, or `"enterprise"` | No |
| `subscription_status` | `string` | `"active"`, `"suspended"`, or `"expired"` | No |
| `max_users` | `number` | Allowed user seats quota | No |
| `max_branches` | `number` | Allowed branch locations quota | No |
| `smtp_host` | `string` | Custom SMTP relay hostname | No |
| `smtp_port` | `number` | Custom SMTP relay port | No |
| `smtp_user` | `string` | Custom SMTP username | No |
| `smtp_pass` | `string` | Custom SMTP password (securely handled) | No |
| `created_at` | `string` | ISO 8601 creation timestamp | Yes |
| `updated_at` | `string` | ISO 8601 last update timestamp | No |

#### Sample Document
```json
{
  "id": "b08f4c2e-9d32-4fb2-a5e8-f7b5391a26d4",
  "name": "Tareza Zimbabwe Ltd",
  "tax_number": "100234567",
  "email": "finance@tareza.co.zw",
  "phone": "+263242112233",
  "currency": "USD",
  "subscription_plan": "pro",
  "subscription_status": "active",
  "max_users": 15,
  "max_branches": 5,
  "created_at": "2026-06-25T12:00:00.000Z",
  "updated_at": "2026-06-26T06:45:00.000Z"
}
```

---

### 3. Products Collection (`/products`)
Main product catalog across the organization. It supports stock definitions, multi-price tier lists, and tax classifications.

* **Collection Path**: `/products/{productId}`
* **Document ID**: `productId` (UUID)

#### Schema Definition
| Field | Type | Description | Required |
|:---|:---|:---|:---|
| `id` | `string` | Product SKU or system UUID | Yes |
| `business_id` | `string` | Associated corporate tenant ID | Yes |
| `category_id` | `string` | Reference to `/categories/{id}` | No |
| `name` | `string` | Catalog display name | Yes |
| `description` | `string` | Extended specifications | No |
| `sku` | `string` | Stock Keeping Unit | Yes |
| `barcode` | `string` | Standard barcode representation | No |
| `retail_price` | `number` | Customer counter price | Yes |
| `wholesale_price`| `number` | Bulk business price tier | Yes |
| `cost_price` | `number` | Procurement item unit cost | Yes |
| `tax_class` | `string` | `"standard"`, `"zero"`, or `"exempt"` | Yes |
| `is_active` | `boolean` | Flag to show/hide in POS catalogs | Yes |
| `created_at` | `string` | ISO 8601 creation timestamp | Yes |
| `updated_at` | `string` | ISO 8601 last update timestamp | No |

#### Sample Document
```json
{
  "id": "p729a410-b96e-41a4-82f4-ce117498c4b1",
  "business_id": "b08f4c2e-9d32-4fb2-a5e8-f7b5391a26d4",
  "category_id": "c1384e56-11b2-4dcf-8e39-a9a7dbca0e1a",
  "name": "Paracetamol 500mg Tablets",
  "description": "Oral analgesic and antipyretic medication",
  "sku": "MED-PAR-500",
  "barcode": "6009654123456",
  "retail_price": 4.50,
  "wholesale_price": 3.80,
  "cost_price": 2.10,
  "tax_class": "standard",
  "is_active": true,
  "created_at": "2026-06-25T14:30:00.000Z"
}
```

---

### 4. Inventory Collection (`/inventory`)
Tracks the current physical stock level of a product at a specific branch location.

* **Collection Path**: `/inventory/{inventoryId}`
* **Document ID**: `inventoryId` (UUID, or deterministic ID: `businessId_branchId_productId`)

#### Schema Definition
| Field | Type | Description | Required |
|:---|:---|:---|:---|
| `id` | `string` | Unique identifier for the stock record | Yes |
| `business_id` | `string` | Associated corporate tenant ID | Yes |
| `branch_id` | `string` | Target store/warehouse branch ID | Yes |
| `product_id` | `string` | Reference to `/products/{id}` | Yes |
| `quantity` | `number` | Currently physical counts on hand | Yes |
| `reorder_level` | `number` | Safety threshold triggers notification | Yes |
| `created_at` | `string` | ISO 8601 creation timestamp | Yes |
| `updated_at` | `string` | ISO 8601 inventory update timestamp | Yes |

#### Sample Document
```json
{
  "id": "inv_b08f4c2e_br01_p729a410",
  "business_id": "b08f4c2e-9d32-4fb2-a5e8-f7b5391a26d4",
  "branch_id": "br01-harare-central",
  "product_id": "p729a410-b96e-41a4-82f4-ce117498c4b1",
  "quantity": 1250,
  "reorder_level": 200,
  "created_at": "2026-06-25T14:35:00.000Z",
  "updated_at": "2026-06-26T06:15:22.000Z"
}
```

---

## Indexing & Query Patterns

To optimize NoSQL performance, compound indexes must be built for typical multi-filter queries used in Tareza ERP:

1. **Product Queries (By Business + Active status)**:
   * Fields: `business_id` (Ascending), `is_active` (Ascending)
   * Use-case: Pulls active products for catalog/POS rendering.
2. **Stock Verification (By Business + Branch + Low Stock)**:
   * Fields: `business_id` (Ascending), `branch_id` (Ascending), `quantity` (Ascending)
   * Use-case: Filters out-of-stock or low-stock items at a specific branch.
3. **Audit Ledger Queries**:
   * Fields: `business_id` (Ascending), `created_at` (Descending)
   * Use-case: Orders sales log, cash flow history, or logs with descending date timelines.
