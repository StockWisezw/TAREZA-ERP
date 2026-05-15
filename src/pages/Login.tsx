import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Store, TrendingUp, ShieldCheck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For demo purposes in AI Studio if Supabase is not configured yet
    if (import.meta.env.VITE_SUPABASE_URL === 'https://your-project.supabase.co' || !import.meta.env.VITE_SUPABASE_URL) {
      toast.success(isSignUp ? 'Demo sign up successful' : 'Demo login successful');
      navigate('/dashboard');
      return;
    }

    setLoading(true);
    let authError = null;

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      authError = error;
      if (!error) toast.success('Signup successful! You can now log in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      authError = error;
      if (!error) {
        toast.success('Welcome back to Tareza ERP');
        navigate('/dashboard');
      }
    }

    if (authError) {
      toast.error(authError.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Pane - Branding */}
      <div className="hidden lg:flex flex-col flex-1 bg-secondary text-secondary-foreground p-12 justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=2000&auto=format&fit=crop')] opacity-[0.03] bg-cover bg-center mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/95 to-secondary/80"></div>
        
        <div className="relative z-10 flex items-center space-x-3">
          <div className="bg-primary p-2 flex items-center justify-center rounded-lg shadow-xl shadow-primary/20">
            <Store className="w-8 h-8 text-secondary" />
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-bold tracking-tight text-white leading-none">TAREZA</span>
            <span className="text-xs tracking-[0.2em] text-primary font-medium mt-1 uppercase">ERP</span>
          </div>
        </div>
        
        <div className="relative z-10 space-y-6 max-w-lg mb-12">
          <h1 className="text-5xl font-semibold leading-[1.1] tracking-tight">
            The intelligent cloud ERP for fast-growing businesses.
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
              <span>AI Forecast & Insights</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-card relative">
        <div className="absolute top-8 right-8 flex items-center space-x-2 lg:hidden">
          <div className="bg-primary p-1.5 rounded-md">
             <Store className="w-5 h-5 text-secondary" />
          </div>
          <span className="text-xl font-bold tracking-tight">TAREZA ERP</span>
        </div>
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-lg sm:rounded-2xl overflow-hidden">
          <CardHeader className="space-y-2 pb-8 pt-8 px-8 border-b border-border/40 bg-zinc-50/50">
            <CardTitle className="text-2xl font-bold tracking-tight">{isSignUp ? 'Create an account' : 'Welcome back'}</CardTitle>
            <CardDescription className="text-sm">
              {isSignUp ? 'Enter your details to get started' : 'Enter your email and password to access your account'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAuth}>
            <CardContent className="space-y-5 p-8">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@tareza.co.zw" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 bg-zinc-50 focus-visible:ring-primary focus-visible:bg-white border-zinc-200"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Password</Label>
                  {!isSignUp && (
                    <a href="#" className="text-xs text-primary hover:text-primary/80 font-medium">
                      Forgot password?
                    </a>
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
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 px-8 pb-8">
              <Button type="submit" className="w-full h-11 text-secondary font-bold text-base shadow-sm shadow-primary/20" disabled={loading}>
                {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
              </Button>
              <div className="text-center text-sm text-zinc-500">
                {isSignUp ? 'Already have an account? ' : 'Don\'t have an account? '}
                <button 
                  type="button" 
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-primary hover:underline font-semibold"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
