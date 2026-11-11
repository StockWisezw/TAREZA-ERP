import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  HelpCircle, 
  Clock, 
  Check, 
  User, 
  Play, 
  Pause, 
  X,
  Warehouse,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  Info,
  ArrowRight,
  Receipt,
  Printer,
  Search,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../ui/dialog';
import { toast } from 'sonner';
import { supabase } from '../../lib/firebaseClient';
import { usePOSStore } from '../../store/posStore';
import { usePermission } from '../../hooks/usePermission';
import { ThermalReceiptModal } from './ThermalReceiptModal';

interface SessionManagerProps {
  activeSession?: any;
  sessionLoading?: boolean;
  openingFloat: string;
  setOpeningFloat: (val: string) => void;
  requireFloat: boolean;
  setRequireFloat?: (val: boolean) => void;
  closingActual?: string;
  setClosingActual?: (val: string) => void;
  showCloseShift?: boolean;
  setShowCloseShift?: (val: boolean) => void;
  showShiftDetails?: boolean;
  setShowShiftDetails?: (val: boolean) => void;
  handleStartShift: (branchId?: string, cashierId?: string, userId?: string, shiftDate?: string) => Promise<boolean>;
  handleEndShift?: () => Promise<boolean>;
  onClose?: () => void;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  activeSession,
  sessionLoading,
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
  onClose
}) => {
  const { role } = usePermission();
  const [branches, setBranches] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedCashierId, setSelectedCashierId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingForm, setLoadingForm] = useState(false);
  const [shiftDate, setShiftDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [realtimeTotals, setRealtimeTotals] = useState({
    cash: 0,
    credit: 0,
    mobile: 0,
    total: 0
  });
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [shiftSales, setShiftSales] = useState<any[]>([]);
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [selectedSaleForThermal, setSelectedSaleForThermal] = useState<any | null>(null);
  const [activeTabInShift, setActiveTabInShift] = useState<'overview' | 'sales'>('overview');

  // Real-time calculation of drawer reconciliation split totals
  useEffect(() => {
    if (!showShiftDetails || !activeSession) return;

    const fetchRealtimeTotals = async () => {
      try {
        setLoadingTotals(true);
        const { data: dbSales, error } = await supabase
          .from('sales')
          .select('*')
          .eq('business_id', activeSession.business_id)
          .gte('created_at', activeSession.opened_at);

        if (error) throw error;

        let salesInShift = [...(dbSales || [])];

        // Merge local/offline sales from POS store
        try {
          const localSales = usePOSStore.getState()?.localSales || [];
          localSales.forEach((localSale: any) => {
            const localTime = new Date(localSale.timestamp || localSale.created_at || new Date()).toISOString();
            if (localTime >= activeSession.opened_at) {
              const exists = salesInShift.some(
                s => s.receiptNumber === localSale.receiptNumber || 
                     s.id === localSale.id || 
                     s.receipt_number === localSale.receiptNumber
              );
              if (!exists) {
                salesInShift.push({
                  ...localSale,
                  created_at: localSale.timestamp || localSale.created_at,
                  status: localSale.status || 'COMPLETED'
                });
              }
            }
          });
        } catch (storeErr) {
          console.warn('Could not read local POS store for realtime totals:', storeErr);
        }

        // Merge Dexie local offline sales table
        try {
          const { db: dexieDb } = await import('../../lib/dexieDb');
          const dexieSales = await dexieDb.sales.toArray();
          dexieSales.forEach((ds: any) => {
            const dsTime = new Date(ds.timestamp || ds.created_at || ds.createdAt || 0).toISOString();
            if (dsTime >= activeSession.opened_at) {
              const exists = salesInShift.some(
                s => (s.receiptNumber && s.receiptNumber === ds.receiptNumber) || 
                     s.id === ds.id || 
                     s.receipt_number === (ds.receiptNumber || ds.receipt_number)
              );
              if (!exists) {
                salesInShift.push({
                  ...ds,
                  created_at: ds.timestamp || ds.created_at || ds.createdAt,
                  status: ds.status || 'COMPLETED'
                });
              }
            }
          });
        } catch (dexErr) {
          console.warn('Could not read Dexie offline sales for shift report:', dexErr);
        }

        // Aggregate payments
        let cashTotal = 0;
        let creditTotal = 0;
        let mobileTotal = 0;

        salesInShift.forEach((sale: any) => {
          const sStatus = String(sale.status || '').toUpperCase();
          const allowedStatuses = ['COMPLETED', 'PAID', 'SYNCED', 'OFFLINE_PENDING'];
          if (sale.status && !allowedStatuses.includes(sStatus)) return;

          if (Array.isArray(sale.payments) && sale.payments.length > 0) {
            sale.payments.forEach((payment: any) => {
              const method = payment.method;
              const amt = Number(payment.amount || 0);
              if (method === 'usd_cash' || method === 'cash') {
                cashTotal += amt;
              } else if (method === 'credit' || method === 'card') {
                creditTotal += amt;
              } else if (method === 'ecocash') {
                mobileTotal += amt;
              } else {
                cashTotal += amt;
              }
            });
          } else if (sale.payment_method) {
            const method = sale.payment_method;
            const amt = Number(sale.total || sale.total_amount || 0);
            if (method === 'usd_cash' || method === 'cash') {
              cashTotal += amt;
            } else if (method === 'credit' || method === 'card') {
              creditTotal += amt;
            } else if (method === 'ecocash') {
              mobileTotal += amt;
            } else {
              cashTotal += amt;
            }
          } else {
            cashTotal += Number(sale.total || sale.total_amount || 0);
          }
        });

        setRealtimeTotals({
          cash: cashTotal,
          credit: creditTotal,
          mobile: mobileTotal,
          total: cashTotal + creditTotal + mobileTotal
        });

        // Store sorted list of all sales made during this shift
        salesInShift.sort((a, b) => {
          const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
          const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
          return timeB - timeA;
        });
        setShiftSales(salesInShift);
      } catch (err) {
        console.warn('Failed to compile realtime totals:', err);
      } finally {
        setLoadingTotals(false);
      }
    };

    fetchRealtimeTotals();
  }, [showShiftDetails, activeSession?.id, activeSession?.opened_at]);

  // Load and cache active database entities for shift management mapping (like Tareza POS)
  useEffect(() => {
    if (activeSession) return;

    const fetchTarezaShiftOptions = async () => {
      try {
        setLoadingForm(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        // Fetch user tenancy mapping context
        const { data: bData } = await supabase.from('business_users')
          .select('business_id, branch_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        const bid = bData?.business_id || 'offline_business_id';

        // 1. Load active branches (Warehouses & Stores)
        const { data: branchesRes } = await supabase.from('branches')
          .select('*')
          .eq('business_id', bid);
        
        // 2. Fetch business users to filter profiles by business tenancy
        const { data: businessUsersRes } = await supabase.from('business_users')
          .select('user_id')
          .eq('business_id', bid);

        const validUserIds = businessUsersRes ? businessUsersRes.map(bu => bu.user_id) : [];

        // 3. Load active profiles (Employees & Cashiers) belonging to this business
        let profilesRes = null;
        if (validUserIds.length > 0) {
          const { data } = await supabase.from('profiles')
            .select('*')
            .in('id', validUserIds);
          profilesRes = data;
        }

        if (branchesRes && branchesRes.length > 0) {
          setBranches(branchesRes);
          const matched = branchesRes.find(b => b.id === bData?.branch_id) || branchesRes[0];
          if (matched) {
            setSelectedBranchId(matched.id);
          }
        } else {
          // Local/offline fallback branch
          setBranches([{ id: 'default_branch', name: 'Main Store Warehouse', type: 'retail' }]);
          setSelectedBranchId('default_branch');
        }

        if (profilesRes && profilesRes.length > 0) {
          setProfiles(profilesRes);
          setSelectedCashierId(userData.user.id);
          setSelectedUserId(userData.user.id);
        } else {
          // Local/offline fallback cashier profiles
          const fallbackUser = { id: userData.user.id, first_name: 'Current', last_name: 'Cashier', email: userData.user.email };
          setProfiles([fallbackUser]);
          setSelectedCashierId(fallbackUser.id);
          setSelectedUserId(fallbackUser.id);
        }
      } catch (err) {
        console.warn('[TarezaShift] Options query failed, loaded offline parameters:', err);
        setBranches([{ id: 'default_branch', name: 'Local Store Warehouse', type: 'retail' }]);
        setSelectedBranchId('default_branch');
      } finally {
        setLoadingForm(false);
      }
    };

    fetchTarezaShiftOptions();
  }, [activeSession]);

  // Load options for viewing active details as well
  useEffect(() => {
    if (!activeSession) return;
    const loadLabels = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        let bid = activeSession.business_id;
        if (!bid) {
          const { data: bData } = await supabase.from('business_users')
            .select('business_id')
            .eq('user_id', userData.user.id)
            .limit(1)
            .maybeSingle();
          bid = bData?.business_id;
        }

        if (bid) {
          const { data: branchesRes } = await supabase.from('branches')
            .select('*')
            .eq('business_id', bid);
            
          const { data: businessUsersRes } = await supabase.from('business_users')
            .select('user_id')
            .eq('business_id', bid);
            
          const validUserIds = businessUsersRes ? businessUsersRes.map(bu => bu.user_id) : [];
          let profilesRes = null;
          if (validUserIds.length > 0) {
            const { data } = await supabase.from('profiles')
              .select('*')
              .in('id', validUserIds);
            profilesRes = data;
          }

          if (branchesRes) setBranches(branchesRes);
          if (profilesRes) setProfiles(profilesRes);
        }
      } catch (err) {
        console.warn('Failed to resolve view session labels:', err);
      }
    };
    loadLabels();
  }, [activeSession]);

  const activeBranchName = branches.find(b => b.id === activeSession?.branch_id)?.name || 'Central Store Warehouse';
  
  const getProfileName = (uid: string) => {
    const prof = profiles.find(p => p.id === uid);
    if (!prof) return 'System Operator';
    if (prof.full_name) return prof.full_name;
    return `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || prof.email || 'System Person';
  };

  const activeCashierName = getProfileName(activeSession?.cashier_id);
  const activeResponsibleName = getProfileName(activeSession?.user_id);

  if (sessionLoading) {
    return (
      <div className="fixed inset-0 bg-zinc-950/20 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl flex flex-col items-center gap-3 shadow-xl">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 animate-pulse">Auditing active register session...</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
        <Card className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl relative overflow-hidden my-auto">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-indigo-600" />
          
          {onClose && (
            <button 
              onClick={onClose} 
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors z-10 cursor-pointer"
              title="Close Shift Initialization"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          <CardHeader className="pt-6 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1 px-2.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/55 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold font-mono tracking-wider uppercase">TAREZA SHIFT WORKFLOW</span>
            </div>
            <CardTitle className="text-2xl font-black text-zinc-900 dark:text-white font-sans tracking-tight">Initialize POS Terminal Shift</CardTitle>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mt-1">
              Set up your Tareza-style point of sale sessions. Assign a certified cashier, select the origin inventory warehouse/branch, and allocate responsibility for physical cash drawer balance accountability.
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            {loadingForm ? (
              <div className="h-44 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-zinc-300 border-t-zinc-700 animate-spin" />
                <span className="text-xs font-semibold text-zinc-500">Retrieving warehouse & company staff...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Branch/Warehouse Source */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Warehouse className="w-3.5 h-3.5 text-zinc-500" /> Source Warehouse
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-100 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="" disabled>Select Target Location</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.type === 'warehouse' ? 'Warehouse' : 'Retail Branch'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Linked Cashier */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-zinc-500" /> Linked Cashier
                  </label>
                  <select
                    value={selectedCashierId}
                    onChange={(e) => setSelectedCashierId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-100 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="" disabled>Select Active Cashier</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Supervisor/Owner Responsible */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" /> Responsible Supervisor
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-100 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="" disabled>Select shift supervisor</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Starting float inside cashier shift */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-zinc-500" /> Opening Cash Float (USD)
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono"
                  />
                </div>

                {/* Business Day / Shift Date Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" /> Business Day / Shift Date
                  </label>
                  <Input
                    type="date"
                    value={shiftDate}
                    onChange={(e) => setShiftDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block leading-normal">
                    Select a custom date if you missed recording sales for a previous business day.
                  </span>
                </div>

              </div>
            )}
            
            <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-805 rounded-xl transition-all">
              <div className="space-y-0.5">
                <label htmlFor="pos-req-float-toggle" className="text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer block">Require Cash Float to Open</label>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 max-w-[320px] block leading-normal">
                  When disabled, cashier shifts start immediately without custom verified opening reserves.
                </span>
              </div>
              <Switch 
                id="pos-req-float-toggle" 
                checked={requireFloat} 
                onCheckedChange={(val) => {
                  setRequireFloat?.(val);
                  localStorage.setItem('tareza_require_float', String(val));
                  if (!val) {
                    setOpeningFloat('0');
                  } else {
                    setOpeningFloat('100');
                  }
                  toast.success(val ? "Float requirement activated." : "Float requirement disabled.");
                }} 
              />
            </div>

            {/* Comprehensive visual map/summary receipt */}
            {!loadingForm && selectedBranchId && (
              <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-950/20 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-400 uppercase tracking-wide">POS Shift Deployment Summary</h4>
                <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-350">
                  <div className="flex justify-between">
                    <span>Stock Source Warehouse:</span>
                    <strong className="text-zinc-900 dark:text-white">
                       {branches.find(b => b.id === selectedBranchId)?.name || 'Selected Location'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Accountable Cashier:</span>
                    <strong className="text-zinc-900 dark:text-white">
                      {getProfileName(selectedCashierId)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Accountable Supervisor:</span>
                    <strong className="text-zinc-900 dark:text-white">
                      {getProfileName(selectedUserId)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Business Day / Date:</span>
                    <strong className="text-indigo-650 dark:text-indigo-400">
                      {shiftDate ? new Date(shiftDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Today'}
                    </strong>
                  </div>
                  <div className="flex justify-between border-t border-indigo-100/40 dark:border-indigo-900/40 pt-1.5 font-semibold text-zinc-950 dark:text-white">
                    <span>Opening Safe Currency Reserves:</span>
                    <span className="font-mono text-indigo-700 dark:text-indigo-400">${(parseFloat(openingFloat) || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <DialogFooter className="p-6 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-2">
            <Button 
              onClick={() => handleStartShift(selectedBranchId, selectedCashierId, selectedUserId, shiftDate)} 
              className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-indigo-600 dark:hover:bg-indigo-705 text-white py-5 font-black text-sm select-none cursor-pointer rounded-xl flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>Initialize & Start Tareza Session</span>
            </Button>
            {onClose && (
              <Button 
                variant="outline" 
                onClick={onClose} 
                className="w-full border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 py-5 font-bold text-xs select-none cursor-pointer rounded-xl flex items-center justify-center gap-2 h-11"
              >
                <X className="w-4 h-4 shrink-0" />
                <span>Cancel & Return to Dashboard</span>
              </Button>
            )}
          </DialogFooter>
        </Card>
      </div>
    );
  }

  // Active Session details dialog triggered from upper right header indicator link
  return (
    <>
      <div className="flex items-center gap-2">
        <Dialog open={showShiftDetails} onOpenChange={setShowShiftDetails}>
          <Button 
            onClick={() => setShowShiftDetails?.(true)}
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 h-8 border-indigo-200 hover:bg-indigo-50 text-indigo-700 bg-white dark:bg-zinc-900 dark:border-indigo-850 text-[10px] font-bold uppercase tracking-wider transition-all select-none cursor-pointer shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
            <span>Shift Active: {activeBranchName}</span>
          </Button>

          <DialogContent className="sm:max-w-2xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl flex flex-col max-h-[90vh]">
            <DialogHeader className="pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex justify-between items-center pr-6">
                <CardTitle className="text-base font-black flex items-center gap-2 text-indigo-650 dark:text-indigo-400">
                  <Clock className="w-5 h-5 text-indigo-500 animate-pulse" />
                  Terminal Shift Audit & Sales History
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                  {shiftSales.length} Total Sales
                </Badge>
              </div>

              {/* Navigation Switcher Tabs */}
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl gap-1 text-xs font-bold mt-2">
                <button
                  type="button"
                  onClick={() => setActiveTabInShift('overview')}
                  className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTabInShift === 'overview'
                      ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Drawer Reconciliation</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabInShift('sales')}
                  className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTabInShift === 'sales'
                      ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Sales Made in This Shift ({shiftSales.length})</span>
                </button>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pt-3 pr-1">
              {activeTabInShift === 'overview' ? (
                <>
                  {/* Tareza Assignment Context Grid */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3 border border-zinc-150 dark:border-zinc-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-zinc-500 font-semibold flex items-center gap-1"><Warehouse className="w-3.5 h-3.5" /> Warehouse:</span>
                      <strong className="text-zinc-800 dark:text-white">{activeBranchName}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1 border-t border-zinc-100 dark:border-zinc-800">
                      <span className="text-zinc-500 font-semibold flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> Designated Cashier:</span>
                      <strong className="text-zinc-800 dark:text-white">{activeCashierName}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1 border-t border-zinc-100 dark:border-zinc-800">
                      <span className="text-zinc-500 font-semibold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Shift Supervisor:</span>
                      <strong className="text-zinc-800 dark:text-white">{activeResponsibleName}</strong>
                    </div>
                  </div>

                  {/* standard Shift Metrics */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 flex flex-col justify-between">
                      <span className="text-zinc-400 font-semibold block mb-0.5">Shift Opened At</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">
                        {new Date(activeSession.opened_at).toLocaleTimeString() || 'Just now'}
                      </span>
                    </div>
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 flex flex-col justify-between">
                      <span className="text-zinc-400 font-semibold block mb-0.5">Opening Cash Float</span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-sm">
                        ${(activeSession.opening_balance || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 flex flex-col justify-between">
                      <span className="text-zinc-400 font-semibold block mb-0.5">Expected Draw Balance</span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-sm text-indigo-600 dark:text-indigo-400">
                        {role === 'cashier' ? '[HIDDEN - BLIND TILL]' : `$${(activeSession.expected_balance || 0).toFixed(2)}`}
                      </span>
                    </div>
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 flex flex-col justify-between">
                      <span className="text-zinc-400 font-semibold block mb-0.5">Sale Counter</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {shiftSales.length} Transactions
                      </span>
                    </div>
                  </div>

                  {/* Real-time Drawer Reconciliation Summary */}
                  {role === 'cashier' ? (
                    <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 rounded-xl p-3.5 space-y-1.5 text-center">
                      <h4 className="text-[10px] uppercase font-black text-indigo-700 dark:text-indigo-450 tracking-wider">Blind Till Enforced</h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                        Real-time transaction revenues are hidden. Please perform a blind physical count of cash and drawer currency upon shift closure.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex justify-between items-center pb-1.5 border-b border-zinc-150 dark:border-zinc-800">
                        <span className="text-[10px] uppercase font-black text-indigo-700 dark:text-indigo-400 tracking-wider">Real-time Drawer Reconciliation</span>
                        {loadingTotals ? (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                        ) : (
                          <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Live summary</span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-2 rounded-lg text-center">
                          <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block mb-0.5">Cash</span>
                          <span className="font-mono text-xs font-black text-emerald-650 dark:text-emerald-400">
                            ${realtimeTotals.cash.toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-2 rounded-lg text-center">
                          <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block mb-0.5">Credit</span>
                          <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                            ${realtimeTotals.credit.toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-2 rounded-lg text-center">
                          <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block mb-0.5">Mobile</span>
                          <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-500">
                            ${realtimeTotals.mobile.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                        <span className="text-xs font-bold text-zinc-650 dark:text-zinc-350">Total Shift Revenue:</span>
                        <span className="font-mono text-sm font-black text-zinc-900 dark:text-white">
                          ${realtimeTotals.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/25 border border-amber-250 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 rounded-xl text-[11px] leading-relaxed flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>The designated cashier is fully accountable for cash discrepancy and stock variances on end of day balance reviews. Final audits are stored securely.</span>
                  </div>
                </>
              ) : (
                /* Shift Sales List Table */
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <Input
                        placeholder="Search sales by receipt # or customer name..."
                        value={salesSearchQuery}
                        onChange={(e) => setSalesSearchQuery(e.target.value)}
                        className="h-8 text-xs pl-8 bg-zinc-50 dark:bg-zinc-800/50"
                      />
                    </div>
                  </div>

                  {shiftSales.length === 0 ? (
                    <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs">
                      <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold">No sales recorded in this shift yet.</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Transactions completed at the POS will appear here instantly.</p>
                    </div>
                  ) : (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-150 dark:divide-zinc-800 max-h-[360px] overflow-y-auto">
                      {shiftSales
                        .filter(s => {
                          if (!salesSearchQuery) return true;
                          const q = salesSearchQuery.toLowerCase();
                          const rcpt = String(s.receiptNumber || s.receipt_number || '').toLowerCase();
                          const cust = String(s.customerName || s.customer_name || '').toLowerCase();
                          return rcpt.includes(q) || cust.includes(q);
                        })
                        .map((saleItem, idx) => {
                          const rcpt = saleItem.receiptNumber || saleItem.receipt_number || `#${idx + 1}`;
                          const saleTotal = Number(saleItem.total || saleItem.total_amount || 0);
                          const totalZiG = (saleTotal * 26.5).toFixed(2);
                          const timeStr = saleItem.timestamp || saleItem.created_at ? new Date(saleItem.timestamp || saleItem.created_at).toLocaleTimeString() : 'Just now';
                          const itemCount = Array.isArray(saleItem.items) ? saleItem.items.length : 1;
                          const method = String(saleItem.payment_method || (saleItem.payments?.[0]?.method) || 'CASH').replace('_', ' ').toUpperCase();
                          const isOffline = saleItem.status === 'offline_pending';

                          return (
                            <div key={saleItem.id || idx} className="p-3 bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors flex items-center justify-between gap-3 text-xs">
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">{rcpt}</span>
                                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-bold ${isOffline ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                    {isOffline ? 'Offline Queue' : 'Synced'}
                                  </Badge>
                                  <span className="text-[10px] text-zinc-400">{timeStr}</span>
                                </div>
                                <div className="text-[11px] text-zinc-500 truncate">
                                  <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                                  <span className="mx-1">•</span>
                                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{method}</span>
                                  {saleItem.customerName && saleItem.customerName !== 'Walk-In Customer' && (
                                    <>
                                      <span className="mx-1">•</span>
                                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">{saleItem.customerName}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                  <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 block">
                                    ${saleTotal.toFixed(2)}
                                  </span>
                                  <span className="text-[9px] text-zinc-400 font-mono block">
                                    ZiG {totalZiG}
                                  </span>
                                </div>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedSaleForThermal(saleItem)}
                                  className="h-7 px-2 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                                  title="Print ESC/POS Thermal Receipt"
                                >
                                  <Printer className="w-3 h-3 mr-1" />
                                  ESC/POS
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="bg-zinc-50 dark:bg-zinc-900 p-4 border-t border-zinc-150 dark:border-zinc-800 -mx-6 -mb-6 mt-4 flex flex-col sm:flex-row gap-2 rounded-b-2xl">
              <Button 
                variant="outline"
                onClick={() => setShowShiftDetails?.(false)}
                className="w-full border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 py-3 text-xs font-bold rounded-xl"
              >
                Keep Shift Open
              </Button>
              <Button 
                onClick={() => {
                  setShowShiftDetails?.(false);
                  if (role === 'cashier') {
                    setClosingActual?.('');
                  } else {
                    setClosingActual?.(activeSession.expected_balance?.toString() || '');
                  }
                  setShowCloseShift?.(true);
                }} 
                className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 text-xs font-black select-none cursor-pointer transition-colors"
              >
                End Active Cashier Shift & Post Ledger
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Close shift verification modal */}
        <Dialog open={showCloseShift} onOpenChange={setShowCloseShift}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-2xl">
            <DialogHeader>
              <CardTitle className="text-lg font-black text-red-600 flex items-center gap-2">
                <Pause className="w-5 h-5 animate-pulse" /> End Cashier Shift Audit
              </CardTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3">
              <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                To close out bookkeeping records, please physically count all hardware cash drawer currencies and log the exact cash counter total below:
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-zinc-700 dark:text-zinc-355">
                  Actual Counted Drawer Float (USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-bold font-mono">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={closingActual}
                    onChange={(e) => setClosingActual?.(e.target.value)}
                    className="w-full font-mono text-base py-5 pl-8"
                  />
                </div>
              </div>
              
              {role === 'cashier' ? (
                <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/30 rounded-xl text-xs text-indigo-800 dark:text-indigo-400">
                  <Info className="w-4 h-4 shrink-0 text-indigo-500 inline mr-1" />
                  <strong>Blind Till Enabled:</strong> Please input the exact counted physical cash in the drawer. The system expects standard business-day reconciliation without displaying variance estimates during counting.
                </div>
              ) : (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-650 dark:text-zinc-400">
                  Current estimate expected: <span className="font-extrabold text-zinc-900 dark:text-white font-mono">${(activeSession.expected_balance || 0).toFixed(2)}</span>. Overages or shortages will raise compliance variances automatically.
                </div>
              )}
            </div>
            <DialogFooter className="bg-zinc-50 dark:bg-zinc-900 p-4 border-t border-zinc-100 dark:border-zinc-850 -mx-6 -mb-6 mt-4 flex gap-2 rounded-b-2xl">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCloseShift?.(false);
                  setShowShiftDetails?.(true);
                }} 
                className="rounded-xl grow text-xs font-bold py-2.5"
              >
                Go Back
              </Button>
              <Button 
                onClick={handleEndShift}
                className="bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-xl grow text-xs font-black py-2.5 transition-all"
              >
                Confirm End Shift
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ThermalReceiptModal
        open={!!selectedSaleForThermal}
        onOpenChange={(open) => !open && setSelectedSaleForThermal(null)}
        sale={selectedSaleForThermal}
        businessName={activeBranchName ? `Tareza - ${activeBranchName}` : undefined}
        branchName={activeBranchName}
      />
    </>
  );
};
