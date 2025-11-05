# backend/app/main.py

# ============================================
# 🌐 기본 라이브러리 & 환경 설정
# ============================================
import os
import logging
from typing import Dict
from dotenv import load_dotenv
import asyncio  # ← 추가: keep-alive 태스크용

# ============================================
# ⚙️ FastAPI / Starlette
# ============================================
from fastapi import FastAPI, WebSocket, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.websockets import WebSocketState, WebSocketDisconnect


# ============================================
# 🧠 Services (STT, Diarization)
# ============================================
from backend.services.stt_pipeline import STTPipeline
from backend.app.routers.sessions_router import router as sessions_router
from backend.app.routers import rag_router
from datetime import datetime
from backend.app.util.session_repo import ensure_session_saved

# ============================================
# 🗓 Scheduler & DB 초기화
# ============================================
from backend.app.tasks.scheduler import (
    start_scheduler,
    unban_expired_users,
    run_renew_once,
    send_morning_calendar_notifications
)
from backend.app.db import get_db, SessionLocal
from backend.app.seed.plan_seed import seed_plans
from backend.app.routers import register_routers

# ============================================
# 💾 Redis 관련
# ============================================
from backend.app.routers.redis_test_router import router as redis_test_router
from backend.app.util.redis_client import get_redis, close_redis

# ============================================
# 환경변수 로드
# ============================================
load_dotenv()

# ============================================
# 로깅 설정
# ============================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("MainApp")

# ============================================
# FastAPI 앱 생성
# ============================================
app = FastAPI()

# 세션 미들웨어 (OAuth redirect 시 필요할 수 있음)
app.add_middleware(SessionMiddleware, secret_key=os.getenv("APP_SECRET_KEY"))

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # 로컬 프론트엔드
        "http://localhost:3000",      # 대체 포트
        "http://1.236.171.160:5173",  # 외부 프론트엔드
        "http://1.236.171.160:3000",  # 대체 포트
        # 프로덕션 도메인 추가
        # "https://yourdomain.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # 모든 HTTP 메서드 허용
    allow_headers=["*"],  # 모든 헤더 허용
)

# static 디렉토리 마운트
app.mount("/static", StaticFiles(directory="static"), name="static")

# 라우터 등록
app.include_router(sessions_router)
app.include_router(rag_router.router)
register_routers(app)

# ============================================
# 🎯 동시 세션 관리
# ============================================
# 세션별 파이프라인 인스턴스 관리
active_sessions: Dict[str, STTPipeline] = {}


@app.websocket("/ws/stt")
async def websocket_endpoint(websocket: WebSocket):
    """
    실시간 STT WebSocket 엔드포인트

    동시 세션 지원:
    - 각 WebSocket 연결마다 독립된 STTPipeline 인스턴스 생성
    - 세션 종료 시 자동 정리
    """
    # 1) 반드시 수락
    await websocket.accept()

    # 2) 세션별 파이프라인 생성
    pipeline = STTPipeline()
    session_id = None

    # 3) 쿼리 파라미터/상태에서 board_id, user_id, sid 추출
    try:
        qp = websocket.query_params or {}
        raw_board_id = qp.get("board_id")
        board_id = int(raw_board_id) if raw_board_id and str(raw_board_id).isdigit() else None
    except Exception:
        board_id = None

    # user_id: 인증 미들웨어가 세팅했다면 우선 사용, 없으면 쿼리에서 시도
    state_user_id = getattr(getattr(websocket, "state", None), "user_id", None)
    try:
        raw_user_id = (qp.get("user_id") if qp else None)
        user_id = (
            int(state_user_id)
            if state_user_id is not None
            else (int(raw_user_id) if raw_user_id and str(raw_user_id).isdigit() else None)
        )
    except Exception:
        user_id = state_user_id if state_user_id is not None else None

    sid = (qp.get("sid") if qp else None)  # 선택값: 없으면 파이프라인에서 생성

    if board_id is None:
        # 프론트가 board_id 없이 붙으면 나중에 PG 적재/요약에서 FK 문제가 나므로 경고
        logger.error("❌ board_id is required but missing")
        # 정책상 연결을 유지하려면 그대로 두고, 필수면 아래 두 줄 주석 해제
        # await websocket.close(code=4400, reason="board_id required")
        # return
    else:
        logger.info(f"📋 WS connected with board_id={board_id}, user_id={user_id}, sid={sid}")

    # begin_session 시그니처를 아직 바꾸지 않았다면, 파이프라인에 먼저 실어둔다.
    # (다음 단계에서 begin_session에서 이 값들을 사용하도록 변경 예정)
    pipeline.pre_board_id = board_id
    pipeline.pre_user_id = user_id
    pipeline.pre_sid = sid
    pipeline.pre_source = "manual"

    try:
        # 4) 세션 시작 (현재 시그니처 유지: begin_session(websocket))
        await pipeline.begin_session(websocket)
        session_id = pipeline.sid
        # 🔐 세션 "선 생성": FK 보장을 위해, 어떤 저장/요약 로직보다 먼저 DB에 기록
        #   - board_id/user_id는 위에서 파싱한 값 사용
        #   - started_at은 현재 UTC 시각으로 기록 (테이블이 naive timestamp 이므로 utcnow() 사용)
        try:
            if session_id is not None and board_id is not None and user_id is not None:
                ensure_session_saved(
                    sid=int(session_id),
                    board_id=int(board_id),
                    user_id=int(user_id),
                    started_at=datetime.utcnow(),
                )
        except Exception as e:
            logger.warning(f"ensure_session_saved failed sid={session_id}: {e}")

        # 활성 세션에 등록
        if session_id:
            active_sessions[session_id] = pipeline
            logger.info(f"✅ Session registered: {session_id} (total: {len(active_sessions)})")

        logger.info(f"✅ WebSocket connection opened: sid={session_id}")

        # 5) 오디오 수신 루프 (텍스트/핑 프레임도 안전 처리)
        while True:
            msg = await websocket.receive()
            mtype = msg.get("type")
            if mtype == "websocket.receive":
                if msg.get("bytes"):
                    await pipeline.feed(msg["bytes"])
                # 선택: 텍스트 제어 프레임을 사용할 계획이면 여기서 처리 가능
                # elif msg.get("text") == "__END__":
                #     break
            elif mtype == "websocket.disconnect":
                break

    except WebSocketDisconnect:
        logger.info(f"🔌 Client disconnected: sid={session_id}")

    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)

    finally:
        try:
            # === 종료 시 순서 ===
            # ✅ 세션 종료 (파이널라이즈/플러시/저장/인제스트 모두 파이프라인에서 1회 처리)
            try:
                # WebSocket이 이미 끊긴 경우 ws를 None으로 설정
                if websocket.application_state != WebSocketState.CONNECTED:
                    pipeline.ws = None

                # 세션 종료 (diarization은 별도 실행하지 않음)
                await pipeline.end_session(run_diarization=False)
                logger.info(f"✅ Session ended: sid={session_id}")
            except Exception as e:
                logger.warning(f"⚠️ end_session failed: {e}")

            # D. 활성 세션에서 제거
            if session_id and session_id in active_sessions:
                del active_sessions[session_id]
                logger.info(f"✅ Session unregistered: {session_id} (remaining: {len(active_sessions)})")

            # E. WebSocket 닫기
            try:
                if websocket.application_state == WebSocketState.CONNECTED:
                    await websocket.close()
            except Exception:
                pass

            logger.info(f"🔌 WebSocket connection closed: sid={session_id}")

        except Exception as e:
            logger.error(f"❌ Cleanup error: {e}")



# === 수동 저장 API (옵션) ===
@app.post("/save-audio/{session_id}")
async def save_audio(session_id: str):
    """
    특정 세션의 오디오를 수동으로 저장
    
    Args:
        session_id: 세션 ID
        
    Returns:
        Dict: 저장 결과
    """
    if session_id not in active_sessions:
        return {"status": "error", "message": f"Session not found: {session_id}"}
    
    pipeline = active_sessions[session_id]
    result = await pipeline.save_raw_audio_async()
    
    if result:
        return {"status": "ok", **result}
    return {"status": "error", "message": "No audio data"}


# === 활성 세션 목록 API ===
@app.get("/sessions/active")
async def get_active_sessions():
    """
    현재 활성화된 세션 목록 조회
    
    Returns:
        Dict: 활성 세션 정보
    """
    sessions_info = []
    
    for sid, pipeline in active_sessions.items():
        sessions_info.append({
            "sid": sid,
            "active": pipeline.session_active,
            "start_time": pipeline.session_start_ts,
            "audio_buffer_size": len(pipeline.raw_audio_buffer),
            "paragraph_count": len(pipeline.paragraph_buffer),
        })
    
    return {
        "total": len(active_sessions),
        "sessions": sessions_info
    }


# === 헬스 체크 API ===
@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {"message": "FastAPI STT Server is running"}


@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {
        "status": "ok",
        "active_sessions": len(active_sessions),
        "redis": "connected" if await get_redis() else "disconnected",
    }


# ============================================
# 🚀 애플리케이션 라이프사이클
# ============================================

@app.on_event("startup")
async def startup_event():
    """애플리케이션 시작 이벤트"""
    logger.info("🚀 Starting application...")
    
    # ✅ Redis 연결 (비동기)
    try:
        await get_redis()
        logger.info("✅ Redis connected")
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
    
    # ✅ 초기 데이터 시드
    db = SessionLocal()
    try:
        seed_plans(db)
        logger.info("✅ Database seeded")
    except Exception as e:
        logger.error(f"❌ Database seed failed: {e}")
    finally:
        db.close()
    
    # ✅ 스케줄러 시작
    try:
        start_scheduler()
        logger.info("✅ Scheduler started")
    except Exception as e:
        logger.error(f"❌ Scheduler start failed: {e}")
    
    # (선택) 서버 기동 직후 1회 갱신 실행
    try:
        await run_renew_once()
        logger.info("✅ Initial renewal completed")
    except Exception as e:
        logger.warning(f"⚠️ Initial renewal failed: {e}")
    
    # 만료된 사용자 차단 해제
    try:
        unban_expired_users()
        logger.info("✅ Expired users unbanned")
    except Exception as e:
        logger.warning(f"⚠️ Unban failed: {e}")
    
    logger.info("🎉 Application startup completed")

    # =============================================
    # 🔥 서버 절대 꺼지지 않게 무한 태스크 추가
    # =============================================
    async def _keep_server_alive():
        """이 태스크가 살아있으면 이벤트 루프 종료 안 됨 → 서버 안 꺼짐"""
        while True:
            logger.info("❤️ 서버 살아있음... (절대 안 꺼짐)")
            await asyncio.sleep(30)  # 30초마다 로그 (부하 거의 없음)

    # 백그라운드에서 실행
    asyncio.create_task(_keep_server_alive())
    logger.info("🛡️ Keep-alive 태스크 시작됨 → 서버 영원히 유지")


@app.on_event("shutdown")
async def shutdown_event():
    """애플리케이션 종료 이벤트"""
    logger.info("🛑 Shutting down application...")
    
    # ✅ 모든 활성 세션 종료
    if active_sessions:
        logger.info(f"⚠️ Closing {len(active_sessions)} active sessions...")
        
        for sid, pipeline in list(active_sessions.items()):
            try:
                # 🔐 FK 보장을 위해 종료 직전에도 방어적으로 세션 선생성
                try:
                    from datetime import datetime
                    from backend.app.util.session_repo import ensure_session_saved
                    if getattr(pipeline, "board_id", None) is not None and getattr(pipeline, "user_id", None) is not None:
                        ensure_session_saved(
                            sid=int(sid),
                            board_id=int(pipeline.board_id),
                            user_id=int(pipeline.user_id),
                            started_at=pipeline.session_start_ts or datetime.utcnow(),
                        )
                except Exception as e:
                    logger.warning(f"[shutdown] ensure_session_saved failed sid={sid}: {e}")

                await pipeline.end_session(run_diarization=False)
                logger.info(f"✅ Session closed: {sid}")
            except Exception as e:
                logger.error(f"❌ Failed to close session {sid}: {e}")
        
        active_sessions.clear()
    
    # ✅ Redis 연결 종료
    try:
        await close_redis()
        logger.info("✅ Redis connection closed")
    except Exception as e:
        logger.error(f"❌ Redis close failed: {e}")
    
    logger.info("👋 Application shutdown completed")