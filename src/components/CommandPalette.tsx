import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Terminal, 
  Settings, 
  FileText, 
  Package, 
  Users, 
  DollarSign, 
  BookOpen, 
  ShoppingCart, 
  LayoutDashboard, 
  Truck, 
  MessageSquare, 
  Shield, 
  CreditCard,
  Lock,
  Compass,
  Coins,
  Store,
  Palette
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

interface CommandItem {
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen to a custom event from Layout's search bar click
  useEffect(() => {
    const handleOpenPalette = () => {
      setIsOpen(true);
    };
    window.addEventListener('open-command-palette', handleOpenPalette);
    return () => window.removeEventListener('open-command-palette', handleOpenPalette);
  }, []);

  const items: CommandItem[] = [
    // Pages Navigation
    { name: 'Go to Dashboard', category: 'Navigation', icon: LayoutDashboard, action: () => navigate('/dashboard') },
    { name: 'Open POS Express Terminal', category: 'Navigation', icon: ShoppingCart, action: () => navigate('/pos') },
    { name: 'Cash Register Drawer Management', category: 'Navigation', icon: DollarSign, action: () => navigate('/cash') },
    { name: 'Double Entry Journal Books', category: 'Navigation', icon: BookOpen, action: () => navigate('/accounting') },
    { name: 'Chart of Accounts Ledger', category: 'Navigation', icon: FileText, action: () => navigate('/coa') },
    { name: 'Inventory stocks & warehousing', category: 'Navigation', icon: Package, action: () => navigate('/inventory') },
    { name: 'Customer profiles & credits', category: 'Navigation', icon: Users, action: () => navigate('/customers') },
    { name: 'Suppliers Procurement & Vendors', category: 'Navigation', icon: Truck, action: () => navigate('/suppliers') },
    { name: 'Sales & profit reports', category: 'Navigation', icon: FileText, action: () => navigate('/reports') },
    { name: 'Helpdesk messenger chat', category: 'Navigation', icon: MessageSquare, action: () => navigate('/messenger') },
    
    // Core Settings Tabs
    { name: 'Configure Business Profile', category: 'Settings Info', icon: Store, action: () => navigate('/settings?tab=business') },
    { name: 'Billing details & subscriptions', category: 'Settings Info', icon: CreditCard, action: () => navigate('/settings?tab=billing') },
    { name: 'ZIMRA Taxation & VAT codes', category: 'Settings Info', icon: FileText, action: () => navigate('/settings?tab=taxation') },
    { name: 'Multiple currency values', category: 'Settings Info', icon: Coins, action: () => navigate('/settings?tab=currency') },
    { name: 'Authorized branches & stores', category: 'Settings Info', icon: Store, action: () => navigate('/settings?tab=branches') },
    { name: 'System users & operator staff', category: 'Settings Info', icon: Users, action: () => navigate('/settings?tab=users') },
    { name: 'Roles & security authorization profiles', category: 'Settings Info', icon: Shield, action: () => navigate('/settings?tab=roles') },
    { name: 'POS hardware receipt preferences', category: 'Settings Info', icon: Settings, action: () => navigate('/settings?tab=pos') },
    { name: 'Themes, dark-mode & branding logos', category: 'Settings Info', icon: Palette, action: () => navigate('/settings?tab=themes') },
    { name: 'Security parameters & database backups', category: 'Settings Info', icon: Lock, action: () => navigate('/settings?tab=security') },
    { name: 'Zapier, WooCommerce & payment API connections', category: 'Settings Info', icon: Compass, action: () => navigate('/settings?tab=integrations') },
    { name: 'Customer support, email & developer contacts', category: 'Settings Info', icon: Settings, action: () => navigate('/settings?tab=support') },
    
    // Developer Shortcut
    { name: 'Systems Developer Command Headquarters', category: 'System Action', icon: Terminal, action: () => navigate('/dev-portal') },
  ];

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="p-0 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl max-w-xl shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100">
        <DialogHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center gap-2.5">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            type="text"
            className="w-full bg-transparent border-0 outline-none text-zinc-900 dark:text-zinc-100 text-sm placeholder:text-zinc-400 select-all"
            placeholder="Type a screen or settings page to find..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-[10px] font-mono text-zinc-400 border border-zinc-200 dark:border-zinc-700/80 px-1.5 py-0.5 rounded-md shrink-0 uppercase select-none hidden sm:inline">
            ESC
          </span>
        </DialogHeader>

        <DialogDescription className="sr-only">
          Global navigation finder command palette. Type to seek system areas.
        </DialogDescription>

        <div className="max-h-[350px] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs">
              No matching pages or action commands discovered.
            </div>
          ) : (
            <div>
              {/* Grouping by category */}
              {['Navigation', 'Settings Info', 'System Action'].map(cat => {
                const catItems = filteredItems.filter(i => i.category === cat);
                if (catItems.length === 0) return null;

                return (
                  <div key={cat} className="mb-3 last:mb-1">
                    <h3 className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 px-3 mb-1.5 tracking-wider font-sans select-none">
                      {cat === 'Navigation' ? 'Pages & Terminals' : cat === 'Settings Info' ? 'Settings Hub Actions' : 'Developer & Ops Actions'}
                    </h3>
                    <div className="space-y-0.5">
                      {catItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => {
                              item.action();
                              setIsOpen(false);
                            }}
                            className="w-full flex items-center justify-between text-left p-2 px-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 text-xs group transition-colors duration-150 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3">
                              <span className="p-1 px-1.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-550 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 rounded-md transition-colors scale-95">
                                <Icon className="w-4 h-4" />
                              </span>
                              <span className="font-bold text-zinc-700 dark:text-zinc-250 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                {item.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-550 group-hover:text-zinc-500 font-medium">
                              {item.category}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-950 px-4 py-2 border-t border-zinc-100 dark:border-zinc-805 text-zinc-400 dark:text-zinc-450 text-[10.5px] font-sans flex items-center justify-between select-none">
          <span>Search settings tabs directly with labels.</span>
          <span>Press ⌘+K anytime</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
