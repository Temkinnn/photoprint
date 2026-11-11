import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, ShieldAlert, CheckCircle2, Filter } from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { auditLogs } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredLogs = auditLogs.filter((log) => {
    if (filterStatus === 'all') return true;
    return log.status === filterStatus;
  });

  const deniedCount = auditLogs.filter((l) => l.status === 'ACCESS_DENIED').length;
  const successCount = auditLogs.filter((l) => l.status === 'SUCCESS').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/30">
        <div>
          <div className="text-xs font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Сквозной журнал аудита безопасности (Требования ОТ-04 и AI-06)
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Фиксация пользователя, времени, действий, RBAC-блокировок и акцепта поручений
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Успешных: {successCount}
          </span>
          <span className="flex items-center gap-1.5 text-rose-400 font-medium">
            <ShieldAlert className="w-3.5 h-3.5" />
            Блокировок RBAC: {deniedCount}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900/20">
        <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
        <span className="text-xs text-slate-400 font-medium mr-2">Фильтр:</span>
        {['all', 'SUCCESS', 'ACCESS_DENIED', 'REJECTED'].map((st) => {
          const labels: Record<string, string> = {
            all: 'Все записи',
            SUCCESS: 'Успешные действия',
            ACCESS_DENIED: 'Отказы в доступе (RBAC)',
            REJECTED: 'Отклоненные черновики',
          };
          return (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                filterStatus === st
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {labels[st]}
            </button>
          );
        })}
      </div>

      {/* Audit Log Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[10px] uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Время</th>
                <th className="py-3 px-4">Пользователь / Роль</th>
                <th className="py-3 px-4">Действие</th>
                <th className="py-3 px-4">Целевой объект</th>
                <th className="py-3 px-4">Результат</th>
                <th className="py-3 px-4">Детали операции</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredLogs.map((log) => {
                let statusBadge = (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    SUCCESS
                  </span>
                );

                if (log.status === 'ACCESS_DENIED') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      ACCESS_DENIED
                    </span>
                  );
                } else if (log.status === 'REJECTED') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      REJECTED
                    </span>
                  );
                }

                return (
                  <tr
                    key={log.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      log.status === 'ACCESS_DENIED' ? 'bg-rose-950/10' : ''
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">{log.timestamp}</td>
                    <td className="py-3 px-4 whitespace-nowrap font-sans">
                      <div className="font-semibold text-slate-200">{log.userName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.userRole}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-blue-400 whitespace-nowrap">{log.actionType}</td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap font-sans">{log.targetEntity}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{statusBadge}</td>
                    <td className="py-3 px-4 font-sans text-slate-400 text-xs leading-relaxed max-w-md">
                      {log.details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
