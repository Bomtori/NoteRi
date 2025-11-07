# backend/app/routers/auth_dev_router.py
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/auth/dev", tags=["AuthDev"])

@router.get("/issue", summary="테스트")
def issue_cookie():
    fake_rt = "debug-refresh-token"
    resp = JSONResponse({"ok": True})
    resp.set_cookie(
        key="refresh_token",
        value=fake_rt,
        httponly=True,
        secure=False, 
        samesite="lax",
        domain=None,
        path="/",
        max_age=60*60*24*7,
    )
    return resp
