import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Phone, Terminal, Loader2, Users, Bot, Sparkles } from 'lucide-react';
import { rawSupabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/firebaseClient';
import { usePOSStore } from '../store/posStore';
import { collection, addDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_email: string;
  sender_name: string;
  text: string;
  created_at: string;
  branch_name?: string;
}

interface AIMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'messenger' | 'ai' | 'hotline'>('messenger');
  
  // Realtime P2P Staff Messenger State
  const [messengerMessages, setMessengerMessages] = useState<ChatMessage[]>([]);
  const [messengerInputText, setMessengerInputText] = useState('');
  const [isMessengerLoading, setIsMessengerLoading] = useState(false);
  
  // AI support state connected with Developer diagnostics
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "👋 Hello! I am your AI Diagnostics Assistant, integrated with Developer Mode. Ask me about system networks, pending POS logs, double-entry ledgers, or starting shift configurations!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [aiInputText, setAiInputText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentBranchName, setCurrentBranchName] = useState('Harare Head Office');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiMessagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch current user details & branch on mount
  useEffect(() => {
    rawSupabase.auth.getUser().then(async ({ data: { user } }) => {
      setCurrentUser(user);
      if (user) {
        try {
          const { data: bUser } = await rawSupabase
            .from('business_users')
            .select('branch_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
            
          if (bUser?.branch_id) {
            const { data: branch } = await rawSupabase
              .from('branches')
              .select('name')
              .eq('id', bUser.branch_id)
              .limit(1)
              .maybeSingle();
              
            if (branch?.name) {
              setCurrentBranchName(branch.name);
            }
          }
        } catch (e) {
          console.error('[Messenger] Failed to load brand/branch context on mount:', e);
        }
      }
    });
  }, []);

  // Firestore Real-Time snapshots for P2P Staff Messenger
  useEffect(() => {
    if (!isOpen || activeTab !== 'messenger') return;

    setIsMessengerLoading(true);
    const messagesQuery = query(
      collection(db, 'messenger_messages'),
      orderBy('created_at', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setMessengerMessages(msgs);
      setIsMessengerLoading(false);
    }, (error) => {
      console.error('[Firestore Snapshots] Messenger subscription failed:', error);
      setIsMessengerLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, activeTab]);

  // Keep scrollbars pinned to the bottom dynamically
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messengerMessages, activeTab]);

  useEffect(() => {
    if (aiMessagesEndRef.current) {
      aiMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, activeTab]);

  // Handle P2P text dispatch
  const handleSendMessengerMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messengerInputText.trim()) return;

    const textToSend = messengerInputText.trim();
    setMessengerInputText('');

    try {
      await addDoc(collection(db, 'messenger_messages'), {
        sender_id: currentUser?.id || 'anonymous',
        sender_email: currentUser?.email || 'anonymous@tareza.co.zw',
        sender_name: currentUser?.email?.split('@')[0] || 'Staff Member',
        text: textToSend,
        created_at: new Date().toISOString(),
        branch_name: currentBranchName
      });
    } catch (err) {
      console.error('[Firestore Snapshots] Dispatch error:', err);
      toast.error('Failed to send message over Firestore backend.');
    }
  };

  // Compile local developer-mode diagnostic details
  const compileDiagnostics = () => {
    const isOnline = navigator.onLine;
    const pendingSales = usePOSStore.getState().offlineQueue.length;
    const cartCount = usePOSStore.getState().cart.length;
    const activeRoute = window.location.pathname;
    
    return {
      isOnline,
      pendingSales,
      cartCount,
      activeRoute,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    };
  };

  const getLocalDiagnosticAIResponse = (input: string) => {
    const text = input.toLowerCase();
    const diag = compileDiagnostics();
    
    if (text.includes('sync') || text.includes('offline') || text.includes('upload') || text.includes('queue')) {
      return `📊 **Diagnostic Report: Transactions & Offline Queue**\n\n` +
             `*   **Network Link:** ${diag.isOnline ? '🟢 Connected (Online)' : '🔴 Disconnected (Offline)'}\n` +
             `*   **Pending Queue:** **${diag.pendingSales} sales** currently queued in memory.\n` +
             `*   **Active Route:** \`${diag.activeRoute}\`\n\n` +
             `${diag.pendingSales > 0 
                ? `There are *${diag.pendingSales}* sales pending synchronization. When your internet link is active, the \`SyncManager\` will automatically attempt secure uploads to Firestore. You can also click "Sync Now" in the Topbar status indicator.` 
                : `Awesome! All transactions are fully synchronized. Your database is up-to-date with Supabase / Firestore.`}`;
    }
    
    if (text.includes('developer') || text.includes('diagnostic') || text.includes('terminal') || text.includes('panel')) {
      return `🔧 **Developer Console Integration**\n\n` +
             `*   **Direct rest query endpoint:** \`https://firestore.googleapis.com\`\n` +
             `*   **Local system network adapter:** \`navigator.onLine = ${diag.isOnline}\`\n` +
             `*   **Theme state:** \`${diag.theme}-mode\`\n\n` +
             `To test deep socket and ping connection speeds directly, navigate to the **[Open Diagnostic Terminal](/developer-panel)** in 'Developer Mode' or request support help. You can trigger an administrative SQLite backup there.`;
    }

    if (text.includes('pos') || text.includes('quantity') || text.includes('decimal') || text.includes('float')) {
      return `🛒 **POS Terminal Troubleshooting**\n\n` +
             `*   **Current Cart Size:** **${diag.cartCount} items**\n` +
             `*   **Start Quantity Rule:** Updated to **0** by default, allowing quick typing of decimals like \`0.124\` via the Odoo keypad.\n` +
             `*   **Shift status:** ${localStorage.getItem('tareza_require_float') === 'true' ? '🔒 Required opening float check' : '🔓 Instant register start active'}.\n\n` +
             `If you need assistance logging in or beginning a cashier shift, click the 'Shift Controls' button at the top-left of the POS panel.`;
    }

    if (text.includes('ledger') || text.includes('journal') || text.includes('accounting')) {
      return `📓 **Double-Entry Ledger Status**\n\n` +
             `Sales completed on POS instantly create journals posting debits to Accounts Receivable or POS Cash registers with credit offsets to Sales Revenue. Check out the **Accounting Ledger / General Ledger** view to audit balancing columns directly.`;
    }

    return `🤖 **Diagnostics Assistant**\n` +
           `*System State: Connected & Diagnostic-Ready*\n\n` +
           `Here are some live configurations I parsed from your terminal context:\n` +
           `*   **Network Connection:** ${diag.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}\n` +
           `*   **Local Path:** \`${diag.activeRoute}\`\n` +
           `*   **Buffered Sync Logs:** ${diag.pendingSales} pending items.\n\n` +
           `How can I help you today? You can ask me about:\n` +
           `1.  **Sync & Offline state** (e.g., "why does it say offline?")\n` +
           `2.  **Developer Diagnostic Handshakes**\n` +
           `3.  **POS quantity and decimal setups**\n` +
           `4.  **Sales and ledger double-entries**`;
  };

  // Handle AI question submission
  const handleSendAIQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInputText.trim()) return;

    const userPrompt = aiInputText.trim();
    setAiInputText('');
    setIsAiLoading(true);

    const userMsg: AIMessage = {
      id: uuidv4(),
      sender: 'user',
      text: userPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setAiMessages(prev => [...prev, userMsg]);

    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    let replyText = '';

    try {
      if (geminiKey) {
        const diag = compileDiagnostics();
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are Tareza Support Bot. You help users troubleshoot their Point of Sale and ERP system. 
You are integrated deep with the developer diagnostic state. Use standard Markdown formatting.
Live Context:
- Network Adapter Connection (navigator.onLine): ${diag.isOnline ? 'ONLINE' : 'OFFLINE'}
- Pending Sales in Sync/Offline memory Queue: ${diag.pendingSales} sales
- Active Page View Path: ${diag.activeRoute}
- Current Active Cart Count: ${diag.cartCount} items
- Superadmin address: tapsforex@gmail.com
- User current physical Branch location: ${currentBranchName}

User asked: ${userPrompt}

Keep response highly brief, actionable, technical, styled with bulleted points, and extremely welcoming.`
              }]
            }]
          })
        });

        const resJson = await res.json();
        replyText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!replyText) {
          throw new Error('Empirical text completion response was empty.');
        }
      } else {
        // Fall back to robust diagnostic rule engine
        await new Promise(resolve => setTimeout(resolve, 800));
        replyText = getLocalDiagnosticAIResponse(userPrompt);
      }
    } catch (err) {
      console.warn('Gemini proxy error, falling back:', err);
      replyText = getLocalDiagnosticAIResponse(userPrompt);
    } finally {
      setIsAiLoading(false);
      setAiMessages(prev => [...prev, {
        id: uuidv4(),
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  };

  return (
    <>
      {/* Floating launcher button */}
      <button
        id="floating-support-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-2xl flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all z-50 group border border-zinc-200 dark:border-zinc-800"
      >
        {isOpen ? (
          <X className="h-5.5 w-5.5" />
        ) : (
          <div className="relative">
            <MessageSquare className="h-5.5 w-5.5" />
            <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bg-indigo-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold animate-pulse">
              1
            </span>
          </div>
        )}
      </button>

      {/* Launcher Panel container */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="fixed bottom-24 right-5 w-85 sm:w-98 h-[540px] bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl flex flex-col overflow-hidden z-50 text-zinc-800 dark:text-zinc-100 font-sans"
          >
            {/* Header branding block */}
            <div className="bg-zinc-950 px-4 py-3 flex items-center justify-between text-white border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse animate-duration-1000" />
                <div className="flex flex-col">
                  <span className="font-bold text-xs tracking-tight">Tareza Workspace Hub</span>
                  <span className="text-[10px] text-zinc-400 font-mono leading-none">{currentBranchName}</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold font-sans">
              <button
                onClick={() => setActiveTab('messenger')}
                className={`flex-1 py-3 text-center flex items-center justify-center gap-1 transition-all ${
                  activeTab === 'messenger'
                    ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-900/50'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Staff Messenger
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`flex-1 py-3 text-center flex items-center justify-center gap-1 transition-all ${
                  activeTab === 'ai'
                    ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-900/50'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                AI Diagnostic Support
              </button>
              <button
                onClick={() => setActiveTab('hotline')}
                className={`flex-1 py-3 text-center flex items-center justify-center gap-1 transition-all ${
                  activeTab === 'hotline'
                    ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-900/50'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                Hotline
              </button>
            </div>

            {/* Scrolling Messaging Panels */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col min-h-0 bg-zinc-50/50 dark:bg-zinc-950/20">
              
              {/* Tab 1: P2P Staff Messenger */}
              {activeTab === 'messenger' && (
                <>
                  {isMessengerLoading && messengerMessages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-zinc-400">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                    </div>
                  ) : messengerMessages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-400 dark:text-zinc-500">
                      <Users className="h-10 w-10 mb-2 stroke-[1.5] text-zinc-300" />
                      <p className="text-xs font-semibold">Instant Staff Room</p>
                      <p className="text-[10px] mt-1 max-w-[210px] leading-normal">
                        Communication workspace synchronized in real-time via Firestore snapshots across Harare, Bulawayo & Gweru.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
                      {messengerMessages.map((msg) => {
                        const isMe = msg.sender_id === (currentUser?.id || 'anonymous');
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center gap-1 px-1 mb-0.5">
                              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold">
                                {msg.sender_name}
                              </span>
                              {msg.branch_name && (
                                <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 text-center">
                                  {msg.branch_name}
                                </span>
                              )}
                            </div>
                            <div
                              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-sm whitespace-pre-wrap break-words ${
                                isMe
                                  ? 'bg-zinc-900 text-white dark:bg-indigo-600 dark:text-white'
                                  : 'bg-white text-zinc-950 dark:bg-zinc-800 dark:text-white border border-zinc-200/50 dark:border-zinc-700/50'
                              }`}
                            >
                              <p>{msg.text}</p>
                            </div>
                            <span className="text-[8px] text-zinc-400 px-1 mt-0.5 font-mono">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </>
              )}

              {/* Tab 2: AI Diagnostic Support */}
              {activeTab === 'ai' && (
                <div className="flex-1 flex flex-col justify-between overflow-hidden h-full">
                  <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                    {aiMessages.map((msg) => {
                      const isMe = msg.sender === 'user';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 px-1 mb-0.5">
                            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold">
                              {isMe ? 'Developer Context' : 'AI Engineer Diagnostics'}
                            </span>
                          </div>
                          <div
                            className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-sm whitespace-pre-wrap break-words ${
                              isMe
                                ? 'bg-zinc-900 text-white dark:bg-zinc-700 dark:text-white'
                                : 'bg-indigo-50 border border-indigo-100 text-zinc-950 dark:bg-indigo-950/20 dark:text-indigo-100 dark:border-indigo-500/20'
                            }`}
                          >
                            <p>{msg.text}</p>
                          </div>
                        </div>
                      );
                    })}
                    {isAiLoading && (
                      <div className="flex items-center gap-2 p-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl max-w-[50%]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                        <span className="text-[10px] text-zinc-400 animate-pulse">Analyzing logs...</span>
                      </div>
                    )}
                    <div ref={aiMessagesEndRef} />
                  </div>
                </div>
              )}

              {/* Tab 3: Hotline Support */}
              {activeTab === 'hotline' && (
                <div className="flex flex-col h-full justify-center space-y-4 p-4 text-center">
                  <div className="flex flex-col items-center">
                    <div className="h-14 w-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2 border border-indigo-100 dark:border-indigo-500/20">
                      <Phone className="h-6 w-6 stroke-[1.5]" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-250">Emergency Assistance</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-normal max-w-[240px] mx-auto">
                      Need direct engineering line feedback? Connect for instant technical escalation or Whatsapp channels.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 max-w-[280px] mx-auto w-full">
                    <a
                      href="https://wa.me/263776699950"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-750 text-white transition-all font-bold text-xs py-3 rounded-xl shadow-md cursor-pointer"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Whatsapp Executive Support
                    </a>
                    
                    <a
                      href="/developer-panel"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-center gap-2 w-full bg-zinc-855 dark:bg-zinc-800 hover:bg-zinc-700 hover:dark:bg-zinc-700 text-zinc-750 hover:text-zinc-950 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-all font-bold text-xs py-3 rounded-xl shadow-sm cursor-pointer"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      Open Diagnostic Terminal
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar Footer (conditional based on active chat tabs) */}
            {activeTab === 'messenger' && (
              <form 
                onSubmit={handleSendMessengerMessage}
                className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={messengerInputText}
                  onChange={(e) => setMessengerInputText(e.target.value)}
                  placeholder="Dispatch unified message/update..."
                  className="flex-1 bg-zinc-100 dark:bg-zinc-950 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white border border-transparent dark:focus:ring-indigo-400"
                />
                <button
                  type="submit"
                  disabled={!messengerInputText.trim()}
                  className="h-9 w-9 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer border-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}

            {activeTab === 'ai' && (
              <form 
                onSubmit={handleSendAIQuestion}
                className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  placeholder="Ask bot: 'why is my sync offline?', 'decimal setup'..."
                  className="flex-1 bg-zinc-100 dark:bg-zinc-950 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white border border-transparent dark:focus:ring-indigo-400"
                />
                <button
                  type="submit"
                  disabled={!aiInputText.trim() || isAiLoading}
                  className="h-9 w-9 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer border-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
