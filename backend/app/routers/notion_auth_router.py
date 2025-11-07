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
import backend.app.crud.notion_crud as crud
import logging

logger = logging.getLogger("uvicorn")

router = APIRouter(prefix="/notion", tags=["Notion OAuth"])

CLIENT_ID = os.getenv("NOTION_CLIENT_ID")
REDIRECT_URI = os.getenv("NOTION_REDIRECT_URI")
CLIENT_SECRET = os.getenv("NOTION_CLIENT_SECRET")
NOTION_VERSION = os.getenv("NOTION_VERSION", "2022-06-28")


def notion_headers(token: str):
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
    }

# 노션 상태 가져오기
@router.get("/status", summary="노션 상태 가져오기")
def notion_status(auth: Optional[NotionAuth] = Depends(crud.get_user_notion_auth)):
    return {
        "connected": bool(auth),
        "workspace_id": getattr(auth, "workspace_id", None),
        "workspace_name": getattr(auth, "workspace_name", None),
    }

# 노션 동의화면 리다이렉트
@router.get("/login", summary="노션 로그인")
def notion_login(current_user: User = Depends(get_current_user)):

    state = f"{current_user.id}:{secrets.token_urlsafe(16)}"
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "owner": "user",
        "redirect_uri": REDIRECT_URI,
        "state": state,
    }
    url = "https://api.notion.com/v1/oauth/authorize?" + urllib.parse.urlencode(params)
    logger.info(f"✅ Notion 로그인 시도 by user {current_user.id}")
    logger.info(f"➡️ 리다이렉트 URL: {url}")
    logger.info(f"CLIENT_ID={CLIENT_ID}, REDIRECT_URI={REDIRECT_URI}")
    return {"url": url}

@router.get("/callback", include_in_schema=False, summary="노션 콜백")
def notion_callback(code: str, state: str, db: Session = Depends(get_db)):
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



@router.post("/upload")
def upload_to_notion(
    title: str = Body(..., embed=True),
    content: str = Body(..., embed=True),
    parent_id: str = Body(..., embed=True),
    parent_type: str = Body("database", embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token: Optional[str] = Depends(crud.get_user_notion_token),
):
    if not token:
        raise HTTPException(status_code=400, detail="Notion 계정이 연결되지 않았습니다.")

    # 1 DB 정보 요청해서 title property 자동 감지
    db_info = requests.get(
        f"https://api.notion.com/v1/databases/{parent_id}",
        headers=notion_headers(token),
    )
    if db_info.status_code != 200:
        raise HTTPException(status_code=400, detail="데이터베이스 정보를 불러올 수 없습니다.")

    db_data = db_info.json()
    title_prop = next(
        (key for key, val in db_data.get("properties", {}).items()
         if val.get("type") == "title"),
        "Name" 
    )
    logger.info(f"✅ 감지된 Notion 타이틀 속성명: {title_prop}")

    # 2 본문 생성
    body = {
        "parent": {"database_id": parent_id},
        "properties": {
            title_prop: {"title": [{"text": {"content": title}}]}
        },
        "children": [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"text": {"content": content or " "}}]
                },
            }
        ],
    }

    # 3 업로드
    r = requests.post("https://api.notion.com/v1/pages", headers=notion_headers(token), json=body)
    logger.info(f"🧭 Notion upload status={r.status_code}")
    logger.info(f"🧭 Notion upload response={r.text}")

    if r.status_code == 401:
        raise HTTPException(status_code=401, detail="Notion 토큰이 만료되었습니다. 다시 연결해주세요.")
    if r.status_code != 200:
        try:
            raise HTTPException(status_code=r.status_code, detail=r.json())
        except Exception:
            raise HTTPException(status_code=r.status_code, detail=r.text)

    page = r.json()
    return {"id": page["id"], "url": page["url"]}





@router.get("/databases")
def list_notion_databases(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
        token: Optional[str] = Depends(crud.get_user_notion_token),
):
    if not token:
        raise HTTPException(status_code=400, detail="Notion 계정이 연결되지 않았습니다.")

    try:
        # 데이터베이스만 검색
        r = requests.post(
            "https://api.notion.com/v1/search",
            headers=notion_headers(token),
            json={"filter": {"value": "database", "property": "object"}},
            timeout=10,
        )
        logger.info(f"🧭 Notion search status={r.status_code}")
        logger.info(f"🧭 Notion search response: {r.text}")

        if r.status_code == 401:
            raise HTTPException(status_code=401, detail="Notion 토큰이 만료되었거나 잘못되었습니다.")
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.text)

        data = r.json()
        results = []
        for d in data.get("results", []):
            if d["object"] != "database":
                continue
            # title 안전하게 파싱
            title = (
                d.get("title", [{}])[0].get("plain_text", "제목 없음")
                if d.get("title")
                else "제목 없음"
            )
            results.append({
                "id": d["id"],
                "title": title,
            })

        logger.info(f"✅ Parsed {len(results)} databases from Notion.")
        return results

    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Notion API 요청 실패: {e}")
        raise HTTPException(status_code=500, detail=f"Notion API 요청 실패: {e}")

# 노션 연동 해제
@router.delete("/disconnect", status_code=status.HTTP_204_NO_CONTENT, summary="노션 연동 해제")
def disconnect_notion(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    auth: Optional[NotionAuth] = (
        db.query(NotionAuth).filter(NotionAuth.user_id == current_user.id).first()
    )

    if not auth:
        return
    db.delete(auth)
    db.commit()
    return