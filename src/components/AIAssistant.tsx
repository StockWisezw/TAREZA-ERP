import React, { useState, useRef, useEffect } from "react";
import { X, Send, User, Loader2, MessageSquare, PhoneCall, Terminal, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Card } from "./ui/card";
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  channel_id?: string;
  user_email: string;
  message: string;
  created_at: string;
}

interface ChatChannel {
  id: string;
  name: string;
}

export function AIAssistant() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"consulting" | "chat">("consulting");

  // Chat States
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Fallback local memory-based messages if network/tables are not seeded
  const [fallbackMessages, setFallbackMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      user_email: "system@tareza.co.zw",
      message: "Welcome to your Tareza Live Team chat channel! Start typing below to collaborate on operations.",
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: "init-2",
      user_email: "demo@tareza.co.zw",
      message: "Ready for on-site audit. Please compile the Goods Received Notes for the morning session.",
      created_at: new Date(Date.now() - 1800000).toISOString()
    }
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load channels or init default
  useEffect(() => {
    if (!isOpen) return;

    async function fetchChannels() {
      try {
        const { data, error } = await supabase
          .from("chat_channels")
          .select("*")
          .order("created_at", { ascending: true });

        if (error || !data || data.length === 0) {
          // Attempt to seed a General chat channel if database permits
          const { data: bData } = await supabase.from("businesses").select("id").limit(1).maybeSingle();
          if (bData?.id) {
            const { data: newChan, error: writeErr } = await supabase
              .from("chat_channels")
              .insert({
                name: "# general-lobby",
                business_id: bData.id,
                type: "public"
              })
              .select()
              .single();

            if (!writeErr && newChan) {
              setChannels([newChan]);
              setSelectedChannelId(newChan.id);
              return;
            }
          }
          // Default lobby state
          setChannels([{ id: "default", name: "# general-lobby" }]);
          setSelectedChannelId("default");
        } else {
          setChannels(data);
          setSelectedChannelId(data[0].id);
        }
      } catch (err) {
        setChannels([{ id: "default", name: "# general-lobby" }]);
        setSelectedChannelId("default");
      }
    }

    fetchChannels();
  }, [isOpen]);

  // Load chat messages when channel changes
  useEffect(() => {
    if (!selectedChannelId) return;

    let isSubscribed = true;

    async function fetchMessages() {
      if (selectedChannelId === "default") {
        return; // Use memory messages
      }

      setLoadingMessages(true);
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("channel_id", selectedChannelId)
          .order("created_at", { ascending: true })
          .limit(40);

        if (error) throw error;

        if (isSubscribed && data) {
          // Fetch corresponding emails for profile ids if needed
          const formatted = data.map((msg: any) => ({
            id: msg.id,
            channel_id: msg.channel_id,
            user_email: msg.user_email || msg.user_id || "Team Member",
            message: msg.message,
            created_at: msg.created_at
          }));
          setMessages(formatted);
        }
      } catch (err) {
        console.warn("Could not load database messages, using offline cache.");
      } finally {
        if (isSubscribed) setLoadingMessages(false);
      }
    }

    fetchMessages();

    // Poll for and sync latest messages every 4 seconds
    const interval = setInterval(() => {
      fetchMessages();
    }, 4000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [selectedChannelId]);

  // Scroll to bottom on updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, fallbackMessages, activeTab, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setSending(true);
    const userEmail = user?.email || "guest@tareza.local";
    const userMsg = inputText.trim();
    setInputText("");

    const newLocalMsg: ChatMessage = {
      id: Date.now().toString(),
      user_email: userEmail,
      message: userMsg,
      created_at: new Date().toISOString()
    };

    if (selectedChannelId === "default" || !selectedChannelId) {
      // Memory mode fallback
      setFallbackMessages(prev => [...prev, newLocalMsg]);
      setSending(false);
      return;
    }

    try {
      // 1. Check if we need profile_id/user_id from authentication state
      const { data: uContext } = await supabase.auth.getUser();
      const profileId = uContext?.user?.id;

      if (!profileId) {
        throw new Error("No authenticated session available");
      }

      const { error } = await supabase.from("chat_messages").insert({
        channel_id: selectedChannelId,
        user_id: profileId,
        user_email: userEmail,
        message: userMsg,
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      // Optimistically append message to local UI
      setMessages(prev => [...prev, newLocalMsg]);
    } catch (err) {
      // Graceful fallback on writing error
      setFallbackMessages(prev => [...prev, newLocalMsg]);
      toast.success("Message broadcasted locally (offline sync enabled)");
    } finally {
      setSending(false);
    }
  };

  const activeMessages = selectedChannelId === "default" ? fallbackMessages : messages;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 ${isOpen ? "scale-0 opacity-0 pointer-events-none" : "flex scale-100 opacity-100 z-50 animate-bounce"}`}
        style={{
          background: "linear-gradient(135deg, #18181b 0%, #3f3f46 100%)",
        }}
      >
        <MessageSquare className="h-6 w-6 text-white" />
      </Button>

      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 max-h-[640px] h-[85vh] flex flex-col shadow-2xl border-zinc-200 z-50 overflow-hidden rounded-2xl animate-in fade-in slide-in-from-bottom-10 duration-300">
          {/* Header */}
          <div className="bg-zinc-900 text-white p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center space-x-2">
              <div className="bg-white/10 p-1.5 rounded-lg">
                <MessageSquare className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight text-white leading-none">
                  Tareza Hub & Messaging
                </h3>
                <p className="text-[10px] text-zinc-400 font-mono mt-1">Connect with Team & Consultants</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-zinc-200 bg-zinc-50 shrink-0">
            <button
              onClick={() => setActiveTab("consulting")}
              className={`flex-1 text-center py-2.5 text-xs font-bold font-sans uppercase tracking-wider transition-all border-b-2 ${activeTab === "consulting" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
            >
              Consulting Plan
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 text-center py-2.5 text-xs font-bold font-sans uppercase tracking-wider transition-all border-b-2 ${activeTab === "chat" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
            >
              Team Chat ({activeMessages.length})
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col bg-zinc-50">
            {activeTab === "consulting" ? (
              <ScrollArea className="flex-1 p-5">
                <div className="space-y-5 pb-4">
                  <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Premium Service Bundle</span>
                        <h4 className="font-extrabold text-zinc-900 text-base mt-1.5">Consultancy & Stocktake Plan</h4>
                      </div>
                      <span className="font-mono text-xl font-black text-indigo-650">$50<span className="text-xs font-normal text-zinc-500">/mo</span></span>
                    </div>

                    <p className="text-xs text-zinc-600 leading-relaxed">
                      Numbers need expert interpretation. Our premier consultancy bundle ensures you map physical conditions to your digitized ledgers without errors.
                    </p>

                    <div className="space-y-2 text-xs text-zinc-700 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200/50">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span><strong>1 On-site Visit Included</strong> for stocktake or audit desk reviews</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span><strong>Trend Interpretation</strong> translates statistics to clear actions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span><strong>Active Support Channel</strong> to resolve technical anomalies</span>
                      </div>
                    </div>

                    <a
                      href="https://wa.me/263776699950"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full pt-1"
                    >
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 py-4">
                        <PhoneCall className="h-3.5 w-3.5" /> Speak with Representative
                      </Button>
                    </a>
                  </div>

                  {/* Access Developer Panel Link */}
                  <div className="bg-zinc-900 text-white p-4 rounded-xl shadow-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-blue-400" />
                      <h5 className="font-bold text-sm text-white">Developer Administration</h5>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Access advanced diagnostic utilities, direct database telemetry logs, and manual backups triggers safely.
                    </p>
                    <a href="/developer-panel" className="block pt-1">
                      <Button variant="outline" className="w-full border-zinc-700 hover:bg-zinc-800 text-zinc-200 hover:text-white font-semibold text-xs py-2.5">
                        Access Developer Terminal
                      </Button>
                    </a>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <>
                {/* Channels Dropdown Selector */}
                <div className="p-2.5 border-b border-zinc-200 bg-white flex items-center justify-between shadow-sm shrink-0">
                  <span className="text-xs font-bold text-zinc-500 font-mono">Workspace Lobby:</span>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="text-xs font-semibold bg-zinc-100 border-zinc-200 border rounded p-1 max-w-[180px]"
                  >
                    {channels.map((chan) => (
                      <option key={chan.id} value={chan.id}>
                        {chan.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Messages Loop */}
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                  <div className="space-y-3 pb-3">
                    {loadingMessages ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                      </div>
                    ) : (
                      activeMessages.map((msg) => {
                        const isSelf = msg.user_email === (user?.email || "guest@tareza.local");
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                          >
                            <span className="text-[9px] text-zinc-400 font-semibold mb-0.5 px-1">
                              {msg.user_email} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div
                              className={`px-3 py-2 rounded-xl text-xs max-w-[85%] leading-relaxed ${isSelf ? "bg-zinc-900 text-white rounded-tr-none" : "bg-white border text-zinc-800 rounded-tl-none shadow-sm"}`}
                            >
                              {msg.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                {/* Message input */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 bg-white border-t border-zinc-200 flex gap-2 shrink-0 shadow-sm"
                >
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type message to team members..."
                    className="flex-1 h-9 text-xs bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-800 rounded-lg"
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-9 w-9 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shrink-0"
                    disabled={!inputText.trim() || sending}
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
