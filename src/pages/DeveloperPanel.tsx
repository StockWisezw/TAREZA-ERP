import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  ShieldCheck, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Mail, 
  MessageSquare, 
  AlertCircle, 
  Database, 
  RefreshCw, 
  FileJson, 
  DownloadCloud,
  Users,
  Building2,
  Activity,
  Globe,
  Key,
  Wifi,
  AlertTriangle,
  Terminal,
  Copy,
  Check,
  Eye,
  EyeOff,
  Server,
  Lock,
  Compass,
  Calendar,
  Layers,
  Send,
  HelpCircle,
  Inbox,
  ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { ThemeToggle } from '../components/ThemeToggle';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { supabase, firebaseConfig } from '../lib/firebaseClient';
import { toast } from 'sonner';
import { MarketingAssets } from '../components/settings/MarketingAssets';

const supabaseConfig = { storageBucket: 'tareza-backups' };

export default function DeveloperPanel() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const isDeveloper = user?.email?.toLowerCase().endsWith('@tarezaerp.co.zw') || 
                      user?.email?.toLowerCase() === 'admin@tarezaerp.co.zw' || 
                      user?.email?.toLowerCase() === 'developer@tarezaerp.co.zw' || 
                      user?.email?.toLowerCase() === 'dev@tarezaerp.co.zw' || 
                      user?.email?.toLowerCase() === 'tapsforex@gmail.com';

  const [businesses, setBusinesses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [subFilter, setSubFilter] = useState<'active' | 'suspended' | 'no_sub' | 'all'>('active');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [businessUsers, setBusinessUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Support tickets state
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [ticketReplies, setTicketReplies] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submittingReply, setSubmittingReply] = useState<string | null>(null);

  // Database backups states
  const [backupLogs, setBackupLogs] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [triggeringBackup, setTriggeringBackup] = useState(false);

  // Firebase Diagnostics state
  const [diagLogs, setDiagLogs] = useState<{ timestamp: string; type: 'info' | 'success' | 'warn' | 'error'; message: string }[]>([]);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagStatus, setDiagStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [revealKey, setRevealKey] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Notifications state
  const [notifLogs, setNotifLogs] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const fetchNotificationLogs = async () => {
    setNotifLoading(true);
    try {
      const res = await fetch('/api/notifications/logs');
      if (res.ok) {
        const data = await res.json();
        setNotifLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load notifications audit trail", err);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (isDeveloper) {
      fetchBusinessesAndSubscriptions();
      fetchBackupLogs();
      fetchSupportTickets();
      fetchNotificationLogs();
    }
  }, [isDeveloper]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
    toast.success(`${label} copied to clipboard`);
  };

  const runDiagnostics = async () => {
    setDiagRunning(true);
    setDiagStatus('running');
    const logsList: { timestamp: string; type: 'info' | 'success' | 'warn' | 'error'; message: string }[] = [];
    
    const pushLog = (type: 'info' | 'success' | 'warn' | 'error', message: string) => {
      logsList.push({
        timestamp: new Date().toLocaleTimeString(),
        type,
        message
      });
      setDiagLogs([...logsList]);
    };

    pushLog('info', '================================================');
    pushLog('info', '🚀 Starting Firebase/Firestore Active Diagnostics...');
    pushLog('info', `Current local time: ${new Date().toISOString()}`);
    pushLog('info', `Local Network Online Status (navigator.onLine): ${navigator.onLine ? 'ONLINE' : 'OFFLINE'}`);
    pushLog('info', '================================================');

    if (!navigator.onLine) {
      pushLog('error', '❌ Browser reports OFFLINE. Active network interfaces might be disabled.');
    } else {
      pushLog('success', '✅ Wi-Fi / Local Network is active and reporting online status.');
    }

    pushLog('info', '🔍 Step 1: Auditing Firebase configuration bundle loaded...');
    const currentProjId = firebaseConfig.projectId || '';
    const currentDbId = firebaseConfig.firestoreDatabaseId || '';
    const currentApiKey = firebaseConfig.apiKey || '';

    pushLog('info', `Firebase Project ID: "${currentProjId || 'NOT DEFINED'}"`);
    pushLog('info', `Firestore Database ID: "${currentDbId || '(default)'}"`);
    pushLog('info', `Web API Key (masked): "${currentApiKey ? (currentApiKey.substring(0, 8) + '...' + currentApiKey.substring(currentApiKey.length - 8)) : 'NOT DEFINED'}"`);

    let isValid = true;
    if (!currentProjId || currentProjId.includes('your-') || currentProjId.includes('placeholder')) {
      pushLog('error', '❌ Firebase Project ID is empty or matches default placeholder value. Please check firebase-applet-config.json.');
      isValid = false;
    } else {
      pushLog('success', '✅ Firebase Project ID syntax is validated.');
    }

    if (!isValid) {
      pushLog('error', '❌ Context validations failed. Aborting database queries due to missing project credentials.');
      setDiagStatus('warning');
      setDiagRunning(false);
      return;
    }

    pushLog('info', '📡 Step 2: Testing direct Google APIs network availability with timeout...');
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 6000);
    const apiPingUrl = `https://firestore.googleapis.com/v1/projects/${currentProjId}/databases/${currentDbId || '(default)'}/documents`;
    const startTime = performance.now();

    try {
      pushLog('info', `Sending API ping request to Google Cloud: ${apiPingUrl}`);
      const response = await fetch(apiPingUrl, {
        method: 'GET',
        signal: abortController.signal
      });
      clearTimeout(timeout);
      const delay = Math.round(performance.now() - startTime);
      pushLog('info', `HTTP response received. Status: ${response.status} ${response.statusText}`);
      pushLog('info', `Direct Google API handshake completed in ${delay}ms.`);

      if (response.status === 200 || response.status === 400 || response.status === 403 || response.status === 404) {
        pushLog('success', `✅ Direct Firestore endpoint is fully reachable over HTTPS. Latency: ${delay}ms.`);
      } else {
        pushLog('warn', `⚠️ Firestore responded with unexpected status code: ${response.status}`);
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const delay = Math.round(performance.now() - startTime);

      if (err.name === 'AbortError') {
        pushLog('error', `❌ TIMEOUT ERROR occurred after ${delay}ms!`);
        pushLog('error', '👉 Firebase REST endpoint could not resolve/reach within 6s. Check firewall policies.');
      } else {
        pushLog('error', `❌ Network handshake failure: ${err.message || String(err)}`);
        pushLog('error', '👉 Make sure your browser allows connections to firestore.googleapis.com.');
      }
    }

    pushLog('info', '🛰️ Step 3: Triggering Firestore query execution through client context...');
    const dbQueryStart = performance.now();
    try {
      const { data, error } = await supabase.from('businesses').select('*').limit(1);
      const dbQueryDelay = Math.round(performance.now() - dbQueryStart);

      if (error) {
        pushLog('error', `❌ Database query failed after ${dbQueryDelay}ms: ${error.message || String(error)}`);
      } else {
        pushLog('success', `✅ Firebase Query execution succeeded! Fetched businesses list in ${dbQueryDelay}ms.`);
        pushLog('info', `Payload context check: ${data ? `${data.length} instances processed` : '0 instances returned'}`);
      }
    } catch (err: any) {
      const dbQueryDelay = Math.round(performance.now() - dbQueryStart);
      pushLog('error', `❌ Exception thrown during database query execution in ${dbQueryDelay}ms: ${err.message || String(err)}`);
    }

    pushLog('info', '================================================');
    pushLog('info', '🏆 Firebase Connection Diagnostics completed.');
    pushLog('info', '================================================');

    const hasErrors = logsList.some(l => l.type === 'error');
    const hasWarnings = logsList.some(l => l.type === 'warn');
    if (hasErrors) {
      setDiagStatus('error');
    } else if (hasWarnings) {
      setDiagStatus('warning');
    } else {
      setDiagStatus('success');
    }
    setDiagRunning(false);
  };

  const fetchBackupLogs = async () => {
    setBackupLoading(true);
    try {
      const response = await fetch('/api/admin/backups/logs');
      const data = await response.json();
      if (data.success) {
        setBackupLogs(data.logs || []);
      }
    } catch (err: any) {
      console.error("Failed to load backup logs:", err);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    setTriggeringBackup(true);
    try {
      const response = await fetch('/api/admin/backups/run', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        toast.success(`Success! Ledger data backed up to: ${data.filename}`);
        fetchBackupLogs();
      } else {
        toast.error(`Backup failed: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Failed to trigger backup: ${err.message}`);
    } finally {
      setTriggeringBackup(false);
    }
  };

  const fetchBusinessesAndSubscriptions = async () => {
    setLoading(true);
    try {
      const { data: bData, error: bError } = await supabase.from('businesses').select('*');
      if (bError) throw bError;
      setBusinesses(bData || []);

      const { data: sData, error: sError } = await supabase.from('subscriptions').select('*');
      if (!sError && sData) {
        setSubscriptions(sData);
      }

      // Fetch user profiles & business user connections
      const { data: pData, error: pError } = await supabase.from('profiles').select('*');
      if (!pError && pData) {
        setProfiles(pData);
      }

      const { data: buData, error: buError } = await supabase.from('business_users').select('*');
      if (!buError && buData) {
        setBusinessUsers(buData);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to load business databases: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId: string, currentIsActive: boolean) => {
    try {
      const matchedRecords = businessUsers.filter(bu => bu.user_id === userId);
      
      if (matchedRecords && matchedRecords.length > 0) {
        for (const record of matchedRecords) {
          const { error: updateErr } = await supabase
            .from('business_users')
            .update({ is_active: !currentIsActive, updated_at: new Date().toISOString() })
            .eq('id', record.id);
          if (updateErr) throw updateErr;
        }
        toast.success(`User access successfully ${currentIsActive ? 'paused (deactivated)' : 'active (reactivated)'}!`);
      } else {
        toast.error("User is not connected to a business workspace registry.");
      }
      fetchBusinessesAndSubscriptions();
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to update user status: ${err.message}`);
    }
  };

  const updateUserRole = async (userId: string, targetRoleId: string) => {
    try {
      const matchedRecords = businessUsers.filter(bu => bu.user_id === userId);
      
      if (matchedRecords && matchedRecords.length > 0) {
        for (const record of matchedRecords) {
          const { error: updateErr } = await supabase
            .from('business_users')
            .update({ role_id: targetRoleId, updated_at: new Date().toISOString() })
            .eq('id', record.id);
          if (updateErr) throw updateErr;
        }
        toast.success(`User role updated to: ${targetRoleId}`);
      } else {
        toast.error("User is not connected to a business workspace registry.");
      }
      fetchBusinessesAndSubscriptions();
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to update user role: ${err.message}`);
    }
  };

  const fetchSupportTickets = async () => {
    try {
      const { data, error } = await supabase.from('support_tickets').select('*');
      if (!error && data) {
        // If empty, auto-seed 2 interactive tickets so they have premium initial content
        if (data.length === 0) {
          const defaultTickets = [
            {
              id: 'tick-fs-101',
              user_id: 'seeder-user-1',
              user_email: 'retail_solutions@zimra.zw',
              business_id: 'biz-seed-zim',
              business_name: 'Harare Wholesale Center',
              subject: 'ZIMRA Fiscal Router Gateway Connection Error 502',
              category: 'technical',
              priority: 'urgent',
              status: 'Pending',
              description: 'Our fiscal cash register cannot transmit receipts to the ZIMRA central sandbox database. Device throws connection timeout errors when trying to sign daily tax ledger.',
              response: '',
              created_at: javaDateString(3600000), // 1 hour ago
              updated_at: javaDateString(3600000)
            },
            {
              id: 'tick-fs-102',
              user_id: 'seeder-user-2',
              user_email: 'accountant@bulawayoretail.co.zw',
              business_id: 'biz-seed-bul',
              business_name: 'Bulawayo General Stores',
              subject: 'Semi-annual subscription fee RTGS invoice request',
              category: 'billing',
              priority: 'medium',
              status: 'Pending',
              description: 'Please issue a semi-annual pro invoice with Zimbabwe general business tax numbers for our board auditing before we trigger our EcoCash transfer.',
              response: '',
              created_at: javaDateString(14400000), // 4 hours ago
              updated_at: javaDateString(14400000)
            }
          ];

          for (const t of defaultTickets) {
            await supabase.from('support_tickets').insert([t]);
          }

          const { data: refetched } = await supabase.from('support_tickets').select('*');
          if (refetched) {
            setSupportTickets(refetched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
          }
        } else {
          // Sort Pending first, then newest
          const sorted = [...data].sort((a, b) => {
            if (a.status === 'Pending' && b.status !== 'Pending') return -1;
            if (a.status !== 'Pending' && b.status === 'Pending') return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          setSupportTickets(sorted);
        }
      }
    } catch (err) {
      console.error("Failed to load help desk tickets:", err);
    }
  };

  const updateSubscriptionSettings = async (businessId: string, updates: { plan_name?: string; status?: string; days_to_add?: number }) => {
    try {
      const business = businesses.find(b => b.id === businessId);
      const sub = subscriptions.find(s => s.business_id === businessId);
      
      const newPlan = updates.plan_name || sub?.plan_name || business?.subscription_plan || 'pro';
      const newStatus = updates.status || sub?.status || business?.subscription_status?.toLowerCase() || 'active';
      
      let currentEndDate = sub?.end_date ? new Date(sub.end_date) : new Date();
      if (currentEndDate.getTime() < Date.now()) {
        currentEndDate = new Date();
      }
      if (updates.days_to_add) {
        currentEndDate.setDate(currentEndDate.getDate() + updates.days_to_add);
      }
      
      const updatedEndDateStr = currentEndDate.toISOString();
      
      // 1. Update business record
      await supabase.from('businesses').update({
        subscription_plan: newPlan,
        subscription_status: newStatus === 'active' ? 'ACTIVE' : 'EXPIRED',
        subscription_end_date: updatedEndDateStr,
        updated_at: new Date().toISOString()
      }).eq('id', businessId);
      
      // 2. Update subscription record
      if (sub?.id) {
        await supabase.from('subscriptions').update({
          plan_name: newPlan,
          status: newStatus,
          end_date: updatedEndDateStr,
          created_at: sub.created_at || new Date().toISOString()
        }).eq('id', sub.id);
      } else {
        await supabase.from('subscriptions').insert([{
          id: 'sub-' + Math.floor(Math.random() * 1000000),
          business_id: businessId,
          plan_name: newPlan,
          status: newStatus,
          start_date: new Date().toISOString(),
          end_date: updatedEndDateStr,
          created_at: new Date().toISOString()
        }]);
      }
      
      toast.success("Subscription parameters successfully updated!");
      fetchBusinessesAndSubscriptions();
    } catch (err: any) {
      console.error(err);
      toast.error(`Subscription modification failed: ${err.message}`);
    }
  };

  const handleReplyTicket = async (ticketId: string) => {
    const text = ticketReplies[ticketId];
    if (!text || !text.trim()) {
      toast.error("Type a solution or response message first.");
      return;
    }

    setSubmittingReply(ticketId);
    try {
      await supabase.from('support_tickets').update({
        response: text,
        status: 'Resolved',
        updated_at: new Date().toISOString()
      }).eq('id', ticketId);

      toast.success("Ticket resolved! The customer has been sent your response.");
      setTicketReplies(prev => ({ ...prev, [ticketId]: '' }));
      setReplyingTo(null);
      fetchSupportTickets();
    } catch (err: any) {
      toast.error(`Failed to post solution: ${err.message}`);
    } finally {
      setSubmittingReply(null);
    }
  };

  // Helper date function for seeding mock timestamps
  function javaDateString(offsetMs: number) {
    return new Date(Date.now() - offsetMs).toISOString();
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center animate-fade-in font-sans">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Checking Developer Credentials...</p>
      </div>
    );
  }

  if (!isDeveloper) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans">
        <nav className="w-full border-b bg-background px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-base font-bold">Tareza Developer Portal</span>
          </div>
          <ThemeToggle />
        </nav>

        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <Card className="max-w-md w-full shadow-lg border-zinc-200 dark:border-zinc-800 text-center p-8 rounded-2xl bg-card">
            <div className="mx-auto bg-rose-50 dark:bg-rose-950/20 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 border border-rose-100 dark:border-rose-900/50">
              <Lock className="w-8 h-8 text-rose-600 dark:text-rose-400" />
            </div>
            <CardTitle className="text-xl mb-2 font-bold font-sans text-zinc-900 dark:text-white">Authorized Developers Only</CardTitle>
            <CardDescription className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-6 font-sans">
              This panel is restricted to systems administration and authorized developer roles. Please sign in via the standard login screen with a dev-supported profile.
            </CardDescription>
            <div className="flex flex-col gap-2">
              <Link to="/login">
                <Button className="w-full h-11 font-semibold text-sm">
                  Sign In as Developer
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full h-11 font-semibold text-sm">
                  Return to Home
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-foreground flex flex-col font-sans">
      <nav className="w-full border-b bg-background px-6 py-4 flex items-center justify-between shadow-xs select-none">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <span className="text-lg font-extrabold tracking-tight">Tareza Developers Headquarters</span>
        </div>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <Button variant="ghost" className="h-9 px-4 rounded-lg hover:bg-zinc-100 text-xs font-semibold" onClick={() => { localStorage.removeItem('isPreviewMode'); signOut(); navigate('/login'); }}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        
        {/* 🗺️ Interactive Developer Roadmap Banner Card */}
        <Card className="border border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 via-violet-500/5 to-transparent dark:from-indigo-950/15 dark:via-violet-950/10 overflow-hidden relative rounded-2xl shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-12 -mt-12"></div>
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <Compass className="h-3 w-3" /> Confined Developer Channel
              </div>
              <CardTitle className="text-base font-extrabold text-zinc-950 dark:text-zinc-50 tracking-tight flex items-center gap-2">
                Active Sprints & Product Roadmap Hub
              </CardTitle>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl font-sans font-medium">
                Review and prioritize Tareza ERP's development backlog, track live feature deployment metrics, upvote upcoming modules, or log new operator recommendations directly into the development pipeline.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <Button 
                onClick={() => navigate('/roadmap')} 
                className="rounded-xl px-4 h-10 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-none transition-all cursor-pointer select-none font-sans"
              >
                Launch Roadmap Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Subscriptions manager - 7 columns */}
          <Card className="lg:col-span-7 border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Tenant Subscription Audit Registry
                </CardTitle>
                <CardDescription className="text-xs">
                  Review tenant volume metrics, authorize plans, and manually suspend or reactivate accounts.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchBusinessesAndSubscriptions} 
                disabled={loading}
                className="h-8 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Reload Registry
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Premium Subscriptions Filter Segment */}
              <div className="flex bg-zinc-100 dark:bg-zinc-90 w-full p-1 rounded-lg gap-1 border border-zinc-200/40 dark:border-zinc-800/80 mb-4 text-xs select-none">
                <button 
                  type="button"
                  onClick={() => setSubFilter('active')} 
                  className={`flex-1 py-1.5 px-3 rounded-md transition-all font-medium text-center cursor-pointer ${subFilter === 'active' ? 'bg-white dark:bg-zinc-800 shadow-xs text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  Active ({businesses.filter(b => {
                    const status = subscriptions.find(s => s.business_id === b.id)?.status || b.subscription_status?.toLowerCase();
                    return status === 'active' || (!status && b.subscription_status === 'ACTIVE');
                  }).length})
                </button>
                <button 
                  type="button"
                  onClick={() => setSubFilter('suspended')} 
                  className={`flex-1 py-1.5 px-3 rounded-md transition-all font-medium text-center cursor-pointer ${subFilter === 'suspended' ? 'bg-white dark:bg-zinc-800 shadow-xs text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-550 hover:text-zinc-800'}`}
                >
                  Suspended ({businesses.filter(b => {
                    const status = subscriptions.find(s => s.business_id === b.id)?.status || b.subscription_status?.toLowerCase();
                    return status === 'suspended';
                  }).length})
                </button>
                <button 
                  type="button"
                  onClick={() => setSubFilter('no_sub')} 
                  className={`flex-1 py-1.5 px-3 rounded-md transition-all font-medium text-center cursor-pointer ${subFilter === 'no_sub' ? 'bg-white dark:bg-zinc-800 shadow-xs text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-550 hover:text-zinc-800'}`}
                >
                  Archive/No Sub ({businesses.filter(b => {
                    const status = subscriptions.find(s => s.business_id === b.id)?.status || b.subscription_status?.toLowerCase();
                    return !status || status === 'expired' || status === 'free_trial' || b.subscription_status === 'EXPIRED';
                  }).length})
                </button>
                <button 
                  type="button"
                  onClick={() => setSubFilter('all')} 
                  className={`flex-1 py-1.5 px-3 rounded-md transition-all font-medium text-center cursor-pointer ${subFilter === 'all' ? 'bg-white dark:bg-zinc-800 shadow-xs text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-550 hover:text-zinc-800'}`}
                >
                  All ({businesses.length})
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                  Loading database records...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold text-zinc-500">Business Details</TableHead>
                        <TableHead className="text-xs font-semibold text-zinc-500">Plan</TableHead>
                        <TableHead className="text-xs font-semibold text-zinc-500">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-zinc-500">Due Date</TableHead>
                        <TableHead className="text-xs font-semibold text-zinc-550 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const displayedBusinesses = businesses.filter(b => {
                          const status = subscriptions.find(s => s.business_id === b.id)?.status || b.subscription_status?.toLowerCase();
                          if (subFilter === 'active') {
                            return status === 'active' || (!status && b.subscription_status === 'ACTIVE');
                          }
                          if (subFilter === 'suspended') {
                            return status === 'suspended';
                          }
                          if (subFilter === 'no_sub') {
                            return !status || status === 'expired' || status === 'free_trial' || b.subscription_status === 'EXPIRED';
                          }
                          return true;
                        });

                        if (displayedBusinesses.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-zinc-400 text-xs">
                                No systems match this filter query.
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return displayedBusinesses.map(b => {
                          const sub = subscriptions.find(s => s.business_id === b.id);
                          const plan = sub?.plan_name || b.subscription_plan || 'free_trial';
                          const status = sub?.status || b.subscription_status?.toLowerCase() || 'active';
                          const endDateStr = sub?.end_date || b.subscription_end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                          const dueReadable = new Date(endDateStr).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          });

                          return (
                            <TableRow key={b.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-900/10 transition-colors">
                              <TableCell className="font-semibold py-3.5">
                                <div className="space-y-0.5">
                                  <p className="text-zinc-900 dark:text-zinc-100 font-sans text-xs">{b.name}</p>
                                  <p className="text-[10px] text-zinc-400 font-mono select-all uppercase">
                                    ID: {b.id.substring(0, 8)}... • Tax: {b.tax_number || 'N/A'}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-[9px] uppercase font-mono shadow-none h-5 px-1.5 rounded-md ${
                                  plan === 'pro' ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200' :
                                  plan === 'enterprise' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200' :
                                  'bg-zinc-500/10 text-zinc-650 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
                                }`}>
                                  {plan}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-[9px] uppercase font-mono shadow-none h-5 px-1.5 rounded-md ${
                                  status === 'active' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200' :
                                  status === 'suspended' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-450 border border-rose-200' :
                                  'bg-amber-500/15 text-amber-700 dark:text-amber-450 border border-amber-200'
                                }`}>
                                  {status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-zinc-600 dark:text-zinc-300 font-mono text-[11px] whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3" />
                                  <span>{dueReadable}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3.5">
                                <div className="flex flex-wrap gap-1.5 justify-end">
                                  {status === 'active' ? (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => updateSubscriptionSettings(b.id, { status: 'suspended' })}
                                      className="text-[11px] h-7 px-2.5 rounded-lg border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-55 dark:hover:bg-rose-955/20 hover:text-rose-700 font-sans cursor-pointer"
                                    >
                                      Suspend
                                    </Button>
                                  ) : (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => updateSubscriptionSettings(b.id, { status: 'active', days_to_add: 30 })}
                                      className="text-[11px] h-7 px-2.5 rounded-lg border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-700 font-sans cursor-pointer"
                                    >
                                      Reactivate
                                    </Button>
                                  )}

                                  <DropdownMenu>
                                    <DropdownMenuTrigger render={
                                      <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100">
                                        Extend Plan
                                      </Button>
                                    } />
                                    <DropdownMenuContent className="w-56" align="end">
                                      <DropdownMenuLabel>Add Subscription Expiry</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => updateSubscriptionSettings(b.id, { days_to_add: 30 })}>
                                        Extend +30 Days (1 Month)
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => updateSubscriptionSettings(b.id, { days_to_add: 90 })}>
                                        Extend +90 Days (Quarterly)
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => updateSubscriptionSettings(b.id, { days_to_add: 180 })}>
                                        Extend +180 Days (Semi-Annually)
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => updateSubscriptionSettings(b.id, { days_to_add: 365 })}>
                                        Extend +365 Days (Annually)
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel>Switch Business Tier</DropdownMenuLabel>
                                      <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => updateSubscriptionSettings(b.id, { plan_name: 'starter' })}>
                                        Switch to Starter Tier
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => updateSubscriptionSettings(b.id, { plan_name: 'pro' })}>
                                        Switch to Professional Tier
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => updateSubscriptionSettings(b.id, { plan_name: 'enterprise' })}>
                                        Switch to Enterprise Corporate
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Support Ticket Resolution Manager - 5 columns */}
          <Card className="lg:col-span-5 border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Help Desk Inquiries & Tickets
                </CardTitle>
                <CardDescription className="text-xs">
                  Respond to client-raised questions, technical bugs, or billing disputes.
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={fetchSupportTickets} 
                className="h-8 w-8 p-0 rounded-lg border border-zinc-200 dark:border-zinc-850"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4 max-h-[500px] overflow-y-auto">
              <div className="space-y-4">
                {supportTickets.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400">
                    <Mail className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold">All tickets clear</p>
                    <p className="text-[10px] text-zinc-400">There are no pending tickets requiring developer manual intervention.</p>
                  </div>
                ) : (
                  supportTickets.map(ticket => (
                    <div key={ticket.id} className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/5 flex flex-col gap-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[9px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1 py-0.2 rounded font-bold">
                              {ticket.id}
                            </span>
                            <span className={`text-[8.5px] font-extrabold uppercase px-1.5 py-0.2 rounded font-mono ${
                              ticket.priority === 'urgent' ? 'bg-rose-500/10 text-rose-600' :
                              ticket.priority === 'high' ? 'bg-amber-500/15 text-amber-600 font-bold' :
                              'bg-zinc-500/10 text-zinc-500'
                            }`}>
                              {ticket.priority}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{ticket.subject}</h4>
                          <p className="text-[10px] text-zinc-500">
                            From: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{ticket.user_email}</span> at <strong className="font-sans text-zinc-700 dark:text-zinc-300">{ticket.business_name}</strong>
                          </p>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`text-[9px] uppercase font-bold h-5 shadow-none ${
                            ticket.status === 'Resolved' 
                              ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-950/20 border-emerald-200' 
                              : 'bg-rose-500/15 text-rose-600 dark:bg-rose-955/20 border-rose-225 animate-pulse'
                          }`}
                        >
                          {ticket.status}
                        </Badge>
                      </div>

                      <div className="p-3 rounded bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 text-[11.5px] text-zinc-600 dark:text-zinc-350 italic leading-relaxed whitespace-pre-wrap">
                        "{ticket.description}"
                      </div>

                      {ticket.response && (
                        <div className="bg-indigo-500/5 dark:bg-indigo-500/10 border-l border-indigo-500 p-2.5 rounded-r text-[11px] leading-relaxed">
                          <p className="text-[9px] font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Solution Sent:</p>
                          <p className="text-zinc-600 dark:text-zinc-350 bg-background/50 px-2 py-1 rounded border border-zinc-100 dark:border-zinc-800 mt-1 whitespace-pre-wrap select-all">
                            {ticket.response}
                          </p>
                        </div>
                      )}

                      {ticket.status !== 'Resolved' && (
                        <div className="space-y-2 mt-1">
                          {replyingTo === ticket.id ? (
                            <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                              <textarea
                                placeholder="Type answer, fix actions, or verification diagnostics steps..."
                                rows={3}
                                value={ticketReplies[ticket.id] || ''}
                                onChange={(e) => setTicketReplies(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                className="w-full p-2 border border-zinc-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-sans text-zinc-90 w"
                              />
                              <div className="flex gap-1.5 justify-end">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => setReplyingTo(null)}
                                  className="h-8 text-[11px] px-2.5 rounded"
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  size="sm" 
                                  disabled={submittingReply === ticket.id}
                                  onClick={() => handleReplyTicket(ticket.id)}
                                  className="h-8 text-[11px] px-3.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                  {submittingReply === ticket.id ? "Saving Solution..." : "Resolve & Submit Solution"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => setReplyingTo(ticket.id)}
                              className="w-full text-xs h-8 bg-zinc-900 border hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 shadow-none font-sans cursor-pointer rounded-lg"
                            >
                              Resolve Ticket
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Centralized Operator Profiles Registry */}
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4 gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Individual User Profiles & Operator Registry
              </CardTitle>
              <CardDescription className="text-xs">
                View individual authenticated accounts, inspect workspace bounds, and manually activate or pause cashiers and owners.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Search operators by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-8 max-w-xs text-xs rounded-lg font-sans"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchBusinessesAndSubscriptions} 
                disabled={loading}
                className="h-8 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Reload Users
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            ) : profiles.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                No user profiles retrieved in this sandbox database.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">User Account</TableHead>
                      <TableHead className="text-xs">Connected Workspaces</TableHead>
                      <TableHead className="text-xs">Role Index</TableHead>
                      <TableHead className="text-xs">Access State</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles
                      .filter(p => {
                        const searchLower = userSearch.toLowerCase();
                        return (
                          (p.first_name || '').toLowerCase().includes(searchLower) ||
                          (p.last_name || '').toLowerCase().includes(searchLower) ||
                          (p.email || '').toLowerCase().includes(searchLower)
                        );
                      })
                      .map(p => {
                        const links = businessUsers.filter(bu => bu.user_id === p.id);
                        const isUserActive = links.length > 0 ? links.every(bu => bu.is_active !== false) : true;
                        
                        return (
                          <TableRow key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                            <TableCell>
                              <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-50">
                                {p.first_name || 'Unnamed'} {p.last_name || 'User'}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono">{p.email}</div>
                              {p.phone && <div className="text-[9px] text-zinc-400 font-sans mt-0.5">{p.phone}</div>}
                            </TableCell>
                            <TableCell>
                              {links.length === 0 ? (
                                <span className="text-[10px] text-amber-500 italic font-medium">No workspace linked</span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {links.map(l => {
                                    const biz = businesses.find(b => b.id === l.business_id);
                                    return (
                                      <div key={l.id} className="text-[10px] flex items-center gap-1.5 text-zinc-750 dark:text-zinc-350">
                                        <Building2 className="w-3 h-3 text-zinc-450 shrink-0" />
                                        <span>{biz?.name || 'Unknown Workspace'}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {links.length === 0 ? (
                                <span className="text-[10px] text-zinc-400">-</span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {links.map(l => {
                                    const roleLabel = l.role_id === 'staff' ? 'Staff' : l.role_id === 'mgr' ? 'Manager' : l.role_id === 'admin' ? 'Administrator' : l.role_id || 'Member';
                                    return (
                                      <Badge key={l.id} variant="outline" className="text-[8px] font-sans w-fit tracking-wider border-zinc-200 dark:border-zinc-800 py-0 uppercase">
                                        {roleLabel}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                className={`text-[9px] font-sans capitalize px-2 py-0.5 border ${
                                  isUserActive 
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/25 border-emerald-250 border-emerald-200' 
                                    : 'bg-zinc-100 text-zinc-650 dark:bg-zinc-900 border-zinc-250 border-zinc-350 font-medium'
                                }`}
                              >
                                {isUserActive ? 'Active' : 'Paused'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end items-center gap-1.5 font-sans">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`h-7 text-[10px] font-semibold font-sans px-2.5 rounded-lg ${
                                    isUserActive ? 'text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50' : 'text-emerald-600 hover:text-emerald-700 border-emerald-200 hover:bg-emerald-50/50'
                                  }`}
                                  onClick={() => updateUserStatus(p.id, isUserActive)}
                                >
                                  {isUserActive ? 'Pause User' : 'Unpause User'}
                                </Button>
                                
                                <DropdownMenu>
                                  <DropdownMenuTrigger render={
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100">
                                      <span className="sr-only">Menu</span>
                                      <span className="text-[10px] font-bold">...</span>
                                    </Button>
                                  } />
                                  <DropdownMenuContent align="end" className="w-40 font-sans border border-border bg-card">
                                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Upgrade/Set Role</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => updateUserRole(p.id, 'admin')}>
                                      Set as Admin
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => updateUserRole(p.id, 'mgr')}>
                                      Set as Manager
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => updateUserRole(p.id, 'staff')}>
                                      Set as Staff
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Database backups & automated logging */}
        <Card className="font-sans bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-850 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-500 animate-pulse" />
                Ledger Cloud Database Snapshots & Backups
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time backup of JSON ledger schemas, corporate Journal lines, shift sessions and system-wide audit registers.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={fetchBackupLogs}
                disabled={backupLoading}
                className="text-xs h-8 rounded-lg cursor-pointer hover:bg-zinc-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${backupLoading ? 'animate-spin' : ''}`} />
                Reload Snapshot Logs
              </Button>
              <Button 
                size="sm"
                onClick={handleTriggerBackup}
                disabled={triggeringBackup}
                className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer rounded-lg px-3.5 font-sans"
              >
                <DownloadCloud className="w-3.5 h-3.5 mr-1.5" />
                {triggeringBackup ? 'Slicing snapshot...' : 'Trigger Secure Backup'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-6 p-4 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">Background Cron Automation: Active</h4>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                  The system cron is registered and executes baseline snapshots daily at <strong>01:00 UTC</strong>. Archived snapshots are securely encrypted and streamed to: <code>firebase-storage://{supabaseConfig.storageBucket}/backups/</code> with a 30-day corporate retention policy.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
                Recent Snapshot Transactions
              </h4>
              
              {backupLoading && backupLogs.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                  Requesting system snapshot timeline...
                </div>
              ) : backupLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/30">
                  No previous snapshot files recorded yet. Run snap baseline using manual trigger.
                </div>
              ) : (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                  <Table>
                    <TableHeader className="bg-zinc-50/50 dark:bg-zinc-850/10">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Execution Date (UTC)</TableHead>
                        <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">File Object</TableHead>
                        <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Data Slices</TableHead>
                        <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">File Size</TableHead>
                        <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {backupLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-zinc-50/20">
                          <TableCell className="font-medium whitespace-nowrap text-zinc-900 dark:text-zinc-100 font-mono">
                            {new Date(log.timestamp).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            })}
                          </TableCell>
                          <TableCell className="text-zinc-600 dark:text-zinc-400 font-mono max-w-xs truncate" title={log.filename}>
                            {log.filename}
                          </TableCell>
                          <TableCell className="text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                            {log.status === 'SUCCESS' ? (
                              <span className="inline-flex flex-wrap gap-1 font-mono text-[10px]">
                                <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">accts: {log.accounts_count ?? 0}</span>
                                <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">jes: {log.journal_entries_count ?? 0}</span>
                                <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">jls: {log.journal_lines_count ?? 0}</span>
                              </span>
                            ) : (
                              <span className="text-rose-600 font-mono text-[10px]" title={log.error}>
                                Error snap: {log.error || 'Direct Exception'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-zinc-700 dark:text-zinc-300 font-mono whitespace-nowrap">
                            {log.size_bytes ? `${(log.size_bytes / 1024).toFixed(2)} KB` : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Badge className={
                              log.status === 'SUCCESS' 
                                ? 'bg-emerald-100 text-emerald-855 dark:bg-emerald-950/20 dark:text-emerald-400 hover:bg-emerald-100 uppercase text-[10px] font-bold shadow-none' 
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-955/20 dark:text-rose-400 hover:bg-rose-50 uppercase text-[10px] font-bold shadow-none'
                            }>
                              {log.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Real-time Dispatch Alerts & Notification Monitor */}
        <Card className="font-sans bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-850 shadow-sm mt-6">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                Real-time System Dispatch Alerts & Notifications (Email / WhatsApp)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-550 dark:text-zinc-450">
                Monitor live signals, WhatsApp templates to 0784553570, and automated SMTP email logs dispatched to tapsforex@gmail.com.
              </CardDescription>
            </div>
            <div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={fetchNotificationLogs}
                disabled={notifLoading}
                className="text-xs h-8 rounded-lg cursor-pointer hover:bg-zinc-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${notifLoading ? 'animate-spin' : ''}`} />
                Reload Alert Log Timeline
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-mono">Alert WhatsApp Recipient</span>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-1 font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  +263 784 553 570
                </p>
                <p className="text-[9px] text-zinc-500 dark:text-zinc-450 mt-1">Country code normalized for standard Zimbabwe delivery routing.</p>
              </div>
              <div className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-mono">Notification Receiver Email</span>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-1 font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                  tapsforex@gmail.com
                </p>
                <p className="text-[9px] text-zinc-500 dark:text-zinc-450 mt-1">SMTP carbon copy alerts triggered in tandem with messaging blocks.</p>
              </div>
              <div className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-mono">API Connection Mode</span>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-1 font-mono">
                  SMTP & Callmebot / Twilio Gateway
                </p>
                <p className="text-[9px] text-zinc-500 dark:text-zinc-450 mt-1">Integrates live in SaaS environment securely from system backend secrets.</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
                Recent Dispatched Signals Logs
              </h4>

              {notifLoading && notifLogs.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                  Requesting notification logs stream...
                </div>
              ) : notifLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/20">
                  No notifications recorded during this server session. Trigger any signup or raise a support ticket to generate activity!
                </div>
              ) : (
                <div className="border border-zinc-200 dark:border-zinc-805 rounded-xl overflow-hidden shadow-xs">
                  <Table>
                    <TableHeader className="bg-zinc-50/50 dark:bg-zinc-855/10">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Timestamp</TableHead>
                        <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Event</TableHead>
                        <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Channel</TableHead>
                        <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Target Recipient</TableHead>
                        <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Message Summary</TableHead>
                        <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {notifLogs.map((log, offset) => (
                        <TableRow key={offset} className="hover:bg-zinc-50/20">
                          <TableCell className="font-medium whitespace-nowrap text-zinc-900 dark:text-zinc-100 font-mono">
                            {log.timestamp}
                          </TableCell>
                          <TableCell className="font-bold whitespace-nowrap">
                            {log.type === "signup" && <span className="text-indigo-650">🚀 New Signup</span>}
                            {log.type === "ticket" && <span className="text-amber-650">🛠️ Ticket Raised</span>}
                            {log.type === "subscription" && <span className="text-emerald-650">💳 Subscription</span>}
                          </TableCell>
                          <TableCell className="font-semibold whitespace-nowrap">
                            {log.channel === "whatsapp" ? (
                              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 font-mono text-[9px] shadow-none py-0 px-1.5 h-4 border border-emerald-100 uppercase">WhatsApp</Badge>
                            ) : (
                              <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 font-mono text-[9px] shadow-none py-0 px-1.5 h-4 border border-blue-100 uppercase">Email</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-zinc-600 dark:text-zinc-400 font-mono">
                            {log.recipient}
                          </TableCell>
                          <TableCell className="text-zinc-700 dark:text-zinc-300 font-sans max-w-xs truncate" title={log.message}>
                            {log.message}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Badge className={
                              log.success 
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 uppercase text-[9px] font-bold shadow-none' 
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-50 uppercase text-[9px] font-bold shadow-none'
                            }>
                              {log.success ? 'DISPATCHED' : 'FAILED'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Database Handshake diagnostics panel */}
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Active Cloud Ingress & Firestore Handshake Core
                </CardTitle>
                <CardDescription className="text-xs text-zinc-550 dark:text-zinc-450">
                  Audit direct REST pathways to cloud clusters, ping Firestore APIs, and evaluate local latency.
                </CardDescription>
              </div>
              <Badge 
                variant="outline" 
                className={`text-[9.5px] py-0.5 px-2 font-mono shadow-none ${
                  navigator.onLine 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900' 
                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-955/20 dark:text-rose-450 dark:border-rose-900'
                }`}
              >
                <Wifi className="w-3 h-3 mr-1 inline shrink-0" />
                {navigator.onLine ? 'ONLINE' : 'OFFLINE'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            
            <div className="grid sm:grid-cols-2 gap-3 text-xs bg-zinc-100/50 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-150 dark:border-zinc-800">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase font-mono flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Firebase Project ID
                </span>
                <div className="flex items-center gap-1.5 bg-background border border-zinc-200 dark:border-zinc-800 py-1.5 px-2.5 rounded-lg font-mono">
                  <span className="text-[11px] truncate flex-1 block" title={firebaseConfig.projectId}>
                    {firebaseConfig.projectId || 'Not specified'}
                  </span>
                  {firebaseConfig.projectId && (
                    <button
                      type="button"
                      onClick={() => handleCopy(firebaseConfig.projectId || '', 'Project ID')}
                      className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-transform text-zinc-450 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                    >
                      {copiedText === 'Project ID' ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase font-mono flex items-center gap-1">
                  <Key className="w-3 h-3" /> Firestore Active Db ID
                </span>
                <div className="flex items-center gap-1.5 bg-background border border-zinc-200 dark:border-zinc-800 py-1.5 px-2.5 rounded-lg font-mono">
                  <span className="text-[11px] truncate flex-1 block">
                    {firebaseConfig.firestoreDatabaseId || '(default)'}
                  </span>
                  {firebaseConfig.firestoreDatabaseId && (
                    <button
                      type="button"
                      onClick={() => handleCopy(firebaseConfig.firestoreDatabaseId || '', 'Database ID')}
                      className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-455 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                    >
                      {copiedText === 'Database ID' ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                disabled={diagRunning}
                onClick={runDiagnostics}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 font-semibold text-xs h-9"
              >
                <Activity className={`w-4 h-4 mr-1.5 ${diagRunning ? 'animate-spin' : ''}`} />
                {diagRunning ? 'Running core sandbox handshake audit...' : 'Run REST Handshake & Cluster Connection Audit'}
              </Button>
              {diagLogs.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setDiagLogs([]); setDiagStatus('idle'); }}
                  className="font-medium text-xs border-zinc-200 h-9"
                >
                  Clear log
                </Button>
              )}
            </div>

            {diagLogs.length > 0 && (
              <div className="rounded-xl border border-zinc-150 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="bg-zinc-100 dark:bg-zinc-900 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-400 block" />
                    <span className="w-3 h-3 rounded-full bg-amber-400 block" />
                    <span className="w-3 h-3 rounded-full bg-green-400 block" />
                    <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 ml-2">sandbox_audit.sh</span>
                  </div>
                  {diagStatus !== 'idle' && diagStatus !== 'running' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] uppercase font-bold text-zinc-400">Diagnosis:</span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        diagStatus === 'success' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        diagStatus === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30' :
                        'bg-rose-100 text-rose-850'
                      }`}>
                        {diagStatus.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-zinc-950 p-4 max-h-[350px] overflow-y-auto font-mono text-[11px] space-y-1.5">
                  {diagLogs.map((log, idx) => (
                    <div 
                      key={idx} 
                      className={`leading-relaxed whitespace-pre-wrap ${
                        log.type === 'error' ? 'text-rose-400 font-semibold' :
                        log.type === 'warn' ? 'text-amber-400' :
                        log.type === 'success' ? 'text-emerald-400 font-semibold' :
                        'text-zinc-400'
                      }`}
                    >
                      <span className="text-zinc-650 inline-block mr-2 select-none">[{log.timestamp}]</span>
                      {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informational Licensing & Marketing Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Zimbabwe Paynow Checkout Webhooks</CardTitle>
              <CardDescription className="text-xs">Expose local endpoints to secure instant billing activations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              <p>
                To connect EcoCash or card transactions dynamically, configure an automated trigger function to capture Paynow status updates.
              </p>
              <pre className="bg-zinc-950 p-3.5 rounded-xl text-[10.5px] text-emerald-400 overflow-x-auto font-mono">
{`// Cloud trigger callback 
export async function paynowCallback(req, res) {
  const { Reference, Status } = req.body;
  if (Status === 'Paid') {
    await db.collection('businesses')
      .doc(Reference)
      .update({ subscription_status: 'ACTIVE' });
  }
  return res.status(200).send('OK');
}`}
              </pre>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Platform Edge Gateway Settings</CardTitle>
              <CardDescription className="text-xs">Secure sandbox origin parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-zinc-550 leading-relaxed dark:text-zinc-450">
                Ensure that firewalls allow direct access to Google services. Copy the current origin to add to Google Cloud parameters under "Authorized Origins":
              </p>
              <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-xl">
                <span className="font-mono text-[10px] text-zinc-650 dark:text-zinc-300 select-all truncate flex-1 block">
                  {window.location.origin}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(window.location.origin, 'Origin Domain')}
                  className="h-7 text-[10.5px] font-sans"
                >
                  Copy Origin
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visual Brand Assets Hub */}
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <MarketingAssets />
        </div>

      </div>
    </div>
  );
}
