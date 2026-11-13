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
  Play,
  Pause,
  ArrowUpRight,
  FileAudio,
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
    label: 'Уточнить',
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

  // Explicit ingestion dropzone screen for creating a new protocol from audio/text
  const [isNewProtocolDropzoneOpen, setIsNewProtocolDropzoneOpen] = useState<boolean>(false);
  const [newProtocolTitleInput, setNewProtocolTitleInput] = useState<string>('');
  const [isDraggingAudio, setIsDraggingAudio] = useState<boolean>(false);

  // Variant A: Clean tabs inside the protocol right pane
  const [protocolTab, setProtocolTab] = useState<'summary' | 'tasks'>('summary');
  const [expandedTaskIdx, setExpandedTaskIdx] = useState<number | null>(null);

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

  // Mini audio player state
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

  // Meeting Preparation Modal
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
      setIsNewProtocolDropzoneOpen(false);
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
            `⏳ Whisper расшифровывает аудио «${audioJob.filename}»...\n\n` +
            'Вы можете перейти в «Базу знаний» — когда расшифровка завершится, появится уведомление.',
          summary: 'Выполняется транскрибация аудиозаписи через Whisper...',
          decisions: [],
          risks: [],
          openQuestions: [],
          processingTimeSec: null,
          modelUsed: 'Whisper STT',
        };
      });
      return;
    }

    if (audioJob.status === 'ready' && !audioJob.applied && audioJob.transcriptText) {
      setIsNewProtocolDropzoneOpen(false);
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
          'Расшифровка аудио завершена. Проверьте текст стенограммы слева и нажмите «Сформировать протокол (ИИ)».',
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
      setIsNewProtocolDropzoneOpen(false);
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
          summary: '⏳ Qwen 2.5 анализирует стенограмму и выделяет решения и поручения...',
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
      setIsNewProtocolDropzoneOpen(false);
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
      const message = err?.message || 'Ошибка при генерации повестки.';
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
      `Уважаемые коллеги,\nприглашаю вас на совещание «${prepTopic.trim()}».\n\n` +
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
      setIsNewProtocolDropzoneOpen(false);
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
    const staged = (res.tasks || []).map((t) => ({
      title: t.title,
      assigneeName: t.assigneeName,
      deadline: t.deadline,
      sourceQuote: t.sourceQuote,
      timestamp: t.timestamp || '00:00',
      status: 'pending_approval' as const,
    }));
    setTasksToReview(staged);
    setExpandedTaskIdx(staged.length > 0 ? 0 : null);
    setProtocolTab('summary');
    setShowScheduledProtocolWorkspace(true);
    setIsNewProtocolDropzoneOpen(false);
    setIsEditingTranscript(false);
    setDecisionFilter('all');
    setHighlightedTimestamp(null);
  };

  const handleSaveProtocol = async () => {
    if (!workspaceData.summary.trim() && workspaceData.decisions.length === 0) {
      showToast(
        'Нечего сохранять',
        'Сначала расшифруйте аудио или запустите анализ стенограммы',
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
          ? 'Дождитесь завершения расшифровки аудио через Whisper'
          : 'Загрузите аудиозапись или вставьте текст стенограммы слева',
        'warning'
      );
      return;
    }
    if (analysisJob?.status === 'analyzing') {
      showToast('Анализ уже выполняется', 'Дождитесь завершения обработки', 'info');
      return;
    }
    if (audioJob?.status === 'ready') {
      clearAudioJob();
    }
    setWorkspaceData((prev) => ({
      ...prev,
      summary: '⏳ Qwen 2.5 анализирует стенограмму и выделяет решения и поручения...',
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
      'Анализ стенограммы запущен',
      'Можете переключаться между экранами — готовый протокол появится автоматически',
      'info'
    );
  };

  const startAudioUploadFlow = (file: File) => {
    if (analysisJob && analysisJob.status !== 'analyzing') {
      clearAnalysisJob();
    }

    const targetMeeting = selectedMeetingItem;
    const isAdHoc = !targetMeeting && (isNewProtocolDropzoneOpen || selectedTranscriptId === 'ad-hoc-new');
    const targetId = targetMeeting ? targetMeeting.id : 'ad-hoc-new';
    const customTitle = newProtocolTitleInput.trim();
    const title =
      targetMeeting?.title ||
      (isAdHoc
        ? customTitle || file.name.replace(/\.[^.]+$/, '')
        : workspaceData.title || file.name.replace(/\.[^.]+$/, ''));
    const today = targetMeeting?.date || new Date().toISOString().slice(0, 10);

    setIsNewProtocolDropzoneOpen(false);
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
        `⏳ Whisper расшифровывает аудио «${file.name}»...\n\n` +
        'Вы можете перейти в «Базу знаний» — когда расшифровка завершится, появится уведомление.',
      summary: 'Выполняется транскрибация аудиозаписи через Whisper...',
      decisions: [],
      risks: [],
      openQuestions: [],
      processingTimeSec: null,
      modelUsed: 'Whisper STT',
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
      'Транскрибация запущена',
      `Аудио «${file.name}» передано в Whisper`,
      'info'
    );
  };

  const handleAudioFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    startAudioUploadFlow(file);
  };

  const handleDropAudioFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingAudio(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    startAudioUploadFlow(file);
  };

  const handleTranscriptFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const targetMeeting = selectedMeetingItem;
    const customTitle = newProtocolTitleInput.trim();
    const title =
      targetMeeting?.title || customTitle || file.name.replace(/\.[^.]+$/, '');
    const today = targetMeeting?.date || new Date().toISOString().slice(0, 10);

    setIsNewProtocolDropzoneOpen(false);
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

  const handleOpenManualNewProtocol = () => {
    const today = new Date().toISOString().slice(0, 10);
    const title = newProtocolTitleInput.trim() || 'Новое оперативное совещание';
    setIsNewProtocolDropzoneOpen(false);
    setSelectedTranscriptId('ad-hoc-new');
    setShowScheduledProtocolWorkspace(true);
    setShowTranscript(true);
    setWorkspaceData({
      id: `ad-hoc-${Date.now()}`,
      title,
      date: today,
      transcriptRef: `#transcript-ad-hoc-${today}`,
      transcriptText: '',
      summary:
        'Вставьте текст стенограммы в левую панель и нажмите «Сформировать протокол (ИИ)».',
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
      setWorkspaceData({
        id: selectedMeetingItem.id,
        meetingId: selectedMeetingItem.id,
        title: selectedMeetingItem.title,
        date: selectedMeetingItem.date,
        transcriptRef: `#meeting-${selectedMeetingItem.id}`,
        transcriptText: '',
        summary:
          'Вставьте текст стенограммы слева или загрузите аудиозапись для автоматической расшифровки.',
        decisions: [],
        risks: [],
        openQuestions: selectedMeetingItem.openQuestions || [],
      });
      setIsEditingTranscript(true);
    }
    setTasksToReview([]);
    setProtocolTab('summary');
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
    setIsNewProtocolDropzoneOpen(false);
    setSelectedTranscriptId(id);
    setDecisionFilter('all');
    setHighlightedTimestamp(null);
    setProtocolTab('summary');

    if (id === 'ad-hoc-new') {
      setIsNewProtocolDropzoneOpen(true);
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
      const staged = found.stagedTasks.map((t) => ({
        title: t.title,
        assigneeName: t.assigneeName,
        deadline: t.deadline,
        sourceQuote: t.sourceQuote,
        timestamp: t.timestamp,
        status: 'pending_approval' as const,
      }));
      setTasksToReview(staged);
      setExpandedTaskIdx(null);
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
    if (expandedTaskIdx === index) setExpandedTaskIdx(null);
    showToast('Задача удалена', 'Поручение исключено из черновика', 'info');
  };

  const handleAddTask = () => {
    setTasksToReview((prev) => {
      const next = [
        ...prev,
        {
          title: 'Новое поручение',
          assigneeName: 'Назначить ответственного',
          deadline: 'Указать срок',
          sourceQuote: 'Добавлено вручную',
          timestamp: '00:00',
          status: 'pending_approval' as const,
        },
      ];
      setExpandedTaskIdx(next.length - 1);
      return next;
    });
    setProtocolTab('tasks');
  };

  const handleAddQuestionToTasks = (question: string) => {
    setTasksToReview((prev) => {
      const next = [
        ...prev,
        {
          title: `Проработать вопрос: ${question}`,
          assigneeName: 'Назначить ответственного',
          deadline: 'Завтра, 18:00',
          sourceQuote: 'Из открытых вопросов совещания',
          timestamp: activeAudioTime || '00:00',
          status: 'pending_approval' as const,
        },
      ];
      setExpandedTaskIdx(next.length - 1);
      return next;
    });
    setProtocolTab('tasks');
    showToast('Добавлено в поручения', 'Перешли на вкладку утверждения поручений', 'success');
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
    setExpandedTaskIdx(null);
  };

  const handleReject = () => {
    logAudit(
      'REJECT_TASKS',
      `Meeting: ${workspaceData.title}`,
      'REJECTED',
      'Руководитель отклонил черновик поручений. База данных не изменена.'
    );
    setTasksToReview([]);
    setExpandedTaskIdx(null);
    showToast('Черновик отклонен', 'Поручения отменены без внесения в реестр', 'warning');
  };

  const cycleSpeed = () => {
    setPlaybackSpeed((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

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
          <h1 className="text-sm font-semibold text-[var(--text-primary)] shrink-0">
            Совещания и протоколы
          </h1>

          <span className="text-[var(--text-muted)]">/</span>

          <div className="relative">
            <select
              value={isNewProtocolDropzoneOpen ? 'new-dropzone' : selectedTranscriptId}
              onChange={(e) => {
                if (e.target.value === 'new-dropzone') {
                  setIsNewProtocolDropzoneOpen(true);
                } else {
                  handleSelectMeeting(e.target.value);
                }
              }}
              className="bg-[var(--bg-elevated)] border border-[var(--border-solid)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:border-[var(--text-primary)] font-medium appearance-none cursor-pointer max-w-[360px]"
            >
              {isNewProtocolDropzoneOpen && (
                <option value="new-dropzone">+ Загрузка новой записи / стенограммы</option>
              )}
              {selectedTranscriptId === 'ad-hoc-new' && !isNewProtocolDropzoneOpen && (
                <option value="ad-hoc-new">[Черновик] {workspaceData.title}</option>
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
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setNewProtocolTitleInput('');
              setIsNewProtocolDropzoneOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#D71921] text-white hover:brightness-110 transition-opacity"
          >
            <Mic className="w-4 h-4" />
            <span>Загрузить аудио / протокол</span>
          </button>

          <button
            onClick={() => setIsInvitationsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
          >
            <Bell className="w-4 h-4 text-[var(--text-secondary)]" />
            <span>Приглашения</span>
            {pendingIncomingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#D71921] text-white leading-none">
                {pendingIncomingCount}
              </span>
            )}
          </button>

          <button
            onClick={openPrepModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            <span>Подготовка встречи</span>
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {isNewProtocolDropzoneOpen ? (
          /* ========================================================================= */
          /* CLEAR AUDIO & TRANSCRIPT INGESTION SCREEN (WHISPER ENTRYPOINT)            */
          /* ========================================================================= */
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 flex items-center justify-center">
            <div className="max-w-2xl w-full space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    Новый протокол совещания
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Загрузите аудиозапись для автоматической расшифровки через Whisper или выберите текстовый файл
                  </p>
                </div>
                <button
                  onClick={() => setIsNewProtocolDropzoneOpen(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-card)] border border-[var(--border-solid)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Вернуться к архиву</span>
                </button>
              </div>

              {/* Optional Meeting Title */}
              <div className="nothing-card p-4 space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)] block">
                  Название совещания (необязательно)
                </label>
                <input
                  type="text"
                  value={newProtocolTitleInput}
                  onChange={(e) => setNewProtocolTitleInput(e.target.value)}
                  placeholder="Например: Планерка цеха по тиражу фотокниг — иначе возьмётся из имени файла"
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-lg px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                />
              </div>

              {/* Primary Drag & Drop Zone for Audio -> Whisper */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingAudio(true);
                }}
                onDragLeave={() => setIsDraggingAudio(false)}
                onDrop={handleDropAudioFile}
                onClick={() => audioInputRef.current?.click()}
                className={`p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-colors text-center space-y-3 ${
                  isDraggingAudio
                    ? 'border-[#D71921] bg-[#D71921]/10'
                    : 'border-[var(--border-dashed)] bg-[var(--bg-card)] hover:border-[var(--text-primary)]'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-solid)] flex items-center justify-center mx-auto text-[#D71921]">
                  <FileAudio className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    Перетащите аудиозапись сюда или нажмите для выбора файла
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
                    Поддерживаются форматы <span className="font-mono">.ogg, .wav, .mp3, .m4a, .webm</span>.
                    Whisper автоматически переведёт речь в стенограмму с таймкодами, а Qwen 2.5 выделит решения и поручения.
                  </p>
                </div>

                <div className="pt-1">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)]">
                    <Mic className="w-4 h-4" />
                    <span>Выбрать аудиофайл и запустить Whisper</span>
                  </span>
                </div>
              </div>

              {/* Two Secondary Options: Text File or Manual Paste */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => transcriptInputRef.current?.click()}
                  className="nothing-card p-4 text-left hover:border-[var(--text-primary)] transition-colors flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-solid)] flex items-center justify-center shrink-0 text-[var(--text-primary)]">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                      Загрузить файл стенограммы
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      Готовый текст в формате .txt, .vtt, .srt или .docx
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleOpenManualNewProtocol}
                  className="nothing-card p-4 text-left hover:border-[var(--text-primary)] transition-colors flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-solid)] flex items-center justify-center shrink-0 text-[var(--text-primary)]">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                      Вставить текст вручную
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      Открыть пустой редактор стенограммы для вставки текста
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : selectedMeetingItem && !showScheduledProtocolWorkspace ? (
          (() => {
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
                <div className="max-w-5xl mx-auto space-y-5">
                  {/* Scheduled Meeting Header */}
                  <div className="nothing-card p-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-500/15 text-sky-500 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                          Запланировано
                        </span>
                        <span>{selectedMeetingItem.date}</span>
                        <span>·</span>
                        <span>{selectedMeetingItem.time}</span>
                        <span>·</span>
                        <span>{selectedMeetingItem.durationMinutes} мин</span>
                      </div>
                      <h2 className="text-base font-semibold text-[var(--text-primary)] mt-2">
                        {selectedMeetingItem.title}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => audioInputRef.current?.click()}
                        disabled={busyAnalyzing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#D71921] text-white hover:brightness-110 transition-opacity disabled:opacity-50"
                      >
                        <Mic className="w-4 h-4" />
                        <span>
                          {busyAnalyzing ? busyLabel : 'Загрузить аудио (Whisper)'}
                        </span>
                      </button>

                      <button
                        onClick={() => transcriptInputRef.current?.click()}
                        disabled={busyAnalyzing}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Загрузить стенограмму</span>
                      </button>

                      <button
                        onClick={handleSwitchToScheduledWorkspace}
                        disabled={busyAnalyzing}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[var(--border-solid)] bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] transition-colors disabled:opacity-50"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Ввести вручную</span>
                      </button>
                    </div>
                  </div>

                  {/* Participants & Agenda */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="nothing-card p-5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] pb-2.5 border-b border-[var(--border-solid)]">
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
                              className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[var(--bg-elevated)]"
                            >
                              <span className="font-medium text-[var(--text-primary)]">{p}</span>
                              {inv ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded ${
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
                                    ? 'Принято'
                                    : inv.status === 'declined'
                                    ? 'Отклонено'
                                    : 'Ожидает ответа'}
                                </span>
                              ) : (
                                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                                  Организатор
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="nothing-card p-5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] pb-2.5 border-b border-[var(--border-solid)]">
                        <FileText className="w-4 h-4 text-[var(--text-secondary)]" />
                        <span>Утвержденный проект повестки</span>
                      </div>
                      <ul className="space-y-2 text-xs text-[var(--text-primary)]">
                        {selectedMeetingItem.agenda.map((item, idx) => (
                          <li key={idx} className="p-2.5 rounded-xl bg-[var(--bg-elevated)]">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {selectedMeetingItem.openQuestions &&
                    selectedMeetingItem.openQuestions.length > 0 && (
                      <div className="nothing-card p-5 space-y-2.5">
                        <div className="text-xs font-semibold text-[var(--text-primary)]">
                          Открытые вопросы к обсуждению
                        </div>
                        <ul className="space-y-1.5 text-xs text-amber-500">
                          {selectedMeetingItem.openQuestions.map((q, idx) => (
                            <li key={idx} className="p-2.5 rounded-xl bg-amber-500/10">
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  <div className="nothing-card p-5 space-y-3">
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                      Открытые поручения участников из реестра ({relatedTasks.length})
                    </div>
                    {relatedTasks.length === 0 ? (
                      <div className="text-xs text-[var(--text-muted)]">
                        У выбранных участников нет незавершенных поручений в реестре
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {relatedTasks.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-medium text-[var(--text-primary)]">{t.title}</div>
                              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                                Ответственный: {t.assigneeName} · Срок: {t.deadline}
                              </div>
                            </div>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-secondary)] shrink-0">
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
          })()
        ) : (
          /* ========================================================================= */
          /* ACTIVE PROTOCOL WORKSPACE (TRANSCRIPT LEFT + VARIANT A TABS RIGHT)        */
          /* ========================================================================= */
          <>
            {/* Left Pane: Transcript & Audio Player */}
            {showTranscript ? (
              <div className="w-[420px] border-r border-[var(--border-solid)] flex flex-col bg-[var(--bg-card)] shrink-0 transition-colors">
                <div className="p-3.5 px-4 border-b border-[var(--border-solid)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="font-semibold text-[var(--text-primary)]">Стенограмма</span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">
                      {workspaceData.date}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => audioInputRef.current?.click()}
                      disabled={busyAnalyzing}
                      title="Загрузить аудио для Whisper"
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center gap-1 transition-colors disabled:opacity-40"
                    >
                      <Mic className="w-3.5 h-3.5 text-[#D71921]" />
                      <span>Аудио</span>
                    </button>
                    <button
                      onClick={() => setIsEditingTranscript((prev) => !prev)}
                      title={isEditingTranscript ? 'Просмотр по репликам' : 'Редактировать текст'}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                        isEditingTranscript
                          ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                          : 'hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowTranscript(false)}
                      title="Свернуть панель"
                      className="w-7 h-7 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Audio Mini-Player */}
                <div className="px-4 py-2.5 border-b border-[var(--border-solid)] bg-[var(--bg-elevated)]/60 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPlayingAudio((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 transition-opacity shrink-0"
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Пауза</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Слушать</span>
                      </>
                    )}
                  </button>

                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-medium text-[#D71921] shrink-0">
                      {activeAudioTime}
                    </span>
                    <div className="flex-1 h-1.5 rounded bg-[var(--border-solid)] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isPlayingAudio ? 'bg-[#D71921] w-2/3' : 'bg-[var(--text-primary)] w-1/3'
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={cycleSpeed}
                    className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[var(--bg-card)] border border-[var(--border-solid)] text-[var(--text-primary)] shrink-0"
                  >
                    {playbackSpeed.toFixed(1)}x
                  </button>
                </div>

                {isEditingTranscript ? (
                  <div className="flex-1 flex flex-col p-4 gap-2.5">
                    <div className="text-xs text-[var(--text-secondary)] flex items-center justify-between">
                      <span>
                        Формат: <code className="font-mono">[00:15] Спикер: Текст</code>
                      </span>
                      <button
                        onClick={() => setIsEditingTranscript(false)}
                        className="px-3 py-1 rounded-md bg-[var(--text-primary)] text-[var(--bg-canvas)] font-medium text-xs"
                      >
                        Готово
                      </button>
                    </div>
                    <textarea
                      value={workspaceData.transcriptText}
                      onChange={(e) =>
                        setWorkspaceData((prev) => ({ ...prev, transcriptText: e.target.value }))
                      }
                      placeholder="Вставьте стенограмму совещания или загрузите аудио выше..."
                      className="flex-1 w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-xl p-3.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] resize-none leading-relaxed"
                    />
                  </div>
                ) : (
                  <div
                    ref={transcriptContainerRef}
                    id={`transcript-${workspaceData.id}`}
                    className="flex-1 overflow-y-auto p-3.5 space-y-2 select-text"
                  >
                    {!workspaceData.transcriptText.trim() ? (
                      <div className="p-6 text-center text-xs text-[var(--text-muted)] space-y-2">
                        <p>Текст стенограммы пока пуст</p>
                        <button
                          onClick={() => audioInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-solid)] text-[var(--text-primary)] font-medium"
                        >
                          Загрузить аудио для Whisper
                        </button>
                      </div>
                    ) : (
                      workspaceData.transcriptText.split('\n').map((line, idx) => {
                        const match = line.match(/^\[([^\]]+)\]\s+([^:]+):\s*(.*)$/);
                        if (match) {
                          const [, rawTs, speaker, text] = match;
                          const tsClean = normalizeTs(rawTs);
                          const isHighlighted =
                            highlightedTimestamp !== null && tsClean === highlightedTimestamp;

                          return (
                            <div
                              key={idx}
                              data-ts={tsClean}
                              onClick={() => {
                                setHighlightedTimestamp(tsClean);
                                setActiveAudioTime(tsClean);
                              }}
                              className={`cursor-pointer p-3 rounded-xl transition-colors flex items-start gap-3 ${
                                isHighlighted
                                  ? 'bg-[#D71921]/10 border border-[#D71921]'
                                  : 'bg-[var(--bg-elevated)]/60 hover:bg-[var(--bg-elevated)] border border-transparent'
                              }`}
                            >
                              <span
                                className={`font-mono text-xs shrink-0 ${
                                  isHighlighted
                                    ? 'text-[#D71921] font-semibold'
                                    : 'text-[var(--text-muted)]'
                                }`}
                              >
                                {tsClean}
                              </span>

                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="text-xs font-semibold text-[var(--text-primary)]">
                                  {speaker}
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
                      })
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-12 border-r border-[var(--border-solid)] bg-[var(--bg-card)] flex flex-col items-center py-4 shrink-0">
                <button
                  onClick={() => setShowTranscript(true)}
                  title="Показать стенограмму"
                  className="w-8 h-8 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-medium text-[var(--text-muted)] [writing-mode:vertical-rl] rotate-180 mt-4 select-none">
                  Стенограмма
                </span>
              </div>
            )}

            {/* Right Pane: Clean Protocol Header + Variant A Tabs */}
            <div className="flex-1 flex flex-col overflow-y-auto p-6 lg:p-8">
              <div className="max-w-4xl mx-auto w-full space-y-5">
                {audioJob?.status === 'transcribing' && (
                  <div className="nothing-card p-4 flex items-center gap-3 text-xs">
                    <Mic className="w-4 h-4 text-[#D71921] shrink-0" />
                    <span>
                      <strong>Whisper расшифровывает «{audioJob.filename}».</strong> Вы можете
                      перейти в «Базу знаний» — результат сохранится автоматически.
                    </span>
                  </div>
                )}

                {analysisJob?.status === 'analyzing' && (
                  <div className="nothing-card p-4 flex items-center gap-3 text-xs">
                    <Cpu className="w-4 h-4 text-[#D71921] animate-spin shrink-0" />
                    <span>
                      <strong>
                        Qwen 2.5 анализирует стенограмму («{analysisJob.meetingTitle}»).
                      </strong>{' '}
                      Решения и поручения появятся здесь автоматически.
                    </span>
                  </div>
                )}

                {/* Protocol Header */}
                <div className="nothing-card p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[240px]">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                        <span>Протокол № {workspaceData.savedProtocolId || workspaceData.id}</span>
                        <span>·</span>
                        <span>{workspaceData.date}</span>
                        {workspaceData.savedProtocolId ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Сохранено в БД
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Черновик
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
                          className="w-full max-w-lg mt-1.5 bg-transparent text-base font-semibold text-[var(--text-primary)] border-b border-[var(--border-solid)] focus:border-[var(--text-primary)] focus:outline-none pb-0.5"
                        />
                      ) : (
                        <h2 className="text-base font-semibold text-[var(--text-primary)] mt-1">
                          {workspaceData.title}
                        </h2>
                      )}
                    </div>

                    {selectedMeetingItem && (
                      <button
                        onClick={() => setShowScheduledProtocolWorkspace(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Карточка встречи</span>
                      </button>
                    )}
                  </div>

                  {/* Clear 3-Button Action Bar */}
                  <div className="pt-3 border-t border-[var(--border-solid)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => audioInputRef.current?.click()}
                        disabled={busyAnalyzing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors disabled:opacity-50"
                      >
                        <Mic className="w-3.5 h-3.5 text-[#D71921]" />
                        <span>Расшифровать аудио (Whisper)</span>
                      </button>

                      <button
                        onClick={handleRunAiAnalysis}
                        disabled={busyAnalyzing}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        <Cpu className={`w-3.5 h-3.5 ${busyAnalyzing ? 'animate-spin' : ''}`} />
                        <span>{busyAnalyzing ? busyLabel : 'Сформировать протокол (ИИ)'}</span>
                      </button>
                    </div>

                    <button
                      onClick={handleSaveProtocol}
                      disabled={isSavingProtocol || busyAnalyzing}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#D71921] text-white hover:brightness-110 transition-opacity disabled:opacity-50"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{isSavingProtocol ? 'Сохранение...' : 'Сохранить протокол в БД'}</span>
                    </button>
                  </div>
                </div>

                {/* VARIANT A: Segmented Tab Switcher between "Итоги и решения" and "Поручения" */}
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center p-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-solid)]">
                    <button
                      type="button"
                      onClick={() => setProtocolTab('summary')}
                      className={`px-3.5 py-1.5 rounded-md text-xs transition-colors ${
                        protocolTab === 'summary'
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Итоги и решения ({workspaceData.decisions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProtocolTab('tasks')}
                      className={`px-3.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5 ${
                        protocolTab === 'tasks'
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span>Поручения к утверждению</span>
                      {tasksToReview.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#D71921] text-white leading-none">
                          {tasksToReview.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {protocolTab === 'summary' && tasksToReview.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setProtocolTab('tasks')}
                      className="text-xs font-medium text-[var(--text-primary)] hover:text-[#D71921] transition-colors flex items-center gap-1"
                    >
                      <span>Перейти к утверждению поручений ({tasksToReview.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {protocolTab === 'summary' ? (
                  /* TAB 1: SUMMARY, DECISIONS, RISKS & OPEN QUESTIONS */
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="nothing-card p-5 space-y-2">
                      <div className="text-xs font-semibold text-[var(--text-primary)]">
                        Краткое резюме встречи
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {workspaceData.summary}
                      </p>
                    </div>

                    {/* Decisions */}
                    <div className="nothing-card p-5 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-solid)]">
                        <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                          Итоги и статусы решений
                        </h3>

                        <div className="inline-flex flex-wrap items-center p-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-solid)] gap-0.5">
                          <button
                            onClick={() => setDecisionFilter('all')}
                            className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                              decisionFilter === 'all'
                                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold'
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
                                className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                                  isActive
                                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                {meta.label} ({count})
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {(() => {
                          const filtered =
                            decisionFilter === 'all'
                              ? workspaceData.decisions
                              : workspaceData.decisions.filter(
                                  (d) => d.category === decisionFilter
                                );
                          if (filtered.length === 0) {
                            return (
                              <div className="text-xs text-[var(--text-muted)] py-4 text-center">
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
                                className="p-3.5 rounded-xl bg-[var(--bg-elevated)]/70 space-y-2 text-xs"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${meta.pillClass}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
                                    <span>{meta.label}</span>
                                  </span>

                                  <div className="flex items-center gap-2 text-xs">
                                    {d.speaker && (
                                      <span className="font-medium text-[var(--text-secondary)]">
                                        {d.speaker}
                                      </span>
                                    )}
                                    {tsClean && (
                                      <button
                                        type="button"
                                        onClick={() => handleJumpToTimestamp(tsClean)}
                                        title="Перейти к реплике в стенограмме"
                                        className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-solid)] hover:border-[var(--text-primary)] text-[var(--text-primary)] transition-colors"
                                      >
                                        <Play className="w-3 h-3 text-[#D71921]" />
                                        <span>{tsClean}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="leading-relaxed text-[var(--text-primary)]">
                                  {d.text}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Risks & Open Questions */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="nothing-card p-5 space-y-3">
                        <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border-solid)]">
                          <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                            Выявленные риски
                          </h3>
                          <span className="text-xs font-mono text-[var(--text-muted)]">
                            {workspaceData.risks?.length || 0}
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {workspaceData.risks && workspaceData.risks.length > 0 ? (
                            workspaceData.risks.map((r) => {
                              const isHigh = r.impact.toLowerCase() === 'high';
                              return (
                                <div
                                  key={r.id}
                                  className="p-3.5 rounded-xl bg-[var(--bg-elevated)]/70 text-xs space-y-1.5"
                                >
                                  <div className="font-semibold text-[var(--text-primary)] flex items-start justify-between gap-2">
                                    <span>{r.riskDescription}</span>
                                    <span
                                      className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded font-medium shrink-0 ${
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
                                    <div className="text-xs text-[var(--text-secondary)]">
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

                      <div className="nothing-card p-5 space-y-3">
                        <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border-solid)]">
                          <h3 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                            <HelpCircle className="w-4 h-4 text-amber-500" />
                            <span>Открытые вопросы</span>
                          </h3>
                          <span className="text-xs font-mono text-[var(--text-muted)]">
                            {workspaceData.openQuestions?.length || 0}
                          </span>
                        </div>

                        {workspaceData.openQuestions && workspaceData.openQuestions.length > 0 ? (
                          <ul className="space-y-2 text-xs">
                            {workspaceData.openQuestions.map((q, idx) => (
                              <li
                                key={idx}
                                className="p-3 rounded-xl bg-[var(--bg-elevated)]/70 space-y-2"
                              >
                                <div className="leading-relaxed text-[var(--text-primary)]">
                                  {q}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSearchQuestionInKB(q)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--bg-card)] border border-[var(--border-solid)] hover:border-[var(--text-primary)] text-[var(--text-primary)] transition-colors"
                                  >
                                    <span>Найти в базе знаний</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddQuestionToTasks(q)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--bg-card)] border border-[var(--border-solid)] hover:border-[var(--text-primary)] text-[var(--text-primary)] transition-colors"
                                  >
                                    <Plus className="w-3 h-3 text-[#D71921]" />
                                    <span>В поручения</span>
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-xs text-[var(--text-muted)]">
                            Нерешённых вопросов не осталось
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* TAB 2: COMPACT TASKS LIST WITH EXPAND-ON-CLICK EDITING */
                  <div className="nothing-card p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-solid)]">
                      <div>
                        <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                          Поручения к утверждению в реестр
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          Нажмите на задачу, чтобы изменить ответственного или срок исполнения
                        </p>
                      </div>

                      <button
                        onClick={handleAddTask}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors border border-[var(--border-solid)]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Добавить задачу</span>
                      </button>
                    </div>

                    {tasksToReview.length === 0 ? (
                      <div className="py-10 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-dashed)] rounded-xl">
                        Все поручения согласованы и записаны в реестр
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {tasksToReview.map((task, idx) => {
                          const isUnassigned =
                            task.assigneeName.includes('уточнения') ||
                            task.assigneeName.includes('Назначить');
                          const isNoDeadline =
                            task.deadline.includes('уточнения') ||
                            task.deadline.includes('Указать');
                          const isExpanded = expandedTaskIdx === idx;

                          return (
                            <div
                              key={idx}
                              className="rounded-xl border border-[var(--border-solid)] bg-[var(--bg-elevated)]/50 overflow-hidden"
                            >
                              {/* Compact Row Header */}
                              <div
                                onClick={() => setExpandedTaskIdx(isExpanded ? null : idx)}
                                className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                    {task.title}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                    <span
                                      className={
                                        isUnassigned
                                          ? 'text-[#D71921] font-medium'
                                          : 'text-[var(--text-secondary)]'
                                      }
                                    >
                                      {task.assigneeName}
                                    </span>
                                    <span className="text-[var(--text-muted)]">·</span>
                                    <span
                                      className={`font-mono ${
                                        isNoDeadline
                                          ? 'text-[#D71921] font-medium'
                                          : 'text-[var(--text-muted)]'
                                      }`}
                                    >
                                      {task.deadline}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {task.timestamp && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleJumpToTimestamp(task.timestamp);
                                      }}
                                      className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-solid)] text-[var(--text-primary)]"
                                    >
                                      <Play className="w-3 h-3 text-[#D71921]" />
                                      <span>{normalizeTs(task.timestamp)}</span>
                                    </button>
                                  )}

                                  <span className="text-[11px] text-[var(--text-secondary)] px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-solid)]">
                                    {isExpanded ? 'Свернуть' : 'Изменить'}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTask(idx);
                                    }}
                                    title="Удалить поручение"
                                    className="w-7 h-7 rounded-md hover:bg-[#D71921]/15 text-[var(--text-muted)] hover:text-[#D71921] flex items-center justify-center transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Inline Editor */}
                              {isExpanded && (
                                <div className="p-4 pt-3 border-t border-[var(--border-solid)] bg-[var(--bg-card)] space-y-3">
                                  <div>
                                    <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                                      Формулировка поручения
                                    </label>
                                    <input
                                      type="text"
                                      value={task.title}
                                      onChange={(e) =>
                                        handleUpdateTask(idx, 'title', e.target.value)
                                      }
                                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] px-3 py-1.5 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                                        Ответственный
                                      </label>
                                      <input
                                        type="text"
                                        value={task.assigneeName}
                                        onChange={(e) =>
                                          handleUpdateTask(idx, 'assigneeName', e.target.value)
                                        }
                                        className={`w-full bg-[var(--bg-elevated)] px-3 py-1.5 rounded-lg text-xs text-[var(--text-primary)] border focus:outline-none ${
                                          isUnassigned
                                            ? 'border-[#D71921]'
                                            : 'border-[var(--border-solid)] focus:border-[var(--text-primary)]'
                                        }`}
                                      />
                                    </div>

                                    <div>
                                      <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                                        Срок исполнения
                                      </label>
                                      <input
                                        type="text"
                                        value={task.deadline}
                                        onChange={(e) =>
                                          handleUpdateTask(idx, 'deadline', e.target.value)
                                        }
                                        className={`w-full bg-[var(--bg-elevated)] px-3 py-1.5 rounded-lg text-xs text-[var(--text-primary)] border focus:outline-none ${
                                          isNoDeadline
                                            ? 'border-[#D71921]'
                                            : 'border-[var(--border-solid)] focus:border-[var(--text-primary)]'
                                        }`}
                                      />
                                    </div>
                                  </div>

                                  {task.sourceQuote && (
                                    <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-elevated)] p-2.5 rounded-lg">
                                      Основание в стенограмме: «{task.sourceQuote}»
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        <div className="pt-3 flex items-center justify-end gap-2.5">
                          <button
                            onClick={handleReject}
                            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-elevated)] rounded-lg transition-colors"
                          >
                            Отклонить черновик
                          </button>

                          <button
                            onClick={handleApprove}
                            className="px-4 py-2 text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 rounded-lg transition-opacity flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Утвердить в реестр ({tasksToReview.length})</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
            <div className="flex items-start justify-between pb-3.5 border-b border-[var(--border-solid)]">
              <div>
                <div className="text-xs font-mono text-[var(--text-muted)] mb-1">
                  {prepStep === 'setup'
                    ? 'Шаг 1 из 2 · Повестка, документы и слоты'
                    : 'Шаг 2 из 2 · Предпросмотр приглашения'}
                </div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {prepStep === 'setup'
                    ? 'Подготовка совещания и подбор слота календаря'
                    : 'Подтверждение создания встречи'}
                </h2>
              </div>

              <button
                onClick={() => setIsPrepModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {prepStep === 'setup' ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
                      Тема встречи
                    </label>
                    <input
                      type="text"
                      value={prepTopic}
                      onChange={(e) => setPrepTopic(e.target.value)}
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] px-3.5 py-2 rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
                        Участники ({prepParticipants.length})
                      </label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {participantsCatalog.map((p) => {
                          const checked = prepParticipants.includes(p.shortName);
                          const isSelf = surnameKey(p.name) === currentUserSurname;
                          return (
                            <label
                              key={p.id}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors text-xs ${
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
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--text-primary)] text-[var(--bg-canvas)]">
                                      Вы
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[var(--text-muted)] truncate">
                                  {p.roleTitle}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
                        Документы базы ({selectedDocIds.length}/{documents.length})
                      </label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {documents.map((doc) => {
                          const checked = selectedDocIds.includes(doc.id);
                          return (
                            <label
                              key={doc.id}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors text-xs ${
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
                                <div className="text-xs font-medium leading-snug line-clamp-2">
                                  {doc.title}
                                </div>
                                <div className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
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
                    className="w-full py-2 px-4 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-solid)] flex items-center justify-center gap-2 text-xs font-semibold text-[var(--text-primary)] transition-colors disabled:opacity-50"
                  >
                    <Cpu className={`w-4 h-4 ${isAiGeneratingAgenda ? 'animate-spin' : ''}`} />
                    <span>
                      {isAiGeneratingAgenda
                        ? 'Формирование повестки и проверка задач...'
                        : 'Сформировать проект повестки и вопросы'}
                    </span>
                  </button>

                  {prepError && (
                    <div className="p-3 rounded-xl bg-[#D71921]/10 border border-[#D71921]/30 text-xs text-[#D71921] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{prepError}</span>
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-[var(--bg-elevated)]/60 border border-[var(--border-solid)] space-y-3">
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                      Проект повестки
                    </div>

                    {generatedAgenda.agenda.length === 0 ? (
                      <div className="text-xs text-[var(--text-muted)]">
                        Нажмите кнопку выше, чтобы сформировать повестку по выбранным документам и
                        открытым задачам из реестра
                      </div>
                    ) : (
                      <ul className="text-xs text-[var(--text-primary)] space-y-1">
                        {generatedAgenda.agenda.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}

                    {generatedAgenda.openTasks.length > 0 && (
                      <div className="pt-2 border-t border-[var(--border-solid)]">
                        <div className="text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                          Открытые задачи участников
                        </div>
                        <div className="space-y-1.5">
                          {generatedAgenda.openTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-2.5 rounded-lg bg-[var(--bg-card)] flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-[var(--text-primary)] truncate">
                                  {task.title}
                                </div>
                                <div className="text-[var(--text-muted)] font-mono text-[11px]">
                                  {task.assigneeName} · до {task.deadline}
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-[var(--bg-elevated)] text-[var(--text-secondary)] shrink-0">
                                {task.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {generatedAgenda.openQuestions.length > 0 && (
                      <div className="pt-2 border-t border-[var(--border-solid)]">
                        <div className="text-xs font-semibold text-[var(--text-primary)] mb-1">
                          Открытые вопросы к обсуждению
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
                <div className="space-y-3 pt-3 border-t border-[var(--border-solid)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                      Свободные слоты в календаре
                    </h3>
                    <span className="text-xs font-mono text-[var(--text-muted)]">
                      Доступно {calendarSlots.filter((s) => s.isAvailable).length} из{' '}
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
                          className={`p-3 rounded-xl text-left transition-colors text-xs flex flex-col justify-between gap-1.5 border ${
                            !slot.isAvailable
                              ? 'opacity-45 cursor-not-allowed border-[var(--border-solid)] bg-[var(--bg-elevated)]/40'
                              : isSelected
                              ? 'border-[var(--text-primary)] bg-[var(--bg-elevated)] ring-1 ring-[var(--text-primary)] cursor-pointer'
                              : 'border-[var(--border-solid)] bg-[var(--bg-card)] hover:border-[var(--text-secondary)] cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium text-[var(--text-primary)]">
                              {slot.date}
                            </span>
                            {!slot.isAvailable ? (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#D71921]/15 text-[#D71921]">
                                Занято
                              </span>
                            ) : (
                              isSelected && <Check className="w-3.5 h-3.5 text-[#D71921]" />
                            )}
                          </div>

                          <div className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                            {slot.startTime} – {slot.endTime}
                          </div>

                          {!slot.isAvailable ? (
                            <div className="text-[11px] text-[var(--text-muted)]">
                              Слот забронирован
                            </div>
                          ) : busySelected.length === 0 ? (
                            <div className="text-[11px] text-emerald-500 font-medium">
                              Все участники свободны
                            </div>
                          ) : (
                            <div className="text-[11px] text-amber-500 font-medium">
                              Занят(ы): {busySelected.join(', ')}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[var(--border-solid)]">
                  <button
                    type="button"
                    onClick={() => setIsPrepModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] rounded-lg transition-colors"
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    onClick={handleProceedToPreview}
                    disabled={!selectedSlot || !selectedSlot.isAvailable}
                    className="px-4 py-2 text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 rounded-lg flex items-center gap-1.5 transition-opacity disabled:opacity-50"
                  >
                    <span>Далее: предпросмотр приглашения</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-[var(--text-primary)] flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="leading-relaxed text-xs">
                    <strong>Подтверждение действия:</strong> проверьте детали события и текст
                    приглашения. Запись в календарь и рассылка выполнятся после подтверждения.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)]">
                    <div className="text-[11px] text-[var(--text-muted)] mb-1">
                      Событие и время
                    </div>
                    <div className="font-semibold text-[var(--text-primary)]">{prepTopic}</div>
                    <div className="text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {selectedSlot?.date} · {selectedSlot?.startTime}–{selectedSlot?.endTime}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)]">
                    <div className="text-[11px] text-[var(--text-muted)] mb-1">
                      Получатели приглашений
                    </div>
                    {prepParticipants.filter((p) => surnameKey(p) !== currentUserSurname).length ===
                    0 ? (
                      <div className="text-amber-500 text-xs">
                        Другие участники не выбраны — встреча создастся только в вашем календаре
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {prepParticipants
                          .filter((p) => surnameKey(p) !== currentUserSurname)
                          .map((recipient) => (
                            <span
                              key={recipient}
                              className="px-2.5 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-primary)] text-xs font-medium"
                            >
                              {recipient}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1.5">
                    Текст письма-приглашения
                  </label>
                  <textarea
                    rows={7}
                    value={invitationText}
                    onChange={(e) => setInvitationText(e.target.value)}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] p-3.5 rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] leading-relaxed"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between gap-2.5 border-t border-[var(--border-solid)]">
                  <button
                    type="button"
                    onClick={() => setPrepStep('setup')}
                    className="px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Назад</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPrepModalOpen(false)}
                      className="px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] rounded-lg transition-colors"
                    >
                      Отмена
                    </button>

                    <button
                      type="button"
                      disabled={isCreatingMeeting}
                      onClick={handleConfirmMeetingCreation}
                      className="px-4 py-2 text-xs font-semibold bg-[#D71921] hover:brightness-110 text-white rounded-lg flex items-center gap-1.5 transition-opacity disabled:opacity-50"
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
            <div className="flex items-start justify-between pb-3 border-b border-[var(--border-solid)]">
              <div>
                <div className="text-xs text-[var(--text-muted)]">
                  Профиль: {currentUser.name}
                </div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Приглашения на совещания
                </h2>
              </div>

              <button
                onClick={() => setIsInvitationsOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="inline-flex items-center p-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-solid)] gap-1">
              <button
                type="button"
                onClick={() => setInvTab('incoming')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  invTab === 'incoming'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Входящие мне ({incomingInvitations.length})
              </button>
              <button
                type="button"
                onClick={() => setInvTab('all')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  invTab === 'all'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold'
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
                  <div className="py-10 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-dashed)] rounded-xl">
                    {invTab === 'incoming'
                      ? 'У текущей роли пока нет входящих приглашений'
                      : 'Отправленных приглашений пока нет'}
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {list.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-4 rounded-xl bg-[var(--bg-elevated)]/60 border border-[var(--border-solid)] space-y-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[var(--text-primary)]">
                            {inv.meetingTitle}
                          </div>
                          <div className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                            {inv.date} · {inv.time} · Организатор: {inv.organizerName}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                            Получатель: <span className="font-medium">{inv.recipientName}</span>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded shrink-0 ${
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
                            ? 'Принято'
                            : inv.status === 'declined'
                            ? 'Отклонено'
                            : 'Ожидает'}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-[var(--bg-card)] whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                        {inv.messageText}
                      </div>

                      {invTab === 'incoming' && inv.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => respondToInvitation(inv.id, 'declined')}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#D71921]/15 hover:bg-[#D71921] text-[#D71921] hover:text-white transition-colors"
                          >
                            Отклонить
                          </button>
                          <button
                            type="button"
                            onClick={() => respondToInvitation(inv.id, 'accepted')}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
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