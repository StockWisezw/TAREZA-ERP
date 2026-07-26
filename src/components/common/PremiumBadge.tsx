import React from 'react';
import { Crown, Lock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';

interface PremiumBadgeProps {
  tier: 'STARTER' | 'PRO' | 'ENTERPRISE';
  className?: string;
  showIcon?: boolean;
}

export function PremiumBadge({ tier, className = '', showIcon = true }: PremiumBadgeProps) {
  if (tier === 'STARTER') return null;

  if (tier === 'ENTERPRISE') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-400/30 ${className}`}>
        {showIcon && <Crown className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />}
        <span>ENT</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-400/30 ${className}`}>
      {showIcon && <Crown className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />}
      <span>PRO</span>
    </span>
  );
}

interface PremiumLockBannerProps {
  featureTitle: string;
  requiredTier: 'PRO' | 'ENTERPRISE';
  compact?: boolean;
}

export function PremiumLockBanner({ featureTitle, requiredTier, compact = false }: PremiumLockBannerProps) {
  const navigate = useNavigate();

  if (compact) {
    return (
      <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-2 text-xs my-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-zinc-900 dark:text-white">
            {featureTitle} requires <span className="text-amber-600 dark:text-amber-400 uppercase font-black">{requiredTier}</span> plan.
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => navigate('/settings?tab=billing')}
          className="h-7 text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg px-3"
        >
          Upgrade Plan
        </Button>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/80 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-amber-50/60 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-amber-950/30 shadow-sm space-y-3 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Crown className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                {featureTitle}
              </h3>
              <PremiumBadge tier={requiredTier} />
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
              This feature is active in Tareza ERP <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase">{requiredTier}</span> tier. All functions remain visible for team evaluation. Upgrade your subscription to unlock full action privileges.
            </p>
          </div>
        </div>

        <Button
          onClick={() => navigate('/settings?tab=billing')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4 rounded-xl shrink-0 shadow-sm flex items-center gap-1.5"
        >
          <span>Upgrade in Billing</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
