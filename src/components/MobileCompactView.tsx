import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ShoppingCart, 
  Package, 
  Truck, 
  ChevronDown, 
  ChevronUp, 
  LayoutDashboard,
  DollarSign,
  BookOpen,
  FileText,
  Users,
  MessageSquare,
  Mail,
  Settings,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { usePermission } from '../hooks/usePermission';

// Custom hook to detect mobile viewport size
export function useIsMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < breakpoint;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

interface MobileCompactViewProps {
  onCloseSheet?: () => void;
  className?: string;
}

export function MobileCompactView({ onCloseSheet, className = '' }: MobileCompactViewProps) {
  const location = useLocation();
  const [showAll, setShowAll] = useState(false);
  const isMobile = useIsMobile();
  const [isStandalone, setIsStandalone] = useState(false);
  const { role } = usePermission();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    (window.navigator as any).standalone || 
                    document.referrer.includes('android-app://');
      setIsStandalone(!!isPWA);
    }
  }, []);

  // Core focused items
  const essentialItems = [
    { name: 'POS Terminal', href: '/pos', icon: ShoppingCart, desc: 'Billing & Sales POS' },
    { name: 'Inventory Control', href: '/inventory', icon: Package, desc: 'Stock & Batch Management' },
    { name: 'Goods Receiving', href: '/suppliers?tab=receiving', icon: Truck, desc: 'Receiving Goods (GRN)' },
  ];

  // Non-essential / secondary items
  const secondaryItems = [
    { name: 'Dashboard Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Cash Management', href: '/cash', icon: DollarSign },
    { name: 'Journal Entries', href: '/accounting', icon: BookOpen },
    { name: 'Chart of Accounts', href: '/coa', icon: FileText },
    { name: 'Customer CRM', href: '/customers', icon: Users },
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Staff Messenger', href: '/messenger', icon: MessageSquare },
    { name: 'Gmail Inbox', href: '/gmail', icon: Mail },
    { name: 'System Settings', href: '/settings', icon: Settings },
    { name: 'Support Hub', href: '/support', icon: HelpCircle },
  ];

  // Filtering based on role
  const filteredEssential = essentialItems.filter(item => {
    if (role === 'cashier') {
      return item.href === '/pos';
    }
    return true;
  });

  const filteredSecondary = secondaryItems.filter(item => {
    if (role === 'cashier') {
      return false; // Cashiers have zero access to secondary administrative modules
    }
    if (role === 'staff') {
      return ['/pos', '/inventory', '/customers', '/suppliers', '/messenger', '/support'].includes(item.href);
    }
    return true;
  });

  const handleLinkClick = () => {
    if (onCloseSheet) {
      onCloseSheet();
    }
  };

  // If not on mobile layout, we still render the component but without forcing compact mode, or we can use it to enforce compact structure inside the sheet.
  return (
    <div className={`flex flex-col h-full ${className}`} id="mobile-compact-view">
      {/* Header Info */}
      <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-500/5 border-y border-zinc-150 dark:border-zinc-800/80 mb-3 rounded-xl mx-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
          <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
            Mobile Compact Workspace
          </span>
        </div>
        <span className="bg-zinc-200/60 dark:bg-zinc-800 text-[9px] font-bold text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">
          Active
        </span>
      </div>

      {/* Core Focused Navigation */}
      <div className="px-3 space-y-1.5 flex-1 overflow-y-auto">
        <p className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-2 mb-2">
          Core Operations
        </p>
        
        {filteredEssential.map((item) => {
          // Match receiving tab subpath or exact route
          const isActive = item.href.includes('tab=receiving')
            ? (location.pathname === '/suppliers' && location.search.includes('tab=receiving'))
            : (location.pathname === item.href);

          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={handleLinkClick}
              className={`flex items-center gap-3.5 p-3.5 rounded-2xl transition-all duration-150 border ${
                isActive 
                  ? 'bg-blue-50/80 border-blue-200/60 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400 font-extrabold shadow-sm' 
                  : 'bg-white dark:bg-[#121214] border-zinc-200/50 dark:border-zinc-850 text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/35'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${
                isActive ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
              }`}>
                <Icon className="h-[20px] w-[20px]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold block leading-tight">
                  {item.name}
                </span>
                <span className="text-[10px] font-medium text-zinc-450 dark:text-zinc-500 block mt-0.5 leading-none">
                  {item.desc}
                </span>
              </div>
            </Link>
          );
        })}

        {/* Expandable Secondary Navigation */}
        {!isStandalone && filteredSecondary.length > 0 && (
          <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-850">
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 text-zinc-650 dark:text-zinc-400 text-xs font-bold transition-all"
            >
              <span className="uppercase tracking-widest text-[10px] text-zinc-400 dark:text-zinc-500">
                {showAll ? 'Hide Secondary Modules' : 'All Modules & Utilities'}
              </span>
              <div className="flex items-center gap-1.5 text-zinc-500">
                <span className="text-[10px] bg-zinc-150 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-bold">
                  {filteredSecondary.length}
                </span>
                {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {showAll && (
              <div className="mt-2 space-y-1 pl-1 pr-1 animate-in fade-in slide-in-from-top-1 duration-200">
                {filteredSecondary.map((item) => {
                  const isActive = location.pathname === item.href;
                  const Icon = item.icon;
                  
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={handleLinkClick}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                        isActive 
                          ? 'bg-blue-50/50 text-blue-600 dark:bg-blue-500/5 dark:text-blue-400 font-bold' 
                          : 'text-zinc-650 hover:bg-zinc-100/50 dark:text-zinc-400 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${
                        isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-405'
                      }`} />
                      <span className="text-xs font-semibold leading-none">
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
