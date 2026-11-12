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
  RefreshCw,
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
  } = useApp();

  const activeTasksCount = tasks.filter(
    (t) => t.status === 'active' || t.status === 'overdue'
  ).length;
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
        return 'LVL-1 · ПОЛНЫЙ';
      case 'ROLE_PRODUCTION_HEAD':
        return 'LVL-2 · ЦЕХ';
      case 'ROLE_SUPPORT_HEAD':
        return 'LVL-3 · СЕРВИС';
      default:
        return 'LIMITED';
    }
  };

  return (
    <aside className="w-64 shrink-0 bg-[var(--bg-card)] border-r border-[var(--border-solid)] flex flex-col justify-between select-none transition-colors">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-dashed border-[var(--border-dashed)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* CMYK + Nothing Matrix Mark */}
            <div className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] flex items-center justify-center shrink-0">
              <div className="grid grid-cols-2 gap-1 w-3.5 h-3.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00A8E8]" title="Cyan" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#D71921]" title="Nothing Red / Magenta" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FBB03B]" title="Yellow" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)]" title="Key" />
              </div>
            </div>

            <div>
              <div className="font-dot text-sm tracking-wider text-[var(--text-primary)] uppercase leading-none">
                ФОТОПРИНТ
              </div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                PICPAC.BY // OS
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
              className="w-8 h-8 rounded-full border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all active:scale-95"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={resetDemoData}
              title="Сбросить демо-данные"
              className="w-8 h-8 rounded-full border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="px-4 pt-5 pb-2 text-[10px] font-dot uppercase tracking-widest text-[var(--text-muted)]">
          Модули системы
        </div>

        <nav className="px-3 space-y-1.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-full text-xs flex items-center justify-between transition-all ${
                  isActive
                    ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] font-medium'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      isActive ? 'bg-[#D71921]' : 'bg-transparent'
                    }`}
                  />
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`font-dot text-[11px] px-2 py-0.5 rounded-full leading-none ${
                      isActive
                        ? 'bg-[#D71921] text-white'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-solid)]'
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

      {/* Bottom Server Telemetry & User Profile */}
      <div className="p-3 space-y-2.5 border-t border-dashed border-[var(--border-dashed)]">
        {/* Server Status Pill */}
        <div className="px-3.5 py-2 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-[#D71921]'
              }`}
            />
            <span className="truncate text-[var(--text-secondary)]">
              {backendOnline ? 'NODE :8000 ONLINE' : 'OFFLINE MODE'}
            </span>
          </div>
          <button
            onClick={syncWithBackend}
            title="Синхронизировать с сервером"
            className="p-1 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* User Profile Capsule */}
        <div className="p-3 rounded-[18px] bg-[var(--bg-elevated)] border border-[var(--border-solid)] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {currentUser.name}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-[var(--text-secondary)] truncate">
                {currentUser.department}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-solid)] shrink-0">
                {getClearanceLevel(currentUser.role)}
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            title="Сменить роль / Выйти"
            className="w-8 h-8 rounded-full border border-[var(--border-solid)] bg-[var(--bg-card)] hover:bg-[#D71921] hover:border-[#D71921] text-[var(--text-secondary)] hover:text-white flex items-center justify-center transition-all shrink-0 active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
