-- ==========================================================
-- TAREZA ERP - COMPLETE DATABASE SCHEMA CREATION SCRIPT
-- Run this in your Supabase SQL Editor FIRST, before applying RLS or seeding data.
-- ==========================================================

-- Enable the UUID extension for automatic primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------
-- 1. BASE INDEPENDENT TABLES
-- --------------------------------------------------

-- Profiles table (stores user core identity linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY, -- links directly to auth.users.id
    first_name text,
    last_name text,
    phone text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Businesses table (Master corporate entity)
CREATE TABLE IF NOT EXISTS public.businesses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    tax_number text,
    email text,
    phone text,
    currency text DEFAULT 'USD' NOT NULL,
    subscription_plan text DEFAULT 'free' NOT NULL,
    subscription_status text DEFAULT 'active' NOT NULL,
    subscription_end_date timestamp with time zone,
    max_users integer DEFAULT 5 NOT NULL,
    max_branches integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- --------------------------------------------------
-- 2. DUAL-KEY / SECONDARY STRUCTURAL TABLES
-- --------------------------------------------------

-- Branches under a business
CREATE TABLE IF NOT EXISTS public.branches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name text NOT NULL,
    address text,
    phone text,
    type text, -- 'retail', 'wholesale', etc.
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Roles defined within the scope of a business
CREATE TABLE IF NOT EXISTS public.roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Specific Permissions matrix per Role
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Business Users Table (Links Users, Businesses, Branches, and Roles)
CREATE TABLE IF NOT EXISTS public.business_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- --------------------------------------------------
-- 3. PRODUCT & INVENTORY TAXONOMY
-- --------------------------------------------------

-- Product categories
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name text NOT NULL,
    parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Customized Taxation Classes / Rates
CREATE TABLE IF NOT EXISTS public.tax_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name text NOT NULL,
    rate numeric(6,2) NOT NULL, -- e.g. 15.00 for 15% VAT
    is_active boolean DEFAULT true NOT NULL
);

-- Products master inventory catalog
CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    sku text,
    barcode text,
    retail_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    wholesale_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    cost_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    price numeric(12,2) DEFAULT 0.00 NOT NULL,
    tax_class text, -- 'standard', 'exempt', 'zeroed'
    tax_rate_id uuid REFERENCES public.tax_rates(id) ON DELETE SET NULL,
    bundles jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Inventory item tracking per branch
CREATE TABLE IF NOT EXISTS public.inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity numeric(12,3) DEFAULT 0.000 NOT NULL,
    reorder_level numeric(12,3) DEFAULT 0.000 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Stock movements ledger details
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    quantity numeric(12,3) NOT NULL,
    type text NOT NULL, -- 'sale', 'receiving', 'transfer', 'adj_plus', 'adj_minus'
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- --------------------------------------------------
-- 4. CRM & SUPPLIERS DIRECTORY
-- --------------------------------------------------

-- Customers database
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text,
    phone text,
    address text,
    vat_number text,
    customer_type text, -- 'individual', 'corporate'
    balance numeric(12,2) DEFAULT 0.00 NOT NULL,
    credit_limit numeric(12,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Suppliers registry
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name text NOT NULL,
    contact_person text,
    email text,
    phone text,
    address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- --------------------------------------------------
-- 5. TRANSACTIONAL LEDGERS (SALES & PURCHASES)
-- --------------------------------------------------

-- Sales/POS checkout receipts ledger
CREATE TABLE IF NOT EXISTS public.sales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    "customerId" text, -- Legacy migration support property
    "customerName" text, -- Legacy support property
    "receiptNumber" text, -- Legacy support property
    items jsonb DEFAULT '[]'::jsonb NOT NULL, -- Inline serialised snapshot of cart items
    payments jsonb DEFAULT '[]'::jsonb NOT NULL, -- Split dynamic payments types list
    subtotal numeric(12,2) DEFAULT 0.00 NOT NULL,
    vat_total numeric(12,2) DEFAULT 0.00 NOT NULL,
    "vatTotal" numeric(12,2) DEFAULT 0.00 NOT NULL, -- Backward support migration mapping
    discount_total numeric(12,2) DEFAULT 0.00 NOT NULL,
    "discountTotal" numeric(12,2) DEFAULT 0.00 NOT NULL, -- Backward support migration mapping
    total numeric(12,2) DEFAULT 0.00 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    total_tax_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    payment_method text,
    status text DEFAULT 'completed' NOT NULL, -- 'completed', 'offline_pending', 'refunded'
    timestamp timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Detailed itemised rows per checkout
CREATE TABLE IF NOT EXISTS public.sale_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    quantity numeric(12,3) NOT NULL,
    price numeric(12,2) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    vat_amount numeric(12,2) DEFAULT 0.00 NOT NULL
);

-- Procurement Buy Orders issued to suppliers
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    status text DEFAULT 'PENDING' NOT NULL, -- 'PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED'
    total_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    po_number text NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_delivery_date date,
    items jsonb DEFAULT '[]'::jsonb NOT NULL, -- Structured rows payload backup config
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Purchase order single rows details
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    quantity numeric(12,3) NOT NULL,
    unit_cost numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL
);

-- Goods Received Notes (GRN) for warehouse checkin from supplier POs
CREATE TABLE IF NOT EXISTS public.goods_received_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    grn_number text NOT NULL,
    received_date timestamp with time zone DEFAULT now() NOT NULL,
    received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Items received inventory mapping rows
CREATE TABLE IF NOT EXISTS public.grn_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id uuid NOT NULL REFERENCES public.goods_received_notes(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    ordered_quantity numeric(12,3) NOT NULL,
    received_quantity numeric(12,3) NOT NULL,
    damaged_quantity numeric(12,3) DEFAULT 0.000 NOT NULL
);

-- Supplier accounting control files sub-ledger
CREATE TABLE IF NOT EXISTS public.supplier_ledgers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    transaction_date timestamp with time zone DEFAULT now() NOT NULL,
    reference text NOT NULL, -- e.g. PO or invoice number
    type text NOT NULL, -- 'INVOICE', 'PAYMENT', 'RETURN'
    debit numeric(12,2) DEFAULT 0.00 NOT NULL,
    credit numeric(12,2) DEFAULT 0.00 NOT NULL,
    balance numeric(12,2) DEFAULT 0.00 NOT NULL
);

-- Supplier payments records
CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    payment_date timestamp with time zone DEFAULT now() NOT NULL,
    amount numeric(12,2) NOT NULL,
    reference text,
    payment_method text NOT NULL
);

-- Supplier returns (damaged goods / writebacks)
CREATE TABLE IF NOT EXISTS public.supplier_returns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    return_date timestamp with time zone DEFAULT now() NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    reason text
);

-- --------------------------------------------------
-- 6. GENERAL ACCOUNTING AND LEDGER ENTRIES
-- --------------------------------------------------

-- Chart of Accounts setup
CREATE TABLE IF NOT EXISTS public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    code text NOT NULL, -- e.g. '1000', '1100'
    name text NOT NULL,
    type text NOT NULL, -- 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'
    balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unique_business_account_code UNIQUE (business_id, code)
);

-- Journal Entries (General Ledger Header)
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    date date NOT NULL,
    reference text,
    description text,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Journal Lines (Double-Entry Debit/Credit Rows)
CREATE TABLE IF NOT EXISTS public.journal_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    debit numeric(15,2) DEFAULT 0.00 NOT NULL,
    credit numeric(15,2) DEFAULT 0.00 NOT NULL,
    description text
);

-- Cash till register sessions controls
CREATE TABLE IF NOT EXISTS public.register_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    opening_balance numeric(12,2) NOT NULL,
    closing_balance numeric(12,2),
    expected_balance numeric(12,2),
    variance numeric(12,2),
    status text DEFAULT 'open' NOT NULL, -- 'open', 'closed'
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    sales_count integer DEFAULT 0,
    sales_total numeric(12,2) DEFAULT 0.00,
    refunds_total numeric(12,2) DEFAULT 0.00,
    payouts_total numeric(12,2) DEFAULT 0.00,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Corporate expenses tracking
CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    category_id uuid, -- links to expense_categories
    amount numeric(12,2) NOT NULL,
    status text DEFAULT 'approved' NOT NULL, -- 'pending', 'approved', 'rejected'
    payment_method text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Corporate expenses category taxonomy helper
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Log records of till drawer payouts or drops
CREATE TABLE IF NOT EXISTS public.cash_drawer_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    amount numeric(12,2) NOT NULL,
    type text NOT NULL, -- 'payout', 'drop', 'opening', 'closing'
    transaction_type text, -- 'expense', 'safe_deposit', etc.
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- --------------------------------------------------
-- 7. FISCAL DEVICES & ZIMRA COMPLIANCE SUPPORT
-- --------------------------------------------------

-- Zimra Fiscalised Receipts status log
CREATE TABLE IF NOT EXISTS public.fiscal_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
    receipt_number text NOT NULL,
    zimra_signature text,
    device_id text,
    fiscal_data jsonb,
    status text DEFAULT 'sent' NOT NULL, -- 'sent', 'queued', 'failed'
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Corporate fiscal terminal device params config
CREATE TABLE IF NOT EXISTS public.fiscal_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    tax_payer_name text NOT NULL,
    vat_number text,
    fiscal_code text,
    device_id text NOT NULL,
    server_url text DEFAULT 'https://api.zimra.co.zw' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- --------------------------------------------------
-- 8. CUSTOMER CREDIT & LOYALTY SUBMODULES
-- --------------------------------------------------

-- Customer line-of-credit accounts
CREATE TABLE IF NOT EXISTS public.customer_credit_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    balance numeric(12,2) DEFAULT 0.00 NOT NULL,
    credit_limit numeric(12,2) DEFAULT 0.00 NOT NULL,
    status text DEFAULT 'active' NOT NULL, -- 'active', 'suspended'
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unique_customer_credit UNIQUE (customer_id)
);

-- Credit account transactions log
CREATE TABLE IF NOT EXISTS public.customer_credit_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_credit_account_id uuid NOT NULL REFERENCES public.customer_credit_accounts(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL, -- positive for charges, negative for payments
    type text NOT NULL, -- 'charge', 'payment', 'writeoff'
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Refunds Ledger header logs
CREATE TABLE IF NOT EXISTS public.refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
    total_refunded numeric(12,2) NOT NULL,
    reason text,
    refund_date timestamp with time zone DEFAULT now() NOT NULL
);

-- Detail itemised refunds rows
CREATE TABLE IF NOT EXISTS public.refund_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
    sale_item_id uuid NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
    quantity numeric(12,3) NOT NULL,
    amount_refunded numeric(12,2) NOT NULL
);

-- Special Customer Specific Pricing Price Overrides
CREATE TABLE IF NOT EXISTS public.price_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    override_price numeric(12,2) NOT NULL,
    start_date date,
    end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Customer CRM activity feed tracking logs
CREATE TABLE IF NOT EXISTS public.customer_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    activity_type text NOT NULL, -- 'visit', 'complaint', 'query', 'support'
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Loyalty campaign card transaction logs
CREATE TABLE IF NOT EXISTS public.customer_loyalty_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    points_earned integer DEFAULT 0 NOT NULL,
    points_redeemed integer DEFAULT 0 NOT NULL,
    transaction_reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Customer communications dispatch tracker logs
CREATE TABLE IF NOT EXISTS public.customer_communications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    type text NOT NULL, -- 'email', 'sms', 'system'
    subject text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- --------------------------------------------------
-- 9. INTER-BRANCH LOGISTICS & WAREHOUSING ADVANCED
-- --------------------------------------------------

-- Advanced product barcode catalog enhancements
CREATE TABLE IF NOT EXISTS public.products_advanced (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    warranty_period text,
    is_serialized boolean DEFAULT false NOT NULL,
    cost_method text DEFAULT 'FIFO' NOT NULL, -- 'FIFO', 'LIFO', 'AVCO'
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Stock warehousing parameters configuration
CREATE TABLE IF NOT EXISTS public.inventory_levels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    min_qty numeric(12,3) DEFAULT 0.000 NOT NULL,
    max_qty numeric(12,3) DEFAULT 100000.000 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Stock transfers header
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    from_branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    to_branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    status text DEFAULT 'PENDING' NOT NULL, -- 'PENDING', 'TRANSIT', 'COMPLETED', 'REJECTED'
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Stocktakes (Physical Inventory Count) Header
CREATE TABLE IF NOT EXISTS public.stocktakes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    status text DEFAULT 'DRAFT' NOT NULL, -- 'DRAFT', 'COMPLETED', 'VOIDED'
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Stocktakes itemized rows
CREATE TABLE IF NOT EXISTS public.stocktake_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stocktake_id uuid NOT NULL REFERENCES public.stocktakes(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    system_qty numeric(12,3) NOT NULL,
    counted_qty numeric(12,3) NOT NULL,
    variance numeric(12,3) NOT NULL,
    notes text
);

-- Dual naming support tables
CREATE TABLE IF NOT EXISTS public.stocktakes_advanced (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    status text DEFAULT 'DRAFT' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Special Customer Relations (CRM) Advanced Data
CREATE TABLE IF NOT EXISTS public.customers_crm (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    loyalty_points integer DEFAULT 0 NOT NULL,
    tier text DEFAULT 'Bronze' NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Suppliers registry advanced options settings
CREATE TABLE IF NOT EXISTS public.suppliers_advanced (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    tax_id text,
    payment_terms text, -- e.g. 'NET30'
    credit_limit numeric(12,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- --------------------------------------------------
-- 10. MULTI-CURRENCY, COMMUNICATIONS & GLOBAL AUX
-- --------------------------------------------------

-- Currency catalog settings
CREATE TABLE IF NOT EXISTS public.currencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    code text NOT NULL, -- e.g. 'USD', 'ZWG', 'ZAR'
    name text NOT NULL,
    symbol text NOT NULL,
    exchange_rate numeric(12,4) DEFAULT 1.0000 NOT NULL, -- relative to business base_currency
    is_base boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Exchange valuation history
CREATE TABLE IF NOT EXISTS public.exchange_rate_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_id uuid NOT NULL REFERENCES public.currencies(id) ON DELETE CASCADE,
    rate numeric(12,4) NOT NULL,
    effective_date timestamp with time zone DEFAULT now() NOT NULL
);

-- Standard payment methods database dictionary
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name text NOT NULL, -- e.g. 'EcoCash', 'Cash (USD)', 'Swipe ZWG'
    code text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Dynamic chat channels (team workspace collaboration)
CREATE TABLE IF NOT EXISTS public.chat_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text DEFAULT 'public' NOT NULL, -- 'public', 'private'
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Chat messages channel entries
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- POS setup preferences configurations
CREATE TABLE IF NOT EXISTS public.pos_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    receipt_header text,
    receipt_footer text,
    tax_inclusive boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Security settings rules
CREATE TABLE IF NOT EXISTS public.security_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    mfa_enabled boolean DEFAULT false NOT NULL,
    session_timeout_minutes integer DEFAULT 60 NOT NULL,
    password_policy text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Notification subscription settings
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    email_alerts boolean DEFAULT true NOT NULL,
    sms_alerts boolean DEFAULT false NOT NULL,
    low_stock_threshold integer DEFAULT 10 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Dynamic corporate notifications feed
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info' NOT NULL, -- 'info', 'warning', 'critical'
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Ledger database backup logging log history
CREATE TABLE IF NOT EXISTS public.backup_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
    filename text NOT NULL,
    timestamp timestamp with time zone DEFAULT now() NOT NULL,
    accounts_count integer DEFAULT 0 NOT NULL,
    journal_entries_count integer DEFAULT 0 NOT NULL,
    journal_lines_count integer DEFAULT 0 NOT NULL,
    register_sessions_count integer DEFAULT 0 NOT NULL,
    audit_logs_count integer DEFAULT 0 NOT NULL,
    size_bytes bigint DEFAULT 0 NOT NULL,
    status text NOT NULL, -- 'SUCCESS', 'FAILED'
    error text
);

-- Legacy mapping support and compatibility
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    plan_name text NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    start_date timestamp with time zone DEFAULT now() NOT NULL,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    purchase_number text NOT NULL,
    status text NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    purchase_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    quantity numeric(12,3) NOT NULL,
    price numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL
);

-- Grant appropriate permissions so that the seeder and client can read and write
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;

-- Complete seeder check block triggers if desired
COMMENT ON SCHEMA public IS 'Tareza ERP Production Database Schema';
