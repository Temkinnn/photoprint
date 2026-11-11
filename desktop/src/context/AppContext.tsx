import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserRole, UserProfile, TaskItem, AuditLogEntry, KPIMetric, DocumentItem } from '../types';
import { MOCK_USERS, MOCK_DOCUMENTS, MOCK_KPI_METRICS, INITIAL_TASKS, INITIAL_AUDIT_LOG } from '../mock/mockData';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

interface AppContextType {
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

  const setRole = (newRole: UserRole) => {
    setCurrentRole(newRole);
    const targetUser = MOCK_USERS[newRole];
    logAudit(
      'SWITCH_ROLE',
      `User: ${targetUser.id}`,
      'SUCCESS',
      `Переключение активной роли на: ${targetUser.roleTitle} (${targetUser.department})`
    );
    showToast(
      'Роль изменена',
      `Вы переключились на роль: ${targetUser.roleTitle}`,
      'info'
    );
  };

  const canAccessDocument = (minClearance: number): boolean => {
    if (currentRole === 'ROLE_DIRECTOR') return true; // full access
    if (currentRole === 'ROLE_PRODUCTION_HEAD' && minClearance >= 2) return true; // prod & support docs
    if (currentRole === 'ROLE_SUPPORT_HEAD' && minClearance >= 3) return true; // support docs only
    return false;
  };

  const addTask = (taskData: Omit<TaskItem, 'id'>) => {
    const id = 'task-' + Date.now().toString();
    const newTask: TaskItem = { ...taskData, id };
    setTasks((prev) => [newTask, ...prev]);
    logAudit('CREATE_TASK', `Task: ${newTask.title}`, 'SUCCESS', `Создана задача: ${newTask.title} (Ответственный: ${newTask.assigneeName})`);
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
      `Утверждено и внесено в реестр ${created.length} поручений по итогам совещания`
    );
    showToast(
      'Поручения зафиксированы',
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
      'System: State',
      'SUCCESS',
      'Система сброшена к эталонному синтетическому состоянию (20 документов, 3 расшифровки)'
    );
    showToast(
      'Данные сброшены',
      'Все задачи, логи и состояние возвращены к исходному демо-сценарию',
      'warning'
    );
  };

  return (
    <AppContext.Provider
      value={{
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
