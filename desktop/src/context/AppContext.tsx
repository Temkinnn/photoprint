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
  MeetingDraft,
  TranscriptItem,
  OverviewBrief,
} from '../types';
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
  deleteTask: (id: string) => Promise<void>;
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
  analyzeMeetingTranscript: (text: string, title: string) => Promise<ProtocolAnalysisResult | null>;
  calendarSlots: CalendarSlot[];
  scheduledMeetings: MeetingItem[];
  transcripts: TranscriptItem[];
  users: UserProfile[];
  overviewBrief: OverviewBrief | null;
  scheduleMeeting: (params: {
    title: string;
    date: string;
    time: string;
    durationMinutes?: number;
    participants: string[];
    agenda: string[];
  }) => Promise<void>;
  meetingDraft: MeetingDraft;
  setMeetingDraft: React.Dispatch<React.SetStateAction<MeetingDraft>>;
}

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
  const [activeTab, setActiveTab] = useState<string>('meeting_prep');
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft>({
    topic: 'Ввод в эксплуатацию ЦПМ Canon imagePRESS V1000',
    participants: [
      'Смирнов А.В. (Ген. директор)',
      'Иванов И.С. (Нач. производства)',
    ],
    documents: [
      'Техкарта оборудования и требования к электропитанию',
      'План производства и загрузка цеха на Q4',
    ],
    agenda: [
      '1. Оценка готовности производственной площадки и электропитания 380В (15 мин)',
      '2. Согласование графика поставки и шеф-монтажа с инженерами «Кэнон-Ру» (20 мин)',
      '3. План переобучения операторов дневной и ночной смен (15 мин)',
    ],
    openQuestions: [
      '• Выделена ли стабильная силовая линия 380В / 32А без просадок напряжения?',
      '• Получен ли допуск инженеров поставщика на режимную территорию предприятия?',
    ],
    openTasks: [
      'Подготовить акт осмотра кабельной трассы распределительного щита цеха',
      'Запросить сертификаты соответствия на силовые разъемы Mennekes',
    ],
  });
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetric[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [calendarSlots, setCalendarSlots] = useState<CalendarSlot[]>([]);
  const [scheduledMeetings, setScheduledMeetings] = useState<MeetingItem[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: 'u-1',
    name: 'Смирнов Алексей Викторович',
    role: 'ROLE_DIRECTOR',
    roleTitle: 'Генеральный директор',
    department: 'Дирекция',
    avatarInitials: 'АС',
    clearance: 'Допуск 1 · Полный',
    description: 'Полный доступ ко всей отчетности ООО «Фотопринт»'
  });
  const [overviewBrief, setOverviewBrief] = useState<OverviewBrief | null>(null);

  // Backend connection state
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

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
          liveTranscripts,
          liveUsers,
          liveBrief,
          liveMe
        ] = await Promise.allSettled([
          apiClient.getTasks(),
          apiClient.getMetrics(),
          apiClient.getAuditLogs(),
          apiClient.getDocuments(),
          apiClient.getCalendarSlots(),
          apiClient.getMeetings(),
          apiClient.getTranscripts(),
          apiClient.getUsers(),
          apiClient.getOverviewBrief(),
          apiClient.getMe(),
        ]);

        if (liveTasks.status === 'fulfilled') {
          setTasks(liveTasks.value);
        }
        if (liveMetrics.status === 'fulfilled') {
          setKpiMetrics(liveMetrics.value);
        }
        if (liveAudit.status === 'fulfilled') {
          setAuditLogs(liveAudit.value);
        }
        if (liveDocs.status === 'fulfilled') {
          setDocuments(liveDocs.value);
        }
        if (liveSlots.status === 'fulfilled') {
          setCalendarSlots(liveSlots.value);
        }
        if (liveMeetings.status === 'fulfilled') {
          setScheduledMeetings(liveMeetings.value);
        }
        if (liveTranscripts.status === 'fulfilled') {
          setTranscripts(liveTranscripts.value);
        }
        if (liveUsers.status === 'fulfilled' && liveUsers.value.length > 0) {
          setUsers(liveUsers.value);
        }
        if (liveBrief.status === 'fulfilled') {
          setOverviewBrief(liveBrief.value);
        }
        if (liveMe.status === 'fulfilled') {
          setCurrentUser(liveMe.value);
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
    let targetUser = users.find((u) => u.role === role) || currentUser;

    if (backendOnline) {
      try {
        const liveUser = await apiClient.switchRole(role);
        if (liveUser) {
          targetUser = liveUser;
          setCurrentUser(liveUser);
        }
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
        const freshDocs = await apiClient.getDocuments();
        if (freshDocs) setDocuments(freshDocs);
      } catch {
        // fallback
      }
    } else {
      setCurrentUser(targetUser);
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
    let targetUser = users.find((u) => u.role === newRole) || currentUser;

    if (backendOnline) {
      try {
        const liveUser = await apiClient.switchRole(newRole);
        if (liveUser) {
          targetUser = liveUser;
          setCurrentUser(liveUser);
        }
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
        const freshDocs = await apiClient.getDocuments();
        if (freshDocs) setDocuments(freshDocs);
      } catch {
        // fallback
      }
    } else {
      setCurrentUser(targetUser);
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

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));

    if (backendOnline) {
      try {
        await apiClient.deleteTask(id);
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
      } catch {
        // keep local
      }
    }

    logAudit('DELETE_TASK', `Task: ${id}`, 'SUCCESS', `Задача удалена из реестра`);
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

  const scheduleMeeting = async (params: {
    title: string;
    date: string;
    time: string;
    durationMinutes?: number;
    participants: string[];
    agenda: string[];
  }) => {
    const newMeeting: MeetingItem = {
      id: `m-sched-${Date.now()}`,
      title: params.title,
      date: params.date,
      time: params.time,
      durationMinutes: params.durationMinutes || 45,
      participants: params.participants,
      agenda: params.agenda,
      status: 'scheduled',
      openQuestions: [],
    };

    setScheduledMeetings((prev) => [newMeeting, ...prev]);

    if (backendOnline) {
      try {
        const liveMeeting = await apiClient.createMeeting(params);
        setScheduledMeetings((prev) =>
          prev.map((m) => (m.id === newMeeting.id ? liveMeeting : m))
        );
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
      } catch {
        // keep local
      }
    }

    logAudit(
      'SCHEDULE_MEETING',
      `Meeting: ${params.title}`,
      'SUCCESS',
      `Пользователь подтвердил создание встречи на ${params.date} ${params.time}`
    );
    showToast('Встреча запланирована', `Событие создано на ${params.date} в ${params.time}`, 'success');
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
        // Refresh audit logs because backend logged the search or security block
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
        return res;
      } catch {
        // Fallback to local below
      }
    }

    // Local fallback if offline
    const lower = queryText.toLowerCase();
    if (
      lower.includes('бюджет') ||
      lower.includes('выручк') ||
      lower.includes('оклад') ||
      lower.includes('зарплат') ||
      lower.includes('премирован')
    ) {
      if (!canAccessDocument(1)) {
        logAudit(
          'ACCESS_DENIED',
          'Document: doc-fin-01',
          'ACCESS_DENIED',
          `Попытка запроса финансовых показателей пользователем с ролью ${currentRole}`
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

      logAudit('RAG_SEARCH', 'Document: doc-fin-01', 'SUCCESS', 'Поиск в финансовых регламентах с цитированием');
      return {
        id: 'asst-' + Date.now(),
        sender: 'assistant',
        text: 'Согласно утвержденному Бюджету доходов и расходов (БДР) на Q4 2026, плановая выручка ООО «Фотопринт» составляет 48 500 000 руб. Плановый фонд премирования производственной смены при соблюдении уровня брака ниже 2.5% составляет 3 200 000 руб.',
        timestamp: time,
        status: 'grounded',
        citations: [
          {
            documentId: 'doc-fin-01',
            documentTitle: 'Бюджет доходов и расходов на 4 квартал 2026',
            documentDate: '2026-10-01',
            category: 'Финансы и стратегия',
            excerpt:
              'Плановые показатели выручки ООО «Фотопринт» на Q4 2026 установлены на уровне 48 500 000 руб. Фонд премирования производственной смены составляет 3 200 000 руб.',
          },
        ],
      };
    }

    if (lower.includes('delta') || lower.includes('indigo') || lower.includes('калибровк')) {
      logAudit('RAG_SEARCH', 'Document: doc-prod-01', 'SUCCESS', 'Поиск технологической карты HP Indigo 7900');
      return {
        id: 'asst-' + Date.now(),
        sender: 'assistant',
        text: 'Согласно Технологической карте цифровой печати на ЦПМ HP Indigo 7900, допустимое оптическое отклонение Delta-E составляет <= 2.0. Калибровка встроенного спектрофотометра обязательна каждые 4 часа работы либо при смене рулона.',
        timestamp: time,
        status: 'grounded',
        citations: [
          {
            documentId: 'doc-prod-01',
            documentTitle: 'Технологическая карта цифровой печати на ЦПМ HP Indigo 7900',
            documentDate: '2026-08-15',
            category: 'Производство',
            excerpt:
              'Калибровка встроенного спектрофотометра выполняется каждые 4 часа непрерывной работы. Допустимое оптическое отклонение Delta-E <= 2.0. Максимальное технологическое смещение приводки сторон — 0.2 мм.',
          },
        ],
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
    try {
      await apiClient.resetDemo();
      await syncWithBackend();
      showToast('Демо сброшено', 'Данные сброшены к эталонному состоянию', 'info');
    } catch (err) {
      console.error('Reset demo failed:', err);
      showToast('Ошибка сброса', 'Не удалось связаться с сервером', 'error');
    }
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
        deleteTask,
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
        analyzeMeetingTranscript,
        calendarSlots,
        scheduledMeetings,
        scheduleMeeting,
        transcripts,
        users,
        overviewBrief,
        meetingDraft,
        setMeetingDraft,
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
