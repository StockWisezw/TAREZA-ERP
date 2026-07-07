import React, { useState, useEffect } from 'react';
import { 
  googleSignInForGmail, 
  getGmailAccessToken, 
  listGmailMessages, 
  getGmailMessageDetails, 
  sendGmailEmail, 
  createGmailDraft, 
  trashGmailMessage, 
  archiveGmailMessage 
} from '../services/gmailService';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Mail, 
  Search, 
  Send, 
  Trash2, 
  Archive, 
  RefreshCw, 
  Plus, 
  X, 
  Reply, 
  ArrowLeft, 
  Check, 
  Inbox, 
  Clock, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  labels: string[];
}

export default function GmailInbox() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Compose modal state
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);

  // Authenticate on mount if token is already in memory
  useEffect(() => {
    const token = getGmailAccessToken();
    if (token) {
      setIsAuthenticated(true);
      fetchInbox();
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await googleSignInForGmail();
      setIsAuthenticated(true);
      toast.success('Successfully connected to Gmail!');
      fetchInbox();
    } catch (error: any) {
      toast.error(`Gmail Connection Failed: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const getHeader = (headers: { name: string; value: string }[], name: string): string => {
    return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  };

  const parseBody = (payload: any): string => {
    if (!payload) return '';
    if (payload.body && payload.body.data) {
      try {
        const decoded = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        // Try UTF-8 decoding safely
        return decodeURIComponent(escape(decoded));
      } catch (e) {
        try {
          return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } catch (err) {
          return '';
        }
      }
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        const body = parseBody(part);
        if (body) return body;
      }
    }
    return '';
  };

  const fetchInbox = async (queryText?: string) => {
    setRefreshing(true);
    try {
      const listData = await listGmailMessages({ query: queryText, maxResults: 15 });
      
      if (!listData.messages || listData.messages.length === 0) {
        setEmails([]);
        setRefreshing(false);
        return;
      }

      // Fetch message details in parallel
      const detailedPromises = listData.messages.map(async (msg: { id: string }) => {
        try {
          const detail = await getGmailMessageDetails(msg.id);
          const headers = detail.payload?.headers || [];
          
          return {
            id: detail.id,
            threadId: detail.threadId,
            subject: getHeader(headers, 'Subject') || '(No Subject)',
            from: getHeader(headers, 'From') || 'Unknown Sender',
            to: getHeader(headers, 'To') || '',
            date: getHeader(headers, 'Date') || '',
            snippet: detail.snippet || '',
            body: parseBody(detail.payload) || detail.snippet || '',
            labels: detail.labelIds || []
          };
        } catch (err) {
          console.error(`Failed to load details for message ${msg.id}:`, err);
          return null;
        }
      });

      const resolved = await Promise.all(detailedPromises);
      const validEmails = resolved.filter((e): e is EmailMessage => e !== null);
      
      setEmails(validEmails);
      
      // Select the first email by default on desktop if not selected
      if (validEmails.length > 0 && !selectedEmail) {
        setSelectedEmail(validEmails[0]);
      }
    } catch (error: any) {
      console.error('Fetch inbox error:', error);
      toast.error('Failed to load Gmail messages.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInbox(searchQuery);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo || !composeSubject || !composeBody) {
      toast.error('All fields are required to send an email.');
      return;
    }

    setSendingEmail(true);
    try {
      await sendGmailEmail({
        to: composeTo,
        subject: composeSubject,
        body: composeBody
      });
      toast.success('Email sent successfully!');
      setIsComposeOpen(false);
      resetComposeForm();
      fetchInbox();
    } catch (error: any) {
      toast.error(`Failed to send email: ${error.message || error}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!composeTo && !composeSubject && !composeBody) {
      toast.error('Draft is empty. Add details before saving.');
      return;
    }

    setSendingEmail(true);
    try {
      await createGmailDraft({
        to: composeTo || '',
        subject: composeSubject || '(No Subject)',
        body: composeBody || ''
      });
      toast.success('Draft saved successfully!');
      setIsComposeOpen(false);
      resetComposeForm();
    } catch (error: any) {
      toast.error(`Failed to save draft: ${error.message || error}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDeleteEmail = async (emailId: string) => {
    const confirmed = window.confirm('Are you sure you want to move this message to Trash?');
    if (!confirmed) return;

    try {
      await trashGmailMessage(emailId);
      toast.success('Email moved to Trash');
      setEmails(prev => prev.filter(e => e.id !== emailId));
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
      }
    } catch (error: any) {
      toast.error('Failed to delete email.');
    }
  };

  const handleArchiveEmail = async (emailId: string) => {
    const confirmed = window.confirm('Are you sure you want to archive this email?');
    if (!confirmed) return;

    try {
      await archiveGmailMessage(emailId);
      toast.success('Email archived');
      setEmails(prev => prev.filter(e => e.id !== emailId));
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
      }
    } catch (error: any) {
      toast.error('Failed to archive email.');
    }
  };

  const handleReply = (email: EmailMessage) => {
    setComposeTo(email.from);
    setComposeSubject(email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`);
    setComposeBody(`\n\nOn ${email.date}, ${email.from} wrote:\n> ${email.body.split('\n').join('\n> ')}`);
    setIsComposeOpen(true);
  };

  const resetComposeForm = () => {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
  };

  // Render Login page if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-fade-in" id="gmail-auth-container">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-3xl flex items-center justify-center shadow-inner">
            <Mail className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Gmail Integration</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Connect your Google Workspace or Gmail account to view inboxes, check client communications, write replies, and compose new emails directly from Tareza ERP.
            </p>
          </div>

          <div className="pt-2">
            {/* Standard "Sign in with Google" styled button */}
            <button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 rounded-2xl shadow-sm text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 select-none"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>{loading ? 'Authenticating...' : 'Sign in with Google'}</span>
            </button>
          </div>
          
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Secure, end-to-end OAuth connection directly with Google. Your Gmail credentials are never stored.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in space-y-4" id="gmail-inbox-dashboard">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-150 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Mail className="w-6 h-6 text-red-500" />
            Gmail Workspace
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-450">
            Read, search, manage labels, and send messages directly on your corporate mail service.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => { resetComposeForm(); setIsComposeOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Compose Email
          </Button>
          <Button 
            onClick={() => fetchInbox()}
            variant="outline"
            className="border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Control Area: Search & Quick Navigation */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emails (e.g. from:someone subject:invoice)..."
            className="pl-10 rounded-xl border-zinc-200 dark:border-zinc-800 focus-visible:ring-indigo-500 text-sm h-10 bg-white dark:bg-zinc-900"
          />
        </div>
        <Button 
          type="submit"
          className="bg-zinc-950 hover:bg-zinc-850 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-xl px-4 font-bold text-xs"
        >
          Search
        </Button>
      </form>

      {/* Main Mailbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 overflow-hidden min-h-0">
        
        {/* Left Side: Email Thread List */}
        <div className={`lg:col-span-5 flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden ${selectedEmail ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/20 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Inbox className="w-3.5 h-3.5" /> Recent Messages
            </span>
            {refreshing && <span className="text-[10px] text-zinc-400 animate-pulse">Loading...</span>}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 custom-scrollbar">
            {emails.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 flex flex-col items-center justify-center h-full space-y-2">
                <Mail className="w-8 h-8 text-zinc-300 stroke-[1.5]" />
                <p className="text-xs font-semibold">No messages found</p>
                <p className="text-[10px] text-zinc-400">Your inbox is clear or try expanding your search.</p>
              </div>
            ) : (
              emails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                return (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`p-3.5 text-left cursor-pointer transition-all duration-150 flex flex-col gap-1.5 border-l-2 ${
                      isSelected 
                        ? 'bg-zinc-50 dark:bg-zinc-800/55 border-indigo-600' 
                        : 'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-850 dark:text-zinc-150 truncate max-w-[150px]">
                        {email.from.split('<')[0].trim()}
                      </span>
                      <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {email.date ? email.date.split(',')[0] : ''}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      {email.subject}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {email.snippet}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Detailed Email Content Reading Panel */}
        <div className={`lg:col-span-7 flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden ${!selectedEmail ? 'hidden lg:flex' : 'flex'}`}>
          {selectedEmail ? (
            <div className="flex flex-col h-full">
              {/* Toolbar */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/20 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
                <Button 
                  onClick={() => setSelectedEmail(null)}
                  variant="ghost"
                  className="lg:hidden text-zinc-500 px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>

                <div className="flex items-center gap-1.5 ml-auto">
                  <Button 
                    onClick={() => handleReply(selectedEmail)}
                    variant="outline"
                    className="border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-xl text-xs gap-1.5 cursor-pointer"
                  >
                    <Reply className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" /> Reply
                  </Button>
                  <Button 
                    onClick={() => handleArchiveEmail(selectedEmail.id)}
                    variant="outline"
                    className="border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-xl text-xs gap-1.5 cursor-pointer text-zinc-600 dark:text-zinc-450"
                  >
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </Button>
                  <Button 
                    onClick={() => handleDeleteEmail(selectedEmail.id)}
                    variant="outline"
                    className="border-zinc-200 dark:border-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 rounded-xl text-xs gap-1.5 cursor-pointer text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                <div className="space-y-1">
                  <div className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight leading-snug">
                    {selectedEmail.subject}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 py-1.5 border-b border-zinc-100 dark:border-zinc-800/80">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">From:</span>
                    <span>{selectedEmail.from}</span>
                    <span className="mx-1">•</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">To:</span>
                    <span>{selectedEmail.to}</span>
                    <span className="ml-auto text-[10px] text-zinc-400">{selectedEmail.date}</span>
                  </div>
                </div>

                <div className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words font-sans py-2 bg-zinc-50/40 dark:bg-zinc-950/10 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  {selectedEmail.body}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400 space-y-2">
              <Mail className="w-12 h-12 text-zinc-200 stroke-[1.5]" />
              <p className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Select an email to read</p>
              <p className="text-xs text-zinc-400 max-w-xs">Choose any email on the left thread pane to view its headers, metadata, and body context.</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Email Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/20">
              <span className="text-sm font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-indigo-500" /> New Email Draft
              </span>
              <Button 
                onClick={() => setIsComposeOpen(false)}
                variant="ghost"
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSendEmail} className="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Recipient Email Address (To)</label>
                <Input 
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="rounded-xl text-xs h-9 bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Subject Line</label>
                <Input 
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Enter email subject"
                  required
                  className="rounded-xl text-xs h-9 bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Message Body</label>
                <textarea 
                  rows={8}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your email body message here..."
                  required
                  className="w-full p-3 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-zinc-200 resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                <Button 
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={sendingEmail}
                  variant="outline"
                  className="border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-350 cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" /> Save as Draft
                </Button>

                <div className="flex gap-2">
                  <Button 
                    type="button"
                    onClick={() => setIsComposeOpen(false)}
                    variant="ghost"
                    className="rounded-xl text-xs text-zinc-500"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={sendingEmail}
                    className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" /> {sendingEmail ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
