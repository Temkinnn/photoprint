import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  FileText,
  Calendar,
  Layers,
  CheckSquare
} from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { auditLogs } = useApp();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Counts for quick badges
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
      // Status filter
      if (filterStatus !== 'all' && log.status !== filterStatus) {
        return false;
      }
      // Role filter
      if (filterRole !== 'all' && log.userRole !== filterRole) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesAction = log.actionType.toLowerCase().includes(query);
        const matchesUser = log.userName.toLowerCase().includes(query);
        const matchesTarget = log.targetEntity.toLowerCase().includes(query);
        const matchesDetails = log.details.toLowerCase().includes(query);
        return matchesAction || matchesUser || matchesTarget || matchesDetails;
      }
      return true;
    });
  }, [auditLogs, filterStatus, filterRole, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACCESS_DENIED':
        return {
          icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />,
          label: 'Отказ в доступе',
          cardBorder: 'border-rose-300 dark:border-rose-900/50 hover:border-rose-400',
          badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
          indicatorDot: 'bg-rose-500',
        };
      case 'REJECTED':
        return {
          icon: <XCircle className="w-3.5 h-3.5 text-amber-500" />,
          label: 'Отклонено',
          cardBorder: 'border-amber-300 dark:border-amber-900/50 hover:border-amber-400',
          badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
          indicatorDot: 'bg-amber-500',
        };
      case 'SUCCESS':
      default:
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
          label: 'Успешно',
          cardBorder: 'border-neutral-200 dark:border-[#222631] hover:border-neutral-300 dark:hover:border-[#2e3342]',
          badgeClass: 'bg-neutral-100 dark:bg-[#1a1d25] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-[#262a36]',
          indicatorDot: 'bg-emerald-500',
        };
    }
  };

  const getActionCategory = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('SECURITY') || act.includes('ACCESS_DENIED') || act.includes('BLOCKED')) {
      return { label: 'RBAC / Безопасность', icon: <ShieldAlert className="w-3 h-3 text-rose-500" /> };
    }
    if (act.includes('TASK') || act.includes('APPROVE')) {
      return { label: 'Поручения цеха', icon: <CheckSquare className="w-3 h-3 text-sky-500" /> };
    }
    if (act.includes('MEETING')) {
      return { label: 'Совещания', icon: <Calendar className="w-3 h-3 text-indigo-500" /> };
    }
    if (act.includes('RAG') || act.includes('DOCUMENT')) {
      return { label: 'Регламенты и стандарты', icon: <FileText className="w-3 h-3 text-emerald-500" /> };
    }
    if (act.includes('LOGIN') || act.includes('ROLE')) {
      return { label: 'Аутентификация', icon: <User className="w-3 h-3 text-neutral-400" /> };
    }
    return { label: 'Система', icon: <Layers className="w-3 h-3 text-neutral-400" /> };
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
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] dark:bg-[#0c0d12] overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-neutral-200 dark:border-[#212530] flex items-center justify-between bg-white dark:bg-[#13151b] shrink-0">
        <div>
          <h1 className="text-base font-bold text-neutral-950 dark:text-white tracking-tight flex items-center gap-2">
            Журнал аудита действий
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Неизменяемый реестр операций: фиксация решений, разграничение прав (RBAC) и аудит доступа
          </p>
        </div>

        <div className="flex items-center gap-3">
          {accessDeniedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-xs font-mono font-medium text-rose-700 dark:text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>{accessDeniedCount} нарушений допуска</span>
            </div>
          )}
          <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-[#1a1d25] px-2.5 py-1 rounded border border-neutral-200 dark:border-[#252936]">
            Всего записей: {auditLogs.length}
          </span>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="p-3.5 px-6 border-b border-neutral-200 dark:border-[#212530] bg-white dark:bg-[#13151b] shrink-0">
        <div className="max-w-5xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'Все события', count: auditLogs.length },
              { id: 'ACCESS_DENIED', label: 'Отказы в доступе', count: accessDeniedCount, alert: accessDeniedCount > 0 },
              { id: 'SUCCESS', label: 'Успешные', count: successCount },
              { id: 'REJECTED', label: 'Отклоненные', count: rejectedCount },
            ].map((tab) => {
              const isActive = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold shadow-sm'
                      : 'bg-neutral-50 dark:bg-[#191c24] text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white border border-neutral-200/80 dark:border-[#242834]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1 rounded ${
                      tab.alert
                        ? 'bg-rose-500 text-white'
                        : isActive
                        ? 'bg-white/20 text-white dark:bg-neutral-950/20 dark:text-neutral-950'
                        : 'text-neutral-400 dark:text-neutral-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Role Filter & Search Field */}
          <div className="flex items-center gap-2.5">
            {/* Role selector */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-neutral-50 dark:bg-[#181a22] border border-neutral-200 dark:border-[#252936] text-neutral-800 dark:text-neutral-200 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="all">Все роли</option>
              <option value="ROLE_DIRECTOR">Генеральный директор</option>
              <option value="ROLE_PRODUCTION_HEAD">Начальник производства</option>
              <option value="ROLE_SUPPORT_HEAD">Клиентский сервис</option>
            </select>

            {/* Search box */}
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по событиям и деталям..."
                className="w-full bg-neutral-50 dark:bg-[#181a22] border border-neutral-200 dark:border-[#252936] rounded-md pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cards Stream / Feed */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-5xl mx-auto w-full space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#14161c] border border-dashed border-neutral-200 dark:border-[#222631] rounded-lg max-w-xl mx-auto space-y-2">
              <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Записей аудита не найдено
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                По заданным критериям фильтрации события отсутствуют.
              </p>
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterRole('all');
                  setSearchQuery('');
                }}
                className="px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-[#1a1d25] hover:bg-neutral-200 dark:hover:bg-[#222632] rounded-md transition-colors mt-2"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const statusConfig = getStatusBadge(log.status);
              const category = getActionCategory(log.actionType);

              return (
                <div
                  key={log.id}
                  className={`p-4 rounded-lg bg-white dark:bg-[#14161c] border ${statusConfig.cardBorder} space-y-2.5 transition-colors`}
                >
                  {/* Top Row */}
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status Tag */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${statusConfig.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.indicatorDot}`} />
                        <span>{statusConfig.label}</span>
                      </span>

                      {/* Action Code Tag */}
                      <span className="font-mono text-[11px] font-medium text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-[#1a1d25] px-2 py-0.5 rounded border border-neutral-200 dark:border-[#252936]">
                        {log.actionType}
                      </span>

                      {/* Category Label */}
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 font-medium">
                        {category.icon}
                        <span>{category.label}</span>
                      </span>
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500 font-mono shrink-0">
                      <Clock className="w-3 h-3 text-neutral-400" />
                      <span>{log.timestamp}</span>
                    </div>
                  </div>

                  {/* Target & Details */}
                  <div className="space-y-1.5">
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                      <span>Объект:</span>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100 font-mono bg-neutral-100 dark:bg-[#191c24] px-1.5 py-0.2 rounded text-[11px]">
                        {log.targetEntity}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans bg-neutral-50 dark:bg-[#101217] p-2.5 rounded border border-neutral-100 dark:border-[#1d2028]">
                      {log.details}
                    </p>
                  </div>

                  {/* Actor & ID */}
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 pt-1 border-t border-neutral-100 dark:border-[#1d2028]">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-900 dark:text-neutral-200 font-medium">
                        {log.userName}
                      </span>
                      <span>—</span>
                      <span className="text-neutral-600 dark:text-neutral-400">
                        {getRoleTitle(log.userRole)}
                      </span>
                      <span className="text-neutral-400 font-mono text-[10px]">({log.userRole})</span>
                    </div>

                    <span className="font-mono text-[10px] text-neutral-400">
                      ID: {log.id}
                    </span>
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
