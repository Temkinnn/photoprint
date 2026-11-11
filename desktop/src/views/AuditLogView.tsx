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
  Sparkles,
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
          icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
          label: 'Отказ в доступе (RBAC)',
          cardBorder: 'border-rose-300 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-800',
          badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-900/40',
          indicatorDot: 'bg-rose-500',
        };
      case 'REJECTED':
        return {
          icon: <XCircle className="w-4 h-4 text-amber-500" />,
          label: 'Отклонено',
          cardBorder: 'border-amber-300 dark:border-amber-900/60 hover:border-amber-400 dark:hover:border-amber-800',
          badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-900/40',
          indicatorDot: 'bg-amber-500',
        };
      case 'SUCCESS':
      default:
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
          label: 'Успешно',
          cardBorder: 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700',
          badgeClass: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
          indicatorDot: 'bg-emerald-500',
        };
    }
  };

  const getActionCategory = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('SECURITY') || act.includes('ACCESS_DENIED') || act.includes('BLOCKED')) {
      return { label: 'Безопасность / RBAC', icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> };
    }
    if (act.includes('TASK') || act.includes('APPROVE')) {
      return { label: 'Поручения', icon: <CheckSquare className="w-3.5 h-3.5 text-blue-500" /> };
    }
    if (act.includes('MEETING')) {
      return { label: 'Совещания', icon: <Calendar className="w-3.5 h-3.5 text-indigo-500" /> };
    }
    if (act.includes('RAG') || act.includes('DOCUMENT')) {
      return { label: 'База знаний', icon: <FileText className="w-3.5 h-3.5 text-emerald-500" /> };
    }
    if (act.includes('LOGIN') || act.includes('ROLE')) {
      return { label: 'Аутентификация', icon: <User className="w-3.5 h-3.5 text-neutral-500" /> };
    }
    return { label: 'Система', icon: <Layers className="w-3.5 h-3.5 text-neutral-500" /> };
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
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="h-16 px-8 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-white/60 dark:bg-[#0c1017]/60 backdrop-blur-xl shrink-0">
        <div>
          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            Журнал аудита действий
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Неизменяемый протокол операций: доступ к закрытым данным, фиксация решений и действия ролей (ОТ-04, AI-06)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {accessDeniedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-300/80 dark:border-rose-900/50 text-xs font-medium text-rose-700 dark:text-rose-400 shadow-sm backdrop-blur-md">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{accessDeniedCount} нарушений доступа</span>
            </div>
          )}
          <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 glass-card px-3 py-1 rounded-xl shadow-sm">
            Записей в логе: {auditLogs.length}
          </span>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="p-4 px-8 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/40 dark:bg-black/[0.1] backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm ${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold shadow-sm'
                    : 'glass-card text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                    tab.alert
                      ? 'bg-rose-500 text-white'
                      : isActive
                      ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                      : 'bg-black/[0.05] dark:bg-white/[0.08] text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Role Filter & Search Field */}
        <div className="flex items-center gap-3">
          {/* Role selector */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="glass-input text-neutral-800 dark:text-neutral-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500/50 shadow-sm cursor-pointer"
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
              className="w-full glass-input rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-blue-500/50 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Cards Stream / Feed */}
      <div className="flex-1 overflow-y-auto p-8 space-y-3.5">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center glass-panel rounded-2xl max-w-xl mx-auto space-y-3">
            <ShieldCheck className="w-8 h-8 text-neutral-400 mx-auto" />
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              Событий не найдено
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              По заданным критериям фильтрации и поиска записи отсутствуют. Попробуйте сбросить фильтры.
            </p>
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterRole('all');
                setSearchQuery('');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 glass-card hover:bg-white dark:hover:bg-white/[0.1] rounded-xl transition-all shadow-sm inline-block"
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
                className={`p-4 rounded-2xl glass-card ${statusConfig.cardBorder} shadow-sm transition-all duration-200 hover:-translate-y-0.5 space-y-3`}
              >
                {/* Card Top Row: Category, Action Badge, Target & Timestamp */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Pill */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusConfig.badgeClass}`}
                    >
                      {statusConfig.icon}
                      <span>{statusConfig.label}</span>
                    </span>

                    {/* Action Code Tag */}
                    <span className="font-mono text-[11px] font-semibold text-neutral-900 dark:text-neutral-100 bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-md border border-black/[0.06] dark:border-white/[0.08]">
                      {log.actionType}
                    </span>

                    {/* Category Label */}
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 font-medium">
                      {category.icon}
                      <span>{category.label}</span>
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono shrink-0">
                    <Clock className="w-3 h-3 text-neutral-400" />
                    <span>{log.timestamp}</span>
                  </div>
                </div>

                {/* Card Middle: Target Entity & Details */}
                <div className="space-y-1.5 pl-0.5">
                  <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <span className="text-neutral-400">Целевой объект:</span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 font-mono bg-black/[0.03] dark:bg-white/[0.04] px-2 py-0.5 rounded-md border border-black/[0.06] dark:border-white/[0.08]">
                      {log.targetEntity}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans bg-black/[0.02] dark:bg-white/[0.02] p-3 rounded-xl border border-black/[0.05] dark:border-white/[0.06]">
                    {log.details}
                  </p>
                </div>

                {/* Card Footer: Actor, Role, ID */}
                <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 pt-1 border-t border-black/[0.05] dark:border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-neutral-900 dark:text-neutral-200 font-medium">
                      <User className="w-3 h-3 text-neutral-400" />
                      <span>{log.userName}</span>
                    </div>
                    <span className="text-neutral-300 dark:text-neutral-700">•</span>
                    <span className="text-neutral-600 dark:text-neutral-400 font-sans">
                      {getRoleTitle(log.userRole)}
                    </span>
                    <span className="text-neutral-400 font-mono text-[10px]">({log.userRole})</span>
                  </div>

                  <span className="font-mono text-[10px] text-neutral-400 font-medium">
                    ID: {log.id}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
