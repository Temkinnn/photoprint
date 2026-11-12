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
    version: int = 1

class DocumentVersionItem(BaseModel):
    id: str
    documentId: str
    versionNumber: int
    title: str
    category: str
    date: str
    minClearance: int
    summary: str
    content: str
    changeNote: str
    changedBy: str
    createdAt: str

class DocumentDiffLine(BaseModel):
    kind: Literal['unchanged', 'removed', 'added']
    text: str

class DocumentDraftRequest(BaseModel):
    documentId: Optional[str] = None
    instruction: str
    title: Optional[str] = None
    category: Optional[str] = None
    minClearance: Optional[int] = None

class DocumentDraftResponse(BaseModel):
    mode: Literal['create', 'edit']
    documentId: Optional[str] = None
    originalTitle: str = ""
    originalSummary: str = ""
    originalContent: str = ""
    proposedTitle: str
    proposedCategory: str
    proposedMinClearance: int
    proposedSummary: str
    proposedContent: str
    changeNote: str
    diffLines: List[DocumentDiffLine] = []
    modelUsed: str

class DocumentDiffPreviewRequest(BaseModel):
    originalContent: str
    proposedContent: str

class DocumentCommitRequest(BaseModel):
    mode: Literal['create', 'edit']
    documentId: Optional[str] = None
    title: str
    category: str
    minClearance: int = 3
    summary: str
    content: str
    changeNote: str = ""

class DocumentRollbackRequest(BaseModel):
    versionId: str

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

class ParticipantOption(BaseModel):
    id: str
    name: str
    shortName: str
    roleTitle: str
    department: str
    role: Optional[UserRole] = None
    isSystemUser: bool = True

class OpenTaskSummary(BaseModel):
    id: str
    title: str
    assigneeName: str
    deadline: str
    status: TaskStatus
    meetingTitle: Optional[str] = None

class PrepareAgendaRequest(BaseModel):
    topic: str
    participants: List[str] = []
    selectedDocIds: List[str] = []
    userRole: Optional[UserRole] = None

class PrepareAgendaResponse(BaseModel):
    agenda: List[str]
    openTasks: List[OpenTaskSummary]
    openQuestions: List[str]
    usedDocuments: List[str]
    blockedDocuments: List[str] = []
    modelUsed: str

class CreateMeetingRequest(BaseModel):
    title: str
    date: str
    time: str
    durationMinutes: int = 45
    participants: List[str]
    agenda: List[str]
    openQuestions: List[str] = []
    slotId: Optional[str] = None
    invitationText: Optional[str] = None

class MeetingInvitationItem(BaseModel):
    id: str
    meetingId: str
    meetingTitle: str
    date: str
    time: str
    organizerName: str
    recipientId: str
    recipientName: str
    recipientRole: Optional[UserRole] = None
    agenda: List[str] = []
    messageText: str
    status: Literal['pending', 'accepted', 'declined']
    createdAt: str

class RespondInvitationRequest(BaseModel):
    status: Literal['accepted', 'declined']

class ProtocolAnalysisRequest(BaseModel):
    transcriptText: str
    meetingTitle: str
    participants: List[str] = []
    meetingId: Optional[str] = None

class ProtocolAnalysisResponse(BaseModel):
    meetingTitle: str
    summary: str
    decisions: List[DecisionItem]
    risks: List[RiskItem]
    tasks: List[TaskItem]
    transcriptText: Optional[str] = None
    openQuestions: List[str] = []
    processingTimeSec: Optional[float] = None
    modelUsed: Optional[str] = None

class SaveProtocolRequest(BaseModel):
    meetingId: Optional[str] = None
    meetingTitle: str
    transcriptRef: str
    transcriptText: str
    summary: str
    decisions: List[DecisionItem] = []
    risks: List[RiskItem] = []
    openQuestions: List[str] = []
    processingTimeSec: Optional[float] = None

class ProtocolItem(BaseModel):
    id: str
    meetingId: Optional[str] = None
    meetingTitle: str
    transcriptRef: str
    transcriptText: str
    summary: str
    decisions: List[DecisionItem] = []
    risks: List[RiskItem] = []
    openQuestions: List[str] = []
    processingTimeSec: Optional[float] = None
    createdAt: str
    createdBy: str

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
