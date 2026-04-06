import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine, Base, SessionLocal
from models import User
from routers import users, meals, food_log, training, progress

Base.metadata.create_all(bind=engine)


def migrate_db():
    """Add columns introduced after initial schema creation. Safe to re-run."""
    migrations = [
        "ALTER TABLE users ADD COLUMN nutrition_settings TEXT DEFAULT '{}'",
        "ALTER TABLE users ADD COLUMN username TEXT",
        "ALTER TABLE daily_logs ADD COLUMN training_notes TEXT DEFAULT ''",
        "ALTER TABLE food_entries ADD COLUMN meal_category TEXT DEFAULT 'breakfast'",
        "ALTER TABLE food_entries ADD COLUMN servings REAL DEFAULT 1.0",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists


def seed_if_empty():
    """Run seed data if no users exist (e.g. fresh Railway deploy)."""
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            import seed
            seed.seed()
    finally:
        db.close()


migrate_db()
seed_if_empty()

app = FastAPI(title="Ironman Nutrition Tracker", version="1.0.0")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://ironman-nutrition-production-e844.up.railway.app",
    "https://ironman-nutrition-production-c05e.up.railway.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(meals.router)
app.include_router(food_log.router)
app.include_router(training.router)
app.include_router(progress.router)


@app.get("/")
def root():
    return {"status": "ok", "app": "Ironman Nutrition Tracker"}


@app.get("/health")
def health():
    return {"status": "ok"}
