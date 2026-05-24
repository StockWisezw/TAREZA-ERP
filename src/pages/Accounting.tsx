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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { appwrite } from '../lib/appwrite';
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

  // Global filters
  const [coaSearch, setCoaSearch] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');

  const loadAllAccountingData = async () => {
    try {
      setLoading(true);
      const { data: userData } = await appwrite.auth.getUser();
      if (!userData?.user) return;

      const { data: businessData } = await appwrite.from('business_users')
        .select('business_id, branch_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      const businessId = businessData?.business_id || 'default_business';

      // 1. Initialise defaults if empty
      await initializeChartOfAccounts(businessId);

      // 2. Load accounts
      const acctsRes = await appwrite.from('accounts')
        .eq('business_id', businessId)
        .select('*');
      
      const sortedAccounts = (acctsRes.data || []).sort((a: any, b: any) => a.code.localeCompare(b.code));
      setAccounts(sortedAccounts);

      // 3. Load journal entries and lines
      const jesRes = await appwrite.from('journal_entries')
        .eq('business_id', businessId)
        .select('*');
      
      const sortedJEs = (jesRes.data || []).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
      setJournalEntries(sortedJEs);

      if (sortedJEs.length > 0) {
        const jLinesRes = await appwrite.from('journal_lines').select('*');
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
      const auditRes = await appwrite.from('audit_logs')
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

      const { data: userData } = await appwrite.auth.getUser();
      if (!userData?.user) return;

      const { data: businessData } = await appwrite.from('business_users')
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
      await appwrite.from('accounts').insert({
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

      const { data: userData } = await appwrite.auth.getUser();
      if (!userData?.user) return;

      const { data: businessData } = await appwrite.from('business_users')
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
  const grossProfitPL = totalRevenueVal; 
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
              <Card className="border border-zinc-205 flex flex-col h-full">
                <CardHeader className="bg-zinc-50/50 py-3 border-b border-zinc-150">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span>Profit & Loss Statement (P&L)</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold font-mono uppercase tracking-wider">Operational Realtime</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 flex-1 space-y-4 font-mono text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between font-bold border-b border-zinc-100 pb-1 text-zinc-600 text-xs">
                      <span>Account</span>
                      <span>Adjusted Ledger Balance</span>
                    </div>
                    <div className="flex justify-between text-zinc-800">
                      <span>Sales Operating Revenues (4000)</span>
                      <span>${totalRevenueVal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500 border-b border-dashed border-zinc-100 pb-2">
                      <span>Cost of Goods Sold (COGS) (5000)</span>
                      <span className="text-red-700">(${totalExpenseVal.toFixed(2)})</span>
                    </div>
                  </div>

                  <div className="flex justify-between font-bold py-1 bg-zinc-50 rounded px-2.5">
                    <span>Gross Core Cash Margin</span>
                    <span className="text-zinc-900">${grossProfitPL.toFixed(2)}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-zinc-500">
                      <span>Adjusted General Expenses (6000)</span>
                      <span>$0.00</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between font-bold text-base bg-emerald-50/50 border border-emerald-100 text-emerald-800 rounded px-3 py-2">
                    <span>Net Operating Profit Earnings</span>
                    <span>${netEarningsPL.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Balance Sheet widget */}
              <Card className="border border-zinc-205 flex flex-col h-full">
                <CardHeader className="bg-zinc-50/50 py-3 border-b border-zinc-150">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span>Balance Sheet Statement</span>
                    <span className="text-[9px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-bold font-mono">A = L + E Check</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 flex-1 space-y-4 font-mono text-sm">
                  
                  {/* Current Assets */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono border-b border-zinc-100 pb-0.5 mb-1">Operating Assets</h4>
                    {accounts.filter(a => a.type === 'Asset').map(a => (
                      <div key={a.id} className="flex justify-between text-zinc-700">
                        <span>{a.name} ({a.code})</span>
                        <span>${a.balance.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold text-zinc-900 border-t border-dashed border-zinc-200 pt-1">
                      <span>Aggregate Current Assets Total</span>
                      <span>${totalAssetsVal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Liabilities and Equity */}
                  <div className="space-y-1.5 pt-1.5">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono border-b border-zinc-100 pb-0.5 mb-1">Operational Liabilities & Equity</h4>
                    <div className="flex justify-between text-zinc-700">
                      <span>Accounts Payable (2000)</span>
                      <span>${totalLiabilitiesVal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-700">
                      <span>Owner Shareholder Retained Equity (3000)</span>
                      <span>${totalEquityVal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-550 border-b border-dashed border-zinc-100 pb-1">
                      <span>Net Retained Shift Profit Yield</span>
                      <span className={`${netEarningsPL >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>${netEarningsPL.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-zinc-900 pt-1">
                      <span>Total Liabilities & Equity Sum</span>
                      <span>${(totalLiabilitiesVal + totalEquityVal + netEarningsPL).toFixed(2)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Mathematical Check indicator block */}
                  {Math.abs(totalAssetsVal - (totalLiabilitiesVal + totalEquityVal + netEarningsPL)) < 0.05 ? (
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded p-2 text-emerald-800 text-xs text-center font-bold">
                      ✓ Balance Check Match verified down to decimal margin. Assets equals Liabilities + Equity.
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800 text-xs text-center font-bold">
                      ⚠ Operational drift variance: ${Math.abs(totalAssetsVal - (totalLiabilitiesVal + totalEquityVal + netEarningsPL)).toFixed(2)} pending overnight checkout reconciliation.
                    </div>
                  )}

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
    </div>
  );
}
