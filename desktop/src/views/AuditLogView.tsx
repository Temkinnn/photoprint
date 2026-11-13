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
  const { auditLogs, resetDemoData } = useApp();

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
          label: 'Отказ в доступе',
          pillClass: 'bg-[#D71921]/15 text-[#D71921]',
          dotClass: 'bg-[#D71921]',
        };
      case 'REJECTED':
        return {
          label: 'Отклонено',
          pillClass: 'bg-amber-500/15 text-amber-500',
          dotClass: 'bg-amber-500',
        };
      case 'SUCCESS':
      default:
        return {
          label: 'Успешно',
          pillClass: 'bg-emerald-500/15 text-emerald-500',
          dotClass: 'bg-emerald-500',
        };
    }
  };

  const getActionCategory = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('SECURITY') || act.includes('ACCESS_DENIED') || act.includes('BLOCKED')) {
      return {
        label: 'Безопасность',
        icon: <ShieldAlert className="w-4 h-4 text-[#D71921]" />,
      };
    }
    if (act.includes('TASK') || act.includes('APPROVE')) {
      return { label: 'Поручения', icon: <CheckSquare className="w-4 h-4 text-sky-500" /> };
    }
    if (act.includes('MEETING') || act.includes('PROACTIVE')) {
      return {
        label: 'Совещания',
        icon: <Calendar className="w-4 h-4 text-indigo-400" />,
      };
    }
    if (act.includes('RAG') || act.includes('DOCUMENT') || act.includes('ANOMALY')) {
      return {
        label: 'Регламенты',
        icon: <FileText className="w-4 h-4 text-emerald-500" />,
      };
    }
    if (act.includes('LOGIN') || act.includes('ROLE')) {
      return { label: 'Вход в систему', icon: <User className="w-4 h-4 text-[var(--text-muted)]" /> };
    }
    return { label: 'Система', icon: <Layers className="w-4 h-4 text-[var(--text-muted)]" /> };
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
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-[var(--border-solid)] bg-[var(--bg-card)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#D71921]">
            04 // Прозрачность и контроль ИИ
          </div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] mt-0.5">
            Журнал аудита действий
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Реестр операций, разграничение прав и контроль доступа
          </p>
        </div>

        <div className="flex items-center gap-3">
          {accessDeniedCount > 0 && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#D71921]/15 text-xs font-mono font-bold text-[#D71921]">
              <span className="w-2 h-2 rounded-full bg-[#D71921]" />
              {accessDeniedCount} отказов доступа
            </span>
          )}
          <span className="text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-solid)] px-3 py-1.5 rounded-lg">
            Записей: {auditLogs.length}
          </span>
        </div>
      </div>

      {/* Security Contour & Storage Control Strip (Slide 07 & TЗ 7.4) */}
      <div className="px-6 py-3.5 border-b border-[var(--border-solid)] bg-[var(--bg-elevated)]/70 shrink-0">
        <div className="max-w-5xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[#D71921] font-bold uppercase tracking-wider">
              07 // Контур ИБ:
            </span>
            {[
              'SEC-01 Локальный контур',
              'SEC-02 RBAC',
              'SEC-03 Фильтрация PII',
              'SEC-04 Anti-Injection',
              'SEC-05 Подтверждение действий',
            ].map((badge) => (
              <span
                key={badge}
                className="px-2.5 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-solid)] text-xs font-semibold text-[var(--text-primary)]"
              >
                {badge}
              </span>
            ))}
          </div>

          <button
            onClick={() => {
              if (
                window.confirm(
                  'Удалить тестовые логи, временные аудиозаписи и черновики (SEC-06)?'
                )
              ) {
                resetDemoData();
              }
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--bg-card)] border border-[var(--border-solid)] hover:border-[#D71921] hover:text-[#D71921] text-[var(--text-primary)] transition-colors"
          >
            SEC-06 · Удалить тестовые данные
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="px-6 py-3.5 border-b border-[var(--border-solid)] bg-[var(--bg-card)] shrink-0">
        <div className="max-w-5xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-solid)] gap-1">
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
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                    isActive
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] font-bold shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono text-xs px-1.5 py-0.5 rounded font-bold ${
                      tab.alert ? 'bg-[#D71921] text-white' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-[var(--bg-elevated)] border border-[var(--border-solid)] text-[var(--text-primary)] text-xs font-medium rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
            >
              <option value="all">Все роли</option>
              <option value="ROLE_DIRECTOR">Генеральный директор</option>
              <option value="ROLE_PRODUCTION_HEAD">Начальник производства</option>
              <option value="ROLE_SUPPORT_HEAD">Клиентский сервис</option>
            </select>

            <div className="relative w-64">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по событиям..."
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Stream */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-5xl mx-auto w-full space-y-3.5">
          {filteredLogs.length === 0 ? (
            <div className="nothing-card-dashed p-12 text-center max-w-xl mx-auto space-y-3">
              <div className="text-base font-bold text-[var(--text-primary)]">
                Записей аудита не найдено
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                По заданным критериям фильтрации события отсутствуют
              </p>
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterRole('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-bold bg-[var(--text-primary)] text-[var(--bg-canvas)] rounded-xl"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const statusMeta = getStatusMeta(log.status);
              const category = getActionCategory(log.actionType);
              const isDenied = log.status === 'ACCESS_DENIED';

              return (
                <div
                  key={log.id}
                  className={`nothing-card p-5 space-y-3 ${
                    isDenied ? 'border-l-4 border-l-[#D71921]' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${statusMeta.pillClass}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
                        <span>{statusMeta.label}</span>
                      </span>

                      <span className="font-mono text-xs font-bold text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-solid)] px-2.5 py-1 rounded-md">
                        {log.actionType}
                      </span>

                      <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                        {category.icon}
                        <span>{category.label}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{log.timestamp} (UTC+3)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                      <span>Объект:</span>
                      <span className="font-bold text-[var(--text-primary)] font-mono bg-[var(--bg-elevated)] px-2.5 py-0.5 rounded text-xs">
                        {log.targetEntity}
                      </span>
                    </div>

                    <p className="text-sm text-[var(--text-primary)] leading-relaxed bg-[var(--bg-elevated)] p-3.5 rounded-xl border border-[var(--border-solid)]">
                      {log.details}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2.5 border-t border-[var(--border-solid)]">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-primary)] font-bold">
                        {log.userName}
                      </span>
                      <span>—</span>
                      <span className="font-medium">{getRoleTitle(log.userRole)}</span>
                    </div>

                    <span className="font-mono">{log.id}</span>
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