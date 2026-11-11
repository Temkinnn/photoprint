import React from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import {
  Building2,
  HardHat,
  Headphones,
  RotateCcw,
  Sun,
  Moon,
  Shield,
  Activity,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export const TopBar: React.FC = () => {
  const {
    currentRole,
    currentUser,
    setRole,
    resetDemoData,
    theme,
    toggleTheme,
    backendOnline,
    activeTab
  } = useApp();

  const roleConfigs: {
    role: UserRole;
    label: string;
    clearance: string;
    icon: React.ReactNode;
  }[] = [
    {
      role: 'ROLE_DIRECTOR',
      label: 'Директор',
      clearance: 'Допуск 1',
      icon: <Building2 className="w-3.5 h-3.5 text-emerald-500" />
    },
    {
      role: 'ROLE_PRODUCTION_HEAD',
      label: 'Нач. цеха',
      clearance: 'Допуск 2',
      icon: <HardHat className="w-3.5 h-3.5 text-amber-500" />
    },
    {
      role: 'ROLE_SUPPORT_HEAD',
      label: 'Сервис picPac',
      clearance: 'Допуск 3',
      icon: <Headphones className="w-3.5 h-3.5 text-sky-500" />
    }
  ];

  const TAB_TITLES: Record<string, { title: string; category: string }> = {
    meeting_prep: { title: 'Подготовка встречи', category: 'Операционные процессы' },
    meeting_schedule: { title: 'Создание встречи', category: 'Операционные процессы' },
    meeting_protocol: { title: 'Протокол и summary', category: 'Операционные процессы' },
    tasks: { title: 'Реестр задач', category: 'Операционные процессы' },
    knowledge_base: { title: 'База знаний', category: 'Регламенты и RAG' },
    overview: { title: 'Пульс компании', category: 'Управленческий обзор' },
    audit: { title: 'Журнал аудита', category: 'Информационная безопасность' }
  };

  const currentTabInfo = TAB_TITLES[activeTab] || { title: 'Рабочее пространство', category: 'Система' };

  return (
    <header className="h-14 bg-white dark:bg-[#13151b] border-b border-neutral-200 dark:border-[#212530] px-5 flex items-center justify-between shrink-0 select-none transition-colors z-20">
      {/* Left: Breadcrumbs & Active Module */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500 hidden sm:inline">
          {currentTabInfo.category}
        </span>
        <span className="text-neutral-300 dark:text-neutral-600 hidden sm:inline">/</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-500 ring-2 ring-sky-500/20" />
          <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
            {currentTabInfo.title}
          </span>
        </div>
      </div>

      {/* Center: Live Role Switcher (RBAC) */}
      <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#191c25] p-1 rounded-lg border border-neutral-200 dark:border-[#262b3a]">
        <div className="px-2 text-[10px] font-mono text-neutral-400 dark:text-neutral-500 hidden md:flex items-center gap-1">
          <Shield className="w-3 h-3 text-sky-500" />
          <span>Роль:</span>
        </div>
        {roleConfigs.map((cfg) => {
          const isActive = currentRole === cfg.role;
          return (
            <button
              key={cfg.role}
              onClick={() => setRole(cfg.role)}
              title={`Переключить роль на «${currentUser.name}» (${cfg.clearance})`}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-white dark:bg-[#252a37] text-neutral-950 dark:text-white shadow-sm border border-neutral-200 dark:border-[#32394a] font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {cfg.icon}
              <span className="text-[11px]">{cfg.label}</span>
              <span
                className={`text-[9px] font-mono px-1 py-0.2 rounded hidden lg:inline ${
                  isActive
                    ? 'bg-neutral-100 dark:bg-[#1a1d26] text-neutral-700 dark:text-neutral-300'
                    : 'text-neutral-400'
                }`}
              >
                {cfg.clearance}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: AI & DB Status, Theme, Reset */}
      <div className="flex items-center gap-2.5">
        {/* Backend & AI indicator */}
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded bg-neutral-50 dark:bg-[#171922] border border-neutral-200 dark:border-[#252a38] text-[10px] font-mono">
          <span className="flex h-1.5 w-1.5 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${backendOnline ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${backendOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>
          <span className="text-neutral-600 dark:text-neutral-300">
            {backendOnline ? 'PostgreSQL :5432 · Qwen 2.5 · Whisper' : 'Автономный режим'}
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-[#1a1d25] rounded-md transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Reset Demo Data Button */}
        <button
          onClick={resetDemoData}
          title="Сбросить все данные стенда к эталонному состоянию"
          className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-[#1a1d25] rounded-md transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* User Avatar Mini Badge */}
        <div className="flex items-center gap-2 pl-1 border-l border-neutral-200 dark:border-[#242938]">
          <div className="w-7 h-7 rounded-full bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30 flex items-center justify-center font-bold text-xs">
            {currentUser.avatarInitials}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-[11px] font-semibold text-neutral-900 dark:text-neutral-100 leading-none">
              {currentUser.name.split(' ')[0]} {currentUser.name.split(' ')[1]?.[0]}.
            </div>
            <div className="text-[9px] text-neutral-400 font-mono mt-0.5">
              {currentUser.department.split(' ')[0]}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
