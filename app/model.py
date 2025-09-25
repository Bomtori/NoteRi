from sqlalchemy import (
    Column, Integer, String, Date, Text, Boolean,
    ForeignKey, Enum, Float, JSON, TIMESTAMP
)
from sqlalchemy.orm import relationship, declarative_base
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
    notifications = relationship("Notification", back_populates="user")


# Subscriptions
class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan = Column(Enum(PlanType), nullable=False, default=PlanType.free)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True)
    payment_info = Column(JSON)
    created_at = Column(TIMESTAMP)

    user = relationship("User", back_populates="subscriptions")


# Folders
class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True)
    parent_id = Column(Integer, ForeignKey("folders.id"))
    name = Column(String, nullable=False)
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)

    children = relationship("Folder")


# Boards
class Board(Base):
    __tablename__ = "boards"

    id = Column(Integer, primary_key=True)
    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    invite_token = Column(String)
    invite_role = Column(String, default="editor")
    invite_expires_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)

    owner = relationship("User", back_populates="boards")
    audios = relationship("AudioData", back_populates="board")
    memos = relationship("Memo", back_populates="board")
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
    speaker_label = Column(String)
    start_time = Column(Float)
    end_time = Column(Float)
    text = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP)

    result = relationship("RecordingResult", back_populates="transcripts")
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
    summary_type = Column(String)
    content = Column(Text, nullable=False)
    rating = Column(Boolean)  # 좋아요/싫어요
    created_at = Column(TIMESTAMP)

    transcript = relationship("Transcript", back_populates="summaries")


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
