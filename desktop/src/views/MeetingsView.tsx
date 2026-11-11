import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_TRANSCRIPTS } from '../mock/mockData';
import { TaskItem } from '../types';
import {
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  ChevronDown,
  Calendar,
  AlertTriangle,
  Clock,
  FileText,
  X,
  Check,
  ShieldCheck,
  Bookmark,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

export const MeetingsView: React.FC = () => {
  const {
    batchApproveTasks,
    logAudit,
    showToast,
    analyzeMeetingTranscript,
    backendOnline,
    calendarSlots,
    scheduleMeeting
  } = useApp();

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

  // Scenario 1 & 2: Preparation and Calendar Creation Modal
  const [isPrepModalOpen, setIsPrepModalOpen] = useState<boolean>(false);
  const [prepTopic, setPrepTopic] = useState<string>('Ввод в эксплуатацию ЦПМ Canon imagePRESS V1000');
  const [prepParticipants, setPrepParticipants] = useState<string[]>([
    'Смирнов А.В. (Ген. директор)',
    'Иванов И.С. (Нач. производства)',
  ]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([
    'Техкарта оборудования и требования к электропитанию',
    'План производства и загрузка цеха на Q4',
  ]);
  const [isAiGeneratingAgenda, setIsAiGeneratingAgenda] = useState<boolean>(false);
  const [generatedAgenda, setGeneratedAgenda] = useState<{
    agenda: string[];
    openQuestions: string[];
  }>({
    agenda: [
      '1. Оценка готовности производственной площадки и электропитания 380В (15 мин)',
      '2. Согласование графика поставки и шеф-монтажа с инженерами «Кэнон-Ру» (20 мин)',
      '3. План переобучения операторов дневной и ночной смен (15 мин)',
    ],
    openQuestions: [
      '• Выделена ли стабильная силовая линия 380В / 32А без просадок напряжения?',
      '• Получен ли допуск инженеров поставщика на режимную территорию предприятия?',
    ],
  });

  const [selectedSlotId, setSelectedSlotId] = useState<string>(calendarSlots[0]?.id || 'slot-1');
  const selectedSlot = calendarSlots.find((s) => s.id === selectedSlotId) || calendarSlots[0];

  const handleGenerateAgenda = () => {
    setIsAiGeneratingAgenda(true);
    setTimeout(() => {
      setIsAiGeneratingAgenda(false);
      setGeneratedAgenda({
        agenda: [
          `1. Анализ рисков и целей по теме: «${prepTopic}» (15 мин)`,
          `2. Проверка требований регламентов: ${selectedDocs.join(', ')} (20 мин)`,
          `3. Фиксация ответственных и сроков по ключевым этапам (15 мин)`,
        ],
        openQuestions: [
          `• Какие критические блокеры зафиксированы по участку «${prepTopic}»?`,
          `• Требуется ли согласование сметы с финансовой дирекцией до даты встречи?`,
        ],
      });
      showToast('Повестка сформирована', 'AI сформировал проект повестки и открытых вопросов по документам', 'info');
    }, 400);
  };

  const handleConfirmMeetingCreation = async () => {
    if (!selectedSlot) {
      showToast('Выберите слот', 'Необходимо выбрать свободное время в календаре', 'warning');
      return;
    }

    await scheduleMeeting({
      title: prepTopic,
      date: selectedSlot.date,
      time: `${selectedSlot.startTime} - ${selectedSlot.endTime}`,
      durationMinutes: 60,
      participants: prepParticipants,
      agenda: generatedAgenda.agenda,
    });

    logAudit(
      'CREATE_MEETING_CONFIRMED',
      `Встреча: ${prepTopic}`,
      'SUCCESS',
      `Пользователь явно подтвердил создание встречи: ${prepTopic} на ${selectedSlot.date} ${selectedSlot.startTime}. Приглашения отправлены.`
    );

    setIsPrepModalOpen(false);
    showToast(
      'Встреча создана в календаре',
      `Событие назначено на ${selectedSlot.date} в ${selectedSlot.startTime}. Приглашения разосланы.`,
      'success'
    );
  };

  const handleSaveProtocol = () => {
    const protocolRef = `#transcript-${currentTranscript.id}`;
    logAudit(
      'SAVE_PROTOCOL',
      `Протокол: ${currentTranscript.title}`,
      'SUCCESS',
      `Протокол совещания успешно сохранен со ссылкой на исходную расшифровку (${protocolRef})`
    );
    showToast(
      'Протокол зафиксирован',
      `Сохранен протокол совещания со ссылкой на исходную стенограмму (${protocolRef})`,
      'success'
    );
  };

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
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-hidden transition-colors">
      {/* Top Header - Spacious & Clean */}
      <div className="h-16 px-8 border-b border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between bg-white dark:bg-neutral-900/40 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Совещания
            </h1>
          </div>

          <span className="text-neutral-300 dark:text-neutral-700">|</span>

          {/* Meeting Selector in header */}
          <div className="relative">
            <select
              value={selectedTranscriptId}
              onChange={(e) => handleSelectMeeting(e.target.value)}
              className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:border-neutral-500 font-medium appearance-none cursor-pointer"
            >
              {MOCK_TRANSCRIPTS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Right side of Top Bar: ONLY One Primary Action */}
        <button
          onClick={() => setIsPrepModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 text-white hover:bg-black dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white transition-all shadow-sm"
          title="Сформировать проект повестки и предложить свободные слоты календаря (Сценарии 1 и 2)"
        >
          <Plus className="w-4 h-4" />
          <span>Подготовка встречи</span>
        </button>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Transcript */}
        {showTranscript ? (
          <div className="w-[420px] border-r border-neutral-200 dark:border-neutral-800/80 flex flex-col bg-neutral-100/40 dark:bg-neutral-900/20 shrink-0 transition-all">
            <div className="p-3.5 px-4 border-b border-neutral-200 dark:border-neutral-800/60 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
              <div className="flex items-center gap-2 font-medium">
                <FileText className="w-3.5 h-3.5 text-neutral-500" />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">Стенограмма</span>
                <span className="text-[11px] font-mono text-neutral-400">({currentTranscript.date})</span>
              </div>
              <button
                onClick={() => setShowTranscript(false)}
                title="Скрыть панель стенограммы"
                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            <div
              id={`transcript-${currentTranscript.id}`}
              className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[12px] leading-relaxed text-neutral-700 dark:text-neutral-300 select-text"
            >
              {currentTranscript.content.split('\n').map((line, idx) => {
                const match = line.match(/^(\[\d\d:\d\d\])\s+([^:]+):\s*(.*)$/);
                if (match) {
                  const [, time, speaker, text] = match;
                  return (
                    <div key={idx} className="p-2.5 rounded-lg bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/60 shadow-sm dark:shadow-none">
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-200 font-sans">{speaker}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800">{time}</span>
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
        ) : (
          <div className="w-12 border-r border-neutral-200 dark:border-neutral-800/80 bg-neutral-100/40 dark:bg-neutral-900/20 flex flex-col items-center py-4 shrink-0">
            <button
              onClick={() => setShowTranscript(true)}
              title="Показать стенограмму встречи"
              className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-medium text-neutral-400 [writing-mode:vertical-rl] rotate-180 mt-4 tracking-wider uppercase select-none">
              Стенограмма
            </span>
          </div>
        )}

        {/* Right Pane: Summary, Decisions, Risks & Staged Tasks */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6 lg:p-8">
          <div className="max-w-5xl mx-auto w-full space-y-6">
            {/* Context Header for Protocol */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                  Протокол встречи · #{currentTranscript.id}
                </div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {currentTranscript.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunAiAnalysis}
                  disabled={isAnalyzing}
                  title={backendOnline ? 'Запустить AI анализ стенограммы на бэкенде' : 'AI-анализ стенограммы'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 text-white hover:bg-black dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white transition-all shadow-sm disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzing ? 'Анализ...' : 'AI Анализ'}</span>
                </button>

                <button
                  onClick={handleSaveProtocol}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-sm"
                  title="Сохранить протокол со ссылкой на исходную расшифровку"
                >
                  <Bookmark className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Сохранить протокол</span>
                </button>
              </div>
            </div>

            {/* Summary Card */}
            <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-2 shadow-sm">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                <span>Краткий итог (Summary)</span>
              </div>
              <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans">{currentTranscript.summary}</p>
            </div>

            {/* Decisions & Risks Cards Grid (Scenario 3 Requirement) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Decisions Card */}
            <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Принятые решения ({currentTranscript.decisions.length})</span>
              </div>

              <div className="space-y-2.5">
                {currentTranscript.decisions.map((d) => (
                  <div key={d.id} className="flex items-start gap-2.5 text-sm text-neutral-800 dark:text-neutral-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-neutral-400 shrink-0 mt-0.5" />
                    <div className="flex-1 leading-snug">
                      <span>{d.text}</span>
                      {d.speaker && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1.5">({d.speaker})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risks Card */}
            <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Выявленные риски ({currentTranscript.risks?.length || 0})</span>
              </div>

              <div className="space-y-2">
                {currentTranscript.risks && currentTranscript.risks.length > 0 ? (
                  currentTranscript.risks.map((r) => (
                    <div key={r.id} className="p-2.5 rounded-lg bg-amber-500/[0.05] dark:bg-amber-500/[0.08] border border-amber-500/20 text-xs space-y-1">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
                        <span>{r.riskDescription}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold uppercase">
                          {r.impact}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-600 dark:text-neutral-400">
                        Меры: {r.suggestedMitigation}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-neutral-400">Критических рисков не зафиксировано</div>
                )}
              </div>
            </div>
          </div>

          {/* Staged Tasks (Draft & Review) (Scenario 4 Requirement) */}
          <div className="bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Поручения к утверждению ({tasksToReview.length})
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Отредактируйте ответственного или срок перед фиксацией в реестре. Задачи без ответственного/срока подсвечены.
                </p>
              </div>

              <button
                onClick={handleAddTask}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors border border-neutral-200 dark:border-neutral-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </div>

            {tasksToReview.length === 0 ? (
              <div className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                Все поручения согласованы и записаны в реестр.
              </div>
            ) : (
              <div className="space-y-3">
                {tasksToReview.map((task, idx) => {
                  const isUnassigned = task.assigneeName.includes('уточнения') || task.assigneeName.includes('Назначить');
                  const isNoDeadline = task.deadline.includes('уточнения') || task.deadline.includes('Указать');

                  return (
                    <div
                      key={idx}
                      className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                    >
                      {/* Title */}
                      <div className="flex items-start justify-between gap-3">
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => handleUpdateTask(idx, 'title', e.target.value)}
                          className="flex-1 bg-transparent font-medium text-sm text-neutral-900 dark:text-neutral-100 border-b border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-neutral-500 focus:outline-none pb-0.5"
                        />
                        <button
                          onClick={() => handleDeleteTask(idx)}
                          className="text-neutral-400 hover:text-rose-500 transition-colors p-1"
                          title="Удалить поручение"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Assignee & Deadline with detection warnings */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-neutral-500 dark:text-neutral-400">Ответственный:</label>
                            {isUnassigned && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold font-mono">
                                ⚠ Требуется ответственный
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={task.assigneeName}
                            onChange={(e) => handleUpdateTask(idx, 'assigneeName', e.target.value)}
                            className={`w-full bg-white dark:bg-neutral-900 px-3 py-1.5 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 border focus:outline-none ${
                              isUnassigned
                                ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200'
                                : 'border-neutral-200 dark:border-neutral-800 focus:border-neutral-400 dark:focus:border-neutral-600'
                            }`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-neutral-500 dark:text-neutral-400">Срок исполнения:</label>
                            {isNoDeadline && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold font-mono">
                                ⚠ Требуется срок
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={task.deadline}
                            onChange={(e) => handleUpdateTask(idx, 'deadline', e.target.value)}
                            className={`w-full bg-white dark:bg-neutral-900 px-3 py-1.5 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 border focus:outline-none ${
                              isNoDeadline
                                ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200'
                                : 'border-neutral-200 dark:border-neutral-800 focus:border-neutral-400 dark:focus:border-neutral-600'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Citation */}
                      {task.sourceQuote && (
                        <div className="text-xs text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800/40 flex items-center justify-between">
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
                    <span>Утвердить поручения ({tasksToReview.length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* ========================================================================= */}
      {/* SCENARIO 1 & 2: MODAL ДЛЯ ПОДГОТОВКИ ВСТРЕЧИ И КАЛЕНДАРЯ                  */}
      {/* ========================================================================= */}
      {isPrepModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 max-w-2xl w-full p-6 rounded-2xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 mb-1 border border-neutral-300 dark:border-neutral-700">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Сценарии 1 и 2 ТЗ: Подготовка встречи и Календарь</span>
                </div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Подготовка встречи и свободное время
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Формирование повестки по теме, участникам и регламентам базы знаний
                </p>
              </div>

              <button
                onClick={() => setIsPrepModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Preparation Inputs & AI Agenda Generation */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>1. Подготовка: Тема, участники и разрешенные документы</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                    Тема встречи:
                  </label>
                  <input
                    type="text"
                    value={prepTopic}
                    onChange={(e) => setPrepTopic(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 px-3.5 py-2 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                      Участники:
                    </label>
                    <div className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
                      {['Смирнов А.В. (Директор)', 'Иванов И.С. (Производство)', 'Ковалева Е.Д. (Сервис)'].map((p) => (
                        <div key={p} className="flex items-center gap-2 p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                      Разрешенные документы:
                    </label>
                    <div className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
                      {selectedDocs.map((doc) => (
                        <div key={doc} className="flex items-center gap-2 p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800 text-[11px] truncate">
                          <FileText className="w-3 h-3 text-neutral-500 shrink-0" />
                          <span className="truncate">{doc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerateAgenda}
                  disabled={isAiGeneratingAgenda}
                  className="w-full py-2 px-4 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100 transition-colors"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAiGeneratingAgenda ? 'animate-spin' : ''}`} />
                  <span>{isAiGeneratingAgenda ? 'AI формирует повестку...' : 'Сформировать проект повестки и открытых вопросов (AI)'}</span>
                </button>

                {/* Generated Agenda and Questions Preview */}
                <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                      Проект повестки:
                    </div>
                    <ul className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1 pl-1">
                      {generatedAgenda.agenda.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                      Открытые задачи и вопросы к обсуждению:
                    </div>
                    <ul className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1 pl-1">
                      {generatedAgenda.openQuestions.map((q, i) => (
                        <li key={i} className="text-amber-800 dark:text-amber-300 font-medium">{q}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Calendar Slots & Confirmation */}
            <div className="space-y-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>2. Свободное время в тестовом календаре (Сценарий 2)</span>
                </h3>
                <span className="text-[11px] text-neutral-500">Доступно {calendarSlots.length} слота</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {calendarSlots.map((slot) => {
                  const isSelected = selectedSlotId === slot.id;
                  return (
                    <div
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`p-3 rounded-xl cursor-pointer transition-colors text-xs flex flex-col justify-between gap-1.5 border ${
                        isSelected
                          ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800 ring-1 ring-neutral-900 dark:ring-white'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">{slot.date}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-neutral-900 dark:text-white" />}
                      </div>

                      <div className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">
                        {slot.startTime} – {slot.endTime}
                      </div>

                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        ✓ Все участники свободны
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Requirement: Create ONLY after user confirmation */}
              <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-800 dark:text-neutral-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Требование ТЗ (Сценарий 2):</strong> Событие в календаре и персональные приглашения участникам отправляются <u>исключительно после вашего явного подтверждения</u>.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 flex items-center justify-end gap-3 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setIsPrepModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors"
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={handleConfirmMeetingCreation}
                className="px-5 py-2 text-xs font-semibold bg-neutral-900 hover:bg-black dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white text-white rounded-lg flex items-center gap-2 shadow-sm transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Подтвердить и создать встречу в календаре</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
