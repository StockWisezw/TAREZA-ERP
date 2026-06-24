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
  ArrowRight
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
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
  handleStartShift: (branchId?: string, cashierId?: string, userId?: string) => Promise<boolean>;
  handleEndShift?: () => Promise<boolean>;
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
  handleEndShift
}) => {
  const [branches, setBranches] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedCashierId, setSelectedCashierId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingForm, setLoadingForm] = useState(false);

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
        
        // 2. Load active profiles (Employees & Cashiers)
        const { data: profilesRes } = await supabase.from('profiles')
          .select('*');

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
        const { data: branchesRes } = await supabase.from('branches').select('*');
        const { data: profilesRes } = await supabase.from('profiles').select('*');
        if (branchesRes) setBranches(branchesRes);
        if (profilesRes) setProfiles(profilesRes);
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
              onClick={() => handleStartShift(selectedBranchId, selectedCashierId, selectedUserId)} 
              className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-indigo-600 dark:hover:bg-indigo-705 text-white py-5 font-black text-sm select-none cursor-pointer rounded-xl flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>Initialize & Start Tareza Session</span>
            </Button>
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

          <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl">
            <DialogHeader>
              <CardTitle className="text-lg font-black flex items-center gap-2 text-indigo-650 dark:text-indigo-400">
                <Clock className="w-5 h-5 text-indigo-500 animate-pulse" />
                Active terminal shift details
              </CardTitle>
            </DialogHeader>

            <div className="space-y-4 pt-3">
              
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
                    ${(activeSession.expected_balance || 0).toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 flex flex-col justify-between">
                  <span className="text-zinc-400 font-semibold block mb-0.5">Sale Counter</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {activeSession.sales_count || 0} Transactions
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/25 border border-amber-250 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 rounded-xl text-[11px] leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>The designated cashier is fully accountable for cash discrepancy and stock variances on end of day balance reviews. Final audits are stored securely.</span>
              </div>
            </div>

            <DialogFooter className="bg-zinc-50 dark:bg-zinc-900 p-4 border-t border-zinc-105 dark:border-zinc-800 -mx-6 -mb-6 mt-4 gap-2 rounded-b-2xl">
              <Button 
                onClick={() => {
                  setShowShiftDetails?.(false);
                  setClosingActual?.(activeSession.expected_balance?.toString() || '');
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
                <label className="text-xs font-black text-zinc-700 dark:text-zinc-350">
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
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-650 dark:text-zinc-400">
                Current estimate expected: <span className="font-extrabold text-zinc-900 dark:text-white font-mono">${(activeSession.expected_balance || 0).toFixed(2)}</span>. Overages or shortages will raise compliance variances automatically.
              </div>
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
    </>
  );
};
