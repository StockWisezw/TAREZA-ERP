import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Mail, Server, Shield, Key, RefreshCw, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from '../../lib/firebaseClient';

export function EmailSettings() {
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // SMTP form states
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");

  useEffect(() => {
    async function loadEmailConfig() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;
        setCurrentUserEmail(userData.user.email || "");
        setRecipientEmail(userData.user.email || "");
        
        const { data: buData, error: buError } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userData.user.id)
          .limit(1)
          .maybeSingle();

        if (buError || !buData) {
          console.error("No business_user found", buError);
          return;
        }

        setBusinessId(buData.business_id);

        const { data, error } = await supabase
          .from("businesses")
          .select("*")
          .eq('id', buData.business_id)
          .single();

        if (error) {
          console.error("No business found", error);
        } else if (data) {
          setSmtpHost(data.smtp_host || "");
          setSmtpPort(data.smtp_port ? String(data.smtp_port) : "587");
          setSmtpUser(data.smtp_user || "");
          setSmtpPass(data.smtp_pass || "");
        }
      } catch (err) {
        console.error("Failed to load email config", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadEmailConfig();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!businessId) {
      toast.error("No active business workspace found.");
      return;
    }

    const portNum = parseInt(smtpPort, 10);
    if (isNaN(portNum)) {
      toast.error("SMTP Port must be a valid number.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          smtp_host: smtpHost,
          smtp_port: portNum,
          smtp_user: smtpUser,
          smtp_pass: smtpPass,
        })
        .eq("id", businessId);

      if (error) throw error;
      toast.success("SMTP Email configuration saved securely to Firestore!");
    } catch (err: any) {
      console.error("Failed to save SMTP configuration", err);
      toast.error(`Failed to save settings: ${err.message || String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!businessId) {
      toast.error("No active business workspace found.");
      return;
    }

    if (!smtpHost || !smtpUser || !smtpPass) {
      toast.error("Please configure and save SMTP details first before testing.");
      return;
    }

    setIsTesting(true);
    const testPromise = (async () => {
      // Auto-save current form values first to ensure we are testing what is entered
      const portNum = parseInt(smtpPort, 10);
      await supabase
        .from("businesses")
        .update({
          smtp_host: smtpHost,
          smtp_port: isNaN(portNum) ? 587 : portNum,
          smtp_user: smtpUser,
          smtp_pass: smtpPass,
        })
        .eq("id", businessId);

      const response = await fetch("/api/email/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business_id: businessId,
          recipient_email: recipientEmail,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to verify SMTP server connection.");
      }
      return resData;
    })();

    toast.promise(testPromise, {
      loading: "Verifying SMTP connection and sending test email...",
      success: (data) => data.message || "Test email sent successfully!",
      error: (err) => err.message || "Failed to establish SMTP connection.",
    });

    try {
      await testPromise;
    } catch (err) {
      console.error("Test connection exception", err);
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mr-3" />
        <span className="text-zinc-500 text-sm font-medium">Loading email configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Email Configuration</h3>
        <p className="text-sm text-zinc-500 mt-1">
          Configure your dedicated SMTP server settings to dispatch system invoices, reports, and alerts from your own email.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-500" />
                SMTP Server Settings
              </CardTitle>
              <CardDescription>
                Provide credentials for your custom mail server. Supported protocols include standard SMTP and secure TLS/SSL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="smtpHost" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">SMTP Host / Server</Label>
                    <div className="relative">
                      <Server className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                      <Input
                        id="smtpHost"
                        placeholder="e.g. smtp.gmail.com or mail.tareza.co.zw"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        className="pl-9 h-10 border-zinc-200 dark:border-zinc-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtpPort" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">SMTP Port</Label>
                    <Input
                      id="smtpPort"
                      placeholder="e.g. 587 or 465"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className="h-10 border-zinc-200 dark:border-zinc-800"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtpUser" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">SMTP Username / User Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                    <Input
                      id="smtpUser"
                      type="email"
                      placeholder="e.g. alerts@yourdomain.com"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      className="pl-9 h-10 border-zinc-200 dark:border-zinc-800"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtpPass" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">SMTP Password / App Secret</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                    <Input
                      id="smtpPass"
                      type="password"
                      placeholder="••••••••••••••••"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      className="pl-9 h-10 border-zinc-200 dark:border-zinc-800"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-semibold text-xs py-2 px-5 rounded-lg transition-colors"
                  >
                    {isSaving ? "Saving Configuration..." : "Save SMTP Settings"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1 space-y-6">
          <Card className="border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" />
                Security & Encryption
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">
              <p>
                Credentials saved here are stored securely inside Firestore under your specific workspace tenancy scope, guarded by strict security rules.
              </p>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 space-y-2">
                <div className="flex gap-2 text-zinc-550">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Port <strong>587</strong> automatically activates secure TLS upgrades.</span>
                </div>
                <div className="flex gap-2 text-zinc-550">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Port <strong>465</strong> enforces direct SSL connections.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-500" />
                Test Mail Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipientEmail" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Recipient Email Address</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  placeholder="e.g. receiver@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="h-10 text-xs border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <Button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !smtpHost || !smtpUser || !smtpPass}
                variant="outline"
                className="w-full h-10 font-semibold text-xs border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                {isTesting ? "Testing Server..." : "Test SMTP Connection"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
