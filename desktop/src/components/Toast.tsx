import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none select-none">
      {toasts.map((toast) => {
        let icon = <Info className="w-4 h-4 text-neutral-400" />;

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="w-4 h-4 text-rose-400" />;
        }

        return (
          <div
            key={toast.id}
            className="pointer-events-auto p-3.5 rounded-xl border border-neutral-700 bg-neutral-900/95 shadow-xl flex items-start gap-3 backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2"
          >
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-neutral-100">{toast.title}</div>
              <div className="text-xs text-neutral-400 mt-0.5 leading-snug">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-neutral-500 hover:text-neutral-300 transition-colors p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
