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
  ParticipantOption,
  PrepareAgendaResponse,
  MeetingInvitationItem,
  AIStatusInfo,
  ProtocolAnalysisResult,
  ProtocolItem,
} from '../types';

export type { ProtocolAnalysisResult };

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

export interface BackendHealth {
  online: boolean;
  service?: string;
  version?: string;
  database?: string;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
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

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string') return data.detail;
  } catch {
    // ignore JSON parse failure
  }
  return `HTTP ${res.status}`;
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
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async getUsers(): Promise<ParticipantOption[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/users`);
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  // 2. Meetings & Calendar
  async getMeetings(): Promise<MeetingItem[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/`);
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async getCalendarSlots(): Promise<CalendarSlot[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/calendar/slots`);
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async prepareAgenda(params: {
    topic: string;
    participants: string[];
    selectedDocIds: string[];
    userRole: UserRole;
  }): Promise<PrepareAgendaResponse> {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/meetings/prepare-agenda`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      90000
    );
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async createMeeting(params: {
    title: string;
    date: string;
    time: string;
    durationMinutes?: number;
    participants: string[];
    agenda: string[];
    openQuestions?: string[];
    slotId?: string;
    invitationText?: string;
  }): Promise<MeetingItem> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        durationMinutes: params.durationMinutes || 45,
      }),
    });
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async getInvitations(): Promise<MeetingInvitationItem[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/invitations`);
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async respondInvitation(invId: string, status: 'accepted' | 'declined'): Promise<MeetingInvitationItem> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/invitations/${invId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async analyzeTranscript(params: {
    meetingTitle: string;
    transcriptText: string;
    participants?: string[];
    meetingId?: string;
  }): Promise<ProtocolAnalysisResult> {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/meetings/analyze-transcript`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      120000
    );
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async processAudio(file: File, meetingTitle: string, meetingId?: string): Promise<ProtocolAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('meetingTitle', meetingTitle);
    if (meetingId) formData.append('meetingId', meetingId);

    const res = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/meetings/process-audio`,
      {
        method: 'POST',
        body: formData,
      },
      180000
    );
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async uploadTranscriptFile(file: File, meetingTitle: string, meetingId?: string): Promise<ProtocolAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('meetingTitle', meetingTitle);
    if (meetingId) formData.append('meetingId', meetingId);

    const res = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/meetings/upload-transcript`,
      {
        method: 'POST',
        body: formData,
      },
      120000
    );
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async getProtocols(): Promise<ProtocolItem[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/protocols`);
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async saveProtocol(params: {
    meetingId?: string;
    meetingTitle: string;
    transcriptRef: string;
    transcriptText: string;
    summary: string;
    decisions: DecisionItem[];
    risks: RiskItem[];
    openQuestions?: string[];
    processingTimeSec?: number | null;
  }): Promise<ProtocolItem> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/save-protocol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },

  async confirmTasks(tasks: TaskItem[], meetingTitle?: string, protocolId?: string): Promise<TaskItem[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meetings/confirm-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks, meetingTitle, protocolId }),
    });
    if (!res.ok) throw new Error(await parseErrorDetail(res));
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
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/rag/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, userRole }),
      },
      75000
    );
    if (!res.ok) throw new Error(await parseErrorDetail(res));
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
    if (!res.ok) throw new Error(await parseErrorDetail(res));
  },

  async getAiStatus(): Promise<AIStatusInfo> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/system/ai-status`, {}, 7000);
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
  },
};
