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
  ArrowRight
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { toast } from 'sonner';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAlreadyStandalone, setIsAlreadyStandalone] = useState(false);

  // Platform and browser analysis
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (desktop app or mobile home screen launch)
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    
    setIsAlreadyStandalone(isStandaloneMode);

    // Detect platform
    const ua = navigator.userAgent;
    const isIosDevice = /iPhone|iPad|iPod/i.test(ua);
    const isAndroidDevice = /Android/i.test(ua);
    
    if (isIosDevice) {
      setPlatform('ios');
    } else if (isAndroidDevice) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

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
          toast('Install Standalone App Shortcut', {
            description: 'You can use Tareza ERP directly from your home screen or desktop dashboard for faster load times.',
            action: {
              label: 'Install',
              onClick: () => setIsOpen(true)
            },
            duration: 8000
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
      toast.success('Awesome! Tareza ERP has been installed. You can now open it as a standalone app.');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
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
      console.log('User completed Tareza ERP PWA installation.');
      setIsInstallable(false);
      setDeferredPrompt(null);
    } else {
      console.log('User cancelled installation.');
      // Re-enable install prompt
      setDeferredPrompt(deferredPrompt);
    }
  };

  const copyUrlToClipboard = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    toast.success('Application address copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const ignorePwaHint = () => {
    localStorage.setItem('tareza_pwa_hint_dismissed', 'true');
    setIsOpen(false);
  };

  // Do not show anything if the user is already browsing within the standalone installed client
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
        className="relative items-center gap-1.5 px-3 py-1.5 h-9 rounded-full bg-blue-50/80 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-500/20 font-bold text-xs select-none hover:bg-blue-105 active:scale-95 transition-all text-center shrink-0 cursor-pointer shadow-sm hidden xs:inline-flex"
        title="Add Tareza ERP to your Desktop or Home Screen"
      >
        <MonitorSmartphone className="h-3.5 w-3.5 animate-bounce" />
        <span>Install App</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-[490px] rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl overflow-hidden scrollbar-none">
          <DialogHeader className="space-y-1 pb-3 border-b border-zinc-100 dark:border-zinc-805">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 rounded-2xl text-blue-600 dark:text-blue-400">
                <MonitorSmartphone className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-black text-zinc-950 dark:text-white">
                Install Standalone Shortcut
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 pt-1">
              Run Tareza ERP in fullscreen directly from your Home Screen or Desktop Dock, with separate app switching, no browser address bars, and lightning fast offline performance.
            </DialogDescription>
          </DialogHeader>

          {/* Platform Specific PWA Guidance */}
          <div className="py-4 space-y-4 font-sans text-xs">
            {isInstallable && deferredPrompt ? (
              /* AUTOMATIC CHROMIUM/ANDROID/WINDOWS ONE-CLICK EXPERIENCE */
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 text-center space-y-3">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm">Direct Installation Supported!</h4>
                  <p className="text-[11px] text-zinc-650 dark:text-zinc-400">Your browser supports instant automated background app installation. Tap the button below to add the shortcut immediately.</p>
                </div>
                <Button 
                  onClick={triggerDirectInstall}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl cursor-pointer shadow-md inline-flex items-center justify-center gap-2 text-xs"
                >
                  <Download className="h-4 w-4" /> Install stand-alone app now
                </Button>
              </div>
            ) : null}

            {/* Manual Instructions Section */}
            <div className="space-y-3">
              <h5 className="font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                {platform === 'ios' ? <Smartphone className="h-4 w-4 text-zinc-400" /> : <Laptop className="h-4 w-4 text-zinc-400" />}
                <span>
                  {platform === 'ios' 
                    ? 'Apple iOS / Safari Setup steps' 
                    : platform === 'android' 
                      ? 'Android Installation steps' 
                      : 'macOS & Windows Setup guide'}
                </span>
              </h5>

              {platform === 'ios' ? (
                /* iOS Safari instructions */
                <div className="space-y-3 text-zinc-650 dark:text-zinc-350 bg-zinc-50 dark:bg-zinc-900/50 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-xs font-black">1</span>
                    <p className="pt-0.5">
                      Open <strong>Safari</strong> browser and tap the <span className="inline-flex items-center gap-1 bg-white dark:bg-zinc-805 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 font-bold"><Share className="h-3 w-3 inline text-blue-500" /> Share</span> icon on the navigation panel.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-xs font-black">2</span>
                    <p className="pt-0.5">
                      Scroll down the menu list and select <span className="inline-flex items-center gap-1 bg-white dark:bg-zinc-805 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 font-bold"><PlusSquare className="h-3 w-3 inline" /> Add to Home Screen</span>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-xs font-black">3</span>
                    <p className="pt-0.5">
                      Confirm the icon and details, then tap <strong className="text-blue-600 dark:text-blue-400">Add</strong> in the top-right corner to place it on your device screen.
                    </p>
                  </div>
                </div>
              ) : isSafari ? (
                /* macOS Safari (Add to Dock) instructions */
                <div className="space-y-3 text-zinc-650 dark:text-zinc-350 bg-zinc-50 dark:bg-zinc-900/50 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-xs font-black">1</span>
                    <p className="pt-0.5">
                      In the top Safari menu bar, click on <strong className="text-zinc-900 dark:text-white">File</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-xs font-black">2</span>
                    <p className="pt-0.5">
                      Select <strong className="text-zinc-900 dark:text-white">Add to Dock...</strong> from the dropdown list.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-xs font-black">3</span>
                    <p className="pt-0.5">
                      Click <strong className="text-blue-600 dark:text-blue-400">Add</strong> to immediately save Tareza ERP in your applications system folder.
                    </p>
                  </div>
                </div>
              ) : (
                /* Other general Desktop browsers / Chrome / Edge / Firefox guidance */
                <div className="space-y-2.5 text-zinc-650 dark:text-zinc-350 bg-zinc-50 dark:bg-zinc-900/50 p-3.5 rounded-2xl border border-zinc-105 dark:border-zinc-800">
                  <p className="leading-relaxed">
                    Simply tap your browser's options menu (looks like <strong className="font-bold flex-inline bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">···</strong> or <strong className="font-bold flex-inline bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">⋮</strong> in Chrome/Edge/Opera) and look for:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 font-bold text-zinc-850 dark:text-zinc-100">
                    <li className="flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5 text-blue-500 shrink-0" /> "Install Tareza ERP..."
                    </li>
                    <li className="flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5 text-blue-500 shrink-0" /> "Add to Home Screen"
                    </li>
                    <li className="flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5 text-blue-500 shrink-0" /> "Create Shortcut / App Utility"
                    </li>
                  </ul>
                  <p className="text-[10px] text-zinc-400 italic mt-2">
                    Tip: Many browsers display a mini download/app-bracket icon inside the right corner of the main URL address bar.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions / Copy Panel URL */}
            <div className="space-y-2.5 pt-1">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 block">Need to switch browsers?</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-zinc-600 dark:text-zinc-400 font-mono text-[10.5px] truncate select-all border border-zinc-200/50 dark:border-zinc-750">
                  {window.location.origin}
                </div>
                <Button 
                  onClick={copyUrlToClipboard}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border hover:bg-zinc-50 dark:hover:bg-zinc-850 h-8 font-semibold text-xs shrink-0 cursor-pointer select-none"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" /> : <Copy className="h-3.5 w-3.5 text-zinc-500 mr-1" />}
                  <span>{copied ? 'Copied' : 'Copy URL'}</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-805 pt-3.5">
            <Button 
              onClick={ignorePwaHint}
              variant="ghost" 
              className="text-zinc-400 hover:text-zinc-650 h-9 font-semibold text-xs cursor-pointer rounded-xl"
            >
              Don't show again
            </Button>
            <Button 
              onClick={() => setIsOpen(false)}
              className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white/95 dark:text-zinc-900 font-bold h-9 rounded-xl px-4 cursor-pointer select-none text-xs"
            >
              Okay, got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
