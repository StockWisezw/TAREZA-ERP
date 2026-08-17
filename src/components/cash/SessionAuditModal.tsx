import React from 'react';
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
import { FileText, Printer, Check, RotateCcw, Download } from 'lucide-react';
import { RegisterSession, CashLog, Profile } from '../../hooks/useCashManagement';
import { RegisterAuditPrint } from './RegisterAuditPrint';
import { exportZReportPDF } from '../../utils/exportZReportPDF';

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
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-zinc-900 dark:text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Register Session Audit Detail
            </span>
            <Badge variant="outline" className="text-xs font-mono">
              {session.status}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            Opened at {new Date(session.opened_at).toLocaleString()} by {operatorName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Summary Grid */}
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
            <div className="max-h-[180px] overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
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
        </div>

        <DialogFooter className="pt-2 flex flex-row items-center justify-between gap-2">
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
      </DialogContent>
    </Dialog>
  );
}
