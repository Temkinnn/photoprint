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
  analyzeMeetingTranscript: (text: string, title: string) => Promise<ProtocolAnalysisResult | null>;
  calendarSlots: CalendarSlot[];
  scheduledMeetings: MeetingItem[];
  scheduleMeeting: (params: {
    title: string;
    date: string;
    time: string;
    durationMinutes?: number;
    participants: string[];
    agenda: string[];
  }) => Promise<void>;
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
  const [activeTab, setActiveTab] = useState<string>('meetings');
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOG);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetric[]>(MOCK_KPI_METRICS);
  const [documents, setDocuments] = useState<DocumentItem[]>(MOCK_DOCUMENTS);
  const [calendarSlots, setCalendarSlots] = useState<CalendarSlot[]>(MOCK_CALENDAR_SLOTS);
  const [scheduledMeetings, setScheduledMeetings] = useState<MeetingItem[]>([]);

  // Backend connection state
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const currentUser = MOCK_USERS[currentRole];

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
        const [liveTasks, liveMetrics, liveAudit, liveDocs, liveSlots, liveMeetings] = await Promise.allSettled([
          apiClient.getTasks(),
          apiClient.getMetrics(),
          apiClient.getAuditLogs(),
          apiClient.getDocuments(),
          apiClient.getCalendarSlots(),
          apiClient.getMeetings(),
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
        if (liveDocs.status === 'fulfilled' && liveDocs.value.length > 0) {
          setDocuments(liveDocs.value);
        }
        if (liveSlots.status === 'fulfilled' && liveSlots.value.length > 0) {
          setCalendarSlots(liveSlots.value);
        }
        if (liveMeetings.status === 'fulfilled') {
          setScheduledMeetings(liveMeetings.value);
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

    if (backendOnline) {
      try {
        await apiClient.switchRole(role);
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
      } catch {
        // fallback
      }
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

    if (backendOnline) {
      try {
        await apiClient.switchRole(newRole);
        const freshLogs = await apiClient.getAuditLogs();
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
      } catch {
        // fallback
      }
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
        await syncWithBackend();
        showToast('Демо сброшено', 'База данных и аудит на бэкенде сброшены к эталону', 'info');
        return;
      } catch {
        // fallback to local
      }
    }

    setTasks(INITIAL_TASKS);
    setAuditLogs(INITIAL_AUDIT_LOG);
    setCurrentRole('ROLE_DIRECTOR');
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
        analyzeMeetingTranscript,
        calendarSlots,
        scheduledMeetings,
        scheduleMeeting,
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
