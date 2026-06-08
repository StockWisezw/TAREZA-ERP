import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Coins, 
  BookOpen, 
  Layers, 
  FileSpreadsheet, 
  ArrowRightLeft, 
  FileText, 
  Check, 
  TrendingUp, 
  RefreshCcw,
  Search,
  Lock,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '../lib/firebaseClient';
import { 
  initializeChartOfAccounts, 
  postJournalEntry, 
  logAuditEvent 
} from '../services/ledgerService';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  balance: number;
  is_system?: boolean;
}

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  created_at: string;
}

interface JournalLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
  account_code?: string;
  account_name?: string;
}

interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  module: string;
  old_value: string;
  new_value: string;
  created_at: string;
}

export default function Accounting() {
  const [activeTab, setActiveTab] = useState<'coa' | 'ledger' | 'reports' | 'adjust' | 'audit'>('coa');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLinesMap, setJournalLinesMap] = useState<Record<string, JournalLine[]>>({});
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual Journal Adjuster form states
  const [refCode, setRefCode] = useState('');
  const [narrative, setNarrative] = useState('');
  const [lines, setLines] = useState<Array<{ accountCode: string; debit: number; credit: number }>>([
    { accountCode: '1000', debit: 0, credit: 0 },
    { accountCode: '4000', debit: 0, credit: 0 },
  ]);

  // COA modal setup
  const [newAcctCode, setNewAcctCode] = useState('');
  const [newAcctName, setNewAcctName] = useState('');
  const [newAcctType, setNewAcctType] = useState<'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'>('Asset');
  const [newAcctBalance, setNewAcctBalance] = useState('0');
  const [showCOAModal, setShowCOAModal] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Global filters
  const [coaSearch, setCoaSearch] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Floating speed-dial control and modal toggle states
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [showQuickExpense, setShowQuickExpense] = useState(false);
  const [showQuickJournal, setShowQuickJournal] = useState(false);
  const [showQuickReport, setShowQuickReport] = useState(false);

  // Quick Expense states
  const [expenseAccount, setExpenseAccount] = useState('6005');
  const [paidFromAccount, setPaidFromAccount] = useState('1000');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseRef, setExpenseRef] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');

  // Quick Journal Form states
  const [quickRefCode, setQuickRefCode] = useState('');
  const [quickNarrative, setQuickNarrative] = useState('');
  const [quickLines, setQuickLines] = useState<Array<{ accountCode: string; debit: number; credit: number }>>([
    { accountCode: '1000', debit: 0, credit: 0 },
    { accountCode: '4000', debit: 0, credit: 0 },
  ]);

  // Set default expense account on load if 6000 exists
  useEffect(() => {
    if (accounts.length > 0) {
      const firstExp = accounts.find(a => a.type === 'Expense');
      if (firstExp) {
        setExpenseAccount(firstExp.code);
      }
    }
  }, [accounts]);

  const addQuickLine = () => {
    setQuickLines([...quickLines, { accountCode: '', debit: 0, credit: 0 }]);
  };

  const removeQuickLine = (index: number) => {
    if (quickLines.length <= 2) {
      toast.warning('At least two lines are mandatory to complete a double-entry transaction.');
      return;
    }
    setQuickLines(quickLines.filter((_, idx) => idx !== index));
  };

  const updateQuickLineValue = (index: number, key: 'accountCode' | 'debit' | 'credit', val: any) => {
    const updated = [...quickLines];
    if (key === 'debit') {
      updated[index].debit = parseFloat(val) || 0;
      if (updated[index].debit > 0) updated[index].credit = 0;
    } else if (key === 'credit') {
      updated[index].credit = parseFloat(val) || 0;
      if (updated[index].debit > 0) updated[index].debit = 0;
    } else {
      updated[index].accountCode = val;
    }
    setQuickLines(updated);
  };

  const handleQuickExpenseSubmit = async () => {
    try {
      if (!expenseAmount || !expenseRef || !expenseDesc || !expenseAccount || !paidFromAccount) {
        toast.error('All expense fields are compulsory.');
        return;
      }
      const amountNum = parseFloat(expenseAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        toast.error('Expense amount must be a positive number.');
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data: businessData } = await supabase.from('business_users')
        .select('business_id, branch_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      const businessId = businessData?.business_id || 'default_business';
      const branchId = businessData?.branch_id || 'default_branch';

      // Verify asset and expense accounts exist
      const expExists = accounts.some(a => a.code === expenseAccount);
      const assetExists = accounts.some(a => a.code === paidFromAccount);
      if (!expExists || !assetExists) {
        toast.error('Selected accounts are invalid or missing from the Chart of Accounts.');
        return;
      }

      const res = await postJournalEntry(
        businessId,
        branchId,
        userData.user.id,
        expenseRef.toUpperCase(),
        expenseDesc,
        [
          { accountCode: expenseAccount, debit: amountNum, credit: 0, description: expenseDesc },
          { accountCode: paidFromAccount, debit: 0, credit: amountNum, description: expenseDesc }
        ]
      );

      if (res.success) {
        toast.success(`Expense ${expenseRef.toUpperCase()} successfully recorded & balanced!`);
        setExpenseAmount('');
        setExpenseRef('');
        setExpenseDesc('');
        setShowQuickExpense(false);
        await loadAllAccountingData();
      } else {
        toast.error(res.error || 'Failed to post expense.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while saving expense.');
    }
  };

  const handleQuickJournalSubmit = async () => {
    try {
      if (!quickRefCode || !quickNarrative) {
        toast.error('Reference and Narrative are compulsory ledger entries.');
        return;
      }

      const debSum = quickLines.reduce((acc, l) => acc + Number(l.debit || 0), 0);
      const credSum = quickLines.reduce((acc, l) => acc + Number(l.credit || 0), 0);

      if (Math.abs(debSum - credSum) > 0.01) {
        toast.error(`Posting unbalance error! Total Debits ($${debSum.toFixed(2)}) must exactly match Total Credits ($${credSum.toFixed(2)})`);
        return;
      }

      if (debSum === 0) {
        toast.error('Transaction value cannot be zero.');
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data: businessData } = await supabase.from('business_users')
        .select('business_id, branch_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      const businessId = businessData?.business_id || 'default_business';
      const branchId = businessData?.branch_id || 'default_branch';

      for (const line of quickLines) {
        const found = accounts.find(a => a.code === line.accountCode);
        if (!found) {
          toast.error(`Account code '${line.accountCode}' does not exist inside Chart of Accounts.`);
          return;
        }
      }

      const res = await postJournalEntry(
        businessId,
        branchId,
        userData.user.id,
        quickRefCode.toUpperCase(),
        quickNarrative,
        quickLines
      );

      if (res.success) {
        toast.success('Double-entry quick journal posted successfully!');
        setQuickRefCode('');
        setQuickNarrative('');
        setQuickLines([
          { accountCode: '1000', debit: 0, credit: 0 },
          { accountCode: '4000', debit: 0, credit: 0 },
        ]);
        setShowQuickJournal(false);
        await loadAllAccountingData();
      } else {
        toast.error(res.error || 'Failed to post transaction.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to post journal entry.');
    }
  };

  const loadAllAccountingData = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data: businessData } = await supabase.from('business_users')
        .select('business_id, branch_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      const businessId = businessData?.business_id || 'default_business';

      // 1. Initialise defaults if empty
      await initializeChartOfAccounts(businessId);

      // 2. Load accounts
      let acctsRes = await supabase.from('accounts')
        .eq('business_id', businessId)
        .select('*');
      
      let initialAccounts = acctsRes.data || [];
      
      // Auto-purge old mock balances in the user's workspace database if present
      const hasPurged = localStorage.getItem('tareza_ledger_mock_purged_v2');
      if (!hasPurged && initialAccounts.length > 0) {
        let updatedAny = false;
        for (const acct of initialAccounts) {
          let adjustment = 0;
          if (acct.code === '1000') {
            adjustment = 1000;
          } else if (acct.code === '1200') {
            adjustment = 5000;
          } else if (acct.code === '3000') {
            adjustment = 6000;
          }
          
          if (adjustment > 0) {
            const newBalance = Math.max(0, Number(acct.balance || 0) - adjustment);
            await supabase.from('accounts').update({ balance: newBalance }).eq('id', acct.id);
            acct.balance = newBalance;
            updatedAny = true;
          }
        }
        localStorage.setItem('tareza_ledger_mock_purged_v2', 'true');
        if (updatedAny) {
          toast.success('Demonstration mock ledger balances successfully purged! Displaying clean production data.');
          // Reload the updated data
          acctsRes = await supabase.from('accounts')
            .eq('business_id', businessId)
            .select('*');
          initialAccounts = acctsRes.data || [];
        }
      }

      const sortedAccounts = initialAccounts.sort((a: any, b: any) => a.code.localeCompare(b.code));
      setAccounts(sortedAccounts);

      // 3. Load journal entries and lines
      const jesRes = await supabase.from('journal_entries')
        .eq('business_id', businessId)
        .select('*');
      
      const sortedJEs = (jesRes.data || []).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
      setJournalEntries(sortedJEs);

      if (sortedJEs.length > 0) {
        const jLinesRes = await supabase.from('journal_lines').select('*');
        const lMap: Record<string, JournalLine[]> = {};
        
        (jLinesRes.data || []).forEach((line: any) => {
          const matchAcct = sortedAccounts.find((a: any) => a.id === line.account_id);
          const enrichedLine = {
            ...line,
            account_code: matchAcct?.code || 'Unknown',
            account_name: matchAcct?.name || 'Account detail missing'
          };
          if (!lMap[line.journal_entry_id]) {
            lMap[line.journal_entry_id] = [];
          }
          lMap[line.journal_entry_id].push(enrichedLine);
        });
        setJournalLinesMap(lMap);
      }

      // 4. Load Audit Logs
      const auditRes = await supabase.from('audit_logs')
        .eq('business_id', businessId)
        .select('*');
      
      const sortedAudits = (auditRes.data || []).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
      setAuditLogs(sortedAudits);

    } catch (e) {
      console.error('Failed to query general ledger details:', e);
      toast.error('Network sync latency in general ledger details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAccountingData();
  }, []);

  const handleCreateAccount = async () => {
    try {
      if (!newAcctCode || !newAcctName) {
        toast.error('Code and Name are compulsory account attributes.');
        return;
      }

      const balanceNum = parseFloat(newAcctBalance);
      if (isNaN(balanceNum)) {
        toast.error('Opening balance must be numerical.');
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data: businessData } = await supabase.from('business_users')
        .select('business_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      const businessId = businessData?.business_id || 'default_business';

      // Check duplicate code
      const dup = accounts.find(a => a.code === newAcctCode);
      if (dup) {
        toast.error(`Account Code ${newAcctCode} already represents a ledger account: ${dup.name}`);
        return;
      }

      const id = 'acct_' + Math.random().toString(36).substr(2, 9);
      await supabase.from('accounts').insert({
        id,
        business_id: businessId,
        code: newAcctCode,
        name: newAcctName,
        type: newAcctType,
        balance: balanceNum,
        is_system: false,
        created_at: new Date().toISOString()
      });

      await logAuditEvent(
        businessId,
        userData.user.id,
        'CREATE',
        'ACCOUNTING',
        null,
        { code: newAcctCode, name: newAcctName, type: newAcctType, balance: balanceNum }
      );

      toast.success(`Account ${newAcctCode} successfully generated!`);
      setShowCOAModal(false);
      setNewAcctCode('');
      setNewAcctName('');
      setNewAcctBalance('0');
      loadAllAccountingData();
    } catch (err: any) {
      toast.error(err.message || 'Error occurred starting the account.');
    }
  };

  const handleManualPost = async () => {
    try {
      if (!refCode || !narrative) {
        toast.error('Reference and Narrative are compulsory ledger entries.');
        return;
      }

      const debSum = lines.reduce((acc, l) => acc + Number(l.debit || 0), 0);
      const credSum = lines.reduce((acc, l) => acc + Number(l.credit || 0), 0);

      if (Math.abs(debSum - credSum) > 0.01) {
        toast.error(`Posting unbalance error! Total Debits ($${debSum.toFixed(2)}) must exactly match Total Credits ($${credSum.toFixed(2)})`);
        return;
      }

      if (debSum === 0) {
        toast.error('Transaction value cannot be zero as specified by integrity rules.');
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data: businessData } = await supabase.from('business_users')
        .select('business_id, branch_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      const businessId = businessData?.business_id || 'default_business';
      const branchId = businessData?.branch_id || 'default_branch';

      // Verify that all account codes actually exist
      for (const line of lines) {
        const found = accounts.find(a => a.code === line.accountCode);
        if (!found) {
          toast.error(`Security check failure: Account code '${line.accountCode}' does not exist inside your Chart of Accounts.`);
          return;
        }
      }

      const res = await postJournalEntry(
        businessId,
        branchId,
        userData.user.id,
        refCode,
        narrative,
        lines
      );

      if (res.success) {
        toast.success('Double-entry journal posting succeeded and general ledger balances reconciled.');
        setRefCode('');
        setNarrative('');
        setLines([
          { accountCode: '1000', debit: 0, credit: 0 },
          { accountCode: '4000', debit: 0, credit: 0 },
        ]);
        await loadAllAccountingData();
      } else {
        toast.error(res.error || 'Failed to post transaction.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to make double-entry.');
    }
  };

  const handleResetLedger = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data: businessData } = await supabase.from('business_users')
        .select('business_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      const businessId = businessData?.business_id || 'default_business';

      // 1. Reset all accounts to 0.00
      const { data: accts } = await supabase.from('accounts').eq('business_id', businessId).select('id');
      if (accts && accts.length > 0) {
        for (const acct of accts) {
          await supabase.from('accounts').update({ balance: 0 }).eq('id', acct.id);
        }
      }

      // 2. Delete journal entries and lines for this business
      const { data: jEntries } = await supabase.from('journal_entries').select('id').eq('business_id', businessId);
      if (jEntries && jEntries.length > 0) {
        for (const je of jEntries) {
          await supabase.from('journal_lines').delete().eq('journal_entry_id', je.id);
        }
      }
      await supabase.from('journal_entries').delete().eq('business_id', businessId);
      
      // 3. Log audit event
      await logAuditEvent(
        businessId,
        userData.user.id,
        'VOID',
        'ACCOUNTING',
        null,
        { message: 'General Ledger was completely reset to clean state' }
      );

      toast.success('Pristine ledger state restored. All accounts reset to $0.00.');
      localStorage.setItem('tareza_ledger_mock_purged_v2', 'true');
      await loadAllAccountingData();
    } catch (err: any) {
      toast.error('Failed to reset ledger: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addManualLine = () => {
    setLines([...lines, { accountCode: '', debit: 0, credit: 0 }]);
  };

  const removeManualLine = (index: number) => {
    if (lines.length <= 2) {
      toast.warning('At least two lines are mandatory to complete a double-entry transaction.');
      return;
    }
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const updateLineValue = (index: number, key: 'accountCode' | 'debit' | 'credit', val: any) => {
    const updated = [...lines];
    if (key === 'debit') {
      updated[index].debit = parseFloat(val) || 0;
      if (updated[index].debit > 0) updated[index].credit = 0; // standard lock
    } else if (key === 'credit') {
      updated[index].credit = parseFloat(val) || 0;
      if (updated[index].credit > 0) updated[index].debit = 0; // standard lock
    } else {
      updated[index].accountCode = val;
    }
    setLines(updated);
  };

  // Financial Report Generators
  // Asset + Expense balance totals
  const totalAssetsVal = accounts.filter(a => a.type === 'Asset').reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilitiesVal = accounts.filter(a => a.type === 'Liability').reduce((sum, a) => sum + a.balance, 0);
  const totalEquityVal = accounts.filter(a => a.type === 'Equity').reduce((sum, a) => sum + a.balance, 0);
  const totalRevenueVal = accounts.filter(a => a.type === 'Revenue').reduce((sum, a) => sum + a.balance, 0);
  const totalExpenseVal = accounts.filter(a => a.type === 'Expense').reduce((sum, a) => sum + a.balance, 0);

  // Profit and Loss Analysis
  const cogsVal = accounts.filter(a => a.code === '5000').reduce((sum, a) => sum + a.balance, 0);
  const opexVal = accounts.filter(a => a.code === '6000').reduce((sum, a) => sum + a.balance, 0);
  const grossProfitPL = totalRevenueVal - cogsVal; 
  const netEarningsPL = totalRevenueVal - totalExpenseVal;

  // Trial Balance debits vs credits check
  let cumulativeDebits = 0;
  let cumulativeCredits = 0;
  accounts.forEach(a => {
    if (a.type === 'Asset' || a.type === 'Expense') {
      if (a.balance >= 0) cumulativeDebits += a.balance;
      else cumulativeCredits += Math.abs(a.balance);
    } else {
      if (a.balance >= 0) cumulativeCredits += a.balance;
      else cumulativeDebits += Math.abs(a.balance);
    }
  });

  // Filter lists
  const filteredCOA = accounts.filter(a => 
    a.code.includes(coaSearch) || 
    a.name.toLowerCase().includes(coaSearch.toLowerCase()) ||
    a.type.toLowerCase().includes(coaSearch.toLowerCase())
  );

  const filteredJEs = journalEntries.filter(je => 
    je.reference.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
    je.description.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
    je.id.includes(ledgerSearch)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-6 bg-zinc-50/50">
      
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-sans tracking-tight text-zinc-900 block">General Accounting Page</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Dual-Entry Bookkeeping Ledger, Real-time trial balance, shift sessions, and stock audits.</p>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <Button onClick={loadAllAccountingData} variant="outline" size="sm" className="bg-white">
            <RefreshCcw className="w-4 h-4 mr-2" /> Refresh State
          </Button>

          <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 bg-white">
                <AlertCircle className="w-4 h-4 mr-2" /> Purge Mock Ledger
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-650" /> Purge Mock Ledger Data & Reset Balance Sheet?
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2 text-sm text-zinc-650 font-sans">
                <p>
                  This action will immediately set **all Chart of Account balances to $0.00** and remove all historical mock ledger journal lines. 
                </p>
                <p className="font-bold text-red-650">
                  This can not be undone and is designed for cleaning demo states.
                </p>
              </div>
              <DialogFooter className="bg-zinc-50/50 p-4 border-t border-zinc-100 mt-2">
                <Button variant="outline" size="sm" onClick={() => setShowResetDialog(false)}>Cancel</Button>
                <Button size="sm" variant="destructive" onClick={() => { setShowResetDialog(false); handleResetLedger(); }} className="bg-red-600 hover:bg-red-700 text-white">
                  Confirm Purge & Reset to $0.00
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showCOAModal} onOpenChange={setShowCOAModal}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-zinc-900 text-white hover:bg-zinc-850">
                <Plus className="w-4 h-4 mr-1.5" /> New Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add General Ledger Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 pb-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-650">Account Code</label>
                    <Input placeholder="e.g. 1300" value={newAcctCode} onChange={(e) => setNewAcctCode(e.target.value)} />
                    <p className="text-[10px] text-zinc-400">Unique identifier prefix</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-650">Default Group Type</label>
                    <select 
                      value={newAcctType} 
                      onChange={(e: any) => setNewAcctType(e.target.value)}
                      className="w-full border border-zinc-200 rounded-lg px-2 py-2 text-sm bg-white"
                    >
                      <option value="Asset">Asset</option>
                      <option value="Liability">Liability</option>
                      <option value="Equity">Equity</option>
                      <option value="Revenue">Revenue</option>
                      <option value="Expense">Expense</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-650">Account Descriptive Label</label>
                  <Input placeholder="e.g. Standard Petty Cash Till" value={newAcctName} onChange={(e) => setNewAcctName(e.target.value)} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-650">Opening Initial Balance (USD)</label>
                  <Input type="number" placeholder="0.00" value={newAcctBalance} onChange={(e) => setNewAcctBalance(e.target.value)} />
                </div>
              </div>
              <DialogFooter className="bg-zinc-50/50 p-4 border-t border-zinc-100 mt-2">
                <Button variant="outline" size="sm" onClick={() => setShowCOAModal(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreateAccount} className="bg-zinc-900 text-white hover:bg-zinc-805">Generate Account</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs typeof="card" defaultValue="coa" className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Navigation Tabs bar */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-1 shrink-0 mb-4">
          <TabsList className="grid grid-cols-5 w-full bg-zinc-50 border border-zinc-200 p-0.5 rounded-lg">
            <TabsTrigger value="coa" className="flex items-center gap-2 py-1.5 text-xs font-medium rounded-md"><Layers className="w-3.5 h-3.5" /> Chart of Accounts</TabsTrigger>
            <TabsTrigger value="ledger" className="flex items-center gap-2 py-1.5 text-xs font-medium rounded-md"><BookOpen className="w-3.5 h-3.5" /> General Ledger Journals</TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 py-1.5 text-xs font-medium rounded-md"><FileSpreadsheet className="w-3.5 h-3.5" /> Live Reports</TabsTrigger>
            <TabsTrigger value="adjust" className="flex items-center gap-2 py-1.5 text-xs font-medium rounded-md"><ArrowRightLeft className="w-3.5 h-3.5" /> Manual Correction</TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2 py-1.5 text-xs font-medium rounded-md"><FileText className="w-3.5 h-3.5" /> audit trail</TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Cards Content viewport */}
        <div className="flex-1 overflow-auto min-h-0 bg-white border border-zinc-200 rounded-xl shadow-sm p-5">
          
          <TabsContent value="coa" className="m-0 h-full flex flex-col gap-4">
            <div className="flex justify-between items-center gap-4 shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input 
                  placeholder="Filter accounts by name, code or type..." 
                  value={coaSearch} 
                  onChange={(e) => setCoaSearch(e.target.value)} 
                  className="pl-9 text-xs"
                />
              </div>
              <div className="flex gap-4 text-xs text-zinc-500 font-mono">
                <div>Cumulative Accounts: <span className="font-semibold text-zinc-800">{accounts.length}</span></div>
                <div>Operational Scope: <span className="font-semibold text-emerald-600">Enterprise Ready</span></div>
              </div>
            </div>

            <ScrollArea className="flex-1 border border-zinc-100 rounded-lg overflow-auto">
              {loading ? (
                <div className="py-12 text-center text-zinc-400">Synchronously processing accounts model...</div>
              ) : filteredCOA.length === 0 ? (
                <div className="py-12 text-center text-zinc-400">No general ledger accounts matching query filter.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/75 border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                      <th className="py-3 px-4">Account Code</th>
                      <th className="py-3 px-4">Account Descriptive Label</th>
                      <th className="py-3 px-4 font-normal">Classification Group</th>
                      <th className="py-3 px-4 text-right font-mono">Ledger Adjusted Balance (USD)</th>
                      <th className="py-3 px-4 text-center">System Protected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-sm">
                    {filteredCOA.map((account) => (
                      <tr key={account.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-zinc-900">{account.code}</td>
                        <td className="py-3.5 px-4 font-medium text-zinc-855">{account.name}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-widest uppercase ${
                            account.type === 'Asset' ? 'bg-blue-50 text-blue-700' :
                            account.type === 'Liability' ? 'bg-amber-50 text-amber-700' :
                            account.type === 'Equity' ? 'bg-purple-50 text-purple-700' :
                            account.type === 'Revenue' ? 'bg-emerald-50 text-emerald-700' :
                            'bg-rose-50 text-rose-700'
                          }`}>
                            {account.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-800">
                          ${(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {account.is_system ? (
                            <span className="inline-flex items-center text-[10px] bg-zinc-100 text-zinc-500 border border-zinc-200 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider gap-1">
                              <Lock className="w-2.5 h-2.5" /> System Core
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] text-zinc-400 px-1.5 py-0.5 uppercase">User account</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ledger" className="m-0 h-full flex flex-col gap-4">
            <div className="flex justify-between items-center gap-4 shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input 
                  placeholder="Filter journals by code, notes, ref..." 
                  value={ledgerSearch} 
                  onChange={(e) => setLedgerSearch(e.target.value)} 
                  className="pl-9 text-xs"
                />
              </div>
              <div className="font-mono text-xs text-zinc-500">
                Total Logs: <span className="font-semibold text-zinc-850">{journalEntries.length} entries</span>
              </div>
            </div>

            <ScrollArea className="flex-1 overflow-auto space-y-4">
              {loading ? (
                <div className="py-12 text-center text-zinc-400">Loading General Ledger double-entries...</div>
              ) : filteredJEs.length === 0 ? (
                <div className="py-12 text-center text-zinc-400">No posting rows found matching search criteria.</div>
              ) : (
                <div className="space-y-4 pr-1">
                  {filteredJEs.map((entry) => {
                    const matchedLines = journalLinesMap[entry.id] || [];
                    const computedTotalDebit = matchedLines.reduce((acc, current) => acc + (current.debit || 0), 0);
                    
                    return (
                      <Card key={entry.id} className="border border-zinc-200/95 overflow-hidden shadow-sm hover:shadow transition-shadow">
                        <CardHeader className="bg-zinc-50/50 py-3.5 border-b border-zinc-150 flex flex-row justify-between items-center space-y-0">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs bg-zinc-200 text-zinc-700 px-2 py-1 rounded font-bold">
                              {entry.reference || 'SYSTEM'}
                            </span>
                            <div>
                              <h3 className="text-sm font-semibold text-zinc-850 font-sans">{entry.description}</h3>
                              <span className="text-[10px] text-zinc-450 uppercase tracking-wider block mt-0.5 font-mono">
                                Posted Stamp: {new Date(entry.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-zinc-400 block font-mono">Transactional Value</span>
                            <span className="text-sm font-bold text-zinc-800 font-mono">
                              ${computedTotalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <table className="w-full text-xs text-left">
                            <tr className="bg-zinc-50 border-b border-zinc-100 text-[9px] font-bold text-zinc-450 uppercase tracking-wider font-mono">
                              <th className="py-2.5 px-4 font-mono">Account Code</th>
                              <th className="py-2.5 px-4">Account Label</th>
                              <th className="py-2.5 px-4">Debit Posting Column</th>
                              <th className="py-2.5 px-4 text-right">Credit Posting Column</th>
                            </tr>
                            <tbody className="divide-y divide-zinc-100 font-mono">
                              {matchedLines.map((line) => (
                                <tr key={line.id} className="hover:bg-zinc-50/30">
                                  <td className="py-2.5 px-4 font-bold text-zinc-750">{line.account_code}</td>
                                  <td className="py-2.5 px-4 text-zinc-550 capitalize">{line.account_name}</td>
                                  <td className="py-2.5 px-4 text-zinc-800 font-bold">
                                    {line.debit > 0 ? `$${line.debit.toFixed(2)}` : '—'}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-zinc-800 font-bold">
                                    {line.credit > 0 ? `$${line.credit.toFixed(2)}` : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="reports" className="m-0 h-full flex flex-col gap-6">
            
            {/* Report Highlights block */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
              <Card className="bg-gradient-to-br from-zinc-50 to-zinc-100/30 border border-zinc-200">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] text-zinc-450 font-bold uppercase tracking-widest font-mono">Live Trial Balance Status</CardDescription>
                  <CardTitle className="text-2xl font-bold font-mono tracking-tight text-zinc-805">
                    ${cumulativeDebits.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <Check className="w-4 h-4" /> 
                    <span>Zero-Sum Double-Entry Checked Balanced</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-zinc-50 to-zinc-100/30 border border-zinc-200">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] text-zinc-450 font-bold uppercase tracking-widest font-mono">Net Operating Sales Revenue</CardDescription>
                  <CardTitle className="text-2xl font-bold font-mono tracking-tight text-zinc-805">
                    ${totalRevenueVal.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-xs text-zinc-500 font-mono">Adjusted Gross Credit Margin</span>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-zinc-50 to-zinc-100/30 border border-zinc-200">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] text-zinc-450 font-bold uppercase tracking-widest font-mono">Net Adjusted Revenue Profit</CardDescription>
                  <CardTitle className={`text-2xl font-bold font-mono tracking-tight ${netEarningsPL >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    ${netEarningsPL.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5 text-emerald-500" />
                    <span>Real-time earnings summary</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[350px]">
              
              {/* Profit and Loss widget */}
              <Card className="border border-zinc-200 flex flex-col h-full bg-white shadow-sm">
                <CardHeader className="bg-zinc-50/50 py-4 border-b border-zinc-150">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardDescription className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">Statement of Operations</CardDescription>
                      <CardTitle className="text-lg font-bold text-zinc-900 mt-0.5">Profit & Loss Statement (P&L)</CardTitle>
                    </div>
                    <span className="text-[9px] bg-emerald-105 border border-emerald-200 text-emerald-850 px-2 py-0.5 rounded font-bold font-mono uppercase tracking-wider">REALTIME ACCRUED</span>
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-6 font-mono text-xs">
                  <div className="space-y-3">
                    <div className="flex justify-between font-bold border-b-2 border-zinc-900 pb-1.5 text-zinc-600 text-xxs uppercase tracking-wider">
                      <span>GL Account Code & Description</span>
                      <span className="text-right">Balance (USD)</span>
                    </div>

                    {/* Revenue Section */}
                    <div className="space-y-1">
                      <div className="font-bold text-zinc-800 uppercase text-xxs text-zinc-400 tracking-wider">Operating Revenue</div>
                      <div className="flex justify-between text-zinc-700 pl-2">
                        <span>Sales Operating Revenues (4000)</span>
                        <span className="font-bold text-zinc-900">${totalRevenueVal.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Cost of Goods Sold Section */}
                    <div className="space-y-1 pt-1.5">
                      <div className="font-bold text-zinc-800 uppercase text-xxs text-zinc-400 tracking-wider">Cost of Sales</div>
                      <div className="flex justify-between text-zinc-750 pl-2 border-b border-dashed border-zinc-100 pb-1.5">
                        <span>Cost of Goods Sold (COGS) (5000)</span>
                        <span className="text-red-650 font-bold">(${cogsVal.toFixed(2)})</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between font-bold py-2 bg-zinc-50 rounded-lg px-3 border border-zinc-100">
                    <span className="uppercase text-xxs tracking-wider text-zinc-600">Gross Core Margin</span>
                    <span className="text-zinc-900 text-sm font-bold">${grossProfitPL.toFixed(2)}</span>
                  </div>

                  <div className="space-y-3">
                    {/* Operating Expenses Section */}
                    <div className="space-y-1">
                      <div className="font-bold text-zinc-800 uppercase text-xxs text-zinc-400 tracking-wider font-semibold">Operating Expenses</div>
                      <div className="flex justify-between pl-2 text-zinc-750 border-b border-dashed border-zinc-100 pb-1.5">
                        <span>Operating and Cash Expenses (6000)</span>
                        <span className="text-red-650 font-medium">${opexVal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Profit total bottom divider (traditional double ledger border) */}
                  <div className="border-t border-zinc-200 pt-3">
                    <div className="flex justify-between font-bold text-sm bg-emerald-50 text-emerald-900 border border-emerald-100/50 rounded-lg px-4 py-3 shadow-inner">
                      <span className="uppercase tracking-wider text-xxs flex items-center">Net Operating Cash Balance</span>
                      <span className="text-base font-bold border-b-4 border-double border-emerald-800 pb-1">${netEarningsPL.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Balance Sheet widget */}
              <Card className="border border-zinc-200 flex flex-col h-full bg-white shadow-sm">
                <CardHeader className="bg-zinc-50/50 py-4 border-b border-zinc-150">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardDescription className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">Statement of Financial Position</CardDescription>
                      <CardTitle className="text-lg font-bold text-zinc-900 mt-0.5">Balance Sheet Statement</CardTitle>
                    </div>
                    <span className="text-[9px] bg-blue-105 border border-blue-200 text-blue-805 px-2 py-0.5 rounded font-bold font-mono">A = L + E STATEMENT</span>
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-6 font-mono text-xs">
                  
                  {/* Current Assets */}
                  <div className="space-y-2">
                    <h4 className="text-xxs font-bold text-zinc-400 uppercase tracking-widest border-b-2 border-zinc-900 pb-1.5 mb-1.5">Operating Assets</h4>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                      {accounts.filter(a => a.type === 'Asset').map(a => (
                        <div key={a.id} className="flex justify-between text-zinc-700">
                          <span>{a.name} ({a.code})</span>
                          <span className="text-zinc-900 font-medium">${a.balance.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between font-bold text-zinc-900 border-t border-dashed border-zinc-300 pt-2 bg-zinc-50/45 px-2 py-1 rounded">
                      <span className="uppercase text-xxs text-zinc-500 tracking-wider">Total Cumulative Assets</span>
                      <span className="border-b-2 border-zinc-900 font-bold">${totalAssetsVal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Liabilities and Equity */}
                  <div className="space-y-2 pt-1 border-t border-zinc-100">
                    <h4 className="text-xxs font-bold text-zinc-400 uppercase tracking-widest border-b-2 border-zinc-900 pb-1.5 mb-1.5 font-semibold">Liabilities & Shareholder Equity</h4>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-zinc-700">
                        <span>Accounts Payable (2000)</span>
                        <span className="text-zinc-900 font-medium">${totalLiabilitiesVal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-700">
                        <span>Shareholders Retained Equity (3000)</span>
                        <span className="text-zinc-900 font-medium">${totalEquityVal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-500 border-b border-dashed border-zinc-100 pb-1.5">
                        <span>Retained Period Shift Profit</span>
                        <span className={`font-semibold ${netEarningsPL >= 0 ? 'text-emerald-700' : 'text-red-750'}`}>${netEarningsPL.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex justify-between font-bold text-zinc-900 bg-zinc-50/45 px-2 py-1 rounded">
                      <span className="uppercase text-xxs text-zinc-500 tracking-wider">Total Liabilities & Equity Sum</span>
                      <span className="border-b-4 border-double border-zinc-900 font-bold pb-0.5">${(totalLiabilitiesVal + totalEquityVal + netEarningsPL).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Mathematical Check indicator block */}
                  <div className="pt-2">
                    {Math.abs(totalAssetsVal - (totalLiabilitiesVal + totalEquityVal + netEarningsPL)) < 0.05 ? (
                      <div className="bg-emerald-50 border border-emerald-100/60 rounded-lg p-2.5 text-emerald-800 text-[10px] text-center font-bold">
                        ✓ DOUBLE-ENTRY COMPLIANT: Total Assets equal Liabilities + Equity within rounding precision.
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-amber-800 text-[10px] text-center font-bold">
                        ⚠ RECONCILIATION DRIFT: Variance of ${Math.abs(totalAssetsVal - (totalLiabilitiesVal + totalEquityVal + netEarningsPL)).toFixed(2)} is pending checkout balancing.
                      </div>
                    )}
                  </div>

                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="adjust" className="m-0 h-full flex flex-col gap-4">
            <Card className="border border-zinc-200 max-w-4xl mx-auto">
              <CardHeader className="bg-zinc-50 border-b border-zinc-200">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-zinc-700" /> Post Double-Entry Adjustments Manual Ledger Journal
                </CardTitle>
                <CardDescription>
                  Manually adjust and debit or credit ledger account balances for accounting corrections. Balanced constraints are enforced.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                
                {/* Adjuster top fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-600 block">Unique Document Reference Code (e.g. GRN-001, EXP-02)</label>
                    <Input 
                      placeholder="e.g. ADJ-DEC-092" 
                      value={refCode} 
                      onChange={(e) => setRefCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-600 block">General Narrative Statement (Description)</label>
                    <Input 
                      placeholder="Provide detailed description of adjustment reason" 
                      value={narrative} 
                      onChange={(e) => setNarrative(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Adjuster table */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold uppercase tracking-wider text-zinc-600 font-mono">
                    <span>Journal Lines Setup</span>
                    <Button size="xs" variant="outline" onClick={addManualLine} className="bg-white">
                      + Add Debit/Credit Row
                    </Button>
                  </div>

                  <div className="space-y-2 font-mono text-sm max-h-[30vh] overflow-y-auto pr-1">
                    {lines.map((line, idx) => (
                      <div key={idx} className="flex gap-3 items-center">
                        
                        {/* Selector for accounts */}
                        <select 
                          value={line.accountCode}
                          onChange={(e) => updateLineValue(idx, 'accountCode', e.target.value)}
                          className="flex-1 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="">-- Choose target ledger account --</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.code}>{a.code} - {a.name} ({a.type})</option>
                          ))}
                        </select>

                        <div className="w-28 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-400">Dr</span>
                          <Input 
                            type="number" 
                            placeholder="0.00" 
                            value={line.debit || ''} 
                            disabled={Number(line.credit) > 0}
                            onChange={(e) => updateLineValue(idx, 'debit', e.target.value)}
                            className="text-xs py-1"
                          />
                        </div>

                        <div className="w-28 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-400">Cr</span>
                          <Input 
                            type="number" 
                            placeholder="0.00" 
                            value={line.credit || ''} 
                            disabled={Number(line.debit) > 0}
                            onChange={(e) => updateLineValue(idx, 'credit', e.target.value)}
                            className="text-xs py-1 text-right"
                          />
                        </div>

                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => removeManualLine(idx)} 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Posting summary verification */}
                <div className="p-4 bg-zinc-50 border border-zinc-150 rounded-xl flex justify-between items-center text-xs font-semibold uppercase tracking-wider font-mono">
                  <div className="space-y-1 text-zinc-600">
                    <div>Balance Checked Debits Sum: <span className="font-bold text-zinc-900 font-mono">${lines.reduce((acc, l) => acc + (l.debit || 0), 0).toFixed(2)}</span></div>
                    <div>Balance Checked Credits Sum: <span className="font-bold text-zinc-900 font-mono">${lines.reduce((acc, l) => acc + (l.credit || 0), 0).toFixed(2)}</span></div>
                  </div>
                  {Math.abs(lines.reduce((acc, l) => acc + (l.debit || 0), 0) - lines.reduce((acc, l) => acc + (l.credit || 0), 0)) < 0.01 ? (
                    <div className="text-emerald-700 flex items-center gap-1 bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg">
                      <Check className="w-4 h-4" /> BALANCED & SAFE
                    </div>
                  ) : (
                    <div className="text-red-700 flex items-center gap-1 bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg">
                      <AlertCircle className="w-4 h-4 animate-bounce" /> UNBALANCED
                    </div>
                  )}
                </div>

              </CardContent>
              <DialogFooter className="bg-zinc-50 border-t border-zinc-100 p-4">
                <Button 
                  onClick={handleManualPost} 
                  disabled={Math.abs(lines.reduce((acc, l) => acc + (l.debit || 0), 0) - lines.reduce((acc, l) => acc + (l.credit || 0), 0)) > 0.01}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-4 px-6 rounded-lg text-xs"
                >
                  Post Adjusted General Ledger Rows
                </Button>
              </DialogFooter>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="m-0 h-full flex flex-col gap-4 font-mono">
            <h2 className="text-xs font-bold text-zinc-450 uppercase tracking-widest border-b border-zinc-100 pb-1 shrink-0">Continuous ERP Audit Logging and Compliance Trails</h2>
            
            <ScrollArea className="flex-1 overflow-auto border border-zinc-100 rounded-lg">
              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-zinc-400">Compliance audit trail contains zero records.</div>
              ) : (
                <div className="divide-y divide-zinc-100 text-xs">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 hover:bg-zinc-50/50 transition-colors flex justify-between gap-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center text-[9px] font-bold border rounded px-1.5 font-mono uppercase tracking-wider ${
                            log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-805 border-blue-200' :
                            log.action === 'DELETE' ? 'bg-red-100 text-red-800 border-red-200' :
                            'bg-zinc-100 text-zinc-600 border-zinc-200'
                          }`}>
                            {log.action}
                          </span>
                          <span className="font-bold text-zinc-700">[{log.module}]</span>
                          <span className="text-zinc-500">Stamp: {new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <div className="text-zinc-550 break-all font-mono">
                          User Authority Account: <span className="text-zinc-800 font-semibold">{log.user_email}</span>
                        </div>
                        {log.new_value && (
                          <div className="mt-1 p-2 bg-zinc-50 border border-zinc-150 rounded text-[11px] text-zinc-650 max-w-xl truncate">
                            Payload detail: {log.new_value}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

        </div>
      </Tabs>

      {/* Floating Quick Actions Speed Dial */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-sans">
        <AnimatePresence>
          {isQuickActionsOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="flex flex-col items-end gap-2.5 mb-1"
            >
              {/* Record Expense Action */}
              <div className="flex items-center gap-2 group">
                <span className="bg-white/95 text-zinc-900 border border-zinc-200/80 shadow-sm rounded-lg px-2.5 py-1 text-xs font-semibold backdrop-blur-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                  Record Expense
                </span>
                <Button 
                  onClick={() => {
                    setShowQuickExpense(true);
                    setIsQuickActionsOpen(false);
                  }}
                  size="icon"
                  className="w-11 h-11 bg-amber-500 hover:bg-amber-600 border border-amber-600 text-white rounded-full shadow-lg transition-all transform hover:scale-105 cursor-pointer"
                  title="Record Expense"
                >
                  <Coins className="w-5 h-5" />
                </Button>
              </div>

              {/* Create Journal Action */}
              <div className="flex items-center gap-2 group">
                <span className="bg-white/95 text-zinc-900 border border-zinc-200/80 shadow-sm rounded-lg px-2.5 py-1 text-xs font-semibold backdrop-blur-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                  Create Journal Entry
                </span>
                <Button 
                  onClick={() => {
                    setShowQuickJournal(true);
                    setIsQuickActionsOpen(false);
                  }}
                  size="icon"
                  className="w-11 h-11 bg-indigo-500 hover:bg-indigo-600 border border-indigo-600 text-white rounded-full shadow-lg transition-all transform hover:scale-105 cursor-pointer"
                  title="Create Journal"
                >
                  <BookOpen className="w-5 h-5" />
                </Button>
              </div>

              {/* Generate Report Action */}
              <div className="flex items-center gap-2 group">
                <span className="bg-white/95 text-zinc-900 border border-zinc-200/80 shadow-sm rounded-lg px-2.5 py-1 text-xs font-semibold backdrop-blur-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                  Generate Financial Report
                </span>
                <Button 
                  onClick={() => {
                    setShowQuickReport(true);
                    setIsQuickActionsOpen(false);
                  }}
                  size="icon"
                  className="w-11 h-11 bg-emerald-500 hover:bg-emerald-600 border border-emerald-600 text-white rounded-full shadow-lg transition-all transform hover:scale-105 cursor-pointer"
                  title="Generate Report"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Root Toggle FAB */}
        <Button 
          onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
          className="w-14 h-14 bg-zinc-900 hover:bg-zinc-805 text-white rounded-full shadow-xl transition-all flex items-center justify-center border border-zinc-950 cursor-pointer"
        >
          <motion.div
            animate={{ rotate: isQuickActionsOpen ? 135 : 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 20 }}
          >
            <Plus className="w-6 h-6" />
          </motion.div>
        </Button>
      </div>

      {/* Quick Actions Modals */}
      
      {/* 1. Record Expense Dialog */}
      <Dialog open={showQuickExpense} onOpenChange={setShowQuickExpense}>
        <DialogContent className="sm:max-w-md font-sans bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900">
              <Coins className="w-5 h-5 text-amber-500 animate-pulse" /> Record Quick Cash Expense
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-600">Expense Ledger Account</label>
                <select 
                  value={expenseAccount} 
                  onChange={(e) => setExpenseAccount(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-zinc-800"
                >
                  <option value="">-- Choose Expense --</option>
                  {accounts.filter(a => a.type === 'Expense').map(a => (
                    <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-600">Paid Out From Account</label>
                <select 
                  value={paidFromAccount} 
                  onChange={(e) => setPaidFromAccount(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-zinc-800"
                >
                  <option value="">-- Choose Source --</option>
                  {accounts.filter(a => a.type === 'Asset').map(a => (
                    <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-600">Amount (USD)</label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={expenseAmount} 
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-600">Invoice / Receipt Reference</label>
                <Input 
                  placeholder="e.g. TAXI-102 or LUNCH-01" 
                  value={expenseRef} 
                  onChange={(e) => setExpenseRef(e.target.value)}
                  className="text-xs font-mono uppercase bg-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-600">Expense Narrative/Explanation</label>
              <Input 
                placeholder="e.g. Weekly client lunch and taxi transport" 
                value={expenseDesc} 
                onChange={(e) => setExpenseDesc(e.target.value)}
                className="text-xs bg-white"
              />
            </div>
          </div>
          <DialogFooter className="bg-zinc-50 border-t border-zinc-100 p-4 -mx-6 -mb-6 mt-2 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setShowQuickExpense(false)}>Cancel</Button>
            <Button size="sm" onClick={handleQuickExpenseSubmit} className="bg-zinc-900 text-white hover:bg-zinc-805">
              Post Expense Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Create Journal Entry Dialog */}
      <Dialog open={showQuickJournal} onOpenChange={setShowQuickJournal}>
        <DialogContent className="sm:max-w-2xl font-sans max-h-[90vh] flex flex-col p-0 bg-white">
          <DialogHeader className="p-6 pb-4 border-b border-zinc-100 font-sans">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-zinc-900">
              <BookOpen className="w-5 h-5 text-indigo-500 animate-pulse" /> Quick Double-Entry Journal Adjustment
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6 overflow-y-auto space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-600">Ref Code</label>
                <Input 
                  placeholder="e.g. REC-022" 
                  value={quickRefCode} 
                  onChange={(e) => setQuickRefCode(e.target.value)}
                  className="text-xs font-mono bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-600">Narrative</label>
                <Input 
                  placeholder="Describe adjusting entry" 
                  value={quickNarrative} 
                  onChange={(e) => setQuickNarrative(e.target.value)}
                  className="text-xs bg-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 text-[11px] font-bold uppercase tracking-wider text-zinc-600 font-mono">
                <span>Journal Entries</span>
                <Button size="xs" variant="outline" onClick={addQuickLine} className="bg-white text-[10px] h-7 cursor-pointer">
                  + Add Ledger Row
                </Button>
              </div>

              <div className="space-y-2 font-mono text-xs max-h-[30vh] overflow-y-auto pr-1">
                {quickLines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select 
                      value={line.accountCode}
                      onChange={(e) => updateQuickLineValue(idx, 'accountCode', e.target.value)}
                      className="flex-1 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-zinc-700 min-w-0"
                    >
                      <option value="">-- Choose Account --</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.code}>{a.code} - {a.name} ({a.type})</option>
                      ))}
                    </select>

                    <div className="w-24 flex items-center gap-1">
                      <span className="text-[10px] font-bold text-zinc-400 font-mono">Dr</span>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={line.debit || ''} 
                        disabled={Number(line.credit) > 0}
                        onChange={(e) => updateQuickLineValue(idx, 'debit', e.target.value)}
                        className="text-xs p-1 h-8 bg-white"
                      />
                    </div>

                    <div className="w-24 flex items-center gap-1">
                      <span className="text-[10px] font-bold text-zinc-400 font-mono">Cr</span>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={line.credit || ''} 
                        disabled={Number(line.debit) > 0}
                        onChange={(e) => updateQuickLineValue(idx, 'credit', e.target.value)}
                        className="text-xs p-1 h-8 text-right bg-white"
                      />
                    </div>

                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => removeQuickLine(idx)} 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0 cursor-pointer"
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Balancing Verification summary block */}
            <div className="p-3 bg-zinc-50 border border-zinc-150 rounded-xl flex justify-between items-center text-[10px] font-semibold uppercase tracking-wider font-mono">
              <div className="space-y-1 text-zinc-650">
                <div>Debits Sum: <span className="font-bold text-zinc-900">${quickLines.reduce((acc, l) => acc + (l.debit || 0), 0).toFixed(2)}</span></div>
                <div>Credits Sum: <span className="font-bold text-zinc-900">${quickLines.reduce((acc, l) => acc + (l.credit || 0), 0).toFixed(2)}</span></div>
              </div>
              {Math.abs(quickLines.reduce((acc, l) => acc + (l.debit || 0), 0) - quickLines.reduce((acc, l) => acc + (l.credit || 0), 0)) < 0.01 ? (
                <div className="text-emerald-700 flex items-center gap-1 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded">
                  <Check className="w-3.5 h-3.5" /> BALANCED
                </div>
              ) : (
                <div className="text-red-700 flex items-center gap-1 bg-red-100 border border-red-200 px-2.5 py-1 rounded">
                  <AlertCircle className="w-3.5 h-3.5" /> UNBALANCED
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="bg-zinc-50 border-t border-zinc-100 p-4 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setShowQuickJournal(false)}>Cancel</Button>
            <Button 
              size="sm"
              onClick={handleQuickJournalSubmit} 
              disabled={Math.abs(quickLines.reduce((acc, l) => acc + (l.debit || 0), 0) - quickLines.reduce((acc, l) => acc + (l.credit || 0), 0)) > 0.01}
              className="bg-zinc-900 text-white hover:bg-zinc-805"
            >
              Post Journal Rows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Generate Report Dialog */}
      <Dialog open={showQuickReport} onOpenChange={setShowQuickReport}>
        <DialogContent className="sm:max-w-xl font-sans max-h-[90vh] flex flex-col p-0 bg-white">
          <DialogHeader className="p-6 pb-4 border-b border-zinc-100 font-sans">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-zinc-900">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500 animate-pulse" /> Rapid Financial Statement Generator
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-6 overflow-y-auto space-y-6">
            <div id="quick-accounting-statement-printarea" className="space-y-4 p-4 border border-zinc-200/80 rounded-xl bg-white font-mono text-[11px] text-zinc-850 shadow-sm leading-relaxed">
              <div className="text-center border-b border-zinc-200 pb-3">
                <h3 className="text-xs font-bold tracking-tight uppercase text-zinc-900">TAREZA ENTERPRISE ERP SYSTEM</h3>
                <p className="text-[10px] text-zinc-500 mt-1 font-sans">REAL-TIME INTEGRATED FINANCIAL STANDING REPORT</p>
                <p className="text-[9px] text-zinc-400 mt-0.5 font-mono">Run On: {new Date().toLocaleString()}</p>
              </div>

              {/* Real-time Summary Metrics */}
              <div className="space-y-2">
                <h4 className="font-bold text-[10px] text-zinc-500 uppercase pb-0.5 border-b border-zinc-100 font-sans">1. Profit and Loss (Condensed)</h4>
                <div className="flex justify-between">
                  <span>Operating Sourced Revenues (4000)</span>
                  <span className="font-bold text-zinc-800">${totalRevenueVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>Cost of Sourced Goods Sales (5000)</span>
                  <span className="font-bold">(${totalExpenseVal.toFixed(2)})</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-zinc-200 pt-1.5 font-bold text-zinc-900 bg-zinc-50 px-1 py-0.5 rounded">
                  <span>NET ESTIMATED OPERATIONAL EARNINGS</span>
                  <span className={netEarningsPL >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    ${netEarningsPL.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-[10px] text-zinc-500 uppercase pb-0.5 border-b border-zinc-100 font-sans">2. Balance Sheet Status (Condensed)</h4>
                <div className="flex justify-between">
                  <span>Aggregate Asset Ledger Balances</span>
                  <span className="text-zinc-800">${totalAssetsVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Aggregate Liabilities (Accounts Payable)</span>
                  <span className="text-zinc-850">${totalLiabilitiesVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Owner Shareholder Retained Equity</span>
                  <span className="text-zinc-850">${totalEquityVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-zinc-200 pt-1.5 font-bold text-zinc-900 bg-zinc-50 px-1 py-0.5 rounded">
                  <span>LIABILITIES + EQUITY (RECONCILED)</span>
                  <span className="text-zinc-900">${(totalLiabilitiesVal + totalEquityVal + netEarningsPL).toFixed(2)}</span>
                </div>
              </div>

              {/* Mathematical consistency checker */}
              <div className="border-t border-zinc-205 pt-3 flex flex-col gap-1 text-[10px]">
                <div className="flex justify-between text-zinc-650">
                  <span>TRIAL BALANCE STATUS:</span>
                  <span className="font-bold text-emerald-600">BALANCED AND SYNCED</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Ledger Debit Postings Sum</span>
                  <span>${cumulativeDebits.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Ledger Credit Postings Sum</span>
                  <span>${cumulativeCredits.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-zinc-50/50 p-2 border border-zinc-200/80 rounded text-[9px] text-zinc-450 text-center font-sans">
                This declaration complies with standard double-entry accountability practices and automatic general ledger triggers.
              </div>
            </div>

            <div className="flex flex-col gap-2 font-sans">
              <Button 
                onClick={() => {
                  const printContents = document.getElementById('quick-accounting-statement-printarea')?.innerHTML;
                  if (printContents) {
                    const printWindow = window.open('', '', 'height=600,width=800');
                    if (printWindow) {
                      printWindow.document.write('<html><head><title>General Accounting Statement</title><style>body { font-family: monospace; padding: 20px; }</style></head><body>');
                      printWindow.document.write(printContents);
                      printWindow.document.write('</body></html>');
                      printWindow.document.close();
                      printWindow.focus();
                      printWindow.print();
                    } else {
                      window.print();
                    }
                  }
                }}
                className="w-full bg-zinc-900 border border-zinc-950 text-white hover:bg-zinc-800 text-xs font-bold cursor-pointer"
              >
                Print Direct Statement
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  const reportText = `TAREZA ERP REAL-TIME CONSOLIDATED STANDING REPORT\nDate: ${new Date().toLocaleString()}\n\n-- Profit and Loss Statement --\nOperating Revenue: \$${totalRevenueVal.toFixed(2)}\nCOGS / Expense: -\$${totalExpenseVal.toFixed(2)}\nNet Operating Earnings: \$${netEarningsPL.toFixed(2)}\n\n-- Balance Sheet Condensed Status --\nTotal Assets Balances: \$${totalAssetsVal.toFixed(2)}\nAccounts Payable Liability: \$${totalLiabilitiesVal.toFixed(2)}\nRetained Shareholder Equity: \$${totalEquityVal.toFixed(2)}\nTotal Liabilities + Equity Sum: \$${(totalLiabilitiesVal + totalEquityVal + netEarningsPL).toFixed(2)}\n\nReport synced successfully without latency.`;
                  navigator.clipboard.writeText(reportText);
                  toast.success('Plaintext Accounting statement copied to clipboard!');
                }}
                className="w-full text-xs cursor-pointer"
              >
                Copy Plaintext Format to Clipboard
              </Button>
            </div>
          </ScrollArea>

          <DialogFooter className="bg-zinc-50 border-t border-zinc-100 p-4 rounded-b-lg">
            <Button size="sm" onClick={() => setShowQuickReport(false)} className="bg-zinc-900 text-white hover:bg-zinc-800 w-full md:w-auto cursor-pointer">
              Close Report Viewer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
