from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'ae68e670d2ca'
down_revision = '576c813e2222'
branch_labels = None
depends_on = None

def _has_column(insp: sa.engine.reflection.Inspector, table: str, col: str) -> bool:
    return any(c["name"] == col for c in insp.get_columns(table))


def upgrade() -> None:
    # 0) ENUM 안전 생성
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plantype') THEN
            CREATE TYPE plantype AS ENUM ('free','pro','enterprise');
        END IF;
    END $$;
    """)

    plan_type = postgresql.ENUM(name="plantype", create_type=False)

    # 1) plans
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", plan_type, nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("duration_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("allocated_minutes", sa.Integer(), nullable=False, server_default="300"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=True),
        sa.UniqueConstraint("name", name="uq_plans_name"),
    )

    # 2) payments
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("subscription_id", sa.Integer(), nullable=True),
        sa.Column("order_id", sa.String(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("method", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("transaction_key", sa.String(), nullable=True),
        sa.Column("approved_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("canceled_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("fail_reason", sa.Text(), nullable=True),
        sa.Column("raw_response", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="fk_payments_user_id_users"),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"], ondelete="CASCADE", name="fk_payments_subscription_id_subscriptions"),
        sa.UniqueConstraint("order_id", name="uq_payments_order_id"),
        sa.UniqueConstraint("transaction_key", name="uq_payments_transaction_key"),
    )

    # 3) subscriptions
    op.add_column("subscriptions", sa.Column("plan_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_subscriptions_plan_id_plans",
        source_table="subscriptions",
        referent_table="plans",
        local_cols=["plan_id"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    # ✅ 컬럼 존재 여부는 Inspector로 확인하고, drop은 batch_op에서 수행
    bind = op.get_bind()
    insp = sa.inspect(bind)

    with op.batch_alter_table("subscriptions") as batch_op:
        if _has_column(insp, "subscriptions", "payment_info"):
            batch_op.drop_column("payment_info")
        if _has_column(insp, "subscriptions", "plan"):
            batch_op.drop_column("plan")


def downgrade() -> None:
    # 1) subscriptions FK/컬럼 되돌리기
    op.drop_constraint("fk_subscriptions_plan_id_plans", "subscriptions", type_="foreignkey")

    bind = op.get_bind()
    insp = sa.inspect(bind)

    with op.batch_alter_table("subscriptions") as batch_op:
        if _has_column(insp, "subscriptions", "plan_id"):
            batch_op.drop_column("plan_id")
        # (필요시 옛 컬럼 복원 로직 추가 가능)

    # 2) payments, plans 제거
    op.drop_table("payments")
    op.drop_table("plans")

    # (선택) 더 이상 참조가 없다면 ENUM 제거
    # op.execute("DROP TYPE IF EXISTS plantype;")
