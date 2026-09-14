import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Lock, History, Sliders, DollarSign, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/firebaseClient';
import { useBusinessStore } from '../store';
import { postJournalEntry } from '../services/ledgerService';
import { useCashManagement, RegisterSession, CashLog } from '../hooks/useCashManagement';
import { ActiveShiftOverview } from '../components/cash/ActiveShiftOverview';
import { PastShiftsHistory } from '../components/cash/PastShiftsHistory';
import { DenominationCalculatorModal } from '../components/cash/DenominationCalculatorModal';
import { SessionAuditModal } from '../components/cash/SessionAuditModal';

export default function CashManagement() {
  const { activeBranch, currentBusiness } = useBusinessStore();
  const [activeTab, setActiveTab] = useState('active-shift');

  const {
    activeSession,
    isDrawerOpen,
    isLoading,
    historyLoading,
    startingFloatAmount,
    sessionCashSales,
    sessionGrossSales,
    sessionCogs,
    sessionSalesCount,
    sessionOutflows,
    expectedCash,
    cashLogs,
    pastSessions,
    profilesMap,
    businessId,
    branchId,
    userId,
    rates,
    fetchActiveShiftAndAccounting,
    fetchShiftHistory
  } = useCashManagement(activeBranch);

  const [requireFloat, setRequireFloat] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(() => {
    return localStorage.getItem('tareza_cash_advanced_mode') === 'true';
  });

  useEffect(() => {
    const floatStored = localStorage.getItem('tareza_require_float');
    setRequireFloat(floatStored === 'true');
  }, []);

  const toggleAdvanced = (val: boolean) => {
    setShowAdvanced(val);
    localStorage.setItem('tareza_cash_advanced_mode', String(val));
    toast.info(val ? "Advanced tools enabled." : "Lite Mode enabled.");
  };

  // Denomination calculator modal state
  const [showDenominationCalc, setShowDenominationCalc] = useState(false);
  const [calcCurrency, setCalcCurrency] = useState<'USD' | 'ZWG' | 'ZAR'>('USD');
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

  // Session audit modal state
  const [selectedAuditSession, setSelectedAuditSession] = useState<RegisterSession | null>(null);
  const [auditLogs, setAuditLogs] = useState<CashLog[]>([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Actions
  const handleOpenRegister = async (startingFloatInput: string) => {
    try {
      const floatAmount = parseFloat(startingFloatInput) || 0;
      if (requireFloat && (!startingFloatInput || floatAmount <= 0)) {
        toast.error('Starting cash float is required.');
        return;
      }

      await supabase.from('cash_drawer_logs').insert([{
        business_id: businessId,
        branch_id: branchId || null,
        amount: floatAmount,
        type: 'opening',
        transaction_type: 'opening_float',
        notes: 'Register opened with starting float',
        created_at: new Date().toISOString()
      }]);

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

      await supabase.from('register_sessions').insert(sessionItem);
      fetchActiveShiftAndAccounting();
      toast.success(`Register successfully opened with $${floatAmount.toFixed(2)} float.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to open register session');
    }
  };

  const handleCloseRegister = async (countedCash: number, notes: string) => {
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

      if (activeSession) {
        const patches = {
          closing_balance: countedCash,
          expected_balance: expectedCash,
          variance: calculatedVariance,
          status: 'CLOSED' as const,
          closed_at: new Date().toISOString(),
          sales_total: sessionGrossSales || sessionCashSales,
          sales_count: sessionSalesCount,
          cogs_total: sessionCogs,
          cogs: sessionCogs,
          payouts_total: sessionOutflows
        };
        await supabase.from('register_sessions').eq('id', activeSession.id).update(patches);
      }

      setDenominations({
        USD: { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 },
        ZWG: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0 },
        ZAR: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0 }
      });
      setCoinTotals({ USD: '', ZWG: '', ZAR: '' });
      fetchActiveShiftAndAccounting();
      toast.success('Register safely closed. Reconciled summary saved.');
    } catch (e) {
      console.error(e);
      toast.error('Could not freeze register session.');
    }
  };

  const handleAddLog = async (entryAmount: string, entryType: string, entryNotes: string) => {
    if (!entryAmount || parseFloat(entryAmount) <= 0) {
      toast.error('Please enter a valid cash amount');
      return;
    }

    try {
      let logType = 'payout';
      if (entryType === 'owner_collection') logType = 'drop';
      else if (entryType === 'cash_in') logType = 'payin';

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

      toast.success(entryType === 'cash_in' ? `Cash Inbound of $${amt.toFixed(2)} recorded.` : `Cash $${amt.toFixed(2)} ${entryType} recorded.`);
      fetchActiveShiftAndAccounting();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save till transaction');
    }
  };

  const handleReverseLog = async (log: CashLog) => {
    if (log.notes.startsWith('[REVERSED]') || log.transaction_type.startsWith('reversal_')) {
      toast.error('This transaction is already reversed or is a reversal itself.');
      return;
    }

    if (!confirm(`Are you sure you want to reverse this transaction ($${Number(log.amount).toFixed(2)})?`)) {
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

      await supabase.from('cash_drawer_logs').insert([{
        business_id: businessId,
        branch_id: branchId || null,
        amount: Number(log.amount),
        type: correctionType,
        transaction_type: correctionTxType,
        notes: notes,
        created_at: new Date().toISOString()
      }]);

      await supabase.from('cash_drawer_logs')
        .update({ notes: `[REVERSED] ${log.notes}` })
        .eq('id', log.id);

      toast.success('Transaction successfully reversed!');
      fetchActiveShiftAndAccounting();
    } catch (e) {
      console.error(e);
      toast.error('Failed to reverse transaction');
    }
  };

  const handleOpenAudit = async (session: RegisterSession) => {
    let sessionCopy = { ...session };
    try {
      const startIso = new Date(session.opened_at).toISOString();
      const endIso = session.closed_at ? new Date(session.closed_at).toISOString() : new Date().toISOString();

      let logQuery = supabase.from('cash_drawer_logs')
        .select('*')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true });

      if (businessId && businessId !== '00000000-0000-0000-0000-000000000000') {
        logQuery = logQuery.eq('business_id', businessId);
      }

      const { data: logsData } = await logQuery;
      setAuditLogs(logsData || []);

      // If cogs_total is 0 or missing, calculate perpetual COGS dynamically for the audit modal
      if (!sessionCopy.cogs_total && !sessionCopy.cogs) {
        let salesQ = supabase.from('sales')
          .select('items, total, status')
          .gte('created_at', startIso)
          .lte('created_at', endIso);

        if (businessId && businessId !== '00000000-0000-0000-0000-000000000000') {
          salesQ = salesQ.eq('business_id', businessId);
        }
        const { data: sDocs } = await salesQ;

        let pQuery = supabase.from('products').select('id, cost_price, costPrice, sku, pack_size');
        if (businessId && businessId !== '00000000-0000-0000-0000-000000000000') {
          pQuery = pQuery.eq('business_id', businessId);
        }
        const { data: pList } = await pQuery;
        const pMap = new Map((pList || []).map((p: any) => [p.id, p]));

        let computedCogs = 0;
        let computedSales = 0;

        (sDocs || []).forEach((s: any) => {
          if (['REFUNDED', 'VOIDED', 'CANCELLED'].includes(String(s.status || '').toUpperCase())) return;
          computedSales += Number(s.total || 0);

          let items: any[] = [];
          if (Array.isArray(s.items)) items = s.items;
          else if (typeof s.items === 'string') {
            try { items = JSON.parse(s.items); } catch { items = []; }
          }

          items.forEach((it: any) => {
            const qty = Number(it.quantity || 1);
            let cost = 0;
            const emb = it.product?.cost_price ?? it.product?.costPrice ?? it.costPrice ?? it.cost_price;
            if (emb !== undefined && emb !== null && Number(emb) > 0) {
              cost = Number(emb);
            } else {
              const pId = it.product?.id || it.product_id || it.productId;
              if (pId && pMap.has(pId)) {
                cost = Number(pMap.get(pId).cost_price ?? pMap.get(pId).costPrice ?? 0);
              }
            }

            let mult = 1;
            const sku = it.product?.sku || it.sku || '';
            const match = sku.match(/\|PK:(\d+)/i);
            if (match) mult = parseInt(match[1], 10);
            else if (it.tier === 'wholesale' || String(it.tier || '').toLowerCase().includes('wholesale')) {
              const pObj = it.product || (it.product_id ? pMap.get(it.product_id) : null);
              if (pObj?.pack_size) mult = Number(pObj.pack_size) || 1;
            }

            computedCogs += (qty * mult * cost);
          });
        });

        sessionCopy.cogs_total = computedCogs;
        sessionCopy.cogs = computedCogs;
        if (!sessionCopy.sales_total && computedSales > 0) {
          sessionCopy.sales_total = computedSales;
        }

        if (sessionCopy.id && !sessionCopy.id.startsWith('off-shift-')) {
          supabase.from('register_sessions')
            .update({ cogs_total: computedCogs, cogs: computedCogs, sales_total: sessionCopy.sales_total })
            .eq('id', sessionCopy.id)
            .then(() => {});
        }
      }

      setSelectedAuditSession(sessionCopy);
      setIsAuditModalOpen(true);
    } catch (e) {
      console.error(e);
      setSelectedAuditSession(sessionCopy);
      setIsAuditModalOpen(true);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-600" />
            Cash Drawer & Register Shift Control
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Monitor till openings, live cash sales, micro-expenses, float additions, and shift reconciliations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <Sliders className="h-3.5 w-3.5 text-zinc-500" />
            <Label htmlFor="adv-mode" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
              Advanced Controls
            </Label>
            <Switch
              id="adv-mode"
              checked={showAdvanced}
              onCheckedChange={toggleAdvanced}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        if (val === 'history') fetchShiftHistory();
      }}>
        <TabsList className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          <TabsTrigger value="active-shift" className="text-xs font-bold gap-1.5 rounded-lg cursor-pointer">
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
            Active Shift Control
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-bold gap-1.5 rounded-lg cursor-pointer">
            <History className="h-3.5 w-3.5 text-zinc-500" />
            Shift Reconciliation Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active-shift" className="mt-4 space-y-6">
          <ActiveShiftOverview
            isDrawerOpen={isDrawerOpen}
            activeSession={activeSession}
            startingFloatAmount={startingFloatAmount}
            sessionCashSales={sessionCashSales}
            sessionOutflows={sessionOutflows}
            expectedCash={expectedCash}
            cashLogs={cashLogs}
            onOpenRegister={handleOpenRegister}
            onCloseRegister={handleCloseRegister}
            onAddLog={handleAddLog}
            onReverseLog={handleReverseLog}
            onOpenDenominationCalc={() => setShowDenominationCalc(true)}
            requireFloat={requireFloat}
            showAdvanced={showAdvanced}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <PastShiftsHistory
            pastSessions={pastSessions}
            historyLoading={historyLoading}
            onRefresh={fetchShiftHistory}
            onViewAudit={handleOpenAudit}
            profilesMap={profilesMap}
            businessName={currentBusiness?.name || 'TAREZA ENTERPRISE WORKSPACE'}
            branchName={activeBranch?.name || 'Main Store Branch'}
          />
        </TabsContent>
      </Tabs>

      {/* Denomination Counter Modal */}
      <DenominationCalculatorModal
        open={showDenominationCalc}
        onOpenChange={setShowDenominationCalc}
        calcCurrency={calcCurrency}
        setCalcCurrency={setCalcCurrency}
        denominations={denominations}
        setDenominations={setDenominations}
        coinTotals={coinTotals}
        setCoinTotals={setCoinTotals}
        rates={rates}
        onApplyCountedCash={(totalUsd) => {
          // Handled inside component, updates countedCash
        }}
      />

      {/* Session Audit Modal */}
      <SessionAuditModal
        open={isAuditModalOpen}
        onOpenChange={setIsAuditModalOpen}
        session={selectedAuditSession}
        auditLogs={auditLogs}
        profilesMap={profilesMap}
        businessName={currentBusiness?.name || 'TAREZA ENTERPRISE WORKSPACE'}
        branchName={activeBranch?.name || 'Main Store Branch'}
      />
    </div>
  );
}
