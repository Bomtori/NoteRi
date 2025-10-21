# backend/app/seed/run.py
from backend.app.db import SessionLocal
from backend.app.seed.plan_seed import seed_plans

def main():
    db = SessionLocal()
    try:
        seed_plans(db)
        print("✅ Seeded default plans (free/pro/enterprise).")
    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
