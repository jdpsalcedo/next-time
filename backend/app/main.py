from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .database import Base, engine
from .routers import activities, settings, tags, timers


def _migrate() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table in ("tags", "activities", "timers"):
            if table not in existing_tables:
                continue
            cols = {c["name"] for c in inspector.get_columns(table)}
            if "is_seed" not in cols:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN is_seed BOOLEAN NOT NULL DEFAULT 0"))


_migrate()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="next-time API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tags.router)
app.include_router(activities.router)
app.include_router(timers.router)
app.include_router(settings.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
