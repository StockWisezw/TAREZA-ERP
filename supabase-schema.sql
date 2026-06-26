-- ============================================================================
-- TAREZA ERP - SUPABASE POSTGRESQL SCHEMA
-- ============================================================================
-- This schema includes all tables, relationships, indexes, triggers, and RLS
-- policies needed for Tareza ERP. Run this in Supabase SQL Editor.
--
-- CRITICAL: Execute this entire file in one transaction for consistency
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Businesses
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    tax_number TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    currency TEXT DEFAULT 'USD',
    subscription_plan TEXT DEFAULT 'free',
    subscription_status TEXT DEFAULT 'active',
    max_users INTEGER DEFAULT 5,
    max_branches INTEGER DEFAULT 1,
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_user TEXT,
    smtp_pass TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    type TEXT DEFAULT 'retail',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_branch_per_business UNIQUE(business_id, name)
);

-- Profiles (Users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT email_not_empty CHECK (email != '')
);

-- Business Users (Role Assignments)
CREATE TABLE IF NOT EXISTS business_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    role_id TEXT DEFAULT 'staff',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_per_business UNIQUE(business_id, user_id)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_category_name UNIQUE(business_id, name)
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    barcode TEXT,
    retail_price DECIMAL(12, 2) NOT NULL CHECK (retail_price >= 0),
    wholesale_price DECIMAL(12, 2) CHECK (wholesale_price >= 0),
    cost_price DECIMAL(12, 2) CHECK (cost_price >= 0),
    tax_class TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_sku_per_business UNIQUE(business_id, sku)
);

-- ============================================================================
-- INVENTORY TABLES (CRITICAL SECTION)
-- ============================================================================

-- Main Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reorder_level INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_inventory_per_branch UNIQUE(business_id, branch_id, product_id),
    CONSTRAINT positive_quantity CHECK (quantity >= 0)
);

-- Inventory Batches (Tracks batch numbers and expiry dates - CRITICAL FOR COMPLIANCE)
CREATE TABLE IF NOT EXISTS inventory_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    expiry_date DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_batch UNIQUE(business_id, branch_id, product_id, batch_number),
    CONSTRAINT positive_batch_quantity CHECK (quantity >= 0)
);

-- Stock Movement History (Audit Trail)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUST', 'RETURN')),
    quantity_changed INTEGER NOT NULL,
    quantity_before INTEGER,
    quantity_after INTEGER,
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SALES TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    customer_id UUID,
    receipt_number TEXT NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    vat_total DECIMAL(12, 2) DEFAULT 0,
    discount_total DECIMAL(12, 2) DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_receipt UNIQUE(business_id, branch_id, receipt_number),
    CONSTRAINT valid_totals CHECK (total >= 0 AND subtotal >= 0)
);

-- Cash Drawer Logs
CREATE TABLE IF NOT EXISTS cash_drawer_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('opening', 'closing', 'addition', 'removal')),
    transaction_type TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SUPPLIER & PROCUREMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_person TEXT,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    payment_terms TEXT,
    balance DECIMAL(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    tax_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_supplier UNIQUE(business_id, name)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    po_number TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    total_amount DECIMAL(12, 2) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expected_delivery_date DATE,
    items JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_po UNIQUE(business_id, po_number)
);

-- ============================================================================
-- SUPPORT & SETTINGS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    business_name TEXT,
    subject TEXT NOT NULL,
    category TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    description TEXT NOT NULL,
    response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CURRENCY & EXCHANGE RATE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS currencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT,
    exchange_rate DECIMAL(10, 4) NOT NULL DEFAULT 1,
    is_base BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_currency UNIQUE(business_id, code),
    CONSTRAINT positive_rate CHECK (exchange_rate > 0)
);

CREATE TABLE IF NOT EXISTS exchange_rate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    currency_id UUID NOT NULL REFERENCES currencies(id) ON DELETE CASCADE,
    rate DECIMAL(10, 4) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_rate_date UNIQUE(currency_id, effective_date)
);

-- ============================================================================
-- INDEXES (Performance Optimization)
-- ============================================================================

-- Inventory Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_business ON inventory(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(business_id, branch_id) WHERE quantity < reorder_level;

-- Batch Indexes
CREATE INDEX IF NOT EXISTS idx_batch_business ON inventory_batches(business_id);
CREATE INDEX IF NOT EXISTS idx_batch_branch ON inventory_batches(branch_id);
CREATE INDEX IF NOT EXISTS idx_batch_product ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batch_expiry ON inventory_batches(expiry_date);

-- Stock Movement Indexes
CREATE INDEX IF NOT EXISTS idx_movements_business ON stock_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_type ON stock_movements(movement_type);

-- Product Indexes
CREATE INDEX IF NOT EXISTS idx_product_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_product_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_sku ON products(business_id, sku);
CREATE INDEX IF NOT EXISTS idx_product_barcode ON products(business_id, barcode);

-- Sales Indexes
CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(business_id, receipt_number);

-- Other Indexes
CREATE INDEX IF NOT EXISTS idx_branch_business ON branches(business_id);
CREATE INDEX IF NOT EXISTS idx_category_business ON categories(business_id);
CREATE INDEX IF NOT EXISTS idx_supplier_business ON suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_profile_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_business_user_business ON business_users(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_business ON subscriptions(business_id);

-- ============================================================================
-- TRIGGERS & FUNCTIONS (Data Integrity & Audit)
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if user has access to a business (Security Definer to prevent infinite recursion)
CREATE OR REPLACE FUNCTION check_user_in_business(check_user_id UUID, check_business_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM business_users
        WHERE user_id = check_user_id AND business_id = check_business_id
    );
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS inventory_updated_at ON inventory;
CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS inventory_batches_updated_at ON inventory_batches;
CREATE TRIGGER inventory_batches_updated_at BEFORE UPDATE ON inventory_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS businesses_updated_at ON businesses;
CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS support_tickets_updated_at ON support_tickets;
CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INVENTORY VALIDATION TRIGGERS
-- ============================================================================

-- Function: Check inventory quantity doesn't go negative
CREATE OR REPLACE FUNCTION check_inventory_quantity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity < 0 THEN
        RAISE EXCEPTION 'Inventory quantity cannot be negative. Current: %, New: %', 
            OLD.quantity, NEW.quantity;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply inventory quantity check
DROP TRIGGER IF EXISTS inventory_quantity_check ON inventory;
CREATE TRIGGER inventory_quantity_check BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION check_inventory_quantity();

-- Function: Check batch quantity doesn't go negative
CREATE OR REPLACE FUNCTION check_batch_quantity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity < 0 THEN
        RAISE EXCEPTION 'Batch quantity cannot be negative. Batch: %, New Quantity: %',
            NEW.batch_number, NEW.quantity;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply batch quantity check
DROP TRIGGER IF EXISTS batch_quantity_check ON inventory_batches;
CREATE TRIGGER batch_quantity_check BEFORE UPDATE ON inventory_batches
    FOR EACH ROW EXECUTE FUNCTION check_batch_quantity();

-- ============================================================================
-- BATCH EXPIRY VALIDATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_batch_expiry()
RETURNS TRIGGER AS $$
BEGIN
    -- Expiry date must be in the future
    IF NEW.expiry_date < CURRENT_DATE THEN
        RAISE WARNING 'Batch % already expired (Expiry: %)', 
            NEW.batch_number, NEW.expiry_date;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS batch_expiry_validation ON inventory_batches;
CREATE TRIGGER batch_expiry_validation BEFORE INSERT OR UPDATE ON inventory_batches
    FOR EACH ROW EXECUTE FUNCTION validate_batch_expiry();

-- ============================================================================
-- STOCK MOVEMENT TRACKING TRIGGERS
-- ============================================================================

-- Function: Log stock movements (automatically called on inventory changes)
CREATE OR REPLACE FUNCTION log_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO stock_movements (
            business_id, branch_id, product_id, movement_type,
            quantity_changed, quantity_before, quantity_after,
            created_at
        ) VALUES (
            NEW.business_id,
            NEW.branch_id,
            NEW.product_id,
            CASE WHEN NEW.quantity > OLD.quantity THEN 'IN'
                 WHEN NEW.quantity < OLD.quantity THEN 'OUT'
                 ELSE 'ADJUST'
            END,
            NEW.quantity - OLD.quantity,
            OLD.quantity,
            NEW.quantity,
            CURRENT_TIMESTAMP
        );
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO stock_movements (
            business_id, branch_id, product_id, movement_type,
            quantity_changed, quantity_before, quantity_after,
            created_at
        ) VALUES (
            NEW.business_id,
            NEW.branch_id,
            NEW.product_id,
            'IN',
            NEW.quantity,
            0,
            NEW.quantity,
            CURRENT_TIMESTAMP
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_movement_log ON inventory;
CREATE TRIGGER inventory_movement_log AFTER INSERT OR UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION log_inventory_movement();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_drawer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES (Users)
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- BUSINESSES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Authenticated users can insert businesses"
    ON businesses FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view their own businesses"
    ON businesses FOR SELECT
    USING (
        id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own businesses"
    ON businesses FOR UPDATE
    USING (
        id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- BUSINESS USERS POLICIES (Tenancy Links)
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can select their business user links"
    ON business_users FOR SELECT
    USING (
        user_id = auth.uid() OR check_user_in_business(auth.uid(), business_id)
    );

CREATE POLICY "Users can insert their own business user link"
    ON business_users FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their business user links"
    ON business_users FOR UPDATE
    USING (
        user_id = auth.uid() OR check_user_in_business(auth.uid(), business_id)
    );

CREATE POLICY "Users can delete their business user links"
    ON business_users FOR DELETE
    USING (
        user_id = auth.uid() OR check_user_in_business(auth.uid(), business_id)
    );

-- ----------------------------------------------------------------------------
-- SUBSCRIPTIONS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view subscriptions of their business"
    ON subscriptions FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert subscriptions for their business"
    ON subscriptions FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update subscriptions of their business"
    ON subscriptions FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete subscriptions of their business"
    ON subscriptions FOR DELETE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- BRANCHES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view branches of their business"
    ON branches FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert branches for their business"
    ON branches FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update branches of their business"
    ON branches FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete branches of their business"
    ON branches FOR DELETE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- CATEGORIES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view categories of their business"
    ON categories FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert categories for their business"
    ON categories FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update categories of their business"
    ON categories FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete categories of their business"
    ON categories FOR DELETE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- PRODUCTS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view products of their business"
    ON products FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert products in their business"
    ON products FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update products in their business"
    ON products FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete products in their business"
    ON products FOR DELETE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- INVENTORY POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view inventory of their business"
    ON inventory FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert inventory in their business"
    ON inventory FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update inventory of their business"
    ON inventory FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete inventory of their business"
    ON inventory FOR DELETE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- INVENTORY_BATCHES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view batch data of their business"
    ON inventory_batches FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert batch data in their business"
    ON inventory_batches FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update batch data in their business"
    ON inventory_batches FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete batch data in their business"
    ON inventory_batches FOR DELETE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- STOCK_MOVEMENTS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view movement history of their business"
    ON stock_movements FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert movement records in their business"
    ON stock_movements FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update movement records in their business"
    ON stock_movements FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- SALES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view sales in their business"
    ON sales FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert sales in their business"
    ON sales FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update sales in their business"
    ON sales FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- CASH_DRAWER_LOGS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view cash drawer logs"
    ON cash_drawer_logs FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert cash drawer logs"
    ON cash_drawer_logs FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update cash drawer logs"
    ON cash_drawer_logs FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- SUPPLIERS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view suppliers"
    ON suppliers FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert suppliers"
    ON suppliers FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update suppliers"
    ON suppliers FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete suppliers"
    ON suppliers FOR DELETE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- PURCHASE_ORDERS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view purchase orders"
    ON purchase_orders FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert purchase orders"
    ON purchase_orders FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update purchase orders"
    ON purchase_orders FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- SUPPORT_TICKETS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view support tickets"
    ON support_tickets FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert support tickets"
    ON support_tickets FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update support tickets"
    ON support_tickets FOR UPDATE
    USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- CURRENCIES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view currencies"
    ON currencies FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert currencies"
    ON currencies FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update currencies"
    ON currencies FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_users
            WHERE user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- EXCHANGE_RATE_HISTORY POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view exchange rate history"
    ON exchange_rate_history FOR SELECT
    USING (
        currency_id IN (
            SELECT id FROM currencies
            WHERE business_id IN (
                SELECT business_id FROM business_users
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert exchange rate history"
    ON exchange_rate_history FOR INSERT
    WITH CHECK (
        currency_id IN (
            SELECT id FROM currencies
            WHERE business_id IN (
                SELECT business_id FROM business_users
                WHERE user_id = auth.uid()
            )
        )
    );

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Low Stock Products
CREATE OR REPLACE VIEW low_stock_products AS
SELECT
    i.id,
    i.business_id,
    i.branch_id,
    i.product_id,
    p.name as product_name,
    p.sku,
    i.quantity,
    i.reorder_level,
    ROUND((i.quantity::NUMERIC / NULLIF(i.reorder_level, 0)) * 100, 2) as stock_percentage
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE i.quantity <= i.reorder_level;

-- View: Expired Batches
CREATE OR REPLACE VIEW expired_batches AS
SELECT
    ib.id,
    ib.business_id,
    ib.branch_id,
    ib.product_id,
    p.name as product_name,
    ib.batch_number,
    ib.expiry_date,
    ib.quantity,
    CURRENT_DATE - ib.expiry_date as days_expired
FROM inventory_batches ib
JOIN products p ON ib.product_id = p.id
WHERE ib.expiry_date < CURRENT_DATE AND ib.quantity > 0
ORDER BY ib.expiry_date ASC;

-- View: Expiring Soon (within 30 days)
CREATE OR REPLACE VIEW expiring_soon_batches AS
SELECT
    ib.id,
    ib.business_id,
    ib.branch_id,
    ib.product_id,
    p.name as product_name,
    ib.batch_number,
    ib.expiry_date,
    ib.quantity,
    ib.expiry_date - CURRENT_DATE as days_until_expiry
FROM inventory_batches ib
JOIN products p ON ib.product_id = p.id
WHERE ib.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    AND ib.quantity > 0
ORDER BY ib.expiry_date ASC;

-- View: Stock Movement Summary
CREATE OR REPLACE VIEW stock_movement_summary AS
SELECT
    product_id,
    branch_id,
    movement_type,
    COUNT(*) as movement_count,
    SUM(quantity_changed) as total_quantity_changed,
    MIN(created_at) as first_movement,
    MAX(created_at) as last_movement
FROM stock_movements
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY product_id, branch_id, movement_type;

-- ============================================================================
-- SCHEMA INITIALIZATION COMPLETE
-- ============================================================================
