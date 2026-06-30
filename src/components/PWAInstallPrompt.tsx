import React, { useState, useEffect } from 'react';
import { 
  MonitorSmartphone, 
  Share, 
  PlusSquare, 
  Download, 
  X, 
  Check, 
  Copy,
  Smartphone,
  Laptop,
  Chrome,
  Compass,
  ArrowRight,
  Wifi,
  WifiOff,
  Zap,
  Shield,
  Activity,
  AppWindow,
  Info
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAlreadyStandalone, setIsAlreadyStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Diagnostic capabilities states
  const [swStatus, setSwStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
  const [dbStatus, setDbStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  // Platform and browser analysis
  const [activeTab, setActiveTab] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [detectedPlatform, setDetectedPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (desktop app or mobile home screen launch)
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    
    setIsAlreadyStandalone(isStandaloneMode);

    // Track online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Detect Service Worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setSwStatus('active'))
        .catch(() => setSwStatus('inactive'));
    } else {
      setSwStatus('inactive');
    }

    // Detect IndexedDB readiness for offline capability
    try {
      const request = indexedDB.open('tareza-offline-db-check', 1);
      request.onsuccess = () => {
        setDbStatus('ready');
        indexedDB.deleteDatabase('tareza-offline-db-check');
      };
      request.onerror = () => setDbStatus('error');
    } catch {
      setDbStatus('error');
    }

    // Detect platform
    const ua = navigator.userAgent;
    const isIosDevice = /iPhone|iPad|iPod/i.test(ua);
    const isAndroidDevice = /Android/i.test(ua);
    
    let currentPlatform: 'ios' | 'android' | 'desktop' = 'desktop';
    if (isIosDevice) {
      currentPlatform = 'ios';
    } else if (isAndroidDevice) {
      currentPlatform = 'android';
    }
    setDetectedPlatform(currentPlatform);
    setActiveTab(currentPlatform); // Set default active tab based on detection

    // Detect browser
    const hasSafari = /^((?!chrome|android).)*safari/i.test(ua);
    setIsSafari(hasSafari);

    // Capture standard PWA installation prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      
      // Auto-notify with small helpful hint if not already installed
      if (!isStandaloneMode) {
        const hasSeenHint = localStorage.getItem('tareza_pwa_hint_dismissed');
        if (!hasSeenHint) {
          toast('Offline-Capable Desktop / Mobile App Available', {
            description: 'Install Tareza ERP as a standalone app to enjoy seamless offline POS, lightning-fast loads, and an immersive distraction-free workspace.',
            action: {
              label: 'Setup App',
              onClick: () => setIsOpen(true)
            },
            duration: 9000
          });
        }
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detect successful installation
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsAlreadyStandalone(true);
      toast.success('Outstanding! Tareza ERP has been installed. Launch it anytime from your application list!');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerDirectInstall = async () => {
    if (!deferredPrompt) return;
    
    setIsOpen(false);
    deferredPrompt.prompt();
    
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    } else {
      setDeferredPrompt(deferredPrompt);
    }
  };

  const copyUrlToClipboard = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    toast.success('ERP address copied! Open this link in Safari on iOS or Chrome on Android.');
    setTimeout(() => setCopied(false), 2000);
  };

  const ignorePwaHint = () => {
    localStorage.setItem('tareza_pwa_hint_dismissed', 'true');
    setIsOpen(false);
  };

  // If already standalone, we don't display the prompt
  if (isAlreadyStandalone) {
    return null;
  }

  return (
    <>
      <Button 
        id="pwa-install-shortcut-btn"
        onClick={() => setIsOpen(true)}
        variant="ghost" 
        size="sm"
        className="relative items-center gap-1.5 px-3.5 py-1.5 h-9 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-500/20 font-bold text-xs select-none hover:bg-indigo-100 dark:hover:bg-indigo-500/20 active:scale-95 transition-all text-center shrink-0 cursor-pointer shadow-sm hidden xs:inline-flex"
        title="Install Tareza ERP App Shortcut"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
        <MonitorSmartphone className="h-3.5 w-3.5" />
        <span>Install App</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[540px] rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-0 shadow-2xl overflow-hidden scrollbar-none">
          
          {/* Header Hero Section */}
          <div className="bg-gradient-to-br from-indigo-900 via-zinc-950 to-black p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -mr-12 -mt-12" />
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl -ml-12 -mb-12" />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                  <MonitorSmartphone className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-extrabold px-2 py-0.5 rounded-full border border-indigo-500/30 tracking-wider uppercase">PWA Container</span>
                  <DialogTitle className="text-lg font-black text-white mt-0.5 leading-tight">
                    Tareza ERP Workspace Shell
                  </DialogTitle>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors h-7 w-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-xs text-zinc-350 mt-3 leading-relaxed relative z-10 max-w-md">
              Upgrade your current browser tab into a separate, lightweight standalone application. Launch instantly with secure offline database capability, 2x faster page loads, and zero browser border clutter.
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* Real-time Capability Diagnostics */}
            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-805 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-zinc-400 flex items-center gap-1.5 font-mono">
                  <Activity className="h-3.5 w-3.5 text-zinc-400" />
                  System Capability Check
                </span>
                <span className="text-[10px] font-semibold text-zinc-500">Auto-detected</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                {/* Network status */}
                <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 p-2 rounded-xl">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    {isOnline ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-rose-500" />}
                    Network
                  </span>
                  <span className={`font-bold ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                {/* Offline DB */}
                <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 p-2 rounded-xl">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-indigo-500" />
                    Local DB
                  </span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {dbStatus === 'ready' ? 'SECURE' : dbStatus === 'checking' ? 'PENDING' : 'ERROR'}
                  </span>
                </div>

                {/* Service worker caching */}
                <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 p-2 rounded-xl">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    Cache status
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {swStatus === 'active' ? 'CACHED' : swStatus === 'checking' ? 'SYNCING' : 'INACTIVE'}
                  </span>
                </div>

                {/* Display mode */}
                <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 p-2 rounded-xl">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <AppWindow className="h-3.5 w-3.5 text-blue-500" />
                    App Shell
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-500">
                    TABBED
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Instant Action if Chromium supports automated prompts */}
            {isInstallable && deferredPrompt && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 text-center space-y-3"
              >
                <div className="space-y-1">
                  <h4 className="font-extrabold text-emerald-800 dark:text-emerald-400 text-sm">Automated Native Installer Detected!</h4>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Your browser supports direct background application mounting. Click below to install immediately without tedious manual configurations.</p>
                </div>
                <Button 
                  onClick={triggerDirectInstall}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl cursor-pointer shadow-md inline-flex items-center justify-center gap-2 text-xs"
                >
                  <Download className="h-4 w-4" /> Install stand-alone app now
                </Button>
              </motion.div>
            )}

            {/* Setup Guidance Tabs with platform switching */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-sans">
                  Installation Guides
                </span>
                {detectedPlatform !== 'desktop' && (
                  <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-bold">
                    Detected: {detectedPlatform.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Interactive Tabs Headers */}
              <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-2xl border border-zinc-200/50 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('desktop')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${activeTab === 'desktop' ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/30' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  <Laptop className="h-3.5 w-3.5" />
                  <span>PC & Mac</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ios')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${activeTab === 'ios' ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/30' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  <Smartphone className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Apple iOS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('android')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${activeTab === 'android' ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/30' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  <Smartphone className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Android</span>
                </button>
              </div>

              {/* Guide Contents */}
              <div className="min-h-[160px] bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-105 dark:border-zinc-800 p-4 relative overflow-hidden">
                <AnimatePresence mode="wait">
                  {activeTab === 'ios' && (
                    <motion.div 
                      key="ios"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-3.5 text-zinc-650 dark:text-zinc-350 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px] font-black">1</span>
                        <p className="pt-0.5">
                          Launch <strong>Safari browser</strong> on your Apple device and navigate to Tareza ERP.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px] font-black">2</span>
                        <p className="pt-0.5">
                          Tap the <span className="inline-flex items-center gap-1 bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-805 font-bold text-indigo-500"><Share className="h-3 w-3" /> Share</span> icon on the bottom navigation bar.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px] font-black">3</span>
                        <p className="pt-0.5">
                          Scroll down the menu list and select <span className="inline-flex items-center gap-1 bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-805 font-bold"><PlusSquare className="h-3 w-3" /> Add to Home Screen</span>.
                        </p>
                      </div>
                      <p className="text-[10px] text-amber-600 dark:text-amber-500 flex items-center gap-1 bg-amber-500/5 p-2 rounded-xl border border-amber-500/10 font-sans mt-2">
                        <Info className="h-3.5 w-3.5 shrink-0" /> Note: Non-Safari browsers on iOS (Chrome, Edge, etc.) do not permit home screen app installations due to iOS security boundaries.
                      </p>
                    </motion.div>
                  )}

                  {activeTab === 'android' && (
                    <motion.div 
                      key="android"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-3.5 text-zinc-650 dark:text-zinc-350 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px] font-black">1</span>
                        <p className="pt-0.5">
                          Open the Chrome browser on your Android device.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px] font-black">2</span>
                        <p className="pt-0.5">
                          Look for an <strong className="text-indigo-600 dark:text-indigo-400">Install</strong> badge in your browser's address bar or menu.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px] font-black">3</span>
                        <p className="pt-0.5">
                          Tap the browser options button (<strong className="font-extrabold text-zinc-800 dark:text-zinc-200">⋮</strong> or <strong className="font-extrabold text-zinc-800 dark:text-zinc-200">···</strong>) and select <strong className="text-zinc-900 dark:text-white font-extrabold">"Install App"</strong> or <strong className="text-zinc-900 dark:text-white font-extrabold">"Add to Home Screen"</strong>.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'desktop' && (
                    <motion.div 
                      key="desktop"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-3 text-zinc-650 dark:text-zinc-350 text-xs"
                    >
                      {isSafari ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px] font-black">1</span>
                            <p className="pt-0.5">
                              In the top Safari system menu bar on macOS, click on <strong className="text-zinc-900 dark:text-white">File</strong>.
                            </p>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px] font-black">2</span>
                            <p className="pt-0.5">
                              Select <strong className="text-zinc-900 dark:text-white font-extrabold">Add to Dock...</strong> from the dropdown list.
                            </p>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px] font-black">3</span>
                            <p className="pt-0.5">
                              Click <strong className="text-indigo-650 dark:text-indigo-400 font-extrabold">Add</strong>. Tareza ERP will immediately launch as a desktop client from your Dock.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <p className="leading-relaxed">
                            Click your browser's options icon (top right corner, looks like <strong className="bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-extrabold text-zinc-900 dark:text-zinc-100">···</strong> or <strong className="bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-extrabold text-zinc-900 dark:text-zinc-100">⋮</strong>) and click on:
                          </p>
                          <ul className="list-none space-y-1.5 pl-2 font-bold text-zinc-850 dark:text-zinc-100">
                            <li className="flex items-center gap-1.5">
                              <ArrowRight className="h-3 w-3 text-indigo-500 shrink-0" /> "Install Tareza ERP..."
                            </li>
                            <li className="flex items-center gap-1.5">
                              <ArrowRight className="h-3 w-3 text-indigo-500 shrink-0" /> "Save and Share" &rarr; "Install App"
                            </li>
                            <li className="flex items-center gap-1.5">
                              <ArrowRight className="h-3 w-3 text-indigo-500 shrink-0" /> "App" &rarr; "Install this site as an app"
                            </li>
                          </ul>
                          <p className="text-[10px] text-zinc-400 italic mt-2">
                            Tip: A dedicated App Download button (resembling a laptop with an arrow or a box with +) is visible in Chrome/Edge directly on the right-hand side of your top URL bar.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Link Sharing Panel */}
            <div className="space-y-2">
              <span className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 block uppercase tracking-wider">
                Need to transfer to another device?
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 rounded-xl px-3 py-2.5 text-zinc-600 dark:text-zinc-400 font-mono text-[10.5px] truncate select-all border border-zinc-200/50 dark:border-zinc-805">
                  {window.location.origin}
                </div>
                <Button 
                  onClick={copyUrlToClipboard}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 h-9 font-bold text-xs shrink-0 cursor-pointer select-none"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" /> : <Copy className="h-3.5 w-3.5 text-zinc-500 mr-1" />}
                  <span>{copied ? 'Copied' : 'Copy link'}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-805 px-6 py-4 bg-zinc-50 dark:bg-zinc-950">
            <Button 
              onClick={ignorePwaHint}
              variant="ghost" 
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 h-9 font-bold text-xs cursor-pointer rounded-xl"
            >
              Don't show again
            </Button>
            <Button 
              onClick={() => setIsOpen(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold h-9 rounded-xl px-5 cursor-pointer select-none text-xs shadow-md transition-colors"
            >
              Okay, got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
