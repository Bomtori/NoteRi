from fastapi import FastAPI, WebSocket, Query
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
from services.stt_pipeline import STTPipeline
from services.diarization import DiarizationService
from app.tasks.scheduler import start_scheduler
from fastapi.middleware.cors import CORSMiddleware
from db import get_db, SessionLocal
from seed.paln_seed import seed_plans
from app.routers.user.google_auth_router import router as google_auth_router  # ✅ login.py에서 라우터 import
from app.routers.user.kakao_auth_router import router as kakao_auth_router
from app.routers.user.naver_auth_router import router as naver_auth_router
from app.routers.user.userInfo_router import router as userinfo_router
from app.routers import board_router as board_router, folder_router as folder_router, subscription_router as subscription_router
from app.routers.user.profile_upload_router import router as upload_router
from app.routers.payment_router import router as subscription_payment_router
from app.routers.notion_auth_router import router as notion_auth_router
from app.routers.memo_router import router as memo_router
from app.routers.audio_router import router as audio_router
from app.routers.user.user_router import router as user_router

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

    try:
        while True:
            data = await websocket.receive_bytes()
            await pipeline.feed(data, websocket)

    except Exception as e:
        # 클라이언트가 정상적으로 닫아도 여기로 들어옴
        print(f"❌ 오류 발생: {e}")
    finally:
        # ✅ WebSocket 종료 → 원본 오디오 저장
        result = pipeline.save_raw_audio()
        if result:
            filepath = result["filepath"]
            duration = result["duration"]
            print(f"🎵 Audio saved at: {filepath} (duration={duration:.2f}s)")
        else:
            print("⚠️ 저장할 오디오 데이터 없음")

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

print("hello")
