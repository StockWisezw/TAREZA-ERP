# Tareza ERP Design System & UI Architecture

## 1. Design Philosophy
Inspired by Linear, Stripe, and Shopify POS, Tareza ERP employs a "hyper-functional premium" aesthetic.
- **Precision:** Clean borders, subtle shadows, pixel-perfect alignment.
- **Speed:** Instant feedback, keyboard shortcuts for everything, minimal transitions.
- **Clarity:** High contrast data, zero unnecessary UI chrome.
- **Context:** Information density adapting dynamically (spacious on POS touch, compact on inventory tables).

## 2. Typography
- **Primary Font:** **Inter** (Sans-serif) - Used for all UI text, headings, and labels. Readability is paramount.
- **Monospace Font:** **JetBrains Mono** - Used for all financial data (ZWG amounts), barcodes, SKUs, and tabular data to ensure numbers align perfectly vertical.

## 3. Color Palette (Tailwind / shadcn CSS Variables)
A sophisticated monochromatic base with highly intentional accent colors.

**Light Mode:**
- Background: `zinc-50` (`#FAFAFA`)
- Panels/Cards: `white` (`#FFFFFF`)
- Borders: `zinc-200` (`#E4E4E7`)
- Text Primary: `zinc-900` (`#18181B`)
- Text Secondary: `zinc-500` (`#71717A`)
- Primary Brand: `zinc-900` (Inverted)
- Success (Sales/Money): `emerald-600` (`#059669`)
- Warning (Low Stock): `amber-500` (`#F59E0B`)
- Destructive: `red-600` (`#DC2626`)

**Dark Mode:**
- Background: `zinc-950` (`#09090B`)
- Panels/Cards: `zinc-900` (`#18181B`)
- Borders: `zinc-800` (`#27272A`)
- Text Primary: `zinc-50` (`#FAFAFA`)
- Text Secondary: `zinc-400` (`#A1A1AA`)
- Primary Brand: `white`
- Success: `emerald-500`
- Warning: `amber-400`
- Destructive: `red-500`

## 4. Component Hierarchy & Core Layouts

### 4.1. The POS Interface (Optimized for Touch & Speed)
- **Layout:** Split View.
   - **Left Pane (65%):** Product Grid (Touch-friendly 100x100px minimum target size) + Real-time Search input at the top.
   - **Right Pane (35%):** The Active Ticket (Cart). Fixed width, vertically scrollable items list, fixed bottom checkout area.
- **Interactions:**
   - Barcode scans automatically add to the ticket without needing the search input focused.
   - Numpad integration for quick quantity/price overrides.
   - Shortcut keys: `F2` (Search), `Space` (Pay).

### 4.2. Dashboard (Analytics & Insights)
- **Top Bar:** Context Switcher (All Branches vs Specific Branch) and Date Range Picker.
- **KPI Row:** Minimal bento-box cards showing Revenue, Transactions, Avg Basket Size, ZWG Exchange rate reference.
- **Charts:** Area charts for revenue (Recharts with gradient fills).
- **AI Sidebar:** A dedicated column for "Tareza Insights" (Gemini insights) reading real-time trends.

### 4.3. Inventory & Wholesale Pricing UI
- **Layout:** High-density Data Table.
- **Features:**
   - Sticky headers.
   - Dual Pricing Columns: "Retail Price" and "Wholesale Price" (visual distinction).
   - Inline editing for fast stocktake updates.
   - Status badges for stock levels (In Stock, Low, Out).

## 5. Zimbabwe Specific UI Needs
- **Currency Toggle:** Display base currency (USD/ZIG) with an immediate sub-text conversion to the current daily reference rate (ZWG).
- **Tax (VAT):** Clear delineation of VAT vs Exempt items on the POS ticket for ZIMRA compliance.
- **Offline States:** Unmistakable UI banners when offline ("Working Local" badge) and syncing indicators when reconnected.

## 6. Implementation Notes
- Use `@tailwindcss/vite` configuration with CSS variables.
- Employ Radix UI (shadcn) for accessible primitives (Select, Dialog, Tabs).
- Utilize React Router for instantaneous SPA transitions.
