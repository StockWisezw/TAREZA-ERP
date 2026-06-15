import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SettingsSidebar } from '../components/settings/SettingsSidebar';
import { BusinessProfile } from '../components/settings/BusinessProfile';
import { BillingSettings } from '../components/settings/BillingSettings';
import { TaxationSettings } from '../components/settings/TaxationSettings';
import { CurrencySettings } from '../components/settings/CurrencySettings';
import { BranchWarehouseSettings } from '../components/settings/BranchWarehouseSettings';
import { UserManagement } from '../components/settings/UserManagement';
import { RolesPermissions } from '../components/settings/RolesPermissions';
import { PosSettings } from '../components/settings/PosSettings';
import { ThemeSettings } from '../components/settings/ThemeSettings';
import { LocalizationSettings } from '../components/settings/LocalizationSettings';
import { NotificationSettings } from '../components/settings/NotificationSettings';
import { SecuritySettings } from '../components/settings/SecuritySettings';
import { IntegrationSettings } from '../components/settings/IntegrationSettings';
import { SupportSettings } from '../components/settings/SupportSettings';
import { MarketingSettings } from '../components/settings/MarketingSettings';
import { Separator } from '../components/ui/separator';

export default function Settings() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('business');

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tabParam = queryParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const renderContent = () => {
    switch (activeTab) {
      case 'business': return <BusinessProfile />;
      case 'billing': return <BillingSettings />;
      case 'taxation': return <TaxationSettings />;
      case 'currency': return <CurrencySettings />;
      case 'branches': return <BranchWarehouseSettings />;
      case 'users': return <UserManagement />;
      case 'roles': return <RolesPermissions />;
      case 'pos': return <PosSettings />;
      case 'themes': return <ThemeSettings />;
      case 'localization': return <LocalizationSettings />;
      case 'notifications': return <NotificationSettings />;
      case 'security': return <SecuritySettings />;
      case 'integrations': return <IntegrationSettings />;
      case 'support': return <SupportSettings />;
      case 'marketing': return <MarketingSettings />;
      default: return <BusinessProfile />;
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-10 pb-16">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-zinc-500 dark:text-zinc-400">
          Manage your enterprise configuration, branches, users, and compliance settings.
        </p>
      </div>
      <Separator className="my-6" />
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="lg:w-1/5 shrink-0 overflow-x-auto lg:h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-4 custom-scrollbar pb-2">
          <SettingsSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </aside>
        <div className="flex-1 lg:max-w-4xl lg:h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-2 custom-scrollbar">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
