# app/routers/notion_oauth.py
import os, urllib.parse, secrets
import base64, requests
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.notion import crud
from app.db import SessionLocal
from app.model import User
from app.deps.auth import get_current_user
import logging
logger = logging.getLogger("uvicorn")

router = APIRouter(prefix="/notion", tags=["Notion OAuth"])

CLIENT_ID = os.getenv("NOTION_CLIENT_ID")
REDIRECT_URI = os.getenv("NOTION_REDIRECT_URI")  # e.g. http://127.0.0.1:8001/notion/callback
CLIENT_SECRET = os.getenv("NOTION_CLIENT_SECRET")
NOTION_VERSION = os.getenv("NOTION_VERSION", "2022-06-28")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/login")
def notion_login(current_user: User = Depends(get_current_user)):
    state = state = f"{current_user.id}:{secrets.token_urlsafe(16)}"  # CSRF/원래 요청 복원용
    # state는 Redis/DB/세션 등에 저장해두고 callback에서 검증
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "owner": "user",
        "redirect_uri": REDIRECT_URI,
        "state": state,
    }
    url = "https://api.notion.com/v1/oauth/authorize?" + urllib.parse.urlencode(params)
    return RedirectResponse(url)


@router.get("/callback", include_in_schema=False)
def notion_callback(code: str, state: str, db: Session = Depends(get_db), user_id: int = 1):
    # 1) state 검증 (생략 시 보안 취약)
    # ex) if not valid_state(state): raise HTTPException(400, "Invalid state")
    logger.info(f"DEBUG CLIENT_ID={CLIENT_ID}, CLIENT_SECRET={CLIENT_SECRET}, REDIRECT_URI={REDIRECT_URI}")
    user_id, _ = state.split(":", 1)
    user_id = int(user_id)

    basic = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    headers = {
        "Authorization": f"Basic {basic}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,  # 설정에 따라 필수
    }
    r = requests.post("https://api.notion.com/v1/oauth/token", headers=headers, json=payload)
    logger.info(f"DEBUG Notion response {r.status_code}: {r.text}")
    print("DEBUG Notion token response", r.status_code, r.text)
    # if r.status_code != 200:
    #     raise HTTPException(r.status_code, detail=r.json())
    data = r.json()
    crud.save_user_notion_token(
        db=db,
        user_id=user_id,
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        workspace_id=data.get("workspace_id"),
        workspace_name=data.get("workspace_name"),
    )
    # data: access_token, refresh_token, bot_id, workspace_id, workspace_name, owner 등
    # → DB에 user_id와 함께 저장
    # save_notion_tokens(user_id, data)

    return {"debug_status": r.status_code, "debug_text": r.text}


def notion_headers(token: str):
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
    }

@router.post("/upload")
def upload_to_notion(user_id: int,
                     title: str,
                     content: str,
                     parent_id: str,
                     parent_type: str = "database",
                     db: Session = Depends(get_db)):
    """
    parent_type: 'database' | 'page'
    parent_id: 사용자가 선택한 데이터베이스ID or 페이지ID
    """
    token = crud.get_user_notion_token(db, user_id)  # DB에서 불러오기
    if not token:
        raise HTTPException(400, "Notion 계정이 연결되지 않았습니다.")

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
        # 필요 시 refresh_token 사용해 토큰 갱신 시도 후 재호출
        # refresh_notion_token(user_id); 다시 요청 ...
        pass
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.json())
    page = r.json()
    return {"id": page["id"], "url": page["url"]}
