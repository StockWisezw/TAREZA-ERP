import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { 
  Building2, 
  Calculator, 
  Coins, 
  Store, 
  Users, 
  Shield, 
  Settings2, 
  Bell, 
  Lock, 
  Puzzle, 
  Palette,
  Globe,
  CreditCard,
  Search,
  Megaphone,
  X,
  BookOpen
} from 'lucide-react';

interface SettingsSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    title: 'Core Settings',
    items: [
      { id: 'business', label: 'Business Profile', icon: Building2, description: 'E-signature, headers and business registration details' },
      { id: 'branches', label: 'Branches & Warehouses', icon: Store, description: 'Define logical retail spaces and inventory stores' },
      { id: 'pos', label: 'POS Settings', icon: Settings2, description: 'Speed actions, printers and local preferences' },
      { id: 'taxation', label: 'Taxation & VAT', icon: Calculator, description: 'ZIMRA fiscal systems and custom tax codes' },
      { id: 'currency', label: 'Currencies', icon: Coins, description: 'Exchange index rates and multi-curr preferences' },
      { id: 'themes', label: 'Themes & Branding', icon: Palette, description: 'Color schemas and primary brand styles' },
      { id: 'localization', label: 'Localization', icon: Globe, description: 'UTC zones, date formats and language settings' },
    ]
  },
  {
    title: 'Team & Roles',
    items: [
      { id: 'users', label: 'Users & Staff', icon: Users, description: 'Handle manager, cashier and inventory staff permissions' },
      { id: 'roles', label: 'Roles & Permissions', icon: Shield, description: 'Granular policy profiles' },
    ]
  },
  {
    title: 'Integrations',
    items: [
      { id: 'integrations', label: 'Integrations', icon: Puzzle, description: 'Paynow, WooCommerce, and developer API secret keys' }
    ]
  },
  {
    title: 'Billing & Management',
    items: [
      { id: 'billing', label: 'Billing & Subscription', icon: CreditCard, description: 'Renew plans, billing invoices and historical ledgers' },
      { id: 'security', label: 'Security & Backups', icon: Lock, description: 'Password, logs and manual/automatic database backups' },
      { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Track internal alerts and activity logs' },
      { id: 'support', label: 'Help & Support', icon: Bell, description: 'Filing tickets, helpdocs and live developers support' },
      { id: 'tutorials', label: 'Tutorials & Staff Training', icon: BookOpen, description: 'Step-by-step master guides with examples for all modules' },
    ]
  }
];

export function SettingsSidebar({ activeTab, setActiveTab }: SettingsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Extract flat list of items for quick search matching
  const allItems = groups.flatMap(group => group.items);

  const filteredItems = searchQuery.trim() === ''
    ? null
    : allItems.filter(item => 
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );

  return (
    <div className="space-y-4 min-w-[220px] select-none">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
        <input
          type="text"
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400"
        />
        {searchQuery && (
          <button 
            type="button" 
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 p-0.5 rounded-full"
          >
            <X className="h-3 w-3 text-zinc-400" />
          </button>
        )}
      </div>

      <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-4">
        {filteredItems !== null ? (
          /* Search Results */
          <div className="space-y-1 w-full">
            <h4 className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider px-2 mb-2 select-none">
              Search Results ({filteredItems.length})
            </h4>
            {filteredItems.length === 0 ? (
              <p className="text-[11px] text-zinc-400 px-2 italic">No sections match your query.</p>
            ) : (
              filteredItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setSearchQuery('');
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold transition-colors w-full text-left cursor-pointer",
                      activeTab === item.id
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-450 border border-indigo-100 dark:border-indigo-900/40"
                        : "text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 border border-transparent"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <div>
                      <p className="font-bold leading-tight">{item.label}</p>
                      <p className="text-[9.5px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5 max-w-[190px] truncate leading-none">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* Grouped Categories Navigation */
          groups.map((group) => (
            <div key={group.title} className="space-y-1 w-full">
              <h4 className="text-[9.5px] uppercase font-black text-zinc-405 dark:text-zinc-550 px-2.5 tracking-wider select-none mb-1.5 font-sans">
                {group.title}
              </h4>
              <div className="space-y-0.5 lg:space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      title={item.description}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.8 text-xs font-bold transition-colors w-full text-left cursor-pointer",
                        activeTab === item.id
                          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 border-l-2 border-indigo-500 pl-2"
                          : "text-zinc-550 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-zinc-50 border-l-2 border-transparent"
                      )}
                    >
                      <Icon className="h-3.8/10 w-3.8/10 shrink-0 text-zinc-400 dark:text-zinc-500" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </nav>
    </div>
  );
}
