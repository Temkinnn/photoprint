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
  RefreshCw,
  Mic,
  CheckCircle2,
  X
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    theme,
    toggleTheme,
    currentUser,
    currentRole,
    activeTab,
    setActiveTab,
    tasks,
    invitations,
    logout,
    resetDemoData,
    backendOnline,
    isSyncing,
    syncWithBackend,
    audioJob,
    clearAudioJob
  } = useApp();

  const activeTasksCount = tasks.filter((t) => t.status === 'active' || t.status === 'overdue').length;
  const pendingInvitationsCount = invitations.filter(
    (inv) => inv.recipientRole === currentRole && inv.status === 'pending'
  ).length;

  const navigation = [
    {
      id: 'meetings',
      label: 'Совещания',
      icon: CalendarDays,
      badge: pendingInvitationsCount > 0 ? pendingInvitationsCount : undefined,
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

  const getClearanceLevel = (role: string) => {
    switch (role) {
      case 'ROLE_DIRECTOR':
        return 'Допуск 1 (Полный)';
      case 'ROLE_PRODUCTION_HEAD':
        return 'Допуск 2 (Цех)';
      case 'ROLE_SUPPORT_HEAD':
        return 'Допуск 3 (Сервис)';
      default:
        return 'Ограниченный';
    }
  };

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-[#13151b] border-r border-neutral-200 dark:border-[#212530] flex flex-col justify-between select-none transition-colors">
      {/* Top Header with Authentic Print Brand Mark */}
      <div>
        <div className="h-16 px-4 border-b border-neutral-200 dark:border-[#212530] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* CMYK Registration Mark Icon */}
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-[#1a1d25] border border-neutral-200 dark:border-[#2a2f3d] flex items-center justify-center p-1.5 shrink-0 relative group">
              <div className="grid grid-cols-2 gap-1 w-4 h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a8e8]" title="Cyan" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#e02874]" title="Magenta" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#fbb03b]" title="Yellow" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#111318] dark:bg-white" title="Key (Black)" />
              </div>
            </div>

            <div>
              <div className="text-xs font-bold tracking-tight text-neutral-900 dark:text-neutral-100 uppercase">
                Фотопринт
              </div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                Система управления
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
              className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-[#1a1d25] rounded-md transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Reset Demo Button */}
            <button
              onClick={resetDemoData}
              title="Сбросить все данные к исходному демо-состоянию"
              className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-[#1a1d25] rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Section Label */}
        <div className="px-4 pt-4 pb-1.5 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 tracking-wider uppercase font-mono">
          Модули цеха и дирекции
        </div>

        {/* Navigation Menu */}
        <nav className="px-2 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between transition-colors relative ${
                  isActive
                    ? 'bg-neutral-100 dark:bg-[#1b1f29] text-neutral-950 dark:text-white font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r before:bg-sky-500'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-[#161820]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600 dark:text-sky-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      isActive
                        ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-200 font-semibold'
                        : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400'
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
        {/* Persistent Background Whisper Job Indicator */}
        {audioJob && (
          <div
            className={`mx-2 mb-2 p-2.5 rounded-md border text-[11px] space-y-1.5 ${
              audioJob.status === 'transcribing'
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-900 dark:text-sky-200'
                : audioJob.status === 'ready'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 font-semibold min-w-0">
                {audioJob.status === 'transcribing' ? (
                  <Mic className="w-3.5 h-3.5 text-sky-500 animate-pulse shrink-0" />
                ) : audioJob.status === 'ready' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                )}
                <span className="truncate">
                  {audioJob.status === 'transcribing'
                    ? 'Whisper распознаёт...'
                    : audioJob.status === 'ready'
                    ? 'Расшифровка готова'
                    : 'Ошибка Whisper'}
                </span>
              </div>
              {audioJob.status !== 'transcribing' && (
                <button
                  onClick={clearAudioJob}
                  title="Скрыть"
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="truncate font-mono text-[10px] opacity-80" title={audioJob.filename}>
              {audioJob.filename}
            </div>
            {audioJob.status === 'error' && audioJob.error && (
              <div className="text-[10px] opacity-90 line-clamp-2">{audioJob.error}</div>
            )}
            <button
              onClick={() => setActiveTab('meetings')}
              className={`w-full py-1 px-2 rounded text-[10px] font-semibold transition-colors ${
                audioJob.status === 'ready'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-white/70 dark:bg-[#1a1d25] hover:bg-white dark:hover:bg-[#222632] text-current border border-current/20'
              }`}
            >
              {audioJob.status === 'ready' ? 'Открыть и запустить анализ' : 'Перейти к встрече'}
            </button>
          </div>
        )}

        {/* Backend Hardware / API Connection Status */}
        <div className="px-4 py-2 border-t border-neutral-200 dark:border-[#212530] bg-neutral-50/60 dark:bg-[#101217] flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                backendOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-neutral-400'
              }`}
            />
            <span className="truncate text-neutral-600 dark:text-neutral-400 text-[11px]">
              {backendOnline ? 'Сервер онлайн :8000' : 'Автономный режим'}
            </span>
          </div>
          <button
            onClick={syncWithBackend}
            title={backendOnline ? 'Синхронизировано (нажмите для проверки)' : 'Повторить подключение к бэкенду'}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Profile Box & Logout */}
        <div className="p-3 border-t border-neutral-200 dark:border-[#212530] bg-white dark:bg-[#13151b]">
          <div className="px-2 py-1.5 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-200 truncate">{currentUser.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">{currentUser.department}</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  {getClearanceLevel(currentUser.role)}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              title="Сменить роль / Выйти на экран авторизации"
              className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-[#1c202a] rounded-md transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
