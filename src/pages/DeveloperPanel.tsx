import React, { useState, useEffect } from 'react';
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
  Server
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { ThemeToggle } from '../components/ThemeToggle';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

const supabaseConfig = { storageBucket: 'tareza-backups' };

export default function DeveloperPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Database backups states
  const [backupLogs, setBackupLogs] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [triggeringBackup, setTriggeringBackup] = useState(false);

  // Supabase Diagnostics state
  const [diagLogs, setDiagLogs] = useState<{ timestamp: string; type: 'info' | 'success' | 'warn' | 'error'; message: string }[]>([]);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagStatus, setDiagStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [revealKey, setRevealKey] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

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
    pushLog('info', '🚀 Starting Supabase Network Connection Diagnostics...');
    pushLog('info', `Current local time: ${new Date().toISOString()}`);
    pushLog('info', `Local Network Online Status (navigator.onLine): ${navigator.onLine ? 'ONLINE' : 'OFFLINE'}`);
    pushLog('info', '================================================');

    if (!navigator.onLine) {
      pushLog('error', '❌ Browser reports OFFLINE. Active network interfaces might be disabled.');
    } else {
      pushLog('success', '✅ Wi-Fi / Local Network is active and reporting online status.');
    }

    pushLog('info', '🔍 Step 1: Loading Supabase configuration keys from environment...');
    const currentUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const currentKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    pushLog('info', `VITE_SUPABASE_URL: "${currentUrl || 'NOT DEFINED'}"`);
    pushLog('info', `VITE_SUPABASE_ANON_KEY: "${currentKey ? (currentKey.substring(0, 8) + '...' + currentKey.substring(currentKey.length - 8)) : 'NOT DEFINED'}"`);

    let isValid = true;
    if (!currentUrl || currentUrl.includes('your-supabase-project') || currentUrl.includes('your-supabase-url')) {
      pushLog('error', '❌ Supabase URL matches the default placeholder or is empty. Please set a valid your-project.supabase.co domain.');
      isValid = false;
    } else if (!currentUrl.startsWith('https://')) {
      pushLog('warn', '⚠️ VITE_SUPABASE_URL should enter with secure "https://" protocol prefix.');
      isValid = false;
    } else {
      pushLog('success', '✅ Connection URL prefix syntax is valid.');
    }

    if (!currentKey || currentKey === 'your-anon-key' || currentKey === 'your-anon-key-here') {
      pushLog('error', '❌ Supabase Anon Key is empty or matches default placeholder value.');
      isValid = false;
    } else if (currentKey.length < 30) {
      pushLog('warn', '⚠️ Supabase Anon Key appears shorter than typical JWT key configurations.');
      isValid = false;
    } else {
      pushLog('success', '✅ Anonymous API payload key was detected.');
    }

    if (!isValid) {
      pushLog('error', '❌ Pre-flight checks failed. Aborting API queries due to configuration mismatch.');
      setDiagStatus('warning');
      setDiagRunning(false);
      return;
    }

    pushLog('info', '📡 Step 2: Testing host routing / raw IP ping with timed-out trigger...');
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 6000);
    const apiPingUrl = `${currentUrl}/rest/v1/?apikey=${currentKey}`;
    const startTime = performance.now();

    try {
      pushLog('info', `Sending HTTP GET request to remote target: ${currentUrl}/rest/v1/`);
      const response = await fetch(apiPingUrl, {
        method: 'GET',
        signal: abortController.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeout);
      const delay = Math.round(performance.now() - startTime);
      pushLog('info', `HTTP Response status: ${response.status} ${response.statusText}`);
      pushLog('info', `Direct API ping completed within ${delay}ms.`);

      if (response.status === 200 || response.status === 204 || response.status === 401) {
        pushLog('success', `✅ Direct REST entrypoint is reachable. Connection delay: ${delay}ms.`);
        if (response.status === 401) {
          pushLog('warn', '⚠️ HTTP 401 Unauthorized: Target is reachable, but token payload is rejected. Verify VITE_SUPABASE_ANON_KEY.');
        }
      } else {
        pushLog('warn', `⚠️ Target responded with unexpected HTTP ${response.status}.`);
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const delay = Math.round(performance.now() - startTime);

      if (err.name === 'AbortError') {
        pushLog('error', `❌ TIMEOUT ERROR (net::ERR_CONNECTION_TIMED_OUT) occurred after ${delay}ms!`);
        pushLog('error', '👉 CAUSE A: Your Supabase DB Project is Paused or Stopped. Visit the Supabase Dashboard to unpause it.');
        pushLog('error', '👉 CAUSE B: Corporate firewalls or internet service provider restrictions are blocking port 443 routes.');
        pushLog('error', '👉 CAUSE C: Severe typo in VITE_SUPABASE_URL causing a routing blackhole.');
      } else {
        pushLog('error', `❌ Connection failure: ${err.message || String(err)}`);
        pushLog('error', '👉 CAUSE A: CORS limitation. Browser blocked the preflight request.');
        pushLog('error', '👉 CORS Fix: Open the Supabase Dashboard -> Settings -> API, find "Allowed Web Origins", and add:');
        pushLog('error', `   • ${window.location.origin}`);
        pushLog('error', '👉 CAUSE B: Bad SSL/TLS handshake or DNS lookup refusal.');
      }
    }

    pushLog('info', '🛰️ Step 3: Verifying relational query parsing through Client wrapper...');
    const dbQueryStart = performance.now();
    try {
      const { data, error } = await supabase.from('businesses').select('*').limit(1);
      const dbQueryDelay = Math.round(performance.now() - dbQueryStart);

      if (error) {
        pushLog('error', `❌ Client select query failed after ${dbQueryDelay}ms: ${error.message} (Code: ${error.code || 'None'})`);
        if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
          pushLog('error', '👉 The error is "Failed to fetch". This points directly to either CORS Blocking or DNS failures inside your browser.');
        }
      } else {
        pushLog('success', `✅ Database query successful! Selected 1 row from "businesses" table in ${dbQueryDelay}ms.`);
        pushLog('info', `Rows fetched payload context: ${data ? JSON.stringify(data.length) : '0'}`);
      }
    } catch (err: any) {
      const dbQueryDelay = Math.round(performance.now() - dbQueryStart);
      pushLog('error', `❌ Exception thrown during client query run after ${dbQueryDelay}ms: ${err.message || String(err)}`);
    }

    pushLog('info', '================================================');
    pushLog('info', '🏆 Connection Diagnostics completed.');
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@tarezaerp.co.zw' && password === 'taps1302??') {
      setIsAuthenticated(true);
      fetchBusinesses();
      fetchBackupLogs();
    } else {
      toast.error("Invalid credentials.");
    }
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

  const fetchBusinesses = async () => {
    setLoading(true);
    try {
      // Need to fetch all businesses for dev. 
      // This bypasses RLS if using service role, but since it's client side, we need standard fetch.
      // If RLS prevents it, this might return empty. I will add a fallback mock if it fails.
      const { data, error } = await supabase.from('businesses').select('*');
      if (error) {
        throw error;
      }
      setBusinesses(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load businesses. RLS might be blocking or network error.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSubscription = async (businessId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'past_due' : 'active';
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: newStatus })
        .eq('business_id', businessId);
      
      if (error) throw error;

      toast.success(`Subscription status updated. Note: you may need to reload the page to see changes depending on your view.`);
    } catch (err: any) {
      toast.error(`Failed to update account: ${err.message}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        {/* Navigation bar on unauthenticated layout to change theme */}
        <nav className="w-full border-b bg-background px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-base font-bold">Tareza Developer Portal</span>
          </div>
          <ThemeToggle />
        </nav>

        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="max-w-6xl w-full grid lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Sign In Form */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="shadow-lg border-zinc-250 dark:border-zinc-800">
                <CardHeader className="text-center space-y-2">
                  <div className="mx-auto bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Developer Sign In</CardTitle>
                  <CardDescription>Enter admin credentials to authenticate the session</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-400">Username</label>
                      <Input 
                         type="email" 
                         value={email} 
                         onChange={e => setEmail(e.target.value)} 
                         placeholder="admin@tarezaerp.co.zw" 
                         required
                         className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-400">Password</label>
                      <Input 
                         type="password" 
                         value={password} 
                         onChange={e => setPassword(e.target.value)} 
                         required
                         className="h-10"
                      />
                    </div>
                    <Button type="submit" className="w-full h-10 mt-2 font-medium">
                      Authenticate Panel
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 text-xs text-zinc-500 leading-relaxed text-center">
                Need developer console access? Live network testing and CORS preflight triggers are available on the right to assist with staging connection configurations.
              </div>
            </div>

            {/* Right Column: Connection Diagnostics Terminal */}
            <div className="lg:col-span-7">
              <Card className="shadow-lg border-zinc-200 dark:border-zinc-800">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        Supabase Technical Connection Diagnostics
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-500 dark:text-zinc-450">
                        Resolve DNS timeouts, ERR_CONNECTION_TIMED_OUT errors, and preflight browser limitations.
                      </CardDescription>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] py-0.5 px-2 font-mono ${
                        navigator.onLine 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900' 
                          : 'bg-rose-50 text-rose-700 border-rose-220 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900'
                      }`}
                    >
                      <Wifi className="w-3 h-3 mr-1 inline" />
                      {navigator.onLine ? 'ONLINE' : 'OFFLINE'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Grid showing ENV variables current resolution */}
                  <div className="grid sm:grid-cols-2 gap-3 text-xs bg-zinc-100/55 dark:bg-zinc-900/55 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/80">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase font-mono flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Configured URL
                      </span>
                      <div className="flex items-center gap-1.5 bg-background border border-zinc-200 dark:border-zinc-800 py-1.5 px-2.5 rounded-lg">
                        <span className="font-mono text-[11px] truncate flex-1 block" title={import.meta.env.VITE_SUPABASE_URL}>
                          {import.meta.env.VITE_SUPABASE_URL || 'Not specified'}
                        </span>
                        {import.meta.env.VITE_SUPABASE_URL && (
                          <button
                            type="button"
                            onClick={() => handleCopy(import.meta.env.VITE_SUPABASE_URL || '', 'URL')}
                            className="p-1 hover:bg-zinc-105 dark:hover:bg-zinc-800 rounded transition-transform text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                          >
                            {copiedText === 'URL' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase font-mono flex items-center gap-1">
                        <Key className="w-3 h-3" /> Configured ANON KEY
                      </span>
                      <div className="flex items-center gap-1.5 bg-background border border-zinc-200 dark:border-zinc-800 py-1.5 px-2.5 rounded-lg">
                        <span className="font-mono text-[11px] truncate flex-1 block">
                          {revealKey 
                            ? (import.meta.env.VITE_SUPABASE_ANON_KEY || 'Not specified') 
                            : '••••••••••••••••••••••••••••••••'
                          }
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setRevealKey(!revealKey)}
                            className="p-1 hover:bg-zinc-105 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                          >
                            {revealKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          {import.meta.env.VITE_SUPABASE_ANON_KEY && (
                            <button
                              type="button"
                              onClick={() => handleCopy(import.meta.env.VITE_SUPABASE_ANON_KEY || '', 'Anon Key')}
                              className="p-1 hover:bg-zinc-105 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                            >
                              {copiedText === 'Anon Key' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trigger diagnostics button */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      disabled={diagRunning}
                      onClick={runDiagnostics}
                      className="flex-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-semibold"
                    >
                      <Activity className={`w-4 h-4 mr-2 ${diagRunning ? 'animate-spin' : ''}`} />
                      {diagRunning ? 'Testing connections & latency...' : 'Run Comprehensive Connection Ping & Health Check'}
                    </Button>
                    {diagLogs.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { setDiagLogs([]); setDiagStatus('idle'); }}
                        className="font-medium text-xs border-zinc-200"
                      >
                        Clear console
                      </Button>
                    )}
                  </div>

                  {/* Diagnostics Console terminal view */}
                  {diagLogs.length > 0 && (
                    <div className="rounded-xl border border-zinc-205 dark:border-zinc-800 overflow-hidden shadow-sm">
                      {/* Terminal Header */}
                      <div className="bg-zinc-100 dark:bg-zinc-905 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-red-400 block" />
                          <span className="w-3 h-3 rounded-full bg-amber-400 block" />
                          <span className="w-3 h-3 rounded-full bg-green-400 block" />
                          <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 ml-2">diagnostic_report.sh</span>
                        </div>
                        {diagStatus !== 'idle' && diagStatus !== 'running' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-bold font-mono tracking-wide text-zinc-450">Status:</span>
                            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded leading-none ${
                              diagStatus === 'success' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-400' :
                              diagStatus === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/35 dark:text-amber-400' :
                              'bg-rose-100 text-rose-800 dark:bg-rose-950/35 dark:text-rose-450'
                            }`}>
                              {diagStatus.toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Monospace Code output */}
                      <div className="bg-zinc-950 p-4 max-h-72 overflow-y-auto font-mono text-xs space-y-1.5">
                        {diagLogs.map((log, idx) => (
                          <div 
                            key={idx} 
                            className={`leading-relaxed whitespace-pre-wrap ${
                              log.type === 'error' ? 'text-red-450 font-semibold' :
                              log.type === 'warn' ? 'text-amber-300 font-semibold' :
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

                  {/* Informative troubleshooting guide depending on connection problems */}
                  <div className="p-4 rounded-xl bg-indigo-55/50 dark:bg-indigo-950/15 border border-indigo-100 dark:border-indigo-900/40 text-xs space-y-2">
                    <h5 className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-200">
                      <AlertTriangle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Troubleshooting TIMED_OUT (CORS / Network) guides:
                    </h5>
                    <ul className="list-disc pl-4 space-y-1 ml-1 leading-normal text-zinc-600 dark:text-zinc-350">
                      <li>
                        <strong>Verify Project Pause Status</strong>: If you haven't accessed your database for over a week, Supabase may automatically pause your project container. Visit your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-indigo-600 dark:text-indigo-450 hover:opacity-85">Supabase Dashboard</a> and hit "Restore Project".
                      </li>
                      <li>
                        <strong>Configure CORS Origins</strong>: Supabase requires all domains to be explicitly registered to secure REST and Auth connections from clients. Copy your launcher hostname below and add it to "Settings -&gt; API -&gt; Allowed Web Origins" in the Supabase Portal:
                      </li>
                    </ul>
                    <div className="flex items-center gap-2 mt-2 bg-indigo-100/60 dark:bg-indigo-950/45 border border-indigo-250 dark:border-indigo-900 py-1 px-2.5 rounded-lg">
                      <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-300 select-all truncate flex-1 block">
                        {window.location.origin}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(window.location.origin, 'Origin Domain')}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-indigo-900 rounded font-semibold text-indigo-650"
                      >
                        Copy Origin
                      </button>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-foreground flex flex-col">
      <nav className="w-full border-b bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold">Tareza Developer Panel</span>
        </div>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <Button variant="ghost" onClick={() => setIsAuthenticated(false)}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Accounts & Subscriptions</CardTitle>
              <CardDescription>Manage active tenants, activate or deactivate accounts.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-4 text-center text-sm text-zinc-500">Loading accounts...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {businesses.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-zinc-500 py-4">No businesses found or missing RLS bypass.</TableCell>
                        </TableRow>
                      )}
                      {businesses.map(b => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.name}</TableCell>
                          <TableCell>
                            <Badge variant="default" className="text-xs uppercase">
                              CHECK SUB. TABLE
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => toggleSubscription(b.id, 'active')}
                            >
                              Toggle
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Support Queries</CardTitle>
              <CardDescription>Customer tickets and inquiries</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4">
                  {/* Mock Data for support queries as requested by "design where I answer querries" */}
                  {[
                    { id: 1, user: 'Acme Retail', subject: 'Fiscalisation Not Reaching Zimra', status: 'Pending', time: '10m ago' },
                    { id: 2, user: 'John Doe', subject: 'How to add a new branch?', status: 'Resolved', time: '2h ago' },
                  ].map(ticket => (
                    <div key={ticket.id} className="p-4 rounded-xl border border-border bg-card flex flex-col gap-2">
                       <div className="flex justify-between items-start">
                         <div className="space-y-1">
                           <h4 className="font-semibold text-sm">{ticket.subject}</h4>
                           <p className="text-xs text-muted-foreground">From: {ticket.user} • {ticket.time}</p>
                         </div>
                         <Badge variant={ticket.status === 'Pending' ? 'destructive' : 'secondary'} className="text-[10px] uppercase">
                            {ticket.status}
                         </Badge>
                       </div>
                       {ticket.status === 'Pending' && (
                         <div className="flex gap-2 mt-2">
                            <Input placeholder="Type your response..." className="h-8 text-sm" />
                            <Button size="sm" className="h-8">Reply</Button>
                         </div>
                       )}
                    </div>
                  ))}
               </div>
            </CardContent>
          </Card>

          {/* Automated System Backup Panel */}
          <Card className="md:col-span-2 font-sans bg-white dark:bg-zinc-900 border-zinc-200">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-500 animate-pulse" />
                  Ledger Database Backups
                </CardTitle>
                <CardDescription className="text-zinc-500 text-xs">
                  Automated daily JSON backups of Chart of Accounts, Journal Entries, Journal Lines, register sessions, and corporate Audit Logs.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={fetchBackupLogs}
                  disabled={backupLoading}
                  className="text-xs h-9 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${backupLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button 
                  size="sm"
                  onClick={handleTriggerBackup}
                  disabled={triggeringBackup}
                  className="text-xs h-9 bg-zinc-900 text-white hover:bg-zinc-805 border-zinc-950 cursor-pointer"
                >
                  <DownloadCloud className="w-3.5 h-3.5 mr-1.5" />
                  {triggeringBackup ? 'Backing up...' : 'Trigger Manual Backup'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="mb-6 p-4 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">Scheduled Backup Status: Active</h4>
                  <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                    The background cron-scheduler is registered and actively triggers daily at <strong>01:00 UTC</strong>. Files are persisted to your secure cloud storage bucket: <code>supabase://{supabaseConfig.storageBucket}/backups/</code> with a 30-day auto-retention policy.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
                  Backup Execution History Log
                </h4>
                
                {backupLoading && backupLogs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-505" />
                    Fetching system catalog...
                  </div>
                ) : backupLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/30 font-sans">
                    No historical backups logged yet. Click "Trigger Manual Backup" above to run your baseline snapshot.
                  </div>
                ) : (
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden font-sans">
                    <Table>
                      <TableHeader className="bg-zinc-50/50 dark:bg-zinc-800/20">
                        <TableRow>
                          <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Execution Date (UTC)</TableHead>
                          <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Filename / Storage Object</TableHead>
                          <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Scope Summary</TableHead>
                          <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300">File Size</TableHead>
                          <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300 text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {backupLogs.map((log) => (
                          <TableRow key={log.id}>
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
                                  <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">jes: {log.journal_entries_count ?? 0}</span>
                                  <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">jls: {log.journal_lines_count ?? 0}</span>
                                  <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">shifts: {log.register_sessions_count ?? 0}</span>
                                </span>
                              ) : (
                                <span className="text-rose-600 font-mono text-[10px] truncate max-w-[200px]" title={log.error}>
                                  Err: {log.error || 'Direct Exception'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-zinc-650 dark:text-zinc-350 font-mono whitespace-nowrap">
                              {log.size_bytes ? `${(log.size_bytes / 1024).toFixed(2)} KB` : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Badge 
                                variant="default"
                                className={
                                  log.status === 'SUCCESS' 
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-900/40 uppercase text-[10px] font-bold shadow-none' 
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-450 hover:bg-rose-50 border border-rose-250 dark:border-rose-900/40 uppercase text-[10px] font-bold shadow-none'
                                }
                              >
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

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Licensing & Billing Setup</CardTitle>
              <CardDescription>Setup live licensing and payment webhooks</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-300">
                  <p>
                    Tareza ERP is currently using manual billing checks (checking the `subscription_status` field on the `businesses` table). To automate live licensing, you need to configure a webhook.
                  </p>
                  
                  <div className="p-4 border border-border rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                     <h4 className="font-bold text-zinc-900 dark:text-zinc-50 mb-2">1. Choose a Payment Gateway</h4>
                     <ul className="list-disc pl-5 space-y-1 mb-4">
                       <li><strong>Paynow / EcoCash</strong> - Best for local Zimbabwe RTGS/USD payments.</li>
                       <li><strong>Stripe</strong> - Best for international cards processing.</li>
                       <li><strong>Paystack</strong> - Good alternative for Africa-wide processing.</li>
                     </ul>
                     
                     <h4 className="font-bold text-zinc-900 dark:text-zinc-50 mb-2">2. Implement Webhook Endpoint</h4>
                     <p className="mb-2">
                       Set up a serverless function (e.g., using Supabase Edge Functions) to map payment events back to the database:
                     </p>
                     <pre className="bg-zinc-950 p-3 rounded-md text-xs text-green-400 overflow-x-auto">
{`// Supabase Edge Function to handle Paynow/Stripe Webhook
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

Deno.serve(async (req) => {
  const { business_id, status } = await req.json()
  
  if (status === 'PAID') {
    await supabase.from('businesses')
      .update({ subscription_status: 'ACTIVE' })
      .eq('id', business_id)
  }
  return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })
})`}
                     </pre>
                  </div>
                  
                  <div className="p-4 border border-border rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20">
                     <h4 className="font-bold flex items-center gap-2 mb-2 text-indigo-900 dark:text-indigo-400">
                       <AlertCircle className="w-4 h-4" /> Next Steps to go Live
                     </h4>
                     <ol className="list-decimal pl-5 space-y-1">
                       <li>Create a Firebase Cloud Function for webhooks.</li>
                       <li>Provide the Edge function URL to your Paynow/Stripe dashboard.</li>
                       <li>Integrate the "Checkout" button on the billing page to redirect to the gateway.</li>
                     </ol>
                  </div>
               </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    Supabase Technical Connection Diagnostics
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-550 dark:text-zinc-450">
                    Resolve DNS timeouts, ERR_CONNECTION_TIMED_OUT errors, and preflight browser limitations.
                  </CardDescription>
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] py-0.5 px-2 font-mono ${
                    navigator.onLine 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900' 
                      : 'bg-rose-50 text-rose-700 border-rose-220 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900'
                  }`}
                >
                  <Wifi className="w-3 h-3 mr-1 inline" />
                  {navigator.onLine ? 'ONLINE' : 'OFFLINE'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Grid showing ENV variables current resolution */}
              <div className="grid sm:grid-cols-2 gap-3 text-xs bg-zinc-100/55 dark:bg-zinc-900/55 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/80">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase font-mono flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Configured URL
                  </span>
                  <div className="flex items-center gap-1.5 bg-background border border-zinc-200 dark:border-zinc-800 py-1.5 px-2.5 rounded-lg">
                    <span className="font-mono text-[11px] truncate flex-1 block" title={import.meta.env.VITE_SUPABASE_URL}>
                      {import.meta.env.VITE_SUPABASE_URL || 'Not specified'}
                    </span>
                    {import.meta.env.VITE_SUPABASE_URL && (
                      <button
                        type="button"
                        onClick={() => handleCopy(import.meta.env.VITE_SUPABASE_URL || '', 'URL')}
                        className="p-1 hover:bg-zinc-105 dark:hover:bg-zinc-800 rounded transition-transform text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                      >
                        {copiedText === 'URL' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase font-mono flex items-center gap-1">
                    <Key className="w-3 h-3" /> Configured ANON KEY
                  </span>
                  <div className="flex items-center gap-1.5 bg-background border border-zinc-200 dark:border-zinc-800 py-1.5 px-2.5 rounded-lg">
                    <span className="font-mono text-[11px] truncate flex-1 block">
                      {revealKey 
                        ? (import.meta.env.VITE_SUPABASE_ANON_KEY || 'Not specified') 
                        : '••••••••••••••••••••••••••••••••'
                      }
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setRevealKey(!revealKey)}
                        className="p-1 hover:bg-zinc-105 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                      >
                        {revealKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      {import.meta.env.VITE_SUPABASE_ANON_KEY && (
                        <button
                          type="button"
                          onClick={() => handleCopy(import.meta.env.VITE_SUPABASE_ANON_KEY || '', 'Anon Key')}
                          className="p-1 hover:bg-zinc-105 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                        >
                          {copiedText === 'Anon Key' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Trigger diagnostics button */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={diagRunning}
                  onClick={runDiagnostics}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-805 dark:bg-zinc-100 dark:text-zinc-905 dark:hover:bg-zinc-200 font-semibold"
                >
                  <Activity className={`w-4 h-4 mr-2 ${diagRunning ? 'animate-spin' : ''}`} />
                  {diagRunning ? 'Testing connections & latency...' : 'Run Comprehensive Connection Ping & Health Check'}
                </Button>
                {diagLogs.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setDiagLogs([]); setDiagStatus('idle'); }}
                    className="font-medium text-xs border-zinc-200"
                  >
                    Clear console
                  </Button>
                )}
              </div>

              {/* Diagnostics Console terminal view */}
              {diagLogs.length > 0 && (
                <div className="rounded-xl border border-zinc-205 dark:border-zinc-800 overflow-hidden shadow-sm">
                  {/* Terminal Header */}
                  <div className="bg-zinc-100 dark:bg-zinc-905 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400 block" />
                      <span className="w-3 h-3 rounded-full bg-amber-400 block" />
                      <span className="w-3 h-3 rounded-full bg-green-400 block" />
                      <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 ml-2">diagnostic_report.sh</span>
                    </div>
                    {diagStatus !== 'idle' && diagStatus !== 'running' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold font-mono tracking-wide text-zinc-455">Status:</span>
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded leading-none ${
                          diagStatus === 'success' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-400' :
                          diagStatus === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/35 dark:text-amber-400' :
                          'bg-rose-100 text-rose-800 dark:bg-rose-950/35 dark:text-rose-450'
                        }`}>
                          {diagStatus.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Monospace Code output */}
                  <div className="bg-zinc-950 p-4 max-h-72 overflow-y-auto font-mono text-xs space-y-1.5">
                    {diagLogs.map((log, idx) => (
                      <div 
                        key={idx} 
                        className={`leading-relaxed whitespace-pre-wrap ${
                          log.type === 'error' ? 'text-red-450 font-semibold' :
                          log.type === 'warn' ? 'text-amber-305 font-semibold' :
                          log.type === 'success' ? 'text-emerald-400 font-semibold' :
                          'text-zinc-450'
                        }`}
                      >
                        <span className="text-zinc-650 inline-block mr-2 select-none">[{log.timestamp}]</span>
                        {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Informative troubleshooting guide depending on connection problems */}
              <div className="p-4 rounded-xl bg-indigo-55/50 dark:bg-indigo-950/15 border border-indigo-150 dark:border-indigo-900/45 text-xs space-y-2">
                <h5 className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-200">
                  <AlertTriangle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Troubleshooting TIMED_OUT (CORS / Network) guides:
                </h5>
                <ul className="list-disc pl-4 space-y-1 ml-1 leading-normal text-zinc-650 dark:text-zinc-350">
                  <li>
                    <strong>Verify Project Pause Status</strong>: If you haven't accessed your database for over a week, Supabase may automatically pause your project container. Visit your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-indigo-650 dark:text-indigo-420 hover:opacity-85">Supabase Dashboard</a> and hit "Restore Project".
                  </li>
                  <li>
                    <strong>Configure CORS Origins</strong>: Supabase requires all domains to be explicitly registered to secure REST and Auth connections from clients. Copy your launcher hostname below and add it to "Settings -&gt; API -&gt; Allowed Web Origins" in the Supabase Portal:
                  </li>
                </ul>
                <div className="flex items-center gap-2 mt-2 bg-indigo-100/60 dark:bg-indigo-950/45 border border-indigo-250 dark:border-indigo-900 py-1 px-2.5 rounded-lg">
                  <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-300 select-all truncate flex-1 block">
                    {window.location.origin}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(window.location.origin, 'Origin Domain')}
                    className="p-1 hover:bg-zinc-200 dark:hover:bg-indigo-900 rounded font-semibold text-indigo-650"
                  >
                    Copy Origin
                  </button>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
