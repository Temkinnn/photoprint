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
      {/* Background Whisper Audio Transcription Floating Pill */}
      {audioJob && (
        <div className="pointer-events-auto p-3.5 rounded-[20px] border border-[var(--border-solid)] bg-[var(--bg-card)] shadow-2xl space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  audioJob.status === 'ready'
                    ? 'bg-emerald-500'
                    : audioJob.status === 'error'
                    ? 'bg-[#D71921]'
                    : 'bg-sky-500 animate-ping'
                }`}
              />
              <Mic className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
              <span className="font-dot text-xs uppercase text-[var(--text-primary)] truncate">
                {audioJob.status === 'transcribing'
                  ? 'WHISPER // РАСШИФРОВКА'
                  : audioJob.status === 'ready'
                  ? 'СТЕНОГРАММА ГОТОВА'
                  : 'ОШИБКА WHISPER'}
              </span>
            </div>
            {audioJob.status !== 'transcribing' && (
              <button
                onClick={clearAudioJob}
                title="Скрыть"
                className="w-6 h-6 rounded-full hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-[11px] font-mono text-[var(--text-secondary)] truncate">
            {audioJob.filename}
          </div>

          {audioJob.status === 'error' && audioJob.error && (
            <div className="text-[11px] text-[#D71921] line-clamp-2">{audioJob.error}</div>
          )}

          <button
            onClick={() => setActiveTab('meetings')}
            className="w-full py-2 px-3.5 rounded-full text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <span>
              {audioJob.status === 'ready' ? 'Открыть и запустить AI-анализ' : 'Перейти к встрече'}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Background Qwen 2.5 Protocol Analysis Floating Pill */}
      {analysisJob && (
        <div className="pointer-events-auto p-3.5 rounded-[20px] border border-[var(--border-solid)] bg-[var(--bg-card)] shadow-2xl space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  analysisJob.status === 'ready'
                    ? 'bg-emerald-500'
                    : analysisJob.status === 'error'
                    ? 'bg-[#D71921]'
                    : 'bg-sky-500 animate-ping'
                }`}
              />
              <Cpu
                className={`w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0 ${
                  analysisJob.status === 'analyzing' ? 'animate-spin' : ''
                }`}
              />
              <span className="font-dot text-xs uppercase text-[var(--text-primary)] truncate">
                {analysisJob.status === 'analyzing'
                  ? 'QWEN 2.5 // АНАЛИЗ'
                  : analysisJob.status === 'ready'
                  ? 'ПРОТОКОЛ ГОТОВ'
                  : 'ОШИБКА АНАЛИЗА'}
              </span>
            </div>
            {analysisJob.status !== 'analyzing' && (
              <button
                onClick={clearAnalysisJob}
                title="Скрыть"
                className="w-6 h-6 rounded-full hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
            {analysisJob.meetingTitle}
          </div>

          {analysisJob.status === 'error' && analysisJob.error && (
            <div className="text-[11px] text-[#D71921] line-clamp-2">{analysisJob.error}</div>
          )}

          <button
            onClick={() => setActiveTab('meetings')}
            className="w-full py-2 px-3.5 rounded-full text-xs font-semibold bg-[#D71921] text-white hover:brightness-110 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <span>{analysisJob.status === 'ready' ? 'Открыть протокол' : 'Перейти к встрече'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Standard System Toasts */}
      {toasts.map((toast) => {
        let icon = <Info className="w-4 h-4 text-[var(--text-secondary)]" />;
        let dotColor = 'bg-[var(--text-secondary)]';

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
          dotColor = 'bg-emerald-500';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
          dotColor = 'bg-amber-500';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="w-4 h-4 text-[#D71921]" />;
          dotColor = 'bg-[#D71921]';
        }

        return (
          <div
            key={toast.id}
            className="pointer-events-auto p-3.5 rounded-[18px] border border-[var(--border-solid)] bg-[var(--bg-card)] shadow-xl flex items-start gap-3 transition-all animate-in fade-in slide-in-from-bottom-2 text-xs"
          >
            <div className="mt-0.5 shrink-0 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[var(--text-primary)] leading-snug">
                {toast.title}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                {toast.message}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="w-6 h-6 rounded-full hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
