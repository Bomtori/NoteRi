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

from app.user.login import router as login_router  # ✅ login.py에서 라우터 import
from app.user.userInfo import router as userinfo_router
from app.board import board as board_router
from app.user.upload import router as upload_router
from app.folder import folder as folder_router
from app.subscription import subscription as subscription_router
from app.subscription.payment import router as subscription_payment_router

load_dotenv()

app = FastAPI()

# 세션 (OAuth redirect 시 필요할 수 있음)
app.add_middleware(SessionMiddleware, secret_key=os.getenv("APP_SECRET_KEY"))

# 라우터 등록
app.include_router(login_router, prefix="", tags=["auth"])
app.include_router(userinfo_router, prefix="", tags=["users"])
app.include_router(board_router.router)
app.include_router(upload_router, prefix="", tags=["upload"])
app.include_router(folder_router.router)
app.include_router(subscription_router.router)
app.include_router(subscription_payment_router)
# static 디렉토리 생성 후 mount
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    return {"message": "Hello, FastAPI is running"}

# @app.exception_handler(Exception)
# async def global_exception_handler(request: Request, exc: Exception):
#     return JSONResponse(
#         status_code=500,
#         content={
#             "detail": str(exc),
#             "type": exc.__class__.__name__,
#             "trace": traceback.format_exc().splitlines()
#         },
#     )

logfile = open("server_debug.log", "a", encoding="utf-8")
sys.stdout = logfile
sys.stderr = logfile
print(">>> main.py started <<<")

@app.get("/ping")
async def ping():
    return {"pong": True}

@app.on_event("startup")
def startup_event():
    start_scheduler()