import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { fireAuth, supabase } from '../lib/firebaseClient';
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

      try {
        let firebaseUser;
        try {
          const userCredential = await signInWithEmailAndPassword(fireAuth, email, password);
          firebaseUser = userCredential.user;
        } catch (signInErr: any) {
          if (email.trim() === 'tapsforex@gmail.com' && password === 'taps1302??') {
            // Clean dynamic signup for developer so the account always exists seamlessly!
            const developerReg = await createUserWithEmailAndPassword(fireAuth, email, password);
            firebaseUser = developerReg.user;
            if (!firebaseUser) throw new Error("Developer registration failed");

            // Setup base profile and business for developer profile
            await supabase.from('profiles').insert([
              { id: firebaseUser.uid, first_name: 'Developer', last_name: 'Admin', email: firebaseUser.email }
            ]);
            
            const { data: bData } = await supabase.from('businesses').insert([
              { name: 'Developer Workspace', tax_number: '1302/2026', created_at: new Date().toISOString() }
            ]).select().single();
            
            const bRef = bData as any;
            if (bRef) {
              await supabase.from('subscriptions').insert([{
                 business_id: bRef.id,
                 plan_name: 'pro',
                 status: 'active',
                 start_date: new Date().toISOString(),
                 end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              }]);
              const { data: rData } = await supabase.from('roles').insert([
                { business_id: bRef.id, name: 'Admin', description: 'System Administrator' }
              ]).select().single();
              const { data: brData } = await supabase.from('branches').insert([
                { business_id: bRef.id, name: 'Main Office', type: 'retail' }
              ]).select().single();
              
              if (rData && brData) {
                await supabase.from('business_users').insert([
                  { business_id: bRef.id, user_id: firebaseUser.uid, branch_id: (brData as any).id, role_id: (rData as any).id }
                ]);
              }
            }
          } else {
            throw signInErr;
          }
        }

        toast.success('Welcome back to Tareza ERP');
        navigate('/dashboard');
      } catch (error: any) {
        authError = error;
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
        <div className="absolute top-8 right-8 flex items-center lg:hidden font-sans">
          <TarezaLogo size="sm" showSubtitle={false} />
        </div>
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-lg sm:rounded-2xl overflow-hidden font-sans">
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
          </CardHeader>
          <form onSubmit={isForgotPassword ? handleForgotPassword : handleAuth}>
            <CardContent className="space-y-5 p-8">
              {isForgotPassword ? (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="tapsforex@gmail.com" 
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
                      placeholder="tapsforex@gmail.com" 
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
                </>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
