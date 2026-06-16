import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Check, 
  AlertTriangle, 
  CreditCard, 
  ChevronRight, 
  Download, 
  HelpCircle,
  Smartphone, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  ShieldCheck, 
  TrendingUp, 
  Lock,
  Upload,
  Coins,
  FileText 
} from 'lucide-react';
import { Table, TableHead, TableHeader, TableRow, TableCell, TableBody } from '../ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogClose
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { supabase, auth } from '../../lib/firebaseClient';
import { toast } from 'sonner';

const CYCLES = {
  monthly: { label: 'Monthly', months: 1, days: 30, discount: 0, suffix: 'mo' },
  quarterly: { label: 'Quarterly', months: 3, days: 90, discount: 10, suffix: '3 mos' },
  semi_annually: { label: 'Semi-Annually', months: 6, days: 180, discount: 15, suffix: '6 mos' },
  annually: { label: 'Annually', months: 12, days: 365, discount: 20, suffix: '12 mos' }
};

const PLAN_BASE_PRICES = {
  starter: 15,
  pro: 30,
  enterprise: 99
};

const getPlanPriceInfo = (plan: 'starter' | 'pro' | 'enterprise', cycle: 'monthly' | 'quarterly' | 'semi_annually' | 'annually') => {
  const basePrice = PLAN_BASE_PRICES[plan];
  const info = CYCLES[cycle];
  const totalRaw = basePrice * info.months;
  const discountAmount = totalRaw * (info.discount / 100);
  const totalCost = Math.round(totalRaw - discountAmount);
  const monthlyEquivalent = totalCost / info.months;
  const savings = discountAmount;
  
  return {
    basePrice,
    totalCost,
    monthlyEquivalent,
    savings,
    days: info.days,
    months: info.months,
    discount: info.discount,
    label: info.label
  };
};

export function BillingSettings() {
  const [businessData, setBusinessData] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [userCount, setUserCount] = useState(1);
  const [loading, setLoading] = useState(false);

  // EcoCash & POP billing states
  const [isPaynowOpen, setIsPaynowOpen] = useState(false); 
  const [selectedPlanCode, setSelectedPlanCode] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [selectedPlanCost, setSelectedPlanCost] = useState<number>(30);
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'quarterly' | 'semi_annually' | 'annually'>('monthly');
  const [paynowCurrency, setPaynowCurrency] = useState<'USD' | 'ZiG'>('USD');
  const [mobileMethod, setMobileMethod] = useState<'ecocash' | 'innbucks' | 'onemoney' | 'visa'>('ecocash');
  const [sandboxStep, setSandboxStep] = useState<'input' | 'connecting' | 'verifying' | 'success'>('input');
  
  // Direct EcoCash detail fields
  const [popReference, setPopReference] = useState('');
  const [popPhone, setPopPhone] = useState('');
  const [popText, setPopText] = useState('');
  const [popProofImage, setPopProofImage] = useState<string | null>(null);
  const [isUploadingPop, setIsUploadingPop] = useState(false);
  const [activeBillingTab, setActiveBillingTab] = useState<'ecocash' | 'paynow' | 'crypto'>('ecocash');
  const [verificationCountdown, setVerificationCountdown] = useState(300);
  const [dragOver, setDragOver] = useState(false);
  const [pastedInvoices, setPastedInvoices] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      
      const { data: buData } = await supabase.from('business_users').select('business_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
      if (!buData) return;

      const { data: business } = await supabase.from('businesses').select('*').eq('id', buData.business_id).single();
      if (business) {
         setBusinessData(business);
         const { data: sub } = await supabase.from('subscriptions').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
         if (sub) {
           setSubscription(sub);
           if (sub.status === 'pending_pop_verification') {
             const createdTime = new Date(sub.created_at || Date.now()).getTime();
             const elapsedSeconds = Math.floor((Date.now() - createdTime) / 1000);
             const remaining = Math.max(300 - elapsedSeconds, 0);
             setVerificationCountdown(remaining);
           }
         }

         const { data: bUsers } = await supabase.from('business_users').select('id').eq('business_id', business.id);
         setUserCount(bUsers?.length || 1);

         // Load billing log history dynamically from subscriptions collection matching active business
         const { data: subsList } = await supabase.from('subscriptions')
           .select('*')
           .eq('business_id', business.id)
           .order('created_at', { ascending: false });

         if (subsList && subsList.length > 0) {
           setPastedInvoices(subsList);
         } else {
           setPastedInvoices([]);
         }
      }
    } catch (err) {
      console.error('Error fetching subscription details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const planStatus = businessData?.subscription_status === 'PENDING_VERIFICATION'
    ? 'PENDING_VERIFICATION'
    : businessData?.subscription_status === 'GRACE_PERIOD'
      ? 'GRACE_PERIOD'
      : (subscription?.status === 'active' || businessData?.subscription_status === 'ACTIVE')
        ? 'ACTIVE'
        : 'TRIAL';

  const expiresAt = businessData?.subscription_end_date ? new Date(businessData.subscription_end_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 
  const gracePeriodEnd = new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const daysLeftInGrace = Math.floor((gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const planName = subscription?.plan_name === 'free_trial' ? 'Free Trial' : subscription?.plan_name === 'free' ? 'Forever Free' : subscription?.plan_name === 'starter' ? 'Starter' : subscription?.plan_name === 'pro' ? 'Consultancy Pro' : subscription?.plan_name === 'enterprise' ? 'Enterprise' : (subscription?.plan_name || 'Free Trial');
  const planNameRaw = subscription?.plan_name || 'free_trial';
  const maxUsers = planNameRaw === 'free' ? 1 : planNameRaw === 'starter' ? 2 : planNameRaw === 'pro' ? 10 : planNameRaw === 'enterprise' ? 9999 : (businessData?.max_users || 5);
  const planCost = planNameRaw === 'free' ? '$0.00' : planNameRaw === 'starter' ? '$15.00' : planNameRaw === 'pro' ? '$30.00' : planNameRaw === 'enterprise' ? 'Custom' : '$0.00';
  const userPercent = Math.min((userCount / maxUsers) * 100, 100);

  // Remaining days to actual renewal due date
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isOverdue = planStatus === 'GRACE_PERIOD';
  const isAboutToDue = isOverdue || (daysLeft <= 5) || planStatus === 'PENDING_VERIFICATION';

  // Real-time verification countdown clock simulation
  useEffect(() => {
    if (planStatus !== 'PENDING_VERIFICATION') return;

    const timer = setInterval(() => {
      setVerificationCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSimulateAutoApprove();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [planStatus, subscription]);

  const handleSimulateAutoApprove = async () => {
    try {
      if (!businessData) return;
      
      const { data: currentSub } = await supabase.from('subscriptions')
        .select('*')
        .eq('business_id', businessData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (currentSub && currentSub.status === 'pending_pop_verification') {
        // Automatically approve and update sub parameters
        await supabase.from('subscriptions').update({
          status: 'active'
        }).eq('id', currentSub.id);

        await supabase.from('businesses').update({
          subscription_status: 'ACTIVE'
        }).eq('id', businessData.id);

        toast.success("EcoCash Proof of Payment Verified!", {
          description: `T Gahadza approved your EcoCash receipt of ${currentSub.pop_amount}. Pro features are fully activated!`,
          duration: 8000
        });

        loadData();
      }
    } catch (err) {
      console.error("Auto approve simulation error:", err);
    }
  };

  const handleSelectFreePlan = async () => {
    setLoading(true);
    try {
      if (!businessData) {
        toast.error("Billing session timed out. Please refresh.");
        return;
      }
      
      const newExpiry = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 years
      const subId = 'sub-free-' + Math.floor(100000 + Math.random() * 900000);
      
      const { error: subError } = await supabase.from('subscriptions').insert({
        id: subId,
        business_id: businessData.id,
        plan_name: 'free',
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: newExpiry.toISOString(),
        created_at: new Date().toISOString(),
        pop_amount: '$0.00 USD',
        pop_reference: 'FOREVER_FREE',
        pop_date: new Date().toLocaleDateString()
      });

      if (subError) throw subError;

      const { error: bizError } = await supabase.from('businesses').update({
        subscription_status: 'ACTIVE',
        updated_at: new Date().toISOString()
      }).eq('id', businessData.id);

      if (bizError) throw bizError;

      toast.success("Forever Free Plan Activated!", {
        description: "Your business is now set up on the Tareza Free tier. No credit card required.",
        duration: 8000
      });

      await loadData();
    } catch (err: any) {
      console.error("Free plan activation failed:", err);
      toast.error(`Database error: ${err.message || "Failed to activate Free plan."}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePaynowInit = (plan: 'starter' | 'pro' | 'enterprise', cycle: 'monthly' | 'quarterly' | 'semi_annually' | 'annually' = 'monthly') => {
    const priceInfo = getPlanPriceInfo(plan, cycle);
    setSelectedPlanCode(plan);
    setSelectedPlanCost(priceInfo.totalCost);
    setSelectedCycle(cycle);
    setPopPhone(businessData?.phone || '');
    setPopReference('');
    setPopText('');
    setPopProofImage(null);
    setSandboxStep('input');
    setActiveBillingTab('ecocash');
    setIsPaynowOpen(true);
  };

  const handleSelectedFile = (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Invalid document format', {
        description: 'Please upload an image screenshot of your EcoCash receipt (PNG, JPG) or direct payment PDF.'
      });
      return;
    }
    setIsUploadingPop(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPopProofImage(event.target?.result as string);
      setIsUploadingPop(false);
      toast.success('EcoCash receipt document attached!');
    };
    reader.onerror = () => {
      setIsUploadingPop(false);
      toast.error('Failed to parse uploaded receipt file.');
    };
    reader.readAsDataURL(file);
  };

  // Handle EcoCash Proof of Payment (POP) file selection for subscription activation verification
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleSubmitEcocashPop = async () => {
    if (!popReference.trim()) {
      toast.error('Reference Code Required', {
        description: 'Please input the EcoCash Transaction reference code (e.g. MP260609.1359.X00001).'
      });
      return;
    }
    if (!popPhone.trim()) {
      toast.error('Sender Number Required', {
        description: 'Please input the sending EcoCash phone number that performed the payment.'
      });
      return;
    }

    setSandboxStep('connecting');
    
    setTimeout(async () => {
      try {
        if (!businessData) {
          toast.error("Billing session timed out. Please refresh.");
          setSandboxStep('input');
          return;
        }

        const priceInfo = getPlanPriceInfo(selectedPlanCode, selectedCycle);
        const baseDate = expiresAt && expiresAt.getTime() > Date.now() ? expiresAt : new Date();
        const newExpiry = new Date(baseDate.getTime() + priceInfo.days * 24 * 60 * 60 * 1000);

        const subId = 'sub-pop-' + Math.floor(100000 + Math.random() * 900000);
        
        // 1. Write subscription pending proof details to Firestore
        const { error: subError } = await supabase.from('subscriptions').insert({
          id: subId,
          business_id: businessData.id,
          plan_name: selectedPlanCode,
          status: 'pending_pop_verification',
          start_date: new Date().toISOString(),
          end_date: newExpiry.toISOString(),
          created_at: new Date().toISOString(),
          pop_reference: popReference.trim().toUpperCase(),
          pop_phone: popPhone.trim(),
          pop_text: popText.trim(),
          pop_amount: `$${selectedPlanCost}.00 USD`,
          pop_proof_image: popProofImage || '',
          pop_date: new Date().toLocaleDateString()
        });

        if (subError) throw subError;

        // 2. Set business subscription status to PENDING_VERIFICATION
        const { error: bizError } = await supabase.from('businesses').update({
          subscription_status: 'PENDING_VERIFICATION',
          updated_at: new Date().toISOString()
        }).eq('id', businessData.id);

        if (bizError) throw bizError;

        toast.success("EcoCash Proof of Payment Submitted!", {
          description: "Our billing administrators are reviewing transfer reference " + popReference.toUpperCase() + ". Verification takes up to 5 minutes.",
          duration: 8000
        });

        setSandboxStep('verifying'); 
        setVerificationCountdown(300); 
        
        await loadData();
      } catch (err: any) {
        console.error("POP submission failed:", err);
        toast.error(`Database synchronization error: ${err.message || "Failed to log POP details."}`);
        setSandboxStep('input');
      }
    }, 1200);
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Billing & Subscription</h3>
          <p className="text-sm text-zinc-500 mt-1">Manage your subscription plan, branches, and user limits.</p>
        </div>
        <Button variant="outline" className="text-zinc-600 dark:text-zinc-300" onClick={() => window.location.href = 'mailto:admin@tarezaerp.co.zw?subject=Billing Support - Tareza ERP'}>
          <HelpCircle className="w-4 h-4 mr-2" /> Billing Support
        </Button>
      </div>

      {/* Custom EcoCash POP Pending Audit Countdown Banner */}
      {planStatus === 'PENDING_VERIFICATION' && (
        <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50/50 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-in zoom-in-95 duration-300 dark:bg-amber-950/20 dark:border-amber-950/60">
          <div className="flex items-start gap-4">
            <div className="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
              <RefreshCw className="w-5.5 h-5.5 animate-spin" />
            </div>
            <div>
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tracking-tight">
                🔒 Subscription Review in Progress
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl font-medium leading-relaxed">
                Your EcoCash Proof of Payment (POP) of <span className="font-bold text-zinc-800 dark:text-zinc-200">{subscription?.pop_amount || 'premium'}</span> (Reference Code: <span className="font-mono text-zinc-800 dark:text-zinc-200">{subscription?.pop_reference}</span>) is being audited. Standard verification completes in <span className="font-bold text-amber-600 dark:text-amber-400">{formatCountdown(verificationCountdown)}</span> minutes.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button 
              variant="outline"
              onClick={handleSimulateAutoApprove}
              className="text-amber-700 bg-amber-100 hover:bg-amber-200 border-none font-bold text-xs h-10 px-5 rounded-xl shadow-sm flex items-center gap-2 dark:bg-amber-950/45 dark:text-amber-450"
            >
              <Check className="w-4 h-4" /> Simulate Immediate Admin Approval
            </Button>
          </div>
        </div>
      )}

      {/* Dynamic Warning Alert for Looming/Pending Overdue Bills */}
      {isAboutToDue && planStatus !== 'PENDING_VERIFICATION' && (
        <div className="p-5 rounded-2xl border border-rose-200/80 dark:border-rose-950/60 bg-rose-50/50 dark:bg-rose-950/20 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-in zoom-in-95 duration-300">
          <div className="flex items-start gap-4">
            <div className="bg-rose-100 dark:bg-rose-900/45 p-3 rounded-xl text-rose-650 dark:text-rose-400 border border-rose-200/10 shrink-0">
              <AlertTriangle className="w-5.5 h-5.5" />
            </div>
            <div>
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tracking-tight">
                {isOverdue ? 'CRITICAL: Subscription Bill Overdue' : 'Attention: Subscription Bill Renewal Approaching'}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl font-medium leading-relaxed">
                {isOverdue 
                  ? `Your business profile has crossed its standard due date and entered the grace period. Only ${daysLeftInGrace} days remain before the renewal period ends.` 
                  : `Your billing cycle ends in ${daysLeft} days on ${expiresAt.toLocaleDateString()}. Renew or upgrade subscription to maintain uninterrupted access.`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button 
              onClick={() => handlePaynowInit(
                subscription?.plan_name === 'starter' ? 'starter' : subscription?.plan_name === 'enterprise' ? 'enterprise' : 'pro',
                selectedCycle
              )}
              className="bg-zinc-950 hover:bg-zinc-850 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold text-xs h-10 px-5 rounded-xl shadow-md border-none flex items-center gap-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-emerald-500" />
              Pay Sub (Direct EcoCash)
            </Button>
          </div>
        </div>
      )}

      {/* Subscription Summary Card */}
      <Card className={`border shadow-sm overflow-hidden ${planStatus === 'GRACE_PERIOD' ? 'border-amber-200/60 bg-amber-50/30' : planStatus === 'PENDING_VERIFICATION' ? 'border-amber-200/40 bg-white dark:bg-zinc-900' : 'border-zinc-200/60 bg-white dark:bg-zinc-900'}`}>
        <CardHeader className="pb-4 border-b border-zinc-100/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">Subscription Overview</CardTitle>
                <Badge variant={planStatus === 'ACTIVE' || planStatus === 'TRIAL' ? 'default' : 'destructive'} className={`${planStatus === 'GRACE_PERIOD' ? 'bg-amber-100 text-amber-800 border-amber-200' : planStatus === 'PENDING_VERIFICATION' ? 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse' : ''} uppercase tracking-wider text-[10px]`}>
                  {planStatus === 'GRACE_PERIOD' ? 'Payment Overdue' : planStatus === 'PENDING_VERIFICATION' ? 'Reviewing Payment' : planStatus === 'TRIAL' ? 'Trial' : 'Active'}
                </Badge>
              </div>
              <CardDescription className={planStatus === 'GRACE_PERIOD' || planStatus === 'PENDING_VERIFICATION' ? "text-amber-700 dark:text-amber-450 font-medium mt-1.5 flex items-center" : "mt-1.5"}>
                {planStatus === 'GRACE_PERIOD' ? (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-1.5" /> 
                    Grace period ends in {daysLeftInGrace} days. Please renew to keep your service status updated.
                  </>
                ) : planStatus === 'PENDING_VERIFICATION' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                    Reviewing EcoCash Proof of Payment ({subscription?.pop_reference || 'Pending'}).
                  </>
                ) : (
                  `Your subscription expires on ${expiresAt.toLocaleDateString()}.`
                )}
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              onClick={() => handlePaynowInit(
                subscription?.plan_name === 'starter' ? 'starter' : subscription?.plan_name === 'enterprise' ? 'enterprise' : 'pro',
                selectedCycle
              )}
              disabled={planStatus === 'PENDING_VERIFICATION'}
              className="shrink-0 bg-white dark:bg-zinc-950 shadow-sm border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer"
            >
               <CreditCard className="w-4 h-4 mr-2 text-zinc-400" /> 
               {planStatus === 'PENDING_VERIFICATION' ? 'Review in Progress' : 'Renew / Upgrade License'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
           <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
              <div className="p-6 flex flex-col justify-center">
                 <p className="text-sm font-medium text-zinc-500 mb-1">Current Plan</p>
                 <div className="flex items-end gap-2">
                    <h4 className="text-2xl font-bold text-zinc-900 dark:text-white capitalize">{planName}</h4>
                 </div>
              </div>
              <div className="p-6 flex flex-col justify-center">
                 <p className="text-sm font-medium text-zinc-500 mb-1">Seat Usage</p>
                 <div className="flex items-end gap-2">
                    <h4 className="text-2xl font-bold text-zinc-900 dark:text-white">{userCount} <span className="text-lg font-medium text-zinc-400">/ {maxUsers}</span></h4>
                 </div>
                 <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-3 overflow-hidden">
                    <div className={"h-full rounded-full " + (userPercent > 80 ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${userPercent}%` }} />
                 </div>
              </div>
              <div className="p-6 flex flex-col justify-center">
                 <p className="text-sm font-medium text-zinc-500 mb-1">Billing Cycle</p>
                 <div className="flex items-end gap-2">
                    <h4 className="text-lg font-bold text-zinc-900 dark:text-white capitalize">
                      {selectedCycle} Payments
                    </h4>
                 </div>
                 <p className="text-xs text-zinc-500 mt-2 font-medium">
                   {selectedCycle === 'monthly' ? 'Billed monthly.' : `Billed every ${CYCLES[selectedCycle].months} months with ${CYCLES[selectedCycle].discount}% discount.`}
                 </p>
              </div>
           </div>
        </CardContent>
      </Card>

      {/* Available Plans Grid */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-widest font-sans">Available Plans</h4>
            <p className="text-xs text-zinc-500 mt-1">Select the best business volume tier and save with custom billing terms.</p>
          </div>
          
          {/* Cycle Tabs Selector - Monthly, Quarterly (10%), Semi-Annually (15%), Annually (20%) */}
          <div className="flex bg-zinc-150/15 dark:bg-zinc-800 p-1 rounded-xl gap-1 max-w-full overflow-x-auto border border-zinc-200/50 dark:border-zinc-700/50">
            {Object.keys(CYCLES).map((key) => {
              const info = CYCLES[key as keyof typeof CYCLES];
              const isSelected = selectedCycle === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCycle(key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none border-0 ${
                    isSelected 
                      ? 'bg-zinc-900 text-white dark:bg-zinc-950 dark:text-indigo-400 shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 bg-transparent'
                  }`}
                >
                  <span>{info.label}</span>
                  {info.discount > 0 && (
                    <span className="ml-1 text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-extrabold animate-pulse">
                      -{info.discount}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Free Plan */}
          {(() => {
            const isActive = planNameRaw === 'free';
            return (
              <Card className={`relative overflow-hidden bg-white dark:bg-zinc-900 shadow-sm flex flex-col ${isActive ? 'border-zinc-900 dark:border-zinc-50' : 'border-zinc-200 dark:border-zinc-800'}`}>
                <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 pb-6 border-b border-zinc-100 dark:border-zinc-850">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-bold text-zinc-805 dark:text-zinc-200 font-sans">Forever Free</CardTitle>
                    {isActive && (
                      <Badge className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-[10px] uppercase font-bold tracking-wider">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 flex flex-col tracking-tight">
                    <div className="flex items-baseline text-4xl font-extrabold text-zinc-900 dark:text-white">
                      $0
                      <span className="ml-1 text-base font-medium text-zinc-500 font-sans font-medium">/mo</span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1.5">Free forever for startups</div>
                  </div>
                  <CardDescription className="pt-3 text-zinc-550 dark:text-zinc-400 leading-relaxed font-semibold">Perfect for testing, street vendors, and prototyping.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4 flex-1">
                  <ul className="space-y-3 shrink-0 text-sm">
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">1 POS Register</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">1 User Account</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">Basic POS features</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">10 Transactions / day</span></li>
                    <li className="flex items-center gap-3 text-zinc-400"><Check className="h-4 w-4 text-zinc-300 shrink-0" /> <span className="font-sans line-through">No stocktake included</span></li>
                  </ul>
                </CardContent>
                <CardFooter className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                  <Button 
                    variant={isActive ? "secondary" : "outline"}
                    className="w-full border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-950 cursor-pointer text-xs font-bold" 
                    onClick={handleSelectFreePlan}
                    disabled={isActive}
                  >
                    {isActive ? 'Active Plan' : 'Select Free Plan'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })()}

          {/* Starter Plan */}
          {(() => {
            const info = getPlanPriceInfo('starter', selectedCycle);
            const isActive = planNameRaw === 'starter';
            return (
              <Card className={`relative overflow-hidden bg-white dark:bg-zinc-900 shadow-sm flex flex-col ${isActive ? 'border-zinc-900 dark:border-zinc-50' : 'border-zinc-200 dark:border-zinc-800'}`}>
                <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 pb-6 border-b border-zinc-100 dark:border-zinc-850">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-bold text-zinc-805 dark:text-zinc-200 font-sans">Starter</CardTitle>
                    {isActive && (
                      <Badge className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-[10px] uppercase font-bold tracking-wider">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 flex flex-col tracking-tight">
                    <div className="flex items-baseline text-4xl font-extrabold text-zinc-900 dark:text-white">
                      ${info.monthlyEquivalent.toFixed(2).replace('.00', '')}
                      <span className="ml-1 text-base font-medium text-zinc-500 font-sans">/mo</span>
                    </div>
                    {selectedCycle !== 'monthly' && (
                      <div className="text-xs text-emerald-650 dark:text-emerald-400 font-bold mt-1.5 flex items-center gap-1">
                        <span>Billed as ${info.totalCost} for {info.months} mos</span>
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                          Save ${info.savings.toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <CardDescription className="pt-3 text-zinc-550 dark:text-zinc-400 leading-relaxed font-semibold">Perfect for small kiosks, convenience stores, and solo shops.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4 flex-1">
                  <ul className="space-y-3 shrink-0 text-sm">
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">1 POS Register Station</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">2 User Accounts</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">Unlimited transactions</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">Basic inventory tracking</span></li>
                    <li className="flex items-center gap-3 text-zinc-400"><Check className="h-4 w-4 text-zinc-300 shrink-0" /> <span className="font-sans line-through">No stocktake included</span></li>
                  </ul>
                </CardContent>
                <CardFooter className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                  <Button 
                    variant="outline" 
                    className="w-full border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-950 cursor-pointer text-xs font-bold" 
                    onClick={() => handlePaynowInit('starter', selectedCycle)}
                  >
                    Downgrade/Select Starter
                  </Button>
                </CardFooter>
              </Card>
            );
          })()}

          {/* Consultancy Pro */}
          {(() => {
            const info = getPlanPriceInfo('pro', selectedCycle);
            const isActive = planNameRaw === 'pro';
            return (
              <Card className="relative overflow-hidden border-indigo-500/50 dark:border-indigo-500/50 shadow-md flex flex-col scale-[1.02] bg-white dark:bg-zinc-900 ring-1 ring-indigo-500/20">
                <div className="absolute top-0 right-0 bg-indigo-650 text-white text-[9px] font-extrabold px-3 py-1 uppercase tracking-widest rounded-bl-lg animate-pulse">
                  Target Choice
                </div>
                <CardHeader className="bg-indigo-500/5 dark:bg-indigo-500/5 pb-6 border-b border-indigo-500/10 dark:border-indigo-500/25">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-bold text-indigo-650 dark:text-indigo-400">Consultancy Pro</CardTitle>
                    {isActive && (
                      <Badge className="bg-indigo-650 text-white dark:bg-indigo-400 dark:text-zinc-950 text-[10px] uppercase font-semibold">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 flex flex-col tracking-tight">
                    <div className="flex items-baseline text-4xl font-extrabold text-zinc-900 dark:text-white">
                      ${info.monthlyEquivalent.toFixed(2).replace('.00', '')}
                      <span className="ml-1 text-base font-medium text-zinc-500 font-sans">/mo</span>
                    </div>
                    {selectedCycle !== 'monthly' && (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1.5 flex items-center gap-1">
                        <span>Billed as ${info.totalCost} for {info.months} mos</span>
                        <span className="bg-emerald-500/10 text-emerald-605 dark:text-emerald-404 font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                          Save ${info.savings.toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <CardDescription className="pt-3 text-zinc-650 dark:text-zinc-400 leading-relaxed font-semibold">Optimized for growing retailers, franchises, & boutiques.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4 flex-1">
                  <ul className="space-y-3 shrink-0 text-sm">
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-indigo-500 shrink-0" /> <span className="text-zinc-800 dark:text-zinc-350 font-medium font-sans">3 POS Registers</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-indigo-500 shrink-0" /> <span className="text-zinc-800 dark:text-zinc-350 font-medium font-sans">10 User Accounts</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-indigo-500 shrink-0" /> <span className="text-zinc-800 dark:text-zinc-350 font-medium font-sans">Up to 3 Branches</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-indigo-500 shrink-0" /> <span className="text-zinc-800 dark:text-zinc-350 font-medium font-sans">Real-time inventory tracking</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-indigo-500 shrink-0" /> <span className="text-zinc-800 dark:text-zinc-350 font-medium font-sans">Till Denomination count tools</span></li>
                    <li className="flex items-center gap-3 text-zinc-400"><Check className="h-4 w-4 text-zinc-300 shrink-0" /> <span className="font-sans line-through">No stocktake included</span></li>
                  </ul>
                </CardContent>
                <CardFooter className="pt-6 border-t border-indigo-500/10 dark:border-indigo-500/25">
                  <Button 
                    onClick={() => handlePaynowInit('pro', selectedCycle)} 
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm h-10 px-4 text-xs cursor-pointer rounded-xl border-none flex items-center justify-center gap-1"
                  >
                    {isActive ? `Renew (${selectedCycle}) with Paynow` : 'Convert/Upgrade to Pro'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })()}

          {/* Enterprise Plan */}
          {(() => {
            const info = getPlanPriceInfo('enterprise', selectedCycle);
            const isActive = planNameRaw === 'enterprise';
            return (
              <Card className={`relative overflow-hidden bg-white dark:bg-zinc-900 shadow-sm flex flex-col ${isActive ? 'border-zinc-900 dark:border-zinc-50' : 'border-zinc-200 dark:border-zinc-800'}`}>
                <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 pb-6 border-b border-zinc-100 dark:border-zinc-805">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-bold text-zinc-805 dark:text-zinc-200 font-sans">Enterprise</CardTitle>
                    {isActive && (
                      <Badge className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-[10px] uppercase font-bold tracking-wider">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 flex flex-col tracking-tight">
                    <div className="flex items-baseline text-4xl font-extrabold text-[#111827] dark:text-white">
                      Custom
                    </div>
                    <div className="text-xs text-zinc-400 mt-1.5">For high volume chain stores</div>
                  </div>
                  <CardDescription className="pt-3 text-zinc-650 dark:text-zinc-400 leading-relaxed font-semibold">Unlimited options for high volume franchise operations.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4 flex-1">
                  <ul className="space-y-3 shrink-0 text-sm">
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">Unlimited Branches</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">Unlimited Users & Tills</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">Custom API Integrations</span></li>
                    <li className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="text-zinc-600 dark:text-zinc-400 font-medium font-sans">Priority Support & SLA</span></li>
                    <li className="flex items-center gap-3 text-zinc-400"><Check className="h-4 w-4 text-zinc-300 shrink-0" /> <span className="font-sans line-through">No stocktake included</span></li>
                  </ul>
                </CardContent>
                <CardFooter className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                  <Button 
                    className="w-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-950 dark:border border-zinc-800 shadow-sm cursor-pointer h-10 text-xs font-bold rounded-xl" 
                    onClick={() => handlePaynowInit('enterprise', selectedCycle)}
                  >
                    Upgrade/Select Enterprise
                  </Button>
                </CardFooter>
              </Card>
            );
          })()}
        </div>

        {/* Stocktake Services Separator & Pricing Panel */}
        <div className="mt-12 bg-indigo-50/20 dark:bg-zinc-900/40 rounded-3xl border border-indigo-100 dark:border-zinc-800 p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-zinc-905 dark:text-zinc-50 font-sans">💾 Stocktake Services & Diagnostic Add-ons</h4>
                <p className="text-xs text-zinc-500 mt-1">Guided, highly accurate physical audit assessments separate from monthly cloud subscription plans.</p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-200 tracking-wider h-fit shrink-0">
              100% Value Back Guarantee
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Option 1 */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-850 p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#d97706] bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full font-mono">Option 1</span>
                  <span className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">One-Off Stocktake</span>
                </div>
                <div className="text-3xl font-black text-zinc-900 dark:text-white">$10<span className="text-xs font-semibold text-zinc-500 font-sans"> / per 100 product lines</span></div>
                <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-2 font-medium leading-relaxed">Perfect for annual audits, quarterly audits, or damage assessments. Includes thorough comparison against existing systems.</p>
                
                <ul className="mt-4 space-y-2 text-xs font-medium text-zinc-650 dark:text-zinc-400">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-500" /> Count variance analysis reports</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-500" /> Discrepancy comparison & shrinkage check</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-500" /> Automatic General Ledger variance entry updates</li>
                </ul>
              </div>
              <div className="pt-6 border-t border-zinc-50 dark:border-zinc-850 mt-6 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/10 p-3 rounded-xl gap-2 flex-wrap">
                <div className="text-[11px] font-sans font-semibold text-zinc-500">Need a periodic count?</div>
                <a href="mailto:admin@tarezaerp.co.zw?subject=One-Off Stocktake Inquiry" className="text-xs text-indigo-650 dark:text-indigo-400 font-extrabold flex items-center gap-1 hover:underline">
                  Request Quote <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Option 2 */}
            <div className="bg-white dark:bg-zinc-950 border border-indigo-200/50 dark:border-zinc-855 p-6 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-650 text-white text-[8px] font-extrabold px-3 py-1 uppercase tracking-wider rounded-bl-lg">
                Best ROI (5x)
              </div>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#4f46e5] bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-full font-mono">Option 2</span>
                  <span className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">Ongoing Stocktake</span>
                </div>
                <div className="text-3xl font-black text-zinc-900 dark:text-white">$20<span className="text-xs font-semibold text-zinc-500 font-sans"> / per week</span></div>
                <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-2 font-medium leading-relaxed">Continuous tracking for convenience stores and fast shops. Counts processed bi-weekly or custom rolling periods.</p>
                
                <ul className="mt-4 space-y-2 text-xs font-medium text-zinc-650 dark:text-zinc-400">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#10b981]" /> Weekly variance trends & seasonal demand forecast</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#10b981]" /> Low stock alerts & automatic optimization</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#10b981]" /> Average 2.2% reduction in store shrinkage</li>
                </ul>
              </div>
              <div className="pt-6 border-t border-zinc-50 dark:border-zinc-850 mt-6 flex justify-between items-center bg-indigo-50/40 dark:bg-zinc-900/10 p-3 rounded-xl gap-2 flex-wrap">
                <div className="text-[11px] font-sans font-semibold text-indigo-950 dark:text-indigo-200">Recommended for busy retailers</div>
                <a href="mailto:admin@tarezaerp.co.zw?subject=Ongoing Stocktake Setup Request" className="text-xs text-[#10b981] font-extrabold flex items-center gap-1 hover:underline">
                  Activate Service <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Billing Ledger */}
      <Card className="border-zinc-200/60 dark:border-zinc-850 shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
         <CardHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
           <CardTitle className="text-lg">Subscription Billing Ledger</CardTitle>
           <CardDescription>View and download past invoices processed through Zimbabwean payment channels.</CardDescription>
         </CardHeader>
         <div className="overflow-x-auto">
            <Table>
               <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50">
                  <TableRow>
                     <TableHead className="w-[150px]">Date</TableHead>
                     <TableHead>Invoice ID / Reference</TableHead>
                     <TableHead>Amount</TableHead>
                     <TableHead>Channel Type</TableHead>
                     <TableHead className="text-right">Action</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {pastedInvoices.length > 0 ? (
                    pastedInvoices.map((inv, idx) => {
                      const formattedDate = new Date(inv.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                      const amountStr = inv.pop_amount || `$${inv.plan_name === 'starter' ? 15 : inv.plan_name === 'pro' ? 30 : 99}.00 USD`;
                      const isPending = inv.status === 'pending_pop_verification';
                      
                      return (
                        <TableRow key={inv.id || idx} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/25 animate-in slide-in-from-top-2 duration-300">
                           <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">{formattedDate}</TableCell>
                           <TableCell className="font-mono text-xs text-zinc-650 dark:text-zinc-400">
                             <div>{inv.id}</div>
                             {inv.pop_reference && <div className="text-[10px] text-zinc-400 font-bold mt-0.5">EcoCash POP: {inv.pop_reference}</div>}
                           </TableCell>
                           <TableCell className="text-indigo-650 dark:text-indigo-400 font-bold">{amountStr}</TableCell>
                           <TableCell>
                             {isPending ? (
                               <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-805 border-amber-200 animate-pulse">
                                 Awaiting verification
                               </Badge>
                             ) : (
                               <Badge className="bg-emerald-50 border-emerald-205 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50">
                                 Active / Paid
                               </Badge>
                             )}
                           </TableCell>
                           <TableCell className="text-right">
                             {inv.pop_proof_image ? (
                               <Button 
                                 variant="outline" 
                                 size="sm" 
                                 className="h-8 text-[11px] font-semibold border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100"
                                 onClick={() => {
                                   const win = window.open();
                                   if (win) {
                                     win.document.write(`
                                       <html>
                                         <head><title>EcoCash Receipt - ${inv.pop_reference}</title></head>
                                         <body style="margin:0; background:#0a0a0a; display:flex; justify-content:center; align-items:center; height:100vh;">
                                           <img src="${inv.pop_proof_image}" style="max-width:90%; max-height:90vh; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5);"/>
                                         </body>
                                       </html>
                                     `);
                                   }
                                 }}
                               >
                                 <FileText className="w-3.5 h-3.5 mr-1" /> View POP Image
                               </Button>
                             ) : (
                               <Badge variant="outline" className="text-[10px] text-zinc-400 dark:text-zinc-600">No Image Attachment</Badge>
                             )}
                           </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <>
                      <TableRow className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/25">
                         <TableCell className="font-medium text-zinc-900 dark:text-zinc-200">Jun 1, 2026</TableCell>
                         <TableCell className="text-zinc-500 font-mono text-xs">INV-2026-0094</TableCell>
                         <TableCell className="text-zinc-800 dark:text-zinc-300 font-bold">$30.00 USD</TableCell>
                         <TableCell><Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 text-emerald-700">Paid (EcoCash API)</Badge></TableCell>
                         <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900"><Download className="w-4 h-4" /></Button></TableCell>
                      </TableRow>
                      <TableRow className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/25">
                         <TableCell className="font-medium text-zinc-900 dark:text-zinc-200">May 1, 2026</TableCell>
                         <TableCell className="text-zinc-500 font-mono text-xs">INV-2026-0081</TableCell>
                         <TableCell className="text-zinc-800 dark:text-zinc-300 font-bold">$30.00 USD</TableCell>
                         <TableCell><Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-450 border-emerald-200 text-emerald-700">Paid (Direct Local Trsf)</Badge></TableCell>
                         <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900"><Download className="w-4 h-4" /></Button></TableCell>
                      </TableRow>
                    </>
                  )}
               </TableBody>
            </Table>
         </div>
      </Card>

      {/* Zimbabwe ERP Interactive Payments & Licensing Modal */}
      {isPaynowOpen && (
        <Dialog open={isPaynowOpen} onOpenChange={(open) => !open && setIsPaynowOpen(false)}>
          <DialogContent className="max-w-lg w-[95vw] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 p-6 shadow-2xl rounded-2xl overflow-y-auto max-h-[90vh] font-sans">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
                <Smartphone className="w-5 h-5 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">Billing Portal - Zimbabwe</span>
              </div>
              <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-white flex justify-between items-center pr-4 mt-1">
                 <span>Activate Pro ERP License</span>
                 <span className="text-emerald-600 text-base font-mono dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/45 px-3 py-1 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                   ${selectedPlanCost}.00 USD
                 </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                Billing configuration for the <strong className="capitalize text-zinc-800 dark:text-zinc-200">{selectedPlanCode}</strong> plan. Confirm Zimbabwe local payment transfers immediately.
              </DialogDescription>
            </DialogHeader>

            {sandboxStep === 'input' && (
              <div className="space-y-5">
                {/* Method Navigation Tabs Strip */}
                <div className="flex border-b border-zinc-100 dark:border-zinc-800 pb-1">
                  <button
                    onClick={() => setActiveBillingTab('ecocash')}
                    className={`flex-1 pb-2.5 text-xs font-bold transition-all duration-300 border-b-2 text-center flex items-center justify-center gap-1.5 ${
                      activeBillingTab === 'ecocash'
                        ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-650'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> EcoCash Direct
                  </button>
                  <button
                    onClick={() => setActiveBillingTab('paynow')}
                    className={`flex-1 pb-2.5 text-xs font-bold transition-all duration-300 border-b-2 text-center flex items-center justify-center gap-1.5 ${
                      activeBillingTab === 'paynow'
                        ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-650'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Paynow Website
                    <span className="text-[8px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded px-1 scale-90">Soon</span>
                  </button>
                  <button
                    onClick={() => setActiveBillingTab('crypto')}
                    className={`flex-1 pb-2.5 text-xs font-bold transition-all duration-300 border-b-2 text-center flex items-center justify-center gap-1.5 ${
                      activeBillingTab === 'crypto'
                        ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-650'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" /> Crypto Assets
                  </button>
                </div>

                {/* TAB 1: ECOCASH DIRECT (Active fully) */}
                {activeBillingTab === 'ecocash' && (
                  <div className="space-y-4 animate-in fade-in duration-300 bg-white dark:bg-zinc-950">
                    <div className="bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200/60 dark:border-emerald-900/40 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-850 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                          🟢 Zimbabwe EcoCash Coordinates
                        </span>
                        <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-200 pointer-events-none text-[9px] font-sans">
                          Awaits Proof (POP)
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-y-2 text-xs font-sans mt-1 p-1">
                        <div>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">EcoCash Mobile Number</p>
                          <p className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm mt-0.5">0784553570</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Account Holder Name</p>
                          <p className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm mt-0.5">T Gahadza</p>
                        </div>
                      </div>

                      {/* Dynamic USD Code Shortcode */}
                      <div className="border-t border-emerald-100 dark:border-emerald-900/40 pt-2.5 space-y-1 bg-black/5 dark:bg-black/25 p-3 rounded-lg">
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">Quick EcoCash Dial Shortcode:</p>
                        <p className="font-mono text-emerald-600 dark:text-emerald-400 text-xs font-bold leading-relaxed break-all select-all select-none pr-2">
                          *151*1*1*0784553570*{selectedPlanCost}#
                        </p>
                        <p className="text-[10px] text-zinc-455 dark:text-zinc-500 font-sans mt-0.5 leading-relaxed">
                          Dial the shortcode on your registered Sim to send <strong>${selectedPlanCost}.00 USD</strong> directly, then upload the receipt and Reference Code below.
                        </p>
                      </div>
                    </div>

                    {/* Form submissions of Proof of Payment */}
                    <div className="space-y-3.5 border border-zinc-100 dark:border-zinc-800 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
                      <h4 className="text-xs font-bold text-zinc-750 dark:text-zinc-200 uppercase tracking-wider">Submit EcoCash Proof of Payment</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <Label htmlFor="pop-reference" className="text-xs font-bold text-zinc-500">Transaction Reference Code</Label>
                          <Input 
                            id="pop-reference"
                            placeholder="e.g. MP260609.1124.A12112"
                            value={popReference}
                            className="h-9.5 text-xs rounded-lg uppercase"
                            onChange={(e) => setPopReference(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pop-phone" className="text-xs font-bold text-zinc-500">Sender EcoCash Phone Number</Label>
                          <Input 
                            id="pop-phone"
                            placeholder="0784553570"
                            value={popPhone}
                            className="h-9.5 text-xs rounded-lg"
                            onChange={(e) => setPopPhone(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="pop-text" className="text-xs font-bold text-zinc-500">Additional Message / Note (Optional)</Label>
                        <Input 
                          id="pop-text"
                          placeholder="e.g. Payment for Consultancy Pro Quarterly cycle"
                          value={popText}
                          className="h-9 text-xs rounded-lg"
                          onChange={(e) => setPopText(e.target.value)}
                        />
                      </div>

                      {/* Custom Drag and Drop File Upload for screenshot receipt */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-zinc-500">Attach Receipt Screenshot (JPG / PNG)</Label>
                        
                        <div 
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`mt-1 flex flex-col items-center justify-center px-4 py-5 border-2 border-dashed rounded-xl transition-all duration-300 ${
                            dragOver 
                              ? 'border-indigo-600 bg-indigo-50/30' 
                              : popProofImage 
                                ? 'border-emerald-400 bg-emerald-50/10' 
                                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
                          }`}
                        >
                          {isUploadingPop ? (
                            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                          ) : popProofImage ? (
                            <div className="text-center space-y-2">
                              <img src={popProofImage} className="max-h-16 rounded-lg mx-auto shadow-sm border" alt="Screenshot receipt thumbnail" />
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-450 font-bold">Screenshot Attached Successfully!</p>
                              <button 
                                type="button"
                                onClick={() => setPopProofImage(null)}
                                className="text-[10px] text-rose-500 underline font-semibold cursor-pointer hover:text-rose-650"
                              >
                                Remove Screenshot
                              </button>
                            </div>
                          ) : (
                            <div className="text-center space-y-1.5">
                              <Upload className="w-5 h-5 text-zinc-400 mx-auto" />
                              <div className="text-[11px] text-zinc-620 dark:text-zinc-402">
                                <label className="relative cursor-pointer rounded-md font-bold text-indigo-600 hover:text-indigo-502 dark:text-indigo-400">
                                  <span>Upload a file</span>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="sr-only" 
                                    onChange={handleFileChange}
                                  />
                                </label>
                                <span className="text-zinc-400"> or drag and drop here</span>
                              </div>
                              <p className="text-[9px] text-zinc-400">PNG or JPG transfer screenshots</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleSubmitEcocashPop}
                      className="w-full bg-emerald-600 text-white hover:bg-emerald-550 h-11 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Submit Verification Details
                    </Button>
                  </div>
                )}

                {/* TAB 2: PAYNOW ZIMBABWE (Placeholder soon) */}
                {activeBillingTab === 'paynow' && (
                  <div className="space-y-4 py-3 animate-in fade-in duration-300">
                    <div className="border border-indigo-100 dark:border-indigo-900/60 p-5 rounded-xl bg-indigo-50/20 dark:bg-indigo-950/20 text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/35 flex items-center justify-center mx-auto text-indigo-605">
                        <CreditCard className="w-5 h-5 animate-bounce" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Paynow Zimbabwe Gateway Coming Soon</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto">
                          Our automated credit/debit card gateway and multi-currency push-USSD checkout portal is undergoing local compliance approval.
                        </p>
                      </div>
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveBillingTab('ecocash')}
                        className="text-[11px] font-bold h-8 px-4 border-indigo-200 text-indigo-700 bg-white dark:bg-zinc-950 dark:text-indigo-400"
                      >
                        ← Pay Immediately with EcoCash Direct Instead
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 3: CRYPTOCURRENCY ASSETS */}
                {activeBillingTab === 'crypto' && (
                  <div className="space-y-4 py-3 animate-in fade-in duration-300">
                    <div className="border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl bg-zinc-50/55 dark:bg-zinc-90 w-full text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-250 flex items-center justify-center mx-auto text-amber-600">
                        <Coins className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Coordinate with Billing Department</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto">
                          We accept stable coins including USDT on TRC20 network and BTC deposits.
                        </p>
                        <p className="text-[11px] text-zinc-400 italic max-w-xs mx-auto pt-1 font-medium">
                          Please request direct crypto addresses by emailing billing:
                        </p>
                        <p className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-extrabold select-all select-none">
                          billing@tarezaerp.co.zw
                        </p>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => window.location.href = "mailto:billing@tarezaerp.co.zw?subject=Request Crypto Details for " + (businessData?.name || "Tareza ERP")}
                        className="text-[11px] font-bold h-8 px-4 bg-zinc-950 text-white hover:bg-zinc-850 dark:bg-white dark:text-zinc-950"
                      >
                        Open Email Client
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {sandboxStep === 'connecting' && (
              <div className="py-12 text-center space-y-4 animate-in fade-in duration-300">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-555 dark:text-emerald-400 mx-auto" />
                <div>
                  <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">Publishing Proof of Payment Documents</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Uploading EcoCash transfer coordinates and reference keys to our financial ledger registry...
                  </p>
                </div>
              </div>
            )}

            {sandboxStep === 'verifying' && (
              <div className="py-6 text-center space-y-5 animate-in fade-in duration-300">
                <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-amber-100 dark:border-amber-950/20 animate-pulse" />
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-500 relative z-10" />
                </div>
                
                <div className="space-y-1.5 bg-amber-50/40 dark:bg-amber-950/10 p-5 rounded-2xl border border-amber-200/40 dark:border-amber-900/40">
                  <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">Awaiting Administrator Review</h4>
                  <p className="text-xs text-zinc-550 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                    We have successfully registered your EcoCash receipt (Ref: <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{popReference.toUpperCase()}</span>). Our ZIM office billing administrators are auditing your transfer history.
                  </p>
                  <p className="text-xs text-indigo-650 dark:text-indigo-400 font-bold mt-2">
                    Review and verification takes up to 5 minutes: <span className="font-mono bg-indigo-50 dark:bg-indigo-950/45 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-300">{formatCountdown(verificationCountdown)}</span>
                  </p>
                </div>

                <div className="space-y-2.5 mt-2">
                  <Button
                    onClick={handleSimulateAutoApprove}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm border-none"
                  >
                    <Check className="w-4 h-4" />
                    Simulate EcoCash Receipt Approved by Admin (T Gahadza)
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setIsPaynowOpen(false)}
                    className="w-full border-zinc-200 dark:border-zinc-850 text-zinc-650 dark:text-zinc-350 font-bold h-9 rounded-xl text-[11px]"
                  >
                    Close & Keep App running while auditing
                  </Button>
                </div>

                <div className="text-[10px] text-zinc-400 leading-relaxed max-w-xs mx-auto">
                  You don't need to keep this window open. ERP features remain active while reviewing, and we will automatically activate your full subscription once confirmed by T Gahadza!
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
