import React, { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Sparkles, User, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Card } from "./ui/card";
import { appwrite } from "../lib/appwrite";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "ai",
      content:
        "Hello! I am Tareza Assistant. Ask me about your sales trends, inventory forecasts, or how to optimize your profit margins.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [bizStats, setBizStats] = useState<{
    salesToday: number;
    transactionsToday: number;
    lowStockCount: number;
    totalProducts: number;
    branchesCount: number;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const { data: salesList } = await appwrite.from('sales').select('total_amount, created_at');
        const { data: productsList } = await appwrite.from('products').select('*');
        const { data: branchesList } = await appwrite.from('branches').select('*');
        
        let inventoryList: any[] = [];
        try {
          const res = await appwrite.from('inventory').select('*');
          if (res && res.data) inventoryList = res.data;
        } catch (_) {}

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let salesToday = 0;
        let transactionsToday = 0;
        if (salesList) {
          const todaysSales = salesList.filter((s: any) => {
            if (!s.created_at) return false;
            const d = new Date(s.created_at);
            return d >= startOfToday;
          });
          salesToday = todaysSales.reduce((acc: number, s: any) => acc + Number(s.total_amount || 0), 0);
          transactionsToday = todaysSales.length;
        }

        let lowStockCount = 0;
        if (inventoryList.length > 0) {
          lowStockCount = inventoryList.filter((i: any) => Number(i.quantity || 0) <= Number(i.low_stock_threshold || 5)).length;
        }

        setBizStats({
          salesToday,
          transactionsToday,
          lowStockCount,
          totalProducts: productsList?.length || 0,
          branchesCount: branchesList?.length || 0,
        });
      } catch (e) {
        console.error("Failed to load dynamic stats for AI:", e);
      }
    }
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Mock Context data that would normally be fetched from the database
  const getContextString = () => {
    if (bizStats) {
      return `
CURRENT REAL-TIME CONTEXT:
- Today's Total Sales: $${bizStats.salesToday.toFixed(2)}
- Today's Transactions Count: ${bizStats.transactionsToday}
- Total Catalog Products: ${bizStats.totalProducts}
- Critical Low Stock Counter: ${bizStats.lowStockCount} items
- Active Outlets/Branches count: ${bizStats.branchesCount}
- ZWG (Zimbabwe Gold) Reference Rate: 14.5
      `;
    }
    return `
CURRENT CONTEXT:
- Today's Sales: $2,450
- Top Selling Item: Mazoe Orange Crush 2L (45 units sold today)
- Low Stock Alert: Panadol 500mg, White Sugar 2kg
- ZWG Reference Rate: 14.5
    `;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const systemInstruction = `You are Tareza Assistant, an expert business advisor for retail and wholesale businesses in Africa. Keep your answers concise, actionable, and rely heavily on the context provided. Do not use markdown unless formatting lists or bolding key numbers.`;

      const fullPrompt = `${systemInstruction}\n\n${getContextString()}\n\nUser Question: ${userMessage.content}`;

      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt })
      });

      if (!res.ok) {
        throw new Error('Failed to generate insight');
      }
      
      const data = await res.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content:
          data.result || "I could not generate an insight at this time.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("AI Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content:
          "Sorry, I encountered an error. Please try again later or check your API key.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 ${isOpen ? "hidden" : "flex"}`}
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
        }}
      >
        <Sparkles className="h-6 w-6 text-white" />
      </Button>

      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 max-h-[600px] h-[80vh] flex flex-col shadow-2xl border-zinc-200 z-50 overflow-hidden rounded-2xl">
          {/* Header */}
          <div className="bg-zinc-900 text-white p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center space-x-2">
              <div className="bg-white/10 p-1.5 rounded-lg">
                <Sparkles className="h-4 w-4 text-purple-300" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">
                  Tareza Assistant
                </h3>
                <p className="text-xs text-zinc-400">Powered by Gemini AI</p>
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

          {/* Chat Area */}
          <ScrollArea className="flex-1 p-4 bg-zinc-50" ref={scrollRef}>
            <div className="space-y-4 pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex max-w-[85%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"} items-end gap-2`}
                  >
                    <div
                      className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${message.role === "user" ? "bg-zinc-200" : "bg-indigo-100 text-indigo-600"}`}
                    >
                      {message.role === "user" ? (
                        <User className="h-4 w-4 text-zinc-600" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                        message.role === "user"
                          ? "bg-zinc-900 text-white rounded-br-sm"
                          : "bg-white border shadow-sm text-zinc-800 rounded-bl-sm"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-end gap-2">
                    <div className="shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="px-4 py-3 bg-white border shadow-sm rounded-2xl rounded-bl-sm flex space-x-1">
                      <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 bg-white border-t shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex space-x-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your business..."
                className="flex-1 bg-zinc-50 border-zinc-200 focus-visible:ring-indigo-500 rounded-xl"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 rounded-xl transition-transform active:scale-95"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </Card>
      )}
    </>
  );
}
