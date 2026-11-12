import React, { useState } from 'react';
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
  RefreshCw,
  BellRing,
  ArrowUpRight,
  X,
  Clock,
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
    scheduledMeetings,
    logout,
    resetDemoData,
    backendOnline,
    isSyncing,
    syncWithBackend,
    logAudit,
  } = useApp();

  const [isProactiveMenuOpen, setIsProactiveMenuOpen] = useState(false);
  const [activeBrief, setActiveBrief] = useState<{
    meetingTitle: string;
    time: string;
    agenda: string[];
    openTasksCount: number;
  } | null>(null);

  const activeTasksCount = tasks.filter(
    (t) => t.status === 'active' || t.status === 'overdue'
  ).length;
  const pendingInvitationsCount = invitations.filter(
    (inv) => inv.recipientRole === currentRole && inv.status === 'pending'
  ).length;

  const nextMeeting =
    scheduledMeetings.find((m) => m.status === 'scheduled') || {
      title: 'Синхронизация по выпуску тиража',
      time: '14:00 - 14:45',
      agenda: [
        '1. Контроль допуска Delta-E на ЦПМ HP Indigo 7900',
        '2. Статус перепечатки бракованных фотокниг picPac.by',
      ],
    };

  const triggerPreMeetingBrief = () => {
    setIsProactiveMenuOpen(false);
    setActiveBrief({
      meetingTitle: nextMeeting.title,
      time: nextMeeting.time.split('-')[0].trim(),
      agenda: nextMeeting.agenda.slice(0, 2),
      openTasksCount: activeTasksCount,
    });
    logAudit(
      'PROACTIVE_MEETING_BRIEF',
      `Meeting: ${nextMeeting.title}`,
      'SUCCESS',
      'Сработал триггер за 60 мин до встречи: сформирована сводка повестки и открытых задач.'
    );
  };

  const navigation = [
    {
      id: 'knowledge_base',
      label: 'База знаний',
      icon: Search,
    },
    {
      id: 'meetings',
      label: 'Совещания',
      icon: CalendarDays,
      badge: pendingInvitationsCount > 0 ? pendingInvitationsCount : undefined,
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
        return 'Допуск 1';
      case 'ROLE_PRODUCTION_HEAD':
        return 'Допуск 2';
      case 'ROLE_SUPPORT_HEAD':
        return 'Допуск 3';
      default:
        return 'Ограничен';
    }
  };

  return (
    <>
      <aside className="w-64 shrink-0 bg-[var(--bg-card)] border-r border-[var(--border-solid)] flex flex-col justify-between select-none transition-colors relative">
        <div>
          {/* Brand Header */}
          <div className="h-16 px-4 border-b border-[var(--border-solid)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-solid)] flex items-center justify-center shrink-0">
                <div className="grid grid-cols-2 gap-1 w-3.5 h-3.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A8E8]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D71921]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FBB03B]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)]" />
                </div>
              </div>

              <div>
                <div className="font-dot text-sm text-[var(--text-primary)] leading-none">
                  ФОТОПРИНТ
                </div>
                <div className="text-[11px] font-mono text-[var(--text-muted)] mt-1">
                  picPac.by
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Proactive Event Trigger Button (Slide 05) */}
              <button
                onClick={() => setIsProactiveMenuOpen((prev) => !prev)}
                title="Умные уведомления и триггеры встреч"
                className="relative w-8 h-8 rounded-lg border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center transition-colors"
              >
                <BellRing className="w-4 h-4" />
                <span className="w-2 h-2 rounded-full bg-[#D71921] absolute -top-0.5 -right-0.5" />
              </button>

              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                className="w-8 h-8 rounded-lg border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={resetDemoData}
                title="Сбросить демо-данные"
                className="w-8 h-8 rounded-lg border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Proactive Notification Popover */}
          {isProactiveMenuOpen && (
            <div className="mx-3 mt-3 p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-solid)] space-y-2.5 text-xs shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#D71921] font-semibold">
                  05 // УМНЫЕ УВЕДОМЛЕНИЯ
                </span>
                <button
                  onClick={() => setIsProactiveMenuOpen(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] leading-snug">
                Ближайшая встреча:{' '}
                <strong className="text-[var(--text-primary)]">{nextMeeting.title}</strong> (
                {nextMeeting.time})
              </div>
              <button
                onClick={triggerPreMeetingBrief}
                className="w-full py-2 px-3 rounded-lg bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold text-[11px] hover:opacity-90 transition-opacity"
              >
                Симулировать триггер (за 60 мин)
              </button>
            </div>
          )}

          {/* Navigation Section */}
          <div className="px-4 pt-6 pb-2 text-xs font-medium text-[var(--text-muted)]">
            Разделы
          </div>

          <nav className="px-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full h-9 px-3 rounded-lg text-xs flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold border border-[var(--border-solid)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/60 font-normal border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? 'bg-[#D71921]' : 'bg-transparent'
                      }`}
                    />
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded leading-none ${
                        isActive
                          ? 'bg-[#D71921] text-white font-medium'
                          : 'text-[var(--text-muted)]'
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

        {/* Footer Telemetry & Profile */}
        <div className="p-3 space-y-2 border-t border-[var(--border-solid)]">
          <div className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-solid)] flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  backendOnline ? 'bg-emerald-500' : 'bg-[#D71921]'
                }`}
              />
              <span className="truncate text-[var(--text-secondary)]">
                {backendOnline ? 'Сервер :8000' : 'Автономно'}
              </span>
            </div>
            <button
              onClick={syncWithBackend}
              title="Синхронизировать с сервером"
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-solid)] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                {currentUser.name}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[11px] text-[var(--text-secondary)] truncate">
                  {currentUser.department}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-solid)] shrink-0">
                  {getClearanceLevel(currentUser.role)}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              title="Сменить пользователя"
              className="w-8 h-8 rounded-lg border border-[var(--border-solid)] bg-[var(--bg-card)] hover:bg-[#D71921] hover:border-[#D71921] text-[var(--text-secondary)] hover:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Floating Proactive Pre-Meeting Brief Card (Slide 05) */}
      {activeBrief && (
        <div className="fixed top-5 right-5 z-50 max-w-md w-full nothing-card p-4 shadow-2xl border-[var(--text-primary)] space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D71921]" />
              <span className="font-mono text-[11px] font-semibold text-[#D71921]">
                ТРИГГЕР // ЗА 60 МИН ДО ВСТРЕЧИ
              </span>
            </div>
            <button
              onClick={() => setActiveBrief(null)}
              className="w-6 h-6 rounded hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>
                {activeBrief.time} (UTC+3) · {activeBrief.meetingTitle}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Встреча начнётся через один час. Подготовлена сводка контекста:
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-elevated)] space-y-1.5 text-xs">
            <div className="font-medium text-[var(--text-primary)]">
              Повестка и открытые задачи ({activeBrief.openTasksCount} в работе):
            </div>
            {activeBrief.agenda.map((item, i) => (
              <div key={i} className="text-[11px] text-[var(--text-secondary)]">
                {item}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setActiveBrief(null)}
              className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              Закрыть
            </button>
            <button
              onClick={() => {
                setActiveBrief(null);
                setActiveTab('meetings');
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] flex items-center gap-1"
            >
              <span>Открыть карточку встречи</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};