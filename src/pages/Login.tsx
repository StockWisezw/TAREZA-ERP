import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Store, TrendingUp, ShieldCheck, Mail, Key, Fingerprint, Github, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { TarezaLogo } from '../components/ui/Logo';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [planChoice, setPlanChoice] = useState('TRIAL');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    // Matches standard Zimbabwe business formats, e.g., 12345/2026, 123/26, or general numbers with leading prefixes
    const regRegex = /^(?:[A-Za-z0-9-]+\s*)?\d{1,6}\/\d{2,4}$/;
    if (!regRegex.test(regVal.trim())) {
      return 'Must be a valid format: number/year (e.g., 12345/2026)';
    }
    return null;
  };

  // URL token detection for Magic Link session responses
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    const secret = urlParams.get('secret');

    if (userId && secret) {
      setLoading(true);
      const verifyMagicLink = async () => {
        try {
          const { error } = await supabase.auth.completeMagicLinkSession(userId, secret);
          if (error) throw error;
          toast.success("Successfully authenticated with Magic Link!");
          navigate('/dashboard');
        } catch (error: any) {
          toast.error("Magic Link authentication failed: " + error.message);
        } finally {
          setLoading(false);
        }
      };
      verifyMagicLink();
    }
  }, [navigate]);

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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;
        
        const user = data.user;
        if (!user) throw new Error("User creation failed");

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

        const { data: bData } = await supabase.from('businesses').insert([
          { 
            name: businessName, 
            tax_number: registrationNumber,
            created_at: new Date().toISOString() 
          }
        ]).select().single();

        const bRef = bData as any;

        if (bRef) {
          await supabase.from('subscriptions').insert([{
             business_id: bRef.id,
             plan_name: planChoice === 'TRIAL' ? 'free_trial' : 'pro',
             status: 'active',
             start_date: new Date().toISOString(),
             end_date: endDate.toISOString()
          }]);

          const { data: rData } = await supabase.from('roles').insert([
            { business_id: bRef.id, name: 'Admin', description: 'System Administrator' }
          ]).select().single();

          const rRef = rData as any;

          const { data: brData } = await supabase.from('branches').insert([
            { business_id: bRef.id, name: 'Main Branch', type: 'retail' }
          ]).select().single();
          
          const brRef = brData as any;

          if (rRef && brRef) {
            await supabase.from('business_users').insert([
              { business_id: bRef.id, user_id: user.id, branch_id: brRef.id, role_id: rRef.id }
            ]);
          }

          await supabase.from('categories').insert([
            { business_id: bRef.id, name: 'General' }
          ]);
        }

        toast.success('Signup successful! Welcome to Tareza ERP. Please check your email to confirm if required.');
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

      if (useMagicLink) {
        try {
          const { error } = await supabase.auth.sendMagicLink(email);
          if (error) throw error;
          toast.success('Magic link login email sent successfully! Please check your inbox.');
        } catch (error: any) {
          authError = error;
        }
      } else {
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          if (error) throw error;
          toast.success('Welcome back to Tareza ERP');
          navigate('/dashboard');
        } catch (error: any) {
          authError = error;
        }
      }
    }

    if (authError) {
      toast.error(authError.message);
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
      if (error) {
        throw error;
      }
      toast.success("Password recovery email sent! Please check your inbox to reset your password.");
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
    <div className="min-h-screen bg-background flex">
      {/* Left Pane - Branding */}
      <div className="hidden lg:flex flex-col flex-1 bg-secondary text-secondary-foreground p-12 justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=2000&auto=format&fit=crop')] opacity-[0.03] bg-cover bg-center mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/95 to-secondary/80"></div>
        
        <div className="relative z-10 flex items-center">
          <TarezaLogo size="md" variant="dark" />
        </div>
        
        <div className="relative z-10 space-y-6 max-w-lg mb-12">
          <h1 className="text-5xl font-semibold leading-[1.1] tracking-tight">
            The integrated cloud ERP for fast-growing businesses.
          </h1>
          <p className="text-zinc-400 text-lg">
            Manage your inventory, process sales, oversee procurement, and generate compliant financial reports effortlessly.
          </p>
          
          <div className="flex space-x-6 pt-8">
            <div className="flex items-center space-x-2 text-sm font-medium text-white">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span>Enterprise Grade</span>
            </div>
            <div className="flex items-center space-x-2 text-sm font-medium text-white">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span>Real-time Reports & Insights</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-card relative">
        <div className="absolute top-8 right-8 flex items-center lg:hidden">
          <TarezaLogo size="sm" showSubtitle={false} />
        </div>
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-lg sm:rounded-2xl overflow-hidden">
          <CardHeader className="space-y-2 pb-8 pt-8 px-8 border-b border-border/40 bg-zinc-50/50">
            <CardTitle className="text-2xl font-bold tracking-tight">
              {isForgotPassword 
                ? 'Reset Password' 
                : (isSignUp ? 'Create an account' : 'Welcome back')}
            </CardTitle>
            <CardDescription className="text-sm">
              {isForgotPassword 
                ? 'Enter your email address and we\'ll send you a link to reset your password.' 
                : (isSignUp ? 'Enter your details to get started' : 'Enter your email and password to access your account')}
            </CardDescription>
            {!isForgotPassword && (
              <div 
                className="mt-4 p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col gap-1 cursor-pointer hover:bg-zinc-150 dark:hover:bg-zinc-800/80 transition-all select-none"
                onClick={() => {
                  setEmail('demo@tareza.co.zw');
                  setPassword('tareza1997?');
                  setIsSignUp(false);
                }}
              >
                <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-bold text-[10px] uppercase tracking-wider">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600 dark:bg-zinc-400"></span>
                  </span>
                  Global Superadmin Demo
                </div>
                <div className="text-xs text-zinc-605 dark:text-zinc-400 space-y-0.5 font-mono">
                  <div><strong className="font-sans font-medium text-zinc-500">User:</strong> demo@tareza.co.zw</div>
                  <div><strong className="font-sans font-medium text-zinc-500">Pass:</strong> tareza1997?</div>
                </div>
                <div className="text-[10px] text-zinc-500 font-semibold mt-1 underline">
                  Click to pre-fill credentials
                </div>
              </div>
            )}
          </CardHeader>
          <form onSubmit={isForgotPassword ? handleForgotPassword : handleAuth}>
            <CardContent className="space-y-5 p-8">
              {isForgotPassword ? (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="demo@tareza.co.zw" 
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
                          <Label htmlFor="registrationNumber" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Registration Number</Label>
                          <Input 
                            id="registrationNumber" 
                            placeholder="e.g. 12345/2026" 
                            value={registrationNumber}
                            onChange={(e) => {
                              setRegistrationNumber(e.target.value);
                              if (touchedReg) {
                                setRegError(validateRegistration(e.target.value));
                              }
                            }}
                            onBlur={() => {
                              setTouchedReg(true);
                              setRegError(validateRegistration(registrationNumber));
                            }}
                            required={isSignUp}
                            className={`h-11 bg-zinc-50 focus-visible:ring-primary focus-visible:bg-white border-zinc-200 ${
                              regError ? 'border-red-500 focus-visible:ring-red-500' : ''
                            }`}
                          />
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
                               <p className="font-bold text-zinc-900 text-sm">Pro ($40/mo)</p>
                               <p className="text-xs text-zinc-500">Start with real product</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {!isSignUp && (
                    <div className="space-y-1.5 pb-1">
                      <Label className="text-xs uppercase tracking-wider font-semibold text-zinc-500 block">Sign In Option</Label>
                      <div className="grid grid-cols-2 gap-2 bg-zinc-100 p-1 rounded-xl border border-zinc-150">
                        <button
                          type="button"
                          onClick={() => setUseMagicLink(false)}
                          className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            !useMagicLink 
                              ? 'bg-white text-zinc-900 shadow-xs' 
                              : 'text-zinc-500 hover:text-zinc-800'
                          }`}
                        >
                          <Key className="w-3.5 h-3.5" />
                          Password
                        </button>
                        <button
                          type="button"
                          onClick={() => setUseMagicLink(true)}
                          className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            useMagicLink 
                              ? 'bg-white text-zinc-900 shadow-xs' 
                              : 'text-zinc-500 hover:text-zinc-800'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Magic Link
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="demo@tareza.co.zw" 
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
                  {(!useMagicLink || isSignUp) && (
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
                            className="text-xs text-primary hover:text-primary/80 font-medium hover:underline focus:outline-none"
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
                        required={!useMagicLink || isSignUp}
                        className="h-11 bg-zinc-50 focus-visible:ring-primary focus-visible:bg-white border-zinc-200"
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 px-8 pb-8">
              {isForgotPassword ? (
                <>
                  <Button type="submit" className="w-full h-11 text-secondary font-bold text-base shadow-sm shadow-primary/20" disabled={loading}>
                    {loading ? 'Processing...' : 'Send Password Reset Link'}
                  </Button>
                  <div className="text-center text-sm text-zinc-500">
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
                    {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : (useMagicLink ? 'Send Magic Link Login' : 'Sign In'))}
                  </Button>

                  <div className="relative w-full my-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-white dark:bg-zinc-950 text-zinc-400 font-medium">Or continue with</span>
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

                    <Button 
                      type="button" 
                      variant="outline" 
                      className="h-10 font-semibold text-xs flex items-center justify-center space-x-2 border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 bg-white"
                      onClick={() => handleOAuthSignIn('azure')}
                      disabled={loading}
                    >
                      <svg viewBox="0 0 23 23" className="w-3.5 h-3.5">
                        <path fill="#f35325" d="M1 1h10v10H1z" />
                        <path fill="#81bc06" d="M12 1h10v10H12z" />
                        <path fill="#05a6f0" d="M1 12h10v10H1z" />
                        <path fill="#ffba08" d="M12 12h10v10H12z" />
                      </svg>
                      <span>Microsoft</span>
                    </Button>

                    <Button 
                      type="button" 
                      variant="outline" 
                      className="h-10 font-semibold text-xs flex items-center justify-center space-x-2 border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 bg-white"
                      onClick={() => handleOAuthSignIn('apple')}
                      disabled={loading}
                    >
                      <svg viewBox="0 0 170 170" className="w-3.5 h-3.5 fill-current text-zinc-900">
                        <path d="M150.37 130.25c-2.45 5.66-5.35-10.87-11.85-2.05-6.5-8.81-12.93-19.4-18.37-29.47-2.49-4.59-4.5-8.46-5.51-10.77-5.59-12.81-9.16-22.56-9.16-34.91 0-24.16 20.06-36.75 39.11-36.75 3.32 0 10.37.52 14.7 1.83-9.52-16.14-27.46-24.7-46.75-24.7-18.06 0-33.15 10.77-44.42 10.77-11.45 0-28.32-10.77-45.64-10.77C20.61 3.4 0 23.33 0 60.15c0 14.83 5.43 31.81 12.35 47.93 6.92 16.12 15.35 31.7 24.31 42.15 10.78 12.56 21.05 24.73 34.93 24.73 13.51 0 18.09-8.47 34.61-8.47 16.53 0 20.73 8.47 34.93 8.47 14.18 0 24.96-12.17 34.92-24.73 6.9-10.05 11.23-17.79 14.33-22.63-26.69-12.38-30.01-49.91-.01-62.34zm-30.82-120.35c10.15-12.27 16.92-29.35 15.06-46.33-14.56.58-32.22 9.69-42.66 21.96-8.98 10.45-16.83 27.68-14.7 44.49 16.27 1.25 32.15-7.85 42.3-20.12z" />
                      </svg>
                      <span>Apple</span>
                    </Button>
                  </div>

                  <div className="relative w-full text-center pt-2">
                    <span className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider block mb-1.5">— demo & guest access —</span>
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full h-11 font-bold text-xs flex items-center justify-center space-x-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-indigo-700 bg-indigo-50/10 rounded-xl"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const { data, error } = await supabase.auth.signInAnonymously();
                          if (error) throw error;
                          toast.success('Successfully initiated secure guest walkthrough dynamic session!');
                          navigate('/dashboard');
                        } catch (err: any) {
                          toast.error(err.message || 'Could not verify guest token credentials');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      <Fingerprint className="w-4 h-4 animate-pulse text-indigo-550" />
                      <span>Launch Instant Guest Account</span>
                    </Button>
                  </div>
                  <div className="text-center text-sm text-zinc-500">
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
                </>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
