import React from 'react';
import { cn } from '../../lib/utils';
import { 
  Building2, 
  Calculator, 
  Coins, 
  Store, 
  Users, 
  Shield, 
  Receipt, 
  Settings2, 
  Bell, 
  Lock, 
  Puzzle, 
  Bot,
  Palette,
  Globe,
  CreditCard
} from 'lucide-react';

interface SettingsSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const navItems = [
  { id: 'business', label: 'Business Profile', icon: Building2 },
  { id: 'billing', label: 'Billing & Subscription', icon: CreditCard },
  { id: 'taxation', label: 'Taxation & VAT', icon: Calculator },
  { id: 'currency', label: 'Currencies', icon: Coins },
  { id: 'branches', label: 'Branches & Warehouses', icon: Store },
  { id: 'users', label: 'Users & Staff', icon: Users },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  { id: 'pos', label: 'POS Settings', icon: Settings2 },
  { id: 'themes', label: 'Themes & Branding', icon: Palette },
  { id: 'localization', label: 'Localization', icon: Globe },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security & Backups', icon: Lock },
  { id: 'integrations', label: 'Integrations', icon: Puzzle },
  { id: 'ai', label: 'AI & Automation', icon: Bot },
  { id: 'support', label: 'Help & Support', icon: Bell },
];

export function SettingsSidebar({ activeTab, setActiveTab }: SettingsSidebarProps) {
  return (
    <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors w-full text-left whitespace-nowrap",
              activeTab === item.id
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
