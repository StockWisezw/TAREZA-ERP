import React, { useState, useEffect } from 'react';
import { 
  Users, ShieldAlert, ShieldCheck, ShieldOff, RefreshCw, Search, Plus, 
  Key, Trash2, Calendar, CheckCircle2, Clock, Lock,
  AlertTriangle, Filter, Sparkles, Building2, Mail, Phone,
  ChevronDown, ExternalLink, PauseCircle, PlayCircle, Edit3,
  CheckSquare, Square, Download, FileSpreadsheet, UserX, UserCheck, X, Layers
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  disabled: boolean;
  emailVerified: boolean;
  creationTime?: string;
  lastSignInTime?: string;
  businessName?: string;
  phone?: string;
  plan: 'starter' | 'pro' | 'enterprise' | 'free_trial' | 'free' | string;
  status: 'active' | 'suspended' | 'disabled' | 'expired' | string;
  expiresAt?: string | null;
  updatedAt?: string | null;
}

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Multi-select bulk action state
  const [selectedUids, setSelectedUids] = useState<string[]>([]);

  // Modals state
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState<boolean>(false);
  const [isBulkPlanModalOpen, setIsBulkPlanModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);

  // Edit Plan Form State
  const [editPlan, setEditPlan] = useState<string>('starter');
  const [editStatus, setEditStatus] = useState<string>('active');
  const [extensionMonths, setExtensionMonths] = useState<number>(1);
  const [customExpiry, setCustomExpiry] = useState<string>('');
  const [updating, setUpdating] = useState<boolean>(false);

  // Bulk Plan Form State
  const [bulkPlan, setBulkPlan] = useState<string>('pro');
  const [bulkDurationMonths, setBulkDurationMonths] = useState<number>(3);
  const [executingBulk, setExecutingBulk] = useState<boolean>(false);

  // Create User Form State
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newWorkspace, setNewWorkspace] = useState<string>('');
  const [newPlan, setNewPlan] = useState<string>('starter');
  const [creating, setCreating] = useState<boolean>(false);

  const isAuthorizedAdmin = !!currentUser?.email && [
    'admin@tarezaerp.co.zw',
    'sales@tarezaerp.co.zw',
    'tapsforex@gmail.com',
    'tapiwagahadza54@gmail.com',
    'petronellamutero@gmail.com'
  ].includes(currentUser.email.toLowerCase());

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to fetch user list from Firebase Admin');
      }
      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
      } else {
        toast.error(data.error || 'Failed to load Firebase users');
      }
    } catch (err: any) {
      console.error('Error loading users:', err);
      toast.error('Network error loading users from Firebase Admin SDK');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.businessName && u.businessName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      u.uid.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && u.status === 'active' && !u.disabled) ||
      (statusFilter === 'suspended' && u.status === 'suspended') ||
      (statusFilter === 'disabled' && (u.disabled || u.status === 'disabled')) ||
      (statusFilter === 'expired' && u.status === 'expired');

    const matchesPlan = planFilter === 'all' || u.plan.toLowerCase() === planFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Multi-select Helper Functions
  const isSelected = (uid: string) => selectedUids.includes(uid);

  const toggleSelectUser = (uid: string) => {
    setSelectedUids(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const toggleSelectAll = () => {
    const filteredUids = filteredUsers.map(u => u.uid);
    const allSelected = filteredUids.every(uid => selectedUids.includes(uid));

    if (allSelected) {
      // Unselect all currently filtered
      setSelectedUids(prev => prev.filter(id => !filteredUids.includes(id)));
    } else {
      // Add all currently filtered
      const newUids = new Set([...selectedUids, ...filteredUids]);
      setSelectedUids(Array.from(newUids));
    }
  };

  // Bulk Action Dispatcher via Firebase Admin SDK
  const handleBulkAction = async (action: 'disable' | 'enable' | 'suspend' | 'reactivate' | 'delete' | 'change_plan', extraParams?: any) => {
    if (selectedUids.length === 0) {
      toast.error('No users selected for bulk action.');
      return;
    }

    try {
      setExecutingBulk(true);
      toast.loading(`Executing bulk ${action} on ${selectedUids.length} account(s) via Firebase Admin...`, { id: 'bulk-action' });

      const res = await fetch('/api/admin/users/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uids: selectedUids,
          action,
          ...extraParams
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Bulk ${action} completed successfully!`, { id: 'bulk-action' });
        setSelectedUids([]);
        if (isBulkPlanModalOpen) setIsBulkPlanModalOpen(false);
        if (isBulkDeleteModalOpen) setIsBulkDeleteModalOpen(false);
        fetchUsers();
      } else {
        toast.error(data.error || `Failed to execute bulk ${action}`, { id: 'bulk-action' });
      }
    } catch (err: any) {
      toast.error(`Network error executing bulk ${action}`, { id: 'bulk-action' });
    } fontFinally: {
      setExecutingBulk(false);
    }
  };

  // Export User Metadata to CSV or JSON
  const handleExportMetadata = (format: 'csv' | 'json', targetUsers?: AdminUser[]) => {
    const exportData = targetUsers && targetUsers.length > 0
      ? targetUsers 
      : selectedUids.length > 0 
        ? users.filter(u => selectedUids.includes(u.uid))
        : filteredUsers;

    if (exportData.length === 0) {
      toast.error('No user metadata available to export.');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportData, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `firebase_user_metadata_${timestamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success(`Exported ${exportData.length} user record(s) as JSON!`);
    } else {
      // CSV Format
      const headers = [
        'UID',
        'Email',
        'Display Name',
        'Business Workspace',
        'Phone',
        'Subscription Plan',
        'Status',
        'Auth Disabled',
        'Email Verified',
        'Creation Time',
        'Last Sign In',
        'Expires At'
      ];

      const rows = exportData.map(u => [
        `"${u.uid}"`,
        `"${u.email || ''}"`,
        `"${(u.displayName || '').replace(/"/g, '""')}"`,
        `"${(u.businessName || '').replace(/"/g, '""')}"`,
        `"${u.phone || ''}"`,
        `"${u.plan}"`,
        `"${u.status}"`,
        `"${u.disabled ? 'Yes' : 'No'}"`,
        `"${u.emailVerified ? 'Yes' : 'No'}"`,
        `"${u.creationTime || ''}"`,
        `"${u.lastSignInTime || ''}"`,
        `"${u.expiresAt || ''}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `firebase_user_metadata_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Exported ${exportData.length} user metadata record(s) to CSV!`);
    }
  };

  // Action 1: Toggle Enable / Disable Single Account
  const handleToggleDisable = async (user: AdminUser) => {
    const newDisabledState = !user.disabled;
    const actionLabel = newDisabledState ? 'Disable' : 'Enable';

    try {
      toast.loading(`${actionLabel}ing account in Firebase Auth...`, { id: 'admin-action' });
      const res = await fetch('/api/admin/users/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          disabled: newDisabledState,
          status: newDisabledState ? 'disabled' : 'active'
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Account ${newDisabledState ? 'Disabled' : 'Enabled'} successfully in Firebase!`, { id: 'admin-action' });
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to update user status', { id: 'admin-action' });
      }
    } catch (err: any) {
      toast.error('Failed to communicate with Firebase server endpoint', { id: 'admin-action' });
    }
  };

  // Action 2: Suspend / Reactivate Subscription
  const handleToggleSuspend = async (user: AdminUser) => {
    const isCurrentlySuspended = user.status === 'suspended';
    const targetStatus = isCurrentlySuspended ? 'active' : 'suspended';

    try {
      toast.loading(`${isCurrentlySuspended ? 'Reactivating' : 'Suspending'} user subscription...`, { id: 'admin-action' });
      const res = await fetch('/api/admin/users/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          status: targetStatus,
          disabled: targetStatus === 'suspended' ? true : false
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Subscription ${targetStatus === 'suspended' ? 'Suspended' : 'Reactivated'} successfully!`, { id: 'admin-action' });
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to update subscription state', { id: 'admin-action' });
      }
    } catch (err: any) {
      toast.error('Error toggling suspension state', { id: 'admin-action' });
    }
  };

  // Action 3: Save Plan & Expiry Extension
  const handleSavePlanUpdate = async () => {
    if (!selectedUser) return;

    try {
      setUpdating(true);
      toast.loading('Updating subscription plan in Firestore...', { id: 'admin-plan' });

      let expiresAt: string | null = customExpiry ? new Date(customExpiry).toISOString() : null;
      if (!expiresAt && extensionMonths > 0) {
        const date = new Date();
        date.setMonth(date.getMonth() + extensionMonths);
        expiresAt = date.toISOString();
      }

      const res = await fetch('/api/admin/users/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: selectedUser.uid,
          plan: editPlan,
          status: editStatus,
          expiresAt
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Updated ${selectedUser.email} to ${editPlan.toUpperCase()} plan!`, { id: 'admin-plan' });
        setIsPlanModalOpen(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to update subscription', { id: 'admin-plan' });
      }
    } catch (err: any) {
      toast.error('Network error saving plan updates', { id: 'admin-plan' });
    } finally {
      setUpdating(false);
    }
  };

  // Action 4: Trigger Password Reset Email
  const handleSendPasswordReset = async (email: string) => {
    try {
      toast.loading(`Sending password reset link to ${email}...`, { id: 'admin-reset' });
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Password reset email dispatched to ${email}!`, { id: 'admin-reset' });
      } else {
        toast.error(data.error || 'Failed to generate reset link', { id: 'admin-reset' });
      }
    } catch (err: any) {
      toast.error('Network error dispatching password reset', { id: 'admin-reset' });
    }
  };

  // Action 5: Create User in Firebase Auth
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      toast.error('Email and password are required');
      return;
    }

    try {
      setCreating(true);
      toast.loading('Registering user in Firebase Auth...', { id: 'create-user' });

      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          displayName: newName,
          businessName: newWorkspace,
          plan: newPlan
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`User ${newEmail} created successfully in Firebase Auth!`, { id: 'create-user' });
        setIsCreateModalOpen(false);
        setNewEmail('');
        setNewPassword('');
        setNewName('');
        setNewWorkspace('');
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to create user', { id: 'create-user' });
      }
    } catch (err: any) {
      toast.error('Error creating user in Firebase', { id: 'create-user' });
    } finally {
      setCreating(false);
    }
  };

  // Action 6: Delete Single User Account
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      toast.loading(`Deleting ${selectedUser.email} from Firebase Auth...`, { id: 'delete-user' });
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: selectedUser.uid })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`User ${selectedUser.email} permanently deleted!`, { id: 'delete-user' });
        setIsDeleteModalOpen(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to delete user', { id: 'delete-user' });
      }
    } catch (err: any) {
      toast.error('Network error deleting user', { id: 'delete-user' });
    }
  };

  // Calculate Metrics
  const totalUsersCount = users.length;
  const activeCount = users.filter(u => u.status === 'active' && !u.disabled).length;
  const suspendedOrDisabledCount = users.filter(u => u.status === 'suspended' || u.status === 'disabled' || u.disabled).length;
  const premiumCount = users.filter(u => ['pro', 'enterprise'].includes(u.plan.toLowerCase())).length;

  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 p-4 rounded-full mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Restricted Admin Access</h2>
        <p className="text-zinc-500 text-sm max-w-md mb-4">
          The Admin Dashboard is strictly restricted to system administrators with Firebase Admin SDK privileges.
        </p>
      </div>
    );
  }

  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUids.includes(u.uid));

  return (
    <div className="space-y-6 pb-20 font-sans">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-indigo-700/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-400/30 font-mono text-[10px] tracking-wider uppercase">
              Firebase Admin SDK
            </Badge>
            <span className="text-xs text-indigo-300 font-medium">Real-time Auth & Firestore Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Admin User & Subscription Headquarters</h1>
          <p className="text-indigo-200 text-sm mt-1 max-w-2xl">
            Manage user accounts, execute bulk status changes, export user metadata, or modify plans via Firebase Admin SDK.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={() => handleExportMetadata('csv')}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold text-xs h-10 cursor-pointer"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export All Metadata (CSV)
          </Button>

          <Button 
            onClick={fetchUsers} 
            disabled={loading}
            variant="outline" 
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold text-xs h-10 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync Firebase Users
          </Button>

          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs h-10 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add User Account
          </Button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Accounts</p>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{totalUsersCount}</h3>
              <p className="text-[11px] text-zinc-400 mt-1">Firebase Auth Users</p>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Active Subscriptions</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</h3>
              <p className="text-[11px] text-emerald-600/80 mt-1">Full System Access</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Suspended / Disabled</p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{suspendedOrDisabledCount}</h3>
              <p className="text-[11px] text-amber-600/80 mt-1">Paused in Firebase</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <ShieldOff className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pro & Enterprise</p>
              <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{premiumCount}</h3>
              <p className="text-[11px] text-blue-600/80 mt-1">Premium Workspaces</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Sparkles className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
            <Input 
              placeholder="Search by name, email, workspace name or UID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-xs bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
              <option value="disabled">Disabled Only</option>
              <option value="expired">Expired Only</option>
            </select>

            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium ml-2">
              <span>Plan:</span>
            </div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="h-10 px-3 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Plans</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
              <option value="free_trial">Free Trial</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Floating Sticky Bulk Actions Bar */}
      {selectedUids.length > 0 && (
        <div className="sticky top-4 z-40 bg-zinc-900 text-white p-4 rounded-xl shadow-2xl border border-indigo-500/50 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-inner">
              <CheckSquare className="w-4 h-4 text-indigo-200" />
              <span>{selectedUids.length} User(s) Selected</span>
            </div>
            <p className="text-xs text-zinc-300 hidden lg:block">
              Perform batch operations using Firebase Admin SDK:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Bulk Enable */}
            <Button
              size="sm"
              onClick={() => handleBulkAction('enable')}
              disabled={executingBulk}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-3 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1.5" />
              Batch Enable
            </Button>

            {/* Bulk Disable */}
            <Button
              size="sm"
              onClick={() => handleBulkAction('disable')}
              disabled={executingBulk}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-3 cursor-pointer"
            >
              <UserX className="w-3.5 h-3.5 mr-1.5" />
              Batch Disable
            </Button>

            {/* Bulk Suspend */}
            <Button
              size="sm"
              onClick={() => handleBulkAction('suspend')}
              disabled={executingBulk}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-9 px-3 cursor-pointer"
            >
              <PauseCircle className="w-3.5 h-3.5 mr-1.5" />
              Batch Suspend
            </Button>

            {/* Bulk Plan Change */}
            <Button
              size="sm"
              onClick={() => setIsBulkPlanModalOpen(true)}
              disabled={executingBulk}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-3 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              Change Plan
            </Button>

            {/* Export Selected Metadata CSV */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExportMetadata('csv')}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700 font-bold text-xs h-9 px-3 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Export CSV
            </Button>

            {/* Export Selected Metadata JSON */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExportMetadata('json')}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700 font-bold text-xs h-9 px-3 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              Export JSON
            </Button>

            {/* Bulk Delete */}
            <Button
              size="sm"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              disabled={executingBulk}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-9 px-3 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete Batch
            </Button>

            {/* Clear selection */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedUids([])}
              className="text-zinc-400 hover:text-white h-9 w-9 p-0 rounded-lg cursor-pointer"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Users Table */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-zinc-900 dark:text-white">Registered Users & Workspace Subscriptions</CardTitle>
            <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">
              Showing {filteredUsers.length} of {users.length} total Firebase accounts
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleSelectAll}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
            >
              {allFilteredSelected ? (
                <>
                  <CheckSquare className="w-4 h-4 mr-1.5" /> Deselect All
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 mr-1.5" /> Select All ({filteredUsers.length})
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Fetching accounts from Firebase Auth & Firestore...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              <Users className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
              <p className="text-sm font-semibold">No matching user accounts found</p>
              <p className="text-xs text-zinc-400 mt-1">Try adjusting your search criteria or status filters.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <input 
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">User Account</th>
                  <th className="py-3 px-4">Workspace & Phone</th>
                  <th className="py-3 px-4">Firebase Auth State</th>
                  <th className="py-3 px-4">Subscription Plan</th>
                  <th className="py-3 px-4">Validity / Expiry</th>
                  <th className="py-3 px-6 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {filteredUsers.map((u) => {
                  const selected = isSelected(u.uid);
                  const isSuspended = u.status === 'suspended';
                  const isDisabled = u.disabled || u.status === 'disabled';
                  const isExpired = u.status === 'expired';

                  return (
                    <tr 
                      key={u.uid} 
                      className={`transition-colors ${
                        selected 
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/30' 
                          : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30'
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td className="py-4 px-4 text-center">
                        <input 
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelectUser(u.uid)}
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </td>

                      {/* User Account */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                            {u.displayName ? u.displayName.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
                              <span>{u.displayName || 'No Name'}</span>
                              {u.emailVerified && (
                                <span className="inline-block" title="Firebase Email Verified">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                                </span>
                              )}
                            </p>
                            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] truncate">{u.email}</p>
                            <span className="font-mono text-[9px] text-zinc-400 truncate block max-w-[140px]">
                              UID: {u.uid}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Workspace & Phone */}
                      <td className="py-4 px-4 font-medium text-zinc-800 dark:text-zinc-200">
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                          <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate">{u.businessName || 'Tareza Workspace'}</span>
                        </div>
                        {u.phone && u.phone !== 'N/A' && (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-zinc-400" />
                            <span>{u.phone}</span>
                          </p>
                        )}
                      </td>

                      {/* Auth State Badge */}
                      <td className="py-4 px-4">
                        {isDisabled ? (
                          <Badge className="bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold text-[10px]">
                            <ShieldOff className="w-3 h-3 mr-1" />
                            Disabled in Auth
                          </Badge>
                        ) : isSuspended ? (
                          <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold text-[10px]">
                            <PauseCircle className="w-3 h-3 mr-1" />
                            Suspended
                          </Badge>
                        ) : isExpired ? (
                          <Badge className="bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800 font-bold text-[10px]">
                            <Clock className="w-3 h-3 mr-1" />
                            Expired
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        <p className="text-[10px] text-zinc-400 mt-1">
                          Created: {u.creationTime ? new Date(u.creationTime).toLocaleDateString() : 'N/A'}
                        </p>
                      </td>

                      {/* Plan Badge */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wide border ${
                          u.plan.toLowerCase() === 'enterprise'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                            : u.plan.toLowerCase() === 'pro'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                            : u.plan.toLowerCase() === 'free_trial'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700'
                        }`}>
                          {u.plan}
                        </span>
                      </td>

                      {/* Expiry Date */}
                      <td className="py-4 px-4">
                        {u.expiresAt ? (
                          <div>
                            <p className={`font-semibold text-[11px] ${
                              new Date(u.expiresAt) < new Date() 
                                ? 'text-rose-600 dark:text-rose-400 font-bold' 
                                : 'text-zinc-700 dark:text-zinc-300'
                            }`}>
                              {new Date(u.expiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">
                              {new Date(u.expiresAt) < new Date() ? '⏰ Expired' : 'Valid until expiration'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">No Expiration (Lifetime)</span>
                        )}
                      </td>

                      {/* Action Controls */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Export single metadata */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExportMetadata('csv', [u])}
                            className="h-8 w-8 p-0 text-zinc-500 hover:text-emerald-600 cursor-pointer"
                            title="Export User Metadata (CSV)"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </Button>

                          {/* Edit Subscription / Plan */}
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(u);
                              setEditPlan(u.plan);
                              setEditStatus(u.status);
                              setExtensionMonths(1);
                              setIsPlanModalOpen(true);
                            }}
                            className="h-8 px-2.5 text-[11px] font-bold border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 cursor-pointer"
                            title="Edit Subscription Plan & Validity"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                            Plan
                          </Button>

                          {/* Suspend / Reactivate */}
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleSuspend(u)}
                            className={`h-8 px-2 text-[11px] font-bold cursor-pointer ${
                              isSuspended 
                                ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30' 
                                : 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30'
                            }`}
                            title={isSuspended ? "Reactivate Subscription" : "Suspend Subscription"}
                          >
                            {isSuspended ? (
                              <PlayCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            ) : (
                              <PauseCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                            )}
                            {isSuspended ? 'Resume' : 'Suspend'}
                          </Button>

                          {/* Enable / Disable in Firebase Auth */}
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleDisable(u)}
                            className={`h-8 px-2 text-[11px] font-bold cursor-pointer ${
                              u.disabled 
                                ? 'border-emerald-300 text-emerald-700 bg-emerald-50' 
                                : 'border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30'
                            }`}
                            title={u.disabled ? "Enable in Firebase Auth" : "Disable in Firebase Auth"}
                          >
                            {u.disabled ? (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <ShieldOff className="w-3.5 h-3.5 text-rose-600" />
                            )}
                          </Button>

                          {/* Send Password Reset */}
                          <Button 
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSendPasswordReset(u.email)}
                            className="h-8 w-8 p-0 text-zinc-500 hover:text-indigo-600 cursor-pointer"
                            title="Send Password Reset Email"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </Button>

                          {/* Delete Account */}
                          <Button 
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedUser(u);
                              setIsDeleteModalOpen(true);
                            }}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-600 cursor-pointer"
                            title="Delete Account from Firebase"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* MODAL 1: EDIT SINGLE PLAN & EXPIRY */}
      {isPlanModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-zinc-900 dark:text-white">
                    Manage Subscription: {selectedUser.displayName}
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    {selectedUser.email} (UID: {selectedUser.uid.substring(0, 8)}...)
                  </CardDescription>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setIsPlanModalOpen(false)}
                  className="h-8 w-8 p-0 rounded-full"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">Subscription Plan</label>
                <select 
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
                >
                  <option value="starter">Starter Plan</option>
                  <option value="pro">Pro Plan</option>
                  <option value="enterprise">Enterprise Plan</option>
                  <option value="free_trial">Free Trial</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">Account State</label>
                <select 
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
                >
                  <option value="active">Active (Full Access)</option>
                  <option value="suspended">Suspended (Access Blocked)</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">Extend Validity Period</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[1, 3, 6, 12].map((m) => (
                    <Button 
                      key={m}
                      type="button"
                      variant={extensionMonths === m ? 'default' : 'outline'}
                      onClick={() => {
                        setExtensionMonths(m);
                        setCustomExpiry('');
                      }}
                      className="h-8 text-xs font-bold"
                    >
                      +{m} Mo
                    </Button>
                  ))}
                </div>

                <div className="mt-2">
                  <span className="text-[11px] text-zinc-500 font-medium block mb-1">Or Set Custom Expiry Date:</span>
                  <Input 
                    type="date" 
                    value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    className="h-9 text-xs bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsPlanModalOpen(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSavePlanUpdate}
                  disabled={updating}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL 2: BULK PLAN CHANGE */}
      {isBulkPlanModalOpen && selectedUids.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-zinc-900 dark:text-white">
                    Batch Update Plan: {selectedUids.length} User(s)
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Apply subscription plan and extension across selected accounts
                  </CardDescription>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setIsBulkPlanModalOpen(false)}
                  className="h-8 w-8 p-0 rounded-full"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">Target Subscription Plan</label>
                <select 
                  value={bulkPlan}
                  onChange={(e) => setBulkPlan(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
                >
                  <option value="starter">Starter Plan</option>
                  <option value="pro">Pro Plan</option>
                  <option value="enterprise">Enterprise Plan</option>
                  <option value="free_trial">Free Trial</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">Grant Validity Duration</label>
                <select
                  value={bulkDurationMonths}
                  onChange={(e) => setBulkDurationMonths(parseInt(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
                >
                  <option value={1}>1 Month Extension</option>
                  <option value={3}>3 Months Extension</option>
                  <option value={6}>6 Months Extension</option>
                  <option value={12}>1 Year Extension</option>
                  <option value={24}>2 Years Extension</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsBulkPlanModalOpen(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleBulkAction('change_plan', { plan: bulkPlan, durationMonths: bulkDurationMonths })}
                  disabled={executingBulk}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs"
                >
                  {executingBulk ? 'Applying...' : `Update ${selectedUids.length} Account(s)`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL 3: BULK DELETE CONFIRMATION */}
      {isBulkDeleteModalOpen && selectedUids.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <CardContent className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Batch Delete {selectedUids.length} User(s)?</h3>
              <p className="text-xs text-zinc-500">
                This will permanently delete the selected <strong>{selectedUids.length} account(s)</strong> from Firebase Auth and clear their Firestore data. This action cannot be undone.
              </p>

              <div className="pt-3 flex items-center justify-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleBulkAction('delete')}
                  disabled={executingBulk}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 text-xs"
                >
                  {executingBulk ? 'Deleting...' : `Confirm Delete (${selectedUids.length})`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL 4: CREATE USER ACCOUNT */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-zinc-900 dark:text-white">
                    Create Firebase User Account
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Registers user in Firebase Auth and initializes Firestore subscription doc
                  </CardDescription>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-8 w-8 p-0 rounded-full"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>

            <form onSubmit={handleCreateUser}>
              <CardContent className="space-y-3 pt-4 text-xs">
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">Full Name</label>
                  <Input 
                    placeholder="e.g. Tendai Moyo" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">Email Address *</label>
                  <Input 
                    type="email"
                    required
                    placeholder="e.g. tendai@company.co.zw" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">Initial Password *</label>
                  <Input 
                    type="password"
                    required
                    placeholder="Min 6 characters" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">Business Workspace Name</label>
                  <Input 
                    placeholder="e.g. Moyo Wholesalers Ltd" 
                    value={newWorkspace}
                    onChange={(e) => setNewWorkspace(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1">Initial Subscription Plan</label>
                  <select 
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
                  >
                    <option value="starter">Starter Plan</option>
                    <option value="pro">Pro Plan</option>
                    <option value="enterprise">Enterprise Plan</option>
                  </select>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateModalOpen(false)}
                    className="h-9 text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={creating}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs"
                  >
                    {creating ? 'Creating...' : 'Create Account'}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 5: SINGLE DELETE CONFIRMATION */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <CardContent className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Delete Account Permanently?</h3>
              <p className="text-xs text-zinc-500">
                This will remove <strong>{selectedUser.email}</strong> from Firebase Auth and delete their Firestore subscription documents.
              </p>

              <div className="pt-3 flex items-center justify-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleDeleteUser}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 text-xs"
                >
                  Confirm Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
