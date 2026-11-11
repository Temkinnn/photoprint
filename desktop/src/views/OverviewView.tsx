import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart3, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

export const OverviewView: React.FC = () => {
  const { kpiMetrics, logAudit, showToast } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    logAudit('REFRESH_OVERVIEW', 'Executive Dashboard', 'SUCCESS', 'Обновлена витрина метрик ERP, CRM, 1C');
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Сводка обновлена', 'Актуальные срезы KPI загружены из локальных витрин', 'success');
    }, 600);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-6 space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <div className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Сценарий 6: Управленческий пульс компании (Executive Overview)
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Сводный срез ключевых показателей производства, клиентского сервиса picPac.by и финансов
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          Обновить витрину
        </button>
      </div>

      {/* AI Executive Summary Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Оперативное заключение AI-ассистента:
          </div>
          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Актуально на: 11.11.2026, 14:30 МСК
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-4 rounded-lg border border-slate-800/80">
          Ключевым риском текущей недели является рост уровня брака до <strong>3.2%</strong> (целевой лимит &lt; 2.5%) вследствие технологического сбоя узла УФ-лакировки. Своевременность заказов снизилась до <strong>96.4%</strong>. Служба заботы PicPac держит высокий показатель SLA <strong>98.2%</strong> (первый ответ за 3.8 мин). Загрузка печатных мощностей достигла <strong>87%</strong>, что указывает на необходимость ввода новой ЦПМ Canon V1000 до начала пикового спроса на 50-й неделе года.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div>
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          Метрики интегрированного контура (ERP, CRM, 1С)
        </div>

        <div className="grid grid-cols-3 gap-4">
          {kpiMetrics.map((kpi) => {
            let statusColor = 'border-slate-800 bg-slate-900/50';
            let badgeBg = 'bg-slate-800 text-slate-300';

            if (kpi.status === 'normal') {
              statusColor = 'border-emerald-500/30 bg-emerald-950/10';
              badgeBg = 'bg-emerald-500/20 text-emerald-300';
            } else if (kpi.status === 'warning') {
              statusColor = 'border-amber-500/30 bg-amber-950/10';
              badgeBg = 'bg-amber-500/20 text-amber-300';
            } else if (kpi.status === 'critical') {
              statusColor = 'border-rose-500/40 bg-rose-950/15';
              badgeBg = 'bg-rose-500/20 text-rose-300';
            }

            return (
              <div
                key={kpi.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 shadow-sm ${statusColor}`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span className="font-medium line-clamp-1">{kpi.sourceSystem}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeBg}`}>
                      {kpi.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200 line-clamp-1">{kpi.name}</div>
                </div>

                <div className="flex items-baseline justify-between pt-2 border-t border-slate-800/60">
                  <div className="text-2xl font-bold text-slate-100 tracking-tight">{kpi.value}</div>
                  <div className="text-[11px] text-slate-400 font-mono">План: {kpi.target}</div>
                </div>

                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                  <span>Обновлено: {kpi.updatedAt}</span>
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    {kpi.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-blue-400" />}
                    {kpi.trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-amber-400" />}
                    {kpi.trend === 'stable' && <Minus className="w-3.5 h-3.5 text-slate-400" />}
                    Динамика
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical Bottlenecks & Overdue Decisions */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Реестр критических отклонений и требующих внимания вопросов:
        </div>

        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-4 text-xs">
            <div>
              <div className="font-semibold text-slate-200">
                Срочная закупка запасного датчика вязкости для УФ-лакировки
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Ответственный: Иванов И.С. · Срок: 14.11.2026 · Основание: Протокол производственной планерки
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
              В РАБОТЕ
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-4 text-xs">
            <div>
              <div className="font-semibold text-slate-200">
                Сверка взаиморасчетов с поставщиком картона «Балтика-Пак»
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Ответственный: Смирнов А.В. · Срок: 09.11.2026 (ПРОСРОЧЕНО на 2 дня)
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
              ПРОСРОЧЕНО
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
