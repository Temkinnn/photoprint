import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Filter } from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { auditLogs } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredLogs = auditLogs.filter((log) => {
    if (filterStatus === 'all') return true;
    return log.status === filterStatus;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="h-16 px-8 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-900/40">
        <div>
          <h1 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-neutral-300" />
            Журнал аудита действий
          </h1>
          <p className="text-xs text-neutral-400">
            Сквозное логирование операций пользователей, проверок прав и согласований (ОТ-04, AI-06)
          </p>
        </div>

        <div className="text-xs text-neutral-400 font-mono">
          Всего записей: {auditLogs.length}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-6 border-b border-neutral-800/80 flex items-center gap-2 bg-neutral-900/10">
        <Filter className="w-3.5 h-3.5 text-neutral-400 mr-2" />
        {[
          { id: 'all', label: 'Все события' },
          { id: 'SUCCESS', label: 'Успешные' },
          { id: 'ACCESS_DENIED', label: 'Отказы в доступе (RBAC)' },
          { id: 'REJECTED', label: 'Отклоненные' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterStatus(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterStatus === f.id
                ? 'bg-neutral-800 text-white font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="border border-neutral-800 rounded-2xl overflow-hidden bg-neutral-900/40">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-neutral-950/80 text-[11px] font-semibold text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="py-3 px-4">Время</th>
                <th className="py-3 px-4">Пользователь</th>
                <th className="py-3 px-4">Операция</th>
                <th className="py-3 px-4">Целевой объект</th>
                <th className="py-3 px-4">Статус</th>
                <th className="py-3 px-4">Детали</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-800/30 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap text-neutral-400">{log.timestamp}</td>
                  <td className="py-3 px-4 whitespace-nowrap font-sans">
                    <div className="font-semibold text-neutral-200">{log.userName}</div>
                    <div className="text-[10px] text-neutral-400 font-mono">{log.userRole}</div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-neutral-200 whitespace-nowrap">{log.actionType}</td>
                  <td className="py-3 px-4 text-neutral-400 whitespace-nowrap font-sans">{log.targetEntity}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                        log.status === 'SUCCESS'
                          ? 'border-neutral-700 bg-neutral-800 text-neutral-200'
                          : log.status === 'ACCESS_DENIED'
                          ? 'border-amber-700/50 bg-amber-950/30 text-amber-300'
                          : 'border-neutral-700 bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-sans text-neutral-300 text-xs leading-relaxed max-w-md">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
