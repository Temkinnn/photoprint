from sqlalchemy import Column, String, Integer, Text, Boolean, DateTime, JSON
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class DBAppState(Base):
    __tablename__ = "app_state"

    key = Column(String(64), primary_key=True)
    value = Column(String(255), nullable=False)


class DBUser(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    role = Column(String(64), nullable=False)  # ROLE_DIRECTOR, ROLE_PRODUCTION_HEAD, ROLE_SUPPORT_HEAD
    role_title = Column(String(255), nullable=False)
    department = Column(String(255), nullable=False)
    avatar_initials = Column(String(10), nullable=False)

class DBDocument(Base):
    __tablename__ = "documents"

    id = Column(String(64), primary_key=True)
    title = Column(String(512), nullable=False)
    category = Column(String(255), nullable=False)
    date = Column(String(32), nullable=False)
    min_clearance = Column(Integer, default=3)  # 1 = Director, 2 = Prod, 3 = All
    summary = Column(Text, nullable=False)
    content = Column(Text, nullable=False)

class DBMeeting(Base):
    __tablename__ = "meetings"

    id = Column(String(64), primary_key=True)
    title = Column(String(512), nullable=False)
    date = Column(String(32), nullable=False)
    time = Column(String(32), nullable=False)
    duration_minutes = Column(Integer, default=45)
    participants = Column(JSON, default=list)
    status = Column(String(32), default="scheduled")
    agenda = Column(JSON, default=list)
    open_questions = Column(JSON, default=list)
    protocol_id = Column(String(64), nullable=True)

class DBTask(Base):
    __tablename__ = "tasks"

    id = Column(String(64), primary_key=True)
    title = Column(String(512), nullable=False)
    assignee_name = Column(String(255), nullable=False)
    deadline = Column(String(64), nullable=False)
    source_quote = Column(Text, nullable=False)
    timestamp = Column(String(32), nullable=True)
    status = Column(String(32), default="active")  # pending_approval, active, completed, overdue
    meeting_title = Column(String(512), nullable=True)
    protocol_id = Column(String(64), nullable=True)

class DBCalendarSlot(Base):
    __tablename__ = "calendar_slots"

    id = Column(String(64), primary_key=True)
    start_time = Column(String(32), nullable=False)
    end_time = Column(String(32), nullable=False)
    date = Column(String(32), nullable=False)
    is_available = Column(Boolean, default=True)
    participants_free = Column(JSON, default=list)


class DBMeetingInvitation(Base):
    __tablename__ = "meeting_invitations"

    id = Column(String(64), primary_key=True)
    meeting_id = Column(String(64), nullable=False)
    meeting_title = Column(String(512), nullable=False)
    date = Column(String(32), nullable=False)
    time = Column(String(32), nullable=False)
    organizer_name = Column(String(255), nullable=False)
    recipient_id = Column(String(64), nullable=False)
    recipient_name = Column(String(255), nullable=False)
    recipient_role = Column(String(64), nullable=True)
    agenda = Column(JSON, default=list)
    message_text = Column(Text, nullable=False)
    status = Column(String(32), default="pending")  # pending, accepted, declined
    created_at = Column(String(64), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

class DBAuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True)
    timestamp = Column(String(64), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(255), nullable=False)
    user_role = Column(String(64), nullable=False)
    action = Column(String(128), nullable=False)
    target_object = Column(String(512), nullable=False)
    status = Column(String(32), nullable=False)  # success, warning, blocked
    details = Column(Text, nullable=False)

class DBKPIMetric(Base):
    __tablename__ = "kpi_metrics"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    value = Column(String(64), nullable=False)
    target = Column(String(64), nullable=False)
    status = Column(String(32), default="normal")  # normal, warning, critical
    source_system = Column(String(128), nullable=False)
    updated_at = Column(String(64), nullable=False)
    trend = Column(String(32), default="stable")  # up, down, stable
