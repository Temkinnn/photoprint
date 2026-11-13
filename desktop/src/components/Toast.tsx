import React from 'react';
import { useApp } from '../context/AppContext';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Mic,
  Cpu,
  ArrowUpRight,
} from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const {
    toasts,
    removeToast,
    audioJob,
    clearAudioJob,
    analysisJob,
    clearAnalysisJob,
    setActiveTab,
  } = useApp();

  if (toasts.length === 0 && !audioJob && !analysisJob) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
      {audioJob && (
        <div className="pointer-events-auto p-3.5 rounded-2xl border border-[var(--border-solid)] bg-[var(--bg-card)] shadow-xl space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  audioJob.status === 'ready'
                    ? 'bg-emerald-500'
                    : audioJob.status === 'error'
                    ? 'bg-[#D71921]'
                    : 'bg-sky-500'
                }`}
              />
              <Mic className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {audioJob.status === 'transcribing'
                  ? 'Whisper расшифровывает аудио...'
                  : audioJob.status === 'ready'
                  ? 'Стенограмма готова'
                  : 'Ошибка Whisper'}
              </span>
            </div>
            {audioJob.status !== 'transcribing' && (
              <button
                onClick={clearAudioJob}
                title="Скрыть"
                className="w-6 h-6 rounded-md hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs font-mono text-[var(--text-secondary)] truncate">
            {audioJob.filename}
          </div>

          {audioJob.status === 'error' && audioJob.error && (
            <div className="text-xs text-[#D71921] line-clamp-2">{audioJob.error}</div>
          )}

          <button
            onClick={() => setActiveTab('meetings')}
            className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 flex items-center justify-center gap-1.5 transition-opacity"
          >
            <span>
              {audioJob.status === 'ready' ? 'Открыть и запустить анализ' : 'Перейти к встрече'}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {analysisJob && (
        <div className="pointer-events-auto p-3.5 rounded-2xl border border-[var(--border-solid)] bg-[var(--bg-card)] shadow-xl space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  analysisJob.status === 'ready'
                    ? 'bg-emerald-500'
                    : analysisJob.status === 'error'
                    ? 'bg-[#D71921]'
                    : 'bg-sky-500'
                }`}
              />
              <Cpu
                className={`w-4 h-4 text-[var(--text-secondary)] shrink-0 ${
                  analysisJob.status === 'analyzing' ? 'animate-spin' : ''
                }`}
              />
              <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {analysisJob.status === 'analyzing'
                  ? 'Формирование протокола...'
                  : analysisJob.status === 'ready'
                  ? 'Протокол готов'
                  : 'Ошибка анализа'}
              </span>
            </div>
            {analysisJob.status !== 'analyzing' && (
              <button
                onClick={clearAnalysisJob}
                title="Скрыть"
                className="w-6 h-6 rounded-md hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs font-medium text-[var(--text-primary)] truncate">
            {analysisJob.meetingTitle}
          </div>

          {analysisJob.status === 'error' && analysisJob.error && (
            <div className="text-xs text-[#D71921] line-clamp-2">{analysisJob.error}</div>
          )}

          <button
            onClick={() => setActiveTab('meetings')}
            className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-[#D71921] text-white hover:brightness-110 flex items-center justify-center gap-1.5 transition-opacity"
          >
            <span>{analysisJob.status === 'ready' ? 'Открыть протокол' : 'Перейти к встрече'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {toasts.map((toast) => {
        let icon = <Info className="w-4 h-4 text-[var(--text-secondary)]" />;

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="w-4 h-4 text-[#D71921]" />;
        }

        return (
          <div
            key={toast.id}
            className="pointer-events-auto p-3.5 rounded-xl border border-[var(--border-solid)] bg-[var(--bg-card)] shadow-lg flex items-start gap-2.5 text-xs"
          >
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[var(--text-primary)] leading-snug">
                {toast.title}
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">
                {toast.message}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="w-6 h-6 rounded-md hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};