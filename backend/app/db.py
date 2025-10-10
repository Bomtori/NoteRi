import os
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# --- .env 로딩: 여러 후보 경로를 순차 시도 ---
HERE = os.path.dirname(os.path.abspath(__file__))          # .../backend/app
BACKEND_DIR = os.path.dirname(HERE)                        # .../backend
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)                # .../test1 (uvicorn cwd)
CANDIDATES = [
    os.path.join(PROJECT_ROOT, ".env"),                    # test1/.env
    os.path.join(BACKEND_DIR, ".env"),                     # backend/.env  ✅ 너의 위치
    os.path.join(os.getcwd(), ".env"),                     # 현재 CWD
]

for p in CANDIDATES:
    if os.path.exists(p):
        load_dotenv(p, override=False)

def _env(*names: str, default: Optional[str] = None) -> Optional[str]:
    """여러 이름을 순서대로 조회(POSTGRES_* 우선, 없으면 DB_* 사용)."""
    for name in names:
        v = os.getenv(name)
        if v is not None and str(v).strip().lower() not in {"", "none", "null"}:
            return v
    return default

# ---- 환경변수 읽기 (POSTGRES_* 우선, DB_* fallback) ----
PG_USER = _env("POSTGRES_USER", "DB_USER")
PG_PASS = _env("POSTGRES_PASSWORD", "DB_PASSWORD")
PG_HOST = _env("POSTGRES_HOST", "DB_HOST", default="localhost")
PG_PORT = _env("POSTGRES_PORT", "DB_PORT")   # 비어 있을 수 있음
PG_DB   = _env("POSTGRES_DB", "DB_NAME")

# 필수값 체크(호스트/포트는 기본/생략 허용)
_missing = [k for k, v in {
    "POSTGRES_USER|DB_USER": PG_USER,
    "POSTGRES_PASSWORD|DB_PASSWORD": PG_PASS,
    "POSTGRES_DB|DB_NAME": PG_DB,
}.items() if not v]
if _missing:
    raise RuntimeError(
        "환경변수 누락: " + ", ".join(_missing) +
        "\n예시 (.env):\n"
        "POSTGRES_USER=kobo\nPOSTGRES_PASSWORD=1234\n"
        "POSTGRES_HOST=localhost\nPOSTGRES_PORT=5432\nPOSTGRES_DB=mydb"
    )

# 포트 파싱(없으면 None → URL에서 생략되어 기본 5432 사용)
pg_port_int: Optional[int] = None
if PG_PORT is not None:
    try:
        pg_port_int = int(PG_PORT)
    except ValueError:
        raise RuntimeError(f"POSTGRES_PORT/DB_PORT는 정수여야 합니다. 현재 값: {PG_PORT!r}")

DB_URL = URL.create(
    drivername="postgresql+psycopg2",
    username=PG_USER,
    password=PG_PASS,
    host=PG_HOST,
    port=pg_port_int,  # None이면 생략
    database=PG_DB,
)

engine = create_engine(DB_URL, echo=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
