import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import {
  ShieldAlert,
  Search,
  Clock,
  User,
  FileText,
  Calendar,
  Layers,
  CheckSquare,
} from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { auditLogs } = useApp();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const accessDeniedCount = useMemo(
    () => auditLogs.filter((l) => l.status === 'ACCESS_DENIED').length,
    [auditLogs]
  );
  const successCount = useMemo(
    () => auditLogs.filter((l) => l.status === 'SUCCESS').length,
    [auditLogs]
  );
  const rejectedCount = useMemo(
    () => auditLogs.filter((l) => l.status === 'REJECTED').length,
    [auditLogs]
  );

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (filterStatus !== 'all' && log.status !== filterStatus) return false;
      if (filterRole !== 'all' && log.userRole !== filterRole) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          log.actionType.toLowerCase().includes(query) ||
          log.userName.toLowerCase().includes(query) ||
          log.targetEntity.toLowerCase().includes(query) ||
          log.details.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [auditLogs, filterStatus, filterRole, searchQuery]);

  const getStatusMeta = (status: string) => {
    switch (status) {
      case 'ACCESS_DENIED':
        return {
          label: 'ОТКАЗ В ДОСТУПЕ',
          pillClass: 'bg-[#D71921]/15 text-[#D71921]',
          dotClass: 'bg-[#D71921]',
        };
      case 'REJECTED':
        return {
          label: 'ОТКЛОНЕНО',
          pillClass: 'bg-amber-500/15 text-amber-500',
          dotClass: 'bg-amber-500',
        };
      case 'SUCCESS':
      default:
        return {
          label: 'УСПЕШНО',
          pillClass: 'bg-emerald-500/15 text-emerald-500',
          dotClass: 'bg-emerald-500',
        };
    }
  };

  const getActionCategory = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('SECURITY') || act.includes('ACCESS_DENIED') || act.includes('BLOCKED')) {
      return { label: 'RBAC / Безопасность', icon: <ShieldAlert className="w-3 h-3 text-[#D71921]" /> };
    }
    if (act.includes('TASK') || act.includes('APPROVE')) {
      return { label: 'Поручения цеха', icon: <CheckSquare className="w-3 h-3 text-sky-500" /> };
    }
    if (act.includes('MEETING')) {
      return { label: 'Совещания', icon: <Calendar className="w-3 h-3 text-indigo-400" /> };
    }
    if (act.includes('RAG') || act.includes('DOCUMENT')) {
      return { label: 'Регламенты', icon: <FileText className="w-3 h-3 text-emerald-500" /> };
    }
    if (act.includes('LOGIN') || act.includes('ROLE')) {
      return { label: 'Аутентификация', icon: <User className="w-3 h-3 text-[var(--text-muted)]" /> };
    }
    return { label: 'Система', icon: <Layers className="w-3 h-3 text-[var(--text-muted)]" /> };
  };

  const getRoleTitle = (role: UserRole) => {
    switch (role) {
      case 'ROLE_DIRECTOR':
        return 'Генеральный директор';
      case 'ROLE_PRODUCTION_HEAD':
        return 'Начальник производства';
      case 'ROLE_SUPPORT_HEAD':
        return 'Клиентский сервис';
      default:
        return role;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden transition-colors">
      {/* Header */}
      <div className="h-16 px-6 border-b border-[var(--border-solid)] bg-[var(--bg-card)] flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-dot text-base uppercase tracking-wider text-[var(--text-primary)]">
            ЖУРНАЛ АУДИТА ДЕЙСТВИЙ
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Неизменяемый реестр операций, разграничение прав (RBAC) и контроль доступа
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {accessDeniedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D71921]/15 text-[11px] font-mono font-semibold text-[#D71921]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D71921]" />
              {accessDeniedCount} НАРУШЕНИЙ ДОПУСКА
            </span>
          )}
          <span className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-3 py-1 rounded-full">
            ЗАПИСЕЙ: {auditLogs.length}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3.5 border-b border-dashed border-[var(--border-dashed)] bg-[var(--bg-card)] shrink-0">
        <div className="max-w-5xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
          {/* Segmented Control */}
          <div className="inline-flex items-center p-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] gap-1">
            {[
              { id: 'all', label: 'Все события', count: auditLogs.length },
              {
                id: 'ACCESS_DENIED',
                label: 'Отказы в доступе',
                count: accessDeniedCount,
                alert: accessDeniedCount > 0,
              },
              { id: 'SUCCESS', label: 'Успешные', count: successCount },
              { id: 'REJECTED', label: 'Отклоненные', count: rejectedCount },
            ].map((tab) => {
              const isActive = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono text-[10px] px-1.5 rounded-full ${
                      tab.alert
                        ? 'bg-[#D71921] text-white'
                        : isActive
                        ? 'bg-[var(--bg-canvas)]/20 text-current'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Role Select & Search */}
          <div className="flex items-center gap-2.5">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-[var(--bg-elevated)] border border-[var(--border-solid)] text-[var(--text-primary)] text-xs rounded-full px-3.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">Все роли</option>
              <option value="ROLE_DIRECTOR">Генеральный директор</option>
              <option value="ROLE_PRODUCTION_HEAD">Начальник производства</option>
              <option value="ROLE_SUPPORT_HEAD">Клиентский сервис</option>
            </select>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по событиям и деталям..."
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-full pl-9 pr-4 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Audit Stream */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-5xl mx-auto w-full space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="nothing-card-dashed p-12 text-center max-w-xl mx-auto space-y-3">
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                Записей аудита не найдено
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                По заданным критериям фильтрации события отсутствуют.
              </p>
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterRole('all');
                  setSearchQuery('');
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] rounded-full transition-all"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const statusMeta = getStatusMeta(log.status);
              const category = getActionCategory(log.actionType);

              return (
                <div key={log.id} className="nothing-card p-4 space-y-3">
                  {/* Top Row */}
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Flat Non-Clickable Status Pill */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${statusMeta.pillClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                        <span>{statusMeta.label}</span>
                      </span>

                      <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)] bg-[var(--bg-elevated)] px-2.5 py-0.5 rounded-full">
                        {log.actionType}
                      </span>

                      <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1 font-medium">
                        {category.icon}
                        <span>{category.label}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] font-mono shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{log.timestamp}</span>
                    </div>
                  </div>

                  {/* Object & Details */}
                  <div className="space-y-2">
                    <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                      <span>Объект:</span>
                      <span className="font-semibold text-[var(--text-primary)] font-mono bg-[var(--bg-elevated)] px-2.5 py-0.5 rounded-full text-[11px]">
                        {log.targetEntity}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--bg-elevated)] p-3 rounded-2xl">
                      {log.details}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-2 border-t border-dashed border-[var(--border-dashed)]">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-primary)] font-semibold">
                        {log.userName}
                      </span>
                      <span>—</span>
                      <span>{getRoleTitle(log.userRole)}</span>
                      <span className="font-mono text-[10px]">({log.userRole})</span>
                    </div>

                    <span className="font-mono text-[10px]">ID: {log.id}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
