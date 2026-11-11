import React from 'react';
import { useApp } from '../context/AppContext';
import { Calendar, BookOpen, BarChart3, CheckSquare, ShieldCheck, ChevronRight } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, tasks, auditLogs } = useApp();

  const pendingOrActiveTasks = tasks.filter((t) => t.status === 'active' || t.status === 'overdue').length;

  const navItems = [
    {
      id: 'meetings',
      label: 'Встречи и протоколы',
      icon: <Calendar className="w-4 h-4" />,
      description: 'Повестка, расшифровки, Draft & Review',
    },
    {
      id: 'knowledge_base',
      label: 'База регламентов (RAG)',
      icon: <BookOpen className="w-4 h-4" />,
      description: 'Поиск с RBAC и цитированием',
    },
    {
      id: 'overview',
      label: 'Управленческий пульс',
      icon: <BarChart3 className="w-4 h-4" />,
      description: 'KPI компании, брак, SLA, сроки',
    },
    {
      id: 'tasks',
      label: 'Реестр поручений',
      icon: <CheckSquare className="w-4 h-4" />,
      description: 'Контроль исполнительской дисциплины',
      badge: pendingOrActiveTasks > 0 ? pendingOrActiveTasks : undefined,
    },
    {
      id: 'audit',
      label: 'Журнал аудита (ОТ-04)',
      icon: <ShieldCheck className="w-4 h-4" />,
      description: 'Безопасность и фиксация действий',
      badge: auditLogs.length,
      badgeColor: 'bg-slate-800 text-slate-300',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900/40 border-r border-slate-800 flex flex-col justify-between p-3 select-none">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Разделы управления
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors group ${
                isActive
                  ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'}>
                  {item.icon}
                </span>
                <div>
                  <div className="font-semibold">{item.label}</div>
                  <div className="text-[10px] text-slate-400 font-normal line-clamp-1">{item.description}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.badgeColor || 'bg-blue-600/30 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                <ChevronRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100 text-blue-400' : 'text-slate-400'}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Info Box */}
      <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg text-[11px] text-slate-400 space-y-1">
        <div className="font-medium text-slate-300">Трек 3: AI-Ассистент</div>
        <div className="text-[10px] text-slate-400 leading-relaxed">
          Автономное локальное рабочее место. Все действия сохраняются в локальном аудите.
        </div>
      </div>
    </aside>
  );
};
