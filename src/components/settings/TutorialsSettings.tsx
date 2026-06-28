import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  BookOpen, 
  Search, 
  HelpCircle, 
  Store, 
  Coins, 
  Package, 
  RefreshCw, 
  TrendingUp, 
  BookOpenCheck,
  ChevronRight,
  Sparkles,
  ArrowRightLeft,
  Warehouse,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  ArrowDownLeft,
  HeartHandshake,
  Play
} from 'lucide-react';

interface TutorialTopic {
  id: string;
  module: 'pos' | 'cash' | 'suppliers' | 'inventory' | 'accounting';
  title: string;
  shortDesc: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  steps: string[];
}

export function TutorialsSettings() {
  const [activeModule, setActiveModule] = useState<'all' | 'pos' | 'cash' | 'suppliers' | 'inventory' | 'accounting'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>('pos-multicurrency');

  // Interactive Double-Entry simulation states
  const [simCostPrice, setSimCostPrice] = useState<number>(100);
  const [simQty, setSimQty] = useState<number>(50);
  const [simAccountType, setSimAccountType] = useState<'cash' | 'payable'>('payable');

  const topics: TutorialTopic[] = [
    {
      id: 'pos-multicurrency',
      module: 'pos',
      title: 'Operating Multi-Currency Sales on the Cash Register',
      shortDesc: 'A guide on handling Zimbabwe’s dual currency environments (USD, ZWG, Rand) simultaneously with correct indices and automatic change calculation.',
      difficulty: 'Beginner',
      duration: '5 Mins',
      steps: [
        'Open the Point of Sale module from the primary side navigation menu.',
        'At the top right of the POS header, check your active Exchange Rate Index (e.g. 1 USD = 25 ZWG). Ensure this index matches current treasury directives.',
        'Select or search products to build the customer’s cart list. Pricing dynamically defaults to your primary corporate currency (usually USD).',
        'When ready to conclude, tap the "Charge / Pay Now" button to open the checkout panel.',
        'Choose the customer’s partial currencies: for example, if their total is $10.00, you can record a payment of $5.00 cash USD and swipe the remaining $5*index = 125 ZWG.',
        'The register dynamically calculates the necessary change in both USD and local coins to protect cashier balances against discrepancy audits.'
      ]
    },
    {
      id: 'pos-offline',
      module: 'pos',
      title: 'Managing Dynamic Off-Grid Sales (PWA & Offline)',
      shortDesc: 'Ring up sales off-the-grid without active internet during Harare load-shedding. Seamless auto-sync as soon as the network backplane restores.',
      difficulty: 'Intermediate',
      duration: '4 Mins',
      steps: [
        'Notice the local Status Badge in the header. If the internet or electricity drops, Tareza ERP smoothly switches into Offline Mode.',
        'Keep scanning items and ringing up local cash sales as normal. All transaction entries are queued securely in the browser’s sandboxed key-value store (Local Storage).',
        'Offline carts allow partial cash payments and print local receipts or generate digital PDF images natively.',
        'Once internet connection or server backplane restores, the Sync Manager icon in the layout starts glowing with an active automatic sync count.',
        'Press the "Sync Now" button or let the server automatically upload the offline queue into the master corporate ledger. The cloud database is updated without double-booking.'
      ]
    },
    {
      id: 'cash-sessions',
      module: 'cash',
      title: 'Cashier Sessions, Opening Float & Payout Auditing',
      shortDesc: 'Ensure rigorous cash controls by auditing register opening floats, tracking petty payouts, and checking supervisor overrides.',
      difficulty: 'Intermediate',
      duration: '6 Mins',
      steps: [
        'Before processing any daily POS sales, the system prompts the cashier to open a session with an "Opening Float" statement.',
        'Specify the starting cash balance in both USD and local currency (ZWG) currently sitting inside the cash register drawer.',
        'To document daily administrative expenses (e.g. buying branch clean fuel or staff tea), use the POS sidebar menu to log a "Petty Cash Payout". Specify the exact amount, reason, and name of recipient.',
        'Any special discount exceeding cashier privileges or manual unit cost changes instantly requests a supervisor’s pin override verification.',
        'At the end of the shift, tap "Proceed to Closing Drawer". Input total physical cash-counts. The ERP calculates differences with detailed discrepancy logs.'
      ]
    },
    {
      id: 'suppliers-grn',
      module: 'suppliers',
      title: 'Receiving Shipments and Clearing Goods (GRNs)',
      shortDesc: 'How to stage goods, match incoming cargo against active Purchase Orders or Standing Agreements, and back-date receipts for stock records.',
      difficulty: 'Intermediate',
      duration: '5 Mins',
      steps: [
        'Navigate to the Suppliers / Goods Receiving module.',
        'Select the corresponding "Pending Purchase Order" to pre-load expected counts, or choose "Standalone GRN" for on-the-spot cash collections.',
        'If products aren’t on the original order, use the "Add Extra/Ad-hoc Products" panel to scan and inject additional arrivals.',
        'Input corresponding Received Quantities, direct Unit Cost Prices, and specific Batch Labels (crucial for expiry control). To protect against duplicate double-entry errors, the system strictly blocks adding duplicate rows — you must edit quantities directly.',
        'Configure the dynamic receiving date (perfect for clearing stock that arrived on historical holidays or over weekend closures).',
        'Tap "Receive Cargo & Clear Stock". This generates a unique GRN reference and posts double-entry stock ledger movements.'
      ]
    },
    {
      id: 'suppliers-reversals',
      module: 'suppliers',
      title: 'Correcting GRN Errors & Processing Stock Reversals',
      shortDesc: 'Handle human errors during goods receiving without deleting transaction records, ensuring pristine database and tax ledger audit trails.',
      difficulty: 'Advanced',
      duration: '7 Mins',
      steps: [
        'If a warehouse assistant mistakenly inputs 100 instead of 10 received items, DO NOT search for manual database deletion keys. System audit trails must remain complete.',
        'Instead, look under the "Recent Goods Receiving History Log" table in the middle of the screen.',
        'Locate the errored GRN record line and press the "Reverse" button on the far right.',
        'A confirmation modal will explain the correction process: a balancing transaction with negative values is posted as an "ADJUSTMENT" to deduct surplus stock and offset Accounts Payable balances.',
        'The original record notes are appended with a warning flag "[REVERSED] [Parent Correction]", and a permanent record is created as a corrective ledger entry.',
        'Both old and new stock states can be traced line-by-line, keeping company VAT or taxation auditors confident.'
      ]
    },
    {
      id: 'inventory-warehouses',
      module: 'inventory',
      title: 'Logical Warehouse Blocks, Reorder Alerts & stock CSVs',
      shortDesc: 'Organize high-performing branch networks with custom stock thresholds, multi-warehouse item movements, and bulk CSV bulk-import actions.',
      difficulty: 'Intermediate',
      duration: '8 Mins',
      steps: [
        'Open the main "Inventory Control" or "Branches & Warehouses" panels.',
        'Define clear physical or logical locations: e.g. "Harare Primary Depot", "Bulawayo Cash Store", or "Damaged Cargo Hold".',
        'Within each product settings panel, configure the "Reorder Level Threshold". If active warehouse shelf counts drop below this level, a dynamic orange Alert sticker appears on the dashboard.',
        'To shift stock from master depots to satellite retail counters, utilize the "Internal Transfer" modal. Select origin, destination, and quantities.',
        'For massive stock take-overs, click "Bulk Assets Upload", download the template spreadsheet file, format columns with SKU, Name, Cost, Price, and active inventory count, then re-upload the CSV to synchronize all branches at once.'
      ]
    },
    {
      id: 'accounting-ledger',
      module: 'accounting',
      title: 'Advanced Accounts: Double-Entry Balanced Bookkeeping',
      shortDesc: 'Peek under the hood to see how inventory arrivals and retail cashier sales feed automated debit/credit General Ledgers in real time.',
      difficulty: 'Advanced',
      duration: '10 Mins',
      steps: [
        'Every single business action within Tareza ERP translates automatically into professional balanced accounting ledger entries.',
        'When you receive cargo via a GRN on credit: the system posts a Debit to "Inventory Assets" (representing stock increases) and a Credit to "Accounts Payable" (representing supplier liability).',
        'When point-of-sale checkout concludes: cash counters post a Debit to "Cash Drawer / Bank Assets" and a Credit to "Sales Revenue". Concurrently, a cost-of-goods-sold entry is fired (Debit "Cost of Goods Sold", Credit "Inventory Assets").',
        'To review corporate financial status, launch "Accounting Journals" to see physical T-accounts, checking that total debits match credits down to the cent.',
        'For business accounts on terms, customer credit ledgers track outstanding balances automatically, updating the moment they settle bills.'
      ]
    }
  ];

  const filteredTopics = topics.filter(t => {
    const matchesModule = activeModule === 'all' || t.module === activeModule;
    const matchesSearch = searchQuery.trim() === '' || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.steps.some(step => step.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesModule && matchesSearch;
  });

  const selectedTopic = topics.find(t => t.id === selectedTopicId);

  // Accounting simulation calculator logic
  const simDebit = simCostPrice * simQty;
  const simCredit = simDebit;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-zinc-900 text-white rounded-3xl shadow-sm border border-zinc-800">
        <div className="space-y-1.5 max-w-2xl">
          <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30 font-bold font-mono text-[10.5px]">
            🎓 ENTERPRISE TRAINING CENTER
          </Badge>
          <h3 className="text-2xl font-black tracking-tight text-white font-sans">
            Tareza ERP Modules Tutorial
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Step-by-step master guides, ledger logic, and interactive simulation dashboards to train managers, accountants, and retail cashiers on Zimbabwean multi-currency operations.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-3 bg-zinc-800 rounded-2xl text-indigo-400 border border-zinc-700">
            <BookOpen className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Grid Layout: Main Search and Topics Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: List of Tutorial Guides */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-5">
          
          {/* SEARCH & FILTER CONTROLS */}
          <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm rounded-2xl">
            <CardContent className="p-4 space-y-4">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                Find Training Topic
              </span>
              
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Type keyword (e.g., float, ZWG, sync, reverse)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 text-xs bg-zinc-50 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-750"
                />
              </div>

              {/* Module Filter buttons */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All Modules' },
                  { id: 'pos', label: 'POS Terminal' },
                  { id: 'cash', label: 'Cash Drawer' },
                  { id: 'suppliers', label: 'Suppliers & GRN' },
                  { id: 'inventory', label: 'Warehouse & Stock' },
                  { id: 'accounting', label: 'Ledger T-Accounts' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveModule(item.id as any)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      activeModule === item.id
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white'
                        : 'bg-transparent text-zinc-650 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-850 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* LIST OF MATCHING TUTORIAL TOPICS */}
          <div className="space-y-3 max-h-[580px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredTopics.map((topic) => {
              const isActive = topic.id === selectedTopicId;
              return (
                <div
                  key={topic.id}
                  onClick={() => setSelectedTopicId(topic.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 text-left ${
                    isActive
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/15 border-indigo-400 dark:border-indigo-900/60 shadow-sm'
                      : 'bg-white dark:bg-zinc-900 border-zinc-250/60 dark:border-zinc-805 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={`text-[9.5px] uppercase font-mono tracking-wider font-extrabold ${
                        topic.module === 'pos' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        topic.module === 'cash' ? 'bg-pink-50 text-pink-700 border-pink-200' :
                        topic.module === 'suppliers' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        topic.module === 'inventory' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {topic.module === 'pos' ? 'POS Register' :
                         topic.module === 'cash' ? 'Cash & sessions' :
                         topic.module === 'suppliers' ? 'Suppliers & PO' :
                         topic.module === 'inventory' ? 'Inventory Shelf' :
                         'Dual Ledger'}
                      </Badge>

                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-semibold font-mono">
                        <span>{topic.difficulty}</span>
                        <span>•</span>
                        <span>{topic.duration}</span>
                      </div>
                    </div>

                    <h4 className={`text-xs font-black tracking-tight leading-snug ${
                      isActive ? 'text-indigo-900 dark:text-indigo-300' : 'text-zinc-900 dark:text-zinc-100'
                    }`}>
                      {topic.title}
                    </h4>
                    <p className="text-[11px] leading-relaxed text-zinc-550 dark:text-zinc-400">
                      {topic.shortDesc}
                    </p>
                  </div>

                  <div className="flex justify-end pt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase select-none">
                      Read Walkthrough <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredTopics.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-450 italic text-xs">
                No tutorial articles found matching your query. Try searching for "sync", "ZWG" or "reversal".
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Walkthrough Details Screen */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-6">
          
          {selectedTopic ? (
            <div className="space-y-6">
              
              {/* PRIMARY CONTENT CARD */}
              <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xl rounded-3xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-zinc-50 to-zinc-100/50 dark:from-zinc-900 dark:to-zinc-850 border-b border-zinc-200/60 dark:border-zinc-800 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-2 text-[10px] bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-extrabold rounded select-none">
                        MODULE {selectedTopic.module.toUpperCase()}
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">Walkthrough Manual</span>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold text-[10.5px] items-center gap-1">
                      <BookOpenCheck className="h-3 w-3" /> Fully Verified
                    </Badge>
                  </div>

                  <CardTitle className="text-lg font-black text-zinc-950 dark:text-zinc-50 leading-tight">
                    {selectedTopic.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-550 dark:text-zinc-400 mt-1 leading-relaxed">
                    {selectedTopic.shortDesc}
                  </CardDescription>
                  {selectedTopic.module && (
                    <div className="mt-4 pt-1 flex justify-start">
                      <Button
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent('start-tour', { 
                              detail: { moduleId: selectedTopic.module } 
                            })
                          );
                        }}
                        className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" /> Launch Interactive Live Tour
                      </Button>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-6 md:p-8 space-y-6">
                  
                  {/* Detailed Step list */}
                  <div className="space-y-5">
                    {selectedTopic.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-4 items-start relative group">
                        
                        {/* Number bullet */}
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 text-[11px] font-black font-mono border border-indigo-500/20 shadow-sm">
                          {idx + 1}
                        </div>
                        
                        {/* Text explanation */}
                        <div className="space-y-1 pt-0.5">
                          <p className="text-[12px] md:text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 font-medium">
                            {step}
                          </p>
                        </div>
                        
                        {/* Connector line */}
                        {idx < selectedTopic.steps.length - 1 && (
                          <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-zinc-150 dark:bg-zinc-800/80 -mb-6" />
                        )}
                      </div>
                    ))}
                  </div>

                </CardContent>
              </Card>

              {/* SPECIAL FEATURE: ACCOUNTING LEDGER SIMULATOR (IF SELECTING GRN/ACCOUNTING TOPICS) */}
              {(selectedTopic.module === 'suppliers' || selectedTopic.module === 'accounting') && (
                <Card className="border border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-3xl overflow-hidden animate-in slide-in-from-bottom duration-300 shadow-sm">
                  <div className="p-4 bg-indigo-500/10 border-b border-indigo-200/40 dark:border-indigo-900/30 flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                      Dynamic Double-Entry Balancing Simulator
                    </span>
                    <Badge variant="outline" className="bg-white dark:bg-zinc-900 text-indigo-700 text-[10px] border-indigo-200/60">
                      Auto-Balancing T-Ledger
                    </Badge>
                  </div>
                  
                  <CardContent className="p-6 space-y-6">
                    <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">
                      This interactive tool demonstrates how a Goods Received Note (GRN) triggers the standard double-entry mechanism. Adjust values below to visualize live debit/credit account balances instantly.
                    </p>

                    {/* Adjustable input bars */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Quantity Received</span>
                        <Input
                          type="number"
                          value={simQty}
                          min="1"
                          onChange={e => setSimQty(Math.max(1, Number(e.target.value)))}
                          className="h-9 bg-white dark:bg-zinc-900 text-xs text-center font-bold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Unit Cost Price ($)</span>
                        <Input
                          type="number"
                          value={simCostPrice}
                          min="0.01"
                          step="0.01"
                          onChange={e => setSimCostPrice(Math.max(0.01, Number(e.target.value)))}
                          className="h-9 bg-white dark:bg-zinc-900 text-xs text-center font-bold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Funding Method</span>
                        <div className="flex gap-1 h-9">
                          <button
                            onClick={() => setSimAccountType('payable')}
                            className={`flex-1 text-[11px] font-bold rounded-lg border cursor-pointer transition-all ${
                              simAccountType === 'payable'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            Credit Terms (AP)
                          </button>
                          <button
                            onClick={() => setSimAccountType('cash')}
                            className={`flex-1 text-[11px] font-bold rounded-lg border cursor-pointer transition-all ${
                              simAccountType === 'cash'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            Cash Pur. (Bank)
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* LIVE ACCOUNT T-POSTS DEMORATION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-inner">
                      
                      {/* Left: DEBIT T-Account */}
                      <div className="border border-zinc-200 rounded-xl overflow-hidden">
                        <div className="bg-emerald-500/10 p-2 border-b text-center font-black text-emerald-800 dark:text-emerald-400 text-xs">
                          DEBIT: Inventory Assets (+ A)
                        </div>
                        <div className="p-3 text-center space-y-1 bg-zinc-50/50 dark:bg-zinc-950/20">
                          <span className="text-[10px] text-zinc-450 uppercase font-mono block">Product stock added to warehouse</span>
                          <span className="text-lg font-black text-emerald-600 font-mono">
                            +${simDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Right: CREDIT T-Account */}
                      <div className="border border-zinc-200 rounded-xl overflow-hidden">
                        <div className="bg-rose-500/10 p-2 border-b text-center font-black text-rose-800 dark:text-rose-400 text-xs">
                          CREDIT: {simAccountType === 'payable' ? 'Accounts Payable (+ L)' : 'Cash / Bank Assets (- A)'}
                        </div>
                        <div className="p-3 text-center space-y-1 bg-zinc-50/50 dark:bg-zinc-950/20">
                          <span className="text-[10px] text-zinc-450 uppercase font-mono block">
                            {simAccountType === 'payable' ? 'Pending due supplier liability balance' : 'Cash disbursed instantly from register'}
                          </span>
                          <span className="text-lg font-black text-rose-600 font-mono">
                            {simAccountType === 'payable' ? '+' : '-'}${simCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                    </div>

                    <div className="flex items-center gap-2.5 bg-zinc-150/40 p-2 px-3 rounded-lg text-[11px] text-zinc-500 border border-zinc-250/20">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Ledger Balance Confirmed: <strong>Debit (${simDebit.toFixed(2)}) == Credit (${simCredit.toFixed(2)})</strong>. Double-entry validation audit status is perfectly green.</span>
                    </div>

                  </CardContent>
                </Card>
              )}

              {/* QUICK ACCORDION: FREQUENT LOCAL TROUBLESHOOTING FAQ */}
              <Card className="border border-zinc-205 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 rounded-3xl shadow-sm">
                <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-805">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-450 flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-zinc-400" />
                    Frequent Operational Questions (Zimbabwe ERP Tips)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <div className="space-y-1">
                    <h5 className="font-bold text-zinc-900 dark:text-zinc-100">❓ How do I handle ZWG swipe payments alongside hard cash USD?</h5>
                    <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      In the checkout modal, enter the exact physical bill amount of USD supplied. Next to the ZWG row, specify the swipe/Ecocash amount currently authorized. The ERP calculates index-weighted change in USD automatically.
                    </p>
                  </div>
                  <div className="space-y-1 border-t border-zinc-100 dark:border-zinc-805 pt-3">
                    <h5 className="font-bold text-zinc-900 dark:text-zinc-100">❓ Can multiple registers operates within the same branch location?</h5>
                    <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Yes! Create separate Cashier Terminal IDs in the POS Setup console. Each cashier session maintains separate float locks, but draws down from the centralized logical inventory levels of that branch warehouse.
                    </p>
                  </div>
                  <div className="space-y-1 border-t border-zinc-100 dark:border-zinc-805 pt-3">
                    <h5 className="font-bold text-zinc-900 dark:text-zinc-100">❓ Why is a complete "Deletion" of error Goods Receipts restricted?</h5>
                    <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      To prevent fraud and maintain tax ledger compliance under ZIMRA regulatory guidelines. When errors occur, you "Reverse" them. This logs an explicit negative stock audit adjustment line so both values are visible for tracebacks.
                    </p>
                  </div>
                </CardContent>
              </Card>

            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center border border-dashed rounded-3xl bg-zinc-50/50 dark:bg-zinc-950/20 text-zinc-400 italic text-xs gap-2">
              <BookOpen className="h-8 w-8 text-zinc-300 animate-pulse" />
              <span>Please select a tutorial walkthrough topic from the list to begin standard training.</span>
            </div>
          )}

        </div>

      </div>

      {/* FOOTER CALL FOR SUPPORT AND LIVE TRAININGS */}
      <Card className="border border-indigo-200/50 dark:border-indigo-900/40 bg-indigo-50/10 dark:bg-indigo-950/20 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mt-0.5">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Need direct staff master-classes or video training?</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                We provide custom digital video courses, Harare-based on-site teller workshops, and technical assistance integration plans for retail chains and bulk warehouses. Write us a support ticket for scheduling options.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center">
            <span className="text-[10px] text-zinc-400/80 font-mono select-none">
              Manual Version 4.1.Zimbabwe
            </span>
          </div>
        </div>
      </Card>

    </div>
  );
}
