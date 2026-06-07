# Firestore Security Specification

This security specification verifies multi-tenancy rules and prevents any cross-tenant leaks or shadow modifications.

## Data Invariants

1. All tenant-scoped documents (products, customers, suppliers, inventory, sales, accounting accounts, journals, etc.) must have a valid `business_id` that belongs to the authenticated user.
2. A user can only access of their own `profiles` document.
3. Users are mapped to businesses using `business_users`. A user can only access their own `business_users` mapping or records inside their own business.
4. No tenant data can be read or mutated without a valid authentication session.

## The Dirty Dozen Payloads (Vulnerability Controls)

1. **Identity Spoofing**: Attempting to query `products` by omitting the `business_id` filter (automatically blocked by query builder and rejected by validation rules unless `business_id` equals the user's mapped business).
2. **Cross-Tenant Select**: Requesting `supabase.from('products').select()` across other businesses' data.
3. **Cross-Tenant Modify**: Inserting a product with a spoofed `business_id` of another enterprise.
4. **Shadow Profile Modify**: Overwriting another user's `profiles` document.
5. **Unauthorized Business Registration Hijack**: Registering a node in `business_users` referencing another user's ID without permission.
6. **Billing State Shortcutting**: Creating or altering a subscription bypass.
7. **Phantom Stock movements**: Writing stock adjustments to a branch belonging to another business ID.
8. **Double-Entry Journal Unbalance**: Creating inconsistent postings.
9. **Till Session Splicing**: Tampering with a POS session belonging to other cashier profiles.
10. **System Accounts Mutation**: Deleting or shifting the system-generated accounts without authorization.
11. **Denial of Wallet Recursion**: Attacking Firestore lookups via massive deep nested path IDs.
12. **Anonymous Write Tampering**: Trying to inject custom system fields or bypassing audit log parameters.

## Enforcement Mechanism

- **Client Scoping**: Automatic injection of `business_id` on all CRUD statements in the legacy wrapper `SupabaseQueryBuilder`.
- **Server Enforcement**: Secure backend-defined Firestore Security Rules that validate matches through relational lookup checks.
