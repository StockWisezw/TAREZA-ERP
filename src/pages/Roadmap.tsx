import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Sparkles, 
  CheckCircle2, 
  CircleDot, 
  Clock, 
  ThumbsUp, 
  TrendingUp, 
  MessageSquare, 
  Vote, 
  Layers, 
  ArrowRight, 
  Compass, 
  Kanban,
  Zap,
  DollarSign,
  ShoppingCart,
  Users,
  ShieldAlert,
  ChevronRight,
  BookOpen,
  RefreshCw,
  Lock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  category: 'POS' | 'AI' | 'UX' | 'Accounting' | 'Integrations' | 'Security';
  status: 'Completed & Live' | 'Active & In Progress' | 'Planned / Backlog';
  priority: 'High' | 'Medium' | 'Future';
  quarter: string;
  upvotes: number;
  voted: boolean;
  impact: string;
}

const INITIAL_ROADMAP: RoadmapItem[] = [
  // Completed / Live
  {
    id: 'id-gemini-insights',
    title: 'Tareza GPT — Predictive Advisor integration',
    description: 'Implements live, server-side Gemini 3.5 analytics to calculate regional risk metrics, dual-currency pricing forecasts, and restock levels.',
    category: 'AI',
    status: 'Completed & Live',
    priority: 'High',
    quarter: 'Q2 2026',
    upvotes: 42,
    voted: false,
    impact: 'Maximizes business decision speeds by highlighting stock trends.'
  },
  {
    id: 'id-optim-queries',
    title: 'Parallelized Dashboard Telemetry Queries',
    description: 'Refactored backend fetches to load metrics, inventories, and sales statistics in parallel, reducing load delay by 60%.',
    category: 'UX',
    status: 'Completed & Live',
    priority: 'High',
    quarter: 'Q2 2026',
    upvotes: 28,
    voted: false,
    impact: 'Increases viewport rendering and optimizes layout responsiveness.'
  },
  {
    id: 'id-fault-connection',
    title: 'IndexedDB Fallback Memory Engine',
    description: 'Ensures 100% operation inside restricted sandbox iframes by auto-transferring cache management to memory storage on connection errors.',
    category: 'Security',
    status: 'Completed & Live',
    priority: 'High',
    quarter: 'Q2 2026',
    upvotes: 35,
    voted: false,
    impact: 'Guarantees app continuity in low-level browser frames.'
  },

  // Active / In Progress
  {
    id: 'id-pos-refactor',
    title: 'Modular Split of Monolithic POS.tsx Component',
    description: 'Deconstruct POS modules into focused custom hooks and standalone components (CartSummary, PaymentFlow, GridSelector) to improve coding clarity and speed up standard actions.',
    category: 'POS',
    status: 'Active & In Progress',
    priority: 'High',
    quarter: 'Q3 2026',
    upvotes: 84,
    voted: false,
    impact: 'Reduces cognitive load of standard actions and boosts compile times.'
  },
  {
    id: 'id-onboarding-wizard',
    title: 'Interactive Business Walkthrough and Guided Setup',
    description: 'Develop step-by-step overlays and setup guides to help new retail owners assign roles, configure regional taxes (including ZIMRA guidelines) easily.',
    category: 'UX',
    status: 'Active & In Progress',
    priority: 'High',
    quarter: 'Q3 2026',
    upvotes: 71,
    voted: false,
    impact: 'Shrinks user setup delays and onboarding complexity.'
  },
  {
    id: 'id-accounting',
    title: 'Full Trial Balance and General Ledger Double-Entry Module',
    description: 'Completes journal accounting features. Integrates POS registers directly into general accounts ledger logs, streamlining trial bookkeeping sheets at month-end.',
    category: 'Accounting',
    status: 'Active & In Progress',
    priority: 'High',
    quarter: 'Q3 2026',
    upvotes: 95,
    voted: false,
    impact: 'Enables quick compliance auditing and safe year-end reporting.'
  },

  // Planned / Backlog
  {
    id: 'id-dual-currency',
    title: 'Dual-Currency USD/ZWG Dual pricing engine',
    description: 'Automatic multi-currency toggle switch configured on POS registers. Integrates real-time Reserve Bank of Zimbabwe official rates for live converting.',
    category: 'Integrations',
    status: 'Planned / Backlog',
    priority: 'High',
    quarter: 'Q4 2026',
    upvotes: 112,
    voted: false,
    impact: 'Simplifies cash receipts and minimizes local inflation issues.'
  },
  {
    id: 'id-loyalty',
    title: 'Dynamic Customer Loyalty & Retargeting Module',
    description: 'Earn stamps/points directly upon checkout, create localized segment tiers, and send automatic SMS reminders to high-spending customers.',
    category: 'POS',
    status: 'Planned / Backlog',
    priority: 'Medium',
    quarter: 'Q4 2026',
    upvotes: 56,
    voted: false,
    impact: 'Increases purchase frequencies and deepens client relationships.'
  },
  {
    id: 'id-m-money',
    title: 'EcoCash & OneMoney Real-Time USSD pushes',
    description: 'Accept seamless phone payments through instant USSD notifications over networks, instantly printing receipts upon compliance verification.',
    category: 'Integrations',
    status: 'Planned / Backlog',
    priority: 'High',
    quarter: 'Q4 2026',
    upvotes: 124,
    voted: false,
    impact: 'Expedites quick payments while removing cash-counting risks.'
  },
  {
    id: 'id-supplier',
    title: 'Supplier Procurement Management & Purchase Logs',
    description: 'Establish Purchase Orders, log incoming Goods Received Notes (GRN), and coordinate with accounting modules to track payments and active supplier cycles.',
    category: 'Accounting',
    status: 'Planned / Backlog',
    priority: 'Medium',
    quarter: 'Q1 2027',
    upvotes: 48,
    voted: false,
    impact: 'Reduces stockouts and monitors delivery cycle timelines.'
  }
];

export default function Roadmap() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isDeveloper = user?.email?.toLowerCase().endsWith('@tarezaerp.co.zw') || 
                      user?.email?.toLowerCase() === 'admin@tarezaerp.co.zw' || 
                      user?.email?.toLowerCase() === 'developer@tarezaerp.co.zw' || 
                      user?.email?.toLowerCase() === 'dev@tarezaerp.co.zw' || 
                      user?.email?.toLowerCase() === 'tapsforex@gmail.com';

  const [items, setItems] = useState<RoadmapItem[]>(() => {
    const cached = localStorage.getItem('tareza_roadmap_items');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Fallback
      }
    }
    return INITIAL_ROADMAP;
  });

  const [activeTab, setActiveTab] = useState<'All' | 'Completed' | 'In Progress' | 'Backlog'>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [newSuggestion, setNewSuggestion] = useState('');
  const [newCategory, setNewCategory] = useState<'POS' | 'AI' | 'UX' | 'Accounting' | 'Integrations'>('POS');
  const [userSuggestions, setUserSuggestions] = useState<any[]>(() => {
    const cached = localStorage.getItem('tareza_user_suggestions');
    return cached ? JSON.parse(cached) : [];
  });

  useEffect(() => {
    localStorage.setItem('tareza_roadmap_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('tareza_user_suggestions', JSON.stringify(userSuggestions));
  }, [userSuggestions]);

  if (authLoading) {
    return (
      <div className="min-h-[400px] bg-white dark:bg-zinc-950 flex flex-col items-center justify-center font-sans">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium">Verifying Developer Permissions...</p>
      </div>
    );
  }

  if (!isDeveloper) {
    return (
      <div className="min-h-[400px] bg-white dark:bg-zinc-950 flex flex-col items-center justify-center font-sans p-6 text-center">
        <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-full w-14 h-14 flex items-center justify-center mb-5 border border-rose-100 dark:border-rose-905/30">
          <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400" />
        </div>
        <h2 className="text-base font-bold font-sans text-zinc-900 dark:text-white mb-1.5">Restricted Developer Channel</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-sm leading-relaxed mb-5 font-medium font-sans">
          This future systems roadmap is restricted to authorized credentials belonging to Tareza Developers.
        </p>
        <Link to="/dashboard">
          <Button variant="outline" className="rounded-full px-5 h-9 text-[11px] font-bold select-none cursor-pointer">
            Return to Operating Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const handleVote = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        if (item.voted) {
          toast.info(`Removed upvote for: ${item.title}`);
          return { ...item, upvotes: item.upvotes - 1, voted: false };
        } else {
          toast.success(`Upvoted feature: ${item.title}! It has been prioritized.`);
          return { ...item, upvotes: item.upvotes + 1, voted: true };
        }
      }
      return item;
    }));
  };

  const handleCreateSuggestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuggestion.trim()) return;

    const suggestion = {
      id: `suggest-${Date.now()}`,
      title: newSuggestion,
      category: newCategory,
      createdAt: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      upvotes: 1,
      voted: true
    };

    setUserSuggestions(prev => [suggestion, ...prev]);
    setNewSuggestion('');
    toast.success('Thank you! Your developmental recommendation has been logged.');
  };

  const handleVoteSuggestion = (id: string) => {
    setUserSuggestions(prev => prev.map(s => {
      if (s.id === id) {
        const isVoted = s.voted;
        return {
          ...s,
          upvotes: isVoted ? s.upvotes - 1 : s.upvotes + 1,
          voted: !isVoted
        };
      }
      return s;
    }));
  };

  const filteredItems = items.filter(item => {
    const matchesTab = 
      activeTab === 'All' ||
      (activeTab === 'Completed' && item.status === 'Completed & Live') ||
      (activeTab === 'In Progress' && item.status === 'Active & In Progress') ||
      (activeTab === 'Backlog' && item.status === 'Planned / Backlog');

    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

    return matchesTab && matchesCategory;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed & Live':
        return <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />;
      case 'Active & In Progress':
        return <CircleDot className="h-4.5 w-4.5 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4.5 w-4.5 text-zinc-400" />;
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'POS': return 'bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-455 hover:bg-cyan-100';
      case 'AI': return 'bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100';
      case 'UX': return 'bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 hover:bg-sky-100';
      case 'Accounting': return 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100';
      case 'Integrations': return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100';
      default: return 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100';
    }
  };

  const completedCount = items.filter(i => i.status === 'Completed & Live').length;
  const inProgressCount = items.filter(i => i.status === 'Active & In Progress').length;
  const backlogCount = items.filter(i => i.status === 'Planned / Backlog').length;

  return (
    <div className="space-y-6 md:space-y-8 max-w-[1200px] mx-auto pb-12">
      
      {/* Dynamic Header Box */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-violet-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative text-left space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5" /> Core Feature Tracker
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none sm:text-4xl">
            Product Development Roadmap
          </h1>
          <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xl">
            Welcome to the Tareza ERP feature center. Participate directly in our developmental processes by upvoting planned upgrades or recommending high-priority additions below.
          </p>
        </div>

        {/* Global Progress Indicators */}
        <div className="grid grid-cols-3 gap-3 mt-8 max-w-lg">
          <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm text-center">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">Delivered</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-450">{completedCount}</div>
            <p className="text-[10.5px] text-zinc-400 mt-0.5">Tested & Live</p>
          </div>
          <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm text-center">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">In Development</span>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{inProgressCount}</div>
            <p className="text-[10.5px] text-zinc-400 mt-0.5">Active Sprint</p>
          </div>
          <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm text-center">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">Backlog</span>
            <div className="text-2xl font-black text-zinc-650 dark:text-zinc-405">{backlogCount}</div>
            <p className="text-[10.5px] text-zinc-400 mt-0.5">Target Priority</p>
          </div>
        </div>
      </div>

      {/* Interactive Interface Filtering & Views */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-850 pb-4">
        {/* State Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-full w-fit">
          {(['All', 'Completed', 'In Progress', 'Backlog'] as const).map(tab => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                  isActive 
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm font-bold' 
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Categories filters */}
        <div className="flex items-center gap-2">
          <Layers className="text-zinc-400 w-4 h-4 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs font-semibold bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-805 text-zinc-700 dark:text-zinc-300 rounded-full px-4 py-2 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all cursor-pointer"
          >
            <option value="All">All Categories</option>
            <option value="POS">POS Terminal</option>
            <option value="AI">AI & Analytics</option>
            <option value="UX">UX & Onboarding</option>
            <option value="Accounting">Accounting & Ledger</option>
            <option value="Integrations">Smart Integrations</option>
            <option value="Security">Security & Cache</option>
          </select>
        </div>
      </div>

      {/* Grid of Roadmap Features */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-16 text-center space-y-4">
            <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center rounded-full text-zinc-400 mx-auto">
              <Compass className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="font-bold text-zinc-800 dark:text-zinc-200">No Features Match Your Selection</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                There are no active roadmap records matching this combination. Make sure to reset adjustments to explore available elements.
              </p>
            </div>
          </div>
        ) : (
          filteredItems.map(item => (
            <Card 
              key={item.id} 
              className={`border border-zinc-200/70 dark:border-zinc-850/80 shadow-sm relative overflow-hidden transition-all hover:translate-y-[-1px] hover:shadow-md ${
                item.status === 'Completed & Live' 
                  ? 'bg-gradient-to-b from-emerald-500/[0.015] to-transparent' 
                  : item.status === 'Active & In Progress'
                  ? 'bg-gradient-to-b from-blue-500/[0.015] to-transparent'
                  : ''
              }`}
            >
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1.5 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 text-[9.5px] font-bold rounded-full uppercase tracking-wider ${getCategoryColor(item.category)}`}>
                      {item.category}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-400">
                      {item.quarter}
                    </span>
                  </div>
                  <CardTitle className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 leading-tight">
                    {item.title}
                  </CardTitle>
                </div>
                <div className="shrink-0" title={item.status}>
                  {getStatusIcon(item.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-5">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-3">
                  {item.description}
                </p>

                {/* Impact Statement */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-150/50 dark:border-zinc-805 text-[10.5px]">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-0.5">Value & Business Impact:</span>
                  <span className="text-zinc-500 dark:text-zinc-450 italic font-medium leading-normal">{item.impact}</span>
                </div>

                {/* Footer Upvote & Priority Status */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-850 mt-2">
                  <div className="flex items-center gap-1 text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500">
                    <span className="text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-[9px]">Priority:</span>
                    <span className={`font-black ${
                      item.priority === 'High' ? 'text-rose-500' : 'text-amber-500'
                    }`}>{item.priority}</span>
                  </div>

                  <Button
                    size="sm"
                    variant={item.voted ? 'default' : 'outline'}
                    onClick={() => handleVote(item.id)}
                    className={`rounded-full gap-1.5 h-8 px-3 text-[11px] font-bold transition-all shadow-none ${
                      item.voted 
                        ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 border-none' 
                        : 'border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${item.voted ? 'fill-white' : ''}`} />
                    <span>{item.upvotes}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recommendation and Suggestion Area */}
      <div className="grid gap-6 md:grid-cols-3 mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-850">
        
        {/* Create Improvement Form */}
        <div className="md:col-span-1 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" /> Recommend Features
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Have a critical regional requirement or an ambitious integration proposal? Enter your request directly below to submit a priority suggestion.
            </p>
          </div>

          <form onSubmit={handleCreateSuggestion} className="bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-850 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-400 uppercase tracking-widest">
                Suggestion Summary
              </label>
              <textarea
                value={newSuggestion}
                onChange={(e) => setNewSuggestion(e.target.value)}
                placeholder="Example: Auto-export local transactions directly into Sage-paste accounting cycles..."
                required
                rows={3}
                className="w-full text-xs bg-white dark:bg-zinc-90 w/20 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-inner outline-none focus:ring-2 focus:ring-blue-500/20 text-zinc-800 dark:text-zinc-200 leading-normal"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-400 uppercase tracking-widest">
                Category Group
              </label>
              <select
                value={newCategory}
                onChange={(e: any) => setNewCategory(e.target.value)}
                className="w-full text-xs font-semibold bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-zinc-700 dark:text-zinc-300"
              >
                <option value="POS">POS Terminal</option>
                <option value="AI">AI & Predictors</option>
                <option value="UX">UX & Onboarding</option>
                <option value="Accounting">Accounting ledger</option>
                <option value="Integrations">Integrations API</option>
              </select>
            </div>

            <Button type="submit" className="w-full rounded-xl py-2.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-sans shadow-none">
              Submit Recommendation
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </form>
        </div>

        {/* Existing Community Recommendations List */}
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-1.5 flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <Vote className="w-4 h-4 text-blue-500" /> Operator Recommendations ({userSuggestions.length})
            </h2>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Community Backlog</span>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {userSuggestions.length === 0 ? (
              <div className="py-12 text-center bg-zinc-50/20 dark:bg-zinc-900/10 border border-dashed border-zinc-200 dark:border-zinc-805 rounded-2xl">
                <MessageSquare className="w-5 h-5 text-zinc-400 mx-auto opacity-70 mb-2 animate-bounce" />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No suggestions submitted yet</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Use the recommendation panel to add the first custom request!</p>
              </div>
            ) : (
              userSuggestions.map((s) => (
                <div key={s.id} className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-805 flex items-start gap-4 hover:shadow-sm transition-all">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider ${getCategoryColor(s.category)}`}>
                        {s.category}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-400 font-medium">{s.createdAt}</span>
                    </div>
                    <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed">
                      {s.title}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={s.voted ? 'default' : 'outline'}
                    onClick={() => handleVoteSuggestion(s.id)}
                    className={`rounded-xl gap-1.5 h-9 w-14 flex flex-col justify-center items-center shrink-0 shadow-none p-0 ${
                      s.voted
                        ? 'bg-sky-600 hover:bg-sky-700 text-white border-none'
                        : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <ThumbsUp className="w-3 h-3 shrink-0" />
                    <span className="text-[10px] font-bold leading-none">{s.upvotes}</span>
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
