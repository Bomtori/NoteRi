from sqlalchemy import (
    Column, Integer, String, Date, Text, Boolean,
    ForeignKey, Enum, Float, JSON, TIMESTAMP
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()


# ENUM types
class PlanType(enum.Enum):
    free = "free"
    pro = "pro"
    enterprise = "enterprise"


class RecordingType(enum.Enum):
    recording = "recording"
    stopped = "stopped"
    saved = "saved"


# Users
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    nickname = Column(String(100), nullable=True)  # ✅ 새 필드
    picture = Column(String(500), nullable=True)
    oauth_provider = Column(String)
    oauth_sub = Column(String)
    role = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)

    subscriptions = relationship("Subscription", back_populates="user")
    boards = relationship("Board", back_populates="owner")
    memos = relationship("Memo", back_populates="user")
    folders = relationship("Folder", back_populates="owner")
    notifications = relationship("Notification", back_populates="user")
    recording_usage = relationship("RecordingUsage", back_populates="user")

# Subscriptions
class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan = Column(Enum(PlanType), nullable=False, default=PlanType.free)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    payment_info = Column(JSON)
    created_at = Column(TIMESTAMP)

    recording_usage = relationship("RecordingUsage", back_populates="subscription")
    user = relationship("User", back_populates="subscriptions")

# 구독 기간 중 녹음 시간
class RecordingUsage(Base):
    __tablename__ = "recording_usage"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    allocated_minutes = Column(Integer)
    used_minutes = Column(Integer, default=0)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=True)
    created_at = Column(TIMESTAMP)

    user = relationship("User", back_populates="recording_usage")
    subscription = relationship("Subscription", back_populates="recording_usage")

# Folders
class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True)
    parent_id = Column(Integer, ForeignKey("folders.id"))
    name = Column(String, nullable=False)
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))

    owner = relationship("User", back_populates="folders")
    boards = relationship("Board", back_populates="folder")
    children = relationship("Folder", backref="parent", remote_side="Folder.id")


# Boards
class Board(Base):
    __tablename__ = "boards"

    id = Column(Integer, primary_key=True)
    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    invite_token = Column(String, nullable=True)
    invite_role = Column(String, default="editor")
    invite_expires_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)

    owner = relationship("User", back_populates="boards")
    folder = relationship("Folder", back_populates="boards")

    # ✅ Board 직속 소유 데이터들
    audios = relationship("AudioData", back_populates="board", cascade="all, delete-orphan")
    memos = relationship("Memo", back_populates="board", cascade="all, delete-orphan")
    transcripts = relationship("Transcript", back_populates="board", cascade="all, delete-orphan")
    summaries = relationship("Summary", back_populates="board", cascade="all, delete-orphan")

    # 기존 recording_sessions 유지
    recording_sessions = relationship("RecordingSession", back_populates="board")


# Audio Data
class AudioData(Base):
    __tablename__ = "audio_data"

    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String, nullable=False)
    duration = Column(Integer)
    language = Column(String)
    created_at = Column(TIMESTAMP)

    board = relationship("Board", back_populates="audios")


# Recording Sessions
class RecordingSession(Base):
    __tablename__ = "recording_sessions"

    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(RecordingType), nullable=False)
    started_at = Column(TIMESTAMP, nullable=False)
    ended_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP)

    board = relationship("Board", back_populates="recording_sessions")
    results = relationship("RecordingResult", back_populates="session")


# Recording Results
class RecordingResult(Base):
    __tablename__ = "recording_results"

    id = Column(Integer, primary_key=True)
    recording_session_id = Column(Integer, ForeignKey("recording_sessions.id", ondelete="CASCADE"), nullable=False)
    speaker_label = Column(String)
    raw_text = Column(Text, nullable=False)
    started_at = Column(TIMESTAMP)
    ended_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP)

    session = relationship("RecordingSession", back_populates="results")
    transcripts = relationship("Transcript", back_populates="result")


# Transcripts
class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True)
    result_id = Column(Integer, ForeignKey("recording_results.id", ondelete="CASCADE"), nullable=False)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)  # ✅ 새 연결
    speaker_label = Column(String)
    start_time = Column(Float)
    end_time = Column(Float)
    text = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP)

    result = relationship("RecordingResult", back_populates="transcripts")
    board = relationship("Board", back_populates="transcripts")  # ✅ 추가
    summaries = relationship("Summary", back_populates="transcript")


# Memos
class Memo(Base):
    __tablename__ = "memos"

    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP)

    board = relationship("Board", back_populates="memos")
    user = relationship("User", back_populates="memos")


# Summaries
class Summary(Base):
    __tablename__ = "summaries"

    id = Column(Integer, primary_key=True)
    transcript_id = Column(Integer, ForeignKey("transcripts.id", ondelete="CASCADE"), nullable=False)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)  # ✅ 새 연결
    summary_type = Column(String)
    content = Column(Text, nullable=False)
    rating = Column(Boolean)
    created_at = Column(TIMESTAMP)

    transcript = relationship("Transcript", back_populates="summaries")
    board = relationship("Board", back_populates="summaries")  # ✅ 추가


# Notifications
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP)

    user = relationship("User", back_populates="notifications")

class NotionAuth(Base):
    __tablename__ = "notion_auth"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)
    bot_id = Column(String)
    workspace_id = Column(String)
    workspace_name = Column(String)
    owner_json = Column(JSON)  # 필요하면 전체 owner 객체 저장
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())