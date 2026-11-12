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
      clearance: 'LVL-1 · ПОЛНЫЙ',
      department: 'Дирекция',
      description:
        'Полный доступ ко всей отчетности: финансовые планы, маржинальность, фонд окладов, цех и клиентский сервис.',
      icon: <Building2 className="w-5 h-5" />,
    },
    {
      role: 'ROLE_PRODUCTION_HEAD',
      name: 'Иванов Игорь Сергеевич',
      title: 'Начальник производства',
      clearance: 'LVL-2 · ЦЕХ',
      department: 'Производственный цех',
      description:
        'Доступ к техкартам станков, нормативам брака, графикам смен и оборудованию. Финансовая тайна закрыта.',
      icon: <HardHat className="w-5 h-5" />,
    },
    {
      role: 'ROLE_SUPPORT_HEAD',
      name: 'Ковалева Елена Дмитриевна',
      title: 'Руководитель клиентского сервиса',
      clearance: 'LVL-3 · СЕРВИС',
      department: 'Служба заботы picPac.by',
      description:
        'Доступ к рекламациям, стандартам SLA, возвратам заказов и модерации фотопродуктов.',
      icon: <Headphones className="w-5 h-5" />,
    },
  ];

  return (
    <div className="h-screen w-screen nothing-grid flex flex-col items-center justify-center p-6 select-none relative transition-colors">
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          className="w-10 h-10 rounded-full border border-[var(--border-solid)] bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] flex items-center justify-center transition-all shadow-sm"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="max-w-4xl w-full space-y-8 animate-in fade-in duration-200">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-solid)] text-xs font-mono text-[var(--text-secondary)]">
            <div className="grid grid-cols-2 gap-0.5 w-2.5 h-2.5">
              <span className="w-1 h-1 rounded-full bg-[#00A8E8]" />
              <span className="w-1 h-1 rounded-full bg-[#D71921]" />
              <span className="w-1 h-1 rounded-full bg-[#FBB03B]" />
              <span className="w-1 h-1 rounded-full bg-[var(--text-primary)]" />
            </div>
            <span>ON-PREMISE // LOCAL SECURITY CONTOUR</span>
          </div>

          <h1 className="font-dot text-2xl sm:text-3xl text-[var(--text-primary)] tracking-wider uppercase">
            ФОТОПРИНТ · УПРАВЛЕНИЕ ПРОИЗВОДСТВОМ
          </h1>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
            Выберите профиль руководителя для применения матрицы разграничения доступа (RBAC)
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {users.map((u) => (
            <button
              key={u.role}
              type="button"
              onClick={() => loginAs(u.role)}
              className="text-left nothing-card p-5 flex flex-col justify-between hover:border-[var(--text-primary)] transition-all group active:scale-[0.99]"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] flex items-center justify-center text-[var(--text-primary)]">
                    {u.icon}
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                    {u.clearance}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {u.name}
                  </h3>
                  <div className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                    {u.title}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                    {u.department}
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed pt-3 border-t border-dashed border-[var(--border-dashed)]">
                  {u.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-dashed border-[var(--border-dashed)] flex items-center justify-between">
                <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--bg-elevated)] group-hover:bg-[var(--text-primary)] text-[var(--text-primary)] group-hover:text-[var(--bg-canvas)] transition-colors flex items-center gap-1.5">
                  <span>Войти в контур</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="text-center text-[11px] text-[var(--text-muted)] font-mono">
          ООО «ФОТОПРИНТ» // ВСЕ ВЫЧИСЛЕНИЯ ВЫПОЛНЯЮТСЯ ЛОКАЛЬНО
        </div>
      </div>
    </div>
  );
};
