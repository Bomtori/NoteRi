# backend/app/seed/load_all_csv.py
import os, csv
from typing import List, Dict, Any
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, MetaData, Table
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import sessionmaker

# -------------------------------------------------
# 0) 환경 로드 (backend/.env의 POSTGRES_* 사용)
# -------------------------------------------------
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENV_PATH = os.path.join(BASE_DIR, ".env")
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)

DB_URL = (
    f"postgresql+psycopg2://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
    f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
)

engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)

# -------------------------------------------------
# 1) CSV 파일 → 테이블 이름 매핑 & 로딩 순서
#    (현재 DB에 보이는 테이블 기준으로 정렬)
# -------------------------------------------------
# FK 상위 → 하위 순서 추정
PREFERRED_ORDER = [
    # 1단계 (부모 먼저)
    "plans",
    "users",
    "subscriptions",
    # 2단계 (자식)
    "payments",
    "recording_usage",

    # 3단계 (폴더 계열)
    "folders",
    "boards",
    "memos",

    # 4단계 (세션/오디오 → 결과 → 전사 → 요약)
    "audio_data",
    "recording_sessions",
    "recording_results",
    "transcripts",
    "summaries",

    # 5단계 (독립)
    "notifications",
    "ai_gemini",
    "notion_auth",  # 이번 데이터셋엔 없다고 했으니 스킵됨
]


SEED_DIR = os.path.join(BASE_DIR, "app", "seed")

def list_seed_csvs() -> List[str]:
    files = []
    for name in os.listdir(SEED_DIR):
        low = name.lower()
        if low.startswith("notelee_dummy_") and low.endswith(".csv"):
            files.append(os.path.join(SEED_DIR, name))
    return files

def table_name_from_filename(path: str) -> str:
    base = os.path.basename(path)
    name = base.rsplit(".", 1)[0]
    return name.replace("notelee_dummy_", "", 1)

def sort_by_preferred_order(csv_paths: List[str]) -> List[str]:
    def key_func(p: str):
        t = table_name_from_filename(p)
        return (PREFERRED_ORDER.index(t) if t in PREFERRED_ORDER else 10_000, t)
    return sorted(csv_paths, key=key_func)

# -------------------------------------------------
# 2) 값 정규화 (빈 문자열/NULL → None, bool/숫자/날짜 캐스팅)
# -------------------------------------------------
def normalize_value(v: str) -> Any:
    if v is None:
        return None
    v2 = v.strip()
    if v2 == "" or v2.lower() in ("null", "none", "nan"):
        return None
    low = v2.lower()
    if low in ("true", "false"):
        return low == "true"
    # int
    if (low.isdigit()) or (low.startswith("-") and low[1:].isdigit()):
        try:
            return int(low)
        except Exception:
            pass
    # float
    try:
        if any(ch in v2 for ch in (".", "e", "E")):
            return float(v2)
    except Exception:
        pass
    # datetime (필요 포맷 추가 가능)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d"):
        try:
            return datetime.strptime(v2, fmt)
        except Exception:
            pass
    return v2

def read_csv_rows(path: str) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            fixed = {k: normalize_value(v) for k, v in row.items()}
            rows.append(fixed)
        return rows

# -------------------------------------------------
# 3) 컬럼 검증 & 필터링 (CSV 헤더 ↔ 실제 테이블 컬럼)
# -------------------------------------------------
def filter_columns_for_table(table: Table, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    table_cols = set(c.name for c in table.columns)
    filtered = []
    for r in rows:
        # CSV에 있지만 테이블에 없는 컬럼은 제거
        filtered.append({k: v for k, v in r.items() if k in table_cols})
    return filtered

def warn_missing_required_columns(table: Table, sample_row: Dict[str, Any]):
    # NOT NULL이며 default 없는 컬럼인데 CSV에 없으면 경고
    missing = []
    row_keys = set(sample_row.keys())
    for c in table.columns:
        if (not c.nullable) and (c.default is None) and (c.server_default is None) and (c.name not in row_keys):
            # PK 자동증가(id) 등은 보통 server_default 또는 sequence가 있으니 건너뜀
            if not c.primary_key:
                missing.append(c.name)
    if missing:
        print(f"⚠️  '{table.name}' CSV에 필수 컬럼이 빠졌을 수 있음 → {missing}")

# -------------------------------------------------
# 4) UPSERT (중복 무시)
# -------------------------------------------------
def bulk_upsert_table(table: Table, rows: List[Dict[str, Any]], session) -> int:
    if not rows:
        return 0
    rows = filter_columns_for_table(table, rows)
    if not rows:
        return 0
    warn_missing_required_columns(table, rows[0])
    stmt = pg_insert(table).values(rows).on_conflict_do_nothing()
    result = session.execute(stmt)
    return result.rowcount or 0

# -------------------------------------------------
# 5) 메인
# -------------------------------------------------
def main():
    meta = MetaData()
    meta.reflect(bind=engine)

    csv_paths = sort_by_preferred_order(list_seed_csvs())
    if not csv_paths:
        print("⚠️ seed CSV 파일을 찾지 못했습니다. (경로: app/seed)")
        return

    total_inserted = 0
    with SessionLocal() as db:
        for path in csv_paths:
            table_name = table_name_from_filename(path)
            if table_name not in meta.tables:
                print(f"⛔ skip: DB에 테이블 '{table_name}'이 없어 {os.path.basename(path)} 로딩을 건너뜀")
                continue

            table = meta.tables[table_name]
            rows = read_csv_rows(path)
            if not rows:
                print(f"⚠️ empty: {os.path.basename(path)}")
                continue

            try:
                inserted = bulk_upsert_table(table, rows, db)
                db.commit()
                print(f"✅ {table_name}: {inserted} rows inserted from {os.path.basename(path)}")
                total_inserted += (inserted or 0)
            except Exception as e:
                db.rollback()
                print(f"❌ {table_name}: {os.path.basename(path)} 로딩 실패 → {e}")

    print(f"🎉 done. total inserted: {total_inserted}")

if __name__ == "__main__":
    main()
