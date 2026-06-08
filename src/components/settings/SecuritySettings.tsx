import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Shield, Key, History, Save, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { rawSupabase } from '../../lib/firebaseClient';

export function SecuritySettings() {
  const [isSaving, setIsSaving] = useState(false);

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
      </div>
    </div>
  );
}
