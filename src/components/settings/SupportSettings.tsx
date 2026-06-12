import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Mail, Phone, LifeBuoy, CreditCard, MessageSquare, ExternalLink, HelpCircle, BadgeAlert, AlertCircle, RefreshCw, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/firebaseClient';
import { toast } from 'sonner';

export function SupportSettings() {
  const { user } = useAuth();
  const [showTicketForm, setShowTicketForm] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('technical');
  const [priority, setPriority] = React.useState('medium');
  const [submitting, setSubmitting] = React.useState(false);
  const [tickets, setTickets] = React.useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = React.useState(false);

  const fetchMyTickets = async () => {
    if (!user?.$id) return;
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.$id);
      if (!error && data) {
        // Sort newest first
        const sorted = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setTickets(sorted);
      }
    } catch (err) {
      console.error("Failed to load user tickets:", err);
    } finally {
      setLoadingTickets(false);
    }
  };

  React.useEffect(() => {
    fetchMyTickets();
  }, [user?.$id]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Please fill in all subject and details fields.");
      return;
    }
    setSubmitting(true);
    try {
      let bizId = 'demo-business';
      let bizName = 'Demo Client Business';
      
      const { data: bUserData } = await supabase
        .from('business_users')
        .select('business_id')
        .eq('user_id', user?.$id)
        .limit(1)
        .maybeSingle();
        
      if (bUserData?.business_id) {
        bizId = bUserData.business_id;
        const { data: bData } = await supabase
          .from('businesses')
          .select('name')
          .eq('id', bizId)
          .limit(1)
          .maybeSingle();
        if (bData?.name) {
          bizName = bData.name;
        }
      }

      const newTicket = {
        id: 'tick-' + Math.floor(Math.random() * 1000000),
        user_id: user?.$id || 'anonymous',
        user_email: user?.email || 'no-email@tarezaerp.co.zw',
        business_id: bizId,
        business_name: bizName,
        subject: subject,
        category: category,
        priority: priority,
        status: 'Pending',
        description: description,
        response: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('support_tickets').insert([newTicket]);
      if (error) throw error;

      // Dispatch real alert notifications to WhatsApp & Email in the background
      fetch('/api/notifications/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ticket',
          payload: {
            id: newTicket.id,
            user_email: newTicket.user_email,
            business_name: newTicket.business_name,
            subject: newTicket.subject,
            category: newTicket.category,
            priority: newTicket.priority,
            description: newTicket.description
          }
        })
      }).catch(err => console.error("Ticket alert dispatch failed:", err));

      toast.success("Support ticket created successfully! Our systems developer will analyze and reply shortly.");
      setSubject('');
      setDescription('');
      setShowTicketForm(false);
      fetchMyTickets();
    } catch (err: any) {
      toast.error(`Failed to submit ticket: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Help & Support Center</h3>
        <p className="text-sm text-zinc-500 mt-1">Get developer assistance, submit diagnostic tickets, and review your issues.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payments / Subscriptions Info Card */}
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden bg-gradient-to-br from-indigo-50/20 to-transparent dark:bg-zinc-900/40">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <CreditCard className="w-24 h-24 text-zinc-900 dark:text-zinc-50" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Payments & Billing
            </CardTitle>
            <CardDescription className="dark:text-zinc-400">
              Direct hotlines for account activations, renewals, and merchant processing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-150 dark:border-zinc-800 space-y-3 shadow-none">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Contact billing to approve manual Paynow transfers, EcoCash payments, split settlements, or upgrade your plan to Pro/Enterprise:
              </p>
              
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div className="bg-indigo-500/10 p-2 rounded-full shrink-0">
                  <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Billing Department</p>
                  <a href="mailto:admin@tarezaerp.co.zw" className="text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate block">
                    admin@tarezaerp.co.zw
                  </a>
                </div>
              </div>

              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                * Note: Standard payments are credited to accounts within 2 hours.
              </div>
            </div>
            
            <Button className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => window.location.href = 'mailto:admin@tarezaerp.co.zw?subject=Payment Registration Request - Tareza ERP'}>
              Contact Billing Admin
            </Button>
          </CardContent>
        </Card>

        {/* Technical Support Ticket Creation Card */}
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden bg-gradient-to-br from-indigo-50/20 to-transparent dark:bg-zinc-900/40">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <LifeBuoy className="w-24 h-24 text-zinc-900 dark:text-zinc-50" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <LifeBuoy className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Developer Help Desk
            </CardTitle>
            <CardDescription className="dark:text-zinc-400">
              Encountered an issue or require fiscalisation assistance? Raise a direct ticket.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            {!showTicketForm ? (
              <div className="space-y-4">
                <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-150 dark:border-zinc-800 space-y-3 shadow-none">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Submit digital tickets parsed instantly by our ZIMRA integrations and development team:
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                      <Phone className="w-3.5 h-3.5 text-zinc-400" />
                      <span>+263 784553570</span>
                    </div>
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                      <Mail className="w-3.5 h-3.5 text-zinc-400" />
                      <span>support email</span>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={() => setShowTicketForm(true)}
                  className="w-full rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white"
                >
                  Create Support Ticket
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreateTicket} className="space-y-3 bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-150 dark:border-zinc-800 animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">Raise Technical Inquiry</h4>
                  <button 
                    type="button" 
                    onClick={() => setShowTicketForm(false)} 
                    className="text-xs text-zinc-400 hover:text-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Fiscalisation Not Reaching Zimra"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1 w-full p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="mt-1 w-full p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs"
                    >
                      <option value="technical">Technical Bug</option>
                      <option value="billing">Billing Dispute</option>
                      <option value="general">General Help</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="mt-1 w-full p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent / Blocked</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Issue Details & System Logs</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide full details, error messages, or instructions to replicate..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 w-full p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? "Submitting Inquiry..." : "Submit Ticket to Developer"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Ticket History Section */}
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <CardTitle className="text-base">Support History & Ticket Log</CardTitle>
            <CardDescription className="text-xs">Review open, answered, and resolved system tickets submitted by your business.</CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchMyTickets} 
            disabled={loadingTickets}
            className="text-xs border border-zinc-200 dark:border-zinc-800 h-8 rounded-lg"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingTickets ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {tickets.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-xl">
              <AlertCircle className="w-8 h-8 text-zinc-350 dark:text-zinc-700 mx-auto mb-2" />
              <p className="text-xs font-semibold">No tickets raised yet</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Your submitted support query history will appear securely here.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {tickets.map((t) => (
                <div key={t.id} className="p-4 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-[9px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono px-1.5 py-0.5 rounded mr-2">
                        {t.id}
                      </span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        t.priority === 'urgent' ? 'bg-rose-500/10 text-rose-600' :
                        t.priority === 'high' ? 'bg-amber-500/15 text-amber-600' :
                        'bg-zinc-550/10 text-zinc-600 dark:text-zinc-300'
                      }`}>
                        {t.priority}
                      </span>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-50 text-sm mt-1">{t.subject}</h4>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        t.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                      }`}>
                        {t.status}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-mono">
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 p-3 rounded-lg border border-zinc-100 dark:border-zinc-850 leading-relaxed">
                    {t.description}
                  </p>

                  {t.response ? (
                    <div className="bg-indigo-500/5 dark:bg-indigo-500/10 border-l-2 border-indigo-500 p-3.5 rounded-r-lg space-y-1">
                      <p className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Developer Reply & Action Taken
                      </p>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 italic whitespace-pre-wrap leading-relaxed">
                        "{t.response}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10.5px] text-zinc-400 italic flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-zinc-350 shrink-0" />
                      Awaiting technical developer analysis and reply...
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-900 dark:text-zinc-50">Resources & Documentation</CardTitle>
          <CardDescription>Self-serve help for setting up and running your business.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <a href="#" className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-indigo-500/50 hover:shadow-xs transition-all group bg-zinc-50/20 dark:bg-zinc-900/10">
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-primary flex items-center gap-2">
                Getting Started <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-500 mt-1">Learn how to set up branches, roles, and load inventory.</p>
            </a>
            <a href="#" className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-indigo-500/50 hover:shadow-xs transition-all group bg-zinc-50/20 dark:bg-zinc-900/10">
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-primary flex items-center gap-2">
                POS Operations <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-500 mt-1">Cashier guides for the POS, split payments, and refunds.</p>
            </a>
            <a href="#" className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-indigo-500/50 hover:shadow-xs transition-all group bg-zinc-50/20 dark:bg-zinc-900/10">
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-primary flex items-center gap-2">
                ZIMRA Configuration <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-500 mt-1">Step-by-step fiscalisation and tax device setup.</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
