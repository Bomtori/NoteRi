from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
from app.tasks.scheduler import start_scheduler
from fastapi.middleware.cors import CORSMiddleware
from app.routers.user.google_auth_router import router as google_auth_router  # ✅ login.py에서 라우터 import
from app.routers.user.kakao_auth_router import router as kakao_auth_router
from app.routers.user.naver_auth_router import router as naver_auth_router
from app.routers.user.userInfo_router import router as userinfo_router
from app.routers import board_router as board_router, folder_router as folder_router, subscription_router as subscription_router
from app.routers.user.profile_upload_router import router as upload_router
from app.routers.payment_router import router as subscription_payment_router
from app.routers.notion_auth_router import router as notion_auth_router
from app.routers.memo_router import router as memo_router

load_dotenv()

app = FastAPI()

# 세션 (OAuth redirect 시 필요할 수 있음)
app.add_middleware(SessionMiddleware, secret_key=os.getenv("APP_SECRET_KEY"))

# 라우터 등록
app.include_router(google_auth_router, prefix="", tags=["auth"])
app.include_router(kakao_auth_router, prefix="", tags=["auth"])
app.include_router(naver_auth_router, prefix="", tags=["auth"])
app.include_router(userinfo_router, prefix="", tags=["users"])
app.include_router(board_router.router)
app.include_router(upload_router, prefix="", tags=["upload"])
app.include_router(folder_router.router)
app.include_router(subscription_router.router)
app.include_router(subscription_payment_router)
app.include_router(notion_auth_router)
app.include_router(memo_router)

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


@app.get("/")
async def root():
    return {"message": "Hello, FastAPI is running"}

@app.on_event("startup")
def startup_event():
    start_scheduler()
#
# @app.get("/ping")
# def ping():
#     return {"message": "pong"}