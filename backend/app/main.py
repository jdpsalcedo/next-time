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
        if "activities" in existing_tables:
            cols = {c["name"] for c in inspector.get_columns("activities")}
            if "liked" not in cols:
                conn.execute(text("ALTER TABLE activities ADD COLUMN liked BOOLEAN NOT NULL DEFAULT 0"))
            if "is_inline" not in cols:
                conn.execute(text("ALTER TABLE activities ADD COLUMN is_inline BOOLEAN NOT NULL DEFAULT 0"))
        if "timer_activities" in existing_tables:
            cols = {c["name"] for c in inspector.get_columns("timer_activities")}
            if "duration_seconds_override" not in cols:
                conn.execute(text("ALTER TABLE timer_activities ADD COLUMN duration_seconds_override INTEGER"))
                cols.add("duration_seconds_override")
            needs_rebuild = (
                "id" not in cols
                or "inline_title" not in cols
                or "inline_description" not in cols
                or "inline_duration_seconds" not in cols
            )
            if needs_rebuild:
                conn.execute(text("PRAGMA foreign_keys=OFF"))
                conn.execute(
                    text(
                        """
                        CREATE TABLE timer_activities_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            timer_id INTEGER NOT NULL REFERENCES timers(id) ON DELETE CASCADE,
                            position INTEGER NOT NULL DEFAULT 0,
                            activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
                            duration_seconds_override INTEGER,
                            inline_title VARCHAR(128),
                            inline_description VARCHAR(1024),
                            inline_duration_seconds INTEGER
                        )
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        INSERT INTO timer_activities_new (timer_id, position, activity_id, duration_seconds_override)
                        SELECT timer_id, position, activity_id, duration_seconds_override
                        FROM timer_activities
                        """
                    )
                )
                conn.execute(text("DROP TABLE timer_activities"))
                conn.execute(text("ALTER TABLE timer_activities_new RENAME TO timer_activities"))
                conn.execute(text("PRAGMA foreign_keys=ON"))


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
