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
  Calendar,
  Clock,
  Activity,
  FileText
} from 'lucide-react';

interface MetricDetail {
  formula: string;
  system: string;
  explanation: string;
}

const METRIC_DETAILS: Record<string, MetricDetail> = {
  'kpi-1': {
    formula: '(Кол-во заказов, отгруженных вовремя / Всего заказов за смену) × 100%',
    system: 'ERP Цеха / Модуль диспетчеризации отгрузок',
    explanation: 'Отклонение на 1.6% от целевого норматива 98% вызвано задержкой переналадки ламинатора Foliant и аварией датчика лака.'
  },
  'kpi-2': {
    formula: '(Листы оттисков с браком лака и сборки / Общий объем тиража) × 100%',
    system: 'ERP / Отдел технического контроля (ОТК)',
    explanation: 'Превышение критического порога 2.5% связано со сбоем оптического датчика вязкости УФ-лака. Требуется замена датчика.'
  },
  'kpi-3': {
    formula: '(Обращения клиентов с ответом до 15 минут / Все поступившие тикеты) × 100%',
    system: 'CRM picPac.by / Омниканальная поддержка',
    explanation: 'Показатель в норме (+3.2% выше целевого). Нагрузка на операторов стабильная, но к декабрю потребуется усиление штата.'
  },
  'kpi-4': {
    formula: '(Фактически отработанные машино-часы / Доступный фонд времени машин) × 100%',
    system: 'ERP / SCADA телеметрия оборудования цеха',
    explanation: 'Загрузка 87% превышает комфортные 80–85%. Риск дефицита мощностей в новогодний пик (необходим ввод машины Canon V1000).'
  },
  'kpi-5': {
    formula: 'Суммарная выручка заказов приложения / Общее число оплаченных корзин',
    system: '1С:Управление торговлей / Сервис фотокниг PicPac',
    explanation: 'Превышает плановый ориентир 1 350 ₽ благодаря росту продаж премиальных фотокниг и фотобоксов с тиснением фольгой.'
  },
  'kpi-6': {
    formula: '(Вышедшие в смену печатники и постпечатники / Штатное расписание) × 100%',
    system: '1С:ЗУП (Зарплата и управление персоналом)',
    explanation: '100% укомплектованность дневной и ночной смен. Больничных и прогулов ключевых операторов ЦПМ не зафиксировано.'
  }
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
    overviewBrief,
    scheduledMeetings
  } = useApp();

  const [dataFreshnessTime, setDataFreshnessTime] = useState<string>('2026-11-11 15:00:00');
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

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
      'Оперативная сводка',
      'SUCCESS',
      `Синхронизированы 6 витрин KPI и ${overdueTasks.length} просроченных поручений (Сервер: ${backendOnline ? 'онлайн' : 'офлайн'})`
    );

    showToast(
      backendOnline ? 'Данные синхронизированы' : 'Сервер недоступен',
      `Время актуальности среза: ${formatted}`,
      backendOnline ? 'info' : 'error'
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

  const activeMetricDetail = selectedMetricId ? METRIC_DETAILS[selectedMetricId] : null;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] dark:bg-[#0c0d12] overflow-y-auto p-6 lg:p-8 transition-colors">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* ========================================================================= */}
        {/* TOP CONTROL BAR & EXECUTIVE TITLE                                         */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-[#212530] flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
              <h1 className="text-base font-bold text-neutral-950 dark:text-white tracking-tight">
                Пульс компании: Производство, Сервис и Финансы
              </h1>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Краткая сводка KPI, оперативный контроль ключевых витрин выработки и исполнение решений
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Актуальность данных
              </div>
              <div className="text-xs font-mono font-medium text-neutral-900 dark:text-neutral-200 tabular-nums">
                {overviewBrief?.dataFreshness || dataFreshnessTime}
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200 bg-white dark:bg-[#161820] hover:bg-neutral-100 dark:hover:bg-[#1e222b] border border-neutral-200 dark:border-[#262a36] rounded transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-neutral-500 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Синхронизация...' : 'Синхронизировать'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CONSOLIDATED KPI INSTRUMENTATION DECK                                     */}
        {/* ========================================================================= */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              Сводка ключевых параметров производства и сервиса
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              Кликните на карточку для просмотра формулы и контура учета
            </span>
          </div>

          {kpiMetrics.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-[#212530] bg-white dark:bg-[#13151b]">
              Загрузка витрин KPI...
            </div>
          ) : (
            <div className="border border-neutral-200 dark:border-[#212530] bg-white dark:bg-[#13151b] rounded-lg overflow-hidden grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 dark:divide-[#212530]">
              {kpiMetrics.map((kpi) => {
                const isNormal = kpi.status === 'normal';
                const isCritical = kpi.status === 'critical';
                const isSelected = selectedMetricId === kpi.id;

                return (
                  <div
                    key={kpi.id}
                    onClick={() => setSelectedMetricId(isSelected ? null : kpi.id)}
                    className={`p-3.5 flex flex-col justify-between gap-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-neutral-100 dark:bg-[#1c1f2b] ring-2 ring-sky-500 dark:ring-sky-400'
                        : 'hover:bg-neutral-50/70 dark:hover:bg-[#181a22]'
                    }`}
                    title="Нажмите для просмотра формулы и контура учета"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 truncate" title={kpi.name}>
                        {kpi.name}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isNormal
                            ? 'bg-emerald-500'
                            : isCritical
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}
                        title={isNormal ? 'Норма' : isCritical ? 'Превышение' : 'Отклонение'}
                      />
                    </div>

                    <div className="my-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono tracking-tight tabular-nums text-neutral-950 dark:text-white">
                          {kpi.value}
                        </span>
                        {kpi.trend === 'up' ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : kpi.trend === 'down' ? (
                          <TrendingDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Minus className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                        Цель: {kpi.target}
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-neutral-400 pt-1.5 border-t border-neutral-100 dark:border-[#1d2028] flex items-center justify-between">
                      <span className="truncate">{kpi.sourceSystem.split('/')[0]}</span>
                      <span className="shrink-0">{kpi.updatedAt.split(' ')[1]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Metric Inspector Breakdown */}
          {selectedMetricId && activeMetricDetail && (
            <div className="p-4 rounded-lg bg-sky-500/[0.04] dark:bg-sky-500/[0.08] border border-sky-500/30 text-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-950 dark:text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Паспорт показателя: {kpiMetrics.find(m => m.id === selectedMetricId)?.name}</span>
                </span>
                <button
                  onClick={() => setSelectedMetricId(null)}
                  className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                >
                  Закрыть
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[10px] font-mono text-neutral-400">Контур учета:</div>
                  <div className="text-neutral-900 dark:text-neutral-100 font-medium text-[11px]">{activeMetricDetail.system}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-neutral-400">Формула расчета:</div>
                  <div className="font-mono text-neutral-900 dark:text-neutral-100 text-[11px]">{activeMetricDetail.formula}</div>
                </div>
              </div>

              <div className="text-[11px] text-neutral-600 dark:text-neutral-300 pt-1 border-t border-sky-500/20">
                <strong>Аналитический комментарий:</strong> {activeMetricDetail.explanation}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* OVERDUE ACTION LEDGER                                                     */}
        {/* ========================================================================= */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                Контроль неисполненных решений
              </span>
              {overdueTasks.length > 0 && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                  {overdueTasks.length} требуют закрытия
                </span>
              )}
            </div>
            <span className="text-[11px] text-neutral-400 font-mono">
              Поручения с истекшим сроком исполнения
            </span>
          </div>

          {overdueTasks.length === 0 ? (
            <div className="p-3.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-2.5">
              <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong>Все обязательства в графике:</strong> Просроченных решений не зафиксировано.
              </span>
            </div>
          ) : (
            <div className="border border-neutral-200 dark:border-[#212530] bg-white dark:bg-[#13151b] rounded-lg divide-y divide-neutral-200 dark:divide-[#212530] overflow-hidden">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50/50 dark:hover:bg-[#171922] transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate" title={task.title}>
                        {task.title}
                      </h3>
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 shrink-0">
                        {task.deadline}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-600 dark:text-neutral-400 italic pl-3 border-l border-neutral-200 dark:border-neutral-800 line-clamp-1">
                      «{task.sourceQuote}»
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 pl-3">
                      <span className="text-neutral-800 dark:text-neutral-200 font-medium">{task.assigneeName}</span>
                      {task.meetingTitle && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[10px] text-neutral-400">{task.meetingTitle}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <button
                      onClick={() => handleResolveOverdue(task)}
                      title="Закрыть поручение прямо из дашборда"
                      className="px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800/80 rounded transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Закрыть поручение</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* EXECUTIVE SITUATION BRIEF                                                 */}
        {/* ========================================================================= */}
        <div className="p-4 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] border-l-4 border-l-sky-500 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-500" />
              <span>Оперативная сводка дирекции</span>
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              Срез производственного дня · Актуальность {overviewBrief?.dataFreshness || dataFreshnessTime}
            </span>
          </div>

          {overviewBrief ? (
            <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans">
              {overviewBrief.situationBrief}
            </p>
          ) : (
            <div className="py-2 text-xs text-neutral-400 animate-pulse">
              Загрузка аналитической сводки...
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* CRITICAL OPERATIONAL DECISIONS                                            */}
        {/* ========================================================================= */}
        {overviewBrief && overviewBrief.criticalIssues && overviewBrief.criticalIssues.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                Вопросы к согласованию на этой неделе
              </span>
              <span className="text-[11px] text-neutral-400 font-mono">Сроки поставки и производственные риски</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {overviewBrief.criticalIssues.map((issue) => (
                <div key={issue.id} className="p-3.5 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] text-xs space-y-1.5">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {issue.title}
                  </div>
                  <div className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[11px]">
                    {issue.description}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-400 pt-1 border-t border-neutral-100 dark:border-[#1d2028]">
                    Крайний срок: {issue.deadline}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCHEDULED MEETINGS & CALENDAR PULSE                                       */}
        {/* ========================================================================= */}
        {scheduledMeetings && scheduledMeetings.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                  Ближайшие запланированные совещания
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                  {scheduledMeetings.filter((m) => m.status === 'scheduled').length} назначено
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 font-mono">
                Календарь встреч ООО «Фотопринт»
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scheduledMeetings.slice(0, 4).map((meeting) => (
                <div
                  key={meeting.id}
                  className="p-3.5 rounded-lg border border-neutral-200 dark:border-[#212530] bg-white dark:bg-[#13151b] flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                      {meeting.title}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                        meeting.status === 'scheduled'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                      }`}
                    >
                      {meeting.status === 'scheduled' ? 'Запланировано' : 'Завершено'}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-neutral-400" />
                      {meeting.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-400" />
                      {meeting.time}
                    </span>
                  </div>

                  {meeting.agenda && meeting.agenda.length > 0 && (
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2 bg-neutral-50 dark:bg-[#171922] p-2 rounded border border-neutral-100 dark:border-[#222633]">
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">Повестка: </span>
                      {meeting.agenda.join('; ')}
                    </div>
                  )}

                  <div className="text-[10px] text-neutral-400 truncate">
                    Участники: {(meeting.participants || []).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
