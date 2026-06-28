import React, { useState, useEffect, useRef } from 'react';
import { supabase, db } from '../lib/firebaseClient';
import { collection, addDoc, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { encryptMessage, decryptMessage } from '../lib/crypto';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { 
  MessageSquare, 
  Send, 
  Search, 
  User, 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  Building2, 
  CheckCheck,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface StaffUser {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  branch: string;
  avatar: string;
}

interface MessagePayload {
  id: string;
  sender_id: string;
  receiver_id: string;
  conversation_id: string;
  encrypted_text: string;
  sender_name: string;
  created_at: string;
}

export default function Messenger() {
  const { user: currentAuthUser } = useAuth();
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffUser[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<StaffUser | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [inputText, setInputText] = useState('');
  const [activeMessages, setActiveMessages] = useState<MessagePayload[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showRealCiphertext, setShowRealCiphertext] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper macro snips for quick cashier/admin workflow
  const QUICK_SNIPPETS = [
    "Register Float verified & counted.",
    "Manager override required for refund.",
    "Inventory sync completed successfully.",
    "POS printer offline - shifting cash drawer logs.",
    "Bulk double-entry journal balance match requested."
  ];

  // Fetch registered business team members and profiles
  useEffect(() => {
    let active = true;

    async function loadWorkspaceUsers() {
      if (!currentAuthUser) return;
      try {
        setLoadingStaff(true);
        
        // 1. Fetch current business ID of the active user
        const { data: buData } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', currentAuthUser.$id)
          .limit(1)
          .maybeSingle();

        if (!buData) {
          if (active) setLoadingStaff(false);
          return;
        }

        const businessId = buData.business_id;

        // 2. Fetch all members mapped under this business
        const { data: teamData } = await supabase
          .from('business_users')
          .select('*')
          .eq('business_id', businessId);

        if (!teamData) {
          if (active) setLoadingStaff(false);
          return;
        }

        // 3. Fetch user profiles to display human identities
        const { data: allProfiles } = await supabase.from('profiles').select('*');
        const profileMap: Record<string, any> = {};
        if (allProfiles) {
          allProfiles.forEach((p: any) => {
            profileMap[p.id] = p;
          });
        }

        // 4. Fetch roles and branches
        const { data: roleData } = await supabase.from('roles').select('*').eq('business_id', businessId);
        const { data: branchData } = await supabase.from('branches').select('*').eq('business_id', businessId);

        const roleMap: Record<string, string> = {};
        if (roleData) {
          roleData.forEach((r: any) => {
            roleMap[r.id] = r.name;
          });
        }

        const branchMap: Record<string, string> = {};
        if (branchData) {
          branchData.forEach((b: any) => {
            branchMap[b.id] = b.name;
          });
        }

        // Create elegant user records
        const mappedList: StaffUser[] = teamData
          .map((t: any) => {
            const profile = profileMap[t.user_id];
            const first = profile?.first_name || 'Staff';
            const last = profile?.last_name || 'Member';
            
            return {
              userId: t.user_id,
              name: `${first} ${last}`.trim(),
              email: profile?.email || t.invited_email || 'staff@tareza.co.zw',
              phone: profile?.phone || '',
              role: t.role_id ? (roleMap[t.role_id] || 'Staff') : 'Staff',
              branch: t.branch_id ? (branchMap[t.branch_id] || 'Main Branch') : 'Harare Head Office',
              avatar: `${first.substring(0, 1)}${last.substring(0, 1)}`.toUpperCase()
            };
          })
          // Filter out current logged in user to avoid messaging yourself
          .filter((u: StaffUser) => u.userId !== currentAuthUser.$id);

        if (active) {
          setStaffList(mappedList);
          setFilteredStaff(mappedList);
          if (mappedList.length > 0) {
            setSelectedRecipient(mappedList[0]);
          }
          setLoadingStaff(false);
        }
      } catch (err) {
        console.error('[Staff Messenger] Error building user directory:', err);
        if (active) setLoadingStaff(false);
        toast.error('Failed to load employee list.');
      }
    }

    loadWorkspaceUsers();
    return () => {
      active = false;
    };
  }, [currentAuthUser]);

  // Filter staff by search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStaff(staffList);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredStaff(
        staffList.filter(
          s => s.name.toLowerCase().includes(term) || 
               s.role.toLowerCase().includes(term) || 
               s.branch.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, staffList]);

  // Dynamic FireStore Snapshot query for active conversation messages
  useEffect(() => {
    if (!currentAuthUser || !selectedRecipient) return;

    setLoadingMessages(true);

    // Compound sorted conversation key to scale smoothly with private message snapshots
    const convId = [currentAuthUser.$id, selectedRecipient.userId].sort().join('_to_');

    const qMessages = query(
      collection(db, 'private_messages'),
      where('conversation_id', '==', convId),
      orderBy('created_at', 'asc')
    );

    const unsubscribe = onSnapshot(qMessages, (snapshot) => {
      const msgs: MessagePayload[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as MessagePayload);
      });
      setActiveMessages(msgs);
      setLoadingMessages(false);
      
      // Auto scroll
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      console.error('[Firestore Snapshot] Private message lookup permission failed:', error);
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [currentAuthUser, selectedRecipient]);

  // Dispatch direct message
  const handleSendMessage = async (e?: React.FormEvent, snipText?: string) => {
    if (e) e.preventDefault();
    
    const rawText = snipText || inputText;
    if (!rawText.trim() || !currentAuthUser || !selectedRecipient) return;

    if (!snipText) setInputText('');

    const targetRecipientId = selectedRecipient.userId;
    const senderId = currentAuthUser.$id;
    const convId = [senderId, targetRecipientId].sort().join('_to_');
    const senderDisplayName = currentAuthUser.email?.split('@')[0] || 'Staff';

    // End-to-End Encryption prior upload
    const encrypted = encryptMessage(rawText.trim(), senderId, targetRecipientId);

    try {
      await addDoc(collection(db, 'private_messages'), {
        sender_id: senderId,
        receiver_id: targetRecipientId,
        conversation_id: convId,
        encrypted_text: encrypted,
        sender_name: senderDisplayName,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('[Firestore Snapshots] Private message insertion rejected:', err);
      toast.error('Crypt message write access denied.');
    }
  };

  // Toggle visual raw binary/ciphertext proof
  const toggleCiphertextProof = (msgId: string) => {
    setShowRealCiphertext(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10 flex flex-col h-[calc(100vh-140px)] gap-6">
      {/* Dynamic branding header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
            Staff Messenger
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 gap-1 border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              E2E Encryption Active
            </Badge>
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time, secure private messaging between managers, cashiers, and admins.
          </p>
        </div>
      </div>

      {/* Main chat center console */}
      <div className="flex-1 flex flex-col md:flex-row bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm h-full shrink-0">
        
        {/* Left Column: Registered Employee Directory */}
        <div className="w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
            <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Workspace Partners
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                type="text"
                placeholder="Find cashier or admin..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9.5 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingStaff ? (
              <div className="flex items-center justify-center p-8 space-x-2 text-zinc-400 dark:text-zinc-500">
                <span className="text-xs animate-pulse">Loading branch directory...</span>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 space-y-2">
                <User className="w-8 h-8 mx-auto stroke-[1.2] opacity-50" />
                <p className="text-xs font-medium">No other users found</p>
                <p className="text-[10px] leading-relaxed max-w-[180px] mx-auto">
                  Add team profiles inside Settings to communicate across terminals.
                </p>
              </div>
            ) : (
              filteredStaff.map((staff) => {
                const isSelected = selectedRecipient?.userId === staff.userId;
                return (
                  <button
                    key={staff.userId}
                    onClick={() => setSelectedRecipient(staff)}
                    className={`w-full flex items-center gap-3 p-3 text-left rounded-2xl transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-zinc-950 text-white dark:bg-[#202024] dark:text-zinc-50'
                        : 'hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <Avatar className="h-10 w-10 shrink-0 border border-zinc-250 dark:border-zinc-800 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                      <AvatarFallback className="text-xs font-bold leading-none select-none">
                        {staff.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <p className="text-xs font-bold truncate leading-none mb-1 font-sans">{staff.name}</p>
                        <span className={`text-[8px] font-mono px-1 py-0.2 rounded shrink-0 uppercase tracking-widest ${
                          isSelected 
                            ? 'bg-zinc-800 text-zinc-300 dark:bg-zinc-900 dark:text-indigo-300' 
                            : 'bg-zinc-250 dark:bg-zinc-800 text-zinc-500'
                        }`}>
                          {staff.role}
                        </span>
                      </div>
                      <p className={`text-[10px] truncate mb-0.5 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {staff.email}
                      </p>
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-zinc-400 shrink-0" />
                        <span className={`text-[9px] truncate ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {staff.branch}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Console Messages */}
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#121214] overflow-hidden">
          {selectedRecipient ? (
            <>
              {/* Recipient Header bar */}
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/20 dark:bg-zinc-950/10">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-zinc-200 dark:border-zinc-800">
                    <AvatarFallback className="text-xs font-bold">{selectedRecipient.avatar}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{selectedRecipient.name}</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 stroke-[1.5] text-zinc-400" />
                      {selectedRecipient.branch} • {selectedRecipient.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-500/20 text-[9px] select-none gap-1">
                    <Lock className="w-2.5 h-2.5 text-emerald-500" />
                    Encrypted Link
                  </Badge>
                </div>
              </div>

              {/* Message scroll list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                    <span className="text-xs animate-pulse">Syncing encrypted messages...</span>
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400 dark:text-zinc-500">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-300 border border-zinc-200/50 dark:border-zinc-800 mb-3">
                      <MessageSquare className="w-6 h-6 stroke-[1.2]" />
                    </div>
                    <p className="text-xs font-bold">Secure Staff Handshake</p>
                    <p className="text-[10px] leading-relaxed max-w-[265px] mt-1 text-zinc-500">
                      Send an encrypted payload. Your communications bypass plaintext intermediate databases.
                    </p>
                  </div>
                ) : (
                  activeMessages.map((msgRef) => {
                    const isMe = msgRef.sender_id === currentAuthUser?.$id;
                    const showCipher = showRealCiphertext[msgRef.id];
                    
                    // Decrypt locally on the fly
                    const decryptedText = decryptMessage(
                      msgRef.encrypted_text, 
                      msgRef.sender_id, 
                      msgRef.receiver_id
                    );

                    return (
                      <div
                        key={msgRef.id}
                        className={`flex gap-3 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                      >
                        <Avatar className="h-8 w-8 bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shrink-0 select-none">
                          <AvatarFallback className="text-[10px] font-bold">
                            {isMe ? 'ME' : selectedRecipient.avatar}
                          </AvatarFallback>
                        </Avatar>

                        <div className="space-y-1">
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-xs shadow-sm shadow-black/5 leading-relaxed relative ${
                              isMe
                                ? 'bg-zinc-950 text-white dark:bg-indigo-600 dark:text-zinc-50 rounded-tr-none'
                                : 'bg-zinc-100 text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50 rounded-tl-none border border-zinc-200/30'
                            }`}
                          >
                            {/* Rich cryptographic rendering */}
                            <p className="font-sans whitespace-pre-wrap break-words">
                              {showCipher ? (
                                <span className="font-mono text-[9px] text-amber-500 dark:text-amber-300 select-all tracking-wider block bg-black/40 p-2 rounded">
                                  [CIPHERTEXT]: {msgRef.encrypted_text}
                                </span>
                              ) : (
                                decryptedText
                              )}
                            </p>

                            {/* Verification status label */}
                            <div className="flex items-center gap-1.5 mt-2 justify-end text-[7px] font-bold opacity-60">
                              <Badge variant="outline" className={`text-[7px] py-[1px] leading-none select-none tracking-wider uppercase border-0 ${
                                isMe ? 'bg-zinc-800 text-zinc-300 dark:bg-zinc-800' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}>
                                {showCipher ? 'Encrypted Record' : 'Decrypted E2EE'}
                              </Badge>
                            </div>
                          </div>

                          <div className={`flex items-center gap-2 text-[9px] text-zinc-400 dark:text-zinc-500 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <span>
                              {new Date(msgRef.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={() => toggleCiphertextProof(msgRef.id)}
                              className="hover:underline text-indigo-500 dark:text-indigo-400 select-none cursor-pointer flex items-center gap-0.5 hover:text-indigo-600 font-medium"
                            >
                              {showCipher ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                              {showCipher ? 'Hide cipher' : 'View cipher'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick speed-snips buttons */}
              <div className="px-4 py-2 bg-zinc-50/50 dark:bg-zinc-950/20 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 overflow-x-auto select-none shrink-0 scrollbar-none">
                {QUICK_SNIPPETS.map((snip, index) => (
                  <button
                    key={index}
                    onClick={() => handleSendMessage(undefined, snip)}
                    className="shrink-0 text-[10px] font-bold font-sans px-2.5 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all border border-zinc-200/50 dark:border-zinc-800 hover:border-zinc-300 cursor-pointer text-center"
                  >
                    + {snip}
                  </button>
                ))}
              </div>

              {/* Footer message submission block */}
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Compose encrypted payload to ${selectedRecipient.name}...`}
                    className="text-xs h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-xl"
                  />
                  <Button 
                    type="submit" 
                    disabled={!inputText.trim()}
                    className="h-11 px-5 rounded-xl bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 cursor-pointer font-bold shrink-0 border-0"
                  >
                    <Send className="mr-2 h-4 w-4" /> Send
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400 dark:text-zinc-500">
              <MessageSquare className="w-12 h-12 opacity-30 stroke-[1.2] mb-3" />
              <h4 className="text-sm font-semibold">Select a Workspace User</h4>
              <p className="text-xs text-zinc-500 max-w-[210px] mt-1">
                Choose any active cashier, accountant or administrator to initiate encrypted conversations.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
