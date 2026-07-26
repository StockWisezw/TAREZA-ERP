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
import { TutorialsSettings } from '../components/settings/TutorialsSettings';
import { Separator } from '../components/ui/separator';
import { useSubscription } from '../hooks/useSubscription';
import { PremiumLockBanner } from '../components/common/PremiumBadge';

export default function Settings() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('business');
  const { isUnlocked } = useSubscription();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tabParam = queryParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const renderContent = () => {
    let content = null;
    let locked = false;
    let requiredTier: 'PRO' | 'ENTERPRISE' = 'PRO';
    let title = '';

    if (activeTab === 'roles') {
      locked = !isUnlocked('roles');
      requiredTier = 'PRO';
      title = 'Custom Roles & RBAC Policy Profiles';
    } else if (activeTab === 'security') {
      locked = !isUnlocked('security');
      requiredTier = 'PRO';
      title = 'Automated Security & Database Backups';
    } else if (activeTab === 'integrations') {
      locked = !isUnlocked('integrations');
      requiredTier = 'ENTERPRISE';
      title = 'Developer API Keys & Paynow Gateways';
    }

    switch (activeTab) {
      case 'business': content = <BusinessProfile />; break;
      case 'billing': content = <BillingSettings />; break;
      case 'taxation': content = <TaxationSettings />; break;
      case 'currency': content = <CurrencySettings />; break;
      case 'branches': content = <BranchWarehouseSettings />; break;
      case 'users': content = <UserManagement />; break;
      case 'roles': content = <RolesPermissions />; break;
      case 'pos': content = <PosSettings />; break;
      case 'themes': content = <ThemeSettings />; break;
      case 'localization': content = <LocalizationSettings />; break;
      case 'notifications': content = <NotificationSettings />; break;
      case 'security': content = <SecuritySettings />; break;
      case 'integrations': content = <IntegrationSettings />; break;
      case 'support': content = <SupportSettings />; break;
      case 'tutorials': content = <TutorialsSettings />; break;
      default: content = <BusinessProfile />; break;
    }

    return (
      <div className="space-y-4">
        {locked && (
          <PremiumLockBanner featureTitle={title} requiredTier={requiredTier} />
        )}
        {content}
      </div>
    );
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
