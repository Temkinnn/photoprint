import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_TRANSCRIPTS } from '../mock/mockData';
import { OpenTaskSummary, TaskItem } from '../types';
import {
  CheckCircle2,
  Plus,
  Trash2,
  Cpu,
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
  PanelLeftOpen,
  Bell,
  Users,
  Mail,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

const surnameKey = (name: string): string => {
  const cleaned = (name || '').split('(')[0].trim();
  const first = cleaned.split(/\s+/)[0] || '';
  return first.toLowerCase();
};

export const MeetingsView: React.FC = () => {
  const {
    batchApproveTasks,
    logAudit,
    showToast,
    analyzeMeetingTranscript,
    backendOnline,
    calendarSlots,
    scheduledMeetings,
    scheduleMeeting,
    prepareMeetingAgenda,
    participantsCatalog,
    documents,
    currentUser,
    currentRole,
    invitations,
    respondToInvitation,
    tasks,
  } = useApp();

  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string>(MOCK_TRANSCRIPTS[0].id);
  const scheduledList = scheduledMeetings.filter((m) => m.status === 'scheduled');
  const selectedScheduledMeeting = scheduledList.find((m) => m.id === selectedTranscriptId) || null;
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
  const [isInvitationsOpen, setIsInvitationsOpen] = useState<boolean>(false);
  const [invTab, setInvTab] = useState<'incoming' | 'all'>('incoming');

  // Scenario 1 & 2: Preparation, Calendar Booking and Preview Confirmation Modal
  const [isPrepModalOpen, setIsPrepModalOpen] = useState<boolean>(false);
  const [prepStep, setPrepStep] = useState<'setup' | 'preview'>('setup');
  const [prepTopic, setPrepTopic] = useState<string>('Ввод в эксплуатацию ЦПМ Canon imagePRESS V1000');
  const [prepParticipants, setPrepParticipants] = useState<string[]>([
    'Смирнов А.В.',
    'Иванов И.С.',
  ]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isAiGeneratingAgenda, setIsAiGeneratingAgenda] = useState<boolean>(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [generatedAgenda, setGeneratedAgenda] = useState<{
    agenda: string[];
    openTasks: OpenTaskSummary[];
    openQuestions: string[];
    usedDocuments: string[];
    modelUsed: string;
  }>({
    agenda: [],
    openTasks: [],
    openQuestions: [],
    usedDocuments: [],
    modelUsed: '',
  });
  const [invitationText, setInvitationText] = useState<string>('');
  const [isCreatingMeeting, setIsCreatingMeeting] = useState<boolean>(false);

  const firstFreeSlot = calendarSlots.find((s) => s.isAvailable) || calendarSlots[0];
  const [selectedSlotId, setSelectedSlotId] = useState<string>(firstFreeSlot?.id || '');
  const selectedSlot = calendarSlots.find((s) => s.id === selectedSlotId);

  useEffect(() => {
    if (selectedSlot && !selectedSlot.isAvailable) {
      const nextAvailable = calendarSlots.find((s) => s.isAvailable);
      if (nextAvailable) setSelectedSlotId(nextAvailable.id);
    }
  }, [calendarSlots, selectedSlot]);

  useEffect(() => {
    setSelectedDocIds((prev) => {
      const validPrev = prev.filter((id) => documents.some((d) => d.id === id));
      if (validPrev.length > 0) return validPrev;
      return documents.slice(0, 2).map((d) => d.id);
    });
  }, [documents]);

  const currentUserSurname = surnameKey(currentUser.name);
  const incomingInvitations = invitations.filter(
    (inv) =>
      inv.recipientRole === currentRole ||
      (currentUserSurname && surnameKey(inv.recipientName) === currentUserSurname)
  );
  const pendingIncomingCount = incomingInvitations.filter((inv) => inv.status === 'pending').length;

  const openPrepModal = () => {
    setPrepStep('setup');
    setPrepError(null);
    const nextFree = calendarSlots.find((s) => s.isAvailable);
    if (nextFree) setSelectedSlotId(nextFree.id);
    setIsPrepModalOpen(true);
  };

  const toggleParticipant = (shortName: string) => {
    setPrepParticipants((prev) =>
      prev.includes(shortName) ? prev.filter((p) => p !== shortName) : [...prev, shortName]
    );
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleGenerateAgenda = async () => {
    if (!prepTopic.trim()) {
      setPrepError('Укажите тему встречи.');
      return;
    }
    if (prepParticipants.length === 0) {
      setPrepError('Выберите хотя бы одного участника встречи.');
      return;
    }

    setPrepError(null);
    setIsAiGeneratingAgenda(true);
    try {
      const res = await prepareMeetingAgenda({
        topic: prepTopic.trim(),
        participants: prepParticipants,
        selectedDocIds,
      });
      setGeneratedAgenda({
        agenda: res.agenda,
        openTasks: res.openTasks,
        openQuestions: res.openQuestions,
        usedDocuments: res.usedDocuments,
        modelUsed: res.modelUsed,
      });
      showToast(
        'Повестка сформирована',
        `AI (${res.modelUsed}) проанализировал ${res.usedDocuments.length} док. и ${res.openTasks.length} открытых задач из БД`,
        'success'
      );
    } catch (err: any) {
      const message = err?.message || 'Ошибка при генерации повестки через LLM.';
      setPrepError(message);
      showToast('Ошибка генерации повестки', message, 'error');
    } finally {
      setIsAiGeneratingAgenda(false);
    }
  };

  const handleProceedToPreview = () => {
    if (!prepTopic.trim()) {
      showToast('Укажите тему', 'Введите тему совещания перед продолжением', 'warning');
      return;
    }
    if (prepParticipants.length === 0) {
      showToast('Выберите участников', 'Отметьте хотя бы одного участника', 'warning');
      return;
    }
    if (!selectedSlot || !selectedSlot.isAvailable) {
      showToast('Выберите свободный слот', 'Выбранное время занято или не выбрано', 'warning');
      return;
    }

    const agendaLines =
      generatedAgenda.agenda.length > 0
        ? generatedAgenda.agenda.map((item) => `• ${item}`).join('\n')
        : '• Обсуждение вопросов по теме встречи';
    const questionsLines =
      generatedAgenda.openQuestions.length > 0
        ? `\n\nОткрытые вопросы к обсуждению:\n${generatedAgenda.openQuestions.join('\n')}`
        : '';

    setInvitationText(
      `Уважаемые коллеги!\nПриглашаю вас на совещание «${prepTopic.trim()}».\n\n` +
        `Дата и время: ${selectedSlot.date}, ${selectedSlot.startTime}–${selectedSlot.endTime}\n` +
        `Участники: ${prepParticipants.join(', ')}\n\n` +
        `Проект повестки:\n${agendaLines}${questionsLines}`
    );
    setPrepStep('preview');
  };

  const handleConfirmMeetingCreation = async () => {
    if (!selectedSlot || !selectedSlot.isAvailable) {
      showToast('Выберите свободный слот', 'Выбранное время недоступно', 'warning');
      return;
    }

    setIsCreatingMeeting(true);
    try {
      const created = await scheduleMeeting({
        title: prepTopic.trim(),
        date: selectedSlot.date,
        time: `${selectedSlot.startTime} - ${selectedSlot.endTime}`,
        durationMinutes: 45,
        participants: prepParticipants,
        agenda:
          generatedAgenda.agenda.length > 0
            ? generatedAgenda.agenda
            : [`1. Обсуждение темы «${prepTopic.trim()}» (45 мин)`],
        openQuestions: generatedAgenda.openQuestions,
        slotId: selectedSlot.id,
        invitationText,
      });

      setSelectedTranscriptId(created.id);
      setIsPrepModalOpen(false);
      setPrepStep('setup');
    } catch (err: any) {
      showToast('Ошибка создания встречи', err?.message || 'Не удалось создать встречу', 'error');
    } finally {
      setIsCreatingMeeting(false);
    }
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
    const found = MOCK_TRANSCRIPTS.find((t) => t.id === id);
    if (found) {
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
    } else {
      setTasksToReview([]);
    }
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
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] dark:bg-[#0c0d12] overflow-hidden transition-colors">
      {/* Top Header - Spacious & Clean */}
      <div className="h-16 px-6 border-b border-neutral-200 dark:border-[#212530] flex items-center justify-between bg-white dark:bg-[#13151b] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-neutral-950 dark:text-white tracking-tight">
              Совещания и протоколы
            </h1>
          </div>

          <span className="text-neutral-300 dark:text-neutral-700">/</span>

          {/* Meeting Selector in header */}
          <div className="relative">
            <select
              value={selectedTranscriptId}
              onChange={(e) => handleSelectMeeting(e.target.value)}
              className="bg-neutral-50 dark:bg-[#1a1d25] border border-neutral-200 dark:border-[#282d3b] text-neutral-850 dark:text-neutral-200 text-xs rounded-md px-3 py-1.5 pr-8 focus:outline-none focus:border-sky-500 font-medium appearance-none cursor-pointer max-w-[380px]"
            >
              {scheduledList.length > 0 && (
                <optgroup label="Запланированные встречи (PostgreSQL)">
                  {scheduledList.map((m) => (
                    <option key={m.id} value={m.id}>
                      [Запланировано] {m.title} ({m.date})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Проведённые совещания и стенограммы">
                {MOCK_TRANSCRIPTS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Right side of Top Bar */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsInvitationsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-neutral-300 dark:border-[#2c3242] bg-white dark:bg-[#15171e] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-[#1d212b] transition-colors relative"
            title="Входящие и отправленные приглашения на совещания"
          >
            <Bell className="w-3.5 h-3.5 text-neutral-500" />
            <span>Приглашения</span>
            {pendingIncomingCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-sky-600 text-white">
                {pendingIncomingCount}
              </span>
            )}
          </button>

          <button
            onClick={openPrepModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition-all shadow-sm"
            title="Сформировать проект повестки и предложить свободные слоты календаря (Сценарии 1 и 2)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Подготовка встречи</span>
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {selectedScheduledMeeting ? (() => {
          const meetingInvitations = invitations.filter((inv) => inv.meetingId === selectedScheduledMeeting.id);
          const pSurnames = new Set(selectedScheduledMeeting.participants.map(surnameKey));
          const relatedTasks = tasks.filter(
            (t) => (t.status === 'active' || t.status === 'overdue') && pSurnames.has(surnameKey(t.assigneeName))
          );

          return (
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-start justify-between pb-4 border-b border-neutral-200 dark:border-[#212530]">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 dark:text-neutral-400">
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-semibold">
                        Запланировано
                      </span>
                      <span>{selectedScheduledMeeting.date}</span>
                      <span>·</span>
                      <span>{selectedScheduledMeeting.time}</span>
                      <span>·</span>
                      <span>{selectedScheduledMeeting.durationMinutes} мин</span>
                    </div>
                    <h2 className="text-lg font-bold text-neutral-950 dark:text-white mt-2">
                      {selectedScheduledMeeting.title}
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100 pb-2 border-b border-neutral-100 dark:border-[#1d2028]">
                      <Users className="w-4 h-4 text-neutral-500" />
                      <span>Участники и статусы приглашений</span>
                    </div>
                    <div className="space-y-2">
                      {selectedScheduledMeeting.participants.map((p) => {
                        const inv = meetingInvitations.find((i) => surnameKey(i.recipientName) === surnameKey(p));
                        return (
                          <div key={p} className="flex items-center justify-between text-xs p-2 rounded bg-neutral-50 dark:bg-[#101217] border border-neutral-200/70 dark:border-[#1f232e]">
                            <span className="font-medium text-neutral-900 dark:text-neutral-200">{p}</span>
                            {inv ? (
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                  inv.status === 'accepted'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : inv.status === 'declined'
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {inv.status === 'accepted' ? 'Принято' : inv.status === 'declined' ? 'Отклонено' : 'Ожидает ответа'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-neutral-500">Организатор / без аккаунта</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100 pb-2 border-b border-neutral-100 dark:border-[#1d2028]">
                      <FileText className="w-4 h-4 text-neutral-500" />
                      <span>Утвержденный проект повестки</span>
                    </div>
                    <ul className="space-y-2 text-xs text-neutral-800 dark:text-neutral-200">
                      {selectedScheduledMeeting.agenda.map((item, idx) => (
                        <li key={idx} className="p-2 rounded bg-neutral-50 dark:bg-[#101217] border border-neutral-200/60 dark:border-[#1f232e]">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {selectedScheduledMeeting.openQuestions && selectedScheduledMeeting.openQuestions.length > 0 && (
                  <div className="p-4 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] space-y-2.5">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      Открытые вопросы к обсуждению
                    </div>
                    <ul className="space-y-1.5 text-xs text-amber-900 dark:text-amber-300">
                      {selectedScheduledMeeting.openQuestions.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      Открытые поручения участников из реестра ({relatedTasks.length})
                    </div>
                  </div>
                  {relatedTasks.length === 0 ? (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      У выбранных участников нет незавершенных поручений в реестре.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {relatedTasks.map((t) => (
                        <div key={t.id} className="p-2.5 rounded bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#202430] flex items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-neutral-100">{t.title}</div>
                            <div className="text-[11px] text-neutral-500 mt-0.5">
                              Ответственный: {t.assigneeName} · Срок: {t.deadline}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 shrink-0">
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })() : (
          <>
            {/* Left Pane: Transcript */}
            {showTranscript ? (
          <div className="w-[420px] border-r border-neutral-200 dark:border-[#212530] flex flex-col bg-white dark:bg-[#111318] shrink-0 transition-all">
            <div className="p-3.5 px-4 border-b border-neutral-200 dark:border-[#212530] flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
              <div className="flex items-center gap-2 font-medium">
                <FileText className="w-3.5 h-3.5 text-neutral-500" />
                <span className="font-semibold text-neutral-900 dark:text-neutral-200">Стенограмма записи</span>
                <span className="text-[11px] font-mono text-neutral-400">({currentTranscript.date})</span>
              </div>
              <button
                onClick={() => setShowTranscript(false)}
                title="Скрыть панель стенограммы"
                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#1a1d25] rounded transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            <div
              id={`transcript-${currentTranscript.id}`}
              className="flex-1 overflow-y-auto p-3 space-y-1 select-text"
            >
              {currentTranscript.content.split('\n').map((line, idx) => {
                const match = line.match(/^(\[\d\d:\d\d\])\s+([^:]+):\s*(.*)$/);
                if (match) {
                  const [, time, speaker, text] = match;
                  // Derive 2-letter initials from speaker
                  const initials = speaker.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('');

                  return (
                    <div
                      key={idx}
                      className="group px-3 py-2 rounded-md hover:bg-neutral-100/70 dark:hover:bg-[#161922] transition-colors border-l-2 border-transparent hover:border-sky-500 flex items-start gap-3"
                    >
                      {/* Monospace Timecode */}
                      <div className="shrink-0 pt-0.5">
                        <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500 group-hover:text-sky-500 transition-colors select-none tracking-tight">
                          {time}
                        </span>
                      </div>

                      {/* Speaker & Spoken Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-mono font-bold bg-neutral-200/80 dark:bg-[#202533] text-neutral-700 dark:text-neutral-300">
                            {initials}
                          </span>
                          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-200 font-sans tracking-tight">
                            {speaker}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans font-normal selection:bg-sky-500/20">
                          {text}
                        </p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="px-3 py-1 text-xs text-neutral-400 italic font-sans">
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="w-12 border-r border-neutral-200 dark:border-[#212530] bg-white dark:bg-[#111318] flex flex-col items-center py-4 shrink-0">
            <button
              onClick={() => setShowTranscript(true)}
              title="Показать стенограмму встречи"
              className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1a1d25] rounded-md transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-medium text-neutral-400 [writing-mode:vertical-rl] rotate-180 mt-4 tracking-wider uppercase select-none font-mono">
              Стенограмма
            </span>
          </div>
        )}

        {/* Right Pane: Summary, Decisions, Risks & Staged Tasks */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6 lg:p-8">
          <div className="max-w-5xl mx-auto w-full space-y-6">
            {/* Context Header for Protocol */}
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-200 dark:border-[#212530]">
              <div>
                <div className="text-xs text-neutral-400 font-mono">
                  Протокол № {currentTranscript.id} · {currentTranscript.date}
                </div>
                <h2 className="text-base font-bold text-neutral-950 dark:text-white mt-0.5 tracking-tight">
                  {currentTranscript.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunAiAnalysis}
                  disabled={isAnalyzing}
                  title={backendOnline ? 'Запустить автоматический анализ стенограммы' : 'AI-анализ стенограммы'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition-all shadow-sm disabled:opacity-50"
                >
                  <Cpu className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzing ? 'Анализ...' : 'Анализ стенограммы'}</span>
                </button>

                <button
                  onClick={handleSaveProtocol}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-neutral-300 dark:border-[#2c3242] bg-white dark:bg-[#15171e] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-[#1d212b] transition-colors"
                  title="Сохранить протокол со ссылкой на исходную расшифровку"
                >
                  <Bookmark className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Сохранить протокол</span>
                </button>
              </div>
            </div>

            {/* Summary Box */}
            <div className="p-4 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] border-l-4 border-l-sky-500 space-y-1.5">
              <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                Краткое резюме встречи
              </div>
              <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans">{currentTranscript.summary}</p>
            </div>

            {/* Decisions & Risks Cards Grid (Scenario 3 Requirement) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Decisions Card */}
              <div className="p-4 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#1d2028]">
                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Принятые решения
                  </h3>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {currentTranscript.decisions.length} решения
                  </span>
                </div>

                <div className="space-y-2.5">
                  {currentTranscript.decisions.map((d) => (
                    <div key={d.id} className="flex items-start gap-2.5 text-xs text-neutral-800 dark:text-neutral-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1 leading-snug">
                        <span>{d.text}</span>
                        {d.speaker && (
                          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 ml-1.5 font-medium">({d.speaker})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risks Card */}
              <div className="p-4 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#1d2028]">
                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Карта выявленных рисков
                  </h3>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {currentTranscript.risks?.length || 0} риска
                  </span>
                </div>

                <div className="space-y-2">
                  {currentTranscript.risks && currentTranscript.risks.length > 0 ? (
                    currentTranscript.risks.map((r) => (
                      <div key={r.id} className="p-2.5 rounded bg-amber-500/[0.04] dark:bg-amber-500/[0.07] border border-amber-500/20 text-xs space-y-1">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
                          <span>{r.riskDescription}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold uppercase">
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
            <div className="p-5 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-[#1d2028]">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Поручения к утверждению в реестр
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Проверьте исполнителя и дедлайн перед фиксацией в корпоративном журнале
                  </p>
                </div>

                <button
                  onClick={handleAddTask}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-[#1b1f28] hover:bg-neutral-200 dark:hover:bg-[#232834] rounded-md transition-colors border border-neutral-200 dark:border-[#2b3040]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить</span>
                </button>
              </div>

              {tasksToReview.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-[#222631] rounded-lg">
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
                        className="bg-neutral-50/70 dark:bg-[#101217] p-3.5 rounded-lg border border-neutral-200 dark:border-[#222631] space-y-3"
                      >
                        {/* Title */}
                        <div className="flex items-start justify-between gap-3">
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => handleUpdateTask(idx, 'title', e.target.value)}
                            className="flex-1 bg-transparent font-medium text-xs text-neutral-950 dark:text-neutral-100 border-b border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-sky-500 focus:outline-none pb-0.5"
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] text-neutral-500 dark:text-neutral-400">Ответственный:</label>
                              {isUnassigned && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                                  Требуется назначение
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={task.assigneeName}
                              onChange={(e) => handleUpdateTask(idx, 'assigneeName', e.target.value)}
                              className={`w-full bg-white dark:bg-[#161820] px-3 py-1.5 rounded text-xs text-neutral-900 dark:text-neutral-200 border focus:outline-none ${
                                isUnassigned
                                  ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200'
                                  : 'border-neutral-200 dark:border-[#282d3b] focus:border-sky-500'
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] text-neutral-500 dark:text-neutral-400">Срок исполнения:</label>
                              {isNoDeadline && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                                  Требуется срок
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={task.deadline}
                              onChange={(e) => handleUpdateTask(idx, 'deadline', e.target.value)}
                              className={`w-full bg-white dark:bg-[#161820] px-3 py-1.5 rounded text-xs text-neutral-900 dark:text-neutral-200 border focus:outline-none ${
                                isNoDeadline
                                  ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200'
                                  : 'border-neutral-200 dark:border-[#282d3b] focus:border-sky-500'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Citation */}
                        {task.sourceQuote && (
                          <div className="text-[11px] text-neutral-600 dark:text-neutral-400 bg-white dark:bg-[#15171e] p-2 rounded border border-neutral-200/80 dark:border-[#1f232e] flex items-center justify-between italic">
                            <span>Основание: «{task.sourceQuote}»</span>
                            {task.timestamp && (
                              <span className="font-mono not-italic shrink-0 ml-2 text-neutral-400 font-normal">
                                {task.timestamp}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Confirm & Reject Buttons */}
                  <div className="pt-3 flex items-center justify-end gap-2.5">
                    <button
                      onClick={handleReject}
                      className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-[#1a1d25] hover:bg-neutral-200 dark:hover:bg-[#232733] rounded-md transition-colors"
                    >
                      Отклонить все
                    </button>

                    <button
                      onClick={handleApprove}
                      className="px-5 py-2 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 rounded-md shadow-sm transition-all flex items-center gap-2"
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
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SCENARIO 1 & 2: MODAL ДЛЯ ПОДГОТОВКИ ВСТРЕЧИ И КАЛЕНДАРЯ                  */}
      {/* ========================================================================= */}
      {isPrepModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] max-w-3xl w-full p-6 rounded-lg shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-[#212530]">
              <div>
                <div className="text-[11px] font-mono font-semibold text-neutral-500 dark:text-neutral-400 mb-1">
                  {prepStep === 'setup'
                    ? 'Шаг 1 из 2 · Подготовка повестки, документов, задач и слотов'
                    : 'Шаг 2 из 2 · Предпросмотр письма-приглашения и явное подтверждение (AI-03)'}
                </div>
                <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                  {prepStep === 'setup'
                    ? 'Подготовка совещания и подбор слота календаря'
                    : 'Подтверждение создания встречи и рассылки приглашений'}
                </h2>
              </div>

              <button
                onClick={() => setIsPrepModalOpen(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#1a1d25] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {prepStep === 'setup' ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                      Тема встречи:
                    </label>
                    <input
                      type="text"
                      value={prepTopic}
                      onChange={(e) => setPrepTopic(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-[#181a22] border border-neutral-200 dark:border-[#282d3b] px-3.5 py-2 rounded-md text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Interactive Participant Checkboxes */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          Участники ({prepParticipants.length}):
                        </label>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {participantsCatalog.map((p) => {
                          const checked = prepParticipants.includes(p.shortName);
                          const isSelf = surnameKey(p.name) === currentUserSurname;
                          return (
                            <label
                              key={p.id}
                              className={`flex items-start gap-2.5 p-2 rounded border cursor-pointer transition-colors text-xs ${
                                checked
                                  ? 'bg-sky-500/[0.06] border-sky-500/40 text-neutral-950 dark:text-white'
                                  : 'bg-neutral-50 dark:bg-[#181a22] border-neutral-200/80 dark:border-[#222631] text-neutral-600 dark:text-neutral-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleParticipant(p.shortName)}
                                className="mt-0.5 rounded border-neutral-300"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium flex items-center gap-1.5">
                                  <span>{p.shortName}</span>
                                  {isSelf && (
                                    <span className="text-[10px] font-mono px-1 rounded bg-neutral-200 dark:bg-neutral-700">
                                      Вы
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                                  {p.roleTitle}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Interactive RBAC-filtered Document Checkboxes */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          Разрешенные документы базы ({selectedDocIds.length}/{documents.length}):
                        </label>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {documents.map((doc) => {
                          const checked = selectedDocIds.includes(doc.id);
                          return (
                            <label
                              key={doc.id}
                              className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors text-xs ${
                                checked
                                  ? 'bg-sky-500/[0.06] border-sky-500/40 text-neutral-950 dark:text-white'
                                  : 'bg-neutral-50 dark:bg-[#181a22] border-neutral-200/80 dark:border-[#222631] text-neutral-600 dark:text-neutral-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDocSelection(doc.id)}
                                className="mt-0.5 rounded border-neutral-300"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-medium leading-snug line-clamp-2">{doc.title}</div>
                                <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                                  {doc.category} · {doc.date}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateAgenda}
                    disabled={isAiGeneratingAgenda}
                    className="w-full py-2 px-4 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1b1f28] dark:hover:bg-[#232834] border border-neutral-300 dark:border-[#2b3040] flex items-center justify-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100 transition-colors disabled:opacity-50"
                  >
                    <Cpu className={`w-3.5 h-3.5 ${isAiGeneratingAgenda ? 'animate-spin' : ''}`} />
                    <span>
                      {isAiGeneratingAgenda
                        ? 'AI анализирует документы и открытые задачи из PostgreSQL...'
                        : 'Сформировать проект повестки, открытые задачи и вопросы (AI)'}
                    </span>
                  </button>

                  {prepError && (
                    <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{prepError}</span>
                    </div>
                  )}

                  {/* AI + PostgreSQL Generated Results */}
                  <div className="p-3.5 rounded-md bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#222631] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        Проект повестки:
                      </div>
                      {generatedAgenda.modelUsed && (
                        <span className="text-[10px] font-mono text-neutral-400">
                          Модель: {generatedAgenda.modelUsed}
                        </span>
                      )}
                    </div>

                    {generatedAgenda.agenda.length === 0 ? (
                      <div className="text-xs text-neutral-400 italic">
                        Нажмите кнопку выше, чтобы Qwen 2.5 сформировал повестку по выбранным документам и открытым задачам из БД.
                      </div>
                    ) : (
                      <ul className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1 pl-1">
                        {generatedAgenda.agenda.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}

                    {generatedAgenda.openTasks.length > 0 && (
                      <div className="pt-2 border-t border-neutral-200 dark:border-[#222631]">
                        <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5">
                          Открытые задачи выбранных участников (из БД):
                        </div>
                        <div className="space-y-1.5">
                          {generatedAgenda.openTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-2 rounded bg-white dark:bg-[#151821] border border-neutral-200 dark:border-[#222631] flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                  {task.title}
                                </div>
                                <div className="text-neutral-500 font-mono">
                                  {task.assigneeName} · до {task.deadline}
                                </div>
                              </div>
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono text-[10px] shrink-0 ${
                                  task.status === 'overdue'
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                    : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                }`}
                              >
                                {task.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {generatedAgenda.openQuestions.length > 0 && (
                      <div className="pt-2 border-t border-neutral-200 dark:border-[#222631]">
                        <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                          Открытые вопросы к обсуждению:
                        </div>
                        <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1 pl-1 font-medium">
                          {generatedAgenda.openQuestions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2 inline: Calendar Slots */}
                <div className="space-y-3 pt-3 border-t border-neutral-200 dark:border-[#212530]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 font-mono uppercase tracking-wider">
                      Свободные слоты в календаре
                    </h3>
                    <span className="text-[11px] font-mono text-neutral-500">
                      Доступно {calendarSlots.filter((s) => s.isAvailable).length} из {calendarSlots.length} слотов
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {calendarSlots.map((slot) => {
                      const isSelected = selectedSlotId === slot.id && slot.isAvailable;
                      const freeSet = new Set(slot.participantsFree.map(surnameKey));
                      const busySelected = prepParticipants.filter((p) => !freeSet.has(surnameKey(p)));

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => slot.isAvailable && setSelectedSlotId(slot.id)}
                          className={`p-3 rounded-md text-left transition-colors text-xs flex flex-col justify-between gap-1.5 border ${
                            !slot.isAvailable
                              ? 'opacity-55 cursor-not-allowed border-neutral-200 dark:border-[#1e222c] bg-neutral-100 dark:bg-[#101217]'
                              : isSelected
                              ? 'border-neutral-950 dark:border-white bg-neutral-100 dark:bg-[#1e222d] ring-1 ring-neutral-950 dark:ring-white cursor-pointer'
                              : 'border-neutral-200 dark:border-[#222631] bg-white dark:bg-[#14161c] hover:border-neutral-300 dark:hover:border-[#2d3240] cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">{slot.date}</span>
                            {!slot.isAvailable ? (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300">
                                Занято
                              </span>
                            ) : (
                              isSelected && <Check className="w-3.5 h-3.5 text-neutral-900 dark:text-white" />
                            )}
                          </div>

                          <div className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">
                            {slot.startTime} – {slot.endTime}
                          </div>

                          {!slot.isAvailable ? (
                            <div className="text-[10px] text-neutral-500">Слот забронирован</div>
                          ) : busySelected.length === 0 ? (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              ✓ Все выбранные свободны
                            </div>
                          ) : (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              Занят(ы): {busySelected.join(', ')}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-neutral-200 dark:border-[#212530]">
                  <button
                    type="button"
                    onClick={() => setIsPrepModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-[#1a1d25] rounded-md transition-colors"
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    onClick={handleProceedToPreview}
                    disabled={!selectedSlot || !selectedSlot.isAvailable}
                    className="px-4 py-1.5 text-xs font-semibold bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 text-white rounded-md flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <span>Далее: предпросмотр приглашения</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: Explicit Preview & Confirmation (AI-03) */
              <div className="space-y-4">
                <div className="p-3 rounded bg-emerald-500/[0.06] border border-emerald-500/25 text-xs text-neutral-800 dark:text-neutral-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed text-[11px]">
                    <strong>Подтверждение действия (AI-03):</strong> Проверьте детали события и текст приглашения. Запись в календарь и отправка уведомлений выполнятся только после нажатия «Подтвердить и отправить».
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#222631]">
                    <div className="text-[11px] font-mono text-neutral-500 mb-1">Событие и время</div>
                    <div className="font-semibold text-neutral-950 dark:text-white">{prepTopic}</div>
                    <div className="text-neutral-600 dark:text-neutral-300 mt-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      <span>
                        {selectedSlot?.date} · {selectedSlot?.startTime}–{selectedSlot?.endTime}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#222631]">
                    <div className="text-[11px] font-mono text-neutral-500 mb-1">Получатели приглашений</div>
                    {prepParticipants.filter((p) => surnameKey(p) !== currentUserSurname).length === 0 ? (
                      <div className="text-amber-700 dark:text-amber-300 text-[11px]">
                        Другие участники не выбраны — приглашения отправлены не будут (встреча только в вашем календаре).
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {prepParticipants
                          .filter((p) => surnameKey(p) !== currentUserSurname)
                          .map((recipient) => (
                            <span
                              key={recipient}
                              className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 text-[11px] font-medium"
                            >
                              {recipient}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
                    Текст письма-приглашения (можно отредактировать перед отправкой):
                  </label>
                  <textarea
                    rows={7}
                    value={invitationText}
                    onChange={(e) => setInvitationText(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#282d3b] p-3 rounded-md text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500 leading-relaxed"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between gap-2.5 border-t border-neutral-200 dark:border-[#212530]">
                  <button
                    type="button"
                    onClick={() => setPrepStep('setup')}
                    className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-[#1a1d25] hover:bg-neutral-200 dark:hover:bg-[#232834] rounded-md flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Назад</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPrepModalOpen(false)}
                      className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-[#1a1d25] rounded-md transition-colors"
                    >
                      Отмена
                    </button>

                    <button
                      type="button"
                      disabled={isCreatingMeeting}
                      onClick={handleConfirmMeetingCreation}
                      className="px-4 py-1.5 text-xs font-semibold bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 text-white rounded-md flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{isCreatingMeeting ? 'Сохранение...' : 'Подтвердить и отправить приглашения'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IN-APP INVITATIONS INBOX MODAL (AI-03 / RBAC DEMO)                        */}
      {/* ========================================================================= */}
      {isInvitationsOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] max-w-2xl w-full p-6 rounded-lg shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-[#212530]">
              <div>
                <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                  Текущий пользователь: {currentUser.name}
                </div>
                <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                  Приглашения на совещания
                </h2>
              </div>

              <button
                onClick={() => setIsInvitationsOpen(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#1a1d25]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#212530] pb-2">
              <button
                type="button"
                onClick={() => setInvTab('incoming')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  invTab === 'incoming'
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#1a1d25]'
                }`}
              >
                Входящие мне ({incomingInvitations.length})
              </button>
              <button
                type="button"
                onClick={() => setInvTab('all')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  invTab === 'all'
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#1a1d25]'
                }`}
              >
                Все отправленные ({invitations.length})
              </button>
            </div>

            {(() => {
              const list = invTab === 'incoming' ? incomingInvitations : invitations;
              if (list.length === 0) {
                return (
                  <div className="py-10 text-center text-xs text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-[#222631] rounded-lg">
                    {invTab === 'incoming'
                      ? 'У текущей роли пока нет входящих приглашений. Создайте встречу и переключитесь на приглашенного руководителя (например, Иванов И.С. или Ковалева Е.Д.).'
                      : 'Отправленных приглашений пока нет.'}
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {list.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-4 rounded-lg bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#222631] space-y-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-neutral-950 dark:text-white">{inv.meetingTitle}</div>
                          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">
                            {inv.date} · {inv.time} · Организатор: {inv.organizerName}
                          </div>
                          <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                            Получатель: <span className="font-medium">{inv.recipientName}</span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${
                            inv.status === 'accepted'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : inv.status === 'declined'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {inv.status === 'accepted' ? 'Принято' : inv.status === 'declined' ? 'Отклонено' : 'Ожидает'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded bg-white dark:bg-[#14161c] border border-neutral-200/80 dark:border-[#1f232e] whitespace-pre-wrap text-[11px] text-neutral-700 dark:text-neutral-300">
                        {inv.messageText}
                      </div>

                      {invTab === 'incoming' && inv.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => respondToInvitation(inv.id, 'declined')}
                            className="px-3 py-1.5 rounded text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 transition-colors"
                          >
                            Отклонить
                          </button>
                          <button
                            type="button"
                            onClick={() => respondToInvitation(inv.id, 'accepted')}
                            className="px-3.5 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            Принять приглашение
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
