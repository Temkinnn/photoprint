import React from 'react';
import { useApp } from '../context/AppContext';
import {
  CalendarDays,
  Search,
  Activity,
  CheckCircle,
  ShieldCheck,
  LogOut,
  RotateCcw,
  Sun,
  Moon,
  Server,
  RefreshCw
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    theme,
    toggleTheme,
    currentUser,
    activeTab,
    setActiveTab,
    tasks,
    logout,
    resetDemoData,
    backendOnline,
    isSyncing,
    syncWithBackend
  } = useApp();

  const activeTasksCount = tasks.filter((t) => t.status === 'active' || t.status === 'overdue').length;

  const navigation = [
    {
      id: 'meetings',
      label: 'Совещания',
      icon: CalendarDays,
    },
    {
      id: 'knowledge_base',
      label: 'База знаний',
      icon: Search,
    },
    {
      id: 'overview',
      label: 'Пульс компании',
      icon: Activity,
    },
    {
      id: 'tasks',
      label: 'Поручения',
      icon: CheckCircle,
      badge: activeTasksCount > 0 ? activeTasksCount : undefined,
    },
    {
      id: 'audit',
      label: 'Аудит действий',
      icon: ShieldCheck,
    },
  ];

  return (
    <aside className="w-60 bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800/80 flex flex-col justify-between select-none transition-colors">
      {/* Top Header */}
      <div>
        <div className="h-16 px-5 border-b border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center font-bold text-xs tracking-wider">
              ФП
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">Фотопринт</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400">AI-Ассистент</div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
              className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-md transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Reset Demo Button */}
            <button
              onClick={resetDemoData}
              title="Сбросить все задачи и логи к демо-состоянию"
              className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-neutral-800 dark:text-neutral-100 font-semibold shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-neutral-800 text-neutral-200 dark:bg-neutral-700 dark:text-neutral-200'
                        : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Backend Status & Profile Box */}
      <div>
        {/* Backend Connection Status */}
        <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-800/60 bg-neutral-100/50 dark:bg-neutral-900/40 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'
              }`}
            />
            <span className="truncate text-neutral-600 dark:text-neutral-400">
              {backendOnline ? 'API 127.0.0.1:8000' : 'Автономный режим'}
            </span>
          </div>
          <button
            onClick={syncWithBackend}
            title={backendOnline ? 'Синхронизировано с бэкендом (нажмите для проверки)' : 'Повторить подключение к бэкенду'}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Profile Box & Logout */}
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800/80 bg-neutral-50 dark:bg-neutral-900/30">
          <div className="px-2 py-1.5 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-200 truncate">{currentUser.name}</div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{currentUser.roleTitle}</div>
            </div>

            <button
              onClick={logout}
              title="Сменить роль / Выйти на экран авторизации"
              className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
