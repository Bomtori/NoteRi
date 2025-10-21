from fastapi import FastAPI, WebSocket, Query
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
from backend.services.stt_pipeline import STTPipeline
from backend.services.diarization import DiarizationService
from backend.app.tasks.scheduler import start_scheduler
from fastapi.middleware.cors import CORSMiddleware
from backend.app.db import get_db, SessionLocal
from backend.app.seed.paln_seed import seed_plans
from backend.app.routers import register_routers
load_dotenv()

app = FastAPI()

# 세션 (OAuth redirect 시 필요할 수 있음)
app.add_middleware(SessionMiddleware, secret_key=os.getenv("APP_SECRET_KEY"))


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
    allow_origins=origins,  # 프론트엔드 주소
    allow_credentials=True,
    allow_methods=["*"],   # 모든 메서드 허용 (GET, POST, OPTIONS 등)
    allow_headers=["*"],   # 모든 헤더 허용
)
# 라우터 등록
register_routers(app)  # 한 줄로 끝

pipeline = STTPipeline()
diarizer = DiarizationService()

@app.websocket("/ws/stt")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("✅ connection open")

    # 🔹 시작 버튼 즉시 1분 타이머 켜기 (오디오 유무 무관)
    await pipeline.begin_session(websocket)

    try:
        while True:
            data = await websocket.receive_bytes()
            await pipeline.feed(data, websocket)

    except Exception as e:
        # 클라이언트가 정상적으로 닫아도 여기로 들어옴
        print(f"❌ 오류 발생: {e}")
    finally:
        # 🔹 남은 내용 구간 요약 강제 flush + 타이머 종료
        await pipeline.end_session()   # 내부에서 flush & stop

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
