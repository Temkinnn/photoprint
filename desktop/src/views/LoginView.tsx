// ======================== src/views/LoginView.tsx ========================
import React from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { Building2, HardHat, Headphones, ArrowRight, Sun, Moon } from 'lucide-react';

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
      description:
        'Полный доступ ко всей отчетности: финансовые планы, маржинальность, фонд окладов, цех и клиентский сервис.',
      icon: <Building2 className="w-5 h-5" />,
    },
    {
      role: 'ROLE_PRODUCTION_HEAD',
      name: 'Иванов Игорь Сергеевич',
      title: 'Начальник производства',
      clearance: 'Допуск 2 · Цех',
      department: 'Производственный цех',
      description:
        'Доступ к техкартам станков, нормативам брака, графикам смен и оборудованию. Финансовая тайна закрыта.',
      icon: <HardHat className="w-5 h-5" />,
    },
    {
      role: 'ROLE_SUPPORT_HEAD',
      name: 'Ковалева Елена Дмитриевна',
      title: 'Руководитель клиентского сервиса',
      clearance: 'Допуск 3 · Сервис',
      department: 'Служба заботы picPac.by',
      description:
        'Доступ к рекламациям, стандартам SLA, возвратам заказов и модерации фотопродуктов.',
      icon: <Headphones className="w-5 h-5" />,
    },
  ];

  return (
    <div className="h-screen w-screen nothing-grid flex flex-col items-center justify-center p-6 select-none relative transition-colors">
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          className="w-9 h-9 rounded-lg border border-[var(--border-solid)] bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] flex items-center justify-center transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="max-w-4xl w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-solid)] text-xs font-mono text-[var(--text-secondary)]">
            <div className="grid grid-cols-2 gap-0.5 w-2.5 h-2.5">
              <span className="w-1 h-1 rounded-full bg-[#00A8E8]" />
              <span className="w-1 h-1 rounded-full bg-[#D71921]" />
              <span className="w-1 h-1 rounded-full bg-[#FBB03B]" />
              <span className="w-1 h-1 rounded-full bg-[var(--text-primary)]" />
            </div>
            <span>Локальный контур предприятия</span>
          </div>

          <h1 className="font-dot text-xl sm:text-2xl text-[var(--text-primary)]">
            ФОТОПРИНТ · СИСТЕМА УПРАВЛЕНИЯ
          </h1>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
            Выберите профиль руководителя для применения матрицы разграничения доступа
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {users.map((u) => (
            <button
              key={u.role}
              type="button"
              onClick={() => loginAs(u.role)}
              className="text-left nothing-card p-5 flex flex-col justify-between hover:border-[var(--text-primary)] transition-colors group"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-solid)] flex items-center justify-center text-[var(--text-primary)]">
                    {u.icon}
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                    {u.clearance}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                    {u.name}
                  </h3>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {u.title}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                    {u.department}
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed pt-3 border-t border-[var(--border-solid)]">
                  {u.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-[var(--border-solid)] flex items-center justify-between text-xs font-medium text-[var(--text-primary)] group-hover:text-[#D71921] transition-colors">
                <span>Войти в систему</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>

        <div className="text-center text-xs text-[var(--text-muted)]">
          ООО «Фотопринт» · Все вычисления выполняются на локальном сервере предприятия
        </div>
      </div>
    </div>
  );
};