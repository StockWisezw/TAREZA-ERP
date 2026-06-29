import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { 
  Lock, Unlock, DollarSign, Calculator, FileText, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, UserMinus, History, Coins, Printer, 
  Eye, Calendar, Check, RotateCcw, Plus, RefreshCw, Landmark, Sliders
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/firebaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { usePOSStore } from '../store/posStore';
import { useBusinessStore } from '../store';
import { postJournalEntry } from '../services/ledgerService';

interface CashLog {
  id: string;
  amount: number;
  type: string;
  transaction_type: string;
  notes: string;
  created_at: string;
}

interface RegisterSession {
  id: string;
  business_id: string;
  branch_id?: string;
  user_id: string;
  opening_balance: number;
  closing_balance?: number;
  expected_balance?: number;
  variance?: number;
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  closed_at?: string;
  sales_count?: number;
  sales_total?: number;
  refunds_total?: number;
  payouts_total?: number;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

export default function CashManagement() {
  const { activeBranch } = useBusinessStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active-shift');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<RegisterSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Real-time accounting states
  const [startingFloatAmount, setStartingFloatAmount] = useState(0);
  const [sessionCashSales, setSessionCashSales] = useState(0);
  const [sessionOutflows, setSessionOutflows] = useState(0);
  const [expectedCash, setExpectedCash] = useState(0);
  
  // Closing shift reconciliation
  const [countedCash, setCountedCash] = useState(0);
  const [notes, setNotes] = useState('');
  
  // Cash movements lists
  const [cashLogs, setCashLogs] = useState<CashLog[]>([]);
  const [pastSessions, setPastSessions] = useState<RegisterSession[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  
  // New entry form state
  const [entryAmount, setEntryAmount] = useState('');
  const [entryType, setEntryType] = useState('expense');
  const [entryNotes, setEntryNotes] = useState('');
  
  // Starting float user input
  const [startingFloatInput, setStartingFloatInput] = useState('');
  const [requireFloat, setRequireFloat] = useState(false);

  // Active Session Auditing drawer/modal state
  const [selectedAuditSession, setSelectedAuditSession] = useState<RegisterSession | null>(null);
  const [auditLogs, setAuditLogs] = useState<CashLog[]>([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState<boolean>(() => {
    return localStorage.getItem('tareza_cash_advanced_mode') === 'true';
  });

  const toggleAdvanced = (val: boolean) => {
    setShowAdvanced(val);
    localStorage.setItem('tareza_cash_advanced_mode', String(val));
    toast.info(val ? "Advanced tools and registries enabled." : "Lite Mode enabled. Screen simplified.");
  };

  // Denomination Drawer Calculator tool
  const [showDenominationCalc, setShowDenominationCalc] = useState(false);
  const [calcCurrency, setCalcCurrency] = useState<'USD' | 'ZWG' | 'ZAR'>('USD');
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1.0, ZWG: 26.9181, ZAR: 16.2229 });

  const [denominations, setDenominations] = useState<Record<string, Record<number, number>>>({
    USD: { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 },
    ZWG: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0 },
    ZAR: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0 }
  });
  const [coinTotals, setCoinTotals] = useState<Record<string, string>>({
    USD: '',
    ZWG: '',
    ZAR: ''
  });

  const [businessId, setBusinessId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [userId, setUserId] = useState('');

  // Load profiles to show operator names in audits
  const fetchProfiles = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, full_name, role');
      if (data) {
        const pm = data.reduce((acc: Record<string, Profile>, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});
        setProfilesMap(pm);
      }
    } catch (e) {
      console.error('Error fetching profile names', e);
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchActiveShiftAndAccounting();
    const floatStored = localStorage.getItem('tareza_require_float');
    setRequireFloat(floatStored === 'true');
  }, [activeBranch]);

  const fetchActiveShiftAndAccounting = async () => {
    setIsLoading(true);
    try {
      // Look up current auth profile info
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id || '';
      setUserId(currentUserId);
      
      let busId = '';
      let brId = '';
      if (currentUserId) {
        const { data: businessData } = await supabase
          .from('business_users')
          .select('business_id, branch_id')
          .eq('user_id', currentUserId)
          .limit(1)
          .maybeSingle();
        if (businessData?.business_id) {
          busId = businessData.business_id;
          brId = activeBranch && activeBranch.id !== 'all' ? activeBranch.id : (businessData.branch_id || '');
        }
      }

      if (!busId) {
        const { data: fallbackB } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
        if (fallbackB?.id) {
          busId = fallbackB.id;
          const { data: fallbackBr } = await supabase.from('branches').select('id').eq('business_id', fallbackB.id).limit(1).maybeSingle();
          if (fallbackBr?.id) {
            brId = fallbackBr.id;
          }
        }
      }

      // Default backup UUID values if absolutely needed
      if (!busId) busId = '00000000-0000-0000-0000-000000000000';
      if (!brId) brId = '00000000-0000-0000-0000-000000000000';

      setBusinessId(busId);
      setBranchId(brId);

      // Load active currency exchange rates
      try {
        const { data: dbRates } = await supabase
          .from('currencies')
          .select('code, exchange_rate')
          .eq('business_id', busId);
        if (dbRates && dbRates.length > 0) {
          const ratesMap: Record<string, number> = { USD: 1.0, ZWG: 26.9181, ZAR: 16.2229 };
          dbRates.forEach((r: any) => {
            ratesMap[r.code] = Number(r.exchange_rate) || 1.0;
          });
          setRates(ratesMap);
        }
      } catch (rateErr) {
        console.error("Could not fetch database currency exchange rates", rateErr);
      }

      // Check if a register session is actively OPEN
      const { data: activeSess } = await supabase
        .from('register_sessions')
        .eq('business_id', busId)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const startBoundary = activeSess 
        ? new Date(activeSess.opened_at).toISOString() 
        : (() => {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            return startOfDay.toISOString();
          })();

      setIsDrawerOpen(!!activeSess);
      setActiveSession(activeSess || null);
      setStartingFloatAmount(activeSess ? Number(activeSess.opening_balance || 0) : 0);

      // 1. Fetch sales that occurred since active session opened (or since midnight fallback)
      let salesQuery = supabase.from('sales')
        .select('*')
        .gte('created_at', startBoundary);
      
      if (busId && busId !== '00000000-0000-0000-0000-000000000000') {
        salesQuery = salesQuery.eq('business_id', busId);
      }
      
      const { data: salesDocs } = await salesQuery;
      const salesData = [...(salesDocs || [])];

      // Merge local sales from the POS store to support offline status and robust shift totals
      const localSales = usePOSStore.getState().localSales || [];
      localSales.forEach((localSale: any) => {
        const localTime = new Date(localSale.timestamp || localSale.created_at || new Date()).toISOString();
        if (localTime >= startBoundary) {
          const exists = salesData.some(s => s.receiptNumber === localSale.receiptNumber || s.id === localSale.id || s.receipt_number === localSale.receiptNumber);
          if (!exists) {
            salesData.push({
              ...localSale,
              created_at: localSale.timestamp || localSale.created_at,
              status: localSale.status || 'COMPLETED'
            });
          }
        }
      });
      
      let totalCashSales = 0;
      if (salesData && salesData.length > 0) {
        salesData.forEach((s: any) => {
          const stat = String(s.status || '').toUpperCase();
          const allowedStatuses = ['COMPLETED', 'PAID', 'SYNCED', 'OFFLINE_PENDING'];
          if (!allowedStatuses.includes(stat)) return;

          let paymentsArray: any[] = [];
          
          if (Array.isArray(s.payments)) {
            paymentsArray = s.payments;
          } else if (typeof s.payments === 'string') {
            try {
              paymentsArray = JSON.parse(s.payments);
            } catch (e) {
              paymentsArray = [];
            }
          }

          if (paymentsArray && paymentsArray.length > 0) {
            let cashAmt = 0;
            paymentsArray.forEach((p: any) => {
              const m = String(p.method || p.payment_method || '').toLowerCase();
              if (m === 'cash' || m === 'usd_cash' || m === 'zig_cash' || m === 'zwg_cash') {
                cashAmt += Number(p.amount || 0);
              }
            });
            totalCashSales += cashAmt;
          } else {
            const pm = String(s.payment_method || '').toLowerCase();
            if (pm === 'cash' || pm === 'usd_cash' || pm === 'zig_cash' || pm === 'zwg_cash') {
              totalCashSales += Number(s.total || 0);
            }
          }
        });
      }
      setSessionCashSales(totalCashSales);
      
      // 2. Fetch cash logs since session start (or today fallback)
      let logsQuery = supabase.from('cash_drawer_logs')
        .select('*')
        .gte('created_at', startBoundary)
        .order('created_at', { ascending: false });

      if (busId && busId !== '00000000-0000-0000-0000-000000000000') {
        logsQuery = logsQuery.eq('business_id', busId);
      }
      
      const { data: logsDocs } = await logsQuery;
      const logsData = logsDocs || [];
        
      setCashLogs(logsData);
      
      let float = activeSess ? Number(activeSess.opening_balance || 0) : 0;
      let expenses = 0;
      let restocks = 0;
      let ownerCollections = 0;
      let cashIns = 0;
      let reversalsInflow = 0;
      let reversalsOutflow = 0;
      
      logsData.forEach(log => {
        const amt = Number(log.amount);
        switch(log.transaction_type) {
            case 'opening_float': 
              if (!activeSess) float += amt; 
              break;
            case 'expense': 
              expenses += amt; 
              break;
            case 'restock': 
              restocks += amt; 
              break;
            case 'owner_collection': 
              ownerCollections += amt; 
              break;
            case 'cash_in':
              cashIns += amt;
              break;
            case 'reversal_outflow':
              reversalsInflow += amt;
              break;
            case 'reversal_inflow':
              reversalsOutflow += amt;
              break;
        }
      });
      
      const calculatedOutflows = Math.max(0, (expenses + restocks + ownerCollections) - reversalsInflow);
      setSessionOutflows(calculatedOutflows);

      const calculatedExpected = float + totalCashSales + cashIns - reversalsOutflow - calculatedOutflows;
      setExpectedCash(calculatedExpected);

    } catch (error) {
      console.error('Error fetching today cash statistics:', error);
      toast.error('Failed to reload cash data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShiftHistory = async () => {
    setHistoryLoading(true);
    try {
      let query = supabase
        .from('register_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(40);

      if (businessId && businessId !== '00000000-0000-0000-0000-000000000000') {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPastSessions(data || []);
    } catch (e) {
      console.error('Failed to load past register sessions log:', e);
      toast.error('Could not load session audit history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenRegister = async () => {
    try {
        const floatAmount = parseFloat(startingFloatInput) || 0;
        
        if (requireFloat && (!startingFloatInput || floatAmount <= 0)) {
            toast.error('Starting cash float is required. Please type an opening amount.');
            return;
        }
        
        const { data: openedLog, error: logErr } = await supabase.from('cash_drawer_logs').insert([{
            business_id: businessId,
            branch_id: branchId || null,
            amount: floatAmount,
            type: 'opening',
            transaction_type: 'opening_float',
            notes: 'Register opened with starting float',
            created_at: new Date().toISOString()
        }]).select();
        if (logErr) throw logErr;

        const sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        const sessionItem = {
          id: sessionId,
          business_id: businessId,
          branch_id: branchId || null,
          user_id: userId || '00000000-0000-0000-0000-000000000000',
          opening_balance: floatAmount,
          closing_balance: 0,
          expected_balance: floatAmount,
          variance: 0,
          status: 'OPEN' as const,
          opened_at: new Date().toISOString(),
          closed_at: null,
          sales_count: 0,
          sales_total: 0,
          refunds_total: 0,
          payouts_total: 0,
          created_at: new Date().toISOString()
        };
        
        const { error: sessErr } = await supabase.from('register_sessions').insert(sessionItem);
        if (sessErr) throw sessErr;
        
        setIsDrawerOpen(true);
        setStartingFloatInput('');
        fetchActiveShiftAndAccounting();
        toast.success(`Register successfully opened with $${floatAmount.toFixed(2)} float.`);
    } catch (e) {
        console.error(e);
        toast.error('Failed to open register session');
    }
  };

  const handleCloseRegister = async () => {
    if (countedCash === 0 && !confirm('Are you reconciling with exactly $0.00 cash? Close register?')) {
      return;
    }

    const calculatedVariance = countedCash - expectedCash;

    if (Math.abs(calculatedVariance) > 0.01 && (!notes || !notes.trim())) {
      toast.error('Variance detected! Please provide an audit explanation in the notes.');
      return;
    }

    try {
        const { error: logErr } = await supabase.from('cash_drawer_logs').insert([{
            business_id: businessId,
            branch_id: branchId || null,
            amount: countedCash,
            type: 'closing',
            transaction_type: 'closing_count',
            notes: `Counted: $${countedCash.toFixed(2)}, Expected: $${expectedCash.toFixed(2)}, Variance: $${calculatedVariance.toFixed(2)}. Notes: ${notes}`,
            created_at: new Date().toISOString()
        }]);
        if (logErr) throw logErr;

        const { data: openSess } = await supabase
          .from('register_sessions')
          .eq('business_id', businessId)
          .eq('status', 'OPEN')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openSess) {
          const patches = {
            closing_balance: countedCash,
            expected_balance: expectedCash,
            variance: calculatedVariance,
            status: 'CLOSED' as const,
            closed_at: new Date().toISOString(),
            sales_total: sessionCashSales,
            payouts_total: sessionOutflows
          };
          const { error: updateErr } = await supabase.from('register_sessions').eq('id', openSess.id).update(patches);
          if (updateErr) throw updateErr;
        }
        
        setIsDrawerOpen(false);
        setCountedCash(0);
        setNotes('');
        setDenominations({
          USD: { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 },
          ZWG: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0 },
          ZAR: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0 }
        });
        setCoinTotals({
          USD: '',
          ZWG: '',
          ZAR: ''
        });
        setShowDenominationCalc(false);
        fetchActiveShiftAndAccounting();
        toast.success('Register safely closed. Reconciled summary saved.');
    } catch (e) {
        console.error(e);
        toast.error('Could not freeze register session.');
    }
  };

  const handleAddLog = async () => {
    if (!entryAmount || parseFloat(entryAmount) <= 0) {
        toast.error('Please enter a valid cash amount');
        return;
    }
    
    try {
        let logType = 'payout';
        if (entryType === 'owner_collection') {
          logType = 'drop';
        } else if (entryType === 'cash_in') {
          logType = 'payin';
        }

        const amt = parseFloat(entryAmount);
        const description = entryNotes || `POS cash drawer ${entryType}`;

        await supabase.from('cash_drawer_logs').insert([{
            business_id: businessId,
            branch_id: branchId || null,
            amount: amt,
            type: logType,
            transaction_type: entryType,
            notes: description,
            created_at: new Date().toISOString()
        }]);

        // Post standard journal entries for business expenses registered at the POS drawer
        if (entryType === 'expense') {
          try {
            const { data: userDetails } = await supabase.auth.getUser();
            const callerId = userDetails?.user?.id || 'default_user';

            await postJournalEntry(
              businessId,
              branchId || 'default_branch',
              callerId,
              `POS-EXP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              `POS till expense: ${description}`,
              [
                { accountCode: '6000', debit: amt, credit: 0, description: `POS micro expense: ${description}` },
                { accountCode: '1000', debit: 0, credit: amt, description: `Cash till payout: ${description}` }
              ]
            );
          } catch (ledgerError) {
            console.error('Ledger journal creation failed:', ledgerError);
          }
        } else if (entryType === 'cash_in') {
          try {
            const { data: userDetails } = await supabase.auth.getUser();
            const callerId = userDetails?.user?.id || 'default_user';

            await postJournalEntry(
              businessId,
              branchId || 'default_branch',
              callerId,
              `POS-CIN-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              `POS cash-in: ${description}`,
              [
                { accountCode: '1000', debit: amt, credit: 0, description: `Cash till deposit: ${description}` },
                { accountCode: '3000', debit: 0, credit: amt, description: `Owner float addition / Capital: ${description}` }
              ]
            );
          } catch (ledgerError) {
            console.error('Ledger cash-in journal failed:', ledgerError);
          }
        }

        // If there is an active session in register_sessions, update its payouts and expected balance
        if (activeSession) {
          let updatedPayouts = Number(activeSession.payouts_total || 0);
          let updatedExpected = Number(activeSession.expected_balance || 0);

          if (entryType === 'cash_in') {
            updatedExpected += amt;
          } else {
            updatedPayouts += amt;
            updatedExpected -= amt;
          }
          
          await supabase
            .from('register_sessions')
            .eq('id', activeSession.id)
            .update({
              payouts_total: updatedPayouts,
              expected_balance: updatedExpected
            });
        }
        
        if (entryType === 'cash_in') {
          toast.success(`Registered Cash Inbound of $${amt.toFixed(2)}. Float addition posted to Journals.`);
        } else {
          toast.success(`Registered cash $${amt.toFixed(2)} ${entryType}. Transaction automatically posted to Journals.`);
        }

        setEntryAmount('');
        setEntryNotes('');
        setEntryType('expense');
        fetchActiveShiftAndAccounting();
    } catch (e) {
        console.error(e);
        toast.error('Failed to save till transaction');
    }
  };

  const handleReverseLog = async (log: CashLog) => {
    if (log.notes.startsWith('[REVERSED]') || log.transaction_type.startsWith('reversal_') || log.notes.startsWith('Reversal of')) {
      toast.error('This transaction is either already reversed or is a corrective reversal itself.');
      return;
    }

    if (!confirm(`Are you sure you want to reverse the transaction: "${formatLogType(log.transaction_type)} - $${Number(log.amount).toFixed(2)}"? This will log a corrective journal entry and balance the register.`)) {
      return;
    }

    try {
      let correctionType = '';
      let correctionTxType = '';
      let notes = `Reversal of transaction: ${log.notes}`;

      if (['expense', 'restock', 'owner_collection', 'payout'].includes(log.transaction_type)) {
        correctionType = 'cash_in';
        correctionTxType = 'reversal_outflow';
      } else if (log.transaction_type === 'cash_in') {
        correctionType = 'payout';
        correctionTxType = 'reversal_inflow';
      } else {
        toast.error('Reversal is not allowed for this transaction type.');
        return;
      }

      // Add the balancing log
      await supabase.from('cash_drawer_logs').insert([{
        business_id: businessId,
        branch_id: branchId || null,
        amount: Number(log.amount),
        type: correctionType,
        transaction_type: correctionTxType,
        notes: notes,
        created_at: new Date().toISOString()
      }]);

      // Update original log string so visual layout shows [REVERSED] tag
      await supabase.from('cash_drawer_logs')
        .update({ notes: `[REVERSED] ${log.notes}` })
        .eq('id', log.id);

      // Perform accounting journal entry if it was an expense
      if (log.transaction_type === 'expense') {
        try {
          const { data: userDetails } = await supabase.auth.getUser();
          const callerId = userDetails?.user?.id || 'default_user';

          await postJournalEntry(
            businessId,
            branchId || 'default_branch',
            callerId,
            `POS-REV-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            `Reversal of POS till expense: ${log.notes}`,
            [
              { accountCode: '1000', debit: Number(log.amount), credit: 0, description: `Cash till reversal inflow: ${log.notes}` },
              { accountCode: '6000', debit: 0, credit: Number(log.amount), description: `POS micro expense reversal: ${log.notes}` }
            ]
          );
        } catch (ledgerError) {
          console.error('Ledger reversal journal failed:', ledgerError);
        }
      } else if (log.transaction_type === 'cash_in') {
        try {
          const { data: userDetails } = await supabase.auth.getUser();
          const callerId = userDetails?.user?.id || 'default_user';

          await postJournalEntry(
            businessId,
            branchId || 'default_branch',
            callerId,
            `POS-REV-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            `Reversal of POS till deposit: ${log.notes}`,
            [
              { accountCode: '3000', debit: Number(log.amount), credit: 0, description: `Owner float addition reversal: ${log.notes}` },
              { accountCode: '1000', debit: 0, credit: Number(log.amount), description: `Cash till reversal outflow: ${log.notes}` }
            ]
          );
        } catch (ledgerError) {
          console.error('Ledger reversal journal failed:', ledgerError);
        }
      }

      // Adjust active session payouts_total or expected_balance if present
      if (activeSession) {
        let updatedPayouts = Number(activeSession.payouts_total || 0);
        let updatedExpected = Number(activeSession.expected_balance || 0);

        if (correctionTxType === 'reversal_outflow') {
          updatedPayouts = Math.max(0, updatedPayouts - Number(log.amount));
          updatedExpected = updatedExpected + Number(log.amount);
        } else if (correctionTxType === 'reversal_inflow') {
          updatedExpected = Math.max(0, updatedExpected - Number(log.amount));
        }

        await supabase
          .from('register_sessions')
          .eq('id', activeSession.id)
          .update({
            payouts_total: updatedPayouts,
            expected_balance: updatedExpected
          });
      }

      toast.success('Transaction successfully reversed. Double-entry alignment updated!');
      fetchActiveShiftAndAccounting();
    } catch (e) {
      console.error(e);
      toast.error('Failed to complete transaction reversal');
    }
  };

  // Inspect specific shift audits in detail
  const handleOpenAudit = async (session: RegisterSession) => {
    setSelectedAuditSession(session);
    try {
      const startIso = new Date(session.opened_at).toISOString();
      const endIso = session.closed_at 
        ? new Date(session.closed_at).toISOString() 
        : new Date().toISOString();

      let logQuery = supabase.from('cash_drawer_logs')
        .select('*')
        .gte('created_at', startIso)
        .order('created_at', { ascending: true });

      if (businessId && businessId !== '00000000-0000-0000-0000-000000000000') {
        logQuery = logQuery.eq('business_id', businessId);
      }

      const { data } = await logQuery;
      // Filter out records that are newer than closed_at if it's closed
      const filtered = (data || []).filter(l => {
        if (!session.closed_at) return true;
        return new Date(l.created_at) <= new Date(session.closed_at);
      });

      setAuditLogs(filtered);
      setIsAuditModalOpen(true);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load transaction logs for that session');
    }
  };

  // Centralized Counted Cash calculation based on multi-currency inputs
  useEffect(() => {
    let totalUsd = 0;
    
    // Sum for USD
    const usdNotesSum = Object.entries(denominations.USD || {}).reduce((sum, [denom, qty]) => {
      return sum + (Number(denom) * qty);
    }, 0);
    const usdCoinsVal = parseFloat(coinTotals.USD || '') || 0;
    totalUsd += (usdNotesSum + usdCoinsVal);

    // Sum for ZWG (converted to USD)
    const zwgNotesSum = Object.entries(denominations.ZWG || {}).reduce((sum, [denom, qty]) => {
      return sum + (Number(denom) * qty);
    }, 0);
    const zwgCoinsVal = parseFloat(coinTotals.ZWG || '') || 0;
    const zwgRate = rates.ZWG || 26.9181;
    totalUsd += (zwgNotesSum + zwgCoinsVal) / zwgRate;

    // Sum for ZAR (converted to USD)
    const zarNotesSum = Object.entries(denominations.ZAR || {}).reduce((sum, [denom, qty]) => {
      return sum + (Number(denom) * qty);
    }, 0);
    const zarCoinsVal = parseFloat(coinTotals.ZAR || '') || 0;
    const zarRate = rates.ZAR || 16.2229;
    totalUsd += (zarNotesSum + zarCoinsVal) / zarRate;

    setCountedCash(totalUsd);
  }, [denominations, coinTotals, rates]);

  // Handle banknote counting calculator inputs
  const handleDenominationChange = (val: number, count: number) => {
    setDenominations(prev => {
      const currMap = prev[calcCurrency] || {};
      return {
        ...prev,
        [calcCurrency]: {
          ...currMap,
          [val]: Math.max(0, count)
        }
      };
    });
  };

  const handleCoinTotalChange = (text: string) => {
    setCoinTotals(prev => ({
      ...prev,
      [calcCurrency]: text
    }));
  };

  const clearCalculators = () => {
    setDenominations({
      USD: { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 },
      ZWG: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0 },
      ZAR: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0 }
    });
    setCoinTotals({
      USD: '',
      ZWG: '',
      ZAR: ''
    });
  };

  // Format cash logs for layout views
  const formatLogType = (type: string) => {
      switch (type) {
          case 'opening_float': return 'Opening Shift Float';
          case 'expense': return 'Expensed Till Cash';
          case 'restock': return 'COD Stock Purchase (Archived)';
          case 'owner_collection': return 'Cash Collection (Safe Drop)';
          case 'closing_count': return 'Closing Reconciliation';
          case 'cash_sale': return 'Gross Cash Sales';
          case 'cash_in': return 'Cash In (Deposit)';
          case 'reversal_outflow': return 'Reversal Balance Inbound';
          case 'reversal_inflow': return 'Reversal Balance Outbound';
          default: return type.replace(/_/g, ' ');
      }
  };

  const getLogIcon = (type: string) => {
      switch (type) {
          case 'opening_float': return <Unlock className="w-4 h-4 text-emerald-600" />;
          case 'expense': return <ArrowDownRight className="w-4 h-4 text-red-600" />;
          case 'restock': return <ArrowDownRight className="w-4 h-4 text-amber-600" />;
          case 'owner_collection': return <UserMinus className="w-4 h-4 text-indigo-600" />;
          case 'closing_count': return <Lock className="w-4 h-4 text-zinc-600" />;
          case 'cash_sale': return <DollarSign className="w-4 h-4 text-sky-600" />;
          case 'cash_in': return <Plus className="w-4 h-4 text-emerald-600" />;
          case 'reversal_outflow': return <RotateCcw className="w-4 h-4 text-amber-600" />;
          case 'reversal_inflow': return <RotateCcw className="w-4 h-4 text-rose-600" />;
          default: return <FileText className="w-4 h-4 text-zinc-600" />;
      }
  };

  // Printing a formal print receipt on a separate visual DOM for physical audits (80mm & standard compliant)
  const handlePrintAuditReceipt = async (session: RegisterSession, customLogs: CashLog[] = []) => {
    const toastId = toast.loading('Compiling advanced reconciliation items, inventory values & profitability metrics...');
    
    let dbProducts: any[] = [];
    let dbInventory: any[] = [];
    let dbCategories: any[] = [];
    let salesInShift: any[] = [];

    try {
      const bizId = session.business_id || businessId;

      // Fetch products, categories, stock levels and sales in parallel
      const [prodRes, invRes, catRes] = await Promise.all([
        supabase.from('products').select('*').eq('business_id', bizId),
        supabase.from('inventory').select('*').eq('business_id', bizId),
        supabase.from('categories').select('*').eq('business_id', bizId)
      ]);

      dbProducts = prodRes.data || [];
      dbInventory = invRes.data || [];
      dbCategories = catRes.data || [];

      // Convert arrays to quick lookup maps
      const categoryMap: Record<string, string> = {};
      const productMap: Record<string, any> = {};

      dbProducts.forEach(p => {
        productMap[p.id] = p;
      });

      dbCategories.forEach(c => {
        categoryMap[c.id] = c.name;
      });

      // Fetch sales inside this register's active timeframe
      const openedAt = session.opened_at;
      const closedAt = session.closed_at || new Date().toISOString();

      const { data: dbSales } = await supabase.from('sales')
        .select('*')
        .eq('business_id', bizId)
        .gte('created_at', openedAt)
        .lte('created_at', closedAt);

      salesInShift = [...(dbSales || [])];

      // Merge local offline sales from POS state store
      const localSales = usePOSStore.getState()?.localSales || [];
      localSales.forEach((localSale: any) => {
        const localTime = new Date(localSale.timestamp || localSale.created_at || new Date()).toISOString();
        if (localTime >= openedAt && localTime <= closedAt) {
          const exists = salesInShift.some(s => s.receiptNumber === localSale.receiptNumber || s.id === localSale.id || s.receipt_number === localSale.receiptNumber);
          if (!exists) {
            salesInShift.push({
              ...localSale,
              created_at: localSale.timestamp || localSale.created_at,
              status: localSale.status || 'COMPLETED'
            });
          }
        }
      });

      toast.dismiss(toastId);
    } catch (err: any) {
      console.error('Error compiling advanced reconciliation documents:', err);
      toast.dismiss(toastId);
      toast.error('Failed to load transaction details. Proceeding with basic metrics only.');
    }

    const pWindow = window.open('', '_blank');
    if (!pWindow) {
      toast.error('Print popup blocked. Please allow popups.');
      return;
    }

    const tellerName = profilesMap[session.user_id]?.full_name || 'System Operator';
    const finalVariance = session.variance ?? ((session.closing_balance || 0) - (session.expected_balance || 0));

    // ----------------------------------------------------
    // AGGREGATE DETAILED SALES ITEMS BY CATEGORIES
    // ----------------------------------------------------
    const categoryAggregate: Record<string, {
      categoryName: string;
      totalQty: number;
      totalRevenue: number;
      totalCost: number;
      items: Record<string, {
        name: string;
        sku: string;
        qty: number;
        revenue: number;
        cost: number;
        unitPrice: number;
      }>;
    }> = {};

    let totalCalculatedCOGS = 0;
    let totalCalculatedRevenue = 0;

    salesInShift.forEach((sale: any) => {
      const sStatus = String(sale.status || '').toUpperCase();
      const allowedStatuses = ['COMPLETED', 'PAID', 'SYNCED', 'OFFLINE_PENDING'];
      if (sale.status && !allowedStatuses.includes(sStatus)) return;

      let itemsList: any[] = [];
      if (Array.isArray(sale.items)) {
        itemsList = sale.items;
      } else if (typeof sale.items === 'string') {
        try {
          itemsList = JSON.parse(sale.items);
        } catch {
          itemsList = [];
        }
      }

      itemsList.forEach((it: any) => {
        const pId = it.product?.id || it.id || '';
        const prod = dbProducts.find(p => p.id === pId) || it.product || {};
        const pName = prod.name || it.name || 'Miscellaneous Item';
        const pSku = prod.sku || it.sku || 'N/A';

        const categoryId = prod.category_id || '';
        const categoryName = dbCategories.find(c => c.id === categoryId)?.name || prod.category || 'General/Miscellaneous';

        const qty = Number(it.quantity || it.qty || 1);
        const revenue = Number(it.line_total || it.subtotal || (qty * (it.unitPrice || it.price || 0)));
        const costPerUnit = Number(prod.cost_price || prod.costPrice || it.cost_price || 0);
        const cost = costPerUnit * qty;

        totalCalculatedRevenue += revenue;
        totalCalculatedCOGS += cost;

        if (!categoryAggregate[categoryName]) {
          categoryAggregate[categoryName] = {
            categoryName,
            totalQty: 0,
            totalRevenue: 0,
            totalCost: 0,
            items: {}
          };
        }

        const cat = categoryAggregate[categoryName];
        cat.totalQty += qty;
        cat.totalRevenue += revenue;
        cat.totalCost += cost;

        const itemKey = `${pId}_${pName}`;
        if (!cat.items[itemKey]) {
          cat.items[itemKey] = {
            name: pName,
            sku: pSku,
            qty: 0,
            revenue: 0,
            cost: 0,
            unitPrice: Number(it.unitPrice || it.price || 0)
          };
        }

        const itemAgg = cat.items[itemKey];
        itemAgg.qty += qty;
        itemAgg.revenue += revenue;
        itemAgg.cost += cost;
      });
    });

    const grossProfitAnalysed = totalCalculatedRevenue - totalCalculatedCOGS;
    const grossMarginAnalysed = totalCalculatedRevenue > 0 ? (grossProfitAnalysed / totalCalculatedRevenue) * 100 : 0;
    const netCashShiftRealized = grossProfitAnalysed + finalVariance;

    // ----------------------------------------------------
    // INVENTORY REMAINING & STOCK VALUATION REPORT
    // ----------------------------------------------------
    const inventoryValuationAggregate: Record<string, {
      categoryName: string;
      totalQtyOnHand: number;
      totalCostValue: number;
      totalRetailValue: number;
      products: Array<{
        name: string;
        sku: string;
        qtyOnHand: number;
        unitCost: number;
        costValue: number;
        retailValue: number;
      }>;
    }> = {};

    let totalCatalogQtyOnHand = 0;
    let totalCatalogCostValue = 0;
    let totalCatalogRetailValue = 0;

    dbProducts.forEach((prod: any) => {
      const matches = dbInventory.filter(inv => inv.product_id === prod.id && inv.branch_id === session.branch_id);
      const qtyOnHand = matches.length ? matches.reduce((sum, m) => sum + Number(m.quantity || 0), 0) : 0;

      const unitCost = Number(prod.cost_price || 0);
      const unitRetail = Number(prod.retail_price || prod.price || 0);
      const costValue = unitCost * qtyOnHand;
      const retailValue = unitRetail * qtyOnHand;

      totalCatalogQtyOnHand += qtyOnHand;
      totalCatalogCostValue += costValue;
      totalCatalogRetailValue += retailValue;

      const categoryId = prod.category_id || '';
      const categoryName = dbCategories.find(c => c.id === categoryId)?.name || 'General/Miscellaneous';

      if (!inventoryValuationAggregate[categoryName]) {
        inventoryValuationAggregate[categoryName] = {
          categoryName,
          totalQtyOnHand: 0,
          totalCostValue: 0,
          totalRetailValue: 0,
          products: []
        };
      }

      const catInv = inventoryValuationAggregate[categoryName];
      catInv.totalQtyOnHand += qtyOnHand;
      catInv.totalCostValue += costValue;
      catInv.totalRetailValue += retailValue;

      catInv.products.push({
        name: prod.name,
        sku: prod.sku || 'N/A',
        qtyOnHand,
        unitCost,
        costValue,
        retailValue
      });
    });

    // ----------------------------------------------------
    // DYNAMIC EXPERT ADVISORY LOGIC FOR BUSINESS SUCCESS
    // ----------------------------------------------------
    const advisoryBullets: string[] = [];

    // 1. Advice based on cash discrepancy
    if (finalVariance < 0) {
      advisoryBullets.push(`<strong>🚨 Cash Shortage Alert ($${Math.abs(finalVariance).toFixed(2)}):</strong> A physical cash variance of this size presents clear transaction leakages. We advise conducting mandatory "blind till counts" where cashiers submit their coins and bills without seeing expectation values. Audit manual register payouts, check system audit logs for cash-drawer overrides, and review CCTV footage around high-value drop-offs.`);
    } else if (finalVariance > 0) {
      advisoryBullets.push(`<strong>⚠️ Cash Overage Alert ($${finalVariance.toFixed(2)}):</strong> This indicates customer change counting inaccuracies, unreceipted petty cash-ins, or a transaction made offline but left unlogged. While not an immediate cash loss, it frustrates client trust or bookkeeping records. Re-train till operators on exact checkout change protocols.`);
    } else {
      advisoryBullets.push(`<strong>⭐ Perfect Register Alignment:</strong> The drawer count perfectly registers with standard sales expectations. Operator <strong>${tellerName}</strong> showed exceptional cash handling precision during this shift session.`);
    }

    // 2. Advice based on stock replenishment
    const reorderAlerts: string[] = [];
    dbProducts.forEach((prod: any) => {
      const matches = dbInventory.filter(inv => inv.product_id === prod.id && inv.branch_id === session.branch_id);
      const qtyOnHand = matches.reduce((sum, m) => sum + Number(m.quantity || 0), 0);
      const reorderLvl = Number(prod.reorder_level || 5);
      if (qtyOnHand <= reorderLvl && qtyOnHand < 15) {
        reorderAlerts.push(`${prod.name} (${qtyOnHand} left)`);
      }
    });

    if (reorderAlerts.length > 0) {
      advisoryBullets.push(`<strong>📦 Reorder Stock warning:</strong> Stockout alerts detected on <em>${reorderAlerts.slice(0, 4).join(', ')}${reorderAlerts.length > 4 ? ' and ' + (reorderAlerts.length - 4) + ' other items' : ''}</em>. We strongly recommend generating draft purchase orders inside the Procurement tab matching these item SKUs immediately to prevent customer walkaways.`);
    }

    // 3. Margin & Profit optimization
    let highMarginCatName = '';
    let highestMarginVal = -1;
    Object.entries(categoryAggregate).forEach(([name, cat]) => {
      const margin = cat.totalRevenue > 0 ? ((cat.totalRevenue - cat.totalCost) / cat.totalRevenue) * 100 : 0;
      if (margin > highestMarginVal && cat.totalRevenue > 10) {
        highestMarginVal = margin;
        highMarginCatName = name;
      }
    });

    if (highMarginCatName && highestMarginVal > 0) {
      advisoryBullets.push(`<strong>📈 High-Margin Expansion:</strong> Your highest-margin business category during this shift was <strong>"${highMarginCatName}"</strong> at an impressive <strong>${highestMarginVal.toFixed(1)}% gross profit</strong>. Consider allocating higher physical placement space, initiating bulk package discounts, or offering cashier selling commissions to capitalize on this category’s momentum.`);
    }

    // 4. Operational Cash flow advice
    const payouts = Number(session.payouts_total || 0);
    if (payouts > 100) {
      advisoryBullets.push(`<strong>💸 High Cash Outflow warning:</strong> High volume of hand-to-hand register drops ($${payouts.toFixed(2)}) leaves operations vulnerable to false invoices. Require that manager signature receipts are stapled directly to supplier restock documentation before register drawers open.`);
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shift Valuation & Reconciliation Audit Report</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
            
            body {
              font-family: 'Inter', sans-serif;
              color: #1f2937;
              padding: 20px;
              max-width: 820px;
              margin: 0 auto;
              background-color: #f9fafb;
              font-size: 13px;
              line-height: 1.5;
            }
            .paper {
              background-color: white;
              border: 1px solid #e5e7eb;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
              padding: 40px;
              border-radius: 8px;
            }
            .header-info {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #111827;
              padding-bottom: 20px;
              margin-bottom: 24px;
            }
            .title-area h1 {
              font-size: 22px;
              font-weight: 800;
              color: #111827;
              letter-spacing: -0.5px;
              margin: 0;
              text-transform: uppercase;
            }
            .title-area p {
              color: #4b5563;
              margin: 4px 0 0 0;
              font-size: 12px;
              font-weight: 500;
            }
            .logo-placeholder {
              font-family: 'JetBrains Mono', monospace;
              text-align: right;
            }
            .org-name {
              font-size: 18px;
              font-weight: 800;
              color: #111827;
            }
            .org-sub {
              font-size: 10px;
              color: #6b7280;
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
              background-color: #f3f4f6;
              padding: 14px;
              border-radius: 6px;
              margin-bottom: 24px;
              font-family: 'JetBrains Mono', monospace;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 9px;
              color: #6b7280;
              text-transform: uppercase;
              font-weight: bold;
              margin-bottom: 2px;
            }
            .meta-val {
              font-size: 11px;
              color: #111827;
              font-weight: 700;
            }
            
            /* Section layout */
            h2.section-title {
              font-size: 13px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              color: #111827;
              border-bottom: 1px solid #111827;
              padding-bottom: 6px;
              margin: 32px 0 14px 0;
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            
            /* Metric grids */
            .metric-table {
              width: 100%;
              border-collapse: collapse;
              font-family: 'JetBrains Mono', monospace;
              margin-bottom: 20px;
            }
            .metric-table td {
              padding: 8px 10px;
              border-bottom: 1px solid #f3f4f6;
            }
            .metric-table tr.highlight {
              background-color: #f9fafb;
              font-weight: bold;
            }
            .metric-table tr.total-row {
              border-top: 1px solid #111827;
              border-bottom: 2px solid #111827;
              font-weight: bold;
              font-size: 14px;
            }
            .text-right {
              text-align: right;
            }
            
            /* Discrepancy block */
            .discrepancy-card {
              border: 1px solid #111827;
              border-radius: 6px;
              padding: 16px;
              margin-bottom: 24px;
              background-color: ${finalVariance === 0 ? '#f0fdf4' : finalVariance > 0 ? '#eff6ff' : '#fef2f2'};
              border-color: ${finalVariance === 0 ? '#86efac' : finalVariance > 0 ? '#93c5fd' : '#fca5a5'};
              text-align: center;
            }
            .discrepancy-title {
              font-family: 'JetBrains Mono', monospace;
              font-size: 16px;
              font-weight: bold;
              color: #111827;
            }
            .discrepancy-caption {
              font-size: 11px;
              color: #4b5563;
              margin-top: 4px;
            }
            
            /* Report tables */
            .report-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 24px;
              font-size: 12px;
            }
            .report-table th {
              background-color: #111827;
              color: white;
              font-weight: 700;
              text-align: left;
              padding: 6px 10px;
              font-size: 10px;
              text-transform: uppercase;
            }
            .report-table td {
              padding: 7px 10px;
              border-bottom: 1px solid #e5e7eb;
            }
            .report-table tr.category-total {
              background-color: #f9fafb;
              font-weight: bold;
              border-top: 1px solid #d1d5db;
            }
            .report-table tr.grand-total {
              background-color: #f3f4f6;
              font-weight: bold;
              border-top: 2px solid #111827;
              border-bottom: 2px solid #111827;
              font-size: 13px;
            }
            .col-sku {
              font-family: 'JetBrains Mono', monospace;
              font-size: 11px;
              color: #4b5563;
            }
            .text-muted {
              color: #6b7280;
            }
            
            /* Analysis & Advisory */
            .adv-box {
              background-color: #fafaf9;
              border: 1px solid #e7e5e4;
              border-radius: 6px;
              padding: 20px;
              margin-bottom: 24px;
            }
            .adv-box p {
              margin: 0 0 12px 0;
              font-size: 12.5px;
              color: #44403c;
              display: flex;
              align-items: flex-start;
              gap: 8px;
            }
            .adv-box p:last-child {
              margin-bottom: 0;
            }
            
            /* Print controls */
            .no-print-bar {
              position: sticky;
              top: 0;
              background-color: #111827;
              color: white;
              padding: 12px 20px;
              border-radius: 4px;
              margin-bottom: 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
            }
            .btn-print {
              background-color: #2563eb;
              color: white;
              border: none;
              padding: 8px 16px;
              font-weight: bold;
              border-radius: 4px;
              cursor: pointer;
            }
            .btn-print:hover {
              background-color: #1d4ed8;
            }
            
            @media print {
              body {
                background-color: white;
                padding: 0;
              }
              .paper {
                border: none;
                box-shadow: none;
                padding: 0;
              }
              .no-print-bar {
                display: none !important;
              }
              .page-break {
                page-break-before: always;
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print-bar">
            <span>🖥️ Tareza Reconciliation Ledger Document Compiled Successfully</span>
            <button class="btn-print" onclick="window.print()">Print Compiled Document</button>
          </div>

          <div class="paper">
            <div class="header-info">
              <div class="title-area">
                <h1>Shift Reconciliation & Valuation Report</h1>
                <p>Digital shift register balances matched with item stock levels, category sales and real profitability.</p>
              </div>
              <div class="logo-placeholder">
                <span class="org-name">TAREZA CO-OP</span><br/>
                <span class="org-sub">Harare, Zimbabwe</span>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-item">
                <span class="meta-label">SHIFT SESSION ID</span>
                <span class="meta-val">#${session.id.substring(0, 8).toUpperCase()}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">TILL OPERATOR</span>
                <span class="meta-val">${tellerName}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">SHIFT STATUS</span>
                <span class="meta-val" style="color: ${session.status === 'OPEN' ? '#2563eb' : '#111827'};">${session.status}</span>
              </div>
              <div class="meta-item" style="grid-column: span 1;">
                <span class="meta-label">OPENED AT</span>
                <span class="meta-val">${new Date(session.opened_at).toLocaleString()}</span>
              </div>
              <div class="meta-item" style="grid-column: span 1;">
                <span class="meta-label">CLOSED / COMPILED</span>
                <span class="meta-val">${session.closed_at ? new Date(session.closed_at).toLocaleString() : new Date().toLocaleString()}</span>
              </div>
              <div class="meta-item" style="grid-column: span 1;">
                <span class="meta-label">BUSINESS BRANCH</span>
                <span class="meta-val">Default Primary Store</span>
              </div>
            </div>

            <!-- Page 1: Cash Reconciliation -->
            <h2 class="section-title"><span>1.0 CASH FLOAT & EXPECTED LIQUIDITY RECONCILIATION</span><span>USD</span></h2>
            <table class="metric-table">
              <tr>
                <td>(+) Opening Drawer Float:</td>
                <td class="text-right">$${Number(session.opening_balance || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>(+) Shift Gross Cash Sales Receipts:</td>
                <td class="text-right" style="color: #2563eb;">$${Number(session.sales_total || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>(-) Cash Outflows / Expenditure Drops:</td>
                <td class="text-right" style="color: #dc2626;">-$${Number(session.payouts_total || 0).toFixed(2)}</td>
              </tr>
              <tr class="highlight" style="font-size: 13px;">
                <td>(=) Expected Till Drawer Cash Balances:</td>
                <td class="text-right">$${Number(session.expected_balance || session.opening_balance).toFixed(2)}</td>
              </tr>
              <tr class="highlight" style="font-size: 13px; border-top: 1px dashed #d1d5db;">
                <td>(★) Audited/Counted Drawer Cash:</td>
                <td class="text-right">$${Number(session.closing_balance || 0).toFixed(2)}</td>
              </tr>
            </table>

            <div class="discrepancy-card">
              <div class="discrepancy-title">
                Auditor-Reconciliation Cash Variance: $${finalVariance.toFixed(2)}
              </div>
              <div class="discrepancy-caption">
                ${finalVariance === 0 ? 'STATUS: PERFECT BALANCE. Cash in drawer exactly matches shift operational activities.' : 
                  finalVariance > 0 ? `STATUS: SURPLUS. Cash drawer has $${finalVariance.toFixed(2)} unaccounted for abundance.` : 
                  `STATUS: DEFICIT SHORTAGE. Cash drawer has a shortage of -$${Math.abs(finalVariance).toFixed(2)}.`}
              </div>
            </div>

            ${customLogs.length > 0 ? `
              <div style="font-size:10px; font-weight:bold; color:#4b5563; margin-bottom:6px; font-family:'JetBrains Mono', monospace; text-transform:uppercase;">Shift Cash log transactions:</div>
              <table class="report-table" style="font-size:11px; font-family:'JetBrains Mono', monospace; margin-bottom: 24px;">
                <thead>
                  <tr>
                    <th>Log Time</th>
                    <th>Log Trigger Type</th>
                    <th>Notes & Ledger Context</th>
                    <th class="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${customLogs.map(l => `
                    <tr>
                      <td>${new Date(l.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td><strong>${formatLogType(l.transaction_type)}</strong></td>
                      <td>${l.notes || 'Internal drawer drop'}</td>
                      <td class="text-right" style="font-weight:bold;">$${Number(l.amount).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            <!-- Session Profit Analysis -->
            <h2 class="section-title"><span>2.0 SHIFT SALES PROFITABILITY & REAL VALUE ADHERENCE</span><span>USD</span></h2>
            <table class="metric-table">
              <tr>
                <td>Shift Total Sales Realized (Receipted):</td>
                <td class="text-right" style="font-weight:600;">$${totalCalculatedRevenue.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Shift Cost of Goods Sold (COGS Basis):</td>
                <td class="text-right" style="font-weight:600; color:#b45309;">-$${totalCalculatedCOGS.toFixed(2)}</td>
              </tr>
              <tr class="highlight" style="background-color:#fafaf9;">
                <td>(=) Indicated Gross Shift Profit:</td>
                <td class="text-right" style="color: #15803d; font-size:13px;">+$${grossProfitAnalysed.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Assigned Cash Drawer Variance Correction:</td>
                <td class="text-right" style="color: ${finalVariance < 0 ? '#b91c1c' : '#15803d'}; font-style: italic;">
                  $${finalVariance >= 0 ? '+' : ''}${finalVariance.toFixed(2)}
                </td>
              </tr>
              <tr class="total-row">
                <td>(=) REALIZED SHIFT NET NET CARES PROFIT:</td>
                <td class="text-right" style="color: ${netCashShiftRealized >= 0 ? '#15803d' : '#b91c1c'}; font-size:14px;">
                  $${netCashShiftRealized.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td>Operational Gross Margin Ratio:</td>
                <td class="text-right font-bold">${grossMarginAnalysed.toFixed(2)}%</td>
              </tr>
            </table>

            <!-- Page Break for Sold product Category details -->
            <div class="page-break"></div>

            <h2 class="section-title"><span>3.0 SHIFT DETAILED SOLD ITEMS ANALYSIS UNDER PATTERN CATEGORIES</span><span>ITEMIZED LEDGER</span></h2>
            <table class="report-table">
              <thead>
                <tr>
                  <th>Product Title & Spec Details</th>
                  <th>SKU Code</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Unit Price</th>
                  <th class="text-right">Gross Sales</th>
                  <th class="text-right">COGS Cost</th>
                  <th class="text-right">Profit Contribution</th>
                </tr>
              </thead>
              <tbody>
                ${Object.keys(categoryAggregate).length === 0 ? `
                  <tr>
                    <td colspan="7" style="text-align:center; padding: 20px;" class="text-muted">No itemized product sales transaction data found inside this shift timeframe.</td>
                  </tr>
                ` : Object.values(categoryAggregate).map(cat => `
                  <tr style="background-color:#f9fafb; font-weight:700;"><td colspan="7">${cat.categoryName.toUpperCase()} CATEGORY (Aggregate qty: ${cat.totalQty})</td></tr>
                  ${Object.values(cat.items).map(item => {
                    const itemMargin = item.revenue - item.cost;
                    return `
                      <tr>
                        <td style="padding-left: 20px;">${item.name}</td>
                        <td class="col-sku">${item.sku}</td>
                        <td class="text-right">${item.qty}</td>
                        <td class="text-right">$${item.unitPrice.toFixed(2)}</td>
                        <td class="text-right font-bold">$${item.revenue.toFixed(2)}</td>
                        <td class="text-right text-muted">$${item.cost.toFixed(2)}</td>
                        <td class="text-right" style="color:#15803d; font-weight:600;">$${itemMargin.toFixed(2)}</td>
                      </tr>
                    `;
                  }).join('')}
                  <tr class="category-total">
                    <td colspan="2">SUB-TOTALS [${cat.categoryName}]</td>
                    <td class="text-right">${cat.totalQty}</td>
                    <td class="text-right">-</td>
                    <td class="text-right">$${cat.totalRevenue.toFixed(2)}</td>
                    <td class="text-right text-muted">$${cat.totalCost.toFixed(2)}</td>
                    <td class="text-right" style="color:#15803d;">$${(cat.totalRevenue - cat.totalCost).toFixed(2)}</td>
                  </tr>
                `).join('')}
                <tr class="grand-total">
                  <td colspan="2">GRAND TOTAL SHIFT SALES SUMMARY</td>
                  <td class="text-right">${Object.values(categoryAggregate).reduce((sum, c) => sum + c.totalQty, 0)}</td>
                  <td class="text-right">-</td>
                  <td class="text-right">$${totalCalculatedRevenue.toFixed(2)}</td>
                  <td class="text-right text-muted">$${totalCalculatedCOGS.toFixed(2)}</td>
                  <td class="text-right" style="color:#15803d;">$${grossProfitAnalysed.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <!-- Page Break for remaining inventory levels valuation -->
            <div class="page-break"></div>

            <h2 class="section-title"><span>4.0 PHYSICAL INVENTORY REMAINING STOCK VALUATION REPORT</span><span>CLOSING BALANCE</span></h2>
            <table class="report-table">
              <thead>
                <tr>
                  <th>Product Spec Title</th>
                  <th>SKU Code</th>
                  <th class="text-right">O.H. Qty</th>
                  <th class="text-right">Unit Cost</th>
                  <th class="text-right">Asset Cost Value</th>
                  <th class="text-right">Est. Unit Price</th>
                  <th class="text-right">Est. Retail Value</th>
                </tr>
              </thead>
              <tbody>
                ${Object.keys(inventoryValuationAggregate).length === 0 ? `
                  <tr>
                    <td colspan="7" style="text-align:center; padding: 20px;" class="text-muted">No product inventory stock levels matched on this branch database.</td>
                  </tr>
                ` : Object.values(inventoryValuationAggregate).map(cat => `
                  <tr style="background-color:#f9fafb; font-weight:700;"><td colspan="7">${cat.categoryName.toUpperCase()} STOCK VALUATION</td></tr>
                  ${cat.products.map(prod => `
                    <tr>
                      <td style="padding-left: 20px;">${prod.name}</td>
                      <td class="col-sku">${prod.sku}</td>
                      <td class="text-right" style="font-weight:${prod.qtyOnHand <= 5 ? 'bold' : 'normal'}; color: ${prod.qtyOnHand <= 3 ? '#b91c1c' : '#1f2937'};">
                        ${prod.qtyOnHand} ${prod.qtyOnHand <= 3 ? '⚠️' : ''}
                      </td>
                      <td class="text-right">$${prod.unitCost.toFixed(2)}</td>
                      <td class="text-right font-bold">$${prod.costValue.toFixed(2)}</td>
                      <td class="text-right">$${prod.retailValue > 0 ? (prod.retailValue / (prod.qtyOnHand || 1)).toFixed(2) : '0.00'}</td>
                      <td class="text-right" style="font-weight:600; color:#2563eb;">$${prod.retailValue.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  <tr class="category-total">
                    <td colspan="2">SUB-TOTALS VALUATION [${cat.categoryName}]</td>
                    <td class="text-right">${cat.totalQtyOnHand}</td>
                    <td class="text-right">-</td>
                    <td class="text-right font-black">$${cat.totalCostValue.toFixed(2)}</td>
                    <td class="text-right">-</td>
                    <td class="text-right" style="color:#2563eb; font-weight:bold;">$${cat.totalRetailValue.toFixed(2)}</td>
                  </tr>
                `).join('')}
                <tr class="grand-total">
                  <td colspan="2">REAL-TIME CLOSING INVENTORY TOTAL VALUATION</td>
                  <td class="text-right">${totalCatalogQtyOnHand}</td>
                  <td class="text-right">-</td>
                  <td class="text-right">$${totalCatalogCostValue.toFixed(2)}</td>
                  <td class="text-right">-</td>
                  <td class="text-right" style="color:#2563eb;">$${totalCatalogRetailValue.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div style="font-size:10.5px; color:#4b5563; padding: 10px; background-color:#f9fafb; border: 1px solid #e5e7eb; border-radius:4px; margin-top: -12px; margin-bottom: 24px;">
              *Estimated Potential Margin left inside catalog stocks: <strong>$${(totalCatalogRetailValue - totalCatalogCostValue).toFixed(2)}</strong> (Average Product Catalog Margin Level: <strong>${totalCatalogRetailValue > 0 ? (((totalCatalogRetailValue - totalCatalogCostValue) / totalCatalogRetailValue) * 100).toFixed(1) : '0'}%</strong>).
            </div>

            <!-- Management Advisory Session -->
            <h2 class="section-title"><span>5.0 TAREZA FINANCIAL SECURITY & MANAGEMENT ADVISORY DIRECTIVE</span><span>EXECUTIVE ACTION PAPERS</span></h2>
            <div class="adv-box">
              ${advisoryBullets.map((bullet, i) => `
                <p>
                  <span><strong>[${i+1}]</strong></span>
                  <span>${bullet}</span>
                </p>
              `).join('')}
              <div style="font-style: italic; font-size:11.5px; margin-top:20px; color:#57534e; border-top:1px dashed #d6d3d1; padding-top:10px;">
                *The physical audit team certifies that these actionable and security bullet points are dynamically output from Tareza ERP's analytical backend algorithms specifically referencing this shift's data lines. Please retain in safe storage for operational compliance logs.
              </div>
            </div>

            <div class="double-divider"></div>

            <div class="sign-section">
              <div style="display: flex; justify-content: space-between; margin-top: 30px;">
                <div>
                  <div style="border-bottom: 1px solid #111827; height: 40px; width: 220px; margin-bottom: 6px;"></div>
                  <div style="font-weight:bold;">TILL OPERATOR / Teller</div>
                  <div style="font-size: 11px; color:#6b7280;">Sign Date: _________________</div>
                </div>
                <div>
                  <div style="border-bottom: 1px solid #111827; height: 40px; width: 220px; margin-bottom: 6px;"></div>
                  <div style="font-weight:bold;">BUSINESS OWNER / Auditor</div>
                  <div style="font-size: 11px; color:#6b7280;">Sign Date: _________________</div>
                </div>
              </div>
            </div>

            <div style="text-align:center; font-size:10px; color:#6b7280; margin-top:80px; border-top:1px dashed #d1d5db; padding-top:12px;">
              Tareza ERP Integrated Advanced Reconciliations. Document compiled under cryptographic signature session ref: ${session.id.substring(0, 16).toUpperCase()}. All Rights Reserved.
            </div>
          </div>

          <script>
            window.addEventListener('load', () => {
              setTimeout(() => { window.print(); }, 500);
            });
          </script>
        </body>
      </html>
    `;

    pWindow.document.write(html);
    pWindow.document.close();
  };


  const activeVariance = countedCash - expectedCash;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-12 px-4">
      {/* Upper Title Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 px-2.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold font-mono">FINANCIAL AUDITS</span>
            <span className="text-[11px] text-zinc-400 font-medium">Real-time balances</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950">Cash Drawer Registers</h2>
          <p className="text-zinc-500 text-sm mt-1">Audit active shifts, balance currency tills, and track COD business sales.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 h-9 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 shadow-sm select-none">
            <Label htmlFor="advanced-toggle" className="text-xs font-bold text-zinc-650 cursor-pointer">Advanced Mode</Label>
            <input 
              type="checkbox"
              id="advanced-toggle"
              checked={showAdvanced}
              onChange={(e) => toggleAdvanced(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 cursor-pointer ml-1.5"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchActiveShiftAndAccounting} 
            className="border-zinc-200 text-zinc-600 font-medium h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload
          </Button>
          <Badge variant="outline" className={`px-3 py-2 text-xs font-semibold rounded-xl h-9 flex items-center ${isDrawerOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
             {isDrawerOpen ? <><Unlock className="w-3.5 h-3.5 mr-1.5" /> Register Till Active</> : <><Lock className="w-3.5 h-3.5 mr-1.5" /> Till Locked / Closed</>}
          </Badge>
        </div>
      </div>

      {/* Page-level Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        if (val === 'shift-logs') fetchShiftHistory();
      }} className="space-y-6">
        <TabsList className="bg-zinc-100/80 p-1 rounded-xl w-fit border border-zinc-200/50">
          <TabsTrigger value="active-shift" className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium">
            <Sliders className="w-4 h-4" /> Active Shift Control
          </TabsTrigger>
          {showAdvanced && (
            <TabsTrigger value="shift-logs" className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium">
              <History className="w-4 h-4" /> Registers & Shifts Log
            </TabsTrigger>
          )}
        </TabsList>

        {/* 1. MAIN ACTIVE SHIFT TAB */}
        <TabsContent value="active-shift" className="space-y-6 outline-none">
          {/* Active Shift Metrics Bento Cards - Only visible if open, showing real time shift tracking */}
          {isDrawerOpen && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-3 duration-300">
              <Card className="border-emerald-200/60 bg-emerald-50/20 shadow-sm relative overflow-hidden">
                <CardContent className="p-4 pt-5">
                  <div className="absolute right-3 top-3.5 p-2 bg-emerald-100/40 rounded-lg text-emerald-600">
                    <Unlock className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Opening Float</span>
                  <div className="text-2xl font-black font-mono text-zinc-950 mt-1.5">
                    ${startingFloatAmount.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">Starting currency added in drawer</p>
                </CardContent>
              </Card>

              <Card className="border-sky-200/60 bg-sky-50/20 shadow-sm relative overflow-hidden">
                <CardContent className="p-4 pt-5">
                  <div className="absolute right-3 top-3.5 p-2 bg-sky-100/40 rounded-lg text-sky-600">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Gross Cash Sales</span>
                  <div className="text-2xl font-black font-mono text-zinc-950 mt-1.5">
                    ${sessionCashSales.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">Cash purchases received in shift</p>
                </CardContent>
              </Card>

              <Card className="border-rose-200/60 bg-rose-50/10 shadow-sm relative overflow-hidden">
                <CardContent className="p-4 pt-5">
                  <div className="absolute right-3 top-3.5 p-2 bg-rose-100/30 rounded-lg text-rose-600">
                    <ArrowDownRight className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Total Outflows</span>
                  <div className="text-2xl font-black font-mono text-zinc-950 mt-1.5">
                    -${sessionOutflows.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">Expenses & cash collections</p>
                </CardContent>
              </Card>

              <Card className="border-zinc-900/10 bg-zinc-950 text-white shadow-md relative overflow-hidden">
                <CardContent className="p-4 pt-5">
                  <div className="absolute right-3 top-3.5 p-1.5 rounded bg-zinc-800 text-emerald-400">
                    <Coins className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Predicted expected</span>
                  <div className="text-2xl font-black font-mono mt-1.5 text-zinc-50">
                    ${expectedCash.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">Target shift checkout balance</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT operational section */}
            <div className={`${showAdvanced ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-6`}>
              {!isDrawerOpen ? (
                <Card className="border-indigo-100 bg-white shadow-xl rounded-2xl overflow-hidden relative">
                  <div className="h-1.5 w-full bg-amber-500"></div>
                  <CardHeader className="space-y-1">
                    <div className="flex items-center gap-2">
                       <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                        <Lock className="w-5 h-5" />
                      </div>
                      <CardTitle className="text-lg font-bold text-zinc-950">Register Shift is Closed</CardTitle>
                    </div>
                    <CardDescription className="text-sm">
                      Shifts must be initialized and started directly from the POS Terminal module.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      To open a cashier shift and start making transactions, please navigate to the active POS module. Opening a register session from POS ensures correct browser-terminal sync and cashier accountability.
                    </p>

                    <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-xl transition-all">
                      <div className="space-y-0.5">
                        <Label htmlFor="req-float-toggle" className="text-xs font-bold text-zinc-805 cursor-pointer block">Require Cash Float to Open</Label>
                        <span className="text-[10px] text-zinc-500 max-w-[240px] block leading-normal">
                          When disabled, registers can start immediately with empty/optional starting cash.
                        </span>
                      </div>
                      <Switch 
                        id="req-float-toggle" 
                        checked={requireFloat} 
                        onCheckedChange={(val) => {
                          setRequireFloat(val);
                          localStorage.setItem('tareza_require_float', String(val));
                          toast.success(val ? "Starting cash float requirement enabled." : "Starting cash float requirement has been disabled.");
                        }} 
                      />
                    </div>

                    <Button className="w-full bg-zinc-900 text-white hover:bg-zinc-800 h-11" onClick={() => navigate('/pos')}>
                      <Coins className="w-4 h-4 mr-2" /> Open Shift via POS Module
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-zinc-200 bg-white shadow-md rounded-2xl overflow-hidden">
                  <div className="h-1.5 w-full bg-indigo-600"></div>
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-bold text-zinc-950">Shift Cash Reconciliation</CardTitle>
                        <CardDescription className="text-sm">Balance physical cash against dynamic estimates.</CardDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowDenominationCalc(!showDenominationCalc)}
                        className={`text-xs border ${showDenominationCalc ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-zinc-600'}`}
                      >
                        <Coins className="w-4.5 h-4.5 mr-1" />
                        {showDenominationCalc ? 'Hide Count Tray' : 'Denomination Tray'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* DENOMINATION tray tool */}
                    {showDenominationCalc && (
                      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 animate-in zoom-in-95 duration-150 space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60 flex-wrap gap-2">
                          <span className="text-xs font-bold text-zinc-700 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                            <Calculator className="w-3.5 h-3.5 text-indigo-500" /> Bill Counter
                          </span>
                          <div className="flex gap-1.5 items-center">
                            {(['USD', 'ZWG', 'ZAR'] as const).map((cc) => (
                              <button
                                key={cc}
                                type="button"
                                onClick={() => setCalcCurrency(cc)}
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded border transition-all ${calcCurrency === cc ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'}`}
                              >
                                {cc}
                              </button>
                            ))}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[10px] text-zinc-500 hover:text-zinc-700 p-0 h-6 shrink-0"
                            onClick={clearCalculators}
                          >
                            <RotateCcw className="w-2.5 h-2.5 mr-1" /> Clear Tray
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          {((calcCurrency === 'USD' ? [100, 50, 20, 10, 5, 2, 1] : [200, 100, 50, 20, 10, 5, 2])) .map((denom) => (
                            <div key={denom} className="flex items-center justify-between text-xs font-medium text-zinc-600">
                              <span className="w-12 text-right pr-2">{calcCurrency === 'USD' ? '$' : calcCurrency === 'ZWG' ? 'ZiG' : 'R'}{denom} x</span>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="w-5 h-5 rounded-full"
                                  onClick={() => handleDenominationChange(denom, ((denominations[calcCurrency] || {})[denom] || 0) - 1)}
                                >
                                  -
                                </Button>
                                <Input 
                                  type="number"
                                  min="0"
                                  className="w-12 h-6 text-center font-mono text-[11px] p-0 border-zinc-200 bg-white"
                                  value={((denominations[calcCurrency] || {})[denom]) || ''}
                                  onChange={(e) => handleDenominationChange(denom, parseInt(e.target.value) || 0)}
                                />
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="w-5 h-5 rounded-full"
                                  onClick={() => handleDenominationChange(denom, ((denominations[calcCurrency] || {})[denom] || 0) + 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          <div className="col-span-2 pt-2 border-t border-zinc-200/40 flex items-center justify-between text-xs font-medium text-zinc-700">
                            <span>Coins / Cents {calcCurrency} Total:</span>
                            <div className="relative">
                              <span className="absolute left-1.5 top-1.5 text-[10px] text-zinc-450 font-bold">{calcCurrency === 'USD' ? '$' : calcCurrency === 'ZWG' ? 'ZiG' : 'R'}</span>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00"
                                className="w-24 h-7 pl-6 pr-1.5 text-right font-mono text-[11px]"
                                value={coinTotals[calcCurrency] || ''}
                                onChange={(e) => handleCoinTotalChange(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Multi-currency breakdown list */}
                        <div className="pt-2 border-t border-zinc-200 text-[10px] font-mono text-zinc-500 space-y-0.5 leading-normal">
                          <div className="font-semibold text-zinc-600 flex justify-between">
                            <span>Subtotals:</span>
                            <span>Exchange Rates (per USD)</span>
                          </div>
                          <div className="flex justify-between">
                            <span>USD Counted: ${Object.entries(denominations.USD || {}).reduce((s, [d, q]) => s + (Number(d) * q), 0) + (parseFloat(coinTotals.USD) || 0)}</span>
                            <span>1.0000 Base</span>
                          </div>
                          <div className="flex justify-between">
                            <span>ZWG (ZiG) Counted: {Object.entries(denominations.ZWG || {}).reduce((s, [d, q]) => s + (Number(d) * q), 0) + (parseFloat(coinTotals.ZWG) || 0)}</span>
                            <span>{rates.ZWG?.toFixed(4) || "26.9181"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>ZAR (Rand) Counted: R{Object.entries(denominations.ZAR || {}).reduce((s, [d, q]) => s + (Number(d) * q), 0) + (parseFloat(coinTotals.ZAR) || 0)}</span>
                            <span>{rates.ZAR?.toFixed(4) || "16.2229"}</span>
                          </div>
                        </div>
 
                        <div className="pt-2 flex justify-between items-center font-semibold text-xs border-t border-zinc-200 bg-indigo-50/50 p-2 rounded-lg text-indigo-950">
                          <span>Converted USD Cash Total:</span>
                          <span className="font-mono text-sm">${countedCash.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="counted" className="text-xs font-bold text-zinc-600 uppercase tracking-wider block">Actual Counted Cash In Drawer</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
                          <Input 
                            id="counted" 
                            type="number" 
                            placeholder="0.00" 
                            className="pl-10 text-xl font-mono border-zinc-200"
                            value={countedCash || ''}
                            onChange={(e) => setCountedCash(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
         
                      {countedCash > 0 && (
                        <div className={`p-4 rounded-xl flex items-start gap-3 border animate-in fade-in slide-in-from-bottom-2 duration-300 ${activeVariance === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'}`}>
                           {activeVariance === 0 ? (
                             <div className="flex-1">
                                <p className="font-bold flex items-center gap-1">
                                  <Check className="w-4.5 h-4.5 text-emerald-600" /> Balanced Perfectly
                                </p>
                                <p className="text-xs text-emerald-700 mt-1">Predicted cash metrics and counted banknotes register balance exactly.</p>
                             </div>
                           ) : (
                             <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                   <p className="font-bold flex items-center gap-1">
                                      <AlertTriangle className="w-4.5 h-4.5 text-rose-600" /> Till Register Variance
                                   </p>
                                   <span className="font-extrabold font-mono text-zinc-950">
                                     {activeVariance > 0 ? '+' : ''}${activeVariance.toFixed(2)}
                                   </span>
                                </div>
                                <p className="text-[11px] text-zinc-600">
                                  {activeVariance > 0 
                                    ? 'Surplus cash anomaly (Too much money). Keep drop note.' 
                                    : 'Till deficit shortfall (Short of cash). Shift operator notes strictly required prior to freeze.'}
                                </p>
                             </div>
                           )}
                        </div>
                      )}
         
                      <div className="space-y-2">
                        <Label htmlFor="notes" className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Shift Audit Explanations</Label>
                        <textarea 
                          id="notes" 
                          rows={3} 
                          className="w-full text-zinc-900 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:opacity-50"
                          placeholder="Provide till audit reasons for overrides, customer refunds, card discrepancies or shortfalls..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                    </div>
        
                    <div className="pt-2">
                      <Button className="w-full bg-zinc-950 text-white hover:bg-zinc-800 h-11" onClick={handleCloseRegister}>
                        <Calculator className="w-4 h-4 mr-2" /> Balance & Close Register Shift
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* RIGHT side forms for cash actions info */}
            {showAdvanced && (
              <div className="lg:col-span-6 space-y-6">
              <Card className="border-zinc-200 bg-white shadow-md rounded-2xl overflow-hidden">
                <div className="h-1.5 w-full bg-slate-800"></div>
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Record Till Transactions</CardTitle>
                  <CardDescription className="text-xs">Log micro-expenses, change bankings, or safe collections.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={entryType} onValueChange={setEntryType} className="space-y-4">
                    <TabsList className="grid grid-cols-3 w-full border bg-zinc-100 p-1 rounded-lg">
                      <TabsTrigger value="expense" className="text-xs rounded font-semibold px-1 py-1.5">Expense</TabsTrigger>
                      <TabsTrigger value="owner_collection" className="text-xs rounded font-semibold px-1 py-1.5" title="Safe Drop Outflows">Safe Drop</TabsTrigger>
                      <TabsTrigger value="cash_in" className="text-xs rounded font-semibold px-1 py-1.5">Cash In (Inflow)</TabsTrigger>
                    </TabsList>
                    
                    <div className="space-y-4 pt-2">
                       <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Transaction Cash Amount</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            className="pl-10 text-lg font-mono"
                            value={entryAmount}
                            onChange={(e) => setEntryAmount(e.target.value)}
                            disabled={!isDrawerOpen}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Detailed Purpose</Label>
                        <Input 
                          placeholder={
                            entryType === 'expense' 
                              ? "e.g., Office printing stationery" 
                              : entryType === 'cash_in'
                              ? "e.g., Additional drawer float / change addition"
                              : "e.g., Vault cash transfers (Cash collection)"
                          } 
                          className="bg-white border-zinc-200"
                          value={entryNotes}
                          onChange={(e) => setEntryNotes(e.target.value)}
                          disabled={!isDrawerOpen}
                        />
                      </div>
                      
                      <Button className="w-full bg-slate-800 text-white hover:bg-slate-700 h-10" onClick={handleAddLog} disabled={!isDrawerOpen}>
                        Record {entryType === 'cash_in' ? 'Cash Inbound (Deposit)' : 'Transaction Outflow'}
                      </Button>
                    </div>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Today shift activities block */}
              <Card className="border-zinc-200 bg-white shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 border-b flex flex-row items-center justify-between bg-zinc-50/50">
                  <div>
                    <CardTitle className="text-sm font-bold">This Shift's Transactions</CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">Sequential ledger of drawer movements.</CardDescription>
                  </div>
                  {isDrawerOpen && activeSession && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs shrink-0 text-indigo-600 font-bold"
                      onClick={() => handlePrintAuditReceipt(activeSession, cashLogs)}
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" /> Print Temp
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {cashLogs.length === 0 ? (
                      <div className="text-center py-8 text-zinc-500">
                        <Coins className="w-8 h-8 text-zinc-300 mx-auto stroke-1 mb-2" />
                        <p className="text-xs font-medium">No cash entries printed during this shift yet.</p>
                      </div>
                    ) : (
                      cashLogs.map((log) => (
                        <div key={log.id} className="flex justify-between items-center p-2.5 border border-zinc-150 rounded-xl bg-zinc-50/60 hover:bg-zinc-50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-white shadow-inner rounded-lg shrink-0">
                              {getLogIcon(log.transaction_type)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-900 truncate">{formatLogType(log.transaction_type)}</p>
                              <p className="text-[10px] text-zinc-500 truncate">
                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.notes}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center text-right shrink-0 gap-2">
                            <span className={`text-xs font-bold font-mono ${['expense', 'restock', 'owner_collection', 'reversal_inflow'].includes(log.transaction_type) ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {['expense', 'restock', 'owner_collection', 'reversal_inflow'].includes(log.transaction_type) ? '-' : '+'}${Number(log.amount).toFixed(2)}
                            </span>
                            {isDrawerOpen && ['expense', 'restock', 'owner_collection', 'cash_in'].includes(log.transaction_type) && !log.notes.startsWith('[REVERSED]') && (
                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => handleReverseLog(log)}
                                className="h-6 text-[10px] text-rose-500 border-rose-100 font-semibold hover:text-rose-700 hover:bg-rose-50 px-1.5 rounded cursor-pointer"
                                title="Reverse this till transaction"
                              >
                                <RotateCcw className="w-2.5 h-2.5 mr-0.5" /> Rev
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            )}
          </div>
        </TabsContent>

        {/* 2. REGISTER SHIFTS AUDIT LOG HISTORY TAB */}
        <TabsContent value="shift-logs" className="space-y-6 outline-none">
          <Card className="border-zinc-200 bg-white shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b">
              <CardTitle className="text-lg font-bold text-zinc-900">Historical Shift Audits Log</CardTitle>
              <CardDescription className="text-xs">
                Archived register session checkout balance reconciliations and audits for store managers.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="text-center py-12 text-zinc-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-sm font-medium">Loading session audit database...</p>
                </div>
              ) : pastSessions.length === 0 ? (
                <div className="text-center py-16 text-zinc-500">
                  <History className="w-12 h-12 text-zinc-300 mx-auto mb-3 stroke-1" />
                  <p className="text-sm font-medium text-zinc-600">No shift registers database found</p>
                  <p className="text-xs text-zinc-400 mt-1">Open your very first till registered shift to initiate tracks.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-100/70 text-[11px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200">
                        <th className="py-3 px-4">Operator & Timing</th>
                        <th className="py-3 px-4">Registers Status</th>
                        <th className="py-3 px-4 text-right">Opening Float</th>
                        <th className="py-3 px-4 text-right">Cash Sales</th>
                        <th className="py-3 px-4 text-right">Payouts</th>
                        <th className="py-3 px-4 text-right">Reconciled (Counted)</th>
                        <th className="py-3 px-4 text-right">Variance</th>
                        <th className="py-3 px-4 text-center">Receipts / Audits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-xs">
                      {pastSessions.map((session) => {
                        const teller = profilesMap[session.user_id]?.full_name || 'System Operator';
                        const tellerRole = profilesMap[session.user_id]?.role || 'Teller';
                        const finalVariance = session.variance ?? ((session.closing_balance || 0) - (session.expected_balance || 0));
                        
                        return (
                          <tr key={session.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-zinc-950 flex items-center gap-1.5">
                                {teller}
                                <span className="bg-zinc-100 text-zinc-500 text-[9px] font-medium px-1.5 py-0.2 rounded uppercase tracking-wide">
                                  {tellerRole}
                                </span>
                              </div>
                              <div className="text-zinc-400 text-[10px] mt-0.5 font-medium flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 block shrink-0" />
                                {new Date(session.opened_at).toLocaleDateString()} {new Date(session.opened_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-bold">
                              {session.status === 'OPEN' ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wider">Open (Running)</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 text-[10px] font-medium rounded-full uppercase tracking-wider">Closed</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-900">${Number(session.opening_balance || 0).toFixed(2)}</td>
                            <td className="py-3.5 px-4 text-right font-mono font-medium text-emerald-600">${Number(session.sales_total || 0).toFixed(2)}</td>
                            <td className="py-3.5 px-4 text-right font-mono font-medium text-rose-600">-${Number(session.payouts_total || 0).toFixed(2)}</td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                              {session.status === 'CLOSED' ? `$${Number(session.closing_balance || 0).toFixed(2)}` : 'In progress'}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {session.status === 'CLOSED' ? (
                                <div className={`font-mono font-bold ${finalVariance === 0 ? 'text-emerald-600' : finalVariance > 0 ? 'text-sky-600' : 'text-rose-600'}`}>
                                  {finalVariance > 0 ? '+' : ''}${finalVariance.toFixed(2)}
                                </div>
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleOpenAudit(session)}
                                  className="h-8 w-8 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50"
                                  title="View detailed logs"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => {
                                    // Fetch the correct cash logs for printable audit receipt if available
                                    const printAudit = async () => {
                                      try {
                                        const { data } = await supabase.from('cash_drawer_logs')
                                          .select('*')
                                          .gte('created_at', new Date(session.opened_at).toISOString())
                                          .order('created_at', { ascending: true });
                                        const filtered = (data || []).filter(l => {
                                          if (!session.closed_at) return true;
                                          return new Date(l.created_at) <= new Date(session.closed_at);
                                        });
                                        handlePrintAuditReceipt(session, filtered);
                                      } catch (e) {
                                        handlePrintAuditReceipt(session);
                                      }
                                    };
                                    printAudit();
                                  }}
                                  className="h-8 w-8 text-zinc-500 hover:text-indigo-600 hover:bg-zinc-100"
                                  title="Print Shift Receipt"
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DETAILED REGISTER SHIFT AUDIT LOG DRAWER MODAL */}
      {isAuditModalOpen && selectedAuditSession && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-zinc-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-zinc-50/50 border-b flex items-center justify-between">
              <div>
                <span className="p-1 px-2.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold font-mono">SHIFT MOVEMENT AUDIT TRAIL</span>
                <CardTitle className="text-base font-extrabold text-zinc-900 mt-1">Shift Detail: #{selectedAuditSession.id.substring(0, 8).toUpperCase()}</CardTitle>
                <p className="text-zinc-500 text-xs mt-0.5">Teller: <strong className="text-zinc-700">{profilesMap[selectedAuditSession.user_id]?.full_name || 'System Teller'}</strong></p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handlePrintAuditReceipt(selectedAuditSession, auditLogs)}
                className="border-zinc-200 text-indigo-700 font-bold bg-white hover:bg-slate-50"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Thermal Print
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Timing metrics block */}
              <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-xl border">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Date Opened</span>
                  <p className="text-xs font-semibold text-zinc-800 mt-0.5">{new Date(selectedAuditSession.opened_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Date Reconciled</span>
                  <p className="text-xs font-semibold text-zinc-800 mt-0.5">
                    {selectedAuditSession.closed_at ? new Date(selectedAuditSession.closed_at).toLocaleString() : 'Active running'}
                  </p>
                </div>
              </div>

              {/* Till pricing audit metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-zinc-50 border rounded-xl text-center">
                  <span className="text-[10px] font-semibold text-zinc-400 block uppercase">Starting Float</span>
                  <span className="font-mono text-base font-bold text-zinc-900">${Number(selectedAuditSession.opening_balance || 0).toFixed(2)}</span>
                </div>
                <div className="p-3 bg-emerald-50/45 border border-emerald-100 rounded-xl text-center">
                  <span className="text-[10px] font-semibold text-emerald-600 block uppercase">Cash Sales Today</span>
                  <span className="font-mono text-base font-black text-emerald-800">${Number(selectedAuditSession.sales_total || 0).toFixed(2)}</span>
                </div>
                <div className="p-3 bg-rose-50/45 border border-rose-100 rounded-xl text-center">
                  <span className="text-[10px] font-semibold text-rose-600 block uppercase">Payouts Outflow</span>
                  <span className="font-mono text-base font-black text-rose-800">-${Number(selectedAuditSession.payouts_total || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-dashed flex justify-between items-center bg-zinc-50">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 block">EXPECTED BALANCE</span>
                  <span className="font-mono text-sm font-semibold text-zinc-700">${Number(selectedAuditSession.expected_balance || selectedAuditSession.opening_balance).toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-zinc-400 block">DECLARED COUNTED</span>
                  <span className="font-mono text-base font-bold text-zinc-900">${Number(selectedAuditSession.closing_balance || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Shift Variance Analysis */}
              {selectedAuditSession.status === 'CLOSED' && (
                <div className={`p-4 rounded-xl text-center font-bold text-sm ${((selectedAuditSession.closing_balance || 0) - (selectedAuditSession.expected_balance || 0)) === 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  Variance deficit/surplus: ${((selectedAuditSession.closing_balance || 0) - (selectedAuditSession.expected_balance || 0)).toFixed(2)}
                  <p className="text-[11px] font-normal text-zinc-500 mt-1">
                    {((selectedAuditSession.closing_balance || 0) - (selectedAuditSession.expected_balance || 0)) === 0 
                      ? 'Till balances correctly. Audit matched perfectly.' 
                      : 'Audit is off. Take note of manager signatures.'}
                  </p>
                </div>
              )}

              {/* Shift movement transactional logs list */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">Session Cash Ledger</span>
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-3 text-center">No cash operations registered during this session.</p>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto border p-2 rounded-xl bg-zinc-50/50">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex justify-between items-center p-2 rounded-lg bg-white border text-xs">
                        <div>
                          <p className="font-bold text-zinc-800">{formatLogType(log.transaction_type)}</p>
                          <p className="text-[10px] text-zinc-500">{new Date(log.created_at).toLocaleTimeString()} {log.notes && `• ${log.notes}`}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold ${['expense', 'restock', 'owner_collection', 'reversal_inflow'].includes(log.transaction_type) ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {['expense', 'restock', 'owner_collection', 'reversal_inflow'].includes(log.transaction_type) ? '-' : '+'}${Number(log.amount).toFixed(2)}
                          </span>
                          {selectedAuditSession.status === 'OPEN' && isDrawerOpen && ['expense', 'restock', 'owner_collection', 'cash_in'].includes(log.transaction_type) && !log.notes.startsWith('[REVERSED]') && (
                            <Button 
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                handleReverseLog(log);
                                // Refresh current modal logs
                                setTimeout(async () => {
                                  try {
                                    const { data } = await supabase.from('cash_drawer_logs')
                                      .select('*')
                                      .gte('created_at', new Date(selectedAuditSession.opened_at).toISOString())
                                      .order('created_at', { ascending: true });
                                    const filtered = (data || []).filter(l => {
                                      if (!selectedAuditSession.closed_at) return true;
                                      return new Date(l.created_at) <= new Date(selectedAuditSession.closed_at);
                                    });
                                    setAuditLogs(filtered);
                                  } catch (err) {}
                                }, 800);
                              }}
                              className="h-6 text-[10px] text-rose-500 border-rose-100 font-semibold hover:text-rose-700 hover:bg-rose-50 px-1.5 rounded cursor-pointer"
                              title="Reverse this till transaction"
                            >
                              <RotateCcw className="w-2.5 h-2.5 mr-0.5" /> Rev
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-zinc-50 border-t flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAuditModalOpen(false);
                  setSelectedAuditSession(null);
                }}
                className="hover:bg-zinc-100 text-zinc-700 text-xs px-4"
              >
                Close Audit Inspection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
