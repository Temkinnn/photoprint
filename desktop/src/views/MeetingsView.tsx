import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_TRANSCRIPTS } from '../mock/mockData';
import { TaskItem } from '../types';
import {
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  ChevronDown
} from 'lucide-react';

export const MeetingsView: React.FC = () => {
  const { batchApproveTasks, logAudit, showToast, analyzeMeetingTranscript, backendOnline } = useApp();

  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string>(MOCK_TRANSCRIPTS[0].id);
  const currentTranscript = MOCK_TRANSCRIPTS.find((t) => t.id === selectedTranscriptId) || MOCK_TRANSCRIPTS[0];

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [tasksToReview, setTasksToReview] = useState<Omit<TaskItem, 'id'>[]>(
    currentTranscript.stagedTasks.map((t) => ({
      title: t.title,
      assigneeName: t.assigneeName,
      deadline: t.deadline,
      sourceQuote: t.sourceQuote,
      timestamp: t.timestamp,
      status: 'pending_approval' as const,
    }))
  );

  const [showTranscript, setShowTranscript] = useState<boolean>(true);

  const handleRunAiAnalysis = async () => {
    setIsAnalyzing(true);
    showToast('AI-Анализ запущен', 'Обработка стенограммы встречи локальной моделью...', 'info');
    try {
      const res = await analyzeMeetingTranscript(currentTranscript.content, currentTranscript.title);
      if (res && res.tasks.length > 0) {
        setTasksToReview(
          res.tasks.map((t) => ({
            title: t.title,
            assigneeName: t.assigneeName,
            deadline: t.deadline,
            sourceQuote: t.sourceQuote,
            timestamp: t.timestamp || '00:00',
            status: 'pending_approval' as const,
          }))
        );
        showToast('Анализ завершен', `Извлечено ${res.tasks.length} поручений и ${res.decisions.length} решений`, 'success');
      } else {
        showToast('Анализ выполнен', 'Стенограмма обработана в штатном режиме', 'info');
      }
    } catch {
      showToast('Ошибка анализа', 'Не удалось связаться с модулем анализа', 'warning');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectMeeting = (id: string) => {
    setSelectedTranscriptId(id);
    const found = MOCK_TRANSCRIPTS.find((t) => t.id === id) || MOCK_TRANSCRIPTS[0];
    setTasksToReview(
      found.stagedTasks.map((t) => ({
        title: t.title,
        assigneeName: t.assigneeName,
        deadline: t.deadline,
        sourceQuote: t.sourceQuote,
        timestamp: t.timestamp,
        status: 'pending_approval' as const,
      }))
    );
  };

  const handleUpdateTask = (index: number, field: string, value: string) => {
    setTasksToReview((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleDeleteTask = (index: number) => {
    setTasksToReview((prev) => prev.filter((_, i) => i !== index));
    showToast('Задача удалена', 'Поручение исключено из черновика', 'info');
  };

  const handleAddTask = () => {
    setTasksToReview((prev) => [
      ...prev,
      {
        title: 'Новое поручение',
        assigneeName: 'Назначить ответственного',
        deadline: 'Указать срок',
        sourceQuote: 'Добавлено вручную',
        timestamp: '00:00',
        status: 'pending_approval',
      },
    ]);
  };

  const handleApprove = () => {
    if (tasksToReview.length === 0) {
      showToast('Нет задач', 'Список задач пуст', 'warning');
      return;
    }
    batchApproveTasks(tasksToReview, currentTranscript.title);
    setTasksToReview([]);
  };

  const handleReject = () => {
    logAudit(
      'REJECT_TASKS',
      `Meeting: ${currentTranscript.title}`,
      'REJECTED',
      'Руководитель отклонил черновик поручений. База данных не изменена.'
    );
    setTasksToReview([]);
    showToast('Черновик отклонен', 'Поручения отменены без внесения в реестр', 'warning');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="h-16 px-8 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-white/60 dark:bg-[#0c1017]/60 backdrop-blur-xl shrink-0">
        <div>
          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Совещания и протоколы</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Стенограмма, ключевые решения и утверждение поручений
          </p>
        </div>

        {/* Meeting Dropdown Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Совещание:</label>
          <div className="relative">
            <select
              value={selectedTranscriptId}
              onChange={(e) => handleSelectMeeting(e.target.value)}
              className="bg-white/80 dark:bg-black/30 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.1] text-neutral-800 dark:text-neutral-200 text-xs rounded-xl px-3 py-1.5 pr-8 focus:outline-none focus:border-neutral-500 font-medium appearance-none cursor-pointer shadow-sm"
            >
              {MOCK_TRANSCRIPTS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              showTranscript
                ? 'bg-neutral-900 text-white dark:bg-white/[0.1] dark:text-white dark:border-white/10 shadow-sm'
                : 'bg-white/60 dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.08] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            {showTranscript ? 'Скрыть текст' : 'Показать текст'}
          </button>

          <button
            onClick={handleRunAiAnalysis}
            disabled={isAnalyzing}
            title={backendOnline ? 'Запустить анализ стенограммы на FastAPI бэкенде' : 'AI-анализ стенограммы'}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 text-white hover:bg-black dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition-all shadow-sm disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Анализ...' : 'AI Анализ'}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Transcript */}
        {showTranscript && (
          <div className="w-[440px] border-r border-black/[0.06] dark:border-white/[0.08] flex flex-col bg-white/30 dark:bg-black/[0.1] backdrop-blur-md">
            <div className="p-4 border-b border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
              <span className="font-semibold text-neutral-800 dark:text-neutral-300">Стенограмма встречи</span>
              <span className="font-mono text-[11px]">{currentTranscript.date}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[12px] leading-relaxed text-neutral-700 dark:text-neutral-300 select-text">
              {currentTranscript.content.split('\n').map((line, idx) => {
                const match = line.match(/^(\[\d\d:\d\d\])\s+([^:]+):\s*(.*)$/);
                if (match) {
                  const [, time, speaker, text] = match;
                  return (
                    <div key={idx} className="p-3 rounded-xl glass-card space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-200 font-sans">{speaker}</span>
                        <span className="font-mono text-[10px]">{time}</span>
                      </div>
                      <div className="text-neutral-800 dark:text-neutral-300 font-sans leading-relaxed">{text}</div>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="text-neutral-500 dark:text-neutral-400 font-sans">
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right Pane: Summary, Decisions & Staged Tasks */}
        <div className="flex-1 flex flex-col overflow-y-auto p-8 space-y-6">
          {/* Summary Card */}
          <div className="glass-panel rounded-2xl p-5 space-y-2">
            <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
              Краткий итог
            </div>
            <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans">{currentTranscript.summary}</p>
          </div>

          {/* Decisions Card */}
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Принятые решения
            </div>

            <div className="space-y-2.5">
              {currentTranscript.decisions.map((d) => (
                <div key={d.id} className="flex items-start gap-3 text-sm text-neutral-800 dark:text-neutral-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-neutral-400 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-snug">
                    <span>{d.text}</span>
                    {d.speaker && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-2">({d.speaker})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Staged Tasks (Draft & Review) */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Поручения к утверждению ({tasksToReview.length})
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Отредактируйте ответственного или срок перед фиксацией в реестре
                </p>
              </div>

              <button
                onClick={handleAddTask}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-white/70 dark:bg-white/[0.05] hover:bg-white dark:hover:bg-white/[0.1] rounded-xl transition-colors border border-black/[0.06] dark:border-white/[0.08] shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Добавить
              </button>
            </div>

            {tasksToReview.length === 0 ? (
              <div className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl">
                Все поручения согласованы и записаны в реестр.
              </div>
            ) : (
              <div className="space-y-3">
                {tasksToReview.map((task, idx) => {
                  const isUnassigned = task.assigneeName.includes('уточнения');
                  const isNoDeadline = task.deadline.includes('уточнения');

                  return (
                    <div
                      key={idx}
                      className="glass-card p-4 rounded-xl space-y-3 hover:border-black/15 dark:hover:border-white/20 transition-all duration-200"
                    >
                      {/* Title */}
                      <div className="flex items-start justify-between gap-3">
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => handleUpdateTask(idx, 'title', e.target.value)}
                          className="flex-1 bg-transparent font-medium text-sm text-neutral-900 dark:text-neutral-100 border-b border-transparent hover:border-black/10 dark:hover:border-white/10 focus:border-blue-500 focus:outline-none pb-0.5"
                        />
                        <button
                          onClick={() => handleDeleteTask(idx)}
                          className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors p-1"
                          title="Удалить поручение"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Assignee & Deadline */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1 font-medium">Ответственный:</label>
                          <input
                            type="text"
                            value={task.assigneeName}
                            onChange={(e) => handleUpdateTask(idx, 'assigneeName', e.target.value)}
                            className={`w-full glass-input px-3 py-1.5 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none ${
                              isUnassigned
                                ? 'border-amber-400/80 dark:border-amber-500/50 bg-amber-500/[0.06] text-amber-800 dark:text-amber-200'
                                : 'focus:border-blue-500/50'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1 font-medium">Срок исполнения:</label>
                          <input
                            type="text"
                            value={task.deadline}
                            onChange={(e) => handleUpdateTask(idx, 'deadline', e.target.value)}
                            className={`w-full glass-input px-3 py-1.5 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none ${
                              isNoDeadline
                                ? 'border-amber-400/80 dark:border-amber-500/50 bg-amber-500/[0.06] text-amber-800 dark:text-amber-200'
                                : 'focus:border-blue-500/50'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Citation */}
                      {task.sourceQuote && (
                        <div className="text-xs text-neutral-600 dark:text-neutral-400 bg-black/[0.02] dark:bg-white/[0.02] p-2.5 rounded-lg border border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between">
                          <span>Основание: «{task.sourceQuote}»</span>
                          {task.timestamp && (
                            <span className="font-mono not-italic shrink-0 ml-2 text-neutral-500 dark:text-neutral-400">
                              {task.timestamp}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Confirm & Reject Buttons */}
                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    onClick={handleReject}
                    className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                  >
                    Отклонить все
                  </button>

                  <button
                    onClick={handleApprove}
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white rounded-lg shadow-sm transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Утвердить поручения ({tasksToReview.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
