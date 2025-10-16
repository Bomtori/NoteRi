import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# .env 로드 (env.py와 동일한 POSTGRES_* 값을 씀)
BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # backend/
ENV_PATH = os.path.join(BASE_DIR, ".env")
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)

DB_URL = (
    f"postgresql+psycopg2://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
    f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
)

engine = create_engine(DB_URL, isolation_level="AUTOCOMMIT")

with engine.connect() as conn:
    conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE;"))
    conn.execute(text("CREATE SCHEMA public;"))
    conn.execute(text("GRANT ALL ON SCHEMA public TO postgres;"))
    conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
    print("✅ Reset schema 'public' completed.")
