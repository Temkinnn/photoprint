import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TaskItem } from '../types';
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Calendar,
  Database,
  User,
  ShieldAlert,
  Sparkles,
  CheckCheck
} from 'lucide-react';

export const OverviewView: React.FC = () => {
  const { kpiMetrics, tasks, toggleTaskStatus, logAudit, showToast, syncWithBackend, isSyncing, backendOnline } = useApp();

  const [dataFreshnessTime, setDataFreshnessTime] = useState<string>('2026-11-11 15:00:00');

  const overdueTasks = tasks.filter((t) => t.status === 'overdue');

  const handleRefresh = async () => {
    const now = new Date();
    const formatted =
      now.toLocaleDateString('ru-RU') +
      ' ' +
      now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDataFreshnessTime(formatted);

    await syncWithBackend();

    logAudit(
      'REFRESH_DASHBOARD',
      'KPI & Overdue Registry',
      'SUCCESS',
      `Синхронизированы 6 витрин KPI и ${overdueTasks.length} просроченных поручений (Сервер: ${backendOnline ? 'онлайн' : 'офлайн'})`
    );

    showToast(
      backendOnline ? 'Данные синхронизированы с бэкендом' : 'Витрины обновлены (локальный режим)',
      `Время актуальности: ${formatted}`,
      'info'
    );
  };

  const handleResolveOverdue = (task: TaskItem) => {
    toggleTaskStatus(task.id);
    logAudit(
      'RESOLVE_OVERDUE_TASK',
      `Task: ${task.title}`,
      'SUCCESS',
      `Просроченная задача закрыта руководителем на дашборде обзора: ${task.title}`
    );
    showToast(
      'Поручение исполнено',
      `Задача «${task.title}» закрыта и снята с контроля просрочки`,
      'success'
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-y-auto p-6 lg:p-8 transition-colors">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header & Freshness Banner */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800/80">
          <div>
            <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              Пульс компании (Управленческий обзор)
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Сценарий 6: сводка производственных KPI и контроль исполнения решений с указанием источников и времени среза
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-end gap-1">
                <Clock className="w-3 h-3 text-neutral-400" />
                <span>Время актуальности данных:</span>
              </div>
              <div className="text-xs font-mono font-medium text-neutral-900 dark:text-neutral-200">
                {dataFreshnessTime}
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Синхронизация...' : 'Синхронизировать'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DEDICATED OVERDUE BLOCK (ПРИОРИТЕТНЫЙ КОНТРОЛЬ ПРОСРОЧКИ С ЗАКРЫТИЕМ)     */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Приоритетный контроль: Просроченные поручения ({overdueTasks.length})
              </h2>
              {overdueTasks.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 uppercase font-mono">
                  Требуют закрытия
                </span>
              )}
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Решения совещаний с истекшим дедлайном
            </span>
          </div>

          {overdueTasks.length === 0 ? (
            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 shadow-sm">
              <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong>Все поручения в графике:</strong> Просроченных решений не зафиксировано. Все обязательства выполняются в установленные сроки.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 rounded-2xl bg-white dark:bg-neutral-900/80 border border-rose-300 dark:border-rose-900/60 shadow-sm flex flex-col justify-between gap-3 hover:border-rose-400 transition-colors"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-mono uppercase shrink-0">
                        Просрочено
                      </span>
                      <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate" title={task.title}>
                        {task.title}
                      </h3>
                    </div>

                    <p className="text-xs text-neutral-600 dark:text-neutral-400 italic line-clamp-2">
                      Основание протокола: «{task.sourceQuote}»
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 pt-0.5">
                      <span className="flex items-center gap-1 text-neutral-700 dark:text-neutral-300 font-medium">
                        <User className="w-3 h-3 text-neutral-400" />
                        {task.assigneeName}
                      </span>
                      <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold font-mono">
                        <Calendar className="w-3 h-3" />
                        Дедлайн: {task.deadline}
                      </span>
                      {task.meetingTitle && (
                        <span className="text-neutral-500 font-mono text-[10px] truncate max-w-[200px]">
                          Источник: {task.meetingTitle}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* On-the-spot completion button */}
                  <div className="pt-2 border-t border-rose-100 dark:border-rose-950/40 flex items-center justify-end">
                    <button
                      onClick={() => handleResolveOverdue(task)}
                      title="Закрыть задачу прямо из управленческого дашборда"
                      className="w-full sm:w-auto px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Закрыть задачу на месте</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* KPI CARDS GRID (6 ключевых показателей с источником и временем среза)    */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Сводка ключевых показателей производства и сервиса
            </h2>
            <span className="text-[11px] text-neutral-500">Источники: 1С:УНФ, ERP, Zabbix, CRM picPac</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiMetrics.map((kpi) => {
            const isNormal = kpi.status === 'normal';
            const isCritical = kpi.status === 'critical';

            return (
              <div
                key={kpi.id}
                className="p-5 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between gap-3 shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium leading-snug">
                    {kpi.name}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                      isNormal
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : isCritical
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {isNormal ? 'Норма' : isCritical ? 'Критично' : 'Отклонение'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                      {kpi.value}
                    </span>
                    {kpi.trend === 'up' ? (
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    ) : kpi.trend === 'down' ? (
                      <TrendingDown className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Minus className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                    План: {kpi.target}
                  </span>
                </div>

                {/* Source & Freshness Metadata (Scenario 6 requirement) */}
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 pt-2.5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between font-mono">
                  <span className="truncate pr-2 font-sans text-neutral-500">Источник: {kpi.sourceSystem}</span>
                  <span className="shrink-0 text-neutral-400">Срез: {kpi.updatedAt.split(' ')[1]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AI SITUATION SUMMARY                                                      */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 space-y-2 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
          Сводка по ситуации от AI-Ассистента руководителя
        </div>
        <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">
          Главное внимание требуется участку послепечатной обработки: из-за аварии датчика УФ-лакировки брак составил{' '}
          <strong className="font-semibold text-neutral-900 dark:text-neutral-100">3.2%</strong> (выше планового порога 2.5%), сдача в срок упала до{' '}
          <strong className="font-semibold text-neutral-900 dark:text-neutral-100">96.4%</strong>. Служба поддержки PicPac справляется со всплеском обращений с показателем SLA{' '}
          <strong className="font-semibold text-neutral-900 dark:text-neutral-100">98.2%</strong>. Загрузка основных мощностей достигла{' '}
          <strong className="font-semibold text-neutral-900 dark:text-neutral-100">87%</strong>, что подтверждает критическую необходимость ввода ЦПМ Canon V1000 к 50-й неделе года.
        </p>
      </div>

      {/* Critical Points */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          Ключевые вопросы к решению на этой неделе
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1.5 shadow-sm">
            <div className="font-semibold text-neutral-900 dark:text-neutral-200">
              Закупка запасного комплекта датчиков вязкости для УФ-линии
            </div>
            <div className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Ответственный: Иванов И.С. · Срок: 14.11.2026 · Поставщик «Полиграф-Сервис» (Бюджет 65 000 руб.)
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1.5 shadow-sm">
            <div className="font-semibold text-neutral-900 dark:text-neutral-200">
              Согласование ставки субаренды упаковочного склада
            </div>
            <div className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Ответственный: Смирнов А.В. · Срок: 15.11.2026 · Риск дефицита площади упаковки в декабре
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
