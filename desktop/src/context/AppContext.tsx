import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  UserRole,
  UserProfile,
  TaskItem,
  AuditLogEntry,
  KPIMetric,
  DocumentItem,
  RAGMessage,
  CalendarSlot,
  MeetingItem,
  ParticipantOption,
  PrepareAgendaResponse,
  MeetingInvitationItem,
} from '../types';
import {
  MOCK_USERS,
  MOCK_DOCUMENTS,
  MOCK_KPI_METRICS,
  INITIAL_TASKS,
  INITIAL_AUDIT_LOG,
  MOCK_CALENDAR_SLOTS,
} from '../mock/mockData';
import { apiClient, ProtocolAnalysisResult } from '../api/apiClient';

export type ThemeMode = 'light' | 'dark';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

interface AppContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  isAuthenticated: boolean;
  loginAs: (role: UserRole) => Promise<void>;
  logout: () => void;
  currentRole: UserRole;
  currentUser: UserProfile;
  setRole: (role: UserRole) => Promise<void>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tasks: TaskItem[];
  addTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<TaskItem>) => Promise<void>;
  toggleTaskStatus: (id: string) => Promise<void>;
  batchApproveTasks: (newTasks: Omit<TaskItem, 'id'>[], meetingTitle: string) => Promise<void>;
  auditLogs: AuditLogEntry[];
  logAudit: (
    actionType: string,
    targetEntity: string,
    status: 'SUCCESS' | 'REJECTED' | 'ACCESS_DENIED' | 'PENDING',
    details: string
  ) => void;
  toasts: Toast[];
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  resetDemoData: () => Promise<void>;
  kpiMetrics: KPIMetric[];
  documents: DocumentItem[];
  canAccessDocument: (minClearance: number) => boolean;
  backendOnline: boolean;
  isSyncing: boolean;
  syncWithBackend: () => Promise<void>;
  queryRAG: (queryText: string) => Promise<RAGMessage>;
  ragMessages: RAGMessage[];
  setRagMessages: React.Dispatch<React.SetStateAction<RAGMessage[]>>;
  analyzeMeetingTranscript: (text: string, title: string) => Promise<ProtocolAnalysisResult | null>;
  calendarSlots: CalendarSlot[];
  scheduledMeetings: MeetingItem[];
  participantsCatalog: ParticipantOption[];
  invitations: MeetingInvitationItem[];
  prepareMeetingAgenda: (params: {
    topic: string;
    participants: string[];
    selectedDocIds: string[];
  }) => Promise<PrepareAgendaResponse>;
  scheduleMeeting: (params: {
    title: string;
    date: string;
    time: string;
    durationMinutes?: number;
    participants: string[];
    agenda: string[];
    openQuestions?: string[];
    slotId?: string;
    invitationText?: string;
  }) => Promise<MeetingItem>;
  respondToInvitation: (invId: string, status: 'accepted' | 'declined') => Promise<void>;
}

const DEFAULT_PARTICIPANTS: ParticipantOption[] = [
  { id: 'u-1', name: 'Смирнов Алексей Викторович', shortName: 'Смирнов А.В.', roleTitle: 'Генеральный директор', department: 'Дирекция', role: 'ROLE_DIRECTOR', isSystemUser: true },
  { id: 'u-2', name: 'Иванов Игорь Сергеевич', shortName: 'Иванов И.С.', roleTitle: 'Начальник производства', department: 'Производственный цех', role: 'ROLE_PRODUCTION_HEAD', isSystemUser: true },
  { id: 'u-3', name: 'Ковалева Елена Дмитриевна', shortName: 'Ковалева Е.Д.', roleTitle: 'Руководитель клиентского сервиса', department: 'Служба заботы picPac.by', role: 'ROLE_SUPPORT_HEAD', isSystemUser: true },
  { id: 'u-4', name: 'Петрова Анна Михайловна', shortName: 'Петрова А.М.', roleTitle: 'Руководитель отдела снабжения', department: 'Отдел закупок и логистики', role: null, isSystemUser: false },
  { id: 'u-5', name: 'Соколов Дмитрий Андреевич', shortName: 'Соколов Д.А.', roleTitle: 'Главный инженер', department: 'Инженерная служба', role: null, isSystemUser: false },
];

const buildWelcomeRagMessage = (userName: string): RAGMessage => ({
  id: 'welcome',
  sender: 'assistant',
  text: `Здравствуйте, ${userName}! Задайте вопрос по внутренним регламентам, допускам брака или стандартам клиентского сервиса picPac.by.`,
  timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
});

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Theme state with local persistence
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('photoprint_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('photoprint_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentRole, setCurrentRole] = useState<UserRole>('ROLE_DIRECTOR');
  const [activeTab, setActiveTab] = useState<string>('meetings');
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOG);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetric[]>(MOCK_KPI_METRICS);
  const [documents, setDocuments] = useState<DocumentItem[]>(MOCK_DOCUMENTS);
  const [calendarSlots, setCalendarSlots] = useState<CalendarSlot[]>(MOCK_CALENDAR_SLOTS);
  const [scheduledMeetings, setScheduledMeetings] = useState<MeetingItem[]>([]);
  const [participantsCatalog, setParticipantsCatalog] = useState<ParticipantOption[]>(DEFAULT_PARTICIPANTS);
  const [invitations, setInvitations] = useState<MeetingInvitationItem[]>([]);

  // Backend connection state
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const currentUser = MOCK_USERS[currentRole];
  const [ragMessages, setRagMessages] = useState<RAGMessage[]>(() => [
    buildWelcomeRagMessage(MOCK_USERS['ROLE_DIRECTOR'].name),
  ]);

  const showToast = useCallback((title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const logAudit = useCallback((
    actionType: string,
    targetEntity: string,
    status: 'SUCCESS' | 'REJECTED' | 'ACCESS_DENIED' | 'PENDING',
    details: string
  ) => {
    const now = new Date();
    const timeStr = now.toLocaleDateString('ru-RU') + ' ' + now.toLocaleTimeString('ru-RU');
    const newEntry: AuditLogEntry = {
      id: 'aud-' + Date.now().toString(),
      timestamp: timeStr,
      userName: currentUser.name,
      userRole: currentRole,
      actionType,
      targetEntity,
      status,
      details,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  }, [currentUser.name, currentRole]);

  // Synchronize state with backend
  const syncWithBackend = useCallback(async () => {
    setIsSyncing(true);
    try {
      const health = await apiClient.checkHealth();
      if (health.online) {
        setBackendOnline(true);

        // Fetch live entities concurrently
        const [
          liveTasks,
          liveMetrics,
          liveAudit,
          liveDocs,
          liveSlots,
          liveMeetings,
          liveUsers,
          liveInvitations,
        ] = await Promise.allSettled([
          apiClient.getTasks(),
          apiClient.getMetrics(),
          apiClient.getAuditLogs(),
          apiClient.getDocuments(),
          apiClient.getCalendarSlots(),
          apiClient.getMeetings(),
          apiClient.getUsers(),
          apiClient.getInvitations(),
        ]);

        if (liveTasks.status === 'fulfilled' && liveTasks.value.length > 0) {
          setTasks(liveTasks.value);
        }
        if (liveMetrics.status === 'fulfilled' && liveMetrics.value.length > 0) {
          setKpiMetrics(liveMetrics.value);
        }
        if (liveAudit.status === 'fulfilled' && liveAudit.value.length > 0) {
          setAuditLogs(liveAudit.value);
        }
        if (liveDocs.status === 'fulfilled') {
          setDocuments(liveDocs.value);
        }
        if (liveSlots.status === 'fulfilled' && liveSlots.value.length > 0) {
          setCalendarSlots(liveSlots.value);
        }
        if (liveMeetings.status === 'fulfilled') {
          setScheduledMeetings(liveMeetings.value);
        }
        if (liveUsers.status === 'fulfilled' && liveUsers.value.length > 0) {
          setParticipantsCatalog(liveUsers.value);
        }
        if (liveInvitations.status === 'fulfilled') {
          setInvitations(liveInvitations.value);
        }
      } else {
        setBackendOnline(false);
      }
    } catch {
      setBackendOnline(false);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Probe backend on mount and periodically every 10 seconds
  useEffect(() => {
    syncWithBackend();
    const interval = setInterval(() => {
      syncWithBackend();
    }, 10000);
    return () => clearInterval(interval);
  }, [syncWithBackend]);

  const loginAs = async (role: UserRole) => {
    setCurrentRole(role);
    setIsAuthenticated(true);
    const targetUser = MOCK_USERS[role];
    setRagMessages([buildWelcomeRagMessage(targetUser.name)]);

    if (backendOnline) {
      try {
        await apiClient.switchRole(role);
        await syncWithBackend();
      } catch {
        // fallback
      }
    } else {
      const clearance = role === 'ROLE_DIRECTOR' ? 1 : role === 'ROLE_PRODUCTION_HEAD' ? 2 : 3;
      setDocuments(MOCK_DOCUMENTS.filter((d) => d.minClearance >= clearance));
    }

    logAudit(
      'LOGIN',
      `User: ${targetUser.id}`,
      'SUCCESS',
      `Вход в систему: ${targetUser.name} (${targetUser.roleTitle})`
    );
    showToast('Вход выполнен', `Вы вошли как: ${targetUser.name}`, 'info');
  };

  const logout = () => {
    logAudit('LOGOUT', `User: ${currentUser.id}`, 'SUCCESS', 'Пользователь вышел из системы');
    setIsAuthenticated(false);
  };

  const setRole = async (newRole: UserRole) => {
    setCurrentRole(newRole);
    const targetUser = MOCK_USERS[newRole];
    setRagMessages([buildWelcomeRagMessage(targetUser.name)]);

    if (backendOnline) {
      try {
        await apiClient.switchRole(newRole);
        await syncWithBackend();
      } catch {
        // fallback
      }
    } else {
      const clearance = newRole === 'ROLE_DIRECTOR' ? 1 : newRole === 'ROLE_PRODUCTION_HEAD' ? 2 : 3;
      setDocuments(MOCK_DOCUMENTS.filter((d) => d.minClearance >= clearance));
    }

    logAudit(
      'SWITCH_ROLE',
      `User: ${targetUser.id}`,
      'SUCCESS',
      `Переключение роли на: ${targetUser.roleTitle}`
    );
    showToast('Роль изменена', `Активная роль: ${targetUser.roleTitle}`, 'info');
  };

  const canAccessDocument = (minClearance: number): boolean => {
    if (currentRole === 'ROLE_DIRECTOR') return true;
    if (currentRole === 'ROLE_PRODUCTION_HEAD' && minClearance >= 2) return true;
    if (currentRole === 'ROLE_SUPPORT_HEAD' && minClearance >= 3) return true;
    return false;
  };

  const addTask = async (taskData: Omit<TaskItem, 'id'>) => {
    const tempId = 'task-' + Date.now().toString();
    const newTask: TaskItem = { ...taskData, id: tempId };
    setTasks((prev) => [newTask, ...prev]);

    if (backendOnline) {
      try {
        const liveTask = await apiClient.createTask(taskData);
        setTasks((prev) => prev.map((t) => (t.id === tempId ? liveTask : t)));
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
      } catch {
        // keep local
      }
    }

    logAudit('CREATE_TASK', `Task: ${newTask.title}`, 'SUCCESS', `Создана задача: ${newTask.title}`);
  };

  const updateTask = async (id: string, updates: Partial<TaskItem>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));

    if (backendOnline) {
      try {
        await apiClient.updateTask(id, updates);
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
      } catch {
        // keep local
      }
    }

    logAudit('UPDATE_TASK', `Task: ${id}`, 'SUCCESS', `Изменены параметры задачи`);
  };

  const toggleTaskStatus = async (id: string) => {
    const currentTask = tasks.find((t) => t.id === id);
    const nextStatus = currentTask?.status === 'completed' ? 'active' : 'completed';

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );

    if (backendOnline) {
      try {
        await apiClient.updateTask(id, { status: nextStatus });
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
      } catch {
        // keep local
      }
    }

    logAudit(
      'CHANGE_TASK_STATUS',
      `Task: ${id}`,
      'SUCCESS',
      `Статус задачи изменен на "${nextStatus === 'completed' ? 'Завершена' : 'В работе'}"`
    );
  };

  const batchApproveTasks = async (newTasks: Omit<TaskItem, 'id'>[], meetingTitle: string) => {
    const localCreated: TaskItem[] = newTasks.map((t, idx) => ({
      ...t,
      id: `task-appr-${Date.now()}-${idx}`,
      status: 'active',
      meetingTitle,
    }));

    setTasks((prev) => [...localCreated, ...prev]);

    if (backendOnline) {
      try {
        const liveConfirmed = await apiClient.confirmTasks(localCreated, meetingTitle);
        if (liveConfirmed && liveConfirmed.length > 0) {
          setTasks((prev) => {
            const idsToRemove = new Set(localCreated.map((lc) => lc.id));
            const withoutLocal = prev.filter((p) => !idsToRemove.has(p.id));
            return [...liveConfirmed, ...withoutLocal];
          });
        }
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
      } catch {
        // keep local
      }
    }

    logAudit(
      'APPROVE_TASKS_BATCH',
      `Meeting: ${meetingTitle}`,
      'SUCCESS',
      `Утверждено ${localCreated.length} поручений по итогам совещания (Human-in-the-Loop)`
    );
    showToast(
      'Поручения утверждены',
      `В реестр успешно добавлено ${localCreated.length} поручений`,
      'success'
    );
  };

  const prepareMeetingAgenda = async (params: {
    topic: string;
    participants: string[];
    selectedDocIds: string[];
  }): Promise<PrepareAgendaResponse> => {
    if (!backendOnline) {
      throw new Error('Бэкенд недоступен. Запустите сервер FastAPI и проверьте подключение к Ollama.');
    }
    const result = await apiClient.prepareAgenda({
      ...params,
      userRole: currentRole,
    });
    try {
      const freshLogs = await apiClient.getAuditLogs();
      if (freshLogs.length > 0) setAuditLogs(freshLogs);
    } catch {
      // ignore audit refresh error
    }
    return result;
  };

  const scheduleMeeting = async (params: {
    title: string;
    date: string;
    time: string;
    durationMinutes?: number;
    participants: string[];
    agenda: string[];
    openQuestions?: string[];
    slotId?: string;
    invitationText?: string;
  }): Promise<MeetingItem> => {
    if (backendOnline) {
      const liveMeeting = await apiClient.createMeeting(params);
      await syncWithBackend();
      showToast(
        'Встреча подтверждена и создана',
        `Слот ${params.date} (${params.time}) забронирован, приглашения отправлены.`,
        'success'
      );
      return liveMeeting;
    }

    const newMeeting: MeetingItem = {
      id: `m-sched-${Date.now()}`,
      title: params.title,
      date: params.date,
      time: params.time,
      durationMinutes: params.durationMinutes || 45,
      participants: params.participants,
      agenda: params.agenda,
      status: 'scheduled',
      openQuestions: params.openQuestions || [],
    };
    setScheduledMeetings((prev) => [newMeeting, ...prev]);
    if (params.slotId) {
      setCalendarSlots((prev) =>
        prev.map((s) => (s.id === params.slotId ? { ...s, isAvailable: false } : s))
      );
    }
    logAudit(
      'SCHEDULE_MEETING',
      `Meeting: ${params.title}`,
      'SUCCESS',
      `Локальное подтверждение встречи на ${params.date} ${params.time}`
    );
    showToast('Встреча запланирована', `Событие создано на ${params.date} в ${params.time}`, 'success');
    return newMeeting;
  };

  const respondToInvitation = async (invId: string, status: 'accepted' | 'declined') => {
    if (backendOnline) {
      const updated = await apiClient.respondInvitation(invId, status);
      setInvitations((prev) => prev.map((inv) => (inv.id === invId ? updated : inv)));
      const freshLogs = await apiClient.getAuditLogs();
      if (freshLogs.length > 0) setAuditLogs(freshLogs);
    } else {
      setInvitations((prev) => prev.map((inv) => (inv.id === invId ? { ...inv, status } : inv)));
    }
    showToast(
      status === 'accepted' ? 'Приглашение принято' : 'Приглашение отклонено',
      status === 'accepted' ? 'Участие во встрече подтверждено' : 'Организатор увидит ваш отказ',
      status === 'accepted' ? 'success' : 'warning'
    );
  };

  const analyzeMeetingTranscript = async (
    transcriptText: string,
    meetingTitle: string
  ): Promise<ProtocolAnalysisResult | null> => {
    if (backendOnline) {
      try {
        return await apiClient.analyzeTranscript({ transcriptText, meetingTitle });
      } catch {
        return null;
      }
    }
    return null;
  };

  const queryRAG = async (queryText: string): Promise<RAGMessage> => {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    if (backendOnline) {
      try {
        const res = await apiClient.queryKnowledgeBase(queryText, currentRole);
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
        return res;
      } catch (err: any) {
        try {
          const freshLogs = await apiClient.getAuditLogs();
          if (freshLogs.length > 0) setAuditLogs(freshLogs);
        } catch {
          // ignore
        }
        throw new Error(err?.message || 'Ошибка обращения к LLM / базе знаний на бэкенде.');
      }
    }

    // Local fallback if offline or timeout
    const lower = queryText.toLowerCase();

    // Check RBAC for sensitive finance / salaries
    const isFinanceProbe = ['оклад', 'зарплат', 'бдр', 'прибыль', 'p&l', 'премирован'].some((kw) => lower.includes(kw));
    if (isFinanceProbe && !canAccessDocument(1)) {
      logAudit(
        'ACCESS_DENIED',
        'Document: doc-fin-02',
        'ACCESS_DENIED',
        `Попытка несанкционированного доступа к финансовой информации пользователем с ролью ${currentRole}`
      );
      return {
        id: 'asst-' + Date.now(),
        sender: 'assistant',
        text: `⛔ Доступ ограничен политикой безопасности предприятия. У вас отсутствуют права на просмотр финансовой отчетности, фонда оплаты труда и персональных окладов руководства ООО «Фотопринт». Попытка доступа зарегистрирована в журнале аудита информационной безопасности.`,
        timestamp: time,
        status: 'access_denied',
        citations: [],
      };
    }

    // Search across all 20 corporate documents
    const words = lower.split(/[\s,?.!]+/).filter((w) => w.length >= 3);
    const scoredDocs = MOCK_DOCUMENTS.map((doc) => {
      const docText = (doc.title + ' ' + doc.summary + ' ' + doc.content).toLowerCase();
      let score = 0;
      for (const w of words) {
        const root = w.length >= 5 ? w.slice(0, 4) : w;
        if (docText.includes(root)) score += 1;
      }
      return { doc, score };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scoredDocs.length > 0) {
      const best = scoredDocs[0].doc;

      // Check clearance
      if (!canAccessDocument(best.minClearance)) {
        logAudit('ACCESS_DENIED', best.id, 'ACCESS_DENIED', `Отказ в доступе к ${best.id} для роли ${currentRole}`);
        return {
          id: 'asst-' + Date.now(),
          sender: 'assistant',
          text: `⛔ Доступ ограничен политикой безопасности предприятия. У вашей роли отсутствуют права на просмотр документа «${best.title}». Инцидент зафиксирован в журнале аудита.`,
          timestamp: time,
          status: 'access_denied',
          citations: [],
        };
      }

      logAudit('RAG_SEARCH', best.id, 'SUCCESS', `Поиск по регламенту «${best.title}»`);
      return {
        id: 'asst-' + Date.now(),
        sender: 'assistant',
        text: `На основании регламента «${best.title}» (редакция от ${best.date}):\n\n${best.summary}\n\nВыдержка: ${best.content}`,
        timestamp: time,
        status: 'grounded',
        citations: scoredDocs.slice(0, 2).map((s) => ({
          documentId: s.doc.id,
          documentTitle: s.doc.title,
          documentDate: s.doc.date,
          category: s.doc.category,
          excerpt: s.doc.content.slice(0, 240) + '...',
        })),
      };
    }

    return {
      id: 'asst-' + Date.now(),
      sender: 'assistant',
      text: 'В доступных регламентах и документах ООО «Фотопринт» прямых оснований для ответа не найдено. Согласно регламенту безопасности AI-05, утверждение помечено как «требует уточнения / данные отсутствуют».',
      timestamp: time,
      status: 'needs_clarification',
      citations: [],
    };
  };

  const resetDemoData = async () => {
    if (backendOnline) {
      try {
        await apiClient.resetDemo();
        setCurrentRole('ROLE_DIRECTOR');
        setRagMessages([buildWelcomeRagMessage(MOCK_USERS['ROLE_DIRECTOR'].name)]);
        await syncWithBackend();
        showToast('Демо сброшено', 'База данных, календарь, приглашения и аудит сброшены к эталону', 'info');
        return;
      } catch {
        // fallback to local
      }
    }

    setTasks(INITIAL_TASKS);
    setAuditLogs(INITIAL_AUDIT_LOG);
    setCalendarSlots(MOCK_CALENDAR_SLOTS);
    setScheduledMeetings([]);
    setInvitations([]);
    setCurrentRole('ROLE_DIRECTOR');
    setRagMessages([buildWelcomeRagMessage(MOCK_USERS['ROLE_DIRECTOR'].name)]);
    logAudit(
      'RESET_DEMO',
      'System',
      'SUCCESS',
      'Сброс состояния к исходному демо-сценарию'
    );
    showToast('Данные сброшены', 'Все задачи и логи возвращены к исходному состоянию', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        isAuthenticated,
        loginAs,
        logout,
        currentRole,
        currentUser,
        setRole,
        activeTab,
        setActiveTab,
        tasks,
        addTask,
        updateTask,
        toggleTaskStatus,
        batchApproveTasks,
        auditLogs,
        logAudit,
        toasts,
        showToast,
        removeToast,
        resetDemoData,
        kpiMetrics,
        documents,
        canAccessDocument,
        backendOnline,
        isSyncing,
        syncWithBackend,
        queryRAG,
        ragMessages,
        setRagMessages,
        analyzeMeetingTranscript,
        calendarSlots,
        scheduledMeetings,
        participantsCatalog,
        invitations,
        prepareMeetingAgenda,
        scheduleMeeting,
        respondToInvitation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
