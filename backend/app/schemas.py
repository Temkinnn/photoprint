from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime

UserRole = Literal['ROLE_DIRECTOR', 'ROLE_PRODUCTION_HEAD', 'ROLE_SUPPORT_HEAD']
DecisionCategory = Literal['resolved', 'proposed', 'discussed', 'needs_clarification']
TaskStatus = Literal['pending_approval', 'active', 'completed', 'overdue']
MeetingStatus = Literal['draft', 'scheduled', 'completed']
KPIStatus = Literal['normal', 'warning', 'critical']

class UserProfile(BaseModel):
    id: str
    name: str
    role: UserRole
    roleTitle: str
    department: str
    avatarInitials: str
    clearance: Optional[str] = None
    description: Optional[str] = None

class SwitchRoleRequest(BaseModel):
    role: UserRole

class DecisionItem(BaseModel):
    id: str
    category: DecisionCategory
    text: str
    speaker: Optional[str] = None
    timestamp: Optional[str] = None

class RiskItem(BaseModel):
    id: str
    riskDescription: str
    impact: Literal['High', 'Medium', 'Low']
    suggestedMitigation: Optional[str] = None

class TaskItem(BaseModel):
    id: str
    title: str
    assigneeName: str
    deadline: str
    sourceQuote: str
    timestamp: Optional[str] = None
    status: TaskStatus = 'pending_approval'
    meetingTitle: Optional[str] = None
    protocolId: Optional[str] = None

class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    assigneeName: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[TaskStatus] = None

class DocumentItem(BaseModel):
    id: str
    title: str
    category: str
    date: str
    minClearance: int  # 1 = Director only, 2 = Production/Director, 3 = All
    content: str
    summary: str

class Citation(BaseModel):
    documentId: str
    documentTitle: str
    documentDate: str
    category: str
    excerpt: str

class RAGQueryRequest(BaseModel):
    query: str
    userRole: UserRole

class RAGResponse(BaseModel):
    id: str
    sender: Literal['assistant'] = 'assistant'
    text: str
    timestamp: str
    citations: List[Citation] = []
    status: Literal['grounded', 'needs_clarification', 'access_denied']

class CalendarSlot(BaseModel):
    id: str
    startTime: str
    endTime: str
    date: str
    isAvailable: bool
    participantsFree: List[str]

class MeetingItem(BaseModel):
    id: str
    title: str
    date: str
    time: str
    durationMinutes: int
    participants: List[str]
    status: MeetingStatus
    agenda: List[str]
    openQuestions: Optional[List[str]] = []
    protocolId: Optional[str] = None

class CreateMeetingRequest(BaseModel):
    title: str
    date: str
    time: str
    durationMinutes: int = 45
    participants: List[str]
    agenda: List[str]

class ProtocolAnalysisRequest(BaseModel):
    transcriptText: str
    meetingTitle: str
    participants: List[str] = []

class ProtocolAnalysisResponse(BaseModel):
    meetingTitle: str
    summary: str
    decisions: List[DecisionItem]
    risks: List[RiskItem]
    tasks: List[TaskItem]
    transcriptId: Optional[str] = None
    questions: Optional[List[str]] = []
    duration: Optional[str] = None

class ConfirmTasksRequest(BaseModel):
    tasks: List[TaskItem]
    meetingTitle: Optional[str] = None
    protocolId: Optional[str] = None

class KPIMetric(BaseModel):
    id: str
    name: str
    value: str
    target: str
    status: KPIStatus
    sourceSystem: str
    updatedAt: str
    trend: Literal['up', 'down', 'stable']

class AuditLogEntry(BaseModel):
    id: str
    timestamp: str
    userId: str
    userName: str
    userRole: UserRole
    action: str
    targetObject: str
    status: Literal['success', 'warning', 'blocked']
    details: str

class TranscriptItem(BaseModel):
    id: str
    title: str
    date: str
    type: str
    content: str
    stagedTasks: List[TaskItem] = []
    summary: str
    decisions: List[DecisionItem] = []
    risks: List[RiskItem] = []

class AgendaGenerationRequest(BaseModel):
    topic: str
    participants: List[str] = []
    documents: List[str] = []

class AgendaGenerationResponse(BaseModel):
    agenda: List[str]
    openQuestions: List[str]

class CriticalIssueItem(BaseModel):
    id: str
    title: str
    description: str
    deadline: str

class OverviewBriefResponse(BaseModel):
    situationBrief: str
    dataFreshness: str
    criticalIssues: List[CriticalIssueItem] = []
