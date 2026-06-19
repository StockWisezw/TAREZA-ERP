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
  Info
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

interface TourStep {
  title: string;
  description: string;
  tip: string;
  highlightSelector?: string; // Optional element to highlight conceptually 
}

const posTourSteps: TourStep[] = [
  {
    title: "Welcome to POS Terminal Hub",
    description: "Welcome to Tareza ERP's Point of Sale terminal. This system is designed for maximum speed, security, and full offline resilience during Harare load-shedding grids.",
    tip: "You can operate multiple separate registers under a single physical branch with separate cashier float records."
  },
  {
    title: "1. Dynamic Product Catalogue Shelf",
    description: "To search products, use the searching bar at the top or tap product cards directly on the grid shelf. For rapid lookups, you can also connect USB barcode scanners directly.",
    tip: "Items with stock-alert levels configured will blink dynamically, warning cashier agents of near stock depletion."
  },
  {
    title: "2. Real-Time Shopping Cart & Client Association",
    description: "The right panel aggregates all active cart selections. Here you can change quantities, apply corporate discounts, or link and select local client profiles.",
    tip: "Hovering over or clicking the client row opens instant CRM balances, indicating if they operate on overdue accounts."
  },
  {
    title: "3. Dual-Currency Indexing Indicator",
    description: "At the top of the screen, view the active Treasury Exchange Rate index (e.g., 1 USD = 25 ZWG). All price labels translate dynamically to avoid hand-calculated checkout mistakes.",
    tip: "This ensures ledger compliance and prevents cash drawer discrepancies during daily balance audits."
  },
  {
    title: "4. Holding / Parking Draft Baskets",
    description: "Long service queues? Use the draft cart system to park/hold the current active consumer basket to instantly serve other customers, recalls are loaded under a single click later.",
    tip: "There are no limits on the number of concurrently held shopping carts inside local sessions."
  },
  {
    title: "5. Split-Tenders Checkout Drawer",
    description: "Click 'Charge' to open the checkout payment module. Settle transactions using mixed payment options: cash USD, local ZWG swipe cards, or mobile Ecocash. The system calculates mixed coins change mathematically.",
    tip: "Upon completion, a professional double-entry ledger is automatically debited to Cash Till and credited to Sales Revenue!"
  }
];

const inventoryTourSteps: TourStep[] = [
  {
    title: "Welcome to Centralized Inventory Control",
    description: "This dashboard manages your corporate inventory, branch warehouses, product master files, tax values, and supplier purchase orders.",
    tip: "A dynamic real-time dashboard aggregates total retail assets valuation across Harare, Bulawayo, or Mutare main depots immediately."
  },
  {
    title: "1. Product Profile Setup & SKUs",
    description: "Add new products using the setup console. Configure product SKU tags, unique barcodes, categories, cost value parameters, and standard sales pricing tables.",
    tip: "Ensure you assign correct VAT/ZIMRA categories to maintain standard tax ledger outputs."
  },
  {
    title: "2. Under-Stock Threshold & Reorder Alerting",
    description: "Specify a custom 'Minimum Reorder Level' for critical products. When inventory shelf counts drop under this threshold, a flashing amber indicator warns you directly on your workspace.",
    tip: "Prevent stock-outs of high-velocity items with automatic supervisor notification streams."
  },
  {
    title: "3. Logical Warehouses & Internal stock Transfers",
    description: "Set up logical physical boundaries (e.g., 'Primary Harare Hub', 'Bulawayo Cash Store', or 'Damaged stock Hold') and transfer assets between locations cleanly without manual inventory receipts.",
    tip: "T-Account ledger movements are automatically updated upon destination manager sign-off."
  },
  {
    title: "4. Bulk Spreadsheet Actions (CSV)",
    description: "Launch the Bulk Import tool to ingest thousands of inventory items at once. Download the pre-formatted CSV template grid, insert product details with initial opening stock, and re-upload.",
    tip: "Duplicate SKU rows are blocked to safeguard database integrity; make bulk updates via the Centralized Inventory Shelf table."
  },
  {
    title: "5. Goods Receiving & Return Reversals",
    description: "Post Goods Received Notes (GRNs) directly to log incoming purchase orders. In case of human error, use the 'Stock Reversal' button to log balancing debit/credits, maintaining precise tax audit trails without deletion.",
    tip: "Reverse balancing entries automatically deduct from accounts payable journals and re-adjust warehouse metrics safely."
  }
];

export function HelpCenter() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isHelpDeskOpen, setIsHelpDeskOpen] = useState(false);
  const [activeTour, setActiveTour] = useState<'pos' | 'inventory' | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [pendingNavigation, setPendingNavigation] = useState<'pos' | 'inventory' | null>(null);

  // Listen to start-tour global events (facilitates launching from TutorialsSettings)
  useEffect(() => {
    const handleStartTourEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ moduleId: 'pos' | 'inventory' }>;
      const moduleId = customEvent.detail?.moduleId;
      if (moduleId === 'pos' || moduleId === 'inventory') {
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

  const initiateTour = (module: 'pos' | 'inventory') => {
    setIsHelpDeskOpen(false);
    
    // Check if user is on the correct page
    if (module === 'pos' && location.pathname !== '/pos') {
      setPendingNavigation('pos');
    } else if (module === 'inventory' && location.pathname !== '/inventory') {
      setPendingNavigation('inventory');
    } else {
      startTourDirectly(module);
    }
  };

  const startTourDirectly = (module: 'pos' | 'inventory') => {
    setActiveTour(module);
    setActiveStep(0);
    setPendingNavigation(null);
    toast.info(`Starting interactive guided tour of ${module === 'pos' ? 'POS Terminal' : 'Inventory Master'} module!`);
  };

  const handleConfirmNavigation = () => {
    if (!pendingNavigation) return;
    const targetPath = pendingNavigation === 'pos' ? '/pos' : '/inventory';
    navigate(targetPath);
    
    // Smooth delay before starting the tour to wait for page mounting
    setTimeout(() => {
      startTourDirectly(pendingNavigation);
    }, 400);
  };

  const getCurrentSteps = (): TourStep[] => {
    if (activeTour === 'pos') return posTourSteps;
    if (activeTour === 'inventory') return inventoryTourSteps;
    return [];
  };

  const handleNextStep = () => {
    const steps = getCurrentSteps();
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
    } else {
      // Completed!
      setActiveTour(null);
      toast.success(`Congratulations! You completed the official Tareza guided tour for ${activeTour === 'pos' ? 'POS Terminal Setup' : 'Inventory Master Control'}. You are ready to train other staff members!`, {
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

  return (
    <>
      {/* MASTER HELP DESK MODAL: SELECT DEPLOYED TOURS & VIDEOS */}
      {isHelpDeskOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300" id="guided-tours-selection-overlay">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            
            {/* Header banner */}
            <div className="bg-gradient-to-r from-zinc-900 to-indigo-950 p-6 text-white relative">
              <button 
                onClick={() => setIsHelpDeskOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30 font-bold mb-2">
                🎓 INTERACTIVE HELP DESK & TOURS
              </Badge>
              <h3 className="text-xl font-bold tracking-tight">Enterprise Staff Training Centers</h3>
              <p className="text-xs text-zinc-300 mt-1">Select one of our live-guided walk-through modules to train cashiers and administrators directly inside Tareza ERP.</p>
            </div>

            {/* Tour selectors content */}
            <div className="p-6 space-y-4 max-h-[350px] overflow-y-auto">
              
              {/* POS Terminal Tour selector */}
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-900/60 transition-all bg-zinc-50/50 dark:bg-zinc-900/30 flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-105 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 mt-1 shrink-0">
                  <Store className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">POS Terminal Guide</span>
                    <Badge variant="outline" className="text-[10px] font-bold font-mono">6 Steps</Badge>
                  </div>
                  <p className="text-[11px] text-zinc-550 dark:text-zinc-400 leading-relaxed">
                    Learn to ring up multi-currency sales, select catalog items, connect customers, parking draft baskets, and manage split tender cash checkouts.
                  </p>
                  <Button 
                    onClick={() => initiateTour('pos')}
                    className="mt-3 bg-indigo-600 hover:bg-indigo-750 text-white text-[10px] font-bold h-7 rounded-lg px-3 flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-white" /> Start POS Tour
                  </Button>
                </div>
              </div>

              {/* Inventory Control Selector */}
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-900/60 transition-all bg-zinc-50/50 dark:bg-zinc-900/30 flex items-start gap-4">
                <div className="p-3 rounded-lg bg-amber-105 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 mt-1 shrink-0">
                  <Package className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Inventory Control Guide</span>
                    <Badge variant="outline" className="text-[10px] font-bold font-mono">5 Steps</Badge>
                  </div>
                  <p className="text-[11px] text-zinc-550 dark:text-zinc-400 leading-relaxed">
                    Understand physical warehouses distribution, establishing re-order stock points, configuring items pricing indexes, bulk imports, and secure Goods Receipt Note (GRN) reversals.
                  </p>
                  <Button 
                    onClick={() => initiateTour('inventory')}
                    className="mt-3 bg-indigo-600 hover:bg-indigo-750 text-white text-[10px] font-bold h-7 rounded-lg px-3 flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-white" /> Start Inventory Tour
                  </Button>
                </div>
              </div>

            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 border-t border-zinc-200 dark:border-zinc-800 text-center flex items-center justify-center gap-2">
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
                Start {pendingNavigation === 'pos' ? 'POS Terminal' : 'Inventory Master'} Tour
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This tour is mapped specifically to elements inside the <strong>{pendingNavigation === 'pos' ? 'Point of Sale' : 'Inventory Control'}</strong> module. Click below to automatically migrate your page view there and launch the walkthrough immediately!
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
                  🎓 TUTORIAL WALKTHROUGH MODULE: {activeTour.toUpperCase()}
                </Badge>
                
                <span className="text-[10px] text-zinc-400 font-mono font-bold">
                  Step {activeStep + 1} of {currentSteps.length}
                </span>
              </div>

              {/* Description Body */}
              <div className="space-y-1.5 focus:outline-none">
                <h4 className="text-sm font-black flex items-center gap-2 text-zinc-50 tracking-tight">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                  {currentStepData.title}
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {currentStepData.description}
                </p>
              </div>

              {/* Expert Tips */}
              {currentStepData.tip && (
                <div className="p-3 bg-zinc-850 dark:bg-zinc-900/60 rounded-xl text-left border border-zinc-800/80 flex gap-2.5 items-start">
                  <span className="p-1 text-[9.5px] bg-indigo-500/10 text-indigo-300 font-bold rounded uppercase">
                    PRO-TIP
                  </span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                    {currentStepData.tip}
                  </p>
                </div>
              )}

              {/* Flow control tools (Close, Back, Next) */}
              <div className="flex items-center justify-between border-t border-zinc-805 pt-4">
                
                {/* Cancel Button */}
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setActiveTour(null);
                    toast.info("Guided tour cancelled by user. You can restart or view manuals anytime!");
                  }}
                  className="h-8 text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs px-2 cursor-pointer"
                >
                  Skip Tour
                </Button>

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
                    className="h-8 w-8 rounded-lg p-0 text-zinc-300 dark:text-zinc-400 hover:text-white cursor-pointer border-zinc-750 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
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
