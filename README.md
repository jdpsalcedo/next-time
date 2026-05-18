# next-time

Activity timer and tracker. Python (FastAPI + SQLite) backend, Vite + React frontend.

## Data model

- **Activity** — `title`, `description`, `duration_seconds`. Many-to-many with Tags and Timers.
- **Tag** — `name`, `color`. Survives activity deletion (only the join row is removed).
- **Timer** — `title`, `description`. Holds an ordered list of Activities. Activities survive timer deletion.

## Run it

Two processes. Open two terminals.

### Backend (port 8765)

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8765
```

API docs: <http://127.0.0.1:8765/docs>

### Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api/*` to the backend.

## Project layout

```
backend/
  app/
    main.py            FastAPI app + CORS + router wiring
    database.py        SQLAlchemy engine + session
    models.py          Tag, Activity, Timer + association tables
    schemas.py         Pydantic request/response models
    routers/           tags.py, activities.py, timers.py
frontend/
  src/
    App.jsx            Router shell (top tabs on desktop, bottom nav on mobile)
    api.js             fetch wrapper
    pages/             Home, Activities, Timers
    components/        TagChip, Modal
    styles.css         Theme + responsive layout (breakpoint at 640px)
```

## Mobile responsiveness

- Top tab bar collapses to a bottom nav under 640px.
- Cards, form rows, and KPI grid reflow to single-column on narrow viewports.
- Inputs sized for touch; modal scrolls within viewport.

## Notes

The SQLite file `backend/next_time.db` is created on first boot. Delete it to reset.
