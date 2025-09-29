from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
import os
from dotenv import load_dotenv

# ✅ DB와 모델 불러오기
# from app.db import Base
from app.model import Base # 모든 모델 import (여러 개면 다 추가)

target_metadata = Base.metadata
# 환경 변수 로드
load_dotenv()

# 이 부분은 alembic.ini의 config 객체
config = context.config

# .env에서 DB URL 구성
DB_URL = (
    f"postgresql+psycopg2://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
    f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
)

# alembic.ini의 sqlalchemy.url 을 덮어쓰기
config.set_main_option("sqlalchemy.url", DB_URL)

# 로깅 설정
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ✅ 자동 생성 마이그레이션에서 사용할 메타데이터
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Offline 모드"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Online 모드"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
