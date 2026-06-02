import React, { useState, useEffect } from 'react';
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
import { supabase } from '../lib/supabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

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

  // Denomination Drawer Calculator tool
  const [showDenominationCalc, setShowDenominationCalc] = useState(false);
  const [denominations, setDenominations] = useState<Record<number, number>>({
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0
  });
  const [coinTotal, setCoinTotal] = useState('');

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
  }, []);

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
          brId = businessData.branch_id || '';
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
      
      const { data: salesData } = await salesQuery;
      
      let totalCashSales = 0;
      if (salesData && salesData.length > 0) {
        salesData.forEach((s: any) => {
          const stat = String(s.status || '').toUpperCase();
          if (stat !== 'COMPLETED' && stat !== 'PAID') return;

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
        }
      });
      
      const calculatedOutflows = expenses + restocks + ownerCollections;
      setSessionOutflows(calculatedOutflows);

      const calculatedExpected = float + totalCashSales - calculatedOutflows;
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
          closed_at: '',
          sales_count: 0,
          sales_total: 0,
          refunds_total: 0,
          payouts_total: 0,
          created_at: new Date().toISOString()
        };
        
        await supabase.from('register_sessions').insert(sessionItem);
        
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
        await supabase.from('cash_drawer_logs').insert([{
            business_id: businessId,
            branch_id: branchId || null,
            amount: countedCash,
            type: 'closing',
            transaction_type: 'closing_count',
            notes: `Counted: $${countedCash.toFixed(2)}, Expected: $${expectedCash.toFixed(2)}, Variance: $${calculatedVariance.toFixed(2)}. Notes: ${notes}`,
            created_at: new Date().toISOString()
        }]);

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
          await supabase.from('register_sessions').eq('id', openSess.id).update(patches);
        }
        
        setIsDrawerOpen(false);
        setCountedCash(0);
        setNotes('');
        setDenominations({ 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
        setCoinTotal('');
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
        }

        await supabase.from('cash_drawer_logs').insert([{
            business_id: businessId,
            branch_id: branchId || null,
            amount: parseFloat(entryAmount),
            type: logType,
            transaction_type: entryType,
            notes: entryNotes || 'Uncategorized movement',
            created_at: new Date().toISOString()
        }]);

        // If there is an active session in register_sessions, update its payouts and expected balance
        if (activeSession) {
          const updatedPayouts = Number(activeSession.payouts_total || 0) + parseFloat(entryAmount);
          const updatedExpected = Number(activeSession.expected_balance || 0) - parseFloat(entryAmount);
          
          await supabase
            .from('register_sessions')
            .eq('id', activeSession.id)
            .update({
              payouts_total: updatedPayouts,
              expected_balance: updatedExpected
            });
        }
        
        toast.success(`Registered cash $${parseFloat(entryAmount).toFixed(2)} ${entryType}.`);
        setEntryAmount('');
        setEntryNotes('');
        setEntryType('expense');
        fetchActiveShiftAndAccounting();
    } catch (e) {
        console.error(e);
        toast.error('Failed to save till transaction');
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

  // Handle banknote counting calculator inputs
  const handleDenominationChange = (val: number, count: number) => {
    setDenominations(prev => {
      const next = { ...prev, [val]: Math.max(0, count) };
      // Recalculate total Counted
      const valSum = Object.entries(next).reduce((sum, [denom, qty]) => {
        return sum + (Number(denom) * qty);
      }, 0);
      const coins = parseFloat(coinTotal) || 0;
      setCountedCash(valSum + coins);
      return next;
    });
  };

  const handleCoinTotalChange = (text: string) => {
    setCoinTotal(text);
    const coins = parseFloat(text) || 0;
    const notesSum = Object.entries(denominations).reduce((sum, [denom, qty]) => {
      return sum + (Number(denom) * qty);
    }, 0);
    setCountedCash(notesSum + coins);
  };

  const clearCalculators = () => {
    setDenominations({ 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
    setCoinTotal('');
    setCountedCash(0);
  };

  // Format cash logs for layout views
  const formatLogType = (type: string) => {
      switch (type) {
          case 'opening_float': return 'Opening Shift Float';
          case 'expense': return 'Expensed Till Cash';
          case 'restock': return 'COD Stock Purchase';
          case 'owner_collection': return 'Safe Drops / Outflow';
          case 'closing_count': return 'Closing Reconciliation';
          case 'cash_sale': return 'Gross Cash Sales';
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
          default: return <FileText className="w-4 h-4 text-zinc-600" />;
      }
  };

  // Printing a formal print receipt on a separate visual DOM for physical audits (80mm & standard compliant)
  const handlePrintAuditReceipt = (session: RegisterSession, customLogs: CashLog[] = []) => {
    const pWindow = window.open('', '_blank');
    if (!pWindow) {
      toast.error('Print popup blocked. Please allow popups.');
      return;
    }

    const tellerName = profilesMap[session.user_id]?.full_name || 'System Operator';
    const finalVariance = session.variance ?? ((session.closing_balance || 0) - (session.expected_balance || 0));

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shift Audit Report - Ref ${session.id.substring(0, 8)}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&family=Inter:wght@400;500;600;700&display=swap');
            body {
              font-family: 'JetBrains Mono', monospace;
              color: #111827;
              padding: 24px;
              max-width: 420px;
              margin: 0 auto;
              background-color: white;
              font-size: 13px;
              line-height: 1.5;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #e4e4e7;
              padding-bottom: 16px;
              margin-bottom: 16px;
            }
            .title {
              font-size: 17px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta-line {
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
              font-size: 12px;
            }
            .bold {
              font-weight: 700;
            }
            .divider {
              border-top: 1px dashed #e4e4e7;
              margin: 12px 0;
            }
            .double-divider {
              border-top: 3px double #111827;
              margin: 16px 0;
            }
            .metric-row {
              display: flex;
              justify-content: space-between;
              padding: 3px 0;
            }
            .variance-box {
              background-color: ${finalVariance === 0 ? '#f0fdf4' : finalVariance > 0 ? '#eff6ff' : '#fef2f2'};
              border: 1px solid ${finalVariance === 0 ? '#bbf7d0' : finalVariance > 0 ? '#bfdbfe' : '#fecaca'};
              padding: 8px;
              text-align: center;
              font-weight: 700;
              margin-top: 12px;
              border-radius: 4px;
            }
            .log-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
              margin-top: 10px;
            }
            .log-table th {
              text-align: left;
              border-bottom: 1px solid #111827;
              padding-bottom: 4px;
            }
            .log-table td {
              padding: 5px 0;
              border-bottom: 1px solid #f4f4f5;
            }
            .sign-section {
              margin-top: 40px;
              font-size: 11px;
            }
            .sign-line {
              border-bottom: 1px solid #71717a;
              height: 35px;
              width: 180px;
              margin-bottom: 4px;
            }
            .button-print {
              background-color: #111827;
              color: white;
              border: none;
              padding: 8px 16px;
              font-family: inherit;
              font-weight: bold;
              cursor: pointer;
              width: 100%;
              margin-bottom: 20px;
              border-radius: 4px;
            }
            @media print {
              .button-print {
                display: none !important;
              }
              body {
                padding: 10px;
              }
            }
          </style>
        </head>
        <body>
          <button class="button-print" onclick="window.print()">Print Report / Receipt</button>
          
          <div class="header">
            <div class="title">TAREZA CO-OP</div>
            <div style="font-size: 11px; color:#52525b; margin-top:4px;">Till Reconciliation Audit Sheet</div>
          </div>

          <div class="meta-line">
            <span>Shift Session ID:</span>
            <span class="bold">#${session.id.substring(0, 8).toUpperCase()}</span>
          </div>
          <div class="meta-line">
            <span>Till Operator:</span>
            <span class="bold">${tellerName}</span>
          </div>
          <div class="meta-line">
            <span>Shift Opened:</span>
            <span>${new Date(session.opened_at).toLocaleString()}</span>
          </div>
          <div class="meta-line">
            <span>Shift Closed:</span>
            <span>${session.closed_at ? new Date(session.closed_at).toLocaleString() : 'ACTIVE (UNRECONCILED)'}</span>
          </div>
          <div class="meta-line">
            <span>Shift Status:</span>
            <span class="bold" style="text-transform: uppercase; color: ${session.status === 'OPEN' ? '#0284c7' : '#111827'}">${session.status}</span>
          </div>

          <div class="double-divider"></div>

          <div class="metric-row">
            <span>(+) STARTING FLOAT:</span>
            <span class="bold">$${Number(session.opening_balance || 0).toFixed(2)}</span>
          </div>
          <div class="metric-row">
            <span>(+) GROSS CASH SALES:</span>
            <span class="bold" style="color: #0284c7;">$${Number(session.sales_total || 0).toFixed(2)}</span>
          </div>
          <div class="metric-row">
            <span>(-) OUTFLOWS/DROPS:</span>
            <span class="bold" style="color: #dc2626;">-$${Number(session.payouts_total || 0).toFixed(2)}</span>
          </div>
          
          <div class="divider"></div>
          
          <div class="metric-row" style="font-size: 14px; font-weight:700;">
            <span>(=) EXPECTED CASH:</span>
            <span>$${Number(session.expected_balance || session.opening_balance).toFixed(2)}</span>
          </div>

          <div class="metric-row" style="font-size: 14px; font-weight:700; margin-top: 6px;">
            <span>(★) COUNTED CASH:</span>
            <span>$${Number(session.closing_balance || 0).toFixed(2)}</span>
          </div>

          <div class="double-divider"></div>

          <div class="variance-box">
            VARIANCE: $${finalVariance.toFixed(2)}
            <div style="font-size: 10px; font-weight: normal; margin-top: 3px; color: #52525b;">
              ${finalVariance === 0 ? 'TILL BALANCES PERFECTLY' : finalVariance > 0 ? 'CASH SURPLUS IN TILL' : 'CASH DEFICIT IN TILL'}
            </div>
          </div>

          ${customLogs.length > 0 ? `
            <div class="divider"></div>
            <div style="font-weight:bold; font-size:12px; margin-bottom: 6px;">SHIFT MOVEMENT LOGS:</div>
            <table class="log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Activity</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${customLogs.map(l => `
                  <tr>
                    <td>${new Date(l.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td>${formatLogType(l.transaction_type)}<br/><span style="color:#71717a; font-size:9px;">${l.notes || ''}</span></td>
                    <td style="text-align: right; font-weight: bold;">$${Number(l.amount).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <div class="double-divider"></div>

          <div class="sign-section">
            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
              <div>
                <div class="sign-line"></div>
                <div>Cashier Signature</div>
              </div>
              <div>
                <div class="sign-line"></div>
                <div>Manager Signature</div>
              </div>
            </div>
          </div>

          <div style="text-align:center; font-size:9x; color:#71717a; margin-top:40px; border-top:1px dashed #e4e4e7; padding-top:10px;">
            Tareza ERP POS Reconciliations. Page compiled at ${new Date().toLocaleString()}.
          </div>

          <script>
            window.addEventListener('load', () => {
              setTimeout(() => { window.print(); }, 400);
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
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchActiveShiftAndAccounting} 
            className="border-zinc-200 text-zinc-600 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload
          </Button>
          <Badge variant="outline" className={`px-3 py-1 text-xs font-semibold rounded-full ${isDrawerOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
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
          <TabsTrigger value="shift-logs" className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium">
            <History className="w-4 h-4" /> Registers & Shifts Log
          </TabsTrigger>
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
                  <p className="text-[11px] text-zinc-400 mt-1">Expenses, restocks & collections</p>
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
            <div className="lg:col-span-6 space-y-6">
              {!isDrawerOpen ? (
                <Card className="border-indigo-100 bg-white shadow-xl rounded-2xl overflow-hidden relative">
                  <div className="h-1.5 w-full bg-indigo-600"></div>
                  <CardHeader className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                        <Lock className="w-5 h-5" />
                      </div>
                      <CardTitle className="text-lg font-bold text-zinc-950">Unlock Till Register</CardTitle>
                    </div>
                    <CardDescription className="text-sm">
                      Establish the initial physical banknotes float to record till drops and checkout sales properly.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="float" className="text-xs font-bold text-zinc-650 uppercase tracking-wider">
                        Starting Shift Float (USD / base) {requireFloat ? '*' : '(Optional)'}
                      </Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-5 w-5 text-indigo-600" />
                        <Input 
                          id="float" 
                          type="number" 
                          placeholder={requireFloat ? "0.00" : "0.00 (Optional - Defaults to zero)"} 
                          className="pl-10 text-xl font-mono border-zinc-200 h-11 focus-visible:ring-indigo-500 bg-zinc-50/50"
                          value={startingFloatInput}
                          onChange={(e) => setStartingFloatInput(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-xl transition-all">
                      <div className="space-y-0.5">
                        <Label htmlFor="req-float-toggle" className="text-xs font-bold text-zinc-800 cursor-pointer block">Require Cash Float to Open</Label>
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
                    
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs leading-relaxed text-zinc-600">
                      <p className="font-semibold text-zinc-800 mb-1">Operational Protocol Note:</p>
                      <p>
                        Opening a register generates a session trace ID linking to your profile. This audit record tracks all till payments and deposits until end of shift closing cash reconciliations.
                      </p>
                    </div>

                    <Button className="w-full bg-indigo-600 text-white hover:bg-indigo-700 h-11" onClick={handleOpenRegister}>
                      <Unlock className="w-4 h-4 mr-2" /> Open Drawer Session
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
                        <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60">
                          <span className="text-xs font-bold text-zinc-700 uppercase tracking-widest flex items-center gap-1.5">
                            <Calculator className="w-3.5 h-3.5 text-indigo-500" /> Bill Counter
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[10px] text-zinc-500 hover:text-zinc-700 p-1 h-6"
                            onClick={clearCalculators}
                          >
                            <RotateCcw className="w-2.5 h-2.5 mr-1" /> Clear Tray
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          {[100, 50, 20, 10, 5, 2, 1].map((denom) => (
                            <div key={denom} className="flex items-center justify-between text-xs font-medium text-zinc-600">
                              <span className="w-10 text-right pr-2">${denom} x</span>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="w-5 h-5 rounded-full"
                                  onClick={() => handleDenominationChange(denom, (denominations[denom] || 0) - 1)}
                                >
                                  -
                                </Button>
                                <Input 
                                  type="number"
                                  min="0"
                                  className="w-12 h-6 text-center font-mono text-[11px] p-0 border-zinc-200 bg-white"
                                  value={denominations[denom] || ''}
                                  onChange={(e) => handleDenominationChange(denom, parseInt(e.target.value) || 0)}
                                />
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="w-5 h-5 rounded-full"
                                  onClick={() => handleDenominationChange(denom, (denominations[denom] || 0) + 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          <div className="col-span-2 pt-2 border-t border-zinc-200/40 flex items-center justify-between text-xs font-medium text-zinc-700">
                            <span>Coins / Cent Total:</span>
                            <div className="relative">
                              <span className="absolute left-1.5 top-1.5 text-[10px] text-zinc-400 font-bold">$</span>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00"
                                className="w-24 h-7 pl-4 text-right font-mono text-[11px]"
                                value={coinTotal}
                                onChange={(e) => handleCoinTotalChange(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 flex justify-between items-center font-semibold text-xs border-t border-zinc-200 bg-indigo-50/50 p-2 rounded-lg text-indigo-950">
                          <span>Computed Cash Total:</span>
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
                      <TabsTrigger value="expense" className="text-xs rounded font-medium">Expense</TabsTrigger>
                      <TabsTrigger value="restock" className="text-xs rounded font-medium">Restock COD</TabsTrigger>
                      <TabsTrigger value="owner_collection" className="text-xs rounded font-medium">Safe Drop</TabsTrigger>
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
                              : entryType === 'restock' 
                                ? "e.g., Cash purchase of fresh vegetable delivery" 
                                : "e.g., Vault cash transfers (Manager Collection)"
                          } 
                          className="bg-white border-zinc-200"
                          value={entryNotes}
                          onChange={(e) => setEntryNotes(e.target.value)}
                          disabled={!isDrawerOpen}
                        />
                      </div>
                      
                      <Button className="w-full bg-slate-800 text-white hover:bg-slate-700 h-10" onClick={handleAddLog} disabled={!isDrawerOpen}>
                        Record Transaction Outflow
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
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold font-mono">
                              {['expense', 'restock', 'owner_collection'].includes(log.transaction_type) ? '-' : ''}${Number(log.amount).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
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
                        <div className="text-right font-mono font-bold">
                          {['expense', 'restock', 'owner_collection'].includes(log.transaction_type) ? '-' : ''}${Number(log.amount).toFixed(2)}
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
