# app/routers/notion_oauth.py
import os, urllib.parse, secrets
import base64, requests
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from backend.app.db import get_db
from backend.app.model import User, NotionAuth
from backend.app.deps.auth import get_current_user
import backend.app.crud.notion_crud as crud  # save_user_notion_token, get_user_notion_token
import logging

logger = logging.getLogger("uvicorn")

router = APIRouter(prefix="/notion", tags=["Notion OAuth"])

CLIENT_ID = os.getenv("NOTION_CLIENT_ID")
REDIRECT_URI = os.getenv("NOTION_REDIRECT_URI")  # e.g. http://127.0.0.1:8001/notion/callback
CLIENT_SECRET = os.getenv("NOTION_CLIENT_SECRET")
NOTION_VERSION = os.getenv("NOTION_VERSION", "2022-06-28")


def notion_headers(token: str):
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
    }
@router.get("/status")
def notion_status(auth: Optional[NotionAuth] = Depends(crud.get_user_notion_auth)):
    """
    현재 로그인 사용자의 노션 연동 상태 조회
    - Authorization: Bearer <access_jwt> 필요
    """
    return {
        "connected": bool(auth),
        "workspace_id": getattr(auth, "workspace_id", None),
        "workspace_name": getattr(auth, "workspace_name", None),
    }


@router.get("/login")
def notion_login(current_user: User = Depends(get_current_user)):
    """
    사용자를 Notion OAuth 동의화면으로 리다이렉트.
    state에 user_id와 랜덤 시드를 포함. (실서비스에선 state 검증을 반드시 구현)
    """
    state = f"{current_user.id}:{secrets.token_urlsafe(16)}"
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "owner": "user",
        "redirect_uri": REDIRECT_URI,
        "state": state,
    }
    url = "https://api.notion.com/v1/oauth/authorize?" + urllib.parse.urlencode(params)
     # ✅ 로그로 전체 URL 찍기
    logger.info(f"✅ Notion 로그인 시도 by user {current_user.id}")
    logger.info(f"➡️ 리다이렉트 URL: {url}")
    logger.info(f"CLIENT_ID={CLIENT_ID}, REDIRECT_URI={REDIRECT_URI}")
    return {"url": url}

@router.get("/callback", include_in_schema=False)
def notion_callback(code: str, state: str, db: Session = Depends(get_db)):
    """
    Notion OAuth 콜백. code 교환 → 토큰 저장
    """
    # 1) state 검증 (실서비스 필수)
    try:
        user_id_str, _ = state.split(":", 1)
        user_id = int(user_id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid state")

    basic = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    headers = {"Authorization": f"Basic {basic}", "Content-Type": "application/json", "Accept": "application/json"}
    payload = {"grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT_URI}

    r = requests.post("https://api.notion.com/v1/oauth/token", headers=headers, json=payload)
    logger.info(f"DEBUG Notion response {r.status_code}: {r.text}")
    data = r.json()

    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=data)

    crud.save_user_notion_token(
        db=db,
        user_id=user_id,
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        workspace_id=data.get("workspace_id"),
        workspace_name=data.get("workspace_name"),
    )
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    redirect_to = f"{frontend_url}/user?notion=connected"
    return RedirectResponse(url=redirect_to, status_code=302)

@router.get("/status")
def notion_status(auth: Optional[NotionAuth] = Depends(crud.get_user_notion_auth)):
    """
    현재 로그인 사용자의 노션 연동 상태 조회
    - Authorization: Bearer <access_jwt> 필요
    """
    return {
        "connected": bool(auth),
        "workspace_id": getattr(auth, "workspace_id", None),
        "workspace_name": getattr(auth, "workspace_name", None),
    }

@router.post("/upload")
def upload_to_notion(
    title: str = Body(..., embed=True),
    content: str = Body(..., embed=True),
    parent_id: str = Body(..., embed=True),
    parent_type: str = Body("database", embed=True),  # 'database' | 'page'
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token: Optional[str] = Depends(crud.get_user_notion_token),  # JWT에서 user_id→DB조회로 주입
):
    """
    parent_type: 'database' | 'page'
    parent_id: 사용자가 선택한 데이터베이스ID or 페이지ID
    """
    if not token:
        raise HTTPException(status_code=400, detail="Notion 계정이 연결되지 않았습니다.")

    parent = {"database_id": parent_id} if parent_type == "database" else {"page_id": parent_id}
    body = {
        "parent": parent,
        "properties": {
            # DB의 타이틀 프로퍼티명이 'Name'일 때 예시
            "Name": {"title": [{"text": {"content": title}}]}
        },
        "children": [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"text": {"content": content}}]},
            }
        ],
    }
    r = requests.post("https://api.notion.com/v1/pages", headers=notion_headers(token), json=body)

    if r.status_code == 401:
        # 필요 시 refresh_token 사용해 토큰 갱신 시도 후 재호출 로직을 붙일 수 있습니다.
        # 예: refresh_notion_token(db, current_user.id); 그 후 재시도
        raise HTTPException(status_code=401, detail="Notion 토큰이 만료되었습니다. 다시 연결해주세요.")

    if r.status_code != 200:
        try:
            raise HTTPException(status_code=r.status_code, detail=r.json())
        except Exception:
            raise HTTPException(status_code=r.status_code, detail=r.text)

    page = r.json()
    return {"id": page["id"], "url": page["url"]}


@router.delete("/disconnect", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_notion(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    노션 연동 해제:
    - 로컬 DB에서 해당 사용자의 NotionAuth 레코드를 삭제(또는 access_token을 무효화)
    - Notion API에 별도의 토큰 revoke 엔드포인트는 없으므로(공식 제공 없음),
      사용자가 Notion > Settings & members > Connections에서 수동 해제할 수 있게 안내 권장.
    """
    auth: Optional[NotionAuth] = (
        db.query(NotionAuth).filter(NotionAuth.user_id == current_user.id).first()
    )

    if not auth:
        # 이미 해제된 상태
        return

    # 필요 시 완전 삭제 대신 토큰만 무효화(빈 문자열)로 남기는 방식도 가능
    db.delete(auth)
    db.commit()
    return