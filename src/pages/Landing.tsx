import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Store, TrendingUp, ShieldCheck, Zap, Package, Key, Building2, ArrowRight, CheckCircle2, Calculator, Users, BarChart3, Receipt, ShoppingCart, Activity, Mail, Phone, MessageCircle, Facebook, Youtube, Globe, ClipboardList, ChevronDown, ChevronUp, HelpCircle, ChevronRight } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { TarezaLogo } from '../components/ui/Logo';

export default function Landing() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "What is Tareza ERP, and how does it optimize your business?",
      answer: "Tareza ERP is our flagship, next-generation Point of Sale (POS) and inventory control cloud ledger platform designed for modern business operations. It acts as the core brain of your retail tracking, ensuring reliable multi-branch tracking, secure real-time bookkeeping, and live remote management."
    },
    {
      question: "What premium upgraded features are available in Tareza ERP?",
      answer: "We offer several high-performance upgrades to scale your operations, including our automated Multi-Branch Sync Engine to link remote stores, and our Stock Take Auditing Module to manage physical counts and minimize stock leakages."
    },
    {
      question: "Is there an offline-ready POS feature, and how does synchronization work?",
      answer: "Yes, our POS app is uniquely designed to support modern retail environments. The terminal saves sales transactions locally if your storefront connection is interrupted, and seamlessly syncs with your central database records once connection is restored."
    },
    {
      question: "How are the software modules and upgrade modules priced?",
      answer: "We offer a flexible tier budget: Free forever for small setups, Starter at $15/mo, and Professional at $30/mo. Additional connected branches are only $10/mo, and our Professional Stock Take Auditing Module is $15/month."
    },
    {
      question: "Where can we follow your online updates and learn how to use Tareza ERP?",
      answer: "To help onboard your cashiers and manage your stock, we are launching an active YouTube Channel containing thorough walk-through video tutorials, and we maintain an official Facebook Page for product updates, announcements, and local POS hardware tips."
    },
    {
      question: "How do we receive technical and billing support?",
      answer: "We prioritize our clients' success. You can email support@tarezaerp.co.zw for help desk tickets or billing updates, and call our direct hotlines at +263 784553570 and +263 776699950 for immediate support. Starter, Professional, and Enterprise tiers include dedicated support options suited to your enterprise scale."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center overflow-x-hidden">
      {/* Contact Top Bar */}
      <div className="w-full bg-zinc-900 border-b border-zinc-800 hidden md:block">
        <div className="max-w-7xl mx-auto px-6 h-10 flex items-center justify-between text-xs font-medium">
          <div className="text-zinc-400">
            Tareza ERP — Next-Gen Global Point of Sale & Connected Retail Intelligence
          </div>
          <div className="flex items-center space-x-6">
            <a href="mailto:admin@tarezaerp.co.zw" className="flex items-center text-zinc-300 hover:text-white transition-colors group">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 group-hover:bg-blue-500/20 text-zinc-400 group-hover:text-blue-400 mr-2 transition-colors">
                <Mail className="w-3 h-3" />
              </span>
              admin@tarezaerp.co.zw
            </a>
            <div className="w-px h-4 bg-zinc-800" />
            <a href="tel:+263784553570" className="flex items-center text-zinc-300 hover:text-white transition-colors group">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-zinc-400 group-hover:text-amber-400 mr-2 transition-colors">
                <Phone className="w-3 h-3" />
              </span>
              +263 784553570
            </a>
            <div className="w-px h-4 bg-zinc-800" />
            <a href="https://wa.me/263776699950" target="_blank" rel="noopener noreferrer" className="flex items-center text-zinc-300 hover:text-white transition-colors group">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 group-hover:bg-emerald-500/20 text-zinc-400 group-hover:text-emerald-400 mr-2 transition-colors">
                <MessageCircle className="w-3 h-3" />
              </span>
              WhatsApp Us
            </a>
            <div className="w-px h-4 bg-zinc-800" />
            <a href="https://www.facebook.com/TarezaERP" target="_blank" rel="noopener noreferrer" className="flex items-center text-zinc-300 hover:text-white transition-colors group" title="Follow us on Facebook">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 group-hover:bg-[#1877F2]/20 text-zinc-400 group-hover:text-[#1877F2] mr-2 transition-colors">
                <Facebook className="w-3 h-3" />
              </span>
              Facebook
            </a>
            <div className="w-px h-4 bg-zinc-800" />
            <a href="https://www.youtube.com/@tarezaerp" target="_blank" rel="noopener noreferrer" className="flex items-center text-zinc-300 hover:text-white transition-colors group" title="Subscribe to our YouTube Channel">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 group-hover:bg-[#FF0000]/20 text-zinc-400 group-hover:text-[#FF0000] mr-2 transition-colors">
                <Youtube className="w-3 h-3" />
              </span>
              YouTube
            </a>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="w-full max-w-7xl mx-auto flex items-center justify-between p-6 z-50 bg-background/80 backdrop-blur-md sticky top-0 border-b border-border/50">
        <div className="flex items-center">
          <TarezaLogo size="sm" showSubtitle={false} />
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
      <section className="relative w-full overflow-hidden bg-background">
        {/* Full-width Module Icons Background */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-background">
          {/* Subtle Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)]"></div>
          
          {/* Floating Application Module Highlights */}
          <div className="absolute inset-0 opacity-10 dark:opacity-20 animate-fade-in">
             {/* POS */}
             <div className="absolute top-[10%] left-[5%]"><Store className="w-16 h-16 text-primary" /></div>
             {/* Inventory */}
             <div className="absolute top-[20%] right-[15%]"><Package className="w-20 h-20 text-indigo-500" /></div>
             {/* Real-time/Analytics */}
             <div className="absolute bottom-[20%] left-[15%]"><Activity className="w-24 h-24 text-emerald-500" /></div>
             {/* Security/Access */}
             <div className="absolute bottom-[30%] right-[5%]"><ShieldCheck className="w-16 h-16 text-amber-500" /></div>
             {/* Accounting */}
             <div className="absolute top-[40%] left-[30%]"><Building2 className="w-12 h-12 text-rose-500" /></div>
             {/* Billing/Sales */}
             <div className="absolute top-[60%] right-[30%]"><Receipt className="w-14 h-14 text-blue-500" /></div>
             {/* HR/Employees */}
             <div className="absolute top-[80%] left-[50%]"><Users className="w-16 h-16 text-purple-500" /></div>
          </div>

          {/* Overlays to ensure text contrast and add depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent"></div>
        </div>

        <div className="w-full max-w-7xl mx-auto px-6 py-24 md:py-32 flex flex-col lg:flex-row items-center relative z-10">
          <div className="lg:w-1/2 space-y-8 z-10 text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 bg-background/80 dark:bg-background/50 border border-border/50 rounded-full px-4 py-1.5 text-sm font-medium backdrop-blur-md shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>Includes Multi-Branch Sync & Stock Take Auditing Module</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] text-zinc-900 dark:text-zinc-50 drop-shadow-sm">
              The Next-Gen <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-500 drop-shadow-none">
                Global Retail OS
              </span>
            </h1>
            
            <p className="text-xl text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
              Scale your multi-branch retail, wholesale, or distribution business with real-time cloud inventory tracking, intelligent hybrid offline-first POS terminals, integrated bookkeeping ledger accounting, and premium expert metrics advisory—trusted internationally.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4 pt-4">
              <Link to="/login">
                <Button size="lg" className="h-14 px-8 text-base font-bold w-full sm:w-auto shadow-lg shadow-primary/25 bg-primary hover:bg-primary/95 text-primary-foreground">
                  Start Global Free Trial
                </Button>
              </Link>
              <a href="mailto:admin@tarezaerp.co.zw?subject=Book a Demo - Tareza ERP">
                <Button size="lg" variant="outline" className="h-14 px-8 text-base font-bold w-full sm:w-auto bg-background/50 backdrop-blur-md border-border hover:bg-background/80">
                  Book Global Demo
                </Button>
              </a>
            </div>
            <p className="text-sm text-zinc-500 font-medium">14-day free trial. Setup takes under 5 minutes. No credit card required.</p>
          </div>
          
          <div className="lg:w-1/2 mt-16 lg:mt-0 relative z-10">
            <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-2xl glass-effect p-2 bg-gradient-to-br from-white/40 to-white/10 dark:from-zinc-900/80 dark:to-zinc-950/80 backdrop-blur-xl">
              <div className="rounded-xl overflow-hidden shadow-inner relative aspect-[4/3] sm:aspect-video bg-zinc-900 flex flex-col group">
                <img 
                  src="/tareza_dashboard_mockup.png"
                  alt="Tareza ERP Dashboard"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <img 
                  src="/tareza_pos_mockup.png"
                  alt="Tareza POS Interface"
                  referrerPolicy="no-referrer"
                  className="absolute bottom-0 right-0 w-2/3 h-auto rounded-tl-xl shadow-2xl border-t border-l border-white/20 translate-y-8 translate-x-8 group-hover:translate-y-4 group-hover:translate-x-4 transition-transform duration-700"
                />
              </div>

              {/* Floating KPI Cards */}
              <div className="absolute -left-6 bottom-12 bg-background/95 backdrop-blur shadow-xl border border-border/50 p-4 rounded-xl flex items-center space-x-3 hidden md:flex animate-in slide-in-from-bottom-5 duration-1000 delay-300">
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
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary uppercase">Multi-Branch Sync</p>
                  <p className="text-sm font-medium text-zinc-200">Real-time ledger & automated sync</p>
                </div>
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
              description="Lightning-fast point of sale that works offline. Process sales, manage returns, and print sales receipts instantly."
            />
            <FeatureCard 
              icon={<Package className="w-6 h-6" />}
              title="Tareza Inventory"
              description="Track stock across multiple warehouses and branches in real-time. Automated stocktakes and low-stock alerts."
            />
            <FeatureCard 
              icon={<Users className="w-6 h-6" />}
              title="Tailored Consultancy"
              description="Numbers alone don't build businesses—interpretation does. We offer hands-on monthly visits to guide strategy and minimize stock leakages."
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-6 h-6" />}
              title="Resilient Offline Engine"
              description="Robust offline checkout capability. Continue scanning and completing sales without internet; data syncs automatically when reconnected."
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
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Free Plan */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col">
              <h3 className="text-xl font-bold mb-1 text-foreground">Free</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-foreground">FREE</span>
                <span className="text-xs text-muted-foreground">forever</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Startups, street vendors & testing.</p>
              
              <ul className="space-y-3 mb-6 flex-1 text-xs text-foreground/80">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> 1 register / POS station</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> 1 User Account</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Basic POS features</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Manual inventory tracking</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> 10 transactions / day limit</li>
                <li className="flex items-center gap-2 text-muted-foreground/75"><CheckCircle2 className="w-4 h-4 text-muted shrink-0" /> <span className="line-through">No multi-branch sync</span></li>
              </ul>
              <Link to="/login" className="mt-auto">
                <Button variant="outline" className="w-full text-xs h-9">Get Started Free</Button>
              </Link>
            </div>

            {/* Starter Plan */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col">
              <h3 className="text-xl font-bold mb-1 text-foreground">Starter</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-foreground">$15</span>
                <span className="text-muted-foreground text-xs">/mo</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Small convenience stores & solo retail.</p>
              
              <ul className="space-y-3 mb-6 flex-1 text-xs text-foreground/80">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> 1 POS register station</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> 2 User Accounts</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Unlimited transactions</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Sales history & reports</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Manual cash reconciliation</li>
                <li className="flex items-center gap-2 text-muted-foreground/75"><CheckCircle2 className="w-4 h-4 text-muted shrink-0" /> <span className="line-through">No multi-branch sync</span></li>
              </ul>
              <Link to="/login" className="mt-auto">
                <Button variant="outline" className="w-full text-xs h-9">Start 14-day free trial</Button>
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-card rounded-2xl border-2 border-primary p-6 shadow-lg relative flex flex-col scale-100 lg:scale-105 z-10">
              <div className="absolute top-0 inset-x-0 translate-y-[-50%] flex justify-center">
                <span className="bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest py-0.5 px-3 rounded-full">Most Popular</span>
              </div>
              <h3 className="text-xl font-bold mb-1 text-foreground">Professional</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-foreground">$30</span>
                <span className="text-muted-foreground text-xs">/mo</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Established pharmacies & boutiques.</p>
              
              <ul className="space-y-3 mb-6 flex-1 text-xs text-foreground/80">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> 3 Registers / POS Stations</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> 10 User Accounts</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Multi-branch (up to 3 branches)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Real-time inventory tracking</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Advanced analytics, Till Calc</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Upgradable Multi-Branch Sync</li>
              </ul>
              <Link to="/login" className="mt-auto">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs h-9">Start your 14-day trial</Button>
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col">
              <h3 className="text-xl font-bold mb-1 text-foreground">Enterprise</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-foreground">Custom</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Large retail chains & franchises.</p>
              
              <ul className="space-y-3 mb-6 flex-1 text-xs text-foreground/80">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Unlimited POS register stations</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Unlimited Users & Branches</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Custom API Access & white-label</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Dedicated Account Manager</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Phone support (same-day)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Professional Stock Take Audits</li>
              </ul>
              <a href="mailto:admin@tarezaerp.co.zw?subject=Enterprise Inquiry - Tareza ERP" className="mt-auto block">
                <Button variant="outline" className="w-full text-xs h-9">Contact Sales</Button>
              </a>
            </div>
          </div>

          {/* Upgraded Premium ERP Modules & Add-on Pricing */}
          <div className="mt-16 bg-zinc-100/50 dark:bg-zinc-900/40 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 p-8 max-w-5xl mx-auto shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h4 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 font-sans flex items-center gap-2">
                  <span>💾 Upgrade Modules & Specialized Add-on Pricing</span>
                </h4>
                <p className="text-sm text-zinc-550 dark:text-zinc-400 mt-1">Supercharge your operations with specific enterprise-ready companion software additions.</p>
              </div>
              <span className="text-[10px] font-extrabold uppercase bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-400 px-3 py-1 rounded-full border border-indigo-200 tracking-wider h-fit shrink-0">
                Seamless Expansion Integrations
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Add-on 1 */}
              <div className="bg-background rounded-2xl border border-border p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-full">Add-on Module</span>
                    <span className="text-sm font-bold text-foreground">Multi-Branch Sync Engine</span>
                  </div>
                  <div className="text-3xl font-black text-foreground">$10<span className="text-xs font-semibold text-muted-foreground"> / per month per branch</span></div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Connect additional inventory warehouses, brick-and-mortar storefronts, and logistics centers into a single centralized ERP Ledger.</p>
                </div>
                <div className="pt-4 border-t border-border mt-6 flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Ready to scale your reach?</span>
                  <a href="mailto:admin@tarezaerp.co.zw?subject=Multi-Branch Sync Request" className="text-primary font-bold hover:underline flex items-center gap-1">Enable Sync Module <ChevronRight className="w-3.5 h-3.5" /></a>
                </div>
              </div>

              {/* Add-on 2 */}
              <div className="bg-background rounded-2xl border border-primary/20 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] font-extrabold px-3 py-1 uppercase tracking-wider rounded-bl-lg">Audit Ready</div>
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">Auditing & Analytics</span>
                    <span className="text-sm font-bold text-foreground">Stock Take Auditing Module</span>
                  </div>
                  <div className="text-3xl font-black text-foreground">$15<span className="text-xs font-semibold text-muted-foreground"> / month plan fee</span></div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Perform automated physical stock takes, barcode-based counts, discrepancy reports, and auto-adjusted ledger alignments to prevent cash and stock leakages.</p>
                </div>
                <div className="pt-4 border-t border-border mt-6 flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Minimize stock leakage today</span>
                  <a href="mailto:admin@tarezaerp.co.zw?subject=Stock Take Integration Request" className="text-primary font-bold hover:underline flex items-center gap-1">Request Integration <ChevronRight className="w-3.5 h-3.5" /></a>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-16 bg-primary/5 rounded-2xl border border-primary/20 p-8 max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between text-center md:text-left gap-6">
            <div>
               <h4 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 mb-1">Payment & Subscription Enquiries</h4>
               <p className="text-sm text-zinc-600 dark:text-zinc-400">For manual payments, plan upgrades, or direct support, please email our billing team.</p>
            </div>
            <a href="mailto:admin@tarezaerp.co.zw?subject=Payment Request - Tareza ERP">
               <Button className="shrink-0 bg-primary text-primary-foreground font-semibold">
                  Contact admin@tarezaerp.co.zw
               </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Interactive FAQ Accordion Section */}
      <section id="faq" className="w-full py-24 bg-background border-t border-border/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#80808008_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-50"></div>
        
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center space-x-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Got Questions? We Have Answers</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Frequently Asked Questions
            </h2>
            <p className="text-zinc-550 dark:text-zinc-400 max-w-2xl mx-auto text-base">
              Learn more about Tareza ERP's software capabilities, pricing models, dedicated customer support services, and companion solutions.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index} 
                  className={`bg-card rounded-2xl border transition-all duration-300 ${
                    isOpen 
                      ? 'border-primary/40 shadow-md shadow-primary/5 bg-primary/[0.01]' 
                      : 'border-border/80 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full text-left p-6 flex items-center justify-between gap-4 select-none focus:outline-none"
                  >
                    <span className={`text-base font-bold transition-colors ${isOpen ? 'text-primary' : 'text-zinc-900 dark:text-zinc-100'}`}>
                      {faq.question}
                    </span>
                    <span className={`p-1.5 rounded-lg bg-secondary text-secondary-foreground shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary bg-primary/10' : ''}`}>
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </button>

                  <div 
                    className={`grid transition-[grid-template-rows,opacity,padding] duration-300 ease-in-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100 pb-6 px-6' : 'grid-rows-[0fr] opacity-0 overflow-hidden'
                    }`}
                  >
                    <div className="overflow-hidden text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line border-t border-border/40 pt-4">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Further Inquiries Call-out */}
          <div className="mt-12 text-center p-6 bg-zinc-50 dark:bg-zinc-900/30 border border-border/60 rounded-2xl">
            <span className="text-sm text-zinc-550 dark:text-zinc-400">
              Still have questions about our retail solutions or website consultation rates?{" "}
              <a href="mailto:support@tarezaerp.co.zw" className="text-primary hover:underline font-bold">
                Email our Help Desk
              </a>{" "}
              or message us directly on{" "}
              <a href="https://wa.me/263776699950" className="text-emerald-600 hover:underline font-bold inline-flex items-center">
                WhatsApp Us
              </a>
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-border/50 py-12 bg-secondary text-secondary-foreground">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm">
           <div className="flex items-center mb-4 md:mb-0">
             <TarezaLogo size="sm" showSubtitle={false} variant="dark" />
           </div>
           <div className="flex flex-col md:flex-row items-center gap-4 text-zinc-400 mb-4 md:mb-0">
             <a href="mailto:support@tarezaerp.co.zw" className="hover:text-primary transition-colors">Support: support@tarezaerp.co.zw</a>
             <a href="mailto:admin@tarezaerp.co.zw" className="hover:text-primary transition-colors">Billing: admin@tarezaerp.co.zw</a>
             <div className="flex items-center gap-3">
               <a href="https://www.facebook.com/TarezaERP" target="_blank" rel="noopener noreferrer" className="hover:text-[#1877F2] transition-colors flex items-center">
                 <Facebook className="w-4 h-4 mr-1" /> Facebook
               </a>
               <a href="https://www.youtube.com/@tarezaerp" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF0000] transition-colors flex items-center">
                 <Youtube className="w-4 h-4 mr-1" /> YouTube
               </a>
             </div>
             
             <div className="flex gap-2">
               <a href="tel:+263784553570" className="hover:text-primary transition-colors">Phone 1: +263 784553570</a> |
               <a href="tel:+263776699950" className="hover:text-primary transition-colors">Phone 2: +263 776699950</a>
             </div>
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
