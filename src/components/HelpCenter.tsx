import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  HelpCircle, 
  X, 
  Play, 
  ChevronLeft, 
  ChevronRight, 
  Compass, 
  Sparkles, 
  CheckCircle, 
  ArrowRight,
  BookOpen,
  Store,
  Package,
  Info,
  LayoutDashboard,
  DollarSign,
  FileText,
  Users,
  Truck,
  MessageSquare,
  Settings,
  LifeBuoy,
  Search
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

export type ModuleType = 
  | 'dashboard'
  | 'pos'
  | 'cash'
  | 'accounting'
  | 'coa'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'reports'
  | 'messenger'
  | 'settings'
  | 'support';

interface TourStep {
  title: string;
  description: string;
  tip: string;
  highlightSelector?: string;
}

export const toursMap: Record<ModuleType, { title: string; steps: TourStep[] }> = {
  dashboard: {
    title: "Executive Dashboard",
    steps: [
      {
        title: "Welcome to your Business Headquarters",
        description: "Your master console for checking key enterprise metrics, sales totals, active cashier sessions, and general branch operations at a single glance.",
        tip: "All metrics adapt automatically based on the currency index settings and sync states!"
      },
      {
        title: "Dynamic Sales & Cash Logs",
        description: "Review today's total registered sales, active register cash-counts, and recent system operations dynamically updated as transactions occur.",
        tip: "A green status indicator means database links are live and actively syncing ledger balances."
      },
      {
        title: "System Alerts Pane",
        description: "This area surfaces critical real-time alerts like low stock levels, expired staff sessions, or pending client invoices.",
        tip: "Click on any warning to jump straight to that module and take immediate actions."
      }
    ]
  },
  pos: {
    title: "Point of Sale (POS)",
    steps: [
      {
        title: "Welcome to POS Terminal Hub",
        description: "This Point of Sale terminal is engineered for speed, high-volume checkouts, and complete off-grid resilience during local Harare power cuts.",
        tip: "You can operate multiple register sessions under a single physical branch with separate opening/closing floats."
      },
      {
        title: "Interactive Product Shelf",
        description: "Add products by tapping cards, typing in the search bar, or scanning a standard USB barcode reader directly.",
        tip: "Items reaching minimum stock levels will flash with an orange alert border to prompt cashiers."
      },
      {
        title: "Active Basket Panel",
        description: "The right-hand panel compiles the customer's shopping list. You can update quantities, apply custom discounts, or search and attach specific customer profiles.",
        tip: "Double-clicking an item in the list opens advanced pricing parameters."
      },
      {
        title: "Dynamic Exchange Indices",
        description: "Look at the active Exchange Rate Index in the header (e.g. 1 USD = 25 ZWG). All items automatically translate prices to avoid manual errors.",
        tip: "Prevents discrepancies in cashier drawers and satisfies tax audit rules."
      },
      {
        title: "Hold / Park Draft Carts",
        description: "Long queue? Tap 'Hold Cart' to park the current customer's items as a local draft. Ring up other clients, then reload the draft with one tap later.",
        tip: "You can hold an unlimited number of draft cart baskets in a single shift session."
      },
      {
        title: "Split-Tender Checkout Drawer",
        description: "Click 'Charge' to open the split payment panel. Accept multiple payment options (USD Cash, ZWG swipe cards, EcoCash mobile) on a single bill.",
        tip: "Once complete, a balanced double-entry ledger is automatically debited to Cash Tills and credited to Sales Revenue."
      }
    ]
  },
  cash: {
    title: "Cash Management",
    steps: [
      {
        title: "Audit Cashier Sessions",
        description: "Welcome to the Cash Control Desk. Maintain rigorous cashier accountability by monitoring opening floats and closing physical drawer counts.",
        tip: "Ensure cashiers count physical drawer contents before starting their POS sales shift."
      },
      {
        title: "Petty Cash Payouts",
        description: "Track and log small daily administrative branch expenses (such as purchasing fuel or staff tea) to ensure every cent is accounted for.",
        tip: "Any payout instantly posts a credit to Cash Assets and a debit to corresponding Operating Expenses."
      },
      {
        title: "Discrepancy Analysis",
        description: "The system automatically compares physical cash-out inputs against POS transaction records to highlight surpluses or shortfalls.",
        tip: "Any significant discrepancy generates an automatic audit log entry for management review."
      }
    ]
  },
  accounting: {
    title: "Journal Entries",
    steps: [
      {
        title: "The General Ledger Journal",
        description: "Welcome to the central financial registry. Review double-entry transaction items created in real-time from Point of Sale sales and Goods Received Notes.",
        tip: "All transaction lines must satisfy the fundamental accounting formula (Debits = Credits)."
      },
      {
        title: "Unalterable Audit Trails",
        description: "Every journal item is permanent, timestamped in UTC, and linked to specific cashier and transaction references to satisfy corporate tax inspectors.",
        tip: "To fix human errors, you should post a balanced reversal adjustment rather than deleting database rows."
      },
      {
        title: "Manual Adjustments Console",
        description: "As an administrator, use the adjustment form to record manual journal lines for items like assets depreciation, loan interest, or bank fees.",
        tip: "Ensure you assign the lines to the correct accounts in your Chart of Accounts."
      }
    ]
  },
  coa: {
    title: "Chart of Accounts",
    steps: [
      {
        title: "Your Enterprise Financial Architecture",
        description: "Organize your business accounts into clean assets, liabilities, equity, revenues, and expenses conforming to international tax standards.",
        tip: "Correct account classification ensures clean balance sheets and profit & loss statements."
      },
      {
        title: "Custom Accounts Creation",
        description: "Add new accounts or sub-accounts (e.g., custom local bank accounts, separate petty cash boxes, or specific tax pools) as your business expands.",
        tip: "Use numerical prefixes or codes to organize accounts into logical accounting blocks."
      },
      {
        title: "Real-time Account Balances",
        description: "View outstanding balances across all accounts in USD and local currency equivalents based on up-to-date transaction journals.",
        tip: "Click on any account row to view its ledger log history for granular double-entry auditing."
      }
    ]
  },
  inventory: {
    title: "Inventory Control",
    steps: [
      {
        title: "Centralized Product Control",
        description: "Welcome to the Master Stock Control. This panel manages product profiles, prices, safety thresholds, and bulk stock imports/exports.",
        tip: "Maintain accurate pricing to ensure correct Gross Margin estimations on your main dashboard."
      },
      {
        title: "Product Profiles & SKUs",
        description: "Establish product profiles with unique SKU tags, barcodes, cost prices, selling prices, and applicable VAT tiers.",
        tip: "Assign items to correct categories to simplify catalog filtering inside the POS module."
      },
      {
        title: "Reorder Alert Thresholds",
        description: "Specify a custom 'Minimum Reorder Level' for critical products. When inventory drops below this point, a warning sticker flashes on the dashboard.",
        tip: "Prevents unexpected stock-outs of high-velocity consumer goods."
      },
      {
        title: "Branch Warehouses & Transfers",
        description: "Configure multiple storage points (e.g., Harare Central, Bulawayo Shop, Mutare Depot) and transfer stock between branches cleanly.",
        tip: "Internal stock transfers update warehouse totals instantly upon receiving branch confirmation."
      },
      {
        title: "Bulk Imports (CSV)",
        description: "Load thousands of inventory items at once using our Excel/CSV upload tool. Download the template, add your stock list, and re-upload.",
        tip: "Duplicate SKU codes are automatically blocked to maintain data integrity."
      }
    ]
  },
  customers: {
    title: "Customer CRM",
    steps: [
      {
        title: "Customer CRM Directory",
        description: "Track customer records, contact information, outstanding credit limits, and purchase histories in a centralized database.",
        tip: "Knowing your customers helps you run personalized marketing campaigns and manage credit risk."
      },
      {
        title: "Credit Control Limits",
        description: "Set custom credit limits for trusted businesses purchasing on terms. The POS will block checkouts on accounts that exceed these limits.",
        tip: "Protects your cash flow against high bad-debt write-offs."
      },
      {
        title: "Bulk Messaging Channels",
        description: "Reach your clients instantly! Launch marketing campaigns or payment reminders directly via WhatsApp, SMS, or Email channels.",
        tip: "Use dynamic variables like [CustomerName] to customize your outgoing messages automatically."
      }
    ]
  },
  suppliers: {
    title: "Supplier Relations",
    steps: [
      {
        title: "Supplier Master Profiles",
        description: "Track and manage your relationships, contract details, payment terms, and open accounts payable with all primary wholesale suppliers.",
        tip: "Ensure you input correct contact information to simplify purchase order creation."
      },
      {
        title: "Goods Receiving Notes (GRN)",
        description: "Log incoming stock shipments, configure batch labels for expiry tracking, and back-date cargo arrivals for correct ledger posting.",
        tip: "Always match physical counts against supplier delivery notes to prevent inventory shortages."
      },
      {
        title: "Balanced GRN Reversals",
        description: "Correct human receipt errors using the 'Reverse' command, generating balancing adjustments to keep accounts and stock records accurate.",
        tip: "Reverse balancing entries automatically deduct from accounts payable journals and re-adjust warehouse metrics safely."
      }
    ]
  },
  reports: {
    title: "Reports & Financials",
    steps: [
      {
        title: "Real-time Financial Statements",
        description: "Generate instant Profit & Loss, Balance Sheets, Trial Balances, and multi-currency tax estimations based on live ledger logs.",
        tip: "Statements update instantly with every transaction recorded in the POS or Goods Receiving modules."
      },
      {
        title: "Regulatory Exports (ZIMRA)",
        description: "Produce specialized tax compliance tables that align with ZIMRA requirements to simplify tax filing.",
        tip: "Keep the system tax indices configured in Settings to ensure calculation compliance."
      },
      {
        title: "Audit Trails & Export",
        description: "Export full transaction histories, cash sessions, and system audit logs to spreadsheets (CSV) or beautiful, printer-friendly PDFs.",
        tip: "PDF reports include standard company headers, perfect for board presentations."
      }
    ]
  },
  messenger: {
    title: "Staff Messenger",
    steps: [
      {
        title: "Secure Corporate Messenger",
        description: "Connect physical branch employees, supervisor overrides, cashier handovers, and managerial approvals in a secure, real-time message board.",
        tip: "Use the Staff Messenger to request instant supervisor PIN overrides for special sales discounts."
      },
      {
        title: "Automated System Broadcasts",
        description: "The system automatically publishes notifications here when critical actions occur, such as a cashier opening a session or receiving a cargo shipment.",
        tip: "Enables real-time operational visibility across different physical retail outlets."
      },
      {
        title: "Announcements Board",
        description: "As an administrator, broadcast policy changes, daily exchange rate updates, or branch closures to all active personnel.",
        tip: "Broadcasts pop up directly in user headers to ensure 100% staff compliance."
      }
    ]
  },
  settings: {
    title: "System Settings",
    steps: [
      {
        title: "Enterprise Profile & Rules",
        description: "Set up company names, physical addresses, default billing tax rates (VAT), and basic access control passwords.",
        tip: "Information configured here automatically populates headers on customer receipts and invoice PDFs."
      },
      {
        title: "Multi-Currency Index Settings",
        description: "Establish the corporate primary reporting currency and configure exchange rates for USD, ZWG, and South African Rand (ZAR).",
        tip: "Sync with official RBZ bank rates automatically, or specify a custom margin index to protect against local market fluctuations."
      },
      {
        title: "Staff Training Hub",
        description: "Access a master repository of comprehensive text tutorials, interactive double-entry simulators, and video walkthrough guides.",
        tip: "Great for onboarding new branch managers or retail cashiers!"
      }
    ]
  },
  support: {
    title: "Support Hub",
    steps: [
      {
        title: "The Staff Help Desk",
        description: "Welcome to the corporate Help Center. Log official support tickets for terminal devices, software issues, or user license renewals.",
        tip: "Check live ticket statuses in the table below to monitor help desk resolution speeds."
      },
      {
        title: "AI Diagnostics System",
        description: "Engage the system's smart assistant. It can troubleshoot double-entry ledgers, check pending local POS sale queues, or verify cash limits.",
        tip: "Start a diagnostics chat anytime to get immediate step-by-step guidance."
      },
      {
        title: "Onboarding Training Center",
        description: "Start interactive guided tours for any page, view textual tutorials, or watch video walkthroughs directly inside the app.",
        tip: "New users are prompted with step-by-step instructions automatically to ensure an easy learning curve!"
      }
    ]
  }
};

const pathnameToModule = (path: string): ModuleType | null => {
  if (path === '/dashboard') return 'dashboard';
  if (path === '/pos') return 'pos';
  if (path === '/cash') return 'cash';
  if (path === '/accounting') return 'accounting';
  if (path === '/coa') return 'coa';
  if (path === '/inventory') return 'inventory';
  if (path === '/customers') return 'customers';
  if (path === '/suppliers') return 'suppliers';
  if (path === '/reports') return 'reports';
  if (path === '/messenger') return 'messenger';
  if (path === '/settings') return 'settings';
  if (path === '/support') return 'support';
  return null;
};

const moduleToPathname = (module: ModuleType): string | null => {
  if (module === 'dashboard') return '/dashboard';
  if (module === 'pos') return '/pos';
  if (module === 'cash') return '/cash';
  if (module === 'accounting') return '/accounting';
  if (module === 'coa') return '/coa';
  if (module === 'inventory') return '/inventory';
  if (module === 'customers') return '/customers';
  if (module === 'suppliers') return '/suppliers';
  if (module === 'reports') return '/reports';
  if (module === 'messenger') return '/messenger';
  if (module === 'settings') return '/settings';
  if (module === 'support') return '/support';
  return null;
};

const moduleIcons: Record<ModuleType, React.ComponentType<any>> = {
  dashboard: LayoutDashboard,
  pos: Store,
  cash: DollarSign,
  accounting: BookOpen,
  coa: FileText,
  inventory: Package,
  customers: Users,
  suppliers: Truck,
  reports: FileText,
  messenger: MessageSquare,
  settings: Settings,
  support: LifeBuoy
};

export function HelpCenter() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isHelpDeskOpen, setIsHelpDeskOpen] = useState(false);
  const [activeTour, setActiveTour] = useState<ModuleType | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [pendingNavigation, setPendingNavigation] = useState<ModuleType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState<ModuleType | null>(null);

  // Monitor path transitions to show onboarding prompts for new pages automatically
  useEffect(() => {
    const currentModule = pathnameToModule(location.pathname);
    if (currentModule) {
      const isCompleted = localStorage.getItem(`tareza_tour_completed_${currentModule}`);
      if (isCompleted !== 'true' && activeTour === null) {
        // Show onboarding prompt with a premium slight delay
        const timer = setTimeout(() => {
          setShowOnboardingPrompt(currentModule);
        }, 1200);
        return () => clearTimeout(timer);
      } else {
        setShowOnboardingPrompt(null);
      }
    } else {
      setShowOnboardingPrompt(null);
    }
  }, [location.pathname, activeTour]);

  // Listen to start-tour global events (facilitates launching from TutorialsSettings)
  useEffect(() => {
    const handleStartTourEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ moduleId: ModuleType }>;
      const moduleId = customEvent.detail?.moduleId;
      if (moduleId && toursMap[moduleId]) {
        initiateTour(moduleId);
      }
    };

    const handleOpenHelp = () => setIsHelpDeskOpen(true);
    const handleCloseHelp = () => setIsHelpDeskOpen(false);
    const handleToggleHelp = () => setIsHelpDeskOpen(prev => !prev);

    window.addEventListener('start-tour', handleStartTourEvent);
    window.addEventListener('open-help-desk', handleOpenHelp);
    window.addEventListener('close-help-desk', handleCloseHelp);
    window.addEventListener('toggle-help-desk', handleToggleHelp);

    return () => {
      window.removeEventListener('start-tour', handleStartTourEvent);
      window.removeEventListener('open-help-desk', handleOpenHelp);
      window.removeEventListener('close-help-desk', handleCloseHelp);
      window.removeEventListener('toggle-help-desk', handleToggleHelp);
    };
  }, [location.pathname]);

  const initiateTour = (module: ModuleType) => {
    setIsHelpDeskOpen(false);
    setShowOnboardingPrompt(null);
    
    // Check if user is on the correct page
    const expectedPath = moduleToPathname(module);
    if (expectedPath && location.pathname !== expectedPath) {
      setPendingNavigation(module);
    } else {
      startTourDirectly(module);
    }
  };

  const startTourDirectly = (module: ModuleType) => {
    setActiveTour(module);
    setActiveStep(0);
    setPendingNavigation(null);
    setShowOnboardingPrompt(null);
    toast.info(`Starting interactive guided tour of ${toursMap[module].title}!`);
  };

  const handleConfirmNavigation = () => {
    if (!pendingNavigation) return;
    const targetPath = moduleToPathname(pendingNavigation);
    if (targetPath) {
      navigate(targetPath);
      
      // Smooth delay before starting the tour to wait for page mounting
      setTimeout(() => {
        startTourDirectly(pendingNavigation);
      }, 400);
    }
  };

  const getCurrentSteps = (): TourStep[] => {
    if (activeTour && toursMap[activeTour]) {
      return toursMap[activeTour].steps;
    }
    return [];
  };

  const handleNextStep = () => {
    const steps = getCurrentSteps();
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
    } else {
      // Completed!
      if (activeTour) {
        localStorage.setItem(`tareza_tour_completed_${activeTour}`, 'true');
      }
      const completedTour = activeTour;
      setActiveTour(null);
      toast.success(`Congratulations! You completed the official Tareza guided tour for ${completedTour ? toursMap[completedTour].title : ''}. You are ready to train other staff members!`, {
        duration: 5000,
        position: 'top-center'
      });
    }
  };

  const handlePrevStep = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  };

  const currentSteps = getCurrentSteps();
  const currentStepData = currentSteps[activeStep];

  // Filter modules for directory view based on search query
  const filteredModules = (Object.keys(toursMap) as ModuleType[]).filter(module => {
    const tour = toursMap[module];
    const matchesSearch = searchQuery.trim() === '' || 
      tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tour.steps.some(step => 
        step.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        step.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesSearch;
  });

  return (
    <>
      {/* PERSISTENT FLOATING ONBOARDING PROMPT */}
      {showOnboardingPrompt && !activeTour && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm w-full px-4 pointer-events-auto animate-in slide-in-from-bottom duration-500" id="onboarding-prompt-card">
          <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-3.5 relative">
            <button 
              onClick={() => {
                localStorage.setItem(`tareza_tour_completed_${showOnboardingPrompt}`, 'true');
                setShowOnboardingPrompt(null);
                toast.info("Tutorial dismissed. Access it anytime in the Support Hub!");
              }}
              className="absolute top-3.5 right-3.5 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              title="Dismiss and don't show again"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1 pr-6 text-left">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  New Module Discovered
                </h4>
                <h3 className="text-sm font-extrabold tracking-tight">
                  Welcome to {toursMap[showOnboardingPrompt].title}!
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
                  Would you like a quick step-by-step tour of the primary buttons and features on this screen?
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button 
                onClick={() => {
                  localStorage.setItem(`tareza_tour_completed_${showOnboardingPrompt}`, 'true');
                  setShowOnboardingPrompt(null);
                  toast.info("Onboarding skipped. Learn more anytime in Tutorials.");
                }}
                className="flex-1 h-8 text-xs font-semibold text-zinc-500 hover:text-zinc-805 dark:text-zinc-400 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-xl transition-all cursor-pointer"
              >
                Skip / Got it
              </button>
              <button 
                onClick={() => {
                  const module = showOnboardingPrompt;
                  setShowOnboardingPrompt(null);
                  startTourDirectly(module);
                }}
                className="flex-1 h-8 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-600 dark:hover:bg-indigo-700 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-1"
              >
                Start Tour <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MASTER HELP DESK MODAL: SELECT DEPLOYED TOURS & VIDEOS */}
      {isHelpDeskOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300" id="guided-tours-selection-overlay">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[90vh] max-h-[650px]">
            
            {/* Header banner */}
            <div className="bg-gradient-to-r from-zinc-900 to-indigo-950 p-6 text-white relative shrink-0">
              <button 
                onClick={() => setIsHelpDeskOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30 font-bold mb-2">
                🎓 INTERACTIVE HELP DESK & TOURS
              </Badge>
              <h3 className="text-xl font-bold tracking-tight">Enterprise Staff Training Directory</h3>
              <p className="text-xs text-zinc-300 mt-1">Select any system module to start a live guided walkthrough directly inside the active screen view.</p>
            </div>

            {/* Search filter input */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="Search available training walkthroughs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Tour selectors content */}
            <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto">
              {filteredModules.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                  <Info className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
                  <p className="text-xs font-bold">No walkthroughs match your query</p>
                  <p className="text-[11px] mt-0.5">Try searching for other words or check settings</p>
                </div>
              ) : (
                filteredModules.map((moduleKey) => {
                  const tour = toursMap[moduleKey];
                  const Icon = moduleIcons[moduleKey] || HelpCircle;
                  return (
                    <div 
                      key={moduleKey} 
                      className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-900/40 transition-all bg-zinc-50/50 dark:bg-zinc-900/30 flex items-start gap-4 text-left"
                    >
                      <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 mt-1 shrink-0 border border-indigo-100/10">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100">{tour.title} Walkthrough</span>
                          <Badge variant="outline" className="text-[9px] font-bold font-mono px-2 py-0 bg-white dark:bg-zinc-900">
                            {tour.steps.length} Steps
                          </Badge>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
                          {tour.steps[0].description}
                        </p>
                        <Button 
                          onClick={() => initiateTour(moduleKey)}
                          className="mt-2.5 bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white text-[10px] font-bold h-7.5 rounded-lg px-3 flex items-center gap-1 cursor-pointer border-0"
                        >
                          <Play className="w-3 h-3 fill-white" /> Start Guided Tour
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 border-t border-zinc-200 dark:border-zinc-800 text-center flex items-center justify-center gap-2 shrink-0">
              <Info className="h-3.5 w-3.5 text-indigo-500" />
              <p className="text-[10px] text-zinc-500 font-semibold">
                Tips: Check under 'Settings ➔ Tutorials & Staff Training' for detailed textual manuals.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* PENDING NAVIGATION CONFIRMATION BACKDROP */}
      {pendingNavigation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in zoom-in duration-300" id="guided-tours-navigating-modal">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-full flex items-center justify-center text-indigo-600 mx-auto border border-indigo-100 dark:border-indigo-900/30">
              <Compass className="h-6 w-6 animate-spin duration-1000" />
            </div>
            
            <div className="space-y-1.5 focus:outline-none">
              <h4 className="text-md font-extrabold text-zinc-900 dark:text-zinc-50">
                Start {toursMap[pendingNavigation].title} Tour
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This tour is mapped specifically to elements inside the <strong>{toursMap[pendingNavigation].title}</strong> module. Click below to automatically migrate your page view there and launch the walkthrough immediately!
              </p>
            </div>

            <div className="flex gap-2.5 pt-3">
              <Button 
                variant="outline" 
                onClick={() => setPendingNavigation(null)} 
                className="flex-1 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmNavigation}
                className="flex-1 bg-indigo-600 text-white hover:bg-indigo-750 text-xs font-bold cursor-pointer"
              >
                Navigate & Start Tour <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP-BY-STEP STEPPER DIALOG CONTAINER overlay */}
      {activeTour && currentStepData && (
        <div className="fixed inset-0 z-50 pointer-events-none" id="guided-tours-stepper-container">
          
          {/* Subtle surrounding light dimming frame */}
          <div className="absolute inset-0 bg-black/10 backdrop-brightness-75 pointer-events-none" />

          {/* Stepper Dialogue Card Container */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 pointer-events-auto">
            <div className="bg-zinc-900 dark:bg-zinc-950 text-white rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden p-6 space-y-4 relative animate-in slide-in-from-bottom duration-300">
              
              {/* Top Banner stats */}
              <div className="flex items-center justify-between">
                <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold hover:bg-indigo-500/25">
                  🎓 TUTORIAL WALKTHROUGH: {toursMap[activeTour].title.toUpperCase()}
                </Badge>
                
                <span className="text-[10px] text-zinc-400 font-mono font-bold">
                  Step {activeStep + 1} of {currentSteps.length}
                </span>
              </div>

              {/* Description Body */}
              <div className="space-y-1.5 focus:outline-none text-left">
                <h4 className="text-sm font-black flex items-center gap-2 text-zinc-50 tracking-tight">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
                  {currentStepData.title}
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                  {currentStepData.description}
                </p>
              </div>

              {/* Expert Tips */}
              {currentStepData.tip && (
                <div className="p-3 bg-zinc-850 dark:bg-zinc-900/60 rounded-xl text-left border border-zinc-800/80 flex gap-2.5 items-start">
                  <span className="p-1 text-[9px] bg-indigo-500/10 text-indigo-300 font-extrabold rounded uppercase leading-none shrink-0 tracking-wider">
                    PRO-TIP
                  </span>
                  <p className="text-[11px] text-zinc-450 leading-relaxed font-medium">
                    {currentStepData.tip}
                  </p>
                </div>
              )}

              {/* Flow control tools (Close, Back, Next) */}
              <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
                
                {/* Cancel Button */}
                <button 
                  onClick={() => {
                    localStorage.setItem(`tareza_tour_completed_${activeTour}`, 'true');
                    setActiveTour(null);
                    toast.info("Guided tour cancelled by user. You can restart or view manuals anytime!");
                  }}
                  className="h-8 text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs px-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Skip Tour
                </button>

                {/* Left Step Indicators */}
                <div className="flex gap-1.5 items-center justify-center">
                  {currentSteps.map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                        i === activeStep ? 'bg-indigo-400 w-3' : 'bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>

                {/* Navigation tools */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={activeStep === 0}
                    onClick={handlePrevStep}
                    className="h-8 w-8 rounded-lg p-0 text-zinc-300 dark:text-zinc-400 hover:text-white cursor-pointer border-zinc-700 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <Button 
                    size="sm"
                    onClick={handleNextStep}
                    className="h-8 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs rounded-lg px-3.5 flex items-center gap-1 cursor-pointer border-0"
                  >
                    {activeStep === currentSteps.length - 1 ? (
                      <>Finish <CheckCircle className="w-3.5 h-3.5 fill-none ml-0.5" /></>
                    ) : (
                      <>Next <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></>
                    )}
                  </Button>
                </div>

              </div>

            </div>
          </div>

        </div>
      )}
    </>
  );
}
