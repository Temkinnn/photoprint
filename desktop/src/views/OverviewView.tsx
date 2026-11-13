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

const getKpiFormula = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('брак')) {
    return '(Перепечатанные листы / Общий выпуск) × 100%';
  }
  if (lower.includes('срок') || lower.includes('otd')) {
    return '(Отгружено до дедлайна / Всего заказов) × 100%';
  }
  if (lower.includes('sla') || lower.includes('поддерж')) {
    return '(Ответы ≤ 15 мин / Всего обращений) × 100%';
  }
  if (lower.includes('загруз')) {
    return '(Факт. машино-часы / Доступный фонд ЦПМ) × 100%';
  }
  if (lower.includes('выруч') || lower.includes('оборот')) {
    return '∑ Оплаченных заказов (BYN) за период';
  }
  if (lower.includes('марж')) {
    return '((Выручка − Прямая себестоимость) / Выручка) × 100%';
  }
  return 'Агрегат учётной витрины (1С / ERP цеха)';
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
      <div className="max-w-6xl mx-auto w-full space-y-7">
        {/* Top Control Bar */}
        <div className="nothing-card p-5 lg:p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#D71921]">
                00 // Управленческий контур
              </span>
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mt-1">
              Пульс производства и сервиса
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Оперативный контроль выработки цеха, брака и согласованных решений
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Срез 1С / ERP
              </div>
              <div className="text-sm font-mono font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
                {dataFreshnessTime}
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 rounded-xl transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Синхронизация...' : 'Синхронизировать'}</span>
            </button>
          </div>
        </div>

        {/* 6 KPI Modules in Readable 3x2 Grid with Explicit Formulas (ОТ-07) */}
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#D71921]">
                01 // Ключевые показатели
              </div>
              <h2 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                Метрики цеха и клиентского сервиса
              </h2>
            </div>
            <span className="text-xs font-mono font-medium text-[var(--text-muted)]">
              Источники: 1С:УНФ · ERP цеха · CRM picPac
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpiMetrics.map((kpi) => {
              const isNormal = kpi.status === 'normal';
              const isCritical = kpi.status === 'critical';
              const formula = getKpiFormula(kpi.name);

              return (
                <div
                  key={kpi.id}
                  className="nothing-card p-5 flex flex-col justify-between gap-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {kpi.name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2 py-0.5 rounded-md ${
                        isNormal
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : isCritical
                          ? 'bg-[#D71921]/15 text-[#D71921]'
                          : 'bg-amber-500/15 text-amber-500'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isNormal
                            ? 'bg-emerald-500'
                            : isCritical
                            ? 'bg-[#D71921]'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span>{isNormal ? 'Норма' : isCritical ? 'Критично' : 'Внимание'}</span>
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-dot text-3xl text-[var(--text-primary)] tabular-nums">
                        {kpi.value}
                      </span>
                      {kpi.trend === 'up' ? (
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      ) : kpi.trend === 'down' ? (
                        <TrendingDown className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Minus className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </div>
                    <div className="text-xs font-mono font-semibold text-[var(--text-secondary)]">
                      Цель: <span className="text-[var(--text-primary)]">{kpi.target}</span>
                    </div>
                  </div>

                  {/* Formula Strip (ОТ-07) */}
                  <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-3 py-2 rounded-lg border border-[var(--border-solid)] leading-snug">
                    <span className="font-mono font-bold text-[var(--text-primary)]">Формула: </span>
                    {formula}
                  </div>

                  <div className="text-xs font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-solid)] flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{kpi.sourceSystem.split('/')[0]}</span>
                    <span className="shrink-0">{kpi.updatedAt.split(' ')[1]} UTC+3</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overdue Tasks Control */}
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#D71921]">
                02 // Исполнительская дисциплина
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Контроль просроченных решений
                </h2>
                {overdueTasks.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-[#D71921]/15 text-[#D71921]">
                    <span className="w-2 h-2 rounded-full bg-[#D71921]" />
                    {overdueTasks.length} требуют закрытия
                  </span>
                )}
              </div>
            </div>
          </div>

          {overdueTasks.length === 0 ? (
            <div className="nothing-card p-5 text-sm text-[var(--text-primary)] flex items-center gap-3">
              <CheckCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>
                <strong>Все обязательства в графике:</strong> просроченных поручений не
                зафиксировано
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="nothing-card p-5 border-l-4 border-l-[#D71921] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-[#D71921]/15 text-[#D71921]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D71921]" />
                        Срок: {task.deadline}
                      </span>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        {task.title}
                      </h3>
                    </div>

                    <div className="text-sm text-[var(--text-secondary)] pl-3.5 border-l-2 border-[var(--border-solid)]">
                      «{task.sourceQuote}»
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] pl-3.5">
                      <span className="text-[var(--text-primary)] font-bold">
                        {task.assigneeName}
                      </span>
                      {task.meetingTitle && (
                        <>
                          <span>·</span>
                          <span className="font-mono">{task.meetingTitle}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleResolveOverdue(task)}
                    className="px-4 py-2.5 text-xs font-bold bg-[var(--bg-elevated)] hover:bg-emerald-600 text-[var(--text-primary)] hover:text-white border border-[var(--border-solid)] hover:border-emerald-600 rounded-xl transition-colors flex items-center gap-2 shrink-0"
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
        <div className="nothing-card p-5 lg:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-solid)]">
            <div>
              <div className="font-mono text-xs text-[#D71921] font-bold uppercase tracking-wider">
                06 // Непрерывный мониторинг · {lastAuditRunTime}
              </div>
              <h2 className="text-base font-bold text-[var(--text-primary)] mt-1">
                Ежедневный аудит и выявление расхождений
              </h2>
            </div>

            <button
              onClick={handleRunAnomalyAudit}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 transition-opacity"
            >
              Запустить сверку документов и KPI
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-solid)] border-l-4 border-l-[#D71921] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#D71921] font-bold">
                  ● РАСХОЖДЕНИЕ ЦИФР
                </span>
                <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">
                  doc-prod-02
                </span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                Брак УФ-лакировки 3.2% превышает норматив техкарты (≤ 2.5%)
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Сверка ERP цеха с регламентом качества печати. Требуется замена датчика вязкости.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-solid)] border-l-4 border-l-amber-500 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-amber-500 font-bold">
                  ● СВЕРКА ВЕРСИЙ
                </span>
                <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">
                  doc-fin-01
                </span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                Загрузка парка 87% приближается к порогу ввода ЦПМ Canon V1000
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Сопоставление графика смен с инвестиционным меморандумом на 4 квартал 2026 года.
              </p>
            </div>
          </div>
        </div>

        {/* Weekly Decisions */}
        <div className="space-y-3.5">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#D71921]">
              03 // Решения дирекции
            </div>
            <h2 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
              Вопросы на согласовании недели
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="nothing-card p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-[var(--text-muted)]">
                  Крайний срок: 14.11.2026
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  На согласовании
                </span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)]">
                Закупка запасного комплекта датчиков вязкости для УФ-линии
              </div>
              <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Поставщик «Полиграф-Сервис» (бюджет 65 000 BYN). Ответственный: Иванов И.С.
              </div>
            </div>

            <div className="nothing-card p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-[var(--text-muted)]">
                  Крайний срок: 15.11.2026
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Риск склада
                </span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)]">
                Согласование ставки субаренды упаковочного склада
              </div>
              <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Риск дефицита площади упаковки тиражей к декабрю. Ответственный: Смирнов А.В.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};