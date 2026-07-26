import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/firebaseClient';
import { toast } from 'sonner';

export type SubscriptionPlan = 'free' | 'free_trial' | 'starter' | 'pro' | 'enterprise';

export type FeatureKey = 
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'support'
  | 'cash'
  | 'accounting'
  | 'coa'
  | 'reports'
  | 'messenger'
  | 'roles'
  | 'security'
  | 'gmail'
  | 'ai_assistant'
  | 'integrations'
  | 'bulk_export'
  | 'multi_warehouse';

export const FEATURE_TIERS: Record<FeatureKey, { tier: 'STARTER' | 'PRO' | 'ENTERPRISE'; title: string }> = {
  dashboard: { tier: 'STARTER', title: 'Dashboard' },
  pos: { tier: 'STARTER', title: 'POS Terminal' },
  inventory: { tier: 'STARTER', title: 'Inventory Control' },
  customers: { tier: 'STARTER', title: 'Customer CRM' },
  suppliers: { tier: 'STARTER', title: 'Suppliers & Receiving' },
  support: { tier: 'STARTER', title: 'Help & Support' },

  cash: { tier: 'PRO', title: 'Cash Management & Blind Till Audits' },
  accounting: { tier: 'PRO', title: 'Double-Entry Journal Ledgers' },
  coa: { tier: 'PRO', title: 'Chart of Accounts' },
  reports: { tier: 'PRO', title: 'Financial Analytics & Profit Reports' },
  messenger: { tier: 'PRO', title: 'Staff Internal Messenger' },
  roles: { tier: 'PRO', title: 'Custom RBAC Roles & Permissions' },
  security: { tier: 'PRO', title: 'Automated Database Backups' },
  bulk_export: { tier: 'PRO', title: 'Bulk CSV Import & Audit Export' },
  multi_warehouse: { tier: 'PRO', title: 'Multi-Branch Inventory Transfer' },

  gmail: { tier: 'ENTERPRISE', title: 'Gmail Inbox Workspace Integration' },
  ai_assistant: { tier: 'ENTERPRISE', title: 'AI Smart ERP Assistant' },
  integrations: { tier: 'ENTERPRISE', title: 'Paynow Gateway & Developer API Keys' },
};

export function useSubscription() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan>('starter');
  const [loading, setLoading] = useState<boolean>(true);

  // Check superadmin email override
  const isSuperAdmin = !!user?.email && [
    'admin@tarezaerp.co.zw',
    'sales@tarezaerp.co.zw',
    'tapsforex@gmail.com',
    'tapiwagahadza54@gmail.com'
  ].includes(user.email.toLowerCase());

  useEffect(() => {
    let isMounted = true;
    async function loadPlan() {
      if (!user) {
        if (isMounted) {
          setPlan('starter');
          setLoading(false);
        }
        return;
      }

      if (isSuperAdmin) {
        if (isMounted) {
          setPlan('enterprise');
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        // Find business for current user
        const { data: bUser } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', user.$id)
          .limit(1)
          .maybeSingle();

        if (bUser?.business_id) {
          const { data: bData } = await supabase
            .from('businesses')
            .select('subscription_plan')
            .eq('id', bUser.business_id)
            .single();

          if (bData?.subscription_plan && isMounted) {
            setPlan(bData.subscription_plan as SubscriptionPlan);
          }
        }
      } catch (err) {
        console.error('Error fetching subscription plan:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPlan();
    return () => {
      isMounted = false;
    };
  }, [user, isSuperAdmin]);

  const isUnlocked = (featureKey: FeatureKey): boolean => {
    if (isSuperAdmin) return true;

    const req = FEATURE_TIERS[featureKey]?.tier || 'STARTER';
    if (req === 'STARTER') return true;

    if (req === 'PRO') {
      return plan === 'pro' || plan === 'enterprise';
    }

    if (req === 'ENTERPRISE') {
      return plan === 'enterprise';
    }

    return true;
  };

  const getFeatureTier = (featureKey: FeatureKey): 'STARTER' | 'PRO' | 'ENTERPRISE' => {
    return FEATURE_TIERS[featureKey]?.tier || 'STARTER';
  };

  const checkAccess = (featureKey: FeatureKey, customTitle?: string): boolean => {
    if (isUnlocked(featureKey)) return true;

    const title = customTitle || FEATURE_TIERS[featureKey]?.title || 'This feature';
    const reqTier = getFeatureTier(featureKey);

    toast.error(`🔒 Premium Feature: "${title}" requires a ${reqTier} Plan Subscription. Please upgrade in Billing Settings to access this function.`);
    return false;
  };

  return {
    plan,
    isSuperAdmin,
    loading,
    isUnlocked,
    getFeatureTier,
    checkAccess,
  };
}
