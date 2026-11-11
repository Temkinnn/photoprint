import {
  UserProfile,
  UserRole,
  MeetingItem,
  CalendarSlot,
  TaskItem,
  DocumentItem,
  KPIMetric,
  AuditLogEntry,
  RAGMessage,
  DecisionItem,
  RiskItem,
  TranscriptItem,
  OverviewBrief,
} from '../types';

export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

interface BackendAuditEntry {
  id: string;
  timestamp: string;
  userId?: string;
  userName: string;
  userRole: UserRole;
  action?: string;
  actionType?: string;
  targetObject?: string;
  targetEntity?: string;
  status: string;
  details: string;
}

export interface ProtocolAnalysisResult {
  meetingTitle: string;
  summary: string;
  decisions: DecisionItem[];
  risks: RiskItem[];
  tasks: TaskItem[];
  transcriptId?: string;
  questions?: string[];
  duration?: string;
}

export interface BackendHealth {
  online: boolean;
  service?: string;
  version?: string;
  database?: string;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export const apiClient = {
  // 0. Health check
  async checkHealth(): Promise<BackendHealth> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/`, { method: 'GET' }, 2000);
      if (!res.ok) return { online: false };
      const data = await res.json();
      return {
        online: true,
        service: data.service,
        version: data.version,
        database: data.database,
      };
    } catch {
      return { online: false };
    }
  },

  // 1. Auth & Roles
  async getUsers(): Promise<UserProfile[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/users`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getMe(): Promise<UserProfile> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/me`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async switchRole(role: UserRole): Promise<UserProfile> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/switch-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // 2. Meetings & Calendar
  async getMeetings(): Promise<MeetingItem[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getTranscripts(): Promise<TranscriptItem[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/transcripts`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getTranscript(id: string): Promise<TranscriptItem> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/transcripts/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async generateAgenda(params: {
    topic: string;
    participants: string[];
    documents: string[];
  }): Promise<{ agenda: string[]; openQuestions: string[] }> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/generate-agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getCalendarSlots(date?: string): Promise<CalendarSlot[]> {
    const url = date
      ? `${API_BASE_URL}/api/v1/meetings/calendar/slots?date=${encodeURIComponent(date)}`
      : `${API_BASE_URL}/api/v1/meetings/calendar/slots`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async deleteMeeting(meetingId: string): Promise<void> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/${meetingId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },

  async createMeeting(params: {
    title: string;
    date: string;
    time: string;
    durationMinutes?: number;
    participants: string[];
    agenda: string[];
  }): Promise<MeetingItem> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        durationMinutes: params.durationMinutes || 45,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async analyzeTranscript(params: {
    meetingTitle: string;
    transcriptText: string;
    participants?: string[];
  }): Promise<ProtocolAnalysisResult> {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/meetings/analyze-transcript`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      30000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async processAudioMeeting(file: File, title = 'Оперативное совещание'): Promise<ProtocolAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    const res = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/meetings/process-audio`,
      {
        method: 'POST',
        body: formData,
      },
      95000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async confirmTasks(tasks: TaskItem[], meetingTitle?: string): Promise<TaskItem[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/confirm-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks, meetingTitle }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // 3. Tasks Registry
  async getTasks(): Promise<TaskItem[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/tasks/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async createTask(task: Omit<TaskItem, 'id'>): Promise<TaskItem> {
    const item: TaskItem = {
      ...task,
      id: `task-manual-${Date.now()}`,
    };
    const confirmed = await this.confirmTasks([item], task.meetingTitle || 'Ручное поручение');
    return confirmed[0] || item;
  },

  async updateTask(id: string, updates: Partial<TaskItem>): Promise<TaskItem> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async deleteTask(id: string): Promise<void> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/tasks/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },

  // 4. RAG & Knowledge Base
  async getDocuments(): Promise<DocumentItem[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/rag/documents`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async queryKnowledgeBase(query: string, userRole: UserRole): Promise<RAGMessage> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, userRole }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      id: data.id || `rag-${Date.now()}`,
      sender: 'assistant',
      text: data.text,
      timestamp: data.timestamp,
      citations: data.citations || [],
      status: data.status,
    };
  },

  // 5. Overview & Audit
  async getMetrics(): Promise<KPIMetric[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/overview/metrics`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getOverviewBrief(): Promise<OverviewBrief> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/overview/brief`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/overview/audit`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawList: BackendAuditEntry[] = await res.json();

    return rawList.map((entry) => {
      let mappedStatus: 'SUCCESS' | 'REJECTED' | 'ACCESS_DENIED' | 'PENDING' = 'SUCCESS';
      const s = (entry.status || '').toLowerCase();
      if (s === 'blocked' || s === 'access_denied') mappedStatus = 'ACCESS_DENIED';
      else if (s === 'warning' || s === 'rejected') mappedStatus = 'REJECTED';
      else if (s === 'pending') mappedStatus = 'PENDING';
      else mappedStatus = 'SUCCESS';

      return {
        id: entry.id,
        timestamp: entry.timestamp,
        userName: entry.userName,
        userRole: entry.userRole,
        actionType: entry.action || entry.actionType || 'UNKNOWN_ACTION',
        targetEntity: entry.targetObject || entry.targetEntity || '-',
        status: mappedStatus,
        details: entry.details,
      };
    });
  },

  // 6. System
  async resetDemo(): Promise<void> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/system/reset-demo`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },
};
