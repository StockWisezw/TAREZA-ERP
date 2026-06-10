import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  BookOpen, 
  Search,
  Lock,
  RefreshCcw,
  PlusCircle,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
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

export default function Accounting() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLinesMap, setJournalLinesMap] = useState<Record<string, JournalLine[]>>({});
  const [loading, setLoading] = useState(true);

  // Search filter
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Manual Journal Entry creation state
  const [refCode, setRefCode] = useState('');
  const [narrative, setNarrative] = useState('');
  const [lines, setLines] = useState<Array<{ accountCode: string; debit: number; credit: number; description?: string }>>([
    { accountCode: '1000', debit: 0, credit: 0, description: '' },
    { accountCode: '4000', debit: 0, credit: 0, description: '' },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);

  const loadAllAccountingData = async () => {
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

      // Seed core Accounts if missing
      await initializeChartOfAccounts(businessId);

      // Fetch Accounts
      const acctsRes = await supabase.from('accounts')
        .eq('business_id', businessId)
        .select('*');
      
      const sortedAccounts = (acctsRes.data || []).sort((a: any, b: any) => a.code.localeCompare(b.code));
      setAccounts(sortedAccounts);

      // Fetch Journal Entries
      const jesRes = await supabase.from('journal_entries')
        .eq('business_id', businessId)
        .select('*');
      
      const sortedJEs = (jesRes.data || []).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
      setJournalEntries(sortedJEs);

      // Fetch and Map Journal Lines
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
    } catch (e) {
      console.error('Failed to load accounting details:', e);
      toast.error('Network sync latency in General Ledger journals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAccountingData();
  }, []);

  const addManualLine = () => {
    setLines([...lines, { accountCode: '', debit: 0, credit: 0, description: '' }]);
  };

  const removeManualLine = (index: number) => {
    if (lines.length <= 2) {
      toast.warning('At least two split lines are mandatory to balance a double-entry.');
      return;
    }
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const updateLineValue = (index: number, key: 'accountCode' | 'debit' | 'credit' | 'description', val: any) => {
    const updated = [...lines];
    if (key === 'debit') {
      updated[index].debit = parseFloat(val) || 0;
      if (updated[index].debit > 0) updated[index].credit = 0;
    } else if (key === 'credit') {
      updated[index].credit = parseFloat(val) || 0;
      if (updated[index].credit > 0) updated[index].debit = 0;
    } else if (key === 'accountCode') {
      updated[index].accountCode = val;
    } else if (key === 'description') {
      updated[index].description = val;
    }
    setLines(updated);
  };

  const handleCreateJournalEntry = async () => {
    try {
      if (!refCode || !narrative) {
        toast.error('Reference code and explanation narrative are compulsory.');
        return;
      }

      const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
      const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        toast.error(`Posting unbalance violation: Debits ($${totalDebit.toFixed(2)}) must exactly match Credits ($${totalCredit.toFixed(2)})`);
        return;
      }

      if (totalDebit <= 0) {
        toast.error('Journal entry transactional cash value must be greater than zero.');
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

      // Check all accounts exist
      for (const line of lines) {
        const found = accounts.find(a => a.code === line.accountCode);
        if (!found) {
          toast.error(`Account Code '${line.accountCode}' does not exist in Chart of Accounts.`);
          return;
        }
      }

      const res = await postJournalEntry(
        businessId,
        branchId,
        userData.user.id,
        refCode.toUpperCase(),
        narrative,
        lines.map(l => ({
          accountCode: l.accountCode,
          debit: l.debit,
          credit: l.credit,
          description: l.description || narrative
        }))
      );

      if (res.success) {
        toast.success(`Journal ${refCode.toUpperCase()} successfully balanced & posted!`);
        setRefCode('');
        setNarrative('');
        setLines([
          { accountCode: '1000', debit: 0, credit: 0, description: '' },
          { accountCode: '4000', debit: 0, credit: 0, description: '' },
        ]);
        setShowAddModal(false);
        await loadAllAccountingData();
      } else {
        toast.error(res.error || 'Failed to post double-entry.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred starting double entry.');
    }
  };

  const filteredJEs = journalEntries.filter(je => 
    je.reference.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
    je.description.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
    je.id.includes(ledgerSearch)
  );

  const totalDebitSum = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCreditSum = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebitSum - totalCreditSum) < 0.01 && totalDebitSum > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-6 bg-zinc-50/50">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-sans tracking-tight text-zinc-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-slate-800" /> Bookkeeping Journal Entries
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">Dual-Entry general ledger journal entries historical logs and manual adjustments panel.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadAllAccountingData} variant="outline" size="sm" className="bg-white">
            <RefreshCcw className="w-4 h-4 mr-2" /> Synch Ledger
          </Button>

          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-zinc-900 text-white hover:bg-zinc-805">
                <Plus className="w-4 h-4 mr-1.5" /> Book Journal Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
              <DialogHeader className="p-6 border-b pb-4">
                <DialogTitle>Create Adjustment Journal Entry</DialogTitle>
                <CardDescription>Manually adjustment or correct standard trial balances with structured double entry split columns.</CardDescription>
              </DialogHeader>
              
              <ScrollArea className="flex-1 p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Journal Reference</label>
                    <Input placeholder="e.g. JE-9023, DEPREC-JUN" value={refCode} onChange={(e) => setRefCode(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Transaction Narrative</label>
                    <Input placeholder="e.g. Asset depreciation or adjustment" value={narrative} onChange={(e) => setNarrative(e.target.value)} />
                  </div>
                </div>

                <div className="border border-zinc-150 rounded-lg overflow-hidden mt-6">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b font-mono">
                      <tr>
                        <th className="py-2.5 px-3">GL Account</th>
                        <th className="py-2.5 px-3">Split Line Description</th>
                        <th className="py-2.5 px-3">Debit (USD)</th>
                        <th className="py-2.5 px-3">Credit (USD)</th>
                        <th className="py-2.5 px-3 text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-mono">
                      {lines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="p-2 w-[240px]">
                            <select 
                              value={line.accountCode} 
                              onChange={(e) => updateLineValue(idx, 'accountCode', e.target.value)}
                              className="w-full text-xs font-semibold rounded border border-zinc-200 p-1.5 bg-white text-zinc-900"
                            >
                              <option value="">Choose GL account...</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.code}>{a.code} - {a.name} ({a.type})</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <Input 
                              placeholder="Line descriptive notes..." 
                              value={line.description} 
                              onChange={(e) => updateLineValue(idx, 'description', e.target.value)} 
                              className="h-8 text-xs bg-white text-zinc-900 border-zinc-200"
                            />
                          </td>
                          <td className="p-2 w-[110px]">
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              value={line.debit || ''} 
                              onChange={(e) => updateLineValue(idx, 'debit', e.target.value)} 
                              className="h-8 text-xs text-right bg-white text-zinc-900 border-zinc-200"
                            />
                          </td>
                          <td className="p-2 w-[110px]">
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              value={line.credit || ''} 
                              onChange={(e) => updateLineValue(idx, 'credit', e.target.value)} 
                              className="h-8 text-xs text-right bg-white text-zinc-900 border-zinc-200"
                            />
                          </td>
                          <td className="p-2 text-center w-[60px]">
                            <Button variant="ghost" size="xs" onClick={() => removeManualLine(idx)} className="text-zinc-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <Button variant="outline" size="sm" onClick={addManualLine} className="text-xs bg-white text-zinc-800">
                    <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Split Row
                  </Button>
                  
                  <div className="flex gap-4 font-mono text-xs font-semibold bg-zinc-50 p-2 border rounded-lg">
                    <span className="text-zinc-500">Total Debits: <strong className="text-zinc-900">${totalDebitSum.toFixed(2)}</strong></span>
                    <span className="text-zinc-500">Total Credits: <strong className="text-zinc-900">${totalCreditSum.toFixed(2)}</strong></span>
                    {isBalanced ? (
                      <span className="text-emerald-600 flex items-center gap-1 font-sans"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Balanced</span>
                    ) : (
                      <span className="text-rose-500 flex items-center gap-1 font-sans"><XCircle className="w-4 h-4 text-rose-500 shrink-0" /> Out of sync</span>
                    )}
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="bg-zinc-50 p-4 border-t border-zinc-100 flex-none">
                <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreateJournalEntry} disabled={!isBalanced || !refCode || !narrative} className="bg-zinc-900 text-white">
                  Post Double-Entry Adjustment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 bg-white border border-zinc-200 rounded-xl shadow-sm p-6 flex flex-col gap-4 overflow-hidden">
        <div className="flex justify-between items-center gap-4 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Search journals by code, notes, ref..." 
              value={ledgerSearch} 
              onChange={(e) => setLedgerSearch(e.target.value)} 
              className="pl-9 text-xs"
            />
          </div>
          <div className="font-mono text-xs text-zinc-500">
            Total entries: <span className="font-semibold text-zinc-800">{journalEntries.length} entries</span>
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-auto space-y-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-zinc-400 font-mono text-xs">Loading General Ledger double-entries...</div>
          ) : filteredJEs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-400 text-sm">No posting entries found matching search.</div>
          ) : (
            <div className="space-y-4 pr-1">
              {filteredJEs.map((entry) => {
                const matchedLines = journalLinesMap[entry.id] || [];
                const computedTotalDebit = matchedLines.reduce((acc, current) => acc + (current.debit || 0), 0);
                
                return (
                  <Card key={entry.id} className="border border-zinc-250/90 overflow-hidden shadow-sm hover:shadow transition-shadow">
                    <CardHeader className="bg-zinc-55 bg-slate-50 border-b py-3 flex flex-row justify-between items-center space-y-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs bg-zinc-200 text-zinc-700 px-2 py-1 rounded font-bold">
                          {entry.reference || 'SYSTEM'}
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-900 font-sans">{entry.description}</h3>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mt-0.5 font-mono">
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
                        <thead>
                          <tr className="bg-zinc-50/50 border-b text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                            <th className="py-2.5 px-4 font-mono">Account Code</th>
                            <th className="py-2.5 px-4">Account Label</th>
                            <th className="py-2.5 px-4">Debit (USD)</th>
                            <th className="py-2.5 px-4 text-right">Credit (USD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 font-mono text-zinc-800">
                          {matchedLines.map((line) => (
                            <tr key={line.id} className="hover:bg-zinc-50/30">
                              <td className="py-2.5 px-4 font-bold text-zinc-700">{line.account_code}</td>
                              <td className="py-2.5 px-4 text-zinc-600 capitalize">{line.account_name}</td>
                              <td className="py-2.5 px-4 text-zinc-900 font-bold">
                                {line.debit > 0 ? `$${line.debit.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-2.5 px-4 text-right text-zinc-900 font-bold">
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
      </div>
    </div>
  );
}
