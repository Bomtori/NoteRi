from fastapi import FastAPI, WebSocket, Query
# ============================================
# 🌐 기본 라이브러리 & 환경 설정
# ============================================
import os
from dotenv import load_dotenv

# ============================================
# ⚙️ FastAPI / Starlette
# ============================================
from fastapi import FastAPI, WebSocket, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.websockets import WebSocketState, WebSocketDisconnect

# ============================================
# 🧠 Services (STT, Diarization)
# ============================================
from backend.services.stt_pipeline import STTPipeline
from backend.app.routers.sessions_router import router as sessions_router


# ============================================
# 🗓 Scheduler & DB 초기화
# ============================================
from backend.app.tasks.scheduler import start_scheduler
from backend.app.tasks.scheduler import run_renew_once
from fastapi.middleware.cors import CORSMiddleware
from backend.app.db import get_db, SessionLocal
from backend.app.seed.plan_seed import seed_plans
from backend.app.routers import register_routers
load_dotenv()

app = FastAPI()

# 세션 (OAuth redirect 시 필요할 수 있음)
app.add_middleware(SessionMiddleware, secret_key=os.getenv("APP_SECRET_KEY"))
app.include_router(sessions_router)

# ============================================
# 💾 Redis 관련
# ============================================
from .routers.redis_test_router import router as redis_test_router
from .util.redis_client import get_redis, close_redis

# static 디렉토리 생성 후 mount
app.mount("/static", StaticFiles(directory="static"), name="static")

origins = [
    "http://localhost:5173",      # 학원에서 돌리는 프론트
    "http://127.0.0.1:5173",
    "http://1.236.171.160:5173",
    "http://localhost:8000"# 필요 시 추가
]

# ✅ CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,  # 로그인 쿠키, 토큰 등
    allow_methods=["*"],
    allow_headers=["*"],
)
# 라우터 등록
register_routers(app)  # 한 줄로 끝

pipeline = STTPipeline()

@app.websocket("/ws/stt")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("✅ connection open")

    await pipeline.begin_session(websocket)

    try:
        while True:
            data = await websocket.receive_bytes()
            await pipeline.feed(data, websocket)

    except WebSocketDisconnect:
        print("🔌 client disconnected")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")

    finally:
        try:
            # --- 종료 시 순서 ---
            # A. 요약 전송 (WS가 아직 연결 중일 때만)
            if websocket.application_state == WebSocketState.CONNECTED:
                await pipeline.flush_final_summary()
        except Exception as e:
            print(f"⚠️ flush_final_summary 실패: {e}")

        try:
            # B. 원본 오디오 저장
            result = pipeline.save_raw_audio()
            if result:
                filepath = result["filepath"]
                duration = result["duration"]
                print(f"🎵 Audio saved at: {filepath} ({duration:.2f}s)")
            else:
                print("⚠️ 저장할 오디오 데이터 없음")
        except Exception as e:
            print(f"⚠️ save_raw_audio 실패: {e}")

        try:
            # C. 세션 종료 → flush, diarization 자동 실행 ❌
            if websocket.application_state != WebSocketState.CONNECTED:
                pipeline.ws = None
            await pipeline.end_session(run_diarization=False)
        except Exception as e:
            print(f"⚠️ end_session 실패: {e}")

        try:
            # D. WS 닫기
            if websocket.application_state == WebSocketState.CONNECTED:
                await websocket.close()
        except Exception:
            pass

        print("🔌 connection closed")

# === 수동 저장 API (옵션) ===
@app.post("/save-audio")
def save_audio():
    result = pipeline.save_raw_audio()
    if result:
        return {"status": "ok", **result}
    return {"status": "error", "message": "No audio data"}


# === 최신 저장 파일 확인 API ===
@app.get("/diarize/latest")
def diarize_latest(num_speakers: int | None = Query(default=None, ge=1, le=10)):
    if not pipeline.last_saved_file:
        return {"error": "No file saved yet"}
    filepath = pipeline.last_saved_file
    diarization_result = diarizer.diarize(filepath, num_speakers=num_speakers)
    return {"file": filepath, "diarization": diarization_result}

@app.get("/")
async def root():
    return {"message": "Hello, FastAPI is running"}

@app.on_event("startup")
async def startup_event():
    # ✅ Redis 연결 (비동기)
    await get_redis()

    # ✅ 초기 데이터 시드
    db = SessionLocal()
    try:
        seed_plans(db)
    finally:
        db.close()

    # ✅ 스케줄러 시작
    start_scheduler()

    # (선택) 서버 기동 직후 1회 갱신 실행
    await run_renew_once()

@app.on_event("shutdown")
async def shutdown_event():
    await close_redis()