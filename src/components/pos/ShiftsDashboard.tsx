import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Play, 
  Power, 
  Plus, 
  Eye, 
  Building, 
  User, 
  Coins, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle,
  Warehouse,
  UserCheck,
  ShieldCheck,
  Search,
  Calendar,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { toast } from 'sonner';
import { supabase } from '../../lib/firebaseClient';
import { closeRegisterSession } from '../../services/ledgerService';

interface ShiftsDashboardProps {
  activeSession: any;
  setActiveSession: (session: any) => void;
  refreshActiveSession: () => Promise<void>;
  onEnterCheckout: (session: any) => void;
  openingFloat: string;
  setOpeningFloat: (val: string) => void;
  requireFloat: boolean;
  handleStartShift: (branchId?: string, cashierId?: string, userId?: string, shiftDate?: string) => Promise<boolean>;
  setRequireFloat?: (val: boolean) => void;
}

export const ShiftsDashboard: React.FC<ShiftsDashboardProps> = ({
  activeSession,
  setActiveSession,
  refreshActiveSession,
  onEnterCheckout,
  openingFloat,
  setOpeningFloat,
  requireFloat,
  handleStartShift,
  setRequireFloat
}) => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'open' | 'closed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('staff');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Open/Close shift modal triggers
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedShiftToClose, setSelectedShiftToClose] = useState<any | null>(null);
  const [closingActual, setClosingActual] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);

  // View detail modal trigger
  const [viewingDetailsShift, setViewingDetailsShift] = useState<any | null>(null);

  // Initialization/Form state for starting new shift
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedCashierId, setSelectedCashierId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [shiftDate, setShiftDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const getIsOffline = () => {
    return localStorage.getItem('tareza_offline_mode') === 'true' || (typeof window !== 'undefined' && !window.navigator.onLine);
  };

  const getShiftReferenceCode = (shiftId: string) => {
    const indexInFull = shifts.findIndex(s => s.id === shiftId);
    if (indexInFull === -1) return 'TAR26001';
    const seqNumber = shifts.length - indexInFull;
    return `TAR26${String(seqNumber).padStart(3, '0')}`;
  };

  const fetchShiftsAndMetadata = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(userData.user.id);

      // Fetch user tenancy mapping context
      const { data: bData } = await supabase.from('business_users')
        .select('business_id, branch_id, role_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();

      const bid = bData?.business_id || 'offline_business_id';

      if (bData?.role_id) {
        const { data: roleDef } = await supabase
          .from('roles')
          .select('name')
          .eq('id', bData.role_id)
          .limit(1)
          .maybeSingle();
        
        if (roleDef?.name) {
          const rawName = roleDef.name.toLowerCase();
          if (rawName.includes('admin') || rawName.includes('owner') || rawName.includes('developer')) {
            setCurrentUserRole('admin');
          } else if (rawName.includes('manager')) {
            setCurrentUserRole('manager');
          } else if (rawName.includes('cashier')) {
            setCurrentUserRole('cashier');
          } else {
            setCurrentUserRole('staff');
          }
        }
      }

      // Load active branches
      const { data: branchesRes } = await supabase.from('branches')
        .select('*')
        .eq('business_id', bid);
      if (branchesRes) setBranches(branchesRes);

      // Load users/profiles for tenancy mapping
      const { data: businessUsersRes } = await supabase.from('business_users')
        .select('user_id')
        .eq('business_id', bid);
      const validUserIds = businessUsersRes ? businessUsersRes.map(bu => bu.user_id) : [];

      if (validUserIds.length > 0) {
        const { data: profilesRes } = await supabase.from('profiles')
          .select('*')
          .in('id', validUserIds);
        if (profilesRes) setProfiles(profilesRes);
      }

      // Query register_sessions
      let shiftsData: any[] = [];
      if (getIsOffline()) {
        const savedShiftsArrRaw = localStorage.getItem('tareza_offline_shifts_uncollapsed') || '[]';
        shiftsData = JSON.parse(savedShiftsArrRaw);
      } else {
        const { data: onlineShifts, error: shiftsError } = await supabase.from('register_sessions')
          .select('*')
          .eq('business_id', bid)
          .order('opened_at', { ascending: false });
        if (onlineShifts) shiftsData = onlineShifts;
      }

      setShifts(shiftsData);

      // Pre-select opening defaults if there's no active session setup
      if (branchesRes && branchesRes.length > 0) {
        const matched = branchesRes.find(b => b.id === bData?.branch_id) || branchesRes[0];
        setSelectedBranchId(matched.id);
      }
      setSelectedCashierId(userData.user.id);
      setSelectedUserId(userData.user.id);

    } catch (err) {
      console.error('Failed to load shifts metadata dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShiftsAndMetadata();
  }, []);

  const handleStartShiftSubmit = async () => {
    if (!selectedBranchId) {
      toast.error('Please select a branch location first.');
      return;
    }
    setLoading(true);
    const success = await handleStartShift(selectedBranchId, selectedCashierId, selectedUserId, shiftDate);
    if (success) {
      setShowOpenModal(false);
      await fetchShiftsAndMetadata();
      await refreshActiveSession();
    }
    setLoading(false);
  };

  const handleCloseShiftSubmit = async () => {
    if (!selectedShiftToClose) return;
    const actualVal = parseFloat(closingActual);
    if (isNaN(actualVal) || actualVal < 0) {
      toast.error('Please input a valid closing counted balance float.');
      return;
    }

    try {
      setClosingLoading(true);
      
      if (getIsOffline() || selectedShiftToClose.id.startsWith('off-shift-')) {
        // Handle offline completion
        const updatedOfflineSession = {
          ...selectedShiftToClose,
          closed_at: new Date().toISOString(),
          closing_balance: actualVal,
          variance: actualVal - selectedShiftToClose.expected_balance,
          status: 'CLOSED'
        };

        localStorage.removeItem('tareza_active_offline_session');
        const savedShiftsArrRaw = localStorage.getItem('tareza_offline_shifts_uncollapsed') || '[]';
        let shiftsArr = JSON.parse(savedShiftsArrRaw);
        shiftsArr = shiftsArr.map((s: any) => s.id === selectedShiftToClose.id ? updatedOfflineSession : s);
        localStorage.setItem('tareza_offline_shifts_uncollapsed', JSON.stringify(shiftsArr));

        if (activeSession?.id === selectedShiftToClose.id) {
          setActiveSession(null);
        }

        toast.success('Offline shift successfully finalized!');
      } else {
        const res = await closeRegisterSession(selectedShiftToClose.id, actualVal);
        if (res.success) {
          if (activeSession?.id === selectedShiftToClose.id) {
            setActiveSession(null);
          }
          toast.success('Active Shift successfully ended & posted to General Ledger.');
        } else {
          toast.error(res.error || 'Failed to safely end register session.');
          return;
        }
      }

      setClosingActual('');
      setShowCloseModal(false);
      setSelectedShiftToClose(null);
      await fetchShiftsAndMetadata();
      await refreshActiveSession();
    } catch (e: any) {
      toast.error(e.message || 'Error occurred during final shift audit closure.');
    } finally {
      setClosingLoading(false);
    }
  };

  const selectSessionToUse = (session: any) => {
    setActiveSession(session);
    localStorage.setItem('tareza_active_session_cache', JSON.stringify(session));
    onEnterCheckout(session);
    toast.success(`Resumed register shift at branch: ${getBranchName(session.branch_id)}`);
  };

  // Helper resolvers
  const getBranchName = (bid: string) => {
    return branches.find(b => b.id === bid)?.name || 'Central Store Retail';
  };

  const getProfileName = (uid: string) => {
    const prof = profiles.find(p => p.id === uid);
    if (!prof) return 'System Operator';
    if (prof.full_name) return prof.full_name;
    return `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || prof.email || 'System Person';
  };

  // Filter shifts
  const filteredShifts = shifts.filter(s => {
    const isTabMatch = tab === 'all' || (tab === 'open' && s.status === 'OPEN') || (tab === 'closed' && s.status === 'CLOSED');
    const cashierName = getProfileName(s.cashier_id).toLowerCase();
    const branchName = getBranchName(s.branch_id).toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    const isSearchMatch = cashierName.includes(lowerSearch) || branchName.includes(lowerSearch) || s.id.toLowerCase().includes(lowerSearch);
    return isTabMatch && isSearchMatch;
  });

  // Calculate statistics
  const openSessionsCount = shifts.filter(s => s.status === 'OPEN').length;
  const closedSessionsCount = shifts.filter(s => s.status === 'CLOSED').length;
  const totalSalesVolume = shifts.reduce((acc, s) => acc + (Number(s.sales_total) || 0), 0);
  const totalVariance = shifts.reduce((acc, s) => acc + (Number(s.variance) || 0), 0);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full animate-fade-in text-zinc-900 dark:text-zinc-100 select-none pb-24 h-full overflow-y-auto pr-1">
      
      {/* Upper header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <span className="p-1 px-2.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/55 text-blue-700 dark:text-blue-400 text-[10px] font-bold font-mono tracking-wider uppercase">TAREZA ERP REGISTER</span>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white mt-1">Registers & Shifts Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Audit, select, and manage all point-of-sale registers and cashier shifts.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeSession && (
            <Button 
              onClick={() => onEnterCheckout(activeSession)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>Resume Active Session ({getBranchName(activeSession.branch_id)})</span>
            </Button>
          )}
          <Button 
            onClick={() => setShowOpenModal(true)}
            className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 text-white rounded-xl font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Open New Shift</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Sessions */}
        <Card 
          onClick={() => setTab('open')}
          className={`bg-white dark:bg-zinc-900 border shadow-sm rounded-2xl relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] select-none ${
            tab === 'open' 
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md' 
              : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700/60'
          }`}
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />
          <CardContent className="pt-5 flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-all ${tab === 'open' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'}`}>
              <Power className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Open Sessions</span>
              <p className="text-2xl font-black text-zinc-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                {openSessionsCount}
                <span className="text-[10px] font-bold text-emerald-500 px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 uppercase tracking-widest">Active</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Closed Sessions */}
        <Card 
          onClick={() => setTab('closed')}
          className={`bg-white dark:bg-zinc-900 border shadow-sm rounded-2xl relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] select-none ${
            tab === 'closed' 
              ? 'border-zinc-500 ring-2 ring-zinc-500/20 shadow-md' 
              : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
          }`}
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-zinc-400" />
          <CardContent className="pt-5 flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-all ${tab === 'closed' ? 'bg-zinc-500 text-white' : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400'}`}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Closed Sessions</span>
              <p className="text-2xl font-black text-zinc-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                {closedSessionsCount}
                <span className="text-[10px] font-bold text-zinc-500 px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 uppercase tracking-widest">Audited</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Sales Revenue */}
        <Card 
          onClick={() => {
            setTab('all');
            setSearchTerm('');
          }}
          className={`bg-white dark:bg-zinc-900 border shadow-sm rounded-2xl relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] select-none ${
            tab === 'all' && !searchTerm
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md' 
              : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700/60'
          }`}
          title="Click to show all register sessions"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-blue-500" />
          <CardContent className="pt-5 flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-all ${tab === 'all' && !searchTerm ? 'bg-indigo-600 text-white' : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Total Sales Revenue</span>
              <p className="text-2xl font-black text-zinc-900 dark:text-white mt-0.5 font-mono">${totalSalesVolume.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Variance */}
        <Card 
          onClick={() => {
            setTab('closed');
          }}
          className={`bg-white dark:bg-zinc-900 border shadow-sm rounded-2xl relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] select-none ${
            tab === 'closed'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-700/60'
          }`}
          title="Click to audit closed sessions"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-amber-500" />
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-2xl">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Compliance Variance</span>
              <p className={`text-2xl font-black mt-0.5 font-mono ${totalVariance < 0 ? 'text-red-500' : totalVariance > 0 ? 'text-emerald-500' : 'text-zinc-900 dark:text-white'}`}>
                ${totalVariance.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main List & Filters Section */}
      <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg rounded-2xl">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-zinc-150 dark:border-zinc-800">
          <div>
            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Register Shifts Log Table
            </CardTitle>
            <CardDescription className="text-xs text-zinc-450">List of physical tills deployed, historical overages, and ongoing active sales registers.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            {/* Tab Filter */}
            <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-850 gap-1 w-full sm:w-auto shrink-0">
              <button
                onClick={() => setTab('all')}
                className={`flex-1 sm:flex-none py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all ${tab === 'all' ? 'bg-white dark:bg-zinc-800 shadow-xs text-indigo-650 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-750'}`}
              >
                All
              </button>
              <button
                onClick={() => setTab('open')}
                className={`flex-1 sm:flex-none py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all ${tab === 'open' ? 'bg-white dark:bg-zinc-800 shadow-xs text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 hover:text-zinc-750'}`}
              >
                Open
              </button>
              <button
                onClick={() => setTab('closed')}
                className={`flex-1 sm:flex-none py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all ${tab === 'closed' ? 'bg-white dark:bg-zinc-800 shadow-xs text-zinc-750 dark:text-zinc-300' : 'text-zinc-500 hover:text-zinc-750'}`}
              >
                Closed
              </button>
            </div>

            {/* Search filter input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 h-3.5 w-3.5" />
              <Input
                placeholder="Search Cashier/Warehouse..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs rounded-xl h-9 font-medium"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              <span className="text-xs font-bold text-zinc-500">Querying transaction log tables...</span>
            </div>
          ) : filteredShifts.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-center max-w-sm mx-auto">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-full text-zinc-400 mb-2">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">No shift records found</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">No matching cashier register shifts were located in the system. Start a new shift to record Point of Sale sales.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-150 dark:border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4 font-black">Warehouse/Branch</th>
                    <th className="py-3.5 px-4 font-black">Cashier</th>
                    <th className="py-3.5 px-4 font-black">Opened At</th>
                    <th className="py-3.5 px-4 font-black">Status</th>
                    <th className="py-3.5 px-4 font-black font-mono">Opening Float</th>
                    <th className="py-3.5 px-4 font-black font-mono">Expected</th>
                    <th className="py-3.5 px-4 font-black font-mono">Actual</th>
                    <th className="py-3.5 px-4 font-black font-mono">Variance</th>
                    <th className="py-3.5 px-4 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
                  {filteredShifts.map((s) => {
                    const isOpen = s.status === 'OPEN';
                    const isSessionActive = activeSession?.id === s.id;
                    const varianceVal = Number(s.variance || 0);

                    return (
                      <tr key={s.id} className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-900/45 transition-colors ${isSessionActive ? 'bg-indigo-50/10 dark:bg-indigo-950/5' : ''}`}>
                        <td className="py-3 px-4 font-bold">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                            <div>
                              <p className="font-semibold text-zinc-900 dark:text-white">{getBranchName(s.branch_id)}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold font-mono text-[9px] border border-zinc-200 dark:border-zinc-700">
                                  {getShiftReferenceCode(s.id)}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono">({s.id.slice(0, 8)})</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <p className="font-bold text-zinc-800 dark:text-zinc-200">{getProfileName(s.cashier_id)}</p>
                            <p className="text-[10px] text-zinc-400">Supervisor: {getProfileName(s.user_id)}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-550 dark:text-zinc-400 font-medium">
                          <div className="space-y-0.5">
                            <p className="font-bold flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-zinc-400" />
                              {new Date(s.opened_at).toLocaleDateString()}
                            </p>
                            <p className="text-[10px] text-zinc-400">{new Date(s.opened_at).toLocaleTimeString()}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`p-1 px-2.5 text-[10px] font-extrabold rounded-full ${isOpen ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-150' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-zinc-700 dark:text-zinc-300">
                          ${(Number(s.opening_balance) || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-zinc-700 dark:text-zinc-300">
                          ${(Number(isOpen ? s.expected_balance : (s.expected_balance || Number(s.opening_balance) + Number(s.sales_total))) || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {isOpen ? (
                            <span className="text-zinc-400 italic">Active...</span>
                          ) : (
                            <span className="text-zinc-850 dark:text-zinc-100">${(Number(s.closing_balance) || 0).toFixed(2)}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {isOpen ? (
                            <span className="text-zinc-400">-</span>
                          ) : (
                            <span className={varianceVal < 0 ? 'text-red-500' : varianceVal > 0 ? 'text-emerald-500' : 'text-zinc-500'}>
                              {varianceVal > 0 ? '+' : ''}{varianceVal.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewingDetailsShift(s)}
                              className="h-8 rounded-lg text-[11px] font-bold py-1 px-2 cursor-pointer"
                              title="View Shift Ledger Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline ml-1">View Audit</span>
                            </Button>

                             {isOpen ? (
                              <>
                                {(s.cashier_id === currentUserId || currentUserRole === 'admin' || currentUserRole === 'manager') ? (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => selectSessionToUse(s)}
                                      className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-extrabold py-1 px-2 cursor-pointer"
                                    >
                                      <Play className="w-3 h-3 fill-current shrink-0" />
                                      <span className="hidden sm:inline ml-1">Use Shift</span>
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => {
                                        setSelectedShiftToClose(s);
                                        setClosingActual(s.expected_balance?.toString() || '');
                                        setShowCloseModal(true);
                                      }}
                                      className="h-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold py-1 px-2 cursor-pointer"
                                    >
                                      <Power className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline ml-1">Close Till</span>
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    disabled
                                    className="h-8 bg-zinc-150 text-zinc-400 dark:bg-zinc-800 rounded-lg text-[11px] py-1 px-2 select-none cursor-not-allowed"
                                    title="Only the cashier who started this shift or an admin/manager can use or close it."
                                  >
                                    <Play className="w-3 h-3 text-zinc-400 shrink-0 inline mr-1" />
                                    <span>In Use</span>
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Button
                                size="sm"
                                disabled
                                className="h-8 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-lg text-[11px] py-1 px-2 select-none"
                              >
                                Finalized
                              </Button>
                            )}
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

      {/* MODAL 1: Open New Shift Session Form */}
      <Dialog open={showOpenModal} onOpenChange={setShowOpenModal}>
        <DialogContent className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <Play className="h-5 w-5 text-indigo-500 animate-pulse" />
              Initialize POS Terminal Shift
            </DialogTitle>
            <p className="text-xs text-zinc-500 leading-relaxed mt-1">
              Select origin warehouse, link cashier profiles, and verify physical starting cash reserves.
            </p>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 py-2">
            {/* Branch */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Warehouse className="w-3.5 h-3.5 text-zinc-500" /> Source Warehouse
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-100 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="" disabled>Select Target Location</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.type === 'warehouse' ? 'Warehouse' : 'Retail Branch'})
                  </option>
                ))}
              </select>
            </div>

            {/* Cashier */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-zinc-500" /> Linked Cashier
              </label>
              <select
                value={selectedCashierId}
                onChange={(e) => setSelectedCashierId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-100 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Supervisor */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" /> Responsible Supervisor
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-100 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Cash Float */}
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

            {/* Shift Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" /> Shift Date
              </label>
              <Input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowOpenModal(false)}
              className="rounded-xl grow font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartShiftSubmit}
              className="bg-indigo-600 hover:bg-indigo-705 text-white rounded-xl grow font-black flex items-center justify-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Initialize & Start Shift</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Close Shift Verification Count */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-rose-600 flex items-center gap-2">
              <Power className="w-5 h-5 animate-pulse" /> End Cashier Shift Audit {selectedShiftToClose && `(${getShiftReferenceCode(selectedShiftToClose.id)})`}
            </DialogTitle>
            <p className="text-xs text-zinc-500 leading-relaxed font-semibold mt-1">
              Physically count the cash drawer currencies and enter the counted value below to resolve final variances.
            </p>
          </DialogHeader>

          {selectedShiftToClose && (
            <div className="space-y-4 pt-2">
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
                    onChange={(e) => setClosingActual(e.target.value)}
                    className="w-full font-mono text-base py-5 pl-8"
                  />
                </div>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-650 dark:text-zinc-400">
                Current estimate expected: <span className="font-extrabold text-zinc-900 dark:text-white font-mono">${(selectedShiftToClose.expected_balance || 0).toFixed(2)}</span>. Overages or shortages will raise compliance variances automatically.
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCloseModal(false);
                setSelectedShiftToClose(null);
              }} 
              className="rounded-xl grow text-xs font-bold"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCloseShiftSubmit}
              disabled={closingLoading}
              className="bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-xl grow text-xs font-black transition-all flex items-center justify-center gap-1.5"
            >
              {closingLoading ? 'Posting...' : 'Confirm End Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: View Shift Audit Ledger Details */}
      <Dialog open={viewingDetailsShift !== null} onOpenChange={(open) => !open && setViewingDetailsShift(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-indigo-650 dark:text-indigo-400 flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-500" />
              Terminal Shift Audit Detail {viewingDetailsShift && `(${getShiftReferenceCode(viewingDetailsShift.id)})`}
            </DialogTitle>
          </DialogHeader>

          {viewingDetailsShift && (
            <div className="space-y-4 pt-3">
              <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3.5 border border-zinc-150 dark:border-zinc-800 space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-zinc-500 font-bold flex items-center gap-1"><Warehouse className="w-3.5 h-3.5" /> Warehouse:</span>
                  <strong className="text-zinc-800 dark:text-white">{getBranchName(viewingDetailsShift.branch_id)}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 font-bold flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> Cashier ID:</span>
                  <strong className="text-zinc-800 dark:text-white">{getProfileName(viewingDetailsShift.cashier_id)}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 font-bold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Supervisor ID:</span>
                  <strong className="text-zinc-800 dark:text-white">{getProfileName(viewingDetailsShift.user_id)}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 font-bold flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Status:</span>
                  <span className={`p-0.5 px-2 text-[9px] font-black rounded ${viewingDetailsShift.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                    {viewingDetailsShift.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 flex flex-col justify-between">
                  <span className="text-zinc-400 font-semibold block mb-0.5">Shift Opened</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-100">
                    {new Date(viewingDetailsShift.opened_at).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 flex flex-col justify-between">
                  <span className="text-zinc-400 font-semibold block mb-0.5">Shift Closed</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-100">
                    {viewingDetailsShift.closed_at ? new Date(viewingDetailsShift.closed_at).toLocaleString() : 'Active shift'}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 flex flex-col justify-between">
                  <span className="text-zinc-400 font-semibold block mb-0.5">Opening Float</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-sm">
                    ${(viewingDetailsShift.opening_balance || 0).toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 flex flex-col justify-between">
                  <span className="text-zinc-400 font-semibold block mb-0.5 font-mono">Expected Draw Balance</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-sm text-indigo-650 dark:text-indigo-400">
                    ${(viewingDetailsShift.expected_balance || 0).toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 flex flex-col justify-between">
                  <span className="text-zinc-400 font-semibold block mb-0.5">Sales Count</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-100">
                    {viewingDetailsShift.sales_count || 0} Trx
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800/60 flex flex-col justify-between">
                  <span className="text-zinc-400 font-semibold block mb-0.5">Sales Volume</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                    ${(viewingDetailsShift.sales_total || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {viewingDetailsShift.status !== 'OPEN' && (
                <div className="p-3.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-500">Compliance Variance:</span>
                  <strong className={`font-mono text-sm ${Number(viewingDetailsShift.variance || 0) < 0 ? 'text-red-500' : Number(viewingDetailsShift.variance || 0) > 0 ? 'text-emerald-500' : 'text-zinc-800 dark:text-white'}`}>
                    ${(viewingDetailsShift.variance || 0).toFixed(2)}
                  </strong>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl py-2.5 text-xs font-bold cursor-pointer"
              onClick={() => setViewingDetailsShift(null)}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
