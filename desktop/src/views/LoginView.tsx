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
    clearance: string;
    department: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      role: 'ROLE_DIRECTOR',
      name: 'Смирнов Алексей Викторович',
      title: 'Генеральный директор',
      clearance: 'Допуск 1 · Полный',
      department: 'Дирекция',
      description: 'Полный доступ ко всей отчетности: финансовые планы, маржинальность, фонд окладов, цех и клиентский сервис.',
      icon: <Building2 className="w-5 h-5 text-neutral-800 dark:text-neutral-100" />,
    },
    {
      role: 'ROLE_PRODUCTION_HEAD',
      name: 'Иванов Игорь Сергеевич',
      title: 'Начальник производства',
      clearance: 'Допуск 2 · Цех',
      department: 'Производственный цех',
      description: 'Доступ к техкартам станков, нормативам брака, графикам смен и оборудованию. Финансовая тайна закрыта.',
      icon: <HardHat className="w-5 h-5 text-neutral-800 dark:text-neutral-100" />,
    },
    {
      role: 'ROLE_SUPPORT_HEAD',
      name: 'Ковалева Елена Дмитриевна',
      title: 'Руководитель клиентского сервиса',
      clearance: 'Допуск 3 · Сервис',
      department: 'Служба заботы picPac.by',
      description: 'Доступ к рекламациям, стандартам SLA, возвратам заказов и модерации фотопродуктов.',
      icon: <Headphones className="w-5 h-5 text-neutral-800 dark:text-neutral-100" />,
    },
  ];

  return (
    <div className="h-screen w-screen bg-[#f6f7f9] dark:bg-[#0c0d12] flex flex-col items-center justify-center p-6 select-none relative transition-colors">
      {/* Theme Toggle Top Right */}
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 bg-white dark:bg-[#15171e] border border-neutral-200 dark:border-[#252936] rounded-md transition-colors shadow-sm"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="max-w-3xl w-full space-y-7 animate-in fade-in duration-200">
        {/* Header with CMYK Print Identity */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#232733] text-xs font-mono text-neutral-600 dark:text-neutral-300">
            <div className="grid grid-cols-2 gap-0.5 w-2.5 h-2.5">
              <span className="w-1 h-1 rounded-full bg-[#00a8e8]" />
              <span className="w-1 h-1 rounded-full bg-[#e02874]" />
              <span className="w-1 h-1 rounded-full bg-[#fbb03b]" />
              <span className="w-1 h-1 rounded-full bg-neutral-900 dark:bg-white" />
            </div>
            <span>Локальный контур предприятия</span>
          </div>

          <h1 className="text-xl font-bold text-neutral-950 dark:text-white tracking-tight">
            Фотопринт · Управление производством
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
            Выберите учетную запись для входа в систему и применения матрицы доступа (RBAC)
          </p>
        </div>

        {/* 3 User Profile Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {users.map((u) => (
            <div
              key={u.role}
              onClick={() => loginAs(u.role)}
              className="bg-white dark:bg-[#14161c] hover:bg-neutral-50 dark:hover:bg-[#191c24] border border-neutral-200 dark:border-[#222631] hover:border-neutral-400 dark:hover:border-[#333a4c] rounded-lg p-4 flex flex-col justify-between cursor-pointer transition-all shadow-sm group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded bg-neutral-100 dark:bg-[#1b1f29] border border-neutral-200 dark:border-[#292e3c] flex items-center justify-center">
                    {u.icon}
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#1b1f28] text-neutral-600 dark:text-neutral-400">
                    {u.clearance}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-neutral-950 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {u.name}
                  </h3>
                  <div className="text-[11px] text-neutral-700 dark:text-neutral-300 font-medium mt-0.5">{u.title}</div>
                  <div className="text-[10px] text-neutral-500 font-mono">{u.department}</div>
                </div>

                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed pt-2 border-t border-neutral-100 dark:border-[#1d2028]">
                  {u.description}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-[#1d2028] flex items-center justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                <span>Войти в систему</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="text-center text-[11px] text-neutral-400 font-mono">
          ООО «Фотопринт» · Все вычисления выполняются на локальном сервере предприятия
        </div>
      </div>
    </div>
  );
};
