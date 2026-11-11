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
    <div className="h-screen w-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 select-none relative transition-colors">
      {/* Theme Toggle Top Right */}
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl transition-colors shadow-sm"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="max-w-3xl w-full space-y-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 mb-2 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
            Локальный офисный контур
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
              className="bg-white dark:bg-neutral-900/60 hover:bg-neutral-50 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01] shadow-sm hover:shadow-md group"
            >
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
                  {u.icon}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-black dark:group-hover:text-white">
                    {u.name}
                  </h3>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">{u.title}</div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-500">{u.department}</div>
                </div>

                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                  {u.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-black dark:group-hover:text-white">
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
