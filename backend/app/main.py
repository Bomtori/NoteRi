from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
import os
import sys
from dotenv import load_dotenv
from fastapi.responses import JSONResponse
from fastapi.requests import Request
from fastapi.staticfiles import StaticFiles
import traceback
from app.tasks.scheduler import start_scheduler
from fastapi.middleware.cors import CORSMiddleware
from app.user.google_auth import router as google_auth_router  # ✅ login.py에서 라우터 import
from app.user.kakao_auth import router as kakao_auth_router
from app.user.naver_auth import router as naver_auth_router
from app.user.userInfo import router as userinfo_router
from app.board import board as board_router
from app.user.upload import router as upload_router
from app.folder import folder as folder_router
from app.subscription import subscription as subscription_router
from app.subscription.payment import router as subscription_payment_router
from app.notion.notion_auth import router as notion_auth_router

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