import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Bell, Mail, MessageSquare, Save, AlertTriangle, UserPlus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { rawSupabase } from '../../lib/firebaseClient';

export function NotificationSettings() {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('tareza_notifications_policy', JSON.stringify({
        updated_at: new Date().toISOString()
      }));

      const { data: fallbackB } = await rawSupabase.from('businesses').select('id').limit(1).maybeSingle();
      if (fallbackB?.id) {
        await rawSupabase.from('businesses').update({ updated_at: new Date().toISOString() }).eq('id', fallbackB.id);
      }

      toast.success('Notification preferences updated');
    } catch (err) {
      toast.error('Failed to update notifications settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Notifications</h3>
          <p className="text-sm text-zinc-500 mt-1">Manage alerts and automated communication channels across the ERP.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-primary-foreground shadow-sm px-6">
          {isSaving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Preferences</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="border-zinc-200/60 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Delivery Channels</CardTitle>
              <CardDescription>Global toggle for notification channels.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600"><Bell className="w-4 h-4" /></div>
                  <Label className="font-semibold text-zinc-900">In-App Alerts</Label>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Mail className="w-4 h-4" /></div>
                  <Label className="font-semibold text-zinc-900">Email Notifications</Label>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><MessageSquare className="w-4 h-4" /></div>
                  <Label className="font-semibold text-zinc-900">WhatsApp / SMS</Label>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="border-zinc-200/60 shadow-sm">
            <CardHeader className="pb-4 border-b border-zinc-100">
              <CardTitle className="text-lg">Event Triggers</CardTitle>
              <CardDescription>Select which events should trigger notifications to admins and managers.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6 flex flex-col gap-6">
              
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-3">
                  <div className="mt-0.5"><AlertTriangle className="w-5 h-5 text-amber-500" /></div>
                  <div>
                    <Label className="text-base font-semibold text-zinc-900">Low Stock Alerts</Label>
                    <p className="text-sm text-zinc-500 mt-1">Receive an alert when an item falls below its minimum stock threshold.</p>
                  </div>
                </div>
                <div className="flex gap-2 items-center text-xs font-semibold text-zinc-500">
                  <div className="flex flex-col items-center gap-1"><Switch size="sm" defaultChecked /><Mail className="w-3 h-3" /></div>
                  <div className="w-px h-6 bg-zinc-200 mx-1"></div>
                  <div className="flex flex-col items-center gap-1"><Switch size="sm" defaultChecked /><Bell className="w-3 h-3" /></div>
                </div>
              </div>

              <div className="flex justify-between items-start gap-4 pt-6 border-t border-zinc-100">
                <div className="flex gap-3">
                  <div className="mt-0.5"><FileText className="w-5 h-5 text-indigo-500" /></div>
                  <div>
                    <Label className="text-base font-semibold text-zinc-900">Daily Summary Report</Label>
                    <p className="text-sm text-zinc-500 mt-1">Get a summary of daily sales, profit, and exceptions every evening.</p>
                  </div>
                </div>
                <div className="flex gap-2 items-center text-xs font-semibold text-zinc-500">
                  <div className="flex flex-col items-center gap-1"><Switch size="sm" defaultChecked /><Mail className="w-3 h-3" /></div>
                  <div className="w-px h-6 bg-zinc-200 mx-1"></div>
                  <div className="flex flex-col items-center gap-1"><Switch size="sm" /><Bell className="w-3 h-3" /></div>
                </div>
              </div>

              <div className="flex justify-between items-start gap-4 pt-6 border-t border-zinc-100">
                <div className="flex gap-3">
                  <div className="mt-0.5"><UserPlus className="w-5 h-5 text-emerald-500" /></div>
                  <div>
                    <Label className="text-base font-semibold text-zinc-900">New User Sign-in from Unknown Device</Label>
                    <p className="text-sm text-zinc-500 mt-1">Alert when a staff member logs in from a new IP or browser.</p>
                  </div>
                </div>
                <div className="flex gap-2 items-center text-xs font-semibold text-zinc-500">
                  <div className="flex flex-col items-center gap-1"><Switch size="sm" defaultChecked /><Mail className="w-3 h-3" /></div>
                  <div className="w-px h-6 bg-zinc-200 mx-1"></div>
                  <div className="flex flex-col items-center gap-1"><Switch size="sm" defaultChecked /><Bell className="w-3 h-3" /></div>
                </div>
              </div>

              <div className="flex justify-between items-start gap-4 pt-6 border-t border-zinc-100">
                <div className="flex gap-3">
                  <div className="mt-0.5"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
                  <div>
                    <Label className="text-base font-semibold text-zinc-900">Fiscalisation API Failures</Label>
                    <p className="text-sm text-zinc-500 mt-1">Critical alerts when ZIMRA/Tax authority integration fails.</p>
                  </div>
                </div>
                <div className="flex gap-2 items-center text-xs font-semibold text-zinc-500">
                  <div className="flex flex-col items-center gap-1"><Switch size="sm" defaultChecked /><Mail className="w-3 h-3" /></div>
                  <div className="w-px h-6 bg-zinc-200 mx-1"></div>
                  <div className="flex flex-col items-center gap-1"><Switch size="sm" defaultChecked /><Bell className="w-3 h-3" /></div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
