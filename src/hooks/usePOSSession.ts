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

  const refreshActiveSession = async () => {
    try {
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
          if (activeRS) {
            setActiveSession(activeRS);
          }
        }
      }
    } catch (e) {
      console.error("Failed to refresh active session metrics:", e);
    }
  };

  useEffect(() => {
    const handleSessionRefresh = () => {
      refreshActiveSession();
    };
    window.addEventListener('tareza-session-updated', handleSessionRefresh);
    return () => {
      window.removeEventListener('tareza-session-updated', handleSessionRefresh);
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
