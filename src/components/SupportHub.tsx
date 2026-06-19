import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Compass, Info, X, Sparkles, HelpCircle, EyeOff, Check } from 'lucide-react';
import { Button } from './ui/button';

export function SupportHub() {
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('tareza_support_hub_minimized') === 'true';
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Save state to avoid flashing on reload
  const toggleMinimized = () => {
    const nextVal = !isMinimized;
    setIsMinimized(nextVal);
    localStorage.setItem('tareza_support_hub_minimized', String(nextVal));
    if (nextVal) {
      setIsMenuOpen(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isMinimized ? (
          // Tiny, barely-there indicator dot at the very bottom-right
          <motion.button
            key="minimized-support"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.35, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ opacity: 1, scale: 1.05 }}
            onClick={toggleMinimized}
            className="fixed bottom-3 right-3 h-8 w-8 rounded-full bg-zinc-900 border border-zinc-700 text-white flex items-center justify-center cursor-pointer shadow-md z-[45] transition-all"
            title="Expand Support & Tours Panel"
            id="expand-support-hub-btn"
          >
            <HelpCircle className="h-4 w-4" />
          </motion.button>
        ) : (
          // Styled Compact Support Hub widget at the bottom right
          <div className="fixed bottom-6 right-6 z-[45] flex flex-col items-end gap-2" id="support-hub-container">
            {/* Popover Menu Options */}
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2.5 shadow-2xl flex flex-col gap-1.5 w-52 text-zinc-800 dark:text-zinc-100"
                >
                  <div className="flex items-center justify-between px-1.5 pb-1.5 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-400">Support Hub</span>
                    <button 
                      onClick={() => setIsMenuOpen(false)} 
                      className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-250 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {/* AI Assistant option */}
                  <button
                    onClick={() => {
                      window.dispatchEvent(new Event('toggle-ai-assistant'));
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full hover:bg-zinc-50 dark:hover:bg-zinc-805/50 p-2 rounded-xl transition-all text-left cursor-pointer group"
                  >
                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold leading-normal">AI Diagnostics Chat</span>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-none mt-0.5">Instant ledger & POS help</span>
                    </div>
                  </button>

                  {/* Interactive Tours Option */}
                  <button
                    onClick={() => {
                      window.dispatchEvent(new Event('toggle-help-desk'));
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full hover:bg-zinc-50 dark:hover:bg-zinc-805/50 p-2 rounded-xl transition-all text-left cursor-pointer group"
                  >
                    <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-emerald-600 dark:text-emerald-400 group-hover:rotate-45 transition-transform">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold leading-normal">Interactive Tours</span>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-none mt-0.5">Dynamic module training</span>
                    </div>
                  </button>

                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1 mt-1">
                    {/* Minimize / Dock option */}
                    <button
                      onClick={toggleMinimized}
                      className="flex items-center gap-1.5 justify-center w-full hover:bg-zinc-50 dark:hover:bg-zinc-850 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300 transition-all text-[10px] font-bold cursor-pointer"
                      title="Hide these floating buttons to stop distractions"
                    >
                      <EyeOff className="w-3 h-3" />
                      Minimize & Hide Widget
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hub Trigger Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="h-11 px-3.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-xl flex items-center gap-2 cursor-pointer transition-all hover:scale-105 border border-zinc-200 dark:border-zinc-800 font-sans"
              title="Help, Support & Training Tours"
              id="unified-support-hub-btn"
            >
              <HelpCircle className="h-4.5 w-4.5 text-indigo-400 dark:text-indigo-600" />
              <span className="text-[11px] font-extrabold tracking-tight">Support Hub</span>
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
