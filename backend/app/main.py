from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import activities, tags, timers

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


@app.get("/api/health")
def health():
    return {"status": "ok"}
