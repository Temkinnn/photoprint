import React from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { Shield, RotateCcw, Building2, UserCheck, HardHat, Headphones } from 'lucide-react';

export const Header: React.FC = () => {
  const { currentRole, currentUser, setRole, resetDemoData } = useApp();

  const roleOptions: { role: UserRole; title: string; icon: React.ReactNode; badge: string; color: string }[] = [
    {
      role: 'ROLE_DIRECTOR',
      title: 'Генеральный директор',
      icon: <Building2 className="w-4 h-4 text-emerald-400" />,
      badge: 'Полный доступ (L1-L3)',
      color: 'border-emerald-500/40 text-emerald-300',
    },
    {
      role: 'ROLE_PRODUCTION_HEAD',
      title: 'Начальник производства',
      icon: <HardHat className="w-4 h-4 text-amber-400" />,
      badge: 'Цех и качество (L2-L3)',
      color: 'border-amber-500/40 text-amber-300',
    },
    {
      role: 'ROLE_SUPPORT_HEAD',
      title: 'Клиентский сервис PicPac',
      icon: <Headphones className="w-4 h-4 text-blue-400" />,
      badge: 'Поддержка и SLA (L3)',
      color: 'border-blue-500/40 text-blue-300',
    },
  ];

  return (
    <header className="h-16 bg-slate-900/90 border-b border-slate-800 px-6 flex items-center justify-between select-none">
      {/* Brand & Local Server Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 tracking-wider">
            ФП
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Фотопринт <span className="text-xs text-slate-400 font-normal">· AI-Ассистент</span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Локальный контур (On-Premise · Qwen 2.5)
            </div>
          </div>
        </div>
      </div>

      {/* Role Switcher (RBAC requirement OT-02) */}
      <div className="flex items-center gap-3">
        <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          Активная роль:
        </div>
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
          {roleOptions.map((opt) => {
            const isActive = currentRole === opt.role;
            return (
              <button
                key={opt.role}
                onClick={() => setRole(opt.role)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {opt.icon}
                <span>{opt.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* User Info & Reset Demo Button */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs font-semibold text-slate-200 flex items-center justify-end gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            {currentUser.name}
          </div>
          <div className="text-[11px] text-slate-400">{currentUser.department}</div>
        </div>

        <button
          onClick={resetDemoData}
          title="Сбросить все данные к исходному состоянию"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          Сброс демо
        </button>
      </div>
    </header>
  );
};
