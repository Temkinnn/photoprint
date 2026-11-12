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
  Info,
} from 'lucide-react';

const getKpiFormula = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('брак')) {
    return 'Формула: (Перепечатанные листы / Общий объём выпуска) × 100%';
  }
  if (lower.includes('срок') || lower.includes('otd')) {
    return 'Формула: (Заказы, отгруженные до дедлайна / Всего заказов) × 100%';
  }
  if (lower.includes('sla') || lower.includes('поддерж')) {
    return 'Формула: (Обращения с ответом ≤ 15 мин / Всего обращений) × 100%';
  }
  if (lower.includes('загруз')) {
    return 'Формула: (Фактические машино-часы / Доступный фонд времени ЦПМ) × 100%';
  }
  if (lower.includes('выруч') || lower.includes('оборот')) {
    return 'Формула: ∑ Оплаченных заказов (BYN) за расчётный период';
  }
  if (lower.includes('марж')) {
    return 'Формула: ((Выручка − Прямая себестоимость) / Выручка) × 100%';
  }
  return 'Формула: Агрегат учётной витрины за текущую смену (1С / ERP)';
};

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

  const [dataFreshnessTime, setDataFreshnessTime] = useState<string>('2026-11-11 15:00:00 (UTC+3)');
  const [lastAuditRunTime, setLastAuditRunTime] = useState<string>('Сегодня, 09:00 (UTC+3)');
  const overdueTasks = tasks.filter((t) => t.status === 'overdue');

  const handleRefresh = async () => {
    const now = new Date();
    const formatted =
      now.toLocaleDateString('ru-RU') +
      ' ' +
      now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' (UTC+3)';
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
      backendOnline ? 'Данные синхронизированы с бэкендом' : 'Витрины обновлены',
      `Актуально на ${formatted}`,
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
      `Задача «${task.title}» снята с контроля просрочки`,
      'success'
    );
  };

  const handleRunAnomalyAudit = () => {
    const nowTime = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setLastAuditRunTime(`Сегодня, ${nowTime} (UTC+3)`);
    logAudit(
      'DAILY_ANOMALY_SCAN',
      'KPI vs Reglaments (20 docs)',
      'SUCCESS',
      'Выполнена автоматическая сверка показателей KPI с нормативами базы знаний: выявлено 2 расхождения.'
    );
    showToast(
      'Сверка завершена',
      'Проверено 20 регламентов и 6 витрин KPI. Найдено 2 отклонения.',
      'warning'
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 lg:p-8 transition-colors">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Top Control Bar */}
        <div className="nothing-card p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <h1 className="text-base font-semibold text-[var(--text-primary)]">
                Пульс производства и сервиса
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Оперативный контроль выработки цеха, брака и согласованных решений
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-[var(--text-muted)]">Срез 1С / ERP</div>
              <div className="text-xs font-mono font-medium text-[var(--text-primary)] tabular-nums">
                {dataFreshnessTime}
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Синхронизация...' : 'Синхронизировать'}</span>
            </button>
          </div>
        </div>

        {/* 6 KPI Modules with Formulas & Timestamps (ОТ-07) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-primary)]">
              Показатели цеха и клиентского сервиса
            </span>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              1С:УНФ · ERP цеха · CRM picPac
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpiMetrics.map((kpi) => {
              const isNormal = kpi.status === 'normal';
              const isCritical = kpi.status === 'critical';
              const formula = getKpiFormula(kpi.name);

              return (
                <div
                  key={kpi.id}
                  title={formula}
                  className="nothing-card p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-xs font-medium text-[var(--text-secondary)] truncate"
                      title={kpi.name}
                    >
                      {kpi.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span title={formula} className="text-[var(--text-muted)] cursor-help">
                        <Info className="w-3 h-3" />
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isNormal
                            ? 'bg-emerald-500'
                            : isCritical
                            ? 'bg-[#D71921]'
                            : 'bg-amber-500'
                        }`}
                      />
                    </div>
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
                    <div className="text-[11px] font-mono text-[var(--text-muted)] mt-1">
                      Цель: {kpi.target}
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-solid)] flex items-center justify-between">
                    <span className="truncate">{kpi.sourceSystem.split('/')[0]}</span>
                    <span className="shrink-0">{kpi.updatedAt.split(' ')[1]} UTC+3</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overdue Tasks Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Контроль просроченных решений
              </span>
              {overdueTasks.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#D71921]/15 text-[#D71921]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D71921]" />
                  {overdueTasks.length} требуют закрытия
                </span>
              )}
            </div>
          </div>

          {overdueTasks.length === 0 ? (
            <div className="nothing-card p-4 text-xs text-[var(--text-primary)] flex items-center gap-2.5">
              <CheckCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                <strong>Все обязательства в графике:</strong> просроченных поручений не
                зафиксировано
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
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#D71921]/15 text-[#D71921]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D71921]" />
                        Срок: {task.deadline}
                      </span>
                      <h3 className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {task.title}
                      </h3>
                    </div>

                    <div className="text-xs text-[var(--text-secondary)] pl-3 border-l border-[var(--border-solid)] line-clamp-1">
                      «{task.sourceQuote}»
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] pl-3">
                      <span className="text-[var(--text-primary)] font-medium">
                        {task.assigneeName}
                      </span>
                      {task.meetingTitle && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[11px]">{task.meetingTitle}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleResolveOverdue(task)}
                    className="px-3.5 py-2 text-xs font-medium bg-[var(--bg-elevated)] hover:bg-emerald-600 text-[var(--text-primary)] hover:text-white border border-[var(--border-solid)] hover:border-emerald-600 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Закрыть поручение</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily Audit & Anomaly Detection (Slide 06) */}
        <div className="nothing-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-solid)]">
            <div>
              <div className="font-mono text-[11px] text-[#D71921] font-medium">
                06 // НЕПРЕРЫВНЫЙ МОНИТОРИНГ · {lastAuditRunTime}
              </div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                Ежедневный аудит и выявление расхождений
              </h2>
            </div>

            <button
              onClick={handleRunAnomalyAudit}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-solid)] text-[var(--text-primary)] transition-colors"
            >
              Запустить сверку документов и KPI
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-solid)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#D71921] font-semibold">
                  ● РАСХОЖДЕНИЕ ЦИФР
                </span>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">doc-prod-02</span>
              </div>
              <div className="font-semibold text-[var(--text-primary)]">
                Брак УФ-лакировки 3.2% превышает норматив техкарты (≤ 2.5%)
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Сверка ERP цеха с регламентом качества печати. Требуется замена датчика вязкости.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-solid)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-amber-500 font-semibold">
                  ● СВЕРКА ВЕРСИЙ
                </span>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">doc-fin-01</span>
              </div>
              <div className="font-semibold text-[var(--text-primary)]">
                Загрузка парка 87% приближается к порогу ввода ЦПМ Canon V1000
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Сопоставление графика смен с инвестиционным меморандумом на 4 квартал 2026 года.
              </p>
            </div>
          </div>
        </div>

        {/* Weekly Decisions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="nothing-card p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                Крайний срок: 14.11.2026
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                На согласовании
              </span>
            </div>
            <div className="font-semibold text-[var(--text-primary)]">
              Закупка запасного комплекта датчиков вязкости для УФ-линии
            </div>
            <div className="text-[var(--text-secondary)]">
              Поставщик «Полиграф-Сервис» (бюджет 65 000 BYN). Ответственный: Иванов И.С.
            </div>
          </div>

          <div className="nothing-card p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                Крайний срок: 15.11.2026
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Риск склада
              </span>
            </div>
            <div className="font-semibold text-[var(--text-primary)]">
              Согласование ставки субаренды упаковочного склада
            </div>
            <div className="text-[var(--text-secondary)]">
              Риск дефицита площади упаковки тиражей к декабрю. Ответственный: Смирнов А.В.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};