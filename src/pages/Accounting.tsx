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
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Landmark,
  Building2,
  PieChart,
  Calendar,
  CreditCard,
  Download,
  Filter,
  Check,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  ShieldCheck,
  Receipt
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '../lib/firebaseClient';
import { 
  initializeChartOfAccounts, 
  postJournalEntry, 
  logAuditEvent 
} from '../services/ledgerService';
import { accountingService } from '../services/accountingService';
import { ARInvoice, APBill, BankAccount, BankTransaction, FixedAsset, TaxReturnPeriod, BudgetRecord } from '../types/erp';
import { useSubscription } from '../hooks/useSubscription';
import { PremiumLockBanner } from '../components/common/PremiumBadge';
import { useBusinessStore } from '../store';
import { useAuth } from '../hooks/useAuth';

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
  const { user } = useAuth();
  const { currentBusiness, activeBranch } = useBusinessStore();
  const businessId = currentBusiness?.id || 'default_business';
  const branchId = activeBranch?.id || 'default_branch';

  // Active Tab
  const [activeTab, setActiveTab] = useState<'journals' | 'invoices' | 'bills' | 'banking' | 'assets' | 'tax' | 'budgets'>('journals');

  // Core General Ledger State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLinesMap, setJournalLinesMap] = useState<Record<string, JournalLine[]>>({});
  const [loading, setLoading] = useState(true);
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Extended Accounting Data States
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [bills, setBills] = useState<APBill[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [bankTxns, setBankTxns] = useState<BankTransaction[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [taxReturns, setTaxReturns] = useState<TaxReturnPeriod[]>([]);
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);

  // Manual Journal Entry Modal State
  const [refCode, setRefCode] = useState('');
  const [narrative, setNarrative] = useState('');
  const [lines, setLines] = useState<Array<{ accountCode: string; debit: number; credit: number; description?: string }>>([
    { accountCode: '1000', debit: 0, credit: 0, description: '' },
    { accountCode: '4000', debit: 0, credit: 0, description: '' },
  ]);
  const [showAddJEModal, setShowAddJEModal] = useState(false);

  // Invoices Modal State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<Partial<ARInvoice>>({
    customer_name: '',
    subtotal: 0,
    tax_rate: 15,
    notes: '',
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  });

  // Bills Modal State
  const [showBillModal, setShowBillModal] = useState(false);
  const [billForm, setBillForm] = useState<Partial<APBill>>({
    supplier_name: '',
    bill_number: '',
    subtotal: 0,
    expense_account_code: '6000',
    notes: ''
  });

  // Fixed Asset Modal State
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetForm, setAssetForm] = useState<Partial<FixedAsset>>({
    name: '',
    category: 'Equipment',
    purchase_cost: 0,
    salvage_value: 0,
    useful_life_years: 3
  });

  // Payment Recording Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTargetType, setPayTargetType] = useState<'invoice' | 'bill'>('invoice');
  const [payTargetId, setPayTargetId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('Bank Transfer');

  const { isUnlocked } = useSubscription();
  const locked = !isUnlocked('accounting');

  const loadAllAccountingData = async () => {
    try {
      setLoading(true);

      // 1. Core Chart of Accounts & GL
      await initializeChartOfAccounts(businessId);
      const acctsRes = await supabase.from('accounts').eq('business_id', businessId).select('*');
      const sortedAccounts = (acctsRes.data || []).sort((a: any, b: any) => a.code.localeCompare(b.code));
      setAccounts(sortedAccounts);

      const jesRes = await supabase.from('journal_entries').eq('business_id', businessId).select('*');
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
            account_name: matchAcct?.name || 'Account detail'
          };
          if (!lMap[line.journal_entry_id]) {
            lMap[line.journal_entry_id] = [];
          }
          lMap[line.journal_entry_id].push(enrichedLine);
        });
        setJournalLinesMap(lMap);
      }

      // 2. Additional Accounting Submodules
      const [invData, billsData, banksData, assetsData, taxData, budgetData] = await Promise.all([
        accountingService.getInvoices(businessId),
        accountingService.getBills(businessId),
        accountingService.getBankAccounts(businessId),
        accountingService.getFixedAssets(businessId),
        accountingService.getTaxReturns(businessId),
        accountingService.getBudgets(businessId)
      ]);

      setInvoices(invData);
      setBills(billsData);
      setBankAccounts(banksData);
      if (banksData.length > 0 && !selectedBankId) {
        setSelectedBankId(banksData[0].id);
        const txns = await accountingService.getBankTransactions(banksData[0].id);
        setBankTxns(txns);
      }
      setFixedAssets(assetsData);
      setTaxReturns(taxData);
      setBudgets(budgetData);

    } catch (e) {
      console.error('Failed to load full accounting details:', e);
      toast.error('Network latency loading corporate ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAccountingData();
  }, [businessId]);

  const handleBankSelect = async (bankId: string) => {
    setSelectedBankId(bankId);
    const txns = await accountingService.getBankTransactions(bankId);
    setBankTxns(txns);
  };

  // ----------------------------------------------------
  // MANUAL JOURNAL ENTRY LOGIC
  // ----------------------------------------------------
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
        toast.error(`Posting unbalance violation: Debits ($${totalDebit.toFixed(2)}) must match Credits ($${totalCredit.toFixed(2)})`);
        return;
      }

      if (totalDebit <= 0) {
        toast.error('Journal entry value must be greater than zero.');
        return;
      }

      const res = await postJournalEntry(
        businessId,
        branchId,
        user?.id || 'admin',
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
        setShowAddJEModal(false);
        await loadAllAccountingData();
      } else {
        toast.error(res.error || 'Failed to post double-entry.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error posting double entry.');
    }
  };

  // ----------------------------------------------------
  // INVOICES & BILLS HANDLERS
  // ----------------------------------------------------
  const handleCreateInvoice = async () => {
    if (!invoiceForm.customer_name || !invoiceForm.subtotal) {
      toast.error('Customer name and invoice amount are required.');
      return;
    }

    try {
      await accountingService.createInvoice(businessId, branchId, user?.id || 'admin', invoiceForm, true);
      toast.success('Sales Invoice created & posted to General Ledger!');
      setShowInvoiceModal(false);
      setInvoiceForm({ customer_name: '', subtotal: 0, tax_rate: 15, notes: '' });
      await loadAllAccountingData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate invoice.');
    }
  };

  const handleCreateBill = async () => {
    if (!billForm.supplier_name || !billForm.subtotal) {
      toast.error('Vendor supplier and bill amount are required.');
      return;
    }

    try {
      await accountingService.createBill(businessId, branchId, user?.id || 'admin', billForm, true);
      toast.success('Vendor Bill logged & posted to Accounts Payable!');
      setShowBillModal(false);
      setBillForm({ supplier_name: '', bill_number: '', subtotal: 0, expense_account_code: '6000', notes: '' });
      await loadAllAccountingData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to log bill.');
    }
  };

  const handleRecordPayment = async () => {
    if (payAmount <= 0) {
      toast.error('Payment amount must be positive.');
      return;
    }

    try {
      if (payTargetType === 'invoice') {
        await accountingService.recordInvoicePayment(businessId, branchId, user?.id || 'admin', payTargetId, payAmount, payMethod);
        toast.success(`Customer payment of $${payAmount.toFixed(2)} recorded & settled.`);
      } else {
        await accountingService.recordBillPayment(businessId, branchId, user?.id || 'admin', payTargetId, payAmount, payMethod);
        toast.success(`Vendor disbursement of $${payAmount.toFixed(2)} recorded.`);
      }
      setShowPayModal(false);
      await loadAllAccountingData();
    } catch (e: any) {
      toast.error('Failed to record payment.');
    }
  };

  // ----------------------------------------------------
  // FIXED ASSETS HANDLERS
  // ----------------------------------------------------
  const handleAddAsset = async () => {
    if (!assetForm.name || !assetForm.purchase_cost) {
      toast.error('Asset name and purchase cost are required.');
      return;
    }

    try {
      await accountingService.addFixedAsset(businessId, assetForm);
      toast.success('Asset registered in corporate Fixed Asset Register.');
      setShowAssetModal(false);
      setAssetForm({ name: '', category: 'Equipment', purchase_cost: 0, salvage_value: 0, useful_life_years: 3 });
      await loadAllAccountingData();
    } catch (e: any) {
      toast.error('Failed to register asset.');
    }
  };

  const handleRunDepreciation = async () => {
    try {
      const res = await accountingService.runMonthlyDepreciation(businessId, branchId, user?.id || 'admin');
      toast.success(`Monthly depreciation ($${res.totalDepreciation.toFixed(2)}) calculated and posted to GL (${res.journalRef})!`);
      await loadAllAccountingData();
    } catch (e: any) {
      toast.error('Failed to run depreciation.');
    }
  };

  // Totals & KPI Metrics
  const totalReceivables = invoices.reduce((s, i) => s + i.balance_due, 0);
  const totalPayables = bills.reduce((s, b) => s + b.balance_due, 0);
  const totalBankLiquidity = bankAccounts.reduce((s, b) => s + b.book_balance, 0);
  const totalAssetBookValue = fixedAssets.reduce((s, a) => s + a.current_book_value, 0);

  const totalDebitSum = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCreditSum = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebitSum - totalCreditSum) < 0.01 && totalDebitSum > 0;

  const filteredJEs = journalEntries.filter(je => 
    je.reference.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
    je.description.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
    je.id.includes(ledgerSearch)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-6 bg-zinc-50/50">
      {locked && (
        <PremiumLockBanner featureTitle="Enterprise Accounting & Financial Suite" requiredTier="PRO" />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-sans tracking-tight text-zinc-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-slate-900" /> Enterprise Accounting & Financial Hub
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Full GAAP/IFRS General Ledger, A/R Invoicing, A/P Bills, Bank Reconciliation, Asset Depreciation, VAT returns & Budgets.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={loadAllAccountingData} variant="outline" size="sm" className="bg-white">
            <RefreshCcw className="w-4 h-4 mr-2" /> Sync Ledger
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            className="bg-white text-zinc-800"
            onClick={() => setShowInvoiceModal(true)}
          >
            <Plus className="w-4 h-4 mr-1 text-emerald-600" /> New Sales Invoice
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            className="bg-white text-zinc-800"
            onClick={() => setShowBillModal(true)}
          >
            <Plus className="w-4 h-4 mr-1 text-amber-600" /> Log Vendor Bill
          </Button>

          <Button 
            size="sm" 
            className="bg-zinc-900 text-white hover:bg-zinc-800 font-semibold"
            onClick={() => setShowAddJEModal(true)}
          >
            <BookOpen className="w-4 h-4 mr-1.5" /> Book Journal Entry
          </Button>
        </div>
      </div>

      {/* Financial Health Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Accounts Receivable (A/R)</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-900 mt-1">${totalReceivables.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">{invoices.filter(i => i.balance_due > 0).length} Unsettled Invoices</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Accounts Payable (A/P)</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-900 mt-1">${totalPayables.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              <p className="text-[11px] text-amber-600 mt-0.5 font-medium">{bills.filter(b => b.balance_due > 0).length} Outstanding Vendor Bills</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Bank & Cash Liquidity</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-900 mt-1">${totalBankLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">Across {bankAccounts.length} Corporate Accounts</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Landmark className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Fixed Assets Book Value</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-900 mt-1">${totalAssetBookValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">{fixedAssets.length} Plant & Equipment Assets</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounting Submodule Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('journals')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'journals' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <BookOpen className="w-4 h-4" /> General Ledger & Journals ({journalEntries.length})
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'invoices' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <FileText className="w-4 h-4" /> Invoices & A/R ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab('bills')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'bills' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <Receipt className="w-4 h-4" /> Bills & A/P ({bills.length})
        </button>

        <button
          onClick={() => setActiveTab('banking')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'banking' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <Landmark className="w-4 h-4" /> Bank Reconciliation
        </button>

        <button
          onClick={() => setActiveTab('assets')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'assets' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <Building2 className="w-4 h-4" /> Fixed Assets & Depreciation
        </button>

        <button
          onClick={() => setActiveTab('tax')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'tax' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <Receipt className="w-4 h-4" /> VAT & Tax Filing
        </button>

        <button
          onClick={() => setActiveTab('budgets')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'budgets' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <PieChart className="w-4 h-4" /> Budgets & Variances
        </button>
      </div>

      {/* Main Tab View */}
      <div className="flex-1 bg-white border border-zinc-200 rounded-xl shadow-sm p-5 flex flex-col overflow-hidden">
        
        {/* ---------------------------------------------------- */}
        {/* TAB 1: GENERAL LEDGER JOURNALS */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'journals' && (
          <div className="flex flex-col h-full gap-4">
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
                Total journal vouchers: <span className="font-semibold text-zinc-800">{journalEntries.length} entries</span>
              </div>
            </div>

            <ScrollArea className="flex-1 overflow-auto space-y-4">
              {loading ? (
                <div className="h-full flex items-center justify-center text-zinc-400 font-mono text-xs">Loading General Ledger double-entries...</div>
              ) : filteredJEs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-400 text-sm">No journal entries found matching search.</div>
              ) : (
                <div className="space-y-4 pr-1">
                  {filteredJEs.map((entry) => {
                    const matchedLines = journalLinesMap[entry.id] || [];
                    const computedTotalDebit = matchedLines.reduce((acc, current) => acc + (current.debit || 0), 0);
                    
                    return (
                      <Card key={entry.id} className="border border-zinc-250/90 overflow-hidden shadow-sm hover:shadow transition-shadow">
                        <CardHeader className="bg-slate-50 border-b py-3 flex flex-row justify-between items-center space-y-0">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs bg-zinc-200 text-zinc-800 px-2 py-1 rounded font-bold">
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
                            <span className="text-xs text-zinc-400 block font-mono">Total Transaction Value</span>
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
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 2: INVOICES & ACCOUNTS RECEIVABLE */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'invoices' && (
          <div className="flex flex-col h-full gap-4">
            <div className="flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Accounts Receivable (A/R) & Sales Invoices</h3>
                <p className="text-xs text-zinc-500">Track customer credit terms, balance dues, and cash settlements.</p>
              </div>
              <Button size="sm" className="bg-zinc-900 text-white text-xs" onClick={() => setShowInvoiceModal(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> New Invoice
              </Button>
            </div>

            <ScrollArea className="flex-1 border border-zinc-100 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50/80 sticky top-0 border-b text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-3">Customer / Client</th>
                    <th className="py-3 px-3">Issue Date</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3">Total Amount</th>
                    <th className="py-3 px-3">Amount Paid</th>
                    <th className="py-3 px-3">Balance Due</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-4 font-bold text-zinc-900">{inv.invoice_number}</td>
                      <td className="py-3 px-3 font-sans font-medium text-zinc-800">{inv.customer_name}</td>
                      <td className="py-3 px-3 text-zinc-500">{inv.issue_date}</td>
                      <td className="py-3 px-3 text-zinc-500">{inv.due_date}</td>
                      <td className="py-3 px-3 font-bold text-zinc-900">${inv.total_amount.toFixed(2)}</td>
                      <td className="py-3 px-3 text-emerald-600">${inv.amount_paid.toFixed(2)}</td>
                      <td className="py-3 px-3 font-bold text-rose-600">${inv.balance_due.toFixed(2)}</td>
                      <td className="py-3 px-3 font-sans">
                        <Badge className={
                          inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' :
                          inv.status === 'partially_paid' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' :
                          'bg-amber-100 text-amber-800 hover:bg-amber-100'
                        }>
                          {inv.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        {inv.balance_due > 0 ? (
                          <Button 
                            size="xs" 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => {
                              setPayTargetType('invoice');
                              setPayTargetId(inv.id);
                              setPayAmount(inv.balance_due);
                              setShowPayModal(true);
                            }}
                          >
                            Receive Payment
                          </Button>
                        ) : (
                          <span className="text-emerald-600 font-semibold text-xs flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Fully Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 3: BILLS & ACCOUNTS PAYABLE */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'bills' && (
          <div className="flex flex-col h-full gap-4">
            <div className="flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Accounts Payable (A/P) & Supplier Invoices</h3>
                <p className="text-xs text-zinc-500">Manage vendor liabilities, expense accounts, and bank disbursements.</p>
              </div>
              <Button size="sm" className="bg-zinc-900 text-white text-xs" onClick={() => setShowBillModal(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Log Vendor Bill
              </Button>
            </div>

            <ScrollArea className="flex-1 border border-zinc-100 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50/80 sticky top-0 border-b text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Bill Reference</th>
                    <th className="py-3 px-3">Supplier / Vendor</th>
                    <th className="py-3 px-3">Expense Category</th>
                    <th className="py-3 px-3">Bill Date</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3">Total (USD)</th>
                    <th className="py-3 px-3">Balance Due</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono">
                  {bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-4 font-bold text-zinc-900">{bill.bill_number}</td>
                      <td className="py-3 px-3 font-sans font-medium text-zinc-800">{bill.supplier_name}</td>
                      <td className="py-3 px-3 font-sans text-zinc-600">{bill.expense_account_name || 'Operating Expenses'}</td>
                      <td className="py-3 px-3 text-zinc-500">{bill.bill_date}</td>
                      <td className="py-3 px-3 text-zinc-500">{bill.due_date}</td>
                      <td className="py-3 px-3 font-bold text-zinc-900">${bill.total_amount.toFixed(2)}</td>
                      <td className="py-3 px-3 font-bold text-amber-600">${bill.balance_due.toFixed(2)}</td>
                      <td className="py-3 px-3 font-sans">
                        <Badge className={
                          bill.status === 'paid' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' :
                          'bg-amber-100 text-amber-800 hover:bg-amber-100'
                        }>
                          {bill.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        {bill.balance_due > 0 ? (
                          <Button 
                            size="xs" 
                            className="bg-zinc-900 text-white"
                            onClick={() => {
                              setPayTargetType('bill');
                              setPayTargetId(bill.id);
                              setPayAmount(bill.balance_due);
                              setShowPayModal(true);
                            }}
                          >
                            Pay Vendor
                          </Button>
                        ) : (
                          <span className="text-emerald-600 font-semibold text-xs flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Disbursed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 4: BANK RECONCILIATION */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'banking' && (
          <div className="flex flex-col h-full gap-4">
            {/* Bank Selector Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 shrink-0">
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Corporate Bank / Float Account</label>
                <select 
                  value={selectedBankId} 
                  onChange={(e) => handleBankSelect(e.target.value)}
                  className="w-full text-xs font-semibold rounded border border-zinc-200 p-2 bg-white text-zinc-900"
                >
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} - {b.account_name} ({b.account_number}) • ${b.book_balance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between px-4 py-2 bg-white rounded border border-zinc-200">
                <div>
                  <span className="text-[11px] text-zinc-400 font-mono block">GL Book Balance vs Statement</span>
                  <span className="text-sm font-bold text-zinc-900 font-mono">
                    ${bankAccounts.find(b => b.id === selectedBankId)?.book_balance.toFixed(2) || '0.00'} USD
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-emerald-600 font-mono font-bold block">Reconciliation Status</span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    100% In Agreement
                  </span>
                </div>
              </div>
            </div>

            {/* Reconciliation Statement Transactions Table */}
            <ScrollArea className="flex-1 border border-zinc-100 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50/80 sticky top-0 border-b text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Transaction Date</th>
                    <th className="py-3 px-3">Bank Reference</th>
                    <th className="py-3 px-3">Payee / Description</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Amount (USD)</th>
                    <th className="py-3 px-4 text-right">Cleared Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono">
                  {bankTxns.map((txn) => (
                    <tr key={txn.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-4 text-zinc-600">{txn.date}</td>
                      <td className="py-3 px-3 font-bold text-zinc-900">{txn.reference}</td>
                      <td className="py-3 px-3 font-sans text-zinc-800">
                        <div className="font-semibold">{txn.payee_payer}</div>
                        <div className="text-[10px] text-zinc-400">{txn.description}</div>
                      </td>
                      <td className="py-3 px-3 uppercase text-[10px] font-bold text-zinc-500">{txn.type}</td>
                      <td className={`py-3 px-3 font-bold ${txn.type === 'deposit' || txn.type === 'interest' ? 'text-emerald-600' : 'text-zinc-900'}`}>
                        {txn.type === 'deposit' || txn.type === 'interest' ? '+' : '-'}${txn.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <Button 
                          size="xs" 
                          variant={txn.is_reconciled ? 'outline' : 'default'}
                          className={txn.is_reconciled ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'bg-zinc-900 text-white'}
                          onClick={async () => {
                            await accountingService.toggleReconcileTransaction(selectedBankId, txn.id, !txn.is_reconciled);
                            const updated = await accountingService.getBankTransactions(selectedBankId);
                            setBankTxns(updated);
                            toast.success(`Transaction ${txn.reference} marked as ${!txn.is_reconciled ? 'Cleared' : 'Uncleared'}`);
                          }}
                        >
                          {txn.is_reconciled ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : null}
                          {txn.is_reconciled ? 'Reconciled' : 'Mark Cleared'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 5: FIXED ASSETS & DEPRECIATION */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'assets' && (
          <div className="flex flex-col h-full gap-4">
            <div className="flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Fixed Asset Register & Depreciation Engine</h3>
                <p className="text-xs text-zinc-500">Straight-line depreciation calculator with automated month-end General Ledger posting.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="bg-white text-zinc-800" onClick={handleRunDepreciation}>
                  <Calculator className="w-3.5 h-3.5 mr-1.5 text-purple-600" /> Post Monthly Depreciation
                </Button>
                <Button size="sm" className="bg-zinc-900 text-white text-xs" onClick={() => setShowAssetModal(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Register Asset
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 border border-zinc-100 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50/80 sticky top-0 border-b text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Asset Code</th>
                    <th className="py-3 px-3">Asset Description</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Acquired Date</th>
                    <th className="py-3 px-3">Purchase Cost</th>
                    <th className="py-3 px-3">Accum. Depreciation</th>
                    <th className="py-3 px-3">Current Net Book Value</th>
                    <th className="py-3 px-4 text-right">Depreciation Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono">
                  {fixedAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-4 font-bold text-zinc-900">{asset.asset_code}</td>
                      <td className="py-3 px-3 font-sans font-medium text-zinc-900">{asset.name}</td>
                      <td className="py-3 px-3 font-sans">
                        <Badge variant="outline" className="text-[10px]">{asset.category}</Badge>
                      </td>
                      <td className="py-3 px-3 text-zinc-500">{asset.purchase_date}</td>
                      <td className="py-3 px-3 text-zinc-700">${asset.purchase_cost.toFixed(2)}</td>
                      <td className="py-3 px-3 text-rose-600">-${asset.accumulated_depreciation.toFixed(2)}</td>
                      <td className="py-3 px-3 font-bold text-emerald-700 text-sm">${asset.current_book_value.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-sans capitalize text-zinc-500 text-[11px]">
                        Straight Line ({asset.useful_life_years} yrs)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 6: TAX & VAT RETURNS */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'tax' && (
          <div className="flex flex-col h-full gap-4">
            <div className="flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Tax & VAT / GST Management</h3>
                <p className="text-xs text-zinc-500">Output VAT collected vs Input VAT deductions with net statutory settlement schedules.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {taxReturns.map((tr) => (
                <Card key={tr.id} className="border border-zinc-200 shadow-sm">
                  <CardHeader className="py-3 bg-slate-50 border-b">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm font-bold text-zinc-900">{tr.period_name}</CardTitle>
                      <Badge className={tr.filing_status === 'settled' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                        {tr.filing_status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 font-mono text-xs">
                    <div className="flex justify-between py-1 border-b border-zinc-100">
                      <span className="text-zinc-500 font-sans">Gross Taxable Sales (Output)</span>
                      <span className="font-bold text-zinc-900">${tr.taxable_sales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-100">
                      <span className="text-zinc-500 font-sans">15% VAT Collected on Sales</span>
                      <span className="font-bold text-zinc-900">${tr.output_tax_collected.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-100">
                      <span className="text-zinc-500 font-sans">Input VAT Claim on Purchases & Bills</span>
                      <span className="font-bold text-emerald-600">-${tr.input_tax_paid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 bg-zinc-50 px-2 rounded font-sans font-bold">
                      <span className="text-zinc-800">Net Statutory VAT Payable to ZIMRA</span>
                      <span className="text-rose-600 font-mono text-sm">${tr.net_tax_payable.toFixed(2)} USD</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 7: BUDGETS & VARIANCES */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'budgets' && (
          <div className="flex flex-col h-full gap-4">
            <div className="flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Financial Budgets & Variance Analysis (FY 2026)</h3>
                <p className="text-xs text-zinc-500">Track department budget performance against real-time posted GL actuals.</p>
              </div>
            </div>

            <ScrollArea className="flex-1 border border-zinc-100 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50/80 sticky top-0 border-b text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Account Code</th>
                    <th className="py-3 px-3">Budgeted Ledger Item</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Annual Budget (USD)</th>
                    <th className="py-3 px-3">Actual Posted (USD)</th>
                    <th className="py-3 px-3">Variance Amount</th>
                    <th className="py-3 px-4 text-right">Variance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono">
                  {budgets.map((b) => (
                    <tr key={b.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-4 font-bold text-zinc-900">{b.account_code}</td>
                      <td className="py-3 px-3 font-sans font-medium text-zinc-900">{b.account_name}</td>
                      <td className="py-3 px-3 font-sans">
                        <Badge variant="outline" className="text-[10px]">{b.category.replace('_', ' ')}</Badge>
                      </td>
                      <td className="py-3 px-3 text-zinc-700">${b.budget_amount.toFixed(2)}</td>
                      <td className="py-3 px-3 font-bold text-zinc-900">${b.actual_amount.toFixed(2)}</td>
                      <td className={`py-3 px-3 font-bold ${b.variance_amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {b.variance_amount >= 0 ? '+' : ''}${b.variance_amount.toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${b.variance_percent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {b.variance_percent >= 0 ? '+' : ''}{b.variance_percent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL: BOOK JOURNAL ENTRY */}
      {/* ---------------------------------------------------- */}
      <Dialog open={showAddJEModal} onOpenChange={setShowAddJEModal}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b pb-4">
            <DialogTitle>Create Adjustment Journal Entry</DialogTitle>
            <DialogDescription>Manually adjust or correct standard trial balances with structured double entry split columns.</DialogDescription>
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
            <Button variant="outline" size="sm" onClick={() => setShowAddJEModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateJournalEntry} disabled={!isBalanced || !refCode || !narrative} className="bg-zinc-900 text-white">
              Post Double-Entry Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* MODAL: CREATE SALES INVOICE */}
      {/* ---------------------------------------------------- */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Customer Sales Invoice</DialogTitle>
            <DialogDescription>Create A/R invoice with 15% VAT calculation and GL posting.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Customer / Business Name *</label>
              <Input 
                placeholder="e.g. Meikles Hospitality Ltd"
                value={invoiceForm.customer_name}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_name: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Subtotal Amount (USD) *</label>
              <Input 
                type="number"
                step="0.01"
                placeholder="0.00"
                value={invoiceForm.subtotal || ''}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, subtotal: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Tax / VAT Rate (%)</label>
                <Input 
                  type="number"
                  value={invoiceForm.tax_rate || 15}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, tax_rate: parseFloat(e.target.value) || 15 })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Payment Due Date</label>
                <Input 
                  type="date"
                  value={invoiceForm.due_date}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Notes & Payment Instructions</label>
              <Input 
                placeholder="e.g. Net 30 payment terms via RTGS/Bank transfer"
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
            <Button size="sm" className="bg-zinc-900 text-white" onClick={handleCreateInvoice}>Generate & Post Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* MODAL: LOG VENDOR BILL */}
      {/* ---------------------------------------------------- */}
      <Dialog open={showBillModal} onOpenChange={setShowBillModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Accounts Payable Vendor Bill</DialogTitle>
            <DialogDescription>Record supplier invoice and route to appropriate expense account.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Supplier Name *</label>
              <Input 
                placeholder="e.g. National Foods Holdings"
                value={billForm.supplier_name}
                onChange={(e) => setBillForm({ ...billForm, supplier_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Vendor Bill Ref #</label>
                <Input 
                  placeholder="e.g. NF-99812"
                  value={billForm.bill_number}
                  onChange={(e) => setBillForm({ ...billForm, bill_number: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Amount (USD) *</label>
                <Input 
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={billForm.subtotal || ''}
                  onChange={(e) => setBillForm({ ...billForm, subtotal: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Expense GL Allocation</label>
              <select
                value={billForm.expense_account_code}
                onChange={(e) => setBillForm({ ...billForm, expense_account_code: e.target.value })}
                className="w-full text-xs border border-zinc-200 rounded p-2 bg-white"
              >
                <option value="5000">5000 - Cost of Goods Sold (COGS)</option>
                <option value="6000">6000 - General Operating Expenses</option>
                <option value="6200">6200 - Rent & Municipal Utilities</option>
                <option value="1500">1500 - Capital Fixed Asset Acquisition</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowBillModal(false)}>Cancel</Button>
            <Button size="sm" className="bg-zinc-900 text-white" onClick={handleCreateBill}>Save & Post Bill</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* MODAL: REGISTER FIXED ASSET */}
      {/* ---------------------------------------------------- */}
      <Dialog open={showAssetModal} onOpenChange={setShowAssetModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Corporate Fixed Asset</DialogTitle>
            <DialogDescription>Add equipment, vehicles, or hardware to the depreciation schedule.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Asset Name *</label>
              <Input 
                placeholder="e.g. Logistics Delivery Van"
                value={assetForm.name}
                onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Asset Category</label>
              <select
                value={assetForm.category}
                onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value as any })}
                className="w-full text-xs border border-zinc-200 rounded p-2 bg-white"
              >
                <option value="Equipment">Commercial Equipment</option>
                <option value="Vehicles">Motor Vehicles</option>
                <option value="Computer Hardware">Computer Hardware & POS</option>
                <option value="Furniture & Fixtures">Furniture & Fixtures</option>
                <option value="Buildings">Buildings & Leasehold</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Purchase Cost (USD) *</label>
                <Input 
                  type="number"
                  value={assetForm.purchase_cost || ''}
                  onChange={(e) => setAssetForm({ ...assetForm, purchase_cost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Useful Life (Years)</label>
                <Input 
                  type="number"
                  value={assetForm.useful_life_years || 3}
                  onChange={(e) => setAssetForm({ ...assetForm, useful_life_years: parseInt(e.target.value) || 3 })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAssetModal(false)}>Cancel</Button>
            <Button size="sm" className="bg-zinc-900 text-white" onClick={handleAddAsset}>Register Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* MODAL: RECORD PAYMENT */}
      {/* ---------------------------------------------------- */}
      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{payTargetType === 'invoice' ? 'Receive Customer Payment' : 'Disburse Vendor Payment'}</DialogTitle>
            <DialogDescription>Record settlement and update General Ledger double-entry cash flow.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Payment Amount (USD) *</label>
              <Input 
                type="number"
                step="0.01"
                value={payAmount || ''}
                onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Payment Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full text-xs border border-zinc-200 rounded p-2 bg-white"
              >
                <option value="Bank Transfer">Bank Transfer (RTGS / Wire)</option>
                <option value="Cash Till Float">Cash Till Float</option>
                <option value="EcoCash USD">EcoCash USD Mobile Money</option>
                <option value="Cheque">Corporate Cheque</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowPayModal(false)}>Cancel</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" onClick={handleRecordPayment}>
              Confirm Settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
