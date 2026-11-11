import React from 'react';
import { useApp } from '../context/AppContext';
import { Activity, RefreshCw } from 'lucide-react';

export const OverviewView: React.FC = () => {
  const { kpiMetrics, showToast } = useApp();

  const handleRefresh = () => {
    showToast('Данные обновлены', 'Показатели синхронизированы с локальными витринами', 'info');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-y-auto p-8 space-y-6 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800/80">
        <div>
          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            Пульс компании
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Ключевые показатели производства, качества и клиентского сервиса picPac.by
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Обновить
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-4 gap-4">
        {kpiMetrics.slice(0, 4).map((kpi) => (
          <div
            key={kpi.id}
            className="p-5 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between gap-3 shadow-sm"
          >
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{kpi.name}</div>

            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">{kpi.value}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">План: {kpi.target}</span>
            </div>

            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
              <span>{kpi.sourceSystem}</span>
              <span className={`font-medium ${kpi.status === 'normal' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {kpi.status === 'normal' ? 'В норме' : 'Отклонение'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 space-y-2 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Сводка по ситуации за неделю
        </h3>
        <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">
          Главное внимание требуется участку послепечатной обработки: из-за аварии датчика УФ-лакировки брак составил{' '}
          <strong>3.2%</strong> (выше планового порога 2.5%), сдача в срок упала до <strong>96.4%</strong>. Служба
          поддержки PicPac справляется со всплеском обращений с показателем SLA <strong>98.2%</strong>. Загрузка
          основных мощностей достигла <strong>87%</strong>, что подтверждает необходимость ввода ЦПМ Canon V1000 к 50-й
          неделе.
        </p>
      </div>

      {/* Critical Points */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Вопросы к решению
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1 shadow-sm">
            <div className="font-semibold text-neutral-900 dark:text-neutral-200">
              Закупка запасного комплекта датчиков вязкости для УФ-линии
            </div>
            <div className="text-neutral-500 dark:text-neutral-400">
              Ответственный: Иванов И.С. · Срок: 14.11.2026 · Поставщик «Полиграф-Сервис»
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1 shadow-sm">
            <div className="font-semibold text-neutral-900 dark:text-neutral-200">
              Согласование ставки субаренды упаковочного склада
            </div>
            <div className="text-neutral-500 dark:text-neutral-400">
              Ответственный: Смирнов А.В. · Срок: 15.11.2026 · Риск дефицита площади упаковки в декабре
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
