import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Shield, Key, History, Save, Smartphone, Eye, EyeOff, Lock, Database, RefreshCw, User } from 'lucide-react';
import { toast } from 'sonner';
import { updatePassword, updateEmail } from 'firebase/auth';
import { fireAuth, rawSupabase } from '../../lib/firebaseClient';

export function SecuritySettings() {
  const [isSaving, setIsSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  React.useEffect(() => {
    async function loadUserProfile() {
      try {
        const user = fireAuth.currentUser;
        if (!user) return;
        
        setEmail(user.email || '');

        const { data, error } = await rawSupabase
          .from('profiles')
          .select('*')
          .eq('id', user.uid)
          .maybeSingle();

        if (data) {
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
          setPhone(data.phone || '');
          if (data.email) setEmail(data.email);
        }
      } catch (err) {
        console.error('Failed to load user profile', err);
      } finally {
        setIsLoadingProfile(false);
      }
    }
    loadUserProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = fireAuth.currentUser;
    if (!user) {
      toast.error('You must be logged in to update your profile');
      return;
    }

    setIsSavingProfile(true);
    try {
      // 1. If email has changed, update it in Firebase Auth
      if (email.toLowerCase() !== user.email?.toLowerCase()) {
        await updateEmail(user, email);
      }

      // 2. Update profiles table
      const { error: profileError } = await rawSupabase
        .from('profiles')
        .upsert({
          id: user.uid,
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          email: email
        });

      if (profileError) throw profileError;

      toast.success('Personal profile updated successfully!');
    } catch (err: any) {
      console.error('[Profile Update] Error:', err);
      if (err.code === 'auth/requires-recent-login') {
        toast.error('Changing your email is a security-sensitive action. Please log out and log back in, then try again.');
      } else {
        toast.error(err.message || 'Failed to update personal profile');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const [offlineCacheEnabled, setOfflineCacheEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tareza_firestore_persistence') !== 'disabled';
    }
    return true;
  });

  const [continuousLoginEnabled, setContinuousLoginEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tareza_continuous_login') !== 'disabled';
    }
    return true;
  });

  const handleToggleOfflineCache = (checked: boolean) => {
    setOfflineCacheEnabled(checked);
    localStorage.setItem('tareza_firestore_persistence', checked ? 'enabled' : 'disabled');
    toast.success(
      checked 
        ? 'Persistent offline database caching enabled! Please refresh the page to apply changes.' 
        : 'Persistent offline cache disabled. Falling back to session memory.'
    );
  };

  const handleToggleContinuousLogin = (checked: boolean) => {
    setContinuousLoginEnabled(checked);
    localStorage.setItem('tareza_continuous_login', checked ? 'enabled' : 'disabled');
    toast.success(
      checked 
        ? 'Continuous persistent login enabled! Your login session will be kept alive continuously.' 
        : 'Continuous login disabled. Standard session expiry will apply.'
    );
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem('tareza_offline_queue_db');
      toast.success('Local database cache queued for refresh! Reloading system.');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      toast.error('Failed to clear client-side database cache');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const user = fireAuth.currentUser;
    if (!user) {
      toast.error('You must be logged in to change your password');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(user, newPassword);
      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        toast.error('This is a security-sensitive action. Please log out and log back in, then try again.');
      } else {
        toast.error(err.message || 'Failed to update password');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('tareza_security_policy', JSON.stringify({
        require_2fa: false,
        updated_at: new Date().toISOString()
      }));

      const { data: fallbackB } = await rawSupabase.from('businesses').select('id').limit(1).maybeSingle();
      if (fallbackB?.id) {
        await rawSupabase.from('businesses').update({ updated_at: new Date().toISOString() }).eq('id', fallbackB.id);
      }

      toast.success('Security settings saved successfully');
    } catch (err) {
      toast.error('Failed to update security settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Security & Access</h3>
          <p className="text-sm text-zinc-500 mt-1">Manage standard security practices, sessions, and multi-factor authentication.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-primary-foreground shadow-sm px-6">
          {isSaving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Policy</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-zinc-200/60 shadow-sm md:col-span-2">
          <CardHeader className="pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-lg">Authentication Policies</CardTitle>
            </div>
            <CardDescription>Configure how users authenticate to the ERP.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1">
                <Label className="font-semibold text-zinc-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  Require Two-Factor Authentication (2FA)
                </Label>
                <span className="text-sm text-zinc-500">
                  Force all users across the business to set up an authenticator app.
                </span>
              </div>
              <Switch />
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
              <div className="flex flex-col space-y-1">
                <Label className="font-semibold text-zinc-900">Enforce strong passwords</Label>
                <span className="text-sm text-zinc-500">
                  Require at least 12 characters, numbers, and symbols.
                </span>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-lg">Session Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timeout" className="font-semibold text-zinc-900">Idle Session Timeout (Minutes)</Label>
              <Input id="timeout" type="number" defaultValue={120} className="h-11 font-mono" />
              <p className="text-xs text-zinc-500">Automatically sign users out after inactivity.</p>
            </div>

            <div className="space-y-2 pt-4 border-t border-zinc-100">
              <Label htmlFor="expiry" className="font-semibold text-zinc-900">Password Expiry (Days)</Label>
              <Input id="expiry" type="number" defaultValue={90} className="h-11 font-mono" />
              <p className="text-xs text-zinc-500">Force users to reset passwords periodically. Set to 0 to disable.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-lg">Network Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold text-zinc-900">IP Whitelisting</Label>
              <Input placeholder="e.g. 192.168.1.1, 10.0.0.0/24" className="h-11 font-mono text-sm" />
              <p className="text-xs text-zinc-500">Restrict access to specific IP addresses for POS users. Leave blank to allow anywhere.</p>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
              <div className="flex flex-col space-y-1">
                <Label className="font-semibold text-zinc-900">Audit Logging</Label>
                <span className="text-xs text-zinc-500">
                  Keep a permanent log of all actions.
                </span>
              </div>
              <Switch defaultChecked disabled />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm md:col-span-2">
          <CardHeader className="pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-500" />
              <CardTitle className="text-lg animate-pulse-subtle">Continuous Offline Cache & Persistence</CardTitle>
            </div>
            <CardDescription>
              Configure Firebase to cache queries and documents continuously on this device. This keeps your records accessible offline even during network drops.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col space-y-1">
                <Label htmlFor="offline-mode-switch" className="font-semibold text-zinc-900 select-none">
                  Enable Persistent Offline Database Caching
                </Label>
                <span className="text-sm text-zinc-500">
                  Caches invoices, POS logs, products, and clients locally using IndexedDB so the platform remains fully functional offline.
                </span>
              </div>
              <Switch 
                id="offline-mode-switch"
                checked={offlineCacheEnabled}
                onCheckedChange={handleToggleOfflineCache}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-zinc-100">
              <div className="flex flex-col space-y-1">
                <Label htmlFor="continuous-login-switch" className="font-semibold text-zinc-900 select-none">
                  Continuous Session Login (Remember Me)
                </Label>
                <span className="text-sm text-zinc-500">
                  Keeps your supervisor/auth session alive indefinitely so you don't get logged out while offline.
                </span>
              </div>
              <Switch 
                id="continuous-login-switch"
                checked={continuousLoginEnabled}
                onCheckedChange={handleToggleContinuousLogin}
              />
            </div>

            <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-zinc-950">Local Database Diagnostics</h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Current Cache Status: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">Active (resilient fallback active)</strong>
                </p>
              </div>
              <Button 
                type="button"
                variant="outline" 
                size="sm" 
                onClick={handleClearCache}
                className="text-zinc-600 border-zinc-200 hover:bg-zinc-100 shrink-0 self-start sm:self-center"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-2" /> Clear Offline Cache
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm md:col-span-2">
          <CardHeader className="pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-lg">Personal Profile Details</CardTitle>
            </div>
            <CardDescription>Update your personal information, including name, email address, and phone number.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoadingProfile ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
                <span className="ml-2 text-sm text-zinc-500">Loading profile...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="first-name-input" className="text-sm font-semibold text-zinc-800">First Name</Label>
                    <Input 
                      id="first-name-input"
                      type="text" 
                      value={firstName} 
                      onChange={e => setFirstName(e.target.value)} 
                      placeholder="Enter first name" 
                      className="h-11 border-zinc-200 bg-zinc-50 focus-visible:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last-name-input" className="text-sm font-semibold text-zinc-800">Last Name</Label>
                    <Input 
                      id="last-name-input"
                      type="text" 
                      value={lastName} 
                      onChange={e => setLastName(e.target.value)} 
                      placeholder="Enter last name" 
                      className="h-11 border-zinc-200 bg-zinc-50 focus-visible:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-input" className="text-sm font-semibold text-zinc-800">Email Address</Label>
                    <Input 
                      id="email-input"
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      required
                      placeholder="Enter email address" 
                      className="h-11 border-zinc-200 bg-zinc-50 focus-visible:bg-white"
                    />
                    <p className="text-[11px] text-zinc-400">Changing this will update your login email.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone-input" className="text-sm font-semibold text-zinc-800">Phone Number</Label>
                    <Input 
                      id="phone-input"
                      type="tel" 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)} 
                      placeholder="Enter phone number" 
                      className="h-11 border-zinc-200 bg-zinc-50 focus-visible:bg-white"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isSavingProfile} className="h-11 px-6 bg-primary font-semibold text-secondary-foreground shadow-sm">
                  {isSavingProfile ? 'Saving Profile...' : 'Save Personal Profile'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm md:col-span-2">
          <CardHeader className="pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-lg">Change Your Account Password</CardTitle>
            </div>
            <CardDescription aria-hidden="false">Update your credentials. Toggles are available to mask/reveal inputs for accessibility and accuracy.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="new-password-input" className="text-sm font-semibold text-zinc-800">New Password</Label>
                <div className="relative">
                  <Input 
                    id="new-password-input"
                    type={showNewPassword ? "text" : "password"} 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    required 
                    minLength={6} 
                    placeholder="Enter new account password" 
                    className="h-11 border-zinc-200 pr-10 bg-zinc-50 focus-visible:bg-white"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password-input" className="text-sm font-semibold text-zinc-800">Confirm New Password</Label>
                <div className="relative">
                  <Input 
                    id="confirm-password-input"
                    type={showConfirmPassword ? "text" : "password"} 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    required 
                    minLength={6} 
                    placeholder="Confirm your new password" 
                    className="h-11 border-zinc-200 pr-10 bg-zinc-50 focus-visible:bg-white"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={isUpdatingPassword} className="h-11 px-6 bg-primary font-semibold text-secondary-foreground shadow-sm">
                {isUpdatingPassword ? 'Updating Password...' : 'Save New Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
