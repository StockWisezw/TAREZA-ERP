import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { fireAuth, supabase } from '../lib/firebaseClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Store, TrendingUp, ShieldCheck, Mail, Key, Fingerprint, Github, Sparkles, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { TarezaLogo } from '../components/ui/Logo';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState(() => {
    return `TZ-${Math.floor(100000 + Math.random() * 900000)}/${new Date().getFullYear()}`;
  });
  const [planChoice, setPlanChoice] = useState('TRIAL');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Developer security states
  const [showDevModal, setShowDevModal] = useState(false);
  const [devPassword, setDevPassword] = useState('');
  
  const navigate = useNavigate();

  const handleDemoLogin = async (role: 'developer' | 'client', providedPassword?: string) => {
    if (role === 'developer') {
      if (providedPassword !== 'tareza1302') {
        setShowDevModal(true);
        return;
      }
    }
    
    setLoading(true);
    const demoEmail = role === 'developer' ? 'dev@tarezaerp.co.zw' : 'client@tarezaerp.co.zw';
    const demoPassword = role === 'developer' ? 'tareza1302' : 'Password123!';
    const demoFirstName = role === 'developer' ? 'Alex' : 'Sarah';
    const demoLastName = role === 'developer' ? 'SystemDev' : 'BranchClient';
    const demoBusinessName = role === 'developer' ? 'Antigravity Micro-Labs' : 'Global Retail Network';

    try {
      // First attempt standard Firebase Auth login with dev/client credentials
      await signInWithEmailAndPassword(fireAuth, demoEmail, demoPassword);
      toast.success(`Successfully logged in as ${role === 'developer' ? 'System Developer' : 'Business Client'}!`);
      navigate('/dashboard');
    } catch (err: any) {
      // If the email is not found or has wrong credentials, dynamically register the brand-new workspace
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        try {
          toast.info(`Initializing secure sandbox session for demo ${role}...`);
          const userCredential = await createUserWithEmailAndPassword(fireAuth, demoEmail, demoPassword);
          const firebaseUser = userCredential.user;
          if (!firebaseUser) throw new Error("Authentication flow failed.");

          const user = { id: firebaseUser.uid, email: firebaseUser.email };

          // Build Firestore Profile
          await supabase.from('profiles').insert([
            { id: user.id, first_name: demoFirstName, last_name: demoLastName, email: user.email }
          ]);

          // Pre-generate IDs to avoid race conditions and secure sequence
          const newBusinessId = crypto.randomUUID();
          const newRoleId = crypto.randomUUID();
          const newBranchId = crypto.randomUUID();

          // Step 1: Establish tenancy link in business_users FIRST
          await supabase.from('business_users').insert([
            { id: user.id, business_id: newBusinessId, user_id: user.id, branch_id: newBranchId, role_id: newRoleId, is_active: true }
          ]);

          // Step 2: Set target active business ID cache
          const { setActiveBusinessId } = await import('../lib/firebaseClient');
          setActiveBusinessId(newBusinessId);

          // Step 3: Build Business
          const regNo = role === 'developer' ? 'TZ-999999/DEV' : 'TZ-888888/CLIENT';
          await supabase.from('businesses').insert([
            { 
              id: newBusinessId,
              name: demoBusinessName, 
              tax_number: regNo,
              created_at: new Date().toISOString() 
            }
          ]);

          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 90); // 90 days access for demo testing

          await supabase.from('subscriptions').insert([{
             business_id: newBusinessId,
             plan_name: 'pro',
             status: 'active',
             start_date: new Date().toISOString(),
             end_date: endDate.toISOString()
          }]);

          await supabase.from('roles').insert([
            { id: newRoleId, business_id: newBusinessId, name: role === 'developer' ? 'Developer' : 'Admin', description: 'System Administrator Access' }
          ]);

          await supabase.from('branches').insert([
            { id: newBranchId, business_id: newBusinessId, name: role === 'developer' ? 'Testing Lab Alpha' : 'Downtown Branch Store', type: 'retail' }
          ]);

          await supabase.from('categories').insert([
            { business_id: newBusinessId, name: 'General' },
            { business_id: newBusinessId, name: 'Electronics' },
            { business_id: newBusinessId, name: 'Beverages' },
            { business_id: newBusinessId, name: 'Office Supplies' }
          ]);

          toast.success(`Demo workspace initialized! Logged in as ${role === 'developer' ? 'System Developer' : 'Business Client'}.`);
          navigate('/dashboard');
        } catch (setupErr: any) {
          // If signup fails because user exists under a different setup/invalid state, attempt forced sign-in secondary bypass
          try {
            await signInWithEmailAndPassword(fireAuth, demoEmail, demoPassword);
            toast.success(`Logged in as ${role === 'developer' ? 'System Developer' : 'Business Client'}!`);
            navigate('/dashboard');
          } catch (secondaryErr: any) {
            console.error(secondaryErr);
            toast.error(`Demo initialization failed: ${setupErr.message || setupErr}`);
          }
        }
      } else {
        toast.error(`Demo login error: ${err.message || err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Client-side validation states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedReg, setTouchedReg] = useState(false);

  // Validation functions
  const validateEmail = (emailVal: string) => {
    if (!emailVal) return 'Email is required';
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailVal)) {
      return 'Please enter a valid email address (e.g. name@domain.com)';
    }
    return null;
  };

  const validateRegistration = (regVal: string) => {
    if (!regVal) return 'Business registration number is required';
    const regRegex = /^(?:[A-Za-z0-9-]+\s*)?\d{1,6}\/\d{2,4}$/;
    if (!regRegex.test(regVal.trim())) {
      return 'Must be a valid format: number/year (e.g., 12345/2026)';
    }
    return null;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    let authError = null;

    if (isSignUp) {
      if (!firstName || !lastName || !businessName) {
        toast.error("Please fill in your name and business details");
        setLoading(false);
        return;
      }

      const emailValidation = validateEmail(email);
      const regValidation = validateRegistration(registrationNumber);

      if (emailValidation || regValidation) {
        setTouchedEmail(true);
        setTouchedReg(true);
        setEmailError(emailValidation);
        setRegError(regValidation);
        
        if (emailValidation) {
          toast.error(emailValidation);
        } else if (regValidation) {
          toast.error(regValidation);
        }
        
        setLoading(false);
        return;
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(fireAuth, email, password);
        const firebaseUser = userCredential.user;
        
        if (!firebaseUser) throw new Error("User creation failed");
        
        const user = { id: firebaseUser.uid, email: firebaseUser.email };

        // Setup Firebase Data
        await supabase.from('profiles').insert([
          { id: user.id, first_name: firstName, last_name: lastName, email: user.email }
        ]);

        const endDate = new Date();
        if (planChoice === 'TRIAL') {
           endDate.setDate(endDate.getDate() + 14); // 14-day free trial
        } else {
           endDate.setDate(endDate.getDate() + 30); // 30-day Pro plan
        }

        // Pre-generate IDs to avoid race conditions and secure sequence
        const newBusinessId = crypto.randomUUID();
        const newRoleId = crypto.randomUUID();
        const newBranchId = crypto.randomUUID();

        // Step 1: Establish tenancy link in business_users FIRST
        await supabase.from('business_users').insert([
          { id: user.id, business_id: newBusinessId, user_id: user.id, branch_id: newBranchId, role_id: newRoleId, is_active: true }
        ]);

        // Step 2: Set target active business ID cache
        const { setActiveBusinessId } = await import('../lib/firebaseClient');
        setActiveBusinessId(newBusinessId);

        // Step 3: Build Business
        await supabase.from('businesses').insert([
          { 
            id: newBusinessId,
            name: businessName, 
            tax_number: registrationNumber,
            created_at: new Date().toISOString() 
          }
        ]);

        await supabase.from('subscriptions').insert([{
           business_id: newBusinessId,
           plan_name: planChoice === 'TRIAL' ? 'free_trial' : 'pro',
           status: 'active',
           start_date: new Date().toISOString(),
           end_date: endDate.toISOString()
        }]);

        await supabase.from('roles').insert([
          { id: newRoleId, business_id: newBusinessId, name: 'Admin', description: 'System Administrator' }
        ]);

        await supabase.from('branches').insert([
          { id: newBranchId, business_id: newBusinessId, name: 'Main Branch', type: 'retail' }
        ]);

        await supabase.from('categories').insert([
          { business_id: newBusinessId, name: 'General' }
        ]);

        // Trigger email and WhatsApp signup alerts in background securely
        fetch('/api/notifications/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'signup',
            payload: {
              email: email,
              firstName: firstName,
              lastName: lastName,
              businessName: businessName,
              plan: planChoice === 'TRIAL' ? '14-Day Free Trial' : '30-Day Pro Plan'
            }
          })
        }).catch(err => console.error("Signup notification dispatch failed", err));

        toast.success('Signup successful! Welcome to Tareza ERP.');
        navigate('/dashboard');
      } catch (error: any) {
        authError = error;
      }
    } else {
      const emailValidation = validateEmail(email);
      if (emailValidation) {
        setTouchedEmail(true);
        setEmailError(emailValidation);
        toast.error(emailValidation);
        setLoading(false);
        return;
      }

      const isDeveloperEmail = email?.toLowerCase().endsWith('@tarezaerp.co.zw') || 
                               email?.toLowerCase() === 'admin@tarezaerp.co.zw' || 
                               email?.toLowerCase() === 'developer@tarezaerp.co.zw' || 
                               email?.toLowerCase() === 'dev@tarezaerp.co.zw' || 
                               email?.toLowerCase() === 'tapsforex@gmail.com';

      try {
        const userCredential = await signInWithEmailAndPassword(fireAuth, email, password);
        const firebaseUser = userCredential.user;

        toast.success('Welcome back to Tareza ERP');
        navigate('/dashboard');
      } catch (error: any) {
        if (isDeveloperEmail && password === 'tareza1302') {
          // Fall back to registration & seeding for premium seamless developer access
          try {
            toast.info(`Initializing secure sandbox session for developer ${email}...`);
            const userCredential = await createUserWithEmailAndPassword(fireAuth, email, password);
            const firebaseUser = userCredential.user;
            if (!firebaseUser) throw new Error("Authentication flow failed.");

            const user = { id: firebaseUser.uid, email: firebaseUser.email };

            // Build Firestore Profile
            await supabase.from('profiles').insert([
              { id: user.id, first_name: 'Alex', last_name: 'Developer', email: user.email }
            ]);

            // Pre-generate IDs to avoid race conditions and secure sequence
            const newBusinessId = crypto.randomUUID();
            const newRoleId = crypto.randomUUID();
            const newBranchId = crypto.randomUUID();

            // Step 1: Establish tenancy link in business_users FIRST
            await supabase.from('business_users').insert([
              { id: user.id, business_id: newBusinessId, user_id: user.id, branch_id: newBranchId, role_id: newRoleId, is_active: true }
            ]);

            // Step 2: Set target active business ID cache
            const { setActiveBusinessId } = await import('../lib/firebaseClient');
            setActiveBusinessId(newBusinessId);

            // Step 3: Build Business
            await supabase.from('businesses').insert([
              { 
                id: newBusinessId,
                name: 'Developer Labs', 
                tax_number: 'TZ-999999/DEV',
                created_at: new Date().toISOString() 
              }
            ]);

            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 90); // 90 days access for demo testing

            await supabase.from('subscriptions').insert([{
               business_id: newBusinessId,
               plan_name: 'pro',
               status: 'active',
               start_date: new Date().toISOString(),
               end_date: endDate.toISOString()
            }]);

            await supabase.from('roles').insert([
              { id: newRoleId, business_id: newBusinessId, name: 'Developer', description: 'System Administrator Access' }
            ]);

            await supabase.from('branches').insert([
              { id: newBranchId, business_id: newBusinessId, name: 'Testing Lab Alpha', type: 'retail' }
            ]);

            await supabase.from('categories').insert([
              { business_id: newBusinessId, name: 'General' },
              { business_id: newBusinessId, name: 'Electronics' },
              { business_id: newBusinessId, name: 'Beverages' },
              { business_id: newBusinessId, name: 'Office Supplies' }
            ]);

            toast.success(`Demo developer workspace initialized! Logged in as ${email}.`);
            navigate('/dashboard');
            return;
          } catch (setupErr: any) {
            // Already registered or fallback direct sign-in with master password
            try {
              await signInWithEmailAndPassword(fireAuth, email, password);
              toast.success(`Logged in as Developer (${email})!`);
              navigate('/dashboard');
              return;
            } catch (secondaryErr: any) {
              console.error(secondaryErr);
              authError = secondaryErr;
            }
          }
        } else {
          authError = error;
        }
      }
    }

    if (authError) {
      toast.error(authError.message || "Authentication failed. Please check your credentials.");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const emailValidation = validateEmail(email);
    if (emailValidation) {
      setTouchedEmail(true);
      setEmailError(emailValidation);
      toast.error(emailValidation);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.sendPasswordReset(email);
      if (error) throw error;
      toast.success("Password recovery email sent! Please check your inbox.");
      setIsForgotPassword(false);
    } catch (error: any) {
      toast.error(error.message || "Could not send password recovery email");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Failed to launch " + provider + " authentication");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex animate-fade-in">
      {/* Left Pane - Branding (Engaging, modern and bright) */}
      <div className="hidden lg:flex flex-col flex-1 bg-gradient-to-br from-zinc-50 via-indigo-50 to-zinc-100 text-zinc-900 p-12 justify-between relative overflow-hidden">
        {/* Elegant geometric grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:16px_16px] opacity-100"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-purple-200/20 blur-3xl" />

        <div className="relative z-10 flex items-center bg-white/40 p-3 px-4 rounded-2xl border border-white/60 shadow-sm backdrop-blur-md max-w-fit">
          <TarezaLogo size="md" variant="light" />
        </div>
        
        {/* Center Live Sandbox Stats Box Draft */}
        <div className="relative z-10 mx-auto w-full max-w-md bg-white/80 backdrop-blur-lg border border-white rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-150 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Live Demo Analytics</span>
            </div>
            <span className="text-[10px] font-mono text-indigo-700 font-extrabold bg-indigo-50 px-2 py-0.5 rounded-full">Harare HQ</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-50/80 border border-zinc-100 p-3.5 rounded-xl">
              <span className="text-[10px] text-zinc-500 block font-semibold">Today's Net Sales</span>
              <span className="text-xl font-black text-zinc-900 block mt-0.5">$1,842.50</span>
              <span className="text-[9px] text-emerald-600 font-bold font-mono">↑ 18.5% today</span>
            </div>
            <div className="bg-zinc-50/80 border border-zinc-100 p-3.5 rounded-xl">
              <span className="text-[10px] text-zinc-500 block font-semibold">Offline Defense Status</span>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                SECURED & SYNCED
              </span>
              <span className="text-[9px] text-zinc-400 font-medium block mt-1">Ready for load shedding</span>
            </div>
          </div>

          <div className="p-3 bg-indigo-50/55 border border-indigo-100/60 rounded-xl space-y-1">
            <div className="flex justify-between text-[11px] font-mono font-bold text-indigo-950">
              <span>Biller Multi-Currency Sync:</span>
              <span className="text-indigo-650">EcoCash + InnBucks</span>
            </div>
            <p className="text-[10px] text-indigo-850/80 leading-normal">
              Internal ZiG currency calculator synchronized automatically to primary exchange slider.
            </p>
          </div>
        </div>
        
        <div className="relative z-10 space-y-4 max-w-lg">
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-zinc-900">
            The integrated cloud ERP for fast-growing businesses.
          </h1>
          <p className="text-zinc-600 text-sm font-medium leading-relaxed">
            Manage your inventory, process sales, oversee procurement, and generate compliant financial reports effortlessly.
          </p>
          
          <div className="flex space-x-6 pt-2">
            <div className="flex items-center space-x-2 text-sm font-bold text-zinc-700">
              <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>Enterprise Grade</span>
            </div>
            <div className="flex items-center space-x-2 text-sm font-bold text-zinc-700">
              <TrendingUp className="w-5 h-5 text-cyan-600 shrink-0" />
              <span>Real-time Reports & Insights</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 via-indigo-50/10 to-purple-50/20 relative overflow-hidden">
        {/* Lighter, brand-inspired background element layers */}
        <div className="absolute -top-10 -right-10 w-96 h-96 rounded-full bg-indigo-200/25 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-80 h-80 rounded-full bg-purple-200/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-96 h-96 rounded-full bg-cyan-200/15 blur-3xl pointer-events-none" />

        <div className="absolute top-8 left-8 z-20">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-950 font-semibold rounded-xl text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </div>

        <Card className="w-full max-w-md border border-zinc-200/80 shadow-2xl rounded-2xl overflow-hidden font-sans bg-white/95 backdrop-blur-md relative z-10">
          <CardHeader className="space-y-4 pb-6 pt-8 px-8 border-b border-border/40 bg-zinc-50/40 flex flex-col items-center">
            {/* Centered professional brand logo */}
            <TarezaLogo size="md" showSubtitle={true} className="mb-1" />
            <div className="space-y-1.5 text-center w-full">
              <CardTitle className="text-2xl font-black tracking-tight text-zinc-900">
                {isForgotPassword 
                  ? 'Reset Password' 
                  : (isSignUp ? 'Create an account' : 'Welcome back')}
              </CardTitle>
              <CardDescription className="text-sm text-zinc-500 font-medium">
                {isForgotPassword 
                  ? 'Enter your email address and we\'ll send you a link to reset your password.' 
                  : (isSignUp ? 'Enter your details to get started' : 'Enter your email and password to access your account')}
              </CardDescription>
            </div>
          </CardHeader>

          {/* Quick Demo Portals Switcher */}
          {!isForgotPassword && (
            <div className="px-8 pt-6 pb-2">
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse shrink-0" />
                    <span>Quick Demo Login Portal</span>
                  </div>
                  <span className="text-[9px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    Sandbox Mode
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-normal">
                  Bypass standard manual registration. Instantly log in or auto-seed a fully configured sandbox workspace:
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDemoLogin('developer')}
                    disabled={loading}
                    className="h-10 text-[11px] font-bold flex items-center justify-center gap-2 border border-zinc-200 hover:border-zinc-350 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950 shadow-xs cursor-pointer select-none rounded-xl"
                  >
                    <Fingerprint className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>As Developer</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDemoLogin('client')}
                    disabled={loading}
                    className="h-10 text-[11px] font-bold flex items-center justify-center gap-2 border border-zinc-200 hover:border-zinc-350 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950 shadow-xs cursor-pointer select-none rounded-xl"
                  >
                    <Store className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>As Business / Client</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={isForgotPassword ? handleForgotPassword : handleAuth}>
            <CardContent className="space-y-5 p-8">
              {isForgotPassword ? (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="admin@tarezaerp.co.zw" 
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (touchedEmail) {
                        setEmailError(validateEmail(e.target.value));
                      }
                    }}
                    onBlur={() => {
                      setTouchedEmail(true);
                      setEmailError(validateEmail(email));
                    }}
                    required
                    className={`h-11 bg-zinc-50 focus-visible:ring-primary focus-visible:bg-white border-zinc-200 ${
                      emailError ? 'border-red-500 focus-visible:ring-red-500' : ''
                    }`}
                  />
                  {emailError && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{emailError}</p>
                  )}
                </div>
              ) : (
                <>
                  {isSignUp && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">First Name</Label>
                          <Input 
                            id="firstName" 
                            placeholder="John" 
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required={isSignUp}
                            className="h-11 bg-zinc-50 focus-visible:ring-primary focus-visible:bg-white border-zinc-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Last Name</Label>
                          <Input 
                            id="lastName" 
                            placeholder="Doe" 
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required={isSignUp}
                            className="h-11 bg-zinc-50 focus-visible:ring-primary focus-visible:bg-white border-zinc-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="businessName" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Business Name</Label>
                          <Input 
                            id="businessName" 
                            placeholder="Acme Trading Corp" 
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            required={isSignUp}
                            className="h-11 bg-zinc-50 focus-visible:ring-primary focus-visible:bg-white border-zinc-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="registrationNumber" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Registration Number</Label>
                            <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold">System Generated</span>
                          </div>
                          <Input 
                            id="registrationNumber" 
                            placeholder="e.g. 12345/2026" 
                            value={registrationNumber}
                            readOnly
                            required={isSignUp}
                            className={`h-11 bg-zinc-100 cursor-not-allowed border-zinc-200 select-all font-mono font-medium`}
                          />
                          <p className="text-[10px] text-zinc-400">An automatic local registration ID has been generated for your business workspace.</p>
                          {regError && (
                            <p className="text-xs text-red-500 mt-1 font-medium">{regError}</p>
                          )}
                        </div>
                        <div className="space-y-2 pb-2">
                          <Label className="text-xs uppercase tracking-wider font-semibold text-zinc-500 mb-2 block">Choose Plan</Label>
                          <div className="grid grid-cols-2 gap-3">
                            <div 
                               className={`border rounded-lg p-3 cursor-pointer transition-all ${planChoice === 'TRIAL' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-white hover:bg-zinc-50'}`}
                               onClick={() => setPlanChoice('TRIAL')}
                            >
                               <p className="font-bold text-zinc-900 text-sm">14-Day Free Trial</p>
                               <p className="text-xs text-zinc-500">Explore all features</p>
                            </div>
                            <div 
                               className={`border rounded-lg p-3 cursor-pointer transition-all ${planChoice === 'PRO' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-white hover:bg-zinc-50'}`}
                               onClick={() => setPlanChoice('PRO')}
                            >
                               <p className="font-bold text-zinc-900 text-sm">Pro ($50/mo)</p>
                               <p className="text-xs text-zinc-500">Includes ERP + Stocktake</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="admin@tarezaerp.co.zw" 
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (touchedEmail) {
                          setEmailError(validateEmail(e.target.value));
                        }
                      }}
                      onBlur={() => {
                        setTouchedEmail(true);
                        setEmailError(validateEmail(email));
                      }}
                      required
                      className={`h-11 bg-zinc-50 focus-visible:ring-primary focus-visible:bg-white border-zinc-200 ${
                        emailError ? 'border-red-500 focus-visible:ring-red-500' : ''
                      }`}
                    />
                    {emailError && (
                      <p className="text-xs text-red-500 mt-1 font-medium">{emailError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Password</Label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            setEmailError(null);
                            setTouchedEmail(false);
                          }}
                          className="text-xs text-primary hover:text-primary/80 font-medium hover:underline focus:outline-none font-sans"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input 
                      id="password" 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 bg-zinc-50 focus-visible:ring-primary focus-visible:bg-white border-zinc-200"
                    />
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 px-8 pb-8">
              {isForgotPassword ? (
                <>
                  <Button type="submit" className="w-full h-11 text-secondary font-bold text-base shadow-sm shadow-primary/20" disabled={loading}>
                    {loading ? 'Processing...' : 'Send Password Reset Link'}
                  </Button>
                  <div className="text-center text-sm text-zinc-500/80">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsForgotPassword(false);
                        setEmailError(null);
                        setTouchedEmail(false);
                      }}
                      className="text-primary hover:underline font-semibold"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Button type="submit" className="w-full h-11 text-secondary font-bold text-base shadow-sm shadow-primary/20" disabled={loading}>
                    {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                  </Button>

                  <div className="relative w-full my-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-white dark:bg-zinc-950 text-zinc-400 font-medium font-sans">Or continue with</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="h-10 font-semibold text-xs flex items-center justify-center space-x-2 border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 bg-white"
                      onClick={() => handleOAuthSignIn('google')}
                      disabled={loading}
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4">
                         <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                         <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                         <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                         <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span>Google</span>
                    </Button>

                    <Button 
                      type="button" 
                      variant="outline" 
                      className="h-10 font-semibold text-xs flex items-center justify-center space-x-2 border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 bg-white"
                      onClick={() => handleOAuthSignIn('github')}
                      disabled={loading}
                    >
                      <Github className="w-4 h-4 text-[#24292e]" />
                      <span>GitHub</span>
                    </Button>
                  </div>

                  <div className="text-center text-sm text-zinc-500 py-1">
                    {isSignUp ? 'Already have an account? ' : 'Don\'t have an account? '}
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setIsForgotPassword(false);
                        setEmailError(null);
                        setRegError(null);
                        setTouchedEmail(false);
                        setTouchedReg(false);
                      }}
                      className="text-primary hover:underline font-semibold"
                    >
                      {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                  </div>

                  <div className="text-center pt-3 border-t border-zinc-100 dark:border-zinc-800/80 w-full mt-2">
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className="text-xs font-semibold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Return to Welcome Landing Page
                    </button>
                  </div>
                </>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Developer Passcode Modal */}
      {showDevModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-250">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Developer Verification
            </h3>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Quick bypass registration is restricted to authorized developer credentials. Make sure you use the master passcode <strong>tareza1302</strong>:
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Username / Email</label>
                <div className="mt-1 p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs font-mono text-zinc-600 dark:text-zinc-300 border border-zinc-150 dark:border-zinc-700/50 flex flex-col gap-1">
                  <span>dev@tarezaerp.co.zw</span>
                  <span className="text-[10px] font-sans text-zinc-400 dark:text-zinc-500 border-t border-zinc-200/55 dark:border-zinc-700/55 pt-1.5 mt-1.5 leading-normal">
                    💡 You can also type your custom developer email (e.g. <strong>tapsforex@gmail.com</strong>) with the password <strong>tareza1302</strong> in the main Login Sign In form to seed and login instantly!
                  </span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Enter Developer Password</label>
                <input
                  type="password"
                  placeholder="Enter password..."
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  className="mt-1 w-full p-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-zinc-900 dark:text-zinc-100 font-sans"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (!devPassword) {
                        toast.error("Please enter a password");
                      } else if (devPassword !== 'tareza1302') {
                        toast.error("Invalid developer credentials");
                      } else {
                        setShowDevModal(false);
                        handleDemoLogin('developer', devPassword);
                      }
                    }
                  }}
                />
              </div>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs px-4"
                onClick={() => {
                  setShowDevModal(false);
                  setDevPassword('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl text-xs px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => {
                  if (!devPassword) {
                    toast.error("Please enter a password");
                  } else if (devPassword !== 'tareza1302') {
                    toast.error("Invalid developer credentials");
                  } else {
                    const pass = devPassword;
                    setShowDevModal(false);
                    setDevPassword('');
                    handleDemoLogin('developer', pass);
                  }
                }}
              >
                Verify & Sign In
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
