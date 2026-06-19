import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  getOpenRegisterSession, 
  openRegisterSession, 
  closeRegisterSession 
} from '../services/ledgerService';
import { supabase } from '../lib/firebaseClient';

export interface RegisterSession {
  id: string;
  business_id: string;
  branch_id: string;
  cashier_id: string;
  opened_at: string;
  opening_balance: number;
  expected_balance: number;
  closed_at: string | null;
  closing_balance: number | null;
  sales_count: number;
  variance: number | null;
}

export function usePOSSession() {
  const [activeSession, setActiveSession] = useState<RegisterSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [openingFloat, setOpeningFloat] = useState('100');
  const [requireFloat, setRequireFloat] = useState(false);
  const [closingActual, setClosingActual] = useState('');
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showShiftDetails, setShowShiftDetails] = useState(false);

  const getIsOffline = () => {
    return localStorage.getItem('tareza_offline_mode') === 'true' || (typeof window !== 'undefined' && !window.navigator.onLine);
  };

  const refreshActiveSession = async () => {
    try {
      if (getIsOffline()) {
        const storedOffActive = localStorage.getItem('tareza_active_offline_session') || localStorage.getItem('tareza_active_session_cache');
        if (storedOffActive) {
          const parsed = JSON.parse(storedOffActive);
          setActiveSession(parsed);
          if (!localStorage.getItem('tareza_active_offline_session')) {
            localStorage.setItem('tareza_active_offline_session', JSON.stringify(parsed));
          }
        } else {
          setActiveSession(null);
        }
        return;
      }

      const { data: userContext } = await supabase.auth.getUser();
      if (userContext?.user) {
        const { data: userBusiness } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userContext.user.id)
          .limit(1)
          .maybeSingle();
        if (userBusiness?.business_id) {
          const activeRS = await getOpenRegisterSession(userBusiness.business_id, userContext.user.id);
          setActiveSession(activeRS || null);
          if (activeRS) {
            localStorage.setItem('tareza_active_session_cache', JSON.stringify(activeRS));
          } else {
            localStorage.removeItem('tareza_active_session_cache');
          }
        }
      }
    } catch (e) {
      console.error("Failed to refresh active session metrics:", e);
    }
  };

  // Check and load active register session on mount
  useEffect(() => {
    let active = true;
    const initSession = async () => {
      try {
        setSessionLoading(true);

        // Check offline first
        if (getIsOffline()) {
          const storedOffActive = localStorage.getItem('tareza_active_offline_session') || localStorage.getItem('tareza_active_session_cache');
          if (storedOffActive && active) {
            const parsed = JSON.parse(storedOffActive);
            setActiveSession(parsed);
            if (!localStorage.getItem('tareza_active_offline_session')) {
              localStorage.setItem('tareza_active_offline_session', JSON.stringify(parsed));
            }
          } else if (active) {
            setActiveSession(null);
          }
          return;
        }

        const { data: userContext } = await supabase.auth.getUser();
        if (!active) return;
        if (userContext?.user) {
          const { data: userBusiness } = await supabase
            .from('business_users')
            .select('business_id')
            .eq('user_id', userContext.user.id)
            .limit(1)
            .maybeSingle();
          if (!active) return;
          if (userBusiness?.business_id) {
            const activeRS = await getOpenRegisterSession(userBusiness.business_id, userContext.user.id);
            if (!active) return;
            setActiveSession(activeRS || null);
            if (activeRS) {
              localStorage.setItem('tareza_active_session_cache', JSON.stringify(activeRS));
            } else {
              localStorage.removeItem('tareza_active_session_cache');
            }
          } else {
            setActiveSession(null);
          }
        } else {
          setActiveSession(null);
        }
      } catch (e) {
        console.error("Failed to load active register session on mount:", e);
      } finally {
        if (active) {
          setSessionLoading(false);
        }
      }
    };

    initSession();

    // Listen to manual offline mode toggles
    const handleOfflineToggle = () => {
      initSession();
    };
    window.addEventListener('offline-mode-changed', handleOfflineToggle);

    // Auto-switch to offline/online when network changes
    const handleAutoOffline = () => {
      localStorage.setItem('tareza_offline_mode', 'true');
      toast.info('Network connection lost! Automatically switched to OFFLINE mode.');
      window.dispatchEvent(new Event('offline-mode-changed'));
    };

    const handleAutoOnline = () => {
      localStorage.setItem('tareza_offline_mode', 'false');
      toast.success('Network connection restored! Automatically restored ONLINE mode.');
      window.dispatchEvent(new Event('offline-mode-changed'));
    };

    window.addEventListener('offline', handleAutoOffline);
    window.addEventListener('online', handleAutoOnline);

    return () => {
      active = false;
      window.removeEventListener('offline-mode-changed', handleOfflineToggle);
      window.removeEventListener('offline', handleAutoOffline);
      window.removeEventListener('online', handleAutoOnline);
    };
  }, []);

  useEffect(() => {
    const handleSessionRefresh = () => {
      refreshActiveSession();
    };
    window.addEventListener('tareza-session-updated', handleSessionRefresh);
    window.addEventListener('offline-mode-changed', handleSessionRefresh);
    return () => {
      window.removeEventListener('tareza-session-updated', handleSessionRefresh);
      window.removeEventListener('offline-mode-changed', handleSessionRefresh);
    };
  }, []);

  // Check state requirement on mount
  useEffect(() => {
    const req = localStorage.getItem('tareza_require_float') === 'true';
    setRequireFloat(req);
    if (!req) {
      setOpeningFloat('0');
    }
  }, []);

  const handleStartShift = async () => {
    try {
      const floatVal = parseFloat(openingFloat) || 0;
      if (requireFloat && (!openingFloat || floatVal <= 0)) {
        toast.error('Starting cash float is required. Please type an opening amount first.');
        return false;
      }
      if (isNaN(floatVal) || floatVal < 0) {
        toast.error('Please input a valid opening balance float (non-negative).');
        return false;
      }
      const { data: userData } = await supabase.auth.getUser();
      
      const isCurrentlyOffline = getIsOffline();

      // Implement offline shift startup if offline mode is triggered
      if (isCurrentlyOffline) {
        const offSessionId = 'off-shift-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString().slice(-4);
        const offlineShiftObj: RegisterSession & { is_offline: boolean; synced: boolean } = {
          id: offSessionId,
          business_id: 'offline_business_id',
          branch_id: 'offline_branch_id',
          cashier_id: userData?.user?.id || 'offline_cashier_id',
          opened_at: new Date().toISOString(),
          opening_balance: floatVal,
          expected_balance: floatVal,
          closed_at: null,
          closing_balance: null,
          sales_count: 0,
          variance: 0,
          is_offline: true,
          synced: false
        };

        // Save active session
        localStorage.setItem('tareza_active_offline_session', JSON.stringify(offlineShiftObj));

        // Append to local shifts log history for future manual synchronizations
        const savedShiftsArrRaw = localStorage.getItem('tareza_offline_shifts_uncollapsed');
        const shiftsArr = savedShiftsArrRaw ? JSON.parse(savedShiftsArrRaw) : [];
        shiftsArr.push(offlineShiftObj);
        localStorage.setItem('tareza_offline_shifts_uncollapsed', JSON.stringify(shiftsArr));

        setActiveSession(offlineShiftObj);
        toast.success(`Active OFFLINE register session successfully initialized with float $${floatVal.toFixed(2)}. Running locally.`);
        window.dispatchEvent(new Event('offline-mode-changed'));
        return true;
      }

      if (!userData?.user) {
        toast.error('Session error: Could not verify user authentic token.');
        return false;
      }
      
      const { data: businessData } = await supabase.from('business_users')
        .select('business_id, branch_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      let bid = businessData?.business_id;
      let brid = businessData?.branch_id;

      if (!bid || bid === 'default_business') {
        const { data: fallbackB } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
        if (fallbackB?.id) {
          bid = fallbackB.id;
        } else {
          const { data: newB } = await supabase.from('businesses').insert({ name: 'Default Business' }).select().single();
          if (newB) {
            bid = newB.id;
          }
        }
      }

      if (bid && (!brid || brid === 'default_branch')) {
        const { data: fallbackBr } = await supabase.from('branches').select('id').eq('business_id', bid).limit(1).maybeSingle();
        if (fallbackBr?.id) {
          brid = fallbackBr.id;
        } else {
          const { data: newBr } = await supabase.from('branches').insert({ business_id: bid, name: 'Default Branch' }).select().single();
          if (newBr) {
            brid = newBr.id;
          }
        }
      }

      const res = await openRegisterSession(bid || '00000000-0000-0000-0000-000000000000', brid || '00000000-0000-0000-0000-000000000000', userData.user.id, floatVal);
      if (res.success) {
        setActiveSession(res.session);
        toast.success(`Active register session successfully started with float $${floatVal.toFixed(2)}.`);
        return true;
      } else {
        toast.error(res.error || 'Failed to start register session.');
        return false;
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred starting register shift session.');
      return false;
    }
  };

  const handleEndShift = async () => {
    if (!activeSession) return false;
    try {
      const actualVal = parseFloat(closingActual);
      if (isNaN(actualVal) || actualVal < 0) {
        toast.error('Please input a valid closing drawer counter float.');
        return false;
      }

      if (getIsOffline() || activeSession.id.startsWith('off-shift-')) {
        // Complete shift session locally
        const updatedOfflineSession = {
          ...activeSession,
          closed_at: new Date().toISOString(),
          closing_balance: actualVal,
          variance: actualVal - activeSession.expected_balance
        };

        // Remove active offline session, keep the record in uncollapsed array
        localStorage.removeItem('tareza_active_offline_session');

        const savedShiftsArrRaw = localStorage.getItem('tareza_offline_shifts_uncollapsed') || '[]';
        let shiftsArr = JSON.parse(savedShiftsArrRaw);
        shiftsArr = shiftsArr.map((s: any) => s.id === activeSession.id ? updatedOfflineSession : s);
        localStorage.setItem('tareza_offline_shifts_uncollapsed', JSON.stringify(shiftsArr));

        setActiveSession(null);
        setClosingActual('');
        setShowCloseShift(false);
        toast.success(`Offline shift successfully completed! Total Expected: $${updatedOfflineSession.expected_balance.toFixed(2)}, Actual counted: $${actualVal.toFixed(2)}, Variance: $${updatedOfflineSession.variance.toFixed(2)}. Saved offline queue for manual sync.`);
        window.dispatchEvent(new Event('offline-mode-changed'));
        return true;
      }

      const res = await closeRegisterSession(activeSession.id, actualVal);
      if (res.success) {
        setActiveSession(null);
        setClosingActual('');
        setShowCloseShift(false);
        toast.success(`Active Shift successfully ended! Total Expected: $${res.session.expected_balance.toFixed(2)}, Actual Drawer Float: $${actualVal.toFixed(2)}, Shift Variance Code Over/Short: $${res.session.variance.toFixed(2)}.`);
        return true;
      } else {
        toast.error(res.error || 'Failed to end register session safely.');
        return false;
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred during final shift audit closure.');
      return false;
    }
  };

  return {
    activeSession,
    setActiveSession,
    sessionLoading,
    setSessionLoading,
    openingFloat,
    setOpeningFloat,
    requireFloat,
    setRequireFloat,
    closingActual,
    setClosingActual,
    showCloseShift,
    setShowCloseShift,
    showShiftDetails,
    setShowShiftDetails,
    handleStartShift,
    handleEndShift,
    refreshActiveSession,
  };
}
