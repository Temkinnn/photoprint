import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, UserProfile, TaskItem, AuditLogEntry, KPIMetric, DocumentItem } from '../types';
import { MOCK_USERS, MOCK_DOCUMENTS, MOCK_KPI_METRICS, INITIAL_TASKS, INITIAL_AUDIT_LOG } from '../mock/mockData';

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
  loginAs: (role: UserRole) => void;
  logout: () => void;
  currentRole: UserRole;
  currentUser: UserProfile;
  setRole: (role: UserRole) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tasks: TaskItem[];
  addTask: (task: Omit<TaskItem, 'id'>) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  toggleTaskStatus: (id: string) => void;
  batchApproveTasks: (newTasks: Omit<TaskItem, 'id'>[], meetingTitle: string) => void;
  auditLogs: AuditLogEntry[];
  logAudit: (actionType: string, targetEntity: string, status: 'SUCCESS' | 'REJECTED' | 'ACCESS_DENIED' | 'PENDING', details: string) => void;
  toasts: Toast[];
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  resetDemoData: () => void;
  kpiMetrics: KPIMetric[];
  documents: DocumentItem[];
  canAccessDocument: (minClearance: number) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Theme state with local persistence
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('photoprint_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark'; // default to calm dark
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
  const [kpiMetrics] = useState<KPIMetric[]>(MOCK_KPI_METRICS);
  const [documents] = useState<DocumentItem[]>(MOCK_DOCUMENTS);

  const currentUser = MOCK_USERS[currentRole];

  const showToast = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const logAudit = (
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
  };

  const loginAs = (role: UserRole) => {
    setCurrentRole(role);
    setIsAuthenticated(true);
    const targetUser = MOCK_USERS[role];
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

  const setRole = (newRole: UserRole) => {
    setCurrentRole(newRole);
    const targetUser = MOCK_USERS[newRole];
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

  const addTask = (taskData: Omit<TaskItem, 'id'>) => {
    const id = 'task-' + Date.now().toString();
    const newTask: TaskItem = { ...taskData, id };
    setTasks((prev) => [newTask, ...prev]);
    logAudit('CREATE_TASK', `Task: ${newTask.title}`, 'SUCCESS', `Создана задача: ${newTask.title}`);
  };

  const updateTask = (id: string, updates: Partial<TaskItem>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    logAudit('UPDATE_TASK', `Task: ${id}`, 'SUCCESS', `Изменены параметры задачи`);
  };

  const toggleTaskStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'completed' ? 'active' : 'completed';
          logAudit(
            'CHANGE_TASK_STATUS',
            `Task: ${id}`,
            'SUCCESS',
            `Статус задачи изменен на "${nextStatus === 'completed' ? 'Завершена' : 'В работе'}"`
          );
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const batchApproveTasks = (newTasks: Omit<TaskItem, 'id'>[], meetingTitle: string) => {
    const created: TaskItem[] = newTasks.map((t, idx) => ({
      ...t,
      id: `task-appr-${Date.now()}-${idx}`,
      status: 'active',
      meetingTitle,
    }));
    setTasks((prev) => [...created, ...prev]);
    logAudit(
      'APPROVE_TASKS_BATCH',
      `Meeting: ${meetingTitle}`,
      'SUCCESS',
      `Утверждено ${created.length} поручений по итогам совещания`
    );
    showToast(
      'Поручения утверждены',
      `В реестр успешно добавлено ${created.length} поручений`,
      'success'
    );
  };

  const resetDemoData = () => {
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
