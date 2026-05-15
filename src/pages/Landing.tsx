import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Store, TrendingUp, ShieldCheck, Zap, Package, Key, Building2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center overflow-x-hidden">
      {/* Navigation */}
      <nav className="w-full max-w-7xl mx-auto flex items-center justify-between p-6 z-50 bg-background/80 backdrop-blur-md sticky top-0 border-b border-border/50">
        <div className="flex items-center space-x-2">
          <div className="bg-primary p-2 rounded-lg shadow-sm">
            <Store className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-secondary dark:text-zinc-50">TAREZA</span>
        </div>
        
        <div className="hidden md:flex space-x-8 font-medium text-sm text-zinc-500">
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#solution" className="hover:text-primary transition-colors">Solutions</a>
          <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
        </div>
        
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <Link to="/login" className="font-semibold text-sm hover:text-primary transition-colors">Sign In</Link>
          <Link to="/login">
            <Button className="font-bold relative overflow-hidden group bg-primary text-primary-foreground hover:bg-primary/90">
              <span className="relative z-10 flex items-center">
                Get Started <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="w-full max-w-7xl mx-auto px-6 py-24 md:py-32 flex flex-col lg:flex-row items-center relative">
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

        <div className="lg:w-1/2 space-y-8 z-10 text-center lg:text-left">
          <div className="inline-flex items-center space-x-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-4 py-1.5 text-sm font-medium">
            <SparklesIcon className="w-4 h-4 text-primary" />
            <span>Now with Tareza AI Insights</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] text-zinc-900 dark:text-zinc-50">
            The Intelligent <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-600">
              Business OS
            </span>
          </h1>
          
          <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
            Powering African commerce. Point of Sale, multi-branch inventory, 
            accounting, and AI forecasting—all in one enterprise-grade platform.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4 pt-4">
            <Link to="/login">
              <Button size="lg" className="h-14 px-8 text-base font-bold w-full sm:w-auto shadow-lg shadow-primary/25">
                Start your 14-day free trial
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 px-8 text-base font-bold w-full sm:w-auto bg-transparent border-zinc-300 dark:border-zinc-700">
              Book a Demo
            </Button>
          </div>
          <p className="text-sm text-zinc-500 font-medium">No credit card required. Cancel anytime.</p>
        </div>
        
        <div className="lg:w-1/2 mt-16 lg:mt-0 relative z-10">
          <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-2xl glass-effect p-2 bg-gradient-to-br from-white/40 to-white/10 dark:from-zinc-900/80 dark:to-zinc-950/80 backdrop-blur-xl">
            <img 
              src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=2000&auto=format&fit=crop" 
              alt="Tareza ERP Interface" 
              className="rounded-xl w-full object-cover shadow-inner opacity-90"
            />
            {/* Floating KPI Cards */}
            <div className="absolute -left-6 bottom-12 bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-xl border border-border/50 flex items-center space-x-3 hidden md:flex animate-in slide-in-from-bottom-5 duration-1000 delay-300">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase">Daily Revenue</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">$4,250.00</p>
              </div>
            </div>
            
            <div className="absolute -right-6 top-16 bg-secondary text-white p-4 rounded-xl shadow-xl border border-secondary/50 flex items-center space-x-3 hidden md:flex animate-in slide-in-from-right-5 duration-1000 delay-500">
              <div className="bg-primary/20 p-2 rounded-lg text-primary">
                <SparklesIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary uppercase">Tareza AI</p>
                <p className="text-sm font-medium text-zinc-200">Reorder Mazoe 2L now</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="w-full bg-zinc-50 dark:bg-zinc-900/50 border-y border-border/50 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
            <h2 className="text-sm font-bold text-primary tracking-widest uppercase">Everything you need</h2>
            <h3 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Enterprise-grade tools, <br/> built for your growth.</h3>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Store className="w-6 h-6" />}
              title="Tareza POS"
              description="Lightning-fast point of sale that works offline. Process sales, manage returns, and print fiscal receipts instantly."
            />
            <FeatureCard 
              icon={<Package className="w-6 h-6" />}
              title="Tareza Inventory"
              description="Track stock across multiple warehouses and branches in real-time. Automated stocktakes and low-stock alerts."
            />
            <FeatureCard 
              icon={<SparklesIcon className="w-6 h-6" />}
              title="Tareza AI"
              description="Predictive insights, demand forecasting, and an intelligent assistant that acts as your virtual CFO."
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-6 h-6" />}
              title="ZIMRA Fiscalisation"
              description="Built-in ZIMRA compliance. Generate digital signatures and fiscal QR codes directly on your receipts."
            />
            <FeatureCard 
              icon={<Building2 className="w-6 h-6" />}
              title="Tareza Books"
              description="Integrated accounting ledger. Track expenses, generate P&L statements, and manage supplier accounts seamlessly."
            />
            <FeatureCard 
              icon={<Key className="w-6 h-6" />}
              title="Bank-Level Security"
              description="Role-based access control, detailed audit logs, and rigorous data isolation to protect your business data."
            />
          </div>
        </div>
      </section>
      
      {/* Pricing Section */}
      <section id="pricing" className="w-full py-24 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Simple, transparent pricing</h2>
            <p className="text-xl text-zinc-500 dark:text-zinc-400">All plans include access to all modules. You only pay for additional locations and users.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-card rounded-2xl border border-border p-8 shadow-sm flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Starter</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold">$15</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Perfect for small, single-location shops.</p>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> 1 Branch / Warehouse</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> 3 User Accounts</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> All Tareza Modules</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> Standard Support</li>
              </ul>
              <Link to="/login" className="mt-auto">
                <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/5">Start 14-day free trial</Button>
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-card rounded-2xl border-2 border-primary p-8 shadow-lg relative flex flex-col scale-105 z-10">
              <div className="absolute top-0 inset-x-0 translate-y-[-50%] flex justify-center">
                <span className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest py-1 px-4 rounded-full">Most Popular</span>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-foreground">Pro</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-foreground">$45</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">For growing multi-location retailers.</p>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> Up to 3 Branches</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> Up to 10 User Accounts</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> All Tareza Modules</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> ZIMRA Fiscalisation Ready</li>
              </ul>
              <Link to="/login" className="mt-auto">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Start 14-day free trial</Button>
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-card rounded-2xl border border-border p-8 shadow-sm flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold">$99</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Unlimited power for large operations.</p>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> Unlimited Branches</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> Unlimited Users</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> All Tareza Modules</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> Custom API Access</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> 24/7 Priority Support</li>
              </ul>
              <Link to="/login" className="mt-auto">
                <Button variant="outline" className="w-full">Contact Sales</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-border/50 py-12 bg-secondary text-secondary-foreground">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm">
           <div className="flex items-center space-x-2 mb-4 md:mb-0">
             <Store className="w-5 h-5 text-primary" />
             <span className="font-bold tracking-widest text-white">TAREZA ERP</span>
           </div>
           <p className="text-zinc-400">© 2026 Tareza Technologies. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[50px] group-hover:bg-primary/10 transition-colors"></div>
      <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center text-primary mb-6 relative z-10">
        {icon}
      </div>
      <h4 className="text-xl font-bold mb-3 text-card-foreground relative z-10">{title}</h4>
      <p className="text-muted-foreground leading-relaxed relative z-10">{description}</p>
    </div>
  );
}

function SparklesIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
