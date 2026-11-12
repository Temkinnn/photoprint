import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TaskItem } from '../types';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  CheckCheck,
} from 'lucide-react';

export const OverviewView: React.FC = () => {
  const {
    kpiMetrics,
    tasks,
    toggleTaskStatus,
    logAudit,
    showToast,
    syncWithBackend,
    isSyncing,
    backendOnline,
  } = useApp();

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
      `Синхронизированы 6 витрин KPI и ${overdueTasks.length} просроченных поручений (Сервер: ${
        backendOnline ? 'онлайн' : 'офлайн'
      })`
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
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 lg:p-8 transition-colors">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header Bar */}
        <div className="nothing-card p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="font-dot text-lg uppercase text-[var(--text-primary)] tracking-wider">
                ПУЛЬС ПРОИЗВОДСТВА И СЕРВИСА
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Оперативный контроль выработки цеха, брака и согласованных решений
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                СРЕЗ 1С / ERP
              </div>
              <div className="text-xs font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                {dataFreshnessTime}
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 rounded-full transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Синхронизация...' : 'Синхронизировать'}</span>
            </button>
          </div>
        </div>

        {/* 6 KPI Modules Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="font-dot uppercase tracking-wider text-[var(--text-primary)]">
              ТЕЛЕМЕТРИЯ ЦЕХА (6 ВИТРИН)
            </span>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              1С:УНФ · ERP ЦЕХА · CRM PICPAC
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpiMetrics.map((kpi) => {
              const isNormal = kpi.status === 'normal';
              const isCritical = kpi.status === 'critical';

              return (
                <div
                  key={kpi.id}
                  className="nothing-card p-4 flex flex-col justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[11px] font-medium text-[var(--text-secondary)] truncate"
                      title={kpi.name}
                    >
                      {kpi.name}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isNormal
                          ? 'bg-emerald-500'
                          : isCritical
                          ? 'bg-[#D71921]'
                          : 'bg-amber-500'
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-dot text-2xl text-[var(--text-primary)] tabular-nums">
                        {kpi.value}
                      </span>
                      {kpi.trend === 'up' ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      ) : kpi.trend === 'down' ? (
                        <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Minus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                      ЦЕЛЬ: {kpi.target}
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-[var(--text-muted)] pt-2 border-t border-dashed border-[var(--border-dashed)] flex items-center justify-between">
                    <span className="truncate">{kpi.sourceSystem.split('/')[0]}</span>
                    <span className="shrink-0">{kpi.updatedAt.split(' ')[1]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overdue Tasks Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <span className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
                КОНТРОЛЬ ПРОСРОЧЕННЫХ РЕШЕНИЙ
              </span>
              {overdueTasks.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#D71921]/15 text-[#D71921]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D71921]" />
                  {overdueTasks.length} ТРЕБУЮТ ЗАКРЫТИЯ
                </span>
              )}
            </div>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              РЕЕСТР ИСПОЛНЕНИЯ
            </span>
          </div>

          {overdueTasks.length === 0 ? (
            <div className="nothing-card p-4 text-xs text-[var(--text-primary)] flex items-center gap-2.5">
              <CheckCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                <strong>Все обязательства в графике:</strong> просроченных поручений не зафиксировано.
              </span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="nothing-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#D71921]/15 text-[#D71921]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D71921]" />
                        СРОК: {task.deadline}
                      </span>
                      <h3 className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {task.title}
                      </h3>
                    </div>

                    <div className="text-xs text-[var(--text-secondary)] italic pl-3 border-l-2 border-dashed border-[var(--border-dashed)] line-clamp-1">
                      «{task.sourceQuote}»
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] pl-3">
                      <span className="text-[var(--text-primary)] font-medium">
                        {task.assigneeName}
                      </span>
                      {task.meetingTitle && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[10px]">{task.meetingTitle}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleResolveOverdue(task)}
                    className="px-4 py-2 text-xs font-semibold bg-[var(--bg-elevated)] hover:bg-emerald-600 text-[var(--text-primary)] hover:text-white border border-[var(--border-solid)] hover:border-emerald-600 rounded-full transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Закрыть поручение</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Executive Brief */}
        <div className="nothing-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
              ОПЕРАТИВНАЯ СВОДКА ДИРЕКЦИИ
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              DAILY BRIEF // AI-SUMMARY
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Внимание участка послепечатной обработки: из-за аварии датчика УФ-лакировки брак
            составил <strong className="text-[var(--text-primary)]">3.2%</strong> (порог цеха
            2.5%), сдача тиражей в срок снизилась до{' '}
            <strong className="text-[var(--text-primary)]">96.4%</strong>. Служба заботы PicPac
            удерживает показатель SLA <strong className="text-[var(--text-primary)]">98.2%</strong>.
            Загрузка основного парка плоттеров и ЦПМ достигла{' '}
            <strong className="text-[var(--text-primary)]">87%</strong>, подтверждая необходимость
            ускоренного ввода ЦПМ Canon V1000 к 50-й неделе.
          </p>
        </div>

        {/* Key Weekly Decisions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="nothing-card p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                ДЕДЛАЙН: 14.11.2026
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                НА СОГЛАСОВАНИИ
              </span>
            </div>
            <div className="font-bold text-[var(--text-primary)]">
              Закупка запасного комплекта датчиков вязкости для УФ-линии
            </div>
            <div className="text-[var(--text-secondary)] text-[11px]">
              Поставщик «Полиграф-Сервис» (Бюджет 65 000 руб.). Ответственный: Иванов И.С.
            </div>
          </div>

          <div className="nothing-card p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                ДЕДЛАЙН: 15.11.2026
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                РИСК СКЛАДА
              </span>
            </div>
            <div className="font-bold text-[var(--text-primary)]">
              Согласование ставки субаренды упаковочного склада
            </div>
            <div className="text-[var(--text-secondary)] text-[11px]">
              Риск дефицита площади упаковки тиражей к декабрю. Ответственный: Смирнов А.В.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
