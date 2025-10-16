from fastapi import FastAPI, WebSocket, Query
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv
from fastapi import WebSocket
from starlette.websockets import WebSocketState, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from backend.services.stt_pipeline import STTPipeline
from backend.services.diarization import DiarizationService
from backend.app.tasks.scheduler import start_scheduler
from fastapi.middleware.cors import CORSMiddleware
from backend.app.db import get_db, SessionLocal
from backend.app.seed.plan_seed import seed_plans
from backend.app.routers.user.google_auth_router import router as google_auth_router  # ✅ login.py에서 라우터 import
from backend.app.routers.user.kakao_auth_router import router as kakao_auth_router
from backend.app.routers.user.naver_auth_router import router as naver_auth_router
from backend.app.routers.user.userInfo_router import router as userinfo_router
from backend.app.routers import board_router as board_router, folder_router as folder_router, subscription_router as subscription_router
from backend.app.routers.user.profile_upload_router import router as upload_router
from backend.app.routers.payment_router import router as subscription_payment_router
from backend.app.routers.notion_auth_router import router as notion_auth_router
from backend.app.routers.memo_router import router as memo_router
from backend.app.routers.audio_router import router as audio_router
from backend.app.routers.user.user_router import router as user_router
from backend.app.routers.recording_usage_router import router as recording_usage_router
from backend.app.routers.gemini_router import router as gemini_router

load_dotenv()

app = FastAPI()

# 세션 (OAuth redirect 시 필요할 수 있음)
app.add_middleware(SessionMiddleware, secret_key=os.getenv("APP_SECRET_KEY"))

# 라우터 등록
app.include_router(google_auth_router, prefix="", tags=["auth"])
app.include_router(kakao_auth_router, prefix="", tags=["auth"])
app.include_router(naver_auth_router, prefix="", tags=["auth"])
app.include_router(userinfo_router, prefix="", tags=["users"])
app.include_router(user_router)
app.include_router(board_router.router)
app.include_router(upload_router, prefix="", tags=["upload"])
app.include_router(folder_router.router)
app.include_router(subscription_router.router)
app.include_router(subscription_payment_router)
app.include_router(notion_auth_router)
app.include_router(memo_router)
app.include_router(audio_router)
app.include_router(recording_usage_router)
app.include_router(gemini_router)

# static 디렉토리 생성 후 mount
app.mount("/static", StaticFiles(directory="static"), name="static")

# ✅ CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프론트엔드 주소
    allow_credentials=True,
    allow_methods=["*"],   # 모든 메서드 허용 (GET, POST, OPTIONS 등)
    allow_headers=["*"],   # 모든 헤더 허용
)

pipeline = STTPipeline()
diarizer = DiarizationService()

@app.websocket("/ws/stt")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("✅ connection open")

    # 1) 오디오 유무와 관계없이 세션/타이머 시작
    await pipeline.begin_session(websocket)

    try:
        while True:
            data = await websocket.receive_bytes()
            await pipeline.feed(data, websocket)

    except WebSocketDisconnect:
        # 클라이언트가 정상적으로 끊은 경우
        print("🔌 client disconnected")
    except Exception as e:
        # 기타 예외
        print(f"❌ 오류 발생: {e}")
    finally:
        # --- 종료 시 순서 중요 ---
        # A. 가능하면 최종 요약을 먼저 생성/전송(WS가 살아있을 때만)
        try:
            if websocket.application_state == WebSocketState.CONNECTED:
                await pipeline.flush_final_summary()
        except Exception as e:
            print(f"⚠️ flush_final_summary 실패: {e}")

        # B. 원본 오디오 저장(버퍼가 초기화되기 전에 반드시 실행)
        result = None
        try:
            result = pipeline.save_raw_audio()  # 저장 후 내부적으로 부분 초기화(reset) 수행
        except Exception as e:
            print(f"⚠️ save_raw_audio 실패: {e}")

        if result:
            filepath = result["filepath"]
            duration = result["duration"]
            print(f"🎵 Audio saved at: {filepath} (duration={duration:.2f}s)")
        else:
            print("⚠️ 저장할 오디오 데이터 없음")

        # C. 세션 종료(타이머/상태 정리). 이미 요약/저장 했으므로 여기서는 정리만.
        try:
            # end_session 내부에서 WS로 보내지 않도록 방어적으로 끊어둠
            if websocket.application_state != WebSocketState.CONNECTED:
                pipeline.ws = None
            await pipeline.end_session()
        except Exception as e:
            print(f"⚠️ end_session 실패: {e}")

        # D. 서버 측에서 WS가 아직 열려있다면 안전하게 닫기
        try:
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
def startup_event():
    start_scheduler()
    db = SessionLocal()
    try: seed_plans(db)
    finally: db.close()