# backend/app/routers/auth_dev_router.py
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/auth/dev", tags=["AuthDev"])

@router.get("/issue")
def issue_cookie():
    # 가짜 refresh 토큰 내려서 쿠키 저장 테스트
    fake_rt = "debug-refresh-token"
    resp = JSONResponse({"ok": True})
    resp.set_cookie(
        key="refresh_token",
        value=fake_rt,
        httponly=True,
        secure=False,   # 로컬
        samesite="lax",
        domain=None,
        path="/",
        max_age=60*60*24*7,
    )
    return resp
