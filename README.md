# NoteRi - AI 기반 실시간 회의록 관리 시스템

> 실시간 음성 인식, AI 요약, 스마트 검색 기능을 갖춘 회의록 관리 플랫폼

## 📋 프로젝트 개요

NoteRi는 회의를 실시간으로 녹음하고 AI가 자동으로 텍스트 변환 및 요약을 생성하는 웹 기반 회의록 관리 시스템입니다. 사용자는 폴더별로 회의록을 정리하고, 과거 회의 내용을 검색하며, 일정 관리까지 한 곳에서 할 수 있습니다.

### 주요 기능

- 🎙️ **실시간 STT (Speech-to-Text)**: Whisper 모델 기반 음성 → 텍스트 변환
- 🤖 **AI 자동 요약**: 1분 단위 구간 요약 및 회의 종료 후 전체 요약 생성
- 🔍 **RAG 기반 검색**: 임베딩을 활용한 의미 기반 회의록 검색
- 📁 **폴더/보드 관리**: 계층형 폴더 구조로 회의록 체계적 관리
- 👥 **화자 분리**: Pyannote 기반 화자 구분 (Diarization)
- 📅 **일정 관리**: 캘린더 통합 및 회의 일정 알림
- 🔐 **공유 기능**: 회의록 초대 링크 생성 및 권한 관리

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐
│   Frontend      │  React + Redux + Tailwind CSS
│   (Port 5173)   │  WebSocket 연결로 실시간 STT 수신
└────────┬────────┘
         │
         │ HTTP/WS
         ↓
┌─────────────────────────────────────────────┐
│         Backend (FastAPI)                   │
│         (Port 8000)                         │
│                                             │
│  ┌──────────────┐      ┌─────────────┐    │
│  │  REST API    │      │  WebSocket  │    │
│  │  Routers     │      │  /ws/stt    │    │
│  └──────────────┘      └─────────────┘    │
│         │                     │            │
│         ↓                     ↓            │
│  ┌──────────────────────────────────┐     │
│  │      STT Pipeline                │     │
│  │  (VAD + Whisper + Segmentation)  │     │
│  └──────────────────────────────────┘     │
│         │                                  │
│         ↓                                  │
│  ┌──────────────┐      ┌─────────────┐   │
│  │   Redis      │      │ PostgreSQL  │   │
│  │ (실시간 버퍼) │      │ (영구 저장) │   │
│  └──────────────┘      └─────────────┘   │
└─────────────────────────────────────────────┘
         │
         ↓
┌─────────────────┐
│   AI Services   │
│                 │
│  • Whisper STT  │
│  • Ollama 요약  │
│  • Gemini API   │
│  • Embedding    │
└─────────────────┘
```

---

## 📂 프로젝트 구조

```
.
├── backend/              # FastAPI 백엔드
│   ├── app/
│   │   ├── routers/      # API 엔드포인트
│   │   ├── crud/         # 데이터베이스 CRUD 작업
│   │   ├── schemas/      # Pydantic 스키마
│   │   ├── model.py      # SQLAlchemy ORM 모델
│   │   ├── db.py         # 데이터베이스 연결
│   │   ├── deps/         # 의존성 (인증 등)
│   │   ├── tasks/        # 백그라운드 작업
│   │   └── util/         # 유틸리티 함수
│   ├── ml/               # 머신러닝 모델
│   │   ├── stt_model.py  # Whisper STT
│   │   ├── vad.py        # 음성 감지 (VAD)
│   │   └── embeddings/   # 임베딩 모델
│   ├── services/
│   │   ├── stt_pipeline.py      # STT 파이프라인
│   │   └── diarization.py       # 화자 분리
│   └── config.py         # 환경 설정
│
├── frontend/             # React 프론트엔드
│   ├── src/
│   │   ├── pages/        # 페이지 컴포넌트
│   │   ├── components/   # 재사용 컴포넌트
│   │   ├── features/     # Redux 슬라이스
│   │   ├── api/          # API 클라이언트
│   │   ├── hooks/        # 커스텀 훅
│   │   └── App.jsx       # 메인 앱
│   └── package.json
│
└── scripts/              # 유틸리티 스크립트
```

---

## 🔧 기술 스택 상세

### 1️⃣ Backend (FastAPI)

**핵심 기술**
- **FastAPI**: 비동기 REST API 프레임워크
- **SQLAlchemy**: ORM (PostgreSQL 연동)
- **Alembic**: 데이터베이스 마이그레이션
- **Redis**: 실시간 데이터 버퍼링 및 세션 관리
- **Pydantic**: 데이터 검증 및 스키마 정의

**주요 라우터**
```python
/folders          # 폴더 CRUD
/boards           # 보드(회의록) CRUD
/sessions         # 녹음 세션 관리
/memos            # 메모 CRUD
/rag              # RAG 검색 API
/gemini           # Gemini AI 채팅
/calendar         # 일정 관리
/auth             # OAuth 인증
```

**실시간 처리**
- WebSocket (`/ws/stt`): 브라우저에서 PCM 오디오 스트림 수신
- `STTPipeline` 클래스가 VAD → Whisper → 문장 분할 → Redis 발행 처리
- Redis에 세그먼트와 요약을 버퍼링한 후 PostgreSQL로 일괄 저장

**백그라운드 작업**
- 1분마다 구간 요약 생성 (Ollama)
- 화자 분리 (Diarization) 후처리
- 임베딩 생성 및 벡터 DB 저장
- 회의 종료 시 최종 요약 생성

---

### 2️⃣ Frontend (React)

**핵심 기술**
- **React 18**: 컴포넌트 기반 UI
- **Redux Toolkit**: 상태 관리 (folders, boards, records)
- **React Router**: 페이지 라우팅
- **Tailwind CSS**: 유틸리티 기반 스타일링
- **Framer Motion**: 애니메이션
- **WebSocket API**: 실시간 STT 연결

**주요 페이지**
- `NewRecordPage`: 새 회의 녹음 (실시간 STT)
- `RecordDetailPage`: 회의록 상세 (스크립트, 요약, 메모)
- `FolderListPage`: 폴더별 회의록 목록 + 캘린더
- `RecordListPage`: 전체 회의록 검색 및 필터링
- `MeetingPage`: 게스트 접근용 회의 참여 페이지

**커스텀 훅**
- `useRecording`: WebSocket 연결 및 PCM 오디오 전송 로직
- `useToast`: 알림 메시지 표시
- `useAuth`: 인증 상태 관리

**실시간 STT 흐름**
1. 마이크 권한 요청 → `AudioContext` 생성
2. `ScriptProcessor`로 16kHz PCM 데이터 추출
3. WebSocket으로 서버에 스트리밍
4. 서버에서 `{"realtime": "...", "append": "...", "summary": "..."}` 수신
5. Redux 상태 업데이트 → UI 자동 갱신

---

### 3️⃣ AI 파트

**STT (Speech-to-Text)**
- **Whisper**: OpenAI의 다국어 음성 인식 모델
- **VAD (Voice Activity Detection)**: Silero VAD로 무음 구간 필터링
- **후처리**:
  - `TimestampDeduplicator`: 중복 텍스트 제거
  - `SilenceSegmenter`: 무음 기반 문장 분할
  - `RealtimeCleaner`: 오타 보정 및 정규화

**요약 (Summarization)**
- **Ollama** (`qwen2.5:3b-instruct-q4_K_M`): 로컬 LLM 모델
- 1분 단위 구간 요약 (실시간)
- 회의 종료 후 전체 요약 생성 (title, bullets, actions)

**RAG (검색 증강 생성)**
- **Sentence-BERT**: 텍스트 → 768차원 임베딩
- **pgvector**: PostgreSQL 벡터 검색 확장
- 코사인 유사도 기반 관련 회의록 검색
- Ollama로 검색 결과 기반 답변 생성

**화자 분리 (Diarization)**
- **Pyannote Audio**: 화자별 발화 구간 분리
- 녹음 종료 후 백그라운드로 처리
- 결과를 `RecordingResult.speaker_label`에 저장

---

### 4️⃣ Database (PostgreSQL + Redis)

**PostgreSQL 주요 테이블**
```sql
users                 -- 사용자 정보 (OAuth)
folders               -- 폴더 (계층 구조)
boards                -- 보드 (회의록)
recording_sessions    -- 녹음 세션
recording_results     -- STT 결과 (세그먼트)
recording_embeddings  -- RAG용 임베딩 (pgvector)
summaries             -- 1분 단위 요약
final_summaries       -- 회의 전체 요약
memos                 -- 사용자 메모
calendar_events       -- 일정
audio_data            -- 오디오 파일 정보
ai_gemini             -- Gemini API 호출 로그
```

**Redis 키 구조**
```
stt:YYYY-MM-DD:meta:{sid}           # 세션 메타데이터
stt:YYYY-MM-DD:{sid}:segments       # 실시간 세그먼트
stt:YYYY-MM-DD:{sid}:summaries      # 구간 요약
stt:YYYY-MM-DD:sids                 # 활성 세션 목록
stt:YYYY-MM-DD:sid_starts           # 세션 시작 시각 (Sorted Set)
```

**데이터 흐름**
1. **실시간**: WebSocket → STT Pipeline → Redis 버퍼
2. **영구 저장**: Redis → PostgreSQL (redis_to_pg.py)
3. **후처리**: PostgreSQL → 임베딩 생성 → 벡터 DB

---

### 5️⃣ Server 배포 환경

**개발 환경**
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- Ollama: `http://localhost:11434`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

**운영 환경 (예시)**
- CloudFront (정적 파일 CDN)
- EC2 (FastAPI 서버)
- RDS (PostgreSQL)
- ElastiCache (Redis)
- S3 (오디오 파일 저장)

**주요 서버 프로세스**
```
1. FastAPI 서버 (Uvicorn)
2. WebSocket 서버 (/ws/stt)
3. Ollama 서버 (LLM 요약)
4. Redis 서버
5. PostgreSQL 데이터베이스
6. 스케줄러 (일정 알림, 정리 작업)
```

---

## 🔄 데이터 플로우

### 회의 녹음 → 저장 → 검색 전체 흐름

```mermaid
sequenceDiagram
    participant U as 사용자 (Browser)
    participant F as Frontend (React)
    participant W as WebSocket (/ws/stt)
    participant S as STT Pipeline
    participant R as Redis
    participant P as PostgreSQL
    participant AI as AI Services

    U->>F: 녹음 시작 버튼 클릭
    F->>W: WebSocket 연결 + meta (board_id, user_id)
    W->>S: 세션 시작
    S->>R: 메타데이터 저장
    
    loop 실시간 오디오 스트리밍
        U->>F: 마이크 음성 입력
        F->>W: PCM 오디오 전송 (16kHz)
        W->>S: VAD 필터링
        S->>S: Whisper STT
        S->>R: 세그먼트 발행
        S->>F: {"realtime": "...", "append": "..."}
        F->>U: UI 업데이트
    end
    
    loop 1분마다
        S->>AI: 구간 요약 요청 (Ollama)
        AI->>S: 요약 텍스트
        S->>R: 요약 발행
        S->>F: {"summary": "..."}
    end
    
    U->>F: 녹음 종료
    F->>W: WebSocket 종료
    S->>R: ended_at 기록
    S->>P: 세션 최종화
    
    Note over S,AI: 백그라운드 후처리 시작
    S->>AI: 화자 분리 (Diarization)
    S->>AI: 전체 요약 생성
    S->>AI: 임베딩 생성
    AI->>P: 결과 저장
    
    U->>F: 회의록 검색 (RAG)
    F->>P: 유사도 검색 (pgvector)
    P->>AI: 검색 결과 → Ollama
    AI->>F: 답변 생성
    F->>U: 답변 표시
```

---

## 🗂️ 주요 컴포넌트 설명

### Backend 핵심 클래스

**STTPipeline** (`backend/services/stt_pipeline.py`)
- 실시간 STT 처리의 핵심 클래스
- VAD → Whisper → 문장 분할 → Redis 발행 파이프라인
- 1분마다 자동 요약 생성 (백그라운드 태스크)
- 타임아웃 관리 및 세션 종료 처리

**주요 메서드:**
```python
async def begin_session(websocket, meta)  # 세션 시작
async def feed(audio_data)                # 오디오 처리
async def end_session()                   # 세션 종료
```

**Redis Publisher** (`backend/app/util/redis_publisher.py`)
- Redis에 구조화된 데이터 발행
- 세그먼트, 요약, 메타데이터 발행 함수 제공
- 날짜별 키 네이밍 (예: `stt:2025-11-07:{sid}:segments`)

**Redis to PostgreSQL** (`backend/app/tasks/redis_to_pg.py`)
- Redis 버퍼를 PostgreSQL로 일괄 저장
- 세션 종료 시 자동 실행
- 트랜잭션 처리로 데이터 무결성 보장

### Frontend 핵심 컴포넌트

**useRecording Hook** (`frontend/src/hooks/useRecording.js`)
- WebSocket 연결 관리
- AudioContext로 마이크 입력 처리
- PCM 변환 및 전송
- 녹음 상태 관리 (idle/recording/paused)

**RecordDetailPage** (`frontend/src/pages/RecordDetailPage.jsx`)
- 회의록 상세 정보 표시
- 탭: 회의기록, 스크립트, 요약
- 우측 패널: 메모, GPT 질문

**RightPanel** (`frontend/src/components/recording/RightPanel.jsx`)
- 메모 작성 기능
- RAG 기반 질문/답변 인터페이스
- 참조 소스 표시

---

## 🚀 실행 방법 (로컬 개발)

### 사전 요구사항

```bash
# 필수 설치
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- CUDA (GPU 사용 시, Whisper STT 가속화)
```

### 1. Backend 실행

```bash
cd backend

# 가상환경 생성
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정 (.env 파일 생성)
DATABASE_URL=postgresql://user:password@localhost:5433/mydb
REDIS_URL=redis://localhost:6379/0
OLLAMA_BASE_URL=http://localhost:11434
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# 데이터베이스 마이그레이션
alembic upgrade head

# 서버 실행
uvicorn backend.app.main:app --reload --port 8000
```

### 2. Ollama 실행 (요약 모델)

```bash
# Ollama 설치 (https://ollama.ai/)
ollama pull qwen2.5:3b-instruct-q4_K_M

# 서버 실행 (기본 포트 11434)
ollama serve
```

### 3. Frontend 실행

```bash
cd frontend

# 의존성 설치
npm install

# 환경변수 설정 (.env 파일 생성)
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/stt

# 개발 서버 실행
npm run dev
```

### 4. 접속

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## 📊 주요 기능별 설명

### 🎙️ 실시간 STT

1. 사용자가 녹음 시작 → WebSocket 연결
2. 브라우저에서 16kHz PCM 오디오 스트리밍
3. 서버에서 VAD로 음성 구간 감지
4. Whisper 모델로 음성 → 텍스트 변환
5. 무음 기반 문장 분할
6. 실시간으로 프론트엔드에 전송

**특징:**
- 3초 청크 + 1초 오버랩으로 끊김 없는 인식
- N-gram 기반 중복 제거
- 실시간 오타 보정

### 📝 AI 자동 요약

**1분 단위 구간 요약**
- 1분마다 확정된 문장들을 Ollama로 요약
- Redis에 발행 후 WebSocket으로 프론트엔드 전송
- 최소 문자 수 미달 시 다음 구간으로 누적

**회의 종료 후 전체 요약**
- 모든 세그먼트를 조합하여 전체 요약 생성
- 구조: `title`, `bullets` (핵심 내용), `actions` (후속 조치)
- `FinalSummary` 테이블에 저장

### 🔍 RAG 검색

1. 사용자 질문 입력
2. Sentence-BERT로 질문 임베딩
3. pgvector로 유사한 회의록 청크 검색
4. 상위 5개 결과를 컨텍스트로 Ollama에 전달
5. 답변 생성 + 참조 소스 표시

**임베딩 생성 시점:**
- 회의 종료 후 백그라운드 작업
- 세그먼트 단위로 청크 분할
- 768차원 벡터로 변환

### 👥 화자 분리 (Diarization)

- 회의 종료 후 Pyannote Audio로 처리
- WAV 파일 필요 (실시간 불가)
- 결과를 `speaker_label` (예: `SPEAKER_00`)로 저장
- 프론트엔드에서 화자별 색상 표시

### 📅 일정 관리

- FullCalendar 라이브러리 사용
- RRULE 반복 일정 지원
- 아침 알림 (스케줄러)
- 회의 보드와 연결 가능

---

## 🔐 인증 및 권한

**OAuth 2.0 (Google)**
- 소셜 로그인 지원
- Access Token + Refresh Token
- JWT 기반 인증

**회의록 공유**
- 초대 링크 생성 (`invite_token`)
- 역할: `viewer` (읽기 전용), `editor` (편집 가능)
- 만료 시간 설정

**폴더/보드 권한**
- 사용자별로 소유한 폴더만 접근
- 공유된 보드는 역할에 따라 권한 제한

---

## 🧪 테스트 및 디버깅

### API 테스트
```bash
# FastAPI Swagger UI
http://localhost:8000/docs

# 특정 엔드포인트 테스트
curl -X POST http://localhost:8000/boards/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "테스트 회의", "folder_id": 1}'
```

### WebSocket 테스트
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/stt');
ws.onopen = () => {
    ws.send(JSON.stringify({ action: 'meta', data: { sid: 123, board_id: 1 } }));
};
ws.onmessage = (event) => {
    console.log('Received:', JSON.parse(event.data));
};
```

### Redis 모니터링
```bash
redis-cli MONITOR
redis-cli KEYS "stt:*"
redis-cli HGETALL "stt:2025-11-07:meta:123"
```

---

## 🐛 알려진 이슈 및 해결 방법

### 1. Whisper 모델 로딩 느림
**원인**: CPU 모드에서 첫 로딩 시 시간 소요  
**해결**: GPU (CUDA) 사용 또는 모델 캐싱

### 2. WebSocket 연결 끊김
**원인**: 네트워크 불안정 또는 타임아웃  
**해결**: Keep-alive 메커니즘 추가 (현재 구현됨)

### 3. Ollama 요약 생성 실패
**원인**: Ollama 서버 미실행 또는 모델 미다운로드  
**해결**: `ollama serve` 확인 및 모델 pull

### 4. PostgreSQL 연결 에러
**원인**: `.env` 파일의 DATABASE_URL 오류  
**해결**: 포트 및 자격 증명 확인

---

## 📈 향후 개선 계획

- [ ] **다국어 지원**: Whisper의 다국어 인식 활용
- [ ] **실시간 화자 분리**: Pyannote를 실시간 스트리밍에 통합
- [ ] **모바일 앱**: React Native 또는 Flutter
- [ ] **온라인 회의 통합**: Zoom/Google Meet API 연동
- [ ] **커스텀 LLM**: 도메인 특화 요약 모델 파인튜닝
- [ ] **음성 검색**: 오디오 파일에서 키워드 검색
- [ ] **협업 기능**: 실시간 공동 편집 (WebSocket)

---

## 🤝 기여 방법

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

## 👥 팀 정보

- **Backend 개발**: STT Pipeline, API 설계, 데이터베이스 설계
- **Frontend 개발**: React UI/UX, WebSocket 통신, 상태 관리
- **AI 개발**: STT 모델 통합, 요약 모델 최적화, RAG 구현
- **DevOps**: 서버 배포, CI/CD, 모니터링

---

## 📞 문의

프로젝트 관련 문의사항이나 버그 리포트는 이슈 페이지를 이용해 주세요.

---

**NoteRi** - 기억은 흐릿하게, 기록은 또렸하게
