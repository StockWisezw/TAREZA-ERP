import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { FileText, Printer, Check, RotateCcw, Download, Receipt, Search, Clock } from 'lucide-react';
import { RegisterSession, CashLog, Profile } from '../../hooks/useCashManagement';
import { RegisterAuditPrint } from './RegisterAuditPrint';
import { exportZReportPDF } from '../../utils/exportZReportPDF';
import { supabase } from '../../lib/firebaseClient';
import { db as dexieDb } from '../../lib/dexieDb';
import { ThermalReceiptModal } from '../pos/ThermalReceiptModal';

interface SessionAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: RegisterSession | null;
  auditLogs: CashLog[];
  profilesMap: Record<string, Profile>;
  businessName?: string;
  branchName?: string;
}

export function SessionAuditModal({
  open,
  onOpenChange,
  session,
  auditLogs,
  profilesMap,
  businessName = 'Tareza ERP Enterprise',
  branchName = 'Main Store Branch'
}: SessionAuditModalProps) {
  const [activeTab, setActiveTab] = useState<'audit' | 'sales'>('audit');
  const [sessionSales, setSessionSales] = useState<any[]>([]);
  const [searchSaleQuery, setSearchSaleQuery] = useState('');
  const [selectedSaleForThermal, setSelectedSaleForThermal] = useState<any | null>(null);

  useEffect(() => {
    if (!open || !session) return;

    async function loadSessionSales() {
      try {
        let loaded: any[] = [];
        // 1. Try remote sales
        if (session && session.opened_at) {
          const { data: dbSales } = await supabase
            .from('sales')
            .select('*')
            .gte('created_at', session.opened_at)
            .lte('created_at', session.closed_at || new Date().toISOString())
            .order('created_at', { ascending: false });

          if (dbSales) loaded = [...dbSales];
        }

        // 2. Merge local Dexie sales
        try {
          const localList = await dexieDb.sales.toArray();
          localList.forEach((ls: any) => {
            const time = ls.timestamp || ls.created_at;
            if (time && session?.opened_at && time >= session.opened_at) {
              if (!session.closed_at || time <= session.closed_at) {
                const exists = loaded.some(s => (s.receiptNumber && s.receiptNumber === ls.receiptNumber) || s.id === ls.id);
                if (!exists) {
                  loaded.push(ls);
                }
              }
            }
          });
        } catch (e) {}

        loaded.sort((a, b) => new Date(b.created_at || b.timestamp || 0).getTime() - new Date(a.created_at || a.timestamp || 0).getTime());
        setSessionSales(loaded);
      } catch (err) {
        console.warn('Could not load session sales:', err);
      }
    }

    loadSessionSales();
  }, [open, session?.id, session?.opened_at, session?.closed_at]);
  if (!session) return null;

  const operatorName = profilesMap[session.user_id]?.full_name || 'System Operator';

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    exportZReportPDF({
      session,
      auditLogs,
      businessName,
      branchName,
      operatorName,
      supervisorName: 'Store Supervisor'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6">
        <DialogHeader className="pb-2 border-b border-zinc-150 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              Register Session Audit & Sales History
            </DialogTitle>
            <Badge variant="outline" className="text-xs font-mono">
              {session.status}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-zinc-500">
            Opened at {new Date(session.opened_at).toLocaleString()} by {operatorName}
          </DialogDescription>

          {/* Navigation Tab Switcher */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl gap-1 text-xs font-bold mt-2">
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Profitability & Cash Reconciliation</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'sales'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Sales in This Session ({sessionSales.length})</span>
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto pr-1">
          {activeTab === 'audit' ? (
            <>
              {/* Shift Operational Profitability Grid */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold block">
                  Shift Profitability (Perpetual Method)
                </span>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-semibold">Gross Sales</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">${Number(session.sales_total || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-semibold">Perpetual COGS</span>
                    <span className="font-bold text-rose-600">-${Number(session.cogs_total || session.cogs || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-semibold">Gross Profit</span>
                    <span className="font-bold text-emerald-600">
                      ${(Number(session.sales_total || 0) - Number(session.cogs_total || session.cogs || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-semibold">Net Profit</span>
                    <span className="font-bold text-blue-600">
                      ${(
                        (Number(session.sales_total || 0) - Number(session.cogs_total || session.cogs || 0)) -
                        auditLogs
                          .filter(l => ['expense', 'payout', 'restock'].includes(String(l.transaction_type || '').toLowerCase()) && String(l.transaction_type) !== 'owner_collection')
                          .reduce((sum, l) => sum + Number(l.amount || 0), 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cash Reconciliation Grid */}
              <div className="grid grid-cols-3 gap-2 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">Opening Float</span>
                  <span className="text-sm font-black text-zinc-800 dark:text-zinc-200">${Number(session.opening_balance || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">Closing Count</span>
                  <span className="text-sm font-black text-emerald-600">${Number(session.closing_balance || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">Variance</span>
                  <span className={`text-sm font-black ${Number(session.variance || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ${Number(session.variance || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Audit Logs Table */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Shift Movement Trail</h4>
                <div className="max-h-[160px] overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
                  {auditLogs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-400">No cash logs recorded during this session</div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="p-2.5 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 capitalize">{log.transaction_type.replace('_', ' ')}</span>
                          <p className="text-[10px] text-zinc-400">{log.notes || 'No notes'}</p>
                        </div>
                        <span className={`font-bold ${log.type === 'inflow' || log.type === 'opening' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ${Number(log.amount).toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Shift Sales Tab */
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Filter sales in this session..."
                  value={searchSaleQuery}
                  onChange={(e) => setSearchSaleQuery(e.target.value)}
                  className="h-8 text-xs pl-8 bg-zinc-50 dark:bg-zinc-800/50"
                />
              </div>

              {sessionSales.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold">No sales found for this shift period.</p>
                </div>
              ) : (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-150 dark:divide-zinc-800 max-h-[300px] overflow-y-auto">
                  {sessionSales
                    .filter(s => {
                      if (!searchSaleQuery) return true;
                      const q = searchSaleQuery.toLowerCase();
                      const rcpt = String(s.receiptNumber || s.receipt_number || '').toLowerCase();
                      const cust = String(s.customerName || s.customer_name || '').toLowerCase();
                      return rcpt.includes(q) || cust.includes(q);
                    })
                    .map((saleItem, idx) => {
                      const rcpt = saleItem.receiptNumber || saleItem.receipt_number || `#${idx + 1}`;
                      const saleTotal = Number(saleItem.total || saleItem.total_amount || 0);
                      const timeStr = saleItem.timestamp || saleItem.created_at ? new Date(saleItem.timestamp || saleItem.created_at).toLocaleTimeString() : 'Just now';
                      const method = String(saleItem.payment_method || (saleItem.payments?.[0]?.method) || 'CASH').replace('_', ' ').toUpperCase();
                      const itemCount = Array.isArray(saleItem.items) ? saleItem.items.length : 1;

                      return (
                        <div key={saleItem.id || idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-zinc-900 dark:text-zinc-100">{rcpt}</span>
                              <span className="text-[10px] text-zinc-400">{timeStr}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500">
                              {itemCount} item{itemCount !== 1 ? 's' : ''} • {method}
                              {saleItem.customerName && ` • ${saleItem.customerName}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                              ${saleTotal.toFixed(2)}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedSaleForThermal(saleItem)}
                              className="h-7 px-2 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                              title="Print Thermal ESC/POS Receipt"
                            >
                              <Printer className="w-3 h-3 mr-1" />
                              ESC/POS
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 flex flex-row items-center justify-between gap-2 border-t border-zinc-150 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className="text-xs font-bold rounded-xl gap-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={handlePrint}
              className="text-xs font-bold rounded-xl gap-1.5 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold rounded-xl cursor-pointer"
          >
            Close Audit
          </Button>
        </DialogFooter>

        {/* Hidden Printable Document Container */}
        <RegisterAuditPrint
          session={session}
          auditLogs={auditLogs}
          operatorName={operatorName}
        />

        {/* Thermal ESC/POS Receipt Modal */}
        <ThermalReceiptModal
          open={!!selectedSaleForThermal}
          onOpenChange={(op) => !op && setSelectedSaleForThermal(null)}
          sale={selectedSaleForThermal}
          businessName={businessName}
          branchName={branchName}
        />
      </DialogContent>
    </Dialog>
  );
}
