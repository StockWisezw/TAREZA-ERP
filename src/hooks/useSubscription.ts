import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/firebaseClient';
import { toast } from 'sonner';

export type SubscriptionPlan = 'free' | 'free_trial' | 'starter' | 'pro' | 'enterprise' | 'expired' | 'suspended';

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
  const [status, setStatus] = useState<string>('active');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Superadmin email check
  const isSuperAdmin = !!user?.email && [
    'admin@tarezaerp.co.zw',
    'sales@tarezaerp.co.zw',
    'tapsforex@gmail.com',
    'tapiwagahadza54@gmail.com'
  ].includes(user.email.toLowerCase());

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    let isMounted = true;

    async function subscribeToFirebaseSubscription() {
      if (!user) {
        if (isMounted) {
          setPlan('starter');
          setStatus('active');
          setLoading(false);
        }
        return;
      }

      if (isSuperAdmin) {
        if (isMounted) {
          setPlan('enterprise');
          setStatus('active');
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);

        const userId = user.$id;
        
        // Check subscriptions table directly using user ID
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (subData) {
          const subPlan = subData.plan || subData.subscription_plan || 'starter';
          const subStatus = subData.status || 'active';
          const expDate = subData.expires_at || subData.expiresAt || null;

          if (isMounted) {
            setPlan(subPlan as SubscriptionPlan);
            setStatus(subStatus);
            setExpiresAt(expDate);

            if (expDate && new Date(expDate) < new Date()) {
              setStatus('expired');
            }
            setLoading(false);
          }
        } else {
          // Check business_id level subscription
          const { data: bUser } = await supabase
            .from('business_users')
            .select('business_id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

          if (bUser?.business_id) {
            const { data: bizSub } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('id', bUser.business_id)
              .maybeSingle();

            if (bizSub) {
              if (isMounted) {
                setPlan((bizSub.plan || bizSub.subscription_plan || 'starter') as SubscriptionPlan);
                setStatus(bizSub.status || 'active');
                setExpiresAt(bizSub.expires_at || null);
              }
            } else {
              const { data: bData } = await supabase
                .from('businesses')
                .select('subscription_plan')
                .eq('id', bUser.business_id)
                .maybeSingle();

              if (isMounted && bData?.subscription_plan) {
                setPlan(bData.subscription_plan as SubscriptionPlan);
              }
            }
          }
          if (isMounted) setLoading(false);
        }

      } catch (err) {
        console.error('Error fetching subscription plan from Firebase:', err);
        if (isMounted) setLoading(false);
      }
    }

    subscribeToFirebaseSubscription();

    return () => {
      isMounted = false;
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [user, isSuperAdmin]);

  const isUnlocked = (featureKey: FeatureKey): boolean => {
    if (isSuperAdmin) return true;
    if (status === 'suspended' || status === 'expired' || status === 'canceled' || plan === 'expired' || plan === 'suspended') {
      return false;
    }
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return false;
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

    if (status === 'suspended') {
      toast.error(`🛑 Account Suspended: Your subscription has been paused in Firebase Console. Please contact sales@tarezaerp.co.zw to reactivate.`);
    } else if (status === 'expired' || (expiresAt && new Date(expiresAt) < new Date())) {
      toast.error(`⏰ Subscription Expired: Your plan validity has ended. Extend your subscription in Firebase or contact support.`);
    } else {
      toast.error(`🔒 Premium Feature: "${title}" requires a ${reqTier} Plan Subscription.`);
    }
    return false;
  };

  return {
    plan,
    status,
    expiresAt,
    isSuperAdmin,
    loading,
    isUnlocked,
    getFeatureTier,
    checkAccess,
  };
}
