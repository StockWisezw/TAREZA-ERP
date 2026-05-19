-- ==========================================
-- DROPS PREVIOUS TABLES TO PREVENT 'ALREADY EXISTS' ERRORS
-- ==========================================
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS business_users CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS stocktakes CASCADE;
DROP TABLE IF EXISTS stocktake_items CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS purchase_items CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS fiscal_receipts CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS customer_credit_accounts CASCADE;
DROP TABLE IF EXISTS customer_credit_transactions CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS refund_items CASCADE;
DROP TABLE IF EXISTS price_overrides CASCADE;
DROP TABLE IF EXISTS products_advanced CASCADE;
DROP TABLE IF EXISTS inventory_levels CASCADE;
DROP TABLE IF EXISTS inventory_transfers CASCADE;
DROP TABLE IF EXISTS customers_crm CASCADE;
DROP TABLE IF EXISTS customer_activities CASCADE;
DROP TABLE IF EXISTS customer_loyalty_transactions CASCADE;
DROP TABLE IF EXISTS customer_communications CASCADE;
DROP TABLE IF EXISTS suppliers_advanced CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS goods_received_notes CASCADE;
DROP TABLE IF EXISTS grn_items CASCADE;
DROP TABLE IF EXISTS supplier_ledgers CASCADE;
DROP TABLE IF EXISTS supplier_payments CASCADE;
DROP TABLE IF EXISTS supplier_returns CASCADE;
DROP TABLE IF EXISTS currencies CASCADE;
DROP TABLE IF EXISTS tax_rates CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS fiscal_settings CASCADE;
DROP TABLE IF EXISTS chat_channels CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS exchange_rate_history CASCADE;
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS pos_settings CASCADE;
DROP TABLE IF EXISTS security_settings CASCADE;

DROP TYPE IF EXISTS movement_type CASCADE;

DROP FUNCTION IF EXISTS auth_user_businesses() CASCADE;
DROP FUNCTION IF EXISTS trigger_set_timestamp() CASCADE;
DROP FUNCTION IF EXISTS initialize_business_defaults() CASCADE;


-- ==========================================
-- File: 20260513182000_tareza_schema.sql
-- ==========================================

-- Migration: Tareza ERP Initial Schema
-- Description: Complete Multi-tenant SaaS architecture for Cloud POS

-- ==========================================
-- 0. EXTENSIONS & GLOBALS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 1. CORE TENANT MODULES
-- ==========================================

-- Businesses (Tenants)
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    tax_number VARCHAR(100), -- e.g., BP Number for ZIMRA
    email VARCHAR(255),
    phone VARCHAR(50),
    currency VARCHAR(3) DEFAULT 'ZWG',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Branches
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    zimra_device_id VARCHAR(100), -- FDMS Physical/Virtual Device ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ==========================================
-- 2. USER, ROLES & PERMISSIONS
-- ==========================================

-- Profiles (Extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Permissions (JSONB mapping of module -> actions)
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g., {"sales": ["create", "read"], "inventory": ["read"]}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business Users (Junction table linking User to Tenant, Branch, and Role)
CREATE TABLE business_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL, -- NULL means access to all branches
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(business_id, user_id)
);

-- Auth Helper function to get the current user's business IDs for RLS
CREATE OR REPLACE FUNCTION auth_user_businesses()
RETURNS SETOF UUID AS $$
  SELECT business_id FROM public.business_users WHERE user_id = auth.uid() AND deleted_at IS NULL;
$$ LANGUAGE sql STABLE;

-- ==========================================
-- 3. INVENTORY & PRODUCT MANAGEMENT
-- ==========================================

-- Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    retail_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    wholesale_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_class VARCHAR(50) DEFAULT 'standard', -- standard (15%), zero (0%), exempt
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(business_id, barcode),
    UNIQUE(business_id, sku)
);

-- Inventory (Stock tracking per branch)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 4) NOT NULL DEFAULT 0,
    reorder_level DECIMAL(12, 4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(branch_id, product_id)
);

-- Stock Movements (Audit trail for inventory changes)
CREATE TYPE movement_type AS ENUM ('in', 'out', 'transfer', 'adjustment', 'sale', 'return');

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type movement_type NOT NULL,
    quantity DECIMAL(12, 4) NOT NULL, -- positive or negative
    reference_id UUID, -- e.g., sale_id, purchase_id
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stocktakes
CREATE TABLE stocktakes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, in_progress, completed, cancelled
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE stocktake_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stocktake_id UUID NOT NULL REFERENCES stocktakes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    expected_quantity DECIMAL(12, 4) NOT NULL DEFAULT 0,
    counted_quantity DECIMAL(12, 4),
    variance DECIMAL(12, 4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. STAKEHOLDERS (Customers & Suppliers)
-- ==========================================

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    vat_number VARCHAR(100),
    customer_type VARCHAR(50) DEFAULT 'retail', -- retail or wholesale
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ==========================================
-- 5. SALES & POINT OF SALE
-- ==========================================

-- Sales
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    receipt_number VARCHAR(100) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    vat_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL, -- cash, card, ecocash, etc.
    status VARCHAR(50) DEFAULT 'completed', -- completed, voided, refunded
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Sale Items
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity DECIMAL(12, 4) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    vat_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. PURCHASES & EXPENSES
-- ==========================================

-- Purchases
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reference_number VARCHAR(100),
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'received', -- pending, received, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Purchase Items
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity DECIMAL(12, 4) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL, -- e.g., utilities, salaries, transport
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ==========================================
-- 7. FISCALISATION & AUDIT
-- ==========================================

-- Fiscal Receipts (ZIMRA FDMS Integration)
CREATE TABLE fiscal_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    zimra_receipt_signature TEXT,
    zimra_qr_code TEXT,
    request_payload JSONB,
    response_payload JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- pending, transmitted, failed
    transmitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs (Tracking system mutations)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    previous_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 8. SAAS SUBSCRIPTIONS
-- ==========================================

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    plan_name VARCHAR(100) NOT NULL, -- free, basic, premium
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, cancelled, past_due
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 9. TRIGGERS & INDEXES
-- ==========================================

-- Attach updated_at triggers to necessary tables
DO $$ 
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format('
      CREATE TRIGGER set_timestamp_%I
      BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
    ', t, t);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance and isolation
CREATE INDEX idx_branches_business_id ON branches(business_id);
CREATE INDEX idx_roles_business_id ON roles(business_id);
CREATE INDEX idx_business_users_user_id ON business_users(user_id);
CREATE INDEX idx_business_users_business_id ON business_users(business_id);
CREATE INDEX idx_products_business_id ON products(business_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX idx_sales_business_branch ON sales(business_id, branch_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_audit_logs_business_id ON audit_logs(business_id);

-- Soft delete indexes
CREATE INDEX idx_businesses_deleted_at ON businesses(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_deleted_at ON sales(deleted_at) WHERE deleted_at IS NULL;

-- ==========================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tenant-specific tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Base RLS Policy Template (Repeated for each tenant table)
-- Example: Users can only select/insert/update rows where the business_id matches a business they belong to.

-- Businesses
CREATE POLICY "Users can view their own businesses" 
ON businesses FOR SELECT 
USING (id IN (SELECT auth_user_businesses()));

-- Products
CREATE POLICY "Users can view products in their business" 
ON products FOR SELECT 
USING (business_id IN (SELECT auth_user_businesses()) AND deleted_at IS NULL);

CREATE POLICY "Users can insert products in their business" 
ON products FOR INSERT 
WITH CHECK (business_id IN (SELECT auth_user_businesses()));

CREATE POLICY "Users can update products in their business" 
ON products FOR UPDATE 
USING (business_id IN (SELECT auth_user_businesses()));

-- Sales
CREATE POLICY "Users can view sales in their business" 
ON sales FOR SELECT 
USING (business_id IN (SELECT auth_user_businesses()) AND deleted_at IS NULL);

CREATE POLICY "Users can insert sales in their business" 
ON sales FOR INSERT 
WITH CHECK (business_id IN (SELECT auth_user_businesses()));

-- Note: In a true production deployment, you would duplicate these RLS policies for 
-- every table replacing `products` or `sales` with the respective table name, 
-- and tighten permissions based on the user's specific `branch_id` and `role_id` 
-- tracked via the `business_users` table.

-- ==========================================
-- 11. ENABLE REALTIME
-- ==========================================
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE businesses;
ALTER PUBLICATION supabase_realtime ADD TABLE branches;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE sale_items;


-- ==========================================
-- File: 0002_advanced_pos.sql
-- ==========================================

-- Advanced POS Schema
-- Includes Credit Sales, Refunds & Returns, and Auditing

-- Credit Accounts
CREATE TABLE customer_credit_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id), -- Assuming customers table exists
  credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  current_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Transactions / Statements
CREATE TABLE customer_credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES customer_credit_accounts(id),
  sale_id UUID, -- References sales table
  amount DECIMAL(12,2) NOT NULL,
  transaction_type VARCHAR(50) CHECK (transaction_type IN ('CHARGE', 'PAYMENT', 'REFUND')),
  reference VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refunds & Returns
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_sale_id UUID,
  refunded_by UUID REFERENCES auth.users(id),
  authorized_by UUID REFERENCES auth.users(id), -- If manager approval was needed
  total_refunded DECIMAL(12,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE refund_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  refund_id UUID REFERENCES refunds(id),
  product_id UUID,
  quantity INT NOT NULL,
  refund_amount DECIMAL(12,2) NOT NULL,
  return_to_stock BOOLEAN DEFAULT TRUE,
  condition VARCHAR(50) DEFAULT 'GOOD'
);

-- Price Override Audits
CREATE TABLE price_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID,
  product_id UUID,
  original_price DECIMAL(12,2),
  new_price DECIMAL(12,2),
  authorized_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- File: 0003_advanced_inventory.sql
-- ==========================================

-- Advanced Inventory Schema

-- Branches & Warehouses
-- (Redundant CREATE TABLE branches removed. It is created in 20260513182000_tareza_schema.sql and enhanced later)

-- Advanced Products
CREATE TABLE products_advanced (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100) UNIQUE,
  category_id UUID,
  brand_id UUID,
  supplier_id UUID,
  retail_price DECIMAL(12,2) NOT NULL,
  wholesale_price DECIMAL(12,2),
  cost_price DECIMAL(12,2),
  tax_class VARCHAR(50) DEFAULT 'standard',
  uom VARCHAR(50) DEFAULT 'pcs', -- Unit of measure
  reorder_level INT DEFAULT 0,
  min_stock_level INT DEFAULT 0,
  max_stock_level INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory (Stock by Branch)
CREATE TABLE inventory_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products_advanced(id),
  branch_id UUID REFERENCES branches(id),
  quantity INT NOT NULL DEFAULT 0,
  location_bin VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, branch_id)
);

-- Stock Movements (Audit Trail)
CREATE TABLE stock_movements_advanced (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products_advanced(id),
  branch_id UUID REFERENCES branches(id),
  movement_type VARCHAR(50) CHECK (movement_type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'SCRAP', 'RETURN')),
  quantity INT NOT NULL,
  reference_id UUID, -- Sale ID, Transfer ID, etc.
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transfers
CREATE TABLE inventory_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_branch_id UUID REFERENCES branches(id),
  to_branch_id UUID REFERENCES branches(id),
  status VARCHAR(50) CHECK (status IN ('DRAFT', 'PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED')),
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stocktake
CREATE TABLE stocktakes_advanced (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  status VARCHAR(50) CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED')),
  type VARCHAR(50) CHECK (type IN ('FULL', 'PARTIAL', 'CYCLE')),
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);


-- ==========================================
-- File: 0004_advanced_crm.sql
-- ==========================================

-- Advanced Customer Management Schema (CRM)

-- Enhanced Customers Table
CREATE TABLE customers_crm (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) CHECK (type IN ('INDIVIDUAL', 'BUSINESS', 'WHOLESALE')),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  shipping_address TEXT,
  vat_number VARCHAR(100),
  national_id VARCHAR(100),
  credit_limit DECIMAL(12,2) DEFAULT 0.00,
  balance DECIMAL(12,2) DEFAULT 0.00,
  loyalty_points INT DEFAULT 0,
  tier VARCHAR(50) DEFAULT 'STANDARD' CHECK (tier IN ('STANDARD', 'SILVER', 'GOLD', 'VIP', 'WHOLESALE_PARTNER')),
  status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Activity & Notes
CREATE TABLE customer_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers_crm(id),
  activity_type VARCHAR(50) CHECK (activity_type IN ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'PURCHASE', 'PAYMENT', 'SUPPORT')),
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Loyalty Transactions
CREATE TABLE customer_loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers_crm(id),
  points INT NOT NULL,
  transaction_type VARCHAR(50) CHECK (transaction_type IN ('EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTED')),
  reference_id UUID, -- Sale ID or Redemption ID
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Communications Log
CREATE TABLE customer_communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers_crm(id),
  type VARCHAR(50) CHECK (type IN ('SMS', 'WHATSAPP', 'EMAIL')),
  status VARCHAR(50) CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DELIVERED')),
  subject VARCHAR(255),
  message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- File: 0005_advanced_suppliers_procurement.sql
-- ==========================================

-- Advanced Supplier & Procurement Schema

-- Suppliers Table
CREATE TABLE suppliers_advanced (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  alt_phone VARCHAR(50),
  address TEXT,
  tax_number VARCHAR(100),
  bank_details TEXT,
  payment_terms VARCHAR(100), -- e.g., Net 30, COD
  credit_limit DECIMAL(12,2) DEFAULT 0.00,
  balance DECIMAL(12,2) DEFAULT 0.00, -- Outstanding payable balance
  category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED')),
  notes TEXT,
  rating DECIMAL(3,2) DEFAULT 0.00, -- Supplier performance rating 0-5
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Orders (PO)
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number VARCHAR(100) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers_advanced(id),
  branch_id UUID REFERENCES branches(id), -- Receiving branch/warehouse
  status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED')),
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expected_delivery_date TIMESTAMP WITH TIME ZONE,
  subtotal DECIMAL(12,2) DEFAULT 0.00,
  tax_total DECIMAL(12,2) DEFAULT 0.00,
  shipping_cost DECIMAL(12,2) DEFAULT 0.00,
  total_amount DECIMAL(12,2) DEFAULT 0.00,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PO Items
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products_advanced(id),
  quantity_ordered INT NOT NULL DEFAULT 0,
  quantity_received INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5,2) DEFAULT 0.00,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT
);

-- Goods Received Notes (GRN)
CREATE TABLE goods_received_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_number VARCHAR(100) UNIQUE NOT NULL,
  po_id UUID REFERENCES purchase_orders(id),
  supplier_id UUID REFERENCES suppliers_advanced(id),
  branch_id UUID REFERENCES branches(id),
  received_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED', 'DISCREPANCY')),
  supplier_invoice_ref VARCHAR(100),
  received_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GRN Items
CREATE TABLE grn_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_id UUID REFERENCES goods_received_notes(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES purchase_order_items(id),
  product_id UUID REFERENCES products_advanced(id),
  quantity_received INT NOT NULL DEFAULT 0,
  quantity_accepted INT NOT NULL DEFAULT 0,
  quantity_rejected INT NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  batch_number VARCHAR(100),
  expiry_date DATE
);

-- Supplier Ledger (Accounts Payable)
CREATE TABLE supplier_ledgers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers_advanced(id),
  transaction_type VARCHAR(50) CHECK (transaction_type IN ('INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE')),
  reference_id UUID, -- References PO, GRN, or Payment
  reference_number VARCHAR(100), -- Invoice number, Receipt number
  amount DECIMAL(12,2) NOT NULL, -- Positive for Payable (Invoice), Negative for Payment/Credit Note
  balance DECIMAL(12,2) NOT NULL, -- Running balance
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id)
);

-- Supplier Payments
CREATE TABLE supplier_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number VARCHAR(100) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers_advanced(id),
  amount DECIMAL(12,2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_method VARCHAR(50) CHECK (payment_method IN ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'OTHER')),
  payment_source VARCHAR(50) CHECK (payment_source IN ('TILL', 'BANK_ACCOUNT', 'OWNER_INJECTION')),
  reference_number VARCHAR(100), -- Bank ref or receipt number
  status VARCHAR(50) DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id)
);

-- Supplier Returns
CREATE TABLE supplier_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number VARCHAR(100) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers_advanced(id),
  grn_id UUID REFERENCES goods_received_notes(id), -- Optional: Link to specific receipt
  branch_id UUID REFERENCES branches(id),
  status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SHIPPED', 'COMPLETED', 'CANCELLED')),
  total_amount DECIMAL(12,2) DEFAULT 0.00,
  return_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason VARCHAR(255),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- File: 0006_advanced_settings.sql
-- ==========================================

-- 0006_advanced_settings.sql

-- Add some columns to businesses
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS vat_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS company_registration_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS invoice_footer TEXT,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Africa/Harare',
ADD COLUMN IF NOT EXISTS theme_settings JSONB DEFAULT '{"theme": "light", "primaryColor": "#6366f1"}'::jsonb;

-- Currencies
CREATE TABLE IF NOT EXISTS currencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    code VARCHAR(3) NOT NULL, -- USD, ZWG, ZAR
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    exchange_rate DECIMAL(15, 6) NOT NULL DEFAULT 1.0,
    is_base BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alter businesses to reference currencies
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS base_currency_id UUID REFERENCES currencies(id);

-- Tax Rates
CREATE TABLE IF NOT EXISTS tax_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- e.g., VAT Standard, VAT Zero, Exempt
    rate DECIMAL(5, 2) NOT NULL, -- 15.00 for 15%
    type VARCHAR(50) NOT NULL DEFAULT 'percentage', 
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branch enhancements
ALTER TABLE branches
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'retail', -- retail, warehouse, etc
ADD COLUMN IF NOT EXISTS tax_group_id UUID REFERENCES tax_rates(id),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- Cash, EcoCash, Swipe, USD Cash
    type VARCHAR(50) NOT NULL, -- cash, mobile_money, card, etc.
    currency_id UUID REFERENCES currencies(id),
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fiscalisation Settings (ZIMRA)
CREATE TABLE IF NOT EXISTS fiscal_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    provider VARCHAR(50) DEFAULT 'zimra',
    api_url TEXT,
    api_key TEXT,
    cert_path TEXT,
    device_model VARCHAR(100),
    device_serial VARCHAR(100),
    receipt_header TEXT,
    receipt_footer TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id)
);

-- Chat System (Internal Communication)
CREATE TABLE IF NOT EXISTS chat_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) DEFAULT 'public', -- public, private, direct
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);


-- ==========================================
-- File: 0007_subscriptions.sql
-- ==========================================

-- Add Subscription columns to businesses table
ALTER TABLE public.businesses
ADD COLUMN subscription_plan VARCHAR(50) DEFAULT 'TRIAL',
ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'TRIAL',
ADD COLUMN subscription_end_date TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
ADD COLUMN max_users INT DEFAULT 2,
ADD COLUMN max_branches INT DEFAULT 1;

-- To make things easy for superadmin, lets set the existing business to active and unlimited 
-- if they use tapiwagahadza54@gmail.com. We can just set all existing ones to have a grace period just in case.
UPDATE public.businesses
SET subscription_status = 'TRIAL',
    subscription_end_date = NOW() + INTERVAL '7 days';

-- We will also want a generic table for subscription invoices or history later, 
-- but for now these columns on business are sufficient.


-- ==========================================
-- File: 20260515000000_superadmin_bypass.sql
-- ==========================================

-- Setup Superadmin bypass for tapiwagahadza54@gmail.com

CREATE OR REPLACE FUNCTION auth_user_businesses()
RETURNS SETOF UUID AS $$
BEGIN
  IF (auth.jwt() ->> 'email') = 'tapiwagahadza54@gmail.com' THEN
    -- Superadmin gets access to all business IDs
    RETURN QUERY SELECT id FROM public.businesses;
  ELSE
    -- Normal user gets access to their assigned businesses
    RETURN QUERY SELECT business_id FROM public.business_users WHERE user_id = auth.uid() AND deleted_at IS NULL;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;


-- ==========================================
-- File: 20260515200400_tareza_storage.sql
-- ==========================================

-- Storage Buckets Configuration for Tareza ERP

-- Create buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
('tareza-logos', 'tareza-logos', true),
('tareza-product-images', 'tareza-product-images', true),
('tareza-reports', 'tareza-reports', false),
('tareza-receipts', 'tareza-receipts', false),
('tareza-exports', 'tareza-exports', false),
('tareza-documents', 'tareza-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Set up Storage RLS Policies

-- Public access policies for logos and product images
CREATE POLICY "Public_Access_Logos" ON storage.objects
FOR SELECT USING (bucket_id = 'tareza-logos');

CREATE POLICY "Public_Access_Product_Images" ON storage.objects
FOR SELECT USING (bucket_id = 'tareza-product-images');

-- Authenticated upload policies for all buckets
CREATE POLICY "Auth_Insert_Logos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tareza-logos');

CREATE POLICY "Auth_Insert_Product_Images" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tareza-product-images');

CREATE POLICY "Auth_Insert_Reports" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tareza-reports');

CREATE POLICY "Auth_Insert_Receipts" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tareza-receipts');

CREATE POLICY "Auth_Insert_Exports" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tareza-exports');

CREATE POLICY "Auth_Insert_Documents" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tareza-documents');

-- Authenticated update policies for all buckets
CREATE POLICY "Auth_Update_Logos" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'tareza-logos');

CREATE POLICY "Auth_Update_Product_Images" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'tareza-product-images');

CREATE POLICY "Auth_Update_Reports" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'tareza-reports');

CREATE POLICY "Auth_Update_Receipts" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'tareza-receipts');

CREATE POLICY "Auth_Update_Exports" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'tareza-exports');

CREATE POLICY "Auth_Update_Documents" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'tareza-documents');

-- Authenticated read policies for private buckets
CREATE POLICY "Auth_Select_Reports" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'tareza-reports');

CREATE POLICY "Auth_Select_Receipts" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'tareza-receipts');

CREATE POLICY "Auth_Select_Exports" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'tareza-exports');

CREATE POLICY "Auth_Select_Documents" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'tareza-documents');

-- Authenticated delete policies for all buckets
CREATE POLICY "Auth_Delete_Logos" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'tareza-logos');

CREATE POLICY "Auth_Delete_Product_Images" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'tareza-product-images');

CREATE POLICY "Auth_Delete_Reports" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'tareza-reports');

CREATE POLICY "Auth_Delete_Receipts" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'tareza-receipts');

CREATE POLICY "Auth_Delete_Exports" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'tareza-exports');

CREATE POLICY "Auth_Delete_Documents" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'tareza-documents');


-- ==========================================
-- File: 20260516091000_tareza_advanced_configuration.sql
-- ==========================================

-- Migration for deep advanced settings
-- Includes: exchange rates, notification settings, languages, and theme preferences

-- Exchange rates history
CREATE TABLE IF NOT EXISTS exchange_rate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    currency_id UUID NOT NULL REFERENCES currencies(id) ON DELETE CASCADE,
    rate DECIMAL(15, 6) NOT NULL,
    rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Alter profiles to support localization and theme
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'Tareza Gold',
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "in_app": true, "sms": false}'::jsonb;

-- Notifications configuration (business level)
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- e.g., 'low_stock', 'daily_summary', 'new_user'
    channels JSONB NOT NULL DEFAULT '{"in_app": true, "email": false, "sms": false}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, type)
);

-- User Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pos Settings
CREATE TABLE IF NOT EXISTS pos_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    allow_offline BOOLEAN DEFAULT TRUE,
    require_pin_for_discount BOOLEAN DEFAULT FALSE,
    max_discount_percentage DECIMAL(5,2) DEFAULT 100.00,
    receipt_template JSONB DEFAULT '{"show_logo": true, "show_barcode": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id)
);

-- Security Settings
CREATE TABLE IF NOT EXISTS security_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    require_2fa BOOLEAN DEFAULT FALSE,
    session_timeout_minutes INTEGER DEFAULT 120,
    password_expiry_days INTEGER DEFAULT 90,
    allowed_ips TEXT[], 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id)
);

-- Seed defaults function for when a new business is created
CREATE OR REPLACE FUNCTION initialize_business_defaults()
RETURNS TRIGGER AS $$
DECLARE
    usd_id UUID;
    zig_id UUID;
    zar_id UUID;
BEGIN
    -- Only run for new inserts
    
    -- Insert Default Currencies
    INSERT INTO currencies (business_id, code, name, symbol, exchange_rate, is_base)
    VALUES (NEW.id, 'USD', 'US Dollar', '$', 1.0, TRUE)
    RETURNING id INTO usd_id;

    INSERT INTO currencies (business_id, code, name, symbol, exchange_rate, is_base)
    VALUES (NEW.id, 'ZWG', 'Zimbabwe Gold', 'ZiG', 13.56, FALSE)
    RETURNING id INTO zig_id;

    INSERT INTO currencies (business_id, code, name, symbol, exchange_rate, is_base)
    VALUES (NEW.id, 'ZAR', 'South African Rand', 'R', 18.50, FALSE)
    RETURNING id INTO zar_id;

    -- Update Business Base Currency
    UPDATE businesses SET base_currency_id = usd_id WHERE id = NEW.id;

    -- Insert Security Settings
    INSERT INTO security_settings (business_id) VALUES (NEW.id);

    -- Insert Default POS Settings for any existing branches
    INSERT INTO pos_settings (business_id, branch_id)
    SELECT NEW.id, id FROM branches WHERE business_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to businesses
DROP TRIGGER IF EXISTS trg_initialize_business_defaults ON businesses;
CREATE TRIGGER trg_initialize_business_defaults
AFTER INSERT ON businesses
FOR EACH ROW
EXECUTE FUNCTION initialize_business_defaults();

-- RLS
ALTER TABLE exchange_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view exchange rate history" ON exchange_rate_history FOR SELECT USING (
    currency_id IN (SELECT id FROM currencies WHERE business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()))
);

CREATE POLICY "Users can view notification settings" ON notification_settings FOR SELECT USING (
    business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (
    user_id = auth.uid()
);

CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE USING (
    user_id = auth.uid()
);

CREATE POLICY "Users can view pos settings" ON pos_settings FOR SELECT USING (
    business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can view security settings" ON security_settings FOR SELECT USING (
    business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid())
);
