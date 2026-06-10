import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Layers, 
  Search,
  Lock,
  RefreshCcw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '../lib/firebaseClient';
import { 
  initializeChartOfAccounts, 
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

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [coaSearch, setCoaSearch] = useState('');

  // COA Modal
  const [newAcctCode, setNewAcctCode] = useState('');
  const [newAcctName, setNewAcctName] = useState('');
  const [newAcctType, setNewAcctType] = useState<'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'>('Asset');
  const [newAcctBalance, setNewAcctBalance] = useState('0');
  const [showCOAModal, setShowCOAModal] = useState(false);

  const loadCOAData = async () => {
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

      // Initialize defaults if empty
      await initializeChartOfAccounts(businessId);

      // Load accounts
      const acctsRes = await supabase.from('accounts')
        .eq('business_id', businessId)
        .select('*');
      
      const initialAccounts = acctsRes.data || [];
      const sortedAccounts = initialAccounts.sort((a: any, b: any) => a.code.localeCompare(b.code));
      setAccounts(sortedAccounts);
    } catch (e) {
      console.error('Failed to query COA details:', e);
      toast.error('Failed to sync Chart of Accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCOAData();
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
      loadCOAData();
    } catch (err: any) {
      toast.error(err.message || 'Error occurred starting the account.');
    }
  };

  const filteredCOA = accounts.filter(a => 
    a.code.includes(coaSearch) || 
    a.name.toLowerCase().includes(coaSearch.toLowerCase()) ||
    a.type.toLowerCase().includes(coaSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-6 bg-zinc-50/50">
      
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-sans tracking-tight text-zinc-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-slate-800" /> Chart of Accounts
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">Enterprise double-entry ledger classification accounts and adjusted balances.</p>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <Button onClick={loadCOAData} variant="outline" size="sm" className="bg-white">
            <RefreshCcw className="w-4 h-4 mr-2" /> Refresh State
          </Button>

          <Dialog open={showCOAModal} onOpenChange={setShowCOAModal}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800 font-sans">
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
                      className="w-full border border-zinc-200 rounded-lg px-2 py-2 text-sm bg-white text-zinc-900"
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

      <div className="flex-1 bg-white border border-zinc-200 rounded-xl shadow-sm p-6 flex flex-col gap-4 overflow-hidden">
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
            <div>Total Accounts: <span className="font-semibold text-zinc-800">{accounts.length}</span></div>
          </div>
        </div>

        <div className="flex-1 border border-zinc-100 rounded-lg overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center text-zinc-400 text-sm">Synchronously processing accounts model...</div>
          ) : filteredCOA.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-400 text-sm">No general ledger accounts matching query filter.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
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
                    <td className="py-3.5 px-4 font-medium text-zinc-800">{account.name}</td>
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
                        <span className="inline-flex items-center text-[10px] bg-zinc-100 text-zinc-500 border border-zinc-200 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider gap-1 font-sans">
                          <Lock className="w-2.5 h-2.5" /> System Core
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] text-zinc-400 px-1.5 py-0.5 uppercase font-sans">User account</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
