export type UserRole = 'ROLE_DIRECTOR' | 'ROLE_PRODUCTION_HEAD' | 'ROLE_SUPPORT_HEAD';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  roleTitle: string;
  department: string;
  avatarInitials: string;
  clearance?: string;
  description?: string;
}

export type DecisionCategory = 'resolved' | 'proposed' | 'discussed' | 'needs_clarification';

export interface DecisionItem {
  id: string;
  category: DecisionCategory;
  text: string;
  speaker?: string;
  timestamp?: string;
}

export interface RiskItem {
  id: string;
  riskDescription: string;
  impact: 'High' | 'Medium' | 'Low';
  suggestedMitigation?: string;
}

export type TaskStatus = 'pending_approval' | 'active' | 'completed' | 'overdue';

export interface TaskItem {
  id: string;
  title: string;
  assigneeName: string;
  deadline: string;
  sourceQuote: string;
  timestamp?: string;
  status: TaskStatus;
  meetingTitle?: string;
  protocolId?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  category: string;
  date: string;
  minClearance: number; // 1 = Director only, 2 = Production/Director, 3 = All
  content: string;
  summary: string;
}

export interface Citation {
  documentId: string;
  documentTitle: string;
  documentDate: string;
  category: string;
  excerpt: string;
}

export interface RAGMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: Citation[];
  status?: 'grounded' | 'needs_clarification' | 'access_denied';
}

export interface CalendarSlot {
  id: string;
  startTime: string;
  endTime: string;
  date: string;
  isAvailable: boolean;
  participantsFree: string[];
}

export interface MeetingItem {
  id: string;
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  participants: string[];
  status: 'draft' | 'scheduled' | 'completed';
  agenda: string[];
  openQuestions?: string[];
  protocolId?: string;
}

export interface KPIMetric {
  id: string;
  name: string;
  value: string;
  target: string;
  status: 'normal' | 'warning' | 'critical';
  sourceSystem: string;
  updatedAt: string;
  trend: 'up' | 'down' | 'stable';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  actionType: string;
  targetEntity: string;
  status: 'SUCCESS' | 'REJECTED' | 'ACCESS_DENIED' | 'PENDING';
  details: string;
}

export interface TranscriptItem {
  id: string;
  title: string;
  date: string;
  type: string;
  content: string;
  stagedTasks: TaskItem[];
  summary: string;
  decisions: DecisionItem[];
  risks: RiskItem[];
}

export interface CriticalIssueItem {
  id: string;
  title: string;
  description: string;
  deadline: string;
}

export interface OverviewBrief {
  situationBrief: string;
  dataFreshness: string;
  criticalIssues: CriticalIssueItem[];
}
