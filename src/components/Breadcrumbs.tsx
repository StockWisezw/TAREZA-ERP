import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);
  const queryParams = new URLSearchParams(location.search);
  const tab = queryParams.get('tab');

  // Prevent breadcrumbs on direct landing / login page
  if (location.pathname === '/' || location.pathname === '/login') {
    return null;
  }

  // Map route segments to human labels
  const routeLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    pos: 'POS Terminal',
    cash: 'Cash Management',
    accounting: 'Journal Entries',
    coa: 'Chart of Accounts',
    inventory: 'Inventory Control',
    customers: 'Customer CRM',
    suppliers: 'Suppliers & Vendors',
    reports: 'Reports & Analytics',
    messenger: 'Staff Chat Messenger',
    settings: 'Settings',
    roadmap: 'Active Sprints & Product Roadmap',
    'dev-portal': 'Developer Headquarters',
  };

  // Map settings tabs to human labels
  const settingsTabLabels: Record<string, string> = {
    business: 'Business Profile',
    billing: 'Billing & Subscription',
    taxation: 'Taxation & VAT compliance',
    currency: 'Currencies',
    branches: 'Branches & Warehouses',
    users: 'Users & Staff Management',
    roles: 'Roles & Permissions',
    pos: 'POS System Config',
    themes: 'Themes & Branding',
    localization: 'Localization',
    notifications: 'Notifications Logs',
    security: 'Security & Auto-Backups',
    integrations: 'API & Integrations',
    support: 'Help & Customer Support',
  };

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1 py-1.5 px-3 mb-4 bg-zinc-50 dark:bg-zinc-900/45 rounded-lg border border-zinc-150 dark:border-zinc-805/50 w-fit text-[11px] font-medium text-zinc-500 dark:text-zinc-400 select-none animate-fade-in">
      <Link
        to="/dashboard"
        className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <Home className="w-3 h-3" />
        <span>Home</span>
      </Link>

      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const label = routeLabels[value] || value.charAt(0).toUpperCase() + value.slice(1);

        // For settings page, check if we has tab query param
        const isSettingsPage = value === 'settings';
        const displayTabLabel = isSettingsPage && tab ? settingsTabLabels[tab] : null;

        return (
          <React.Fragment key={to}>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 shrink-0" />
            
            {last && !displayTabLabel ? (
              <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[150px] sm:max-w-[250px]">
                {label}
              </span>
            ) : (
              <Link
                to={to}
                className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors truncate max-w-[120px] sm:max-w-[200px]"
              >
                {label}
              </Link>
            )}

            {isSettingsPage && displayTabLabel && (
              <React.Fragment key="settings-tab">
                <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 shrink-0" />
                <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[150px] sm:max-w-[250px]">
                  {displayTabLabel}
                </span>
              </React.Fragment>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
