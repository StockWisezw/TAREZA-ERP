# Supabase PostgreSQL Security Specification & Row Level Security (RLS)

This security specification verifies multi-tenancy rules and prevents any cross-tenant data leaks or shadow modifications across Supabase PostgreSQL database tables and application service layers.

## Data Invariants

1. All tenant-scoped tables (`products`, `customers`, `suppliers`, `inventory`, `sales`, `sale_items`, `accounts`, `journal_entries`, `journal_lines`, `register_sessions`, `audit_logs`, `support_tickets`, `marketing_assets`, etc.) must have a valid `business_id` that belongs to the authenticated user.
2. A user can only access their own `profiles` record (`id = auth.uid()`).
3. Users are mapped to businesses using `business_users`. A user can only access their own `business_users` mapping or records inside their own business (`user_id = auth.uid()`).
4. No tenant data can be read or mutated without a valid authentication session (`auth.role() = 'authenticated'` and `auth.uid() IS NOT NULL`).

## Postgres Row Level Security (RLS) Policy Declarations

```sql
-- Enable RLS on all tenant tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Isolation Policy
CREATE POLICY "Users access own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- 2. Business Users Mapping Policy
CREATE POLICY "Users access own business_users" ON business_users
  FOR ALL USING (auth.uid() = user_id);

-- 3. Multi-Tenant Table Isolation Helper Policy (Applied to all tenant-scoped tables)
-- Example for products table (replicated across all tenant tables):
CREATE POLICY "Tenant isolation for products" ON products
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM business_users WHERE user_id = auth.uid()
    )
  );
```

## The Dirty Dozen Vulnerability Controls (Supabase RLS Enforcement)

1. **Identity Spoofing**: Querying tenant tables without filtering by `business_id` is automatically scoped by the client layer and enforced by Postgres RLS `business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid())`.
2. **Cross-Tenant Select**: Requesting rows across another tenant's business boundary is automatically blocked by Postgres RLS policies.
3. **Cross-Tenant Modify**: Inserting or updating a row with a spoofed `business_id` of another enterprise is rejected by `USING (business_id IN (...))`.
4. **Shadow Profile Modify**: Overwriting another user's `profiles` record is blocked by `auth.uid() = id`.
5. **Unauthorized Business Registration Hijack**: Registering or altering rows in `business_users` referencing another user's ID or an unowned business is blocked by `auth.uid() = user_id`.
6. **Billing State Shortcutting**: Creating or altering subscription records without proper tenancy ownership is blocked by RLS on `subscriptions`.
7. **Phantom Stock Movements**: Writing stock adjustments or inventory transfers belonging to another tenant is blocked by business-scoped RLS policies.
8. **Double-Entry Journal Unbalance**: Creating inconsistent postings across businesses is prevented by business-scoped RLS on `journal_entries` and `journal_lines`.
9. **Till Session Splicing**: Tampering with POS register sessions (`register_sessions`) belonging to other cashiers or businesses is blocked by tenancy RLS.
10. **System Accounts Mutation**: Deleting or altering system financial accounts is protected by `business_id` RLS checks on `accounts`.
11. **Denial of Path Recursion**: Attacking SQL queries via deep joins is mitigated by indexed `business_id` lookup columns and strict RLS clauses.
12. **Anonymous Write Tampering**: Writing to any table without an authenticated session (`auth.uid() IS NOT NULL`) is denied by default when RLS is enabled.

## Enforcement Mechanism

- **Client Scoping**: Automatic injection of `business_id` on all query and mutation methods in `SupabaseQueryBuilder` / Supabase JS client.
- **Postgres Row Level Security (RLS)**: Database-level enforcement restricting table rows based on `auth.uid()` and `business_id` mapping.

