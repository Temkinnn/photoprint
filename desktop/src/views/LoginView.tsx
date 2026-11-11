import React from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { Building2, HardHat, Headphones, ArrowRight, ShieldCheck, Sun, Moon } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginAs, theme, toggleTheme } = useApp();

  const users: {
    role: UserRole;
    name: string;
    title: string;
    department: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      role: 'ROLE_DIRECTOR',
      name: 'Смирнов Алексей Викторович',
      title: 'Генеральный директор',
      department: 'Дирекция',
      description: 'Полный доступ ко всей отчетности: финансовые планы, маржинальность, фонд окладов, цех и клиентский сервис.',
      icon: <Building2 className="w-5 h-5 text-neutral-800 dark:text-neutral-100" />,
    },
    {
      role: 'ROLE_PRODUCTION_HEAD',
      name: 'Иванов Игорь Сергеевич',
      title: 'Начальник производства',
      department: 'Производственный цех',
      description: 'Доступ к техкартам станков, нормативам брака, графикам смен и оборудованию. Финансовая тайна закрыта.',
      icon: <HardHat className="w-5 h-5 text-neutral-800 dark:text-neutral-100" />,
    },
    {
      role: 'ROLE_SUPPORT_HEAD',
      name: 'Ковалева Елена Дмитриевна',
      title: 'Руководитель клиентского сервиса',
      department: 'Служба заботы picPac.by',
      description: 'Доступ к рекламациям, стандартам SLA, возвратам заказов и модерации фотопродуктов.',
      icon: <Headphones className="w-5 h-5 text-neutral-800 dark:text-neutral-100" />,
    },
  ];

  return (
    <div className="h-screen w-screen bg-[#f6f8fb] dark:bg-[#090c13] flex flex-col items-center justify-center p-6 select-none relative overflow-hidden transition-colors duration-200">
      {/* Antigravity Ambient Glass Orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-[30rem] h-[30rem] bg-blue-500/[0.08] dark:bg-blue-600/[0.08] rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-[30rem] h-[30rem] bg-indigo-500/[0.08] dark:bg-indigo-600/[0.08] rounded-full blur-[140px]" />

      {/* Theme Toggle Top Right */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          className="p-2.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 bg-white/70 dark:bg-white/[0.05] hover:bg-white dark:hover:bg-white/[0.1] backdrop-blur-xl border border-black/[0.07] dark:border-white/[0.08] rounded-xl transition-all shadow-sm"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="max-w-3xl w-full space-y-8 animate-in fade-in zoom-in-95 duration-200 relative z-10">
        {/* Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 dark:bg-white/[0.05] backdrop-blur-xl border border-black/[0.07] dark:border-white/[0.08] text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
            Локальный защищенный контур (On-Premise)
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Фотопринт · AI-Ассистент руководителя
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
            Выберите роль для авторизации и проверки разграничения прав доступа (RBAC)
          </p>
        </div>

        {/* 3 User Profile Cards */}
        <div className="grid grid-cols-3 gap-4">
          {users.map((u) => (
            <div
              key={u.role}
              onClick={() => loginAs(u.role)}
              className="bg-white/75 dark:bg-[#0f1420]/65 hover:bg-white dark:hover:bg-[#131926]/85 backdrop-blur-xl border border-black/[0.07] dark:border-white/[0.08] hover:border-black/20 dark:hover:border-white/20 rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-sm hover:shadow-lg dark:hover:shadow-black/40 group"
            >
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center">
                  {u.icon}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-black dark:group-hover:text-white">
                    {u.name}
                  </h3>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 font-medium">{u.title}</div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-500">{u.department}</div>
                </div>

                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
                  {u.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300 group-hover:text-black dark:group-hover:text-white">
                <span>Войти в систему</span>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-black dark:group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-neutral-500 dark:text-neutral-500">
          ООО «Фотопринт» · Все данные обрабатываются на локальном сервере предприятия
        </div>
      </div>
    </div>
  );
};
