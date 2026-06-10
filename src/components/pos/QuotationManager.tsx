import React from 'react';
import { 
  FileText, 
  Trash2, 
  Play, 
  Clock, 
  X, 
  HelpCircle 
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';

interface QuotationManagerProps {
  isQuoteDialogOpen?: boolean;
  setIsQuoteDialogOpen?: (open: boolean) => void;
  quoteNotes?: string;
  setQuoteNotes?: (notes: string) => void;
  quoteCustomerName?: string;
  setQuoteCustomerName?: (name: string) => void;
  isQuotesListOpen: boolean;
  setIsQuotesListOpen: (open: boolean) => void;
  dbQuotes: any[];
  isLoadingQuotes: boolean;
  fetchQuotations: () => void;
  resumeQuotation: (quote: any) => void;
  deleteQuotation: (id: string, number: string) => void;
  handleCreateQuotation?: () => void;
  cartLength?: number;
}

export const QuotationManager: React.FC<QuotationManagerProps> = ({
  isQuoteDialogOpen,
  setIsQuoteDialogOpen,
  quoteNotes,
  setQuoteNotes,
  quoteCustomerName,
  setQuoteCustomerName,
  isQuotesListOpen,
  setIsQuotesListOpen,
  dbQuotes,
  isLoadingQuotes,
  fetchQuotations,
  resumeQuotation,
  deleteQuotation,
  handleCreateQuotation,
  cartLength
}) => {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      
      {/* Dialogue trigger to view quotation history */}
      <Dialog 
        open={isQuotesListOpen} 
        onOpenChange={(open) => {
          setIsQuotesListOpen(open);
          if (open) {
            fetchQuotations();
          }
        }}
      >
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="rounded-full gap-1 h-8 px-3 border-zinc-200 hover:bg-zinc-50 text-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold select-none cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Load Quotes</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-zinc-90 w text-zinc-900 dark:text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <FileText className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              Active System Proforma Quotes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3">
            {isLoadingQuotes ? (
              <div className="py-12 text-center text-xs text-zinc-400 font-semibold flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-700 animate-spin rounded-full"></div>
                <span>Scanning server records...</span>
              </div>
            ) : dbQuotes.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400 font-medium">
                No active proforma quotations found in database.
              </div>
            ) : (
              <ScrollArea className="h-[300px] border border-zinc-150/60 dark:border-zinc-800 rounded-xl">
                <div className="divide-y divide-zinc-105 dark:divide-zinc-800">
                  {dbQuotes.map((q) => (
                    <div key={q.id} className="p-3.5 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 flex items-center justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-850 dark:text-zinc-200 font-mono">
                            {q.receipt_number || q.receiptNumber || 'Estimate'}
                          </span>
                          <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-505 dark:text-zinc-400 px-2 py-0.5 rounded font-mono">
                            ${(q.total || 0).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-zinc-500 font-medium">
                          Customer: <span className="font-bold text-zinc-750 dark:text-zinc-300">{q.customerName || q.customer_name || 'Valued Customer'}</span>
                        </p>
                        <p className="text-[9.5px] text-zinc-400 font-mono">
                          Saved: {new Date(q.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            resumeQuotation(q);
                            setIsQuotesListOpen(false);
                          }}
                          className="h-8 rounded-lg gap-1 px-2.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 shadow-none cursor-pointer select-none"
                        >
                          <Play className="w-3.5 h-3.5 shrink-0" />
                          <span>Resume</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteQuotation(q.id, q.receipt_number || q.receiptNumber)}
                          className="h-8 w-8 text-neutral-450 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-0 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Button & Dialog to create a quotation */}
      {isQuoteDialogOpen !== undefined && setIsQuoteDialogOpen && (
        <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              disabled={cartLength === 0}
              className="rounded-full gap-1 h-8 px-3 text-xs font-semibold bg-white border-zinc-200 hover:bg-zinc-50 select-none cursor-pointer"
              title="Generate a Proforma Quotation/Estimate"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Create Quote</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-90 w text-zinc-900 dark:text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold flex items-center gap-2">
                <FileText className="w-5 h-5 text-zinc-650" />
                Generate Proforma Quotation
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Customer Recipient Details
                </label>
                <Input
                  type="text"
                  placeholder="Type customer name (blank defaults to active transaction customer)"
                  value={quoteCustomerName}
                  onChange={(e) => setQuoteCustomerName(e.target.value)}
                  className="w-full text-xs font-medium py-4"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Proforma Invoice Terms & Footers
                </label>
                <textarea
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  placeholder="Include custom terms, warranties, dual-currency specifications..."
                  rows={3}
                  className="w-full text-xs bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-inner outline-none focus:ring-2 focus:ring-blue-500/20 text-zinc-800 dark:text-zinc-200 leading-normal"
                />
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-805 text-zinc-600 dark:text-zinc-400 p-3 text-[10.5px] rounded-xl flex items-start gap-2 leading-relaxed">
                <HelpCircle className="w-4 h-4 shrink-0 text-zinc-400 mt-0.5" />
                <span>Quotes will be logged as proforma records. They do not deduct immediate warehouse stocks and can be loaded back into the terminal cart any time.</span>
              </div>
            </div>
            <DialogFooter className="bg-zinc-50 dark:bg-zinc-900 p-4 border-t border-zinc-100 dark:border-zinc-800 -mx-6 -mb-6 mt-4 flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsQuoteDialogOpen(false)}
                className="rounded-xl grow text-xs font-bold select-none cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateQuotation}
                className="bg-zinc-900 hover:bg-zinc-805 dark:bg-zinc-100 dark:hover:bg-zinc-250 text-white dark:text-zinc-950 rounded-xl grow text-xs font-bold select-none cursor-pointer"
              >
                Save Quote Draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
