import React from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Sparkles, 
  Compass, 
  HelpCircle, 
  BookOpen, 
  MessageSquare, 
  ArrowRight,
  ShieldAlert,
  Terminal,
  LifeBuoy
} from 'lucide-react';
import { toast } from 'sonner';

export default function Support() {
  const triggerAIDiagnostics = () => {
    window.dispatchEvent(new Event('toggle-ai-assistant'));
    toast.success('AI Diagnostics Chat opened!');
  };

  const triggerGuidedTour = (moduleId: 'pos' | 'inventory') => {
    const event = new CustomEvent('start-tour', {
      detail: { moduleId }
    });
    window.dispatchEvent(event);
  };

  const triggerInteractiveToursMenu = () => {
    window.dispatchEvent(new Event('toggle-help-desk'));
    toast.success('Tours Directory opened!');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-fade-in" id="support-page-container">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 py-4 border-b border-zinc-150 dark:border-zinc-800">
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
          <LifeBuoy className="w-6 h-6 text-indigo-500" />
          Support Hub
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-450">
          Get direct system diagnostics, live help resources, and interactive guided module tours.
        </p>
      </div>

      {/* Bento Grid Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: AI Assistant */}
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent">
          <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
            <div className="space-y-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl text-indigo-600 dark:text-indigo-400 w-fit">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">AI Diagnostics Chat</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Connect with our context-aware system assistant. It can troubleshoot double-entry ledgers, check pending local POS sale queues, verify current cash control limits, or diagnose general platform state.
              </p>
            </div>
            <Button 
              onClick={triggerAIDiagnostics}
              className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl text-xs font-bold w-full select-none"
            >
              Start Diagnostics Chat
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Interactive Guided Tours */}
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent">
          <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
            <div className="space-y-2">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl text-emerald-600 dark:text-emerald-400 w-fit">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Interactive Training Tours</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Launch automated walkthroughs that physically point out the primary components of each module screen to ensure your cashier staff can sell with ease.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={triggerInteractiveToursMenu}
                className="flex-1 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Compass className="w-4 h-4" /> Browse All Tours (12 Modules)
              </Button>
              <Button 
                onClick={() => triggerGuidedTour('pos')}
                variant="outline"
                className="rounded-xl text-xs font-bold border-zinc-200 text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50 hover:bg-zinc-50 cursor-pointer"
              >
                Quick POS Tour
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQs Panel */}
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-zinc-500" />
            Quick System Operations FAQ
          </h3>
          <div className="space-y-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            <div className="pt-3 first:pt-0">
              <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">How do split-tender registers work?</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                When checking out a sale, you can specify individual tender balances (e.g., $10 USD Cash, and the rest via EcoCash/Card). The system balances these into distinct ledger cash log accounts dynamically.
              </p>
            </div>
            <div className="pt-3">
              <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Does Tareza offline sales store database entries?</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Yes. If your active network is offline, sales register logs are securely persisted inside your client browser IndexedDB instance. Once a valid network signal is detected, the Sync Status Indicator lights up green and back-syncs details.
              </p>
            </div>
            <div className="pt-3">
              <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">How do I verify cashier registers on day-close?</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Go to the POS terminal page and open &quot;Shift Controls&quot;. Cashiers must enter physical drawer counts to close sessions, creating automated audit variance logs in double-entry books.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Support Contacts */}
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row hover:border-zinc-300 dark:hover:border-zinc-700 transition-all items-center gap-4">
        <div className="p-3 bg-white dark:bg-zinc-800 shadow-xs border border-zinc-100 dark:border-zinc-700.5 rounded-xl shrink-0 text-zinc-500">
          <Terminal className="w-5 h-5 text-indigo-500" />
        </div>
        <div className="flex-grow text-center sm:text-left space-y-0.5">
          <h4 className="text-xs font-semibold text-zinc-850 dark:text-zinc-100">Need Specialized Developer Maintenance?</h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            For advanced custom configurations, database adjustments, or payroll reports, contact your supervisor portal.
          </p>
        </div>
        <Button 
          onClick={triggerInteractiveToursMenu}
          className="bg-zinc-900 hover:bg-zinc-805 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 rounded-xl text-xs font-bold shrink-0 shadow-xs cursor-pointer"
        >
          Tours Directory
        </Button>
      </div>
    </div>
  );
}
