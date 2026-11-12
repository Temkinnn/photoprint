import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_TRANSCRIPTS } from '../mock/mockData';
import {
  DecisionCategory,
  DecisionItem,
  OpenTaskSummary,
  ProtocolAnalysisResult,
  RAGMessage,
  RiskItem,
  TaskItem,
} from '../types';
import {
  CheckCircle2,
  Plus,
  Trash2,
  Cpu,
  ChevronDown,
  Calendar,
  AlertTriangle,
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
  ArrowRight,
  Mic,
  Upload,
  Edit3,
  HelpCircle,
  MessageSquare,
  Play,
  Pause,
  ArrowUpRight,
} from 'lucide-react';

const surnameKey = (name: string): string => {
  const cleaned = (name || '').split('(')[0].trim();
  const first = cleaned.split(/\s+/)[0] || '';
  return first.toLowerCase();
};

const normalizeTs = (ts?: string | null): string => {
  return (ts || '').replace(/[\[\]]/g, '').trim();
};

const DECISION_CATEGORY_META: Record<
  DecisionCategory,
  { label: string; dotColor: string; pillClass: string }
> = {
  resolved: {
    label: 'Решено',
    dotColor: 'bg-emerald-500',
    pillClass: 'bg-emerald-500/15 text-emerald-500',
  },
  proposed: {
    label: 'Предложено',
    dotColor: 'bg-sky-500',
    pillClass: 'bg-sky-500/15 text-sky-500',
  },
  discussed: {
    label: 'Обсуждалось',
    dotColor: 'bg-[var(--text-muted)]',
    pillClass: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
  },
  needs_clarification: {
    label: 'Требует уточнения',
    dotColor: 'bg-amber-500',
    pillClass: 'bg-amber-500/15 text-amber-500',
  },
};

interface ActiveProtocolWorkspace {
  id: string;
  meetingId?: string;
  savedProtocolId?: string;
  title: string;
  date: string;
  transcriptRef: string;
  transcriptText: string;
  summary: string;
  decisions: DecisionItem[];
  risks: RiskItem[];
  openQuestions: string[];
  processingTimeSec?: number | null;
  modelUsed?: string | null;
}

export const MeetingsView: React.FC = () => {
  const {
    batchApproveTasks,
    logAudit,
    showToast,
    startBackgroundAudioTranscription,
    audioJob,
    markAudioJobApplied,
    clearAudioJob,
    startBackgroundTranscriptAnalysis,
    analysisJob,
    markAnalysisJobApplied,
    clearAnalysisJob,
    uploadMeetingTranscript,
    saveMeetingProtocol,
    protocols,
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
    setActiveTab,
    queryRAG,
    setRagMessages,
  } = useApp();

  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string>(MOCK_TRANSCRIPTS[0].id);
  const scheduledList = scheduledMeetings.filter(
    (m) => m.status === 'scheduled' || m.status === 'completed'
  );
  const selectedMeetingItem = scheduledList.find((m) => m.id === selectedTranscriptId) || null;
  const standaloneProtocols = protocols.filter(
    (p) => !p.meetingId || !scheduledList.some((m) => m.id === p.meetingId)
  );

  const [showScheduledProtocolWorkspace, setShowScheduledProtocolWorkspace] =
    useState<boolean>(false);
  const [workspaceData, setWorkspaceData] = useState<ActiveProtocolWorkspace>(() => {
    const first = MOCK_TRANSCRIPTS[0];
    return {
      id: first.id,
      title: first.title,
      date: first.date,
      transcriptRef: `#transcript-${first.id}`,
      transcriptText: first.content,
      summary: first.summary,
      decisions: first.decisions,
      risks: first.risks || [],
      openQuestions: [],
    };
  });

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzingLabel, setAnalyzingLabel] = useState<string>('Анализ...');
  const busyAnalyzing = isAnalyzing || analysisJob?.status === 'analyzing';
  const busyLabel = isAnalyzing ? analyzingLabel : 'Qwen 2.5 анализирует...';
  const [isSavingProtocol, setIsSavingProtocol] = useState<boolean>(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState<boolean>(false);
  const [decisionFilter, setDecisionFilter] = useState<DecisionCategory | 'all'>('all');
  const [highlightedTimestamp, setHighlightedTimestamp] = useState<string | null>(null);

  // Interactive transcript audio mini-player state
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [activeAudioTime, setActiveAudioTime] = useState<string>('00:01');

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const transcriptInputRef = useRef<HTMLInputElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  const [tasksToReview, setTasksToReview] = useState<Omit<TaskItem, 'id'>[]>(
    MOCK_TRANSCRIPTS[0].stagedTasks.map((t) => ({
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

  // Preparation, Calendar Booking and Preview Confirmation Modal
  const [isPrepModalOpen, setIsPrepModalOpen] = useState<boolean>(false);
  const [prepStep, setPrepStep] = useState<'setup' | 'preview'>('setup');
  const [prepTopic, setPrepTopic] = useState<string>(
    'Ввод в эксплуатацию ЦПМ Canon imagePRESS V1000'
  );
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

  useEffect(() => {
    if (!audioJob) return;
    if (audioJob.status === 'transcribing') {
      setSelectedTranscriptId(audioJob.targetId);
      setShowScheduledProtocolWorkspace(true);
      setShowTranscript(true);
      setWorkspaceData((prev) => {
        if (prev.transcriptRef === `#audio-${audioJob.filename}`) return prev;
        return {
          id: audioJob.meetingId || audioJob.id,
          meetingId: audioJob.meetingId,
          title: audioJob.meetingTitle,
          date: audioJob.date,
          transcriptRef: `#audio-${audioJob.filename}`,
          transcriptText:
            `⏳ Whisper распознаёт аудио «${audioJob.filename}» в фоне...\n\n` +
            'Можете перейти в «Базу знаний» для демонстрации поиска по регламентам и ролевой защиты. ' +
            'Как только вернётесь сюда, готовая расшифровка будет ждать в этом окне.',
          summary: 'Идёт фоновая транскрибация аудиозаписи через Whisper STT...',
          decisions: [],
          risks: [],
          openQuestions: [],
          processingTimeSec: null,
          modelUsed: 'Whisper STT (в фоне)',
        };
      });
      return;
    }

    if (audioJob.status === 'ready' && !audioJob.applied && audioJob.transcriptText) {
      setSelectedTranscriptId(audioJob.targetId);
      setShowScheduledProtocolWorkspace(true);
      setShowTranscript(true);
      setIsEditingTranscript(false);
      setWorkspaceData({
        id: audioJob.meetingId || audioJob.id,
        meetingId: audioJob.meetingId,
        title: audioJob.meetingTitle,
        date: audioJob.date,
        transcriptRef: `#audio-${audioJob.filename}`,
        transcriptText: audioJob.transcriptText,
        summary:
          'Расшифровка аудио завершена. Проверьте текст стенограммы слева и нажмите «2. AI-анализ».',
        decisions: [],
        risks: [],
        openQuestions: [],
        processingTimeSec: audioJob.durationSec ?? null,
        modelUsed: audioJob.modelUsed || 'Whisper STT',
      });
      setTasksToReview([]);
      markAudioJobApplied(audioJob.id);
    }
  }, [audioJob, markAudioJobApplied]);

  useEffect(() => {
    if (!analysisJob) return;
    if (analysisJob.status === 'analyzing') {
      setSelectedTranscriptId(analysisJob.targetId);
      setShowScheduledProtocolWorkspace(true);
      setShowTranscript(true);
      setIsEditingTranscript(false);
      setWorkspaceData((prev) => {
        if (
          prev.transcriptRef === analysisJob.transcriptRef &&
          prev.modelUsed === 'Qwen 2.5 (в фоне)'
        ) {
          return prev;
        }
        return {
          id: analysisJob.meetingId || analysisJob.workspaceId,
          meetingId: analysisJob.meetingId,
          title: analysisJob.meetingTitle,
          date: analysisJob.date,
          transcriptRef: analysisJob.transcriptRef,
          transcriptText: analysisJob.transcriptText,
          summary: '⏳ Идёт фоновый AI-анализ стенограммы моделью Qwen 2.5...',
          decisions: [],
          risks: [],
          openQuestions: [],
          processingTimeSec: null,
          modelUsed: 'Qwen 2.5 (в фоне)',
        };
      });
      return;
    }

    if (
      analysisJob.status === 'ready' &&
      analysisJob.result &&
      (!analysisJob.applied ||
        workspaceData.transcriptRef !== analysisJob.transcriptRef ||
        workspaceData.decisions.length === 0)
    ) {
      setSelectedTranscriptId(analysisJob.targetId);
      setShowScheduledProtocolWorkspace(true);
      setShowTranscript(true);
      setIsEditingTranscript(false);
      applyAnalysisResult(analysisJob.result, {
        id: analysisJob.meetingId || analysisJob.workspaceId,
        meetingId: analysisJob.meetingId,
        date: analysisJob.date,
        transcriptRef: analysisJob.transcriptRef,
        fallbackText: analysisJob.transcriptText,
      });
      if (audioJob?.status === 'ready') {
        clearAudioJob();
      }
      if (!analysisJob.applied) {
        markAnalysisJobApplied(analysisJob.id);
      }
    }
  }, [analysisJob, audioJob?.status, clearAudioJob, markAnalysisJobApplied]);

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
        `Проанализировано ${res.usedDocuments.length} док. и ${res.openTasks.length} открытых задач`,
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
      setShowScheduledProtocolWorkspace(false);
      setIsPrepModalOpen(false);
      setPrepStep('setup');
    } catch (err: any) {
      showToast('Ошибка создания встречи', err?.message || 'Не удалось создать встречу', 'error');
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const applyAnalysisResult = (
    res: ProtocolAnalysisResult,
    meta: {
      id: string;
      meetingId?: string;
      date: string;
      transcriptRef: string;
      fallbackText?: string;
    }
  ) => {
    setWorkspaceData({
      id: meta.id,
      meetingId: meta.meetingId,
      title: res.meetingTitle || workspaceData.title,
      date: meta.date,
      transcriptRef: meta.transcriptRef,
      transcriptText: res.transcriptText || meta.fallbackText || workspaceData.transcriptText,
      summary: res.summary,
      decisions: res.decisions || [],
      risks: res.risks || [],
      openQuestions: res.openQuestions || [],
      processingTimeSec: res.processingTimeSec ?? null,
      modelUsed: res.modelUsed ?? null,
    });
    setTasksToReview(
      (res.tasks || []).map((t) => ({
        title: t.title,
        assigneeName: t.assigneeName,
        deadline: t.deadline,
        sourceQuote: t.sourceQuote,
        timestamp: t.timestamp || '00:00',
        status: 'pending_approval' as const,
      }))
    );
    setShowScheduledProtocolWorkspace(true);
    setIsEditingTranscript(false);
    setDecisionFilter('all');
    setHighlightedTimestamp(null);
  };

  const handleSaveProtocol = async () => {
    if (!workspaceData.summary.trim() && workspaceData.decisions.length === 0) {
      showToast(
        'Нечего сохранять',
        'Сначала выполните анализ стенограммы или аудиозаписи',
        'warning'
      );
      return;
    }
    setIsSavingProtocol(true);
    try {
      const saved = await saveMeetingProtocol({
        meetingId: workspaceData.meetingId,
        meetingTitle: workspaceData.title,
        transcriptRef: workspaceData.transcriptRef,
        transcriptText: workspaceData.transcriptText,
        summary: workspaceData.summary,
        decisions: workspaceData.decisions,
        risks: workspaceData.risks,
        openQuestions: workspaceData.openQuestions,
        processingTimeSec: workspaceData.processingTimeSec,
      });
      setWorkspaceData((prev) => ({
        ...prev,
        id: saved.id,
        savedProtocolId: saved.id,
      }));
    } catch (err: any) {
      showToast('Ошибка сохранения', err?.message || 'Не удалось сохранить протокол в БД', 'error');
    } finally {
      setIsSavingProtocol(false);
    }
  };

  const handleRunAiAnalysis = () => {
    const textToAnalyze = workspaceData.transcriptText.trim();
    if (!textToAnalyze || textToAnalyze.startsWith('⏳')) {
      showToast(
        'Стенограмма ещё не готова',
        textToAnalyze.startsWith('⏳')
          ? 'Дождитесь завершения распознавания речи Whisper.'
          : 'Вставьте текст или загрузите файл стенограммы/аудио',
        'warning'
      );
      return;
    }
    if (analysisJob?.status === 'analyzing') {
      showToast('Анализ уже выполняется', 'Дождитесь завершения текущей обработки.', 'info');
      return;
    }
    if (audioJob?.status === 'ready') {
      clearAudioJob();
    }
    setWorkspaceData((prev) => ({
      ...prev,
      summary: '⏳ Идёт фоновый AI-анализ стенограммы моделью Qwen 2.5...',
      decisions: [],
      risks: [],
      openQuestions: [],
      processingTimeSec: null,
      modelUsed: 'Qwen 2.5 (в фоне)',
    }));
    setTasksToReview([]);
    startBackgroundTranscriptAnalysis({
      targetId: selectedTranscriptId,
      workspaceId: workspaceData.id,
      meetingId: workspaceData.meetingId,
      meetingTitle: workspaceData.title,
      date: workspaceData.date,
      transcriptRef: workspaceData.transcriptRef,
      transcriptText: textToAnalyze,
    });
    showToast(
      'AI-анализ запущен в фоне',
      'Можете переключаться между экранами — готовый протокол появится автоматически.',
      'info'
    );
  };

  const handleAudioFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (analysisJob && analysisJob.status !== 'analyzing') {
      clearAnalysisJob();
    }

    const targetMeeting = selectedMeetingItem;
    const isAdHoc = !targetMeeting && selectedTranscriptId === 'ad-hoc-new';
    const targetId = targetMeeting ? targetMeeting.id : 'ad-hoc-new';
    const title =
      targetMeeting?.title ||
      (isAdHoc
        ? file.name.replace(/\.[^.]+$/, '')
        : workspaceData.title || file.name.replace(/\.[^.]+$/, ''));
    const today = targetMeeting?.date || new Date().toISOString().slice(0, 10);

    setSelectedTranscriptId(targetId);
    setShowScheduledProtocolWorkspace(true);
    setShowTranscript(true);
    setIsEditingTranscript(false);
    setWorkspaceData({
      id: targetMeeting?.id || `audio-${Date.now()}`,
      meetingId: targetMeeting?.id,
      title,
      date: today,
      transcriptRef: `#audio-${file.name}`,
      transcriptText:
        `⏳ Whisper распознаёт аудио «${file.name}» в фоне...\n\n` +
        'Можете перейти в «Базу знаний» для поиска по регламентам. ' +
        'Как только вернётесь сюда, готовая расшифровка будет ждать в этом окне.',
      summary: 'Идёт фоновая транскрибация аудиозаписи через Whisper STT...',
      decisions: [],
      risks: [],
      openQuestions: [],
      processingTimeSec: null,
      modelUsed: 'Whisper STT (в фоне)',
    });
    setTasksToReview([]);

    startBackgroundAudioTranscription({
      file,
      meetingTitle: title,
      meetingId: targetMeeting?.id,
      targetId,
      date: today,
    });
    showToast(
      'Whisper запущен в фоне',
      `Аудио «${file.name}» расшифровывается. Можно перейти в «Базу знаний» и вернуться позже.`,
      'info'
    );
  };

  const handleTranscriptFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const targetMeeting = selectedMeetingItem;
    const title = targetMeeting?.title || file.name.replace(/\.[^.]+$/, '');
    const today = targetMeeting?.date || new Date().toISOString().slice(0, 10);

    setIsAnalyzing(true);
    setAnalyzingLabel('Анализ файла...');
    showToast('Обработка файла', `Чтение «${file.name}» и анализ стенограммы...`, 'info');
    try {
      const res = await uploadMeetingTranscript(file, title, targetMeeting?.id);
      applyAnalysisResult(res, {
        id: targetMeeting?.id || `upload-${Date.now()}`,
        meetingId: targetMeeting?.id,
        date: today,
        transcriptRef: `#file-${file.name}`,
      });
      showToast(
        'Стенограмма обработана',
        `Выделено решений: ${res.decisions.length}, поручений: ${res.tasks.length}`,
        'success'
      );
    } catch (err: any) {
      showToast(
        'Ошибка чтения файла',
        err?.message || 'Не удалось обработать файл стенограммы',
        'error'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOpenAdHocProtocol = () => {
    const today = new Date().toISOString().slice(0, 10);
    setSelectedTranscriptId('ad-hoc-new');
    setShowScheduledProtocolWorkspace(true);
    setWorkspaceData({
      id: `ad-hoc-${Date.now()}`,
      title: 'Новое оперативное совещание',
      date: today,
      transcriptRef: `#transcript-ad-hoc-${today}`,
      transcriptText:
        '[00:05] Смирнов А.В.: Коллеги, начинаем разбор по текущему тиражу.\n[00:18] Иванов И.С.: Проблема со сроками на участке печати, нужно утвердить ответственных.',
      summary:
        'Черновик протокола. Загрузите аудио (.ogg/.wav/.mp3), файл стенограммы (.txt/.vtt/.docx) или отредактируйте текст слева и нажмите «2. AI-анализ».',
      decisions: [],
      risks: [],
      openQuestions: [],
    });
    setTasksToReview([]);
    setIsEditingTranscript(true);
    setDecisionFilter('all');
    setHighlightedTimestamp(null);
  };

  const handleSwitchToScheduledWorkspace = () => {
    if (!selectedMeetingItem) return;
    const savedProto = selectedMeetingItem.protocolId
      ? protocols.find((p) => p.id === selectedMeetingItem.protocolId)
      : protocols.find((p) => p.meetingId === selectedMeetingItem.id);

    if (savedProto) {
      setWorkspaceData({
        id: savedProto.id,
        meetingId: selectedMeetingItem.id,
        savedProtocolId: savedProto.id,
        title: savedProto.meetingTitle,
        date: selectedMeetingItem.date,
        transcriptRef: savedProto.transcriptRef,
        transcriptText: savedProto.transcriptText,
        summary: savedProto.summary,
        decisions: savedProto.decisions,
        risks: savedProto.risks,
        openQuestions: savedProto.openQuestions || [],
        processingTimeSec: savedProto.processingTimeSec,
      });
      setIsEditingTranscript(false);
    } else {
      const agendaPreview = selectedMeetingItem.agenda
        .map((a, idx) => `[00:0${idx + 1}] Повестка: ${a}`)
        .join('\n');
      setWorkspaceData({
        id: selectedMeetingItem.id,
        meetingId: selectedMeetingItem.id,
        title: selectedMeetingItem.title,
        date: selectedMeetingItem.date,
        transcriptRef: `#meeting-${selectedMeetingItem.id}`,
        transcriptText:
          agendaPreview ||
          `[00:00] ${selectedMeetingItem.participants[0] || 'Руководитель'}: Начинаем совещание «${selectedMeetingItem.title}».`,
        summary:
          'Встреча ещё не обработана. Загрузите аудиозапись, файл стенограммы или вставьте текст совещания слева и запустите AI-анализ.',
        decisions: [],
        risks: [],
        openQuestions: selectedMeetingItem.openQuestions || [],
      });
      setIsEditingTranscript(true);
    }
    setTasksToReview([]);
    setShowScheduledProtocolWorkspace(true);
    setDecisionFilter('all');
    setHighlightedTimestamp(null);
  };

  const handleJumpToTimestamp = (rawTs?: string | null) => {
    const clean = normalizeTs(rawTs);
    if (!clean) return;
    setShowTranscript(true);
    setIsEditingTranscript(false);
    setHighlightedTimestamp(clean);
    setActiveAudioTime(clean);
    setIsPlayingAudio(true);
    setTimeout(() => {
      const container = transcriptContainerRef.current;
      if (!container) return;
      const targetEl = container.querySelector(`[data-ts="${clean}"]`) as HTMLElement | null;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  };

  const handleSelectMeeting = (id: string) => {
    if (analysisJob && analysisJob.status !== 'analyzing' && id !== analysisJob.targetId) {
      clearAnalysisJob();
    }
    setSelectedTranscriptId(id);
    setDecisionFilter('all');
    setHighlightedTimestamp(null);

    if (id === 'ad-hoc-new') {
      handleOpenAdHocProtocol();
      return;
    }

    const meetingObj = scheduledList.find((m) => m.id === id);
    if (meetingObj) {
      const linkedProto = meetingObj.protocolId
        ? protocols.find((p) => p.id === meetingObj.protocolId)
        : protocols.find((p) => p.meetingId === meetingObj.id);
      if (linkedProto) {
        setWorkspaceData({
          id: linkedProto.id,
          meetingId: meetingObj.id,
          savedProtocolId: linkedProto.id,
          title: linkedProto.meetingTitle,
          date: meetingObj.date,
          transcriptRef: linkedProto.transcriptRef,
          transcriptText: linkedProto.transcriptText,
          summary: linkedProto.summary,
          decisions: linkedProto.decisions,
          risks: linkedProto.risks,
          openQuestions: linkedProto.openQuestions || [],
          processingTimeSec: linkedProto.processingTimeSec,
        });
        setShowScheduledProtocolWorkspace(true);
      } else {
        setShowScheduledProtocolWorkspace(false);
      }
      setTasksToReview([]);
      setIsEditingTranscript(false);
      return;
    }

    const protoObj = protocols.find((p) => p.id === id);
    if (protoObj) {
      setWorkspaceData({
        id: protoObj.id,
        meetingId: protoObj.meetingId || undefined,
        savedProtocolId: protoObj.id,
        title: protoObj.meetingTitle,
        date: protoObj.createdAt,
        transcriptRef: protoObj.transcriptRef,
        transcriptText: protoObj.transcriptText,
        summary: protoObj.summary,
        decisions: protoObj.decisions,
        risks: protoObj.risks,
        openQuestions: protoObj.openQuestions || [],
        processingTimeSec: protoObj.processingTimeSec,
      });
      setTasksToReview([]);
      setIsEditingTranscript(false);
      return;
    }

    const found = MOCK_TRANSCRIPTS.find((t) => t.id === id);
    if (found) {
      setWorkspaceData({
        id: found.id,
        title: found.title,
        date: found.date,
        transcriptRef: `#transcript-${found.id}`,
        transcriptText: found.content,
        summary: found.summary,
        decisions: found.decisions,
        risks: found.risks || [],
        openQuestions: [],
      });
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
      setIsEditingTranscript(false);
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

  const handleAddQuestionToTasks = (question: string) => {
    setTasksToReview((prev) => [
      ...prev,
      {
        title: `Проработать вопрос: ${question}`,
        assigneeName: 'Назначить ответственного',
        deadline: 'Завтра, 18:00',
        sourceQuote: 'Из открытых вопросов совещания',
        timestamp: activeAudioTime || '00:00',
        status: 'pending_approval',
      },
    ]);
    showToast('Добавлено в поручения', 'Вопрос перенесён в список к утверждению ниже', 'success');
  };

  const handleSearchQuestionInKB = async (question: string) => {
    const userMsg: RAGMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };
    setRagMessages((prev) => [...prev, userMsg]);
    setActiveTab('knowledge_base');
    try {
      const reply = await queryRAG(question);
      setRagMessages((prev) => [...prev, reply]);
    } catch (err: any) {
      setRagMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'assistant',
          text: err?.message || 'Ошибка поиска по базе регламентов.',
          timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          status: 'needs_clarification',
        },
      ]);
    }
  };

  const handleApprove = () => {
    if (tasksToReview.length === 0) {
      showToast('Нет задач', 'Список задач пуст', 'warning');
      return;
    }
    const protoId = workspaceData.savedProtocolId;
    batchApproveTasks(tasksToReview, workspaceData.title, protoId);
    setTasksToReview([]);
  };

  const handleReject = () => {
    logAudit(
      'REJECT_TASKS',
      `Meeting: ${workspaceData.title}`,
      'REJECTED',
      'Руководитель отклонил черновик поручений. База данных не изменена.'
    );
    setTasksToReview([]);
    showToast('Черновик отклонен', 'Поручения отменены без внесения в реестр', 'warning');
  };

  const cycleSpeed = () => {
    setPlaybackSpeed((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

  const hasTranscriptReady =
    workspaceData.transcriptText.trim().length > 0 &&
    !workspaceData.transcriptText.startsWith('⏳');
  const hasAnalysisReady =
    workspaceData.decisions.length > 0 || Boolean(workspaceData.savedProtocolId);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden transition-colors">
      {/* Hidden File Inputs */}
      <input
        ref={audioInputRef}
        type="file"
        accept=".wav,.ogg,.mp3,.m4a,.flac,.webm"
        className="hidden"
        onChange={handleAudioFileSelected}
      />
      <input
        ref={transcriptInputRef}
        type="file"
        accept=".txt,.vtt,.srt,.docx"
        className="hidden"
        onChange={handleTranscriptFileSelected}
      />

      {/* Top Header */}
      <div className="h-16 px-6 border-b border-[var(--border-solid)] bg-[var(--bg-card)] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-dot text-base uppercase tracking-wider text-[var(--text-primary)] shrink-0">
            СОВЕЩАНИЯ И ПРОТОКОЛЫ
          </h1>

          <span className="text-[var(--text-muted)]">/</span>

          {/* Meeting Selector Capsule */}
          <div className="relative">
            <select
              value={selectedTranscriptId}
              onChange={(e) => handleSelectMeeting(e.target.value)}
              className="bg-[var(--bg-elevated)] border border-[var(--border-solid)] text-[var(--text-primary)] text-xs rounded-full px-4 py-1.5 pr-9 focus:outline-none focus:border-[var(--text-primary)] font-medium appearance-none cursor-pointer max-w-[360px]"
            >
              {selectedTranscriptId === 'ad-hoc-new' && (
                <option value="ad-hoc-new">[Новый протокол] {workspaceData.title}</option>
              )}
              {scheduledList.length > 0 && (
                <optgroup label="Совещания компании">
                  {scheduledList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.status === 'completed' || m.protocolId ? '[Протокол] ' : '[Запланировано] '}
                      {m.title} ({m.date})
                    </option>
                  ))}
                </optgroup>
              )}
              {standaloneProtocols.length > 0 && (
                <optgroup label="Сохранённые протоколы">
                  {standaloneProtocols.map((p) => (
                    <option key={p.id} value={p.id}>
                      [Протокол {p.id}] {p.meetingTitle}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Архив и демо-стенограммы">
                {MOCK_TRANSCRIPTS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenAdHocProtocol}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-all active:scale-95"
            title="Создать новый протокол из аудиозаписи или стенограммы"
          >
            <Mic className="w-3.5 h-3.5 text-[#D71921]" />
            <span>Новый протокол</span>
          </button>

          <button
            onClick={() => setIsInvitationsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-all active:scale-95"
            title="Входящие и отправленные приглашения"
          >
            <Bell className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span>Приглашения</span>
            {pendingIncomingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#D71921] text-white">
                {pendingIncomingCount}
              </span>
            )}
          </button>

          <button
            onClick={openPrepModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 transition-all active:scale-95"
            title="Сформировать повестку и подобрать слот календаря"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Подготовка встречи</span>
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {selectedMeetingItem && !showScheduledProtocolWorkspace ? (() => {
          const meetingInvitations = invitations.filter(
            (inv) => inv.meetingId === selectedMeetingItem.id
          );
          const pSurnames = new Set(selectedMeetingItem.participants.map(surnameKey));
          const relatedTasks = tasks.filter(
            (t) =>
              (t.status === 'active' || t.status === 'overdue') &&
              pSurnames.has(surnameKey(t.assigneeName))
          );

          return (
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <div className="max-w-5xl mx-auto space-y-6">
                {/* Scheduled Meeting Card Header */}
                <div className="nothing-card p-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
                      {/* Flat Non-Clickable Status */}
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-500 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        ЗАПЛАНИРОВАНО
                      </span>
                      <span>{selectedMeetingItem.date}</span>
                      <span>·</span>
                      <span>{selectedMeetingItem.time}</span>
                      <span>·</span>
                      <span>{selectedMeetingItem.durationMinutes} мин</span>
                    </div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)] mt-2">
                      {selectedMeetingItem.title}
                    </h2>
                  </div>

                  {/* Clear Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => audioInputRef.current?.click()}
                      disabled={busyAnalyzing}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      <Mic className={`w-3.5 h-3.5 ${busyAnalyzing ? 'animate-pulse' : ''}`} />
                      <span>{busyAnalyzing ? busyLabel : 'Загрузить аудиозапись'}</span>
                    </button>

                    <button
                      onClick={() => transcriptInputRef.current?.click()}
                      disabled={busyAnalyzing}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-all disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Загрузить стенограмму</span>
                    </button>

                    <button
                      onClick={handleSwitchToScheduledWorkspace}
                      disabled={busyAnalyzing}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-[#D71921] text-white hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Оформить протокол</span>
                    </button>
                  </div>
                </div>

                {/* Participants & Agenda */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="nothing-card p-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-dot uppercase tracking-wider text-[var(--text-primary)] pb-2.5 border-b border-dashed border-[var(--border-dashed)]">
                      <Users className="w-4 h-4 text-[var(--text-secondary)]" />
                      <span>Участники и статусы приглашений</span>
                    </div>
                    <div className="space-y-2">
                      {selectedMeetingItem.participants.map((p) => {
                        const inv = meetingInvitations.find(
                          (i) => surnameKey(i.recipientName) === surnameKey(p)
                        );
                        return (
                          <div
                            key={p}
                            className="flex items-center justify-between text-xs p-3 rounded-2xl bg-[var(--bg-elevated)]"
                          >
                            <span className="font-semibold text-[var(--text-primary)]">{p}</span>
                            {inv ? (
                              <span
                                className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full ${
                                  inv.status === 'accepted'
                                    ? 'bg-emerald-500/15 text-emerald-500'
                                    : inv.status === 'declined'
                                    ? 'bg-[#D71921]/15 text-[#D71921]'
                                    : 'bg-amber-500/15 text-amber-500'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    inv.status === 'accepted'
                                      ? 'bg-emerald-500'
                                      : inv.status === 'declined'
                                      ? 'bg-[#D71921]'
                                      : 'bg-amber-500'
                                  }`}
                                />
                                {inv.status === 'accepted'
                                  ? 'ПРИНЯТО'
                                  : inv.status === 'declined'
                                  ? 'ОТКЛОНЕНО'
                                  : 'ОЖИДАЕТ ОТВЕТА'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                                ОРГАНИЗАТОР
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="nothing-card p-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-dot uppercase tracking-wider text-[var(--text-primary)] pb-2.5 border-b border-dashed border-[var(--border-dashed)]">
                      <FileText className="w-4 h-4 text-[var(--text-secondary)]" />
                      <span>Утвержденный проект повестки</span>
                    </div>
                    <ul className="space-y-2 text-xs text-[var(--text-primary)]">
                      {selectedMeetingItem.agenda.map((item, idx) => (
                        <li key={idx} className="p-3 rounded-2xl bg-[var(--bg-elevated)]">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {selectedMeetingItem.openQuestions &&
                  selectedMeetingItem.openQuestions.length > 0 && (
                    <div className="nothing-card p-5 space-y-2.5">
                      <div className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
                        Открытые вопросы к обсуждению
                      </div>
                      <ul className="space-y-1.5 text-xs text-amber-500">
                        {selectedMeetingItem.openQuestions.map((q, idx) => (
                          <li key={idx} className="p-2.5 rounded-2xl bg-amber-500/10">
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div className="nothing-card p-5 space-y-3">
                  <div className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
                    Открытые поручения участников из реестра ({relatedTasks.length})
                  </div>
                  {relatedTasks.length === 0 ? (
                    <div className="text-xs text-[var(--text-muted)]">
                      У выбранных участников нет незавершенных поручений в реестре.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {relatedTasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-3 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-[var(--text-primary)]">{t.title}</div>
                            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                              Ответственный: {t.assigneeName} · Срок: {t.deadline}
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            {t.status.toUpperCase()}
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
            {/* Left Pane: Transcript + Interactive Audio Mini-Player */}
            {showTranscript ? (
              <div className="w-[430px] border-r border-[var(--border-solid)] flex flex-col bg-[var(--bg-card)] shrink-0 transition-all">
                {/* Transcript Header */}
                <div className="p-3.5 px-4 border-b border-dashed border-[var(--border-dashed)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <span className="font-dot uppercase tracking-wider text-[var(--text-primary)]">
                      СТЕНОГРАММА
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {workspaceData.date}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => audioInputRef.current?.click()}
                      disabled={busyAnalyzing}
                      title="Загрузить аудио (.ogg, .wav, .mp3)"
                      className="w-7 h-7 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[#D71921] flex items-center justify-center transition-colors disabled:opacity-40"
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => transcriptInputRef.current?.click()}
                      disabled={busyAnalyzing}
                      title="Загрузить файл стенограммы (.txt, .vtt, .docx)"
                      className="w-7 h-7 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors disabled:opacity-40"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsEditingTranscript((prev) => !prev)}
                      title={
                        isEditingTranscript
                          ? 'Вернуться к просмотру реплик'
                          : 'Редактировать текст стенограммы'
                      }
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        isEditingTranscript
                          ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                          : 'hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowTranscript(false)}
                      title="Свернуть панель стенограммы"
                      className="w-7 h-7 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Integrated Audio Mini-Player */}
                <div className="px-4 py-2.5 border-b border-dashed border-[var(--border-dashed)] bg-[var(--bg-elevated)]/60 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPlayingAudio((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 transition-all active:scale-95 shrink-0"
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Пауза</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        <span>Слушать</span>
                      </>
                    )}
                  </button>

                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] font-semibold text-[#D71921] shrink-0">
                      {activeAudioTime}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--border-solid)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isPlayingAudio ? 'bg-[#D71921] w-2/3' : 'bg-[var(--text-primary)] w-1/3'
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={cycleSpeed}
                    title="Скорость воспроизведения"
                    className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--bg-card)] border border-[var(--border-solid)] text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-colors shrink-0"
                  >
                    {playbackSpeed.toFixed(1)}x
                  </button>
                </div>

                {isEditingTranscript ? (
                  <div className="flex-1 flex flex-col p-4 gap-2.5">
                    <div className="text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
                      <span>
                        Формат: <code className="font-mono">[00:15] Спикер: Реплика</code>
                      </span>
                      <button
                        onClick={() => setIsEditingTranscript(false)}
                        className="px-3 py-1 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold text-[11px]"
                      >
                        Готово
                      </button>
                    </div>
                    <textarea
                      value={workspaceData.transcriptText}
                      onChange={(e) =>
                        setWorkspaceData((prev) => ({ ...prev, transcriptText: e.target.value }))
                      }
                      placeholder="Вставьте стенограмму совещания..."
                      className="flex-1 w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-2xl p-3.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] resize-none leading-relaxed"
                    />
                  </div>
                ) : (
                  <div
                    ref={transcriptContainerRef}
                    id={`transcript-${workspaceData.id}`}
                    className="flex-1 overflow-y-auto p-3.5 space-y-2 select-text"
                  >
                    {workspaceData.transcriptText.split('\n').map((line, idx) => {
                      const match = line.match(/^\[([^\]]+)\]\s+([^:]+):\s*(.*)$/);
                      if (match) {
                        const [, rawTs, speaker, text] = match;
                        const tsClean = normalizeTs(rawTs);
                        const isHighlighted =
                          highlightedTimestamp !== null && tsClean === highlightedTimestamp;
                        const initials = speaker
                          .split(' ')
                          .map((w) => w[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join('');

                        return (
                          <div
                            key={idx}
                            data-ts={tsClean}
                            onClick={() => {
                              setHighlightedTimestamp(tsClean);
                              setActiveAudioTime(tsClean);
                            }}
                            className={`cursor-pointer px-3.5 py-2.5 rounded-2xl transition-all flex items-start gap-3 ${
                              isHighlighted
                                ? 'bg-[#D71921]/10 border border-[#D71921] shadow-sm'
                                : 'bg-[var(--bg-elevated)]/55 hover:bg-[var(--bg-elevated)] border border-transparent'
                            }`}
                          >
                            <span
                              className={`font-mono text-[11px] shrink-0 pt-0.5 ${
                                isHighlighted
                                  ? 'text-[#D71921] font-bold'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            >
                              {tsClean}
                            </span>

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-mono font-bold bg-[var(--bg-card)] border border-[var(--border-solid)] text-[var(--text-primary)]">
                                  {initials}
                                </span>
                                <span className="text-xs font-semibold text-[var(--text-primary)]">
                                  {speaker}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                {text}
                              </p>
                            </div>
                          </div>
                        );
                      }
                      if (!line.trim()) return null;
                      return (
                        <div key={idx} className="px-3 py-1 text-xs text-[var(--text-muted)]">
                          {line}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-12 border-r border-[var(--border-solid)] bg-[var(--bg-card)] flex flex-col items-center py-4 shrink-0">
                <button
                  onClick={() => setShowTranscript(true)}
                  title="Развернуть стенограмму встречи"
                  className="w-8 h-8 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
                <span className="font-dot text-[10px] text-[var(--text-muted)] [writing-mode:vertical-rl] rotate-180 mt-4 tracking-widest uppercase select-none">
                  СТЕНОГРАММА
                </span>
              </div>
            )}

            {/* Right Pane: Linear Protocol Pipeline & Analysis Cards */}
            <div className="flex-1 flex flex-col overflow-y-auto p-6 lg:p-8">
              <div className="max-w-5xl mx-auto w-full space-y-6">
                {audioJob?.status === 'transcribing' && (
                  <div className="nothing-card p-4 flex items-center gap-3 text-xs">
                    <Mic className="w-4 h-4 text-[#D71921] animate-pulse shrink-0" />
                    <span>
                      <strong>Whisper распознаёт «{audioJob.filename}» в фоне.</strong> Можете
                      переключиться в «Базу знаний» — расшифровка сохранится автоматически.
                    </span>
                  </div>
                )}

                {analysisJob?.status === 'analyzing' && (
                  <div className="nothing-card p-4 flex items-center gap-3 text-xs">
                    <Cpu className="w-4 h-4 text-[#D71921] animate-spin shrink-0" />
                    <span>
                      <strong>
                        Qwen 2.5 формирует протокол в фоне («{analysisJob.meetingTitle}»).
                      </strong>{' '}
                      Решения и поручения появятся здесь автоматически.
                    </span>
                  </div>
                )}

                {audioJob?.status !== 'transcribing' &&
                  analysisJob?.status !== 'analyzing' &&
                  workspaceData.transcriptRef.startsWith('#audio-') &&
                  workspaceData.decisions.length === 0 &&
                  !workspaceData.transcriptText.startsWith('⏳') && (
                    <div className="nothing-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <strong>
                          Расшифровка аудио готова (
                          {workspaceData.transcriptRef.replace('#audio-', '')}).
                        </strong>{' '}
                        Проверьте текст слева и запустите извлечение решений.
                      </div>
                      <button
                        onClick={handleRunAiAnalysis}
                        disabled={busyAnalyzing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#D71921] text-white hover:brightness-110 transition-all disabled:opacity-50"
                      >
                        <Cpu className={`w-3.5 h-3.5 ${busyAnalyzing ? 'animate-spin' : ''}`} />
                        <span>{busyAnalyzing ? busyLabel : 'Запустить AI-анализ'}</span>
                      </button>
                    </div>
                  )}

                {/* Protocol Header + Linear 3-Step Pipeline */}
                <div className="nothing-card p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[240px]">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[var(--text-muted)]">
                        <span>№ {workspaceData.savedProtocolId || workspaceData.id}</span>
                        <span>·</span>
                        <span>{workspaceData.date}</span>
                        {/* Flat Non-Clickable Status Badge */}
                        {workspaceData.savedProtocolId ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            СОХРАНЕНО В БД
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            ЧЕРНОВИК
                          </span>
                        )}
                      </div>

                      {selectedTranscriptId === 'ad-hoc-new' ? (
                        <input
                          type="text"
                          value={workspaceData.title}
                          onChange={(e) =>
                            setWorkspaceData((prev) => ({ ...prev, title: e.target.value }))
                          }
                          className="w-full max-w-lg mt-1.5 bg-transparent text-lg font-bold text-[var(--text-primary)] border-b border-dashed border-[var(--border-dashed)] focus:border-[var(--text-primary)] focus:outline-none pb-0.5"
                        />
                      ) : (
                        <h2 className="text-lg font-bold text-[var(--text-primary)] mt-1">
                          {workspaceData.title}
                        </h2>
                      )}
                    </div>

                    {selectedMeetingItem && (
                      <button
                        onClick={() => setShowScheduledProtocolWorkspace(false)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Карточка встречи</span>
                      </button>
                    )}
                  </div>

                  {/* Step-by-Step Action Pipeline (Affordance Level 1) */}
                  <div className="pt-3 border-t border-dashed border-[var(--border-dashed)] flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => audioInputRef.current?.click()}
                      disabled={busyAnalyzing}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-all disabled:opacity-50"
                    >
                      <Mic className="w-3.5 h-3.5 text-[#D71921]" />
                      <span>1. Аудио (Whisper)</span>
                      {hasTranscriptReady && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>

                    <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] hidden sm:block" />

                    <button
                      onClick={handleRunAiAnalysis}
                      disabled={busyAnalyzing}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      <Cpu className={`w-3.5 h-3.5 ${busyAnalyzing ? 'animate-spin' : ''}`} />
                      <span>{busyAnalyzing ? busyLabel : '2. AI-анализ стенограммы'}</span>
                      {hasAnalysisReady && !busyAnalyzing && (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </button>

                    <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] hidden sm:block" />

                    <button
                      onClick={handleSaveProtocol}
                      disabled={isSavingProtocol || busyAnalyzing}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#D71921] text-white hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>
                        {isSavingProtocol ? 'Сохранение...' : '3. Утвердить и сохранить в БД'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Meeting Summary */}
                <div className="nothing-card p-5 space-y-2">
                  <div className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
                    КРАТКОЕ РЕЗЮМЕ ВСТРЕЧИ
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {workspaceData.summary}
                  </p>
                </div>

                {/* Decisions & Risks Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* Decisions Card */}
                  <div className="nothing-card p-5 space-y-3.5">
                    <div className="flex items-center justify-between pb-2.5 border-b border-dashed border-[var(--border-dashed)]">
                      <h3 className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
                        ИТОГИ И СТАТУСЫ РЕШЕНИЙ
                      </h3>
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        {workspaceData.decisions.length} ПОЗ.
                      </span>
                    </div>

                    {/* Segmented Filter Control (Affordance Level 2) */}
                    <div className="flex flex-wrap gap-1 p-1 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-solid)]">
                      <button
                        onClick={() => setDecisionFilter('all')}
                        className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                          decisionFilter === 'all'
                            ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Все ({workspaceData.decisions.length})
                      </button>
                      {(
                        [
                          'resolved',
                          'proposed',
                          'discussed',
                          'needs_clarification',
                        ] as DecisionCategory[]
                      ).map((cat) => {
                        const count = workspaceData.decisions.filter(
                          (d) => d.category === cat
                        ).length;
                        const meta = DECISION_CATEGORY_META[cat];
                        const isActive = decisionFilter === cat;
                        return (
                          <button
                            key={cat}
                            onClick={() => setDecisionFilter(cat)}
                            className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                              isActive
                                ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {meta.label} ({count})
                          </button>
                        );
                      })}
                    </div>

                    {/* Decision Items */}
                    <div className="space-y-2.5">
                      {(() => {
                        const filtered =
                          decisionFilter === 'all'
                            ? workspaceData.decisions
                            : workspaceData.decisions.filter((d) => d.category === decisionFilter);
                        if (filtered.length === 0) {
                          return (
                            <div className="text-xs text-[var(--text-muted)] py-3 text-center">
                              В выбранной категории записей нет
                            </div>
                          );
                        }
                        return filtered.map((d) => {
                          const meta =
                            DECISION_CATEGORY_META[d.category] ||
                            DECISION_CATEGORY_META.discussed;
                          const tsClean = normalizeTs(d.timestamp);
                          return (
                            <div
                              key={d.id}
                              className="p-3.5 rounded-2xl bg-[var(--bg-elevated)]/70 space-y-2 text-xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                {/* Flat Non-Clickable Status Label (Affordance Level 3) */}
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${meta.pillClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
                                  <span>{meta.label.toUpperCase()}</span>
                                </span>

                                <div className="flex items-center gap-2 text-[11px]">
                                  {d.speaker && (
                                    <span className="font-semibold text-[var(--text-secondary)]">
                                      {d.speaker}
                                    </span>
                                  )}
                                  {/* Explicit Clickable Timestamp Jump Button */}
                                  {tsClean && (
                                    <button
                                      type="button"
                                      onClick={() => handleJumpToTimestamp(tsClean)}
                                      title="Перейти к реплике в стенограмме"
                                      className="inline-flex items-center gap-1 font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-solid)] hover:border-[var(--text-primary)] text-[var(--text-primary)] transition-colors"
                                    >
                                      <Play className="w-2.5 h-2.5 text-[#D71921]" />
                                      <span>{tsClean}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="leading-snug text-[var(--text-primary)]">
                                {d.text}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Right Column: Risks & Actionable Open Questions */}
                  <div className="space-y-4">
                    {/* Risks Card */}
                    <div className="nothing-card p-5 space-y-3">
                      <div className="flex items-center justify-between pb-2.5 border-b border-dashed border-[var(--border-dashed)]">
                        <h3 className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
                          КАРТА ВЫЯВЛЕННЫХ РИСКОВ
                        </h3>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">
                          {workspaceData.risks?.length || 0} РИСК(А)
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {workspaceData.risks && workspaceData.risks.length > 0 ? (
                          workspaceData.risks.map((r) => {
                            const isHigh = r.impact.toLowerCase() === 'high';
                            return (
                              <div
                                key={r.id}
                                className="p-3.5 rounded-2xl bg-[var(--bg-elevated)]/70 text-xs space-y-1.5"
                              >
                                <div className="font-semibold text-[var(--text-primary)] flex items-start justify-between gap-2">
                                  <span>{r.riskDescription}</span>
                                  {/* Flat Non-Clickable Severity Tag */}
                                  <span
                                    className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                                      isHigh
                                        ? 'bg-[#D71921]/15 text-[#D71921]'
                                        : 'bg-amber-500/15 text-amber-500'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isHigh ? 'bg-[#D71921]' : 'bg-amber-500'
                                      }`}
                                    />
                                    {r.impact}
                                  </span>
                                </div>
                                {r.suggestedMitigation && (
                                  <div className="text-[11px] text-[var(--text-secondary)]">
                                    Меры: {r.suggestedMitigation}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-[var(--text-muted)]">
                            Критических рисков не зафиксировано
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actionable Open Questions Card */}
                    {workspaceData.openQuestions && workspaceData.openQuestions.length > 0 && (
                      <div className="nothing-card p-5 space-y-3">
                        <div className="flex items-center justify-between pb-2.5 border-b border-dashed border-[var(--border-dashed)]">
                          <h3 className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                            <span>ОТКРЫТЫЕ ВОПРОСЫ К ПРОРАБОТКЕ</span>
                          </h3>
                          <span className="text-[11px] font-mono text-[var(--text-muted)]">
                            {workspaceData.openQuestions.length}
                          </span>
                        </div>
                        <ul className="space-y-2 text-xs">
                          {workspaceData.openQuestions.map((q, idx) => (
                            <li
                              key={idx}
                              className="p-3 rounded-2xl bg-[var(--bg-elevated)]/70 space-y-2.5"
                            >
                              <div className="leading-snug text-[var(--text-primary)]">{q}</div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSearchQuestionInKB(q)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium bg-[var(--bg-card)] border border-[var(--border-solid)] hover:border-[var(--text-primary)] text-[var(--text-primary)] transition-colors"
                                >
                                  <span>Найти в Базе знаний</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddQuestionToTasks(q)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium bg-[var(--bg-card)] border border-[var(--border-solid)] hover:border-[var(--text-primary)] text-[var(--text-primary)] transition-colors"
                                >
                                  <Plus className="w-3 h-3 text-[#D71921]" />
                                  <span>В поручения</span>
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Staged Tasks Registry (Human-in-the-Loop) */}
                <div className="nothing-card p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-dashed border-[var(--border-dashed)]">
                    <div>
                      <h3 className="font-dot text-sm uppercase tracking-wider text-[var(--text-primary)]">
                        ПОРУЧЕНИЯ К УТВЕРЖДЕНИЮ В РЕЕСТР
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Проверьте ответственного и срок исполнения перед фиксацией в журнале задач
                      </p>
                    </div>

                    <button
                      onClick={handleAddTask}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] rounded-full transition-colors border border-[var(--border-solid)]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Добавить задачу</span>
                    </button>
                  </div>

                  {tasksToReview.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-dashed)] rounded-2xl">
                      Все поручения согласованы и записаны в реестр.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tasksToReview.map((task, idx) => {
                        const isUnassigned =
                          task.assigneeName.includes('уточнения') ||
                          task.assigneeName.includes('Назначить');
                        const isNoDeadline =
                          task.deadline.includes('уточнения') || task.deadline.includes('Указать');

                        return (
                          <div
                            key={idx}
                            className="bg-[var(--bg-elevated)]/65 p-4 rounded-2xl border border-[var(--border-solid)] space-y-3"
                          >
                            {/* Task Title */}
                            <div className="flex items-start justify-between gap-3">
                              <input
                                type="text"
                                value={task.title}
                                onChange={(e) => handleUpdateTask(idx, 'title', e.target.value)}
                                className="flex-1 bg-transparent font-semibold text-xs text-[var(--text-primary)] border-b border-dashed border-transparent hover:border-[var(--border-dashed)] focus:border-[var(--text-primary)] focus:outline-none pb-0.5"
                              />
                              <button
                                onClick={() => handleDeleteTask(idx)}
                                className="w-7 h-7 rounded-full hover:bg-[#D71921]/15 text-[var(--text-muted)] hover:text-[#D71921] flex items-center justify-center transition-colors"
                                title="Удалить поручение"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Assignee & Deadline Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[11px] font-mono text-[var(--text-secondary)]">
                                    ОТВЕТСТВЕННЫЙ
                                  </label>
                                  {isUnassigned && (
                                    <span className="text-[10px] text-[#D71921] font-mono font-semibold">
                                      ● ТРЕБУЕТСЯ НАЗНАЧЕНИЕ
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={task.assigneeName}
                                  onChange={(e) =>
                                    handleUpdateTask(idx, 'assigneeName', e.target.value)
                                  }
                                  className={`w-full bg-[var(--bg-card)] px-3.5 py-2 rounded-full text-xs text-[var(--text-primary)] border focus:outline-none ${
                                    isUnassigned
                                      ? 'border-[#D71921]'
                                      : 'border-[var(--border-solid)] focus:border-[var(--text-primary)]'
                                  }`}
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[11px] font-mono text-[var(--text-secondary)]">
                                    СРОК ИСПОЛНЕНИЯ
                                  </label>
                                  {isNoDeadline && (
                                    <span className="text-[10px] text-[#D71921] font-mono font-semibold">
                                      ● УКАЖИТЕ ДЕДЛАЙН
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={task.deadline}
                                  onChange={(e) =>
                                    handleUpdateTask(idx, 'deadline', e.target.value)
                                  }
                                  className={`w-full bg-[var(--bg-card)] px-3.5 py-2 rounded-full text-xs text-[var(--text-primary)] border focus:outline-none ${
                                    isNoDeadline
                                      ? 'border-[#D71921]'
                                      : 'border-[var(--border-solid)] focus:border-[var(--text-primary)]'
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Source Quote + Jump Button */}
                            {task.sourceQuote && (
                              <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-card)] px-3.5 py-2 rounded-2xl flex items-center justify-between gap-2 italic">
                                <span>Основание: «{task.sourceQuote}»</span>
                                {task.timestamp && (
                                  <button
                                    type="button"
                                    onClick={() => handleJumpToTimestamp(task.timestamp)}
                                    title="Найти реплику в стенограмме"
                                    className="inline-flex items-center gap-1 font-mono not-italic shrink-0 px-2.5 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] hover:border-[var(--text-primary)] text-[var(--text-primary)] font-semibold transition-colors"
                                  >
                                    <Play className="w-2.5 h-2.5 text-[#D71921]" />
                                    <span>{normalizeTs(task.timestamp)}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Explicit Approval Bar */}
                      <div className="pt-3 flex items-center justify-end gap-2.5">
                        <button
                          onClick={handleReject}
                          className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] rounded-full transition-colors"
                        >
                          Отклонить все
                        </button>

                        <button
                          onClick={handleApprove}
                          className="px-5 py-2 text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 rounded-full transition-all flex items-center gap-2 active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>Утвердить в реестр ({tasksToReview.length}) →</span>
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
      {/* MODAL: ПОДГОТОВКА ВСТРЕЧИ И ПОДБОР СЛОТА КАЛЕНДАРЯ                        */}
      {/* ========================================================================= */}
      {isPrepModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="nothing-card max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3.5 border-b border-dashed border-[var(--border-dashed)]">
              <div>
                <div className="text-[11px] font-mono text-[var(--text-muted)] mb-1">
                  {prepStep === 'setup'
                    ? 'ШАГ 1 ИЗ 2 // ПОВЕСТКА, ДОКУМЕНТЫ И СЛОТЫ'
                    : 'ШАГ 2 ИЗ 2 // ПРЕДПРОСМОТР ПРИГЛАШЕНИЯ'}
                </div>
                <h2 className="font-dot text-base uppercase tracking-wider text-[var(--text-primary)]">
                  {prepStep === 'setup'
                    ? 'ПОДГОТОВКА СОВЕЩАНИЯ И КАЛЕНДАРЬ'
                    : 'ПОДТВЕРЖДЕНИЕ СОЗДАНИЯ ВСТРЕЧИ'}
                </h2>
              </div>

              <button
                onClick={() => setIsPrepModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {prepStep === 'setup' ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-mono text-[var(--text-secondary)] block mb-1.5">
                      ТЕМА ВСТРЕЧИ
                    </label>
                    <input
                      type="text"
                      value={prepTopic}
                      onChange={(e) => setPrepTopic(e.target.value)}
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] px-4 py-2.5 rounded-full text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-mono text-[var(--text-secondary)] block mb-1.5">
                        УЧАСТНИКИ ({prepParticipants.length})
                      </label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {participantsCatalog.map((p) => {
                          const checked = prepParticipants.includes(p.shortName);
                          const isSelf = surnameKey(p.name) === currentUserSurname;
                          return (
                            <label
                              key={p.id}
                              className={`flex items-start gap-2.5 p-2.5 rounded-2xl border cursor-pointer transition-colors text-xs ${
                                checked
                                  ? 'bg-[var(--bg-elevated)] border-[var(--text-primary)] text-[var(--text-primary)]'
                                  : 'bg-[var(--bg-elevated)]/40 border-[var(--border-solid)] text-[var(--text-secondary)]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleParticipant(p.shortName)}
                                className="mt-0.5 rounded"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold flex items-center gap-1.5">
                                  <span>{p.shortName}</span>
                                  {isSelf && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)]">
                                      ВЫ
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-[var(--text-muted)] truncate">
                                  {p.roleTitle}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-mono text-[var(--text-secondary)] block mb-1.5">
                        ДОКУМЕНТЫ БАЗЫ ({selectedDocIds.length}/{documents.length})
                      </label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {documents.map((doc) => {
                          const checked = selectedDocIds.includes(doc.id);
                          return (
                            <label
                              key={doc.id}
                              className={`flex items-start gap-2.5 p-2.5 rounded-2xl border cursor-pointer transition-colors text-xs ${
                                checked
                                  ? 'bg-[var(--bg-elevated)] border-[var(--text-primary)] text-[var(--text-primary)]'
                                  : 'bg-[var(--bg-elevated)]/40 border-[var(--border-solid)] text-[var(--text-secondary)]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDocSelection(doc.id)}
                                className="mt-0.5 rounded"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold leading-snug line-clamp-2">
                                  {doc.title}
                                </div>
                                <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
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
                    className="w-full py-2.5 px-4 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-solid)] flex items-center justify-center gap-2 text-xs font-semibold text-[var(--text-primary)] transition-colors disabled:opacity-50"
                  >
                    <Cpu className={`w-3.5 h-3.5 ${isAiGeneratingAgenda ? 'animate-spin' : ''}`} />
                    <span>
                      {isAiGeneratingAgenda
                        ? 'Формирование повестки и проверка открытых задач...'
                        : 'Сформировать проект повестки и вопросы (AI)'}
                    </span>
                  </button>

                  {prepError && (
                    <div className="p-3 rounded-2xl bg-[#D71921]/10 border border-[#D71921]/30 text-xs text-[#D71921] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{prepError}</span>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-[var(--bg-elevated)]/60 border border-[var(--border-solid)] space-y-3">
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      Проект повестки:
                    </div>

                    {generatedAgenda.agenda.length === 0 ? (
                      <div className="text-xs text-[var(--text-muted)] italic">
                        Нажмите кнопку выше, чтобы сформировать повестку по выбранным документам и
                        открытым задачам из реестра.
                      </div>
                    ) : (
                      <ul className="text-xs text-[var(--text-primary)] space-y-1">
                        {generatedAgenda.agenda.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}

                    {generatedAgenda.openTasks.length > 0 && (
                      <div className="pt-2 border-t border-dashed border-[var(--border-dashed)]">
                        <div className="text-xs font-bold text-[var(--text-primary)] mb-1.5">
                          Открытые задачи участников:
                        </div>
                        <div className="space-y-1.5">
                          {generatedAgenda.openTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-2.5 rounded-xl bg-[var(--bg-card)] flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-[var(--text-primary)] truncate">
                                  {task.title}
                                </div>
                                <div className="text-[var(--text-muted)] font-mono">
                                  {task.assigneeName} · до {task.deadline}
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-[var(--bg-elevated)] text-[var(--text-secondary)] shrink-0">
                                {task.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {generatedAgenda.openQuestions.length > 0 && (
                      <div className="pt-2 border-t border-dashed border-[var(--border-dashed)]">
                        <div className="text-xs font-bold text-[var(--text-primary)] mb-1">
                          Открытые вопросы к обсуждению:
                        </div>
                        <ul className="text-xs text-amber-500 space-y-1 font-medium">
                          {generatedAgenda.openQuestions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Calendar Slots */}
                <div className="space-y-3 pt-3 border-t border-dashed border-[var(--border-dashed)]">
                  <div className="flex items-center justify-between">
                    <h3 className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
                      СВОБОДНЫЕ СЛОТЫ В КАЛЕНДАРЕ
                    </h3>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      ДОСТУПНО {calendarSlots.filter((s) => s.isAvailable).length} ИЗ{' '}
                      {calendarSlots.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {calendarSlots.map((slot) => {
                      const isSelected = selectedSlotId === slot.id && slot.isAvailable;
                      const freeSet = new Set(slot.participantsFree.map(surnameKey));
                      const busySelected = prepParticipants.filter(
                        (p) => !freeSet.has(surnameKey(p))
                      );

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => slot.isAvailable && setSelectedSlotId(slot.id)}
                          className={`p-3.5 rounded-2xl text-left transition-all text-xs flex flex-col justify-between gap-1.5 border ${
                            !slot.isAvailable
                              ? 'opacity-45 cursor-not-allowed border-[var(--border-solid)] bg-[var(--bg-elevated)]/40'
                              : isSelected
                              ? 'border-[var(--text-primary)] bg-[var(--bg-elevated)] ring-1 ring-[var(--text-primary)] cursor-pointer'
                              : 'border-[var(--border-solid)] bg-[var(--bg-card)] hover:border-[var(--text-secondary)] cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-[var(--text-primary)]">
                              {slot.date}
                            </span>
                            {!slot.isAvailable ? (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#D71921]/15 text-[#D71921]">
                                ЗАНЯТО
                              </span>
                            ) : (
                              isSelected && <Check className="w-3.5 h-3.5 text-[#D71921]" />
                            )}
                          </div>

                          <div className="font-dot text-sm text-[var(--text-primary)]">
                            {slot.startTime} – {slot.endTime}
                          </div>

                          {!slot.isAvailable ? (
                            <div className="text-[10px] text-[var(--text-muted)]">
                              Слот забронирован
                            </div>
                          ) : busySelected.length === 0 ? (
                            <div className="text-[10px] text-emerald-500 font-medium">
                              ● Все участники свободны
                            </div>
                          ) : (
                            <div className="text-[10px] text-amber-500 font-medium">
                              ● Занят(ы): {busySelected.join(', ')}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-dashed border-[var(--border-dashed)]">
                  <button
                    type="button"
                    onClick={() => setIsPrepModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] rounded-full transition-colors"
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    onClick={handleProceedToPreview}
                    disabled={!selectedSlot || !selectedSlot.isAvailable}
                    className="px-5 py-2 text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 rounded-full flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <span>Далее: предпросмотр приглашения</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-[var(--text-primary)] flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="leading-relaxed text-[11px]">
                    <strong>Подтверждение действия:</strong> проверьте детали события и текст
                    приглашения. Запись в календарь и рассылка выполнятся после нажатия кнопки ниже.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-[var(--bg-elevated)]">
                    <div className="text-[10px] font-mono text-[var(--text-muted)] mb-1">
                      СОБЫТИЕ И ВРЕМЯ
                    </div>
                    <div className="font-bold text-[var(--text-primary)]">{prepTopic}</div>
                    <div className="text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {selectedSlot?.date} · {selectedSlot?.startTime}–{selectedSlot?.endTime}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[var(--bg-elevated)]">
                    <div className="text-[10px] font-mono text-[var(--text-muted)] mb-1">
                      ПОЛУЧАТЕЛИ ПРИГЛАШЕНИЙ
                    </div>
                    {prepParticipants.filter((p) => surnameKey(p) !== currentUserSurname).length ===
                    0 ? (
                      <div className="text-amber-500 text-[11px]">
                        Другие участники не выбраны — встреча создастся только в вашем календаре.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {prepParticipants
                          .filter((p) => surnameKey(p) !== currentUserSurname)
                          .map((recipient) => (
                            <span
                              key={recipient}
                              className="px-2.5 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--text-primary)] text-[11px] font-medium"
                            >
                              {recipient}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-[var(--text-secondary)] block mb-1.5">
                    ТЕКСТ ПИСЬМА-ПРИГЛАШЕНИЯ
                  </label>
                  <textarea
                    rows={7}
                    value={invitationText}
                    onChange={(e) => setInvitationText(e.target.value)}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] p-3.5 rounded-2xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] leading-relaxed"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between gap-2.5 border-t border-dashed border-[var(--border-dashed)]">
                  <button
                    type="button"
                    onClick={() => setPrepStep('setup')}
                    className="px-4 py-2 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] rounded-full flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Назад</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPrepModalOpen(false)}
                      className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] rounded-full transition-colors"
                    >
                      Отмена
                    </button>

                    <button
                      type="button"
                      disabled={isCreatingMeeting}
                      onClick={handleConfirmMeetingCreation}
                      className="px-5 py-2 text-xs font-semibold bg-[#D71921] hover:brightness-110 text-white rounded-full flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>
                        {isCreatingMeeting
                          ? 'Сохранение...'
                          : 'Подтвердить и отправить приглашения'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ПРИГЛАШЕНИЯ НА СОВЕЩАНИЯ                                           */}
      {/* ========================================================================= */}
      {isInvitationsOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="nothing-card max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-dashed border-[var(--border-dashed)]">
              <div>
                <div className="text-[11px] font-mono text-[var(--text-muted)]">
                  ПРОФИЛЬ: {currentUser.name}
                </div>
                <h2 className="font-dot text-base uppercase tracking-wider text-[var(--text-primary)]">
                  ПРИГЛАШЕНИЯ НА СОВЕЩАНИЯ
                </h2>
              </div>

              <button
                onClick={() => setIsInvitationsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="inline-flex items-center p-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] gap-1">
              <button
                type="button"
                onClick={() => setInvTab('incoming')}
                className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${
                  invTab === 'incoming'
                    ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Входящие мне ({incomingInvitations.length})
              </button>
              <button
                type="button"
                onClick={() => setInvTab('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${
                  invTab === 'all'
                    ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Все отправленные ({invitations.length})
              </button>
            </div>

            {(() => {
              const list = invTab === 'incoming' ? incomingInvitations : invitations;
              if (list.length === 0) {
                return (
                  <div className="py-10 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-dashed)] rounded-2xl">
                    {invTab === 'incoming'
                      ? 'У текущей роли пока нет входящих приглашений.'
                      : 'Отправленных приглашений пока нет.'}
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {list.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-4 rounded-2xl bg-[var(--bg-elevated)]/60 border border-[var(--border-solid)] space-y-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-[var(--text-primary)]">
                            {inv.meetingTitle}
                          </div>
                          <div className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                            {inv.date} · {inv.time} · Организатор: {inv.organizerName}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                            Получатель: <span className="font-semibold">{inv.recipientName}</span>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full shrink-0 ${
                            inv.status === 'accepted'
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : inv.status === 'declined'
                              ? 'bg-[#D71921]/15 text-[#D71921]'
                              : 'bg-amber-500/15 text-amber-500'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              inv.status === 'accepted'
                                ? 'bg-emerald-500'
                                : inv.status === 'declined'
                                ? 'bg-[#D71921]'
                                : 'bg-amber-500'
                            }`}
                          />
                          {inv.status === 'accepted'
                            ? 'ПРИНЯТО'
                            : inv.status === 'declined'
                            ? 'ОТКЛОНЕНО'
                            : 'ОЖИДАЕТ'}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--bg-card)] whitespace-pre-wrap text-[11px] text-[var(--text-secondary)]">
                        {inv.messageText}
                      </div>

                      {invTab === 'incoming' && inv.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => respondToInvitation(inv.id, 'declined')}
                            className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#D71921]/15 hover:bg-[#D71921] text-[#D71921] hover:text-white transition-colors"
                          >
                            Отклонить
                          </button>
                          <button
                            type="button"
                            onClick={() => respondToInvitation(inv.id, 'accepted')}
                            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
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
