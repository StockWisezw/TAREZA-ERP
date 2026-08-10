import React, { useState } from 'react';
import { RegisterSession, Profile } from '../../hooks/useCashManagement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { History, RefreshCw, Eye, Calendar, Printer } from 'lucide-react';

interface PastShiftsHistoryProps {
  pastSessions: RegisterSession[];
  historyLoading: boolean;
  onRefresh: () => void;
  onViewAudit: (session: RegisterSession) => void;
  profilesMap: Record<string, Profile>;
}

export function PastShiftsHistory({
  pastSessions,
  historyLoading,
  onRefresh,
  onViewAudit,
  profilesMap
}: PastShiftsHistoryProps) {
  const [filterText, setFilterText] = useState('');

  const filtered = pastSessions.filter(s => {
    if (!filterText) return true;
    const term = filterText.toLowerCase();
    const operator = profilesMap[s.user_id]?.full_name || '';
    return operator.toLowerCase().includes(term) || s.status.toLowerCase().includes(term);
  });

  return (
    <Card className="border border-zinc-200 dark:border-zinc-800 shadow-xs rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500" />
            Historical Register Shifts & Reconciliations
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500">
            Review previous cash drawer openings, counted cash balances, variances, and operator audit records.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={historyLoading}
          className="text-xs font-semibold gap-1.5 rounded-xl cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
          Refresh History
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search by operator name or status..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="h-9 text-xs max-w-xs rounded-xl"
          />
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="p-3">Opened Time</th>
                <th className="p-3">Closed Time</th>
                <th className="p-3">Cashier / Operator</th>
                <th className="p-3 text-right">Opening Float</th>
                <th className="p-3 text-right">Closing Count</th>
                <th className="p-3 text-right">Variance</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-zinc-400">
                    {historyLoading ? 'Loading session history...' : 'No historical register sessions found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const operator = profilesMap[s.user_id]?.full_name || 'System Cashier';
                  const variance = Number(s.variance || 0);

                  return (
                    <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="p-3 font-medium text-zinc-800 dark:text-zinc-200">
                        {new Date(s.opened_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-zinc-500">
                        {s.closed_at ? new Date(s.closed_at).toLocaleString() : '—'}
                      </td>
                      <td className="p-3 font-semibold text-zinc-700 dark:text-zinc-300">
                        {operator}
                      </td>
                      <td className="p-3 text-right font-mono font-medium text-zinc-700 dark:text-zinc-300">
                        ${Number(s.opening_balance || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {s.closing_balance !== undefined ? `$${Number(s.closing_balance).toFixed(2)}` : '—'}
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${variance < 0 ? 'text-rose-600' : variance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {s.closed_at ? `$${variance.toFixed(2)}` : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={s.status === 'OPEN' ? 'default' : 'secondary'}
                          className={`text-[10px] font-bold ${s.status === 'OPEN' ? 'bg-emerald-500 text-white' : ''}`}
                        >
                          {s.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onViewAudit(s)}
                            className="h-7 text-xs font-semibold gap-1 text-blue-600 hover:text-blue-700 cursor-pointer rounded-lg"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Audit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onViewAudit(s);
                              setTimeout(() => window.print(), 300);
                            }}
                            className="h-7 text-xs font-bold gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer rounded-lg"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Print
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
