import React from 'react';
import { RegisterSession, CashLog } from '../../hooks/useCashManagement';

interface RegisterAuditPrintProps {
  session: RegisterSession | any;
  auditLogs?: CashLog[] | any[];
  businessName?: string;
  branchName?: string;
  operatorName?: string;
  supervisorName?: string;
}

export const RegisterAuditPrint: React.FC<RegisterAuditPrintProps> = ({
  session,
  auditLogs = [],
  businessName = 'Tareza ERP Workspace',
  branchName = 'Main Store Branch',
  operatorName = 'System Operator',
  supervisorName = 'Branch Supervisor'
}) => {
  if (!session) return null;

  const openingFloat = Number(session.opening_balance || 0);
  const closingBalance = Number(session.closing_balance || 0);
  const expectedBalance = Number(session.expected_balance || 0);
  const variance = Number(session.variance || 0);
  const salesTotal = Number(session.sales_total || 0);
  const salesCount = Number(session.sales_count || 0);
  const payoutsTotal = Number(session.payouts_total || 0);

  const referenceCode = session.id 
    ? (session.id.startsWith('off-shift-') ? `SHIFT-OFFLINE-${session.id.slice(-6)}` : `Z-AUDIT-${session.id.slice(0, 8).toUpperCase()}`)
    : 'Z-AUDIT-LOCAL';

  return (
    <div className="hidden print:block text-black font-sans bg-white p-6 max-w-3xl mx-auto print:max-w-none print:w-full">
      {/* Header */}
      <div className="border-b-2 border-black pb-4 mb-4 text-center">
        <h1 className="text-xl font-black uppercase tracking-wider">{businessName}</h1>
        <p className="text-xs font-bold uppercase text-zinc-700">{branchName}</p>
        <div className="mt-2 py-1 px-3 bg-zinc-100 inline-block rounded font-mono font-bold text-sm border border-zinc-300">
          CLOSED REGISTER AUDIT REPORT (Z-REPORT)
        </div>
        <p className="text-xs font-mono mt-1 font-bold">Ref No: {referenceCode}</p>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-4 text-xs mb-4 border-b pb-4 border-zinc-300">
        <div>
          <p><strong className="uppercase text-zinc-600">Cashier / Operator:</strong> {operatorName}</p>
          <p><strong className="uppercase text-zinc-600">Supervisor / Auditor:</strong> {supervisorName}</p>
          <p><strong className="uppercase text-zinc-600">Shift Status:</strong> {session.status}</p>
        </div>
        <div className="text-right">
          <p><strong className="uppercase text-zinc-600">Opened At:</strong> {session.opened_at ? new Date(session.opened_at).toLocaleString() : 'N/A'}</p>
          <p><strong className="uppercase text-zinc-600">Closed At:</strong> {session.closed_at ? new Date(session.closed_at).toLocaleString() : 'Active / Unclosed'}</p>
          <p><strong className="uppercase text-zinc-600">Printed Date:</strong> {new Date().toLocaleString()}</p>
        </div>
      </div>

      {/* Reconciliations Summary Table */}
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-2 border-b border-black pb-1">Shift Cash Reconciliation Financial Summary</h3>
        <table className="w-full text-xs text-left border-collapse border border-zinc-300">
          <tbody>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <td className="p-2 font-semibold">Opening Cash Float</td>
              <td className="p-2 text-right font-mono font-bold">${openingFloat.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-zinc-200">
              <td className="p-2 font-semibold">Total Gross Cash Sales ({salesCount} transactions)</td>
              <td className="p-2 text-right font-mono font-bold text-emerald-800">+${salesTotal.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-zinc-200">
              <td className="p-2 font-semibold">Total Till Payouts / Micro-Expenses</td>
              <td className="p-2 text-right font-mono font-bold text-rose-800">-${payoutsTotal.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-zinc-300 bg-zinc-100 font-bold">
              <td className="p-2">Expected Drawer Balance</td>
              <td className="p-2 text-right font-mono text-sm">${expectedBalance.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-zinc-300 font-bold">
              <td className="p-2">Actual Counted Cash at Closure</td>
              <td className="p-2 text-right font-mono text-sm">${closingBalance.toFixed(2)}</td>
            </tr>
            <tr className={`font-black ${variance < 0 ? 'bg-red-50 text-red-900' : variance > 0 ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
              <td className="p-2">COMPLIANCE AUDIT VARIANCE</td>
              <td className="p-2 text-right font-mono text-base">
                {variance < 0 ? `-$${Math.abs(variance).toFixed(2)} (SHORTAGE)` : variance > 0 ? `+$${variance.toFixed(2)} (OVERAGE)` : '$0.00 (BALANCED)'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Audit Log / Movement Trail */}
      {auditLogs && auditLogs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-2 border-b border-black pb-1">Till Cash Movement Audit Trail</h3>
          <table className="w-full text-[11px] text-left border-collapse border border-zinc-300">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-300 font-bold">
                <th className="p-1.5">Timestamp</th>
                <th className="p-1.5">Event / Type</th>
                <th className="p-1.5">Audit Notes / Reason</th>
                <th className="p-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {auditLogs.map((log: any) => (
                <tr key={log.id || Math.random().toString()}>
                  <td className="p-1.5 font-mono">{new Date(log.created_at).toLocaleTimeString()}</td>
                  <td className="p-1.5 font-semibold capitalize">{log.transaction_type?.replace('_', ' ')}</td>
                  <td className="p-1.5 text-zinc-700">{log.notes || '—'}</td>
                  <td className={`p-1.5 text-right font-mono font-bold ${log.type === 'inflow' || log.type === 'opening' || log.type === 'cash_in' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    ${Number(log.amount || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Signatures & Compliance Verification */}
      <div className="mt-12 pt-6 border-t border-black grid grid-cols-2 gap-8 text-xs">
        <div>
          <div className="border-b border-dashed border-black h-8 mb-1"></div>
          <p className="font-bold uppercase">Cashier / Register Operator Signature</p>
          <p className="text-[10px] text-zinc-500">I certify that the counted cash and till logs are accurate.</p>
        </div>
        <div>
          <div className="border-b border-dashed border-black h-8 mb-1"></div>
          <p className="font-bold uppercase">Supervisor / Manager Auditor Signature</p>
          <p className="text-[10px] text-zinc-500">Verified and audited for store compliance & ledger entry.</p>
        </div>
      </div>

      <div className="mt-8 text-center text-[10px] text-zinc-500 border-t border-dashed border-zinc-300 pt-2">
        <p>Official Closed Register Z-Report Document • Tareza ERP Enterprise Audit System</p>
      </div>
    </div>
  );
};
