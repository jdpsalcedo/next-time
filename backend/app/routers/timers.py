from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Activity, Timer, TimerSplit
from ..schemas import TagRead, TimerActivityIn, TimerCreate, TimerRead, TimerUpdate

router = APIRouter(prefix="/api/timers", tags=["timers"])


def _validate_activity_ids(db: Session, items: list[TimerActivityIn]) -> None:
    ids = [it.activity_id for it in items if it.activity_id is not None]
    if not ids:
        return
    found = {a.id for a in db.query(Activity.id).filter(Activity.id.in_(ids)).all()}
    missing = [aid for aid in ids if aid not in found]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"unknown activity ids: {missing}")


def _build_split(item: TimerActivityIn, position: int) -> TimerSplit:
    if item.activity_id is not None:
        return TimerSplit(
            position=position,
            activity_id=item.activity_id,
            duration_seconds_override=item.duration_seconds,
        )
    return TimerSplit(
        position=position,
        inline_title=item.inline_title,
        inline_description=item.inline_description or "",
        inline_duration_seconds=item.duration_seconds or 0,
    )


def _serialize_split(split: TimerSplit) -> dict:
    if split.activity_id is not None and split.activity is not None:
        a = split.activity
        effective = (
            split.duration_seconds_override
            if split.duration_seconds_override is not None
            else a.duration_seconds
        )
        return {
            "id": split.id,
            "type": "ref",
            "activity_id": a.id,
            "title": a.title,
            "description": a.description,
            "duration_seconds": effective,
            "liked": a.liked,
            "tags": [TagRead.model_validate(t).model_dump() for t in a.tags],
        }
    return {
        "id": split.id,
        "type": "inline",
        "activity_id": None,
        "title": split.inline_title or "",
        "description": split.inline_description or "",
        "duration_seconds": split.inline_duration_seconds or 0,
        "liked": False,
        "tags": [],
    }


def _serialize_timer(timer: Timer) -> dict:
    return {
        "id": timer.id,
        "title": timer.title,
        "description": timer.description,
        "activities": [_serialize_split(s) for s in timer.splits],
    }


def _replace_splits(timer: Timer, items: list[TimerActivityIn]) -> None:
    timer.splits = [_build_split(it, idx) for idx, it in enumerate(items)]


@router.get("", response_model=list[TimerRead])
def list_timers(db: Session = Depends(get_db)):
    timers = db.query(Timer).order_by(Timer.id.desc()).all()
    return [_serialize_timer(t) for t in timers]


@router.post("", response_model=TimerRead, status_code=status.HTTP_201_CREATED)
def create_timer(payload: TimerCreate, db: Session = Depends(get_db)):
    _validate_activity_ids(db, payload.activities)
    timer = Timer(title=payload.title, description=payload.description)
    _replace_splits(timer, payload.activities)
    db.add(timer)
    db.commit()
    db.refresh(timer)
    return _serialize_timer(timer)


@router.get("/{timer_id}", response_model=TimerRead)
def get_timer(timer_id: int, db: Session = Depends(get_db)):
    timer = db.get(Timer, timer_id)
    if not timer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "timer not found")
    return _serialize_timer(timer)


@router.patch("/{timer_id}", response_model=TimerRead)
def update_timer(timer_id: int, payload: TimerUpdate, db: Session = Depends(get_db)):
    timer = db.get(Timer, timer_id)
    if not timer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "timer not found")
    if payload.title is not None:
        timer.title = payload.title
    if payload.description is not None:
        timer.description = payload.description
    if payload.activities is not None:
        _validate_activity_ids(db, payload.activities)
        _replace_splits(timer, payload.activities)
    db.commit()
    db.refresh(timer)
    return _serialize_timer(timer)


@router.delete("/{timer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timer(timer_id: int, db: Session = Depends(get_db)):
    timer = db.get(Timer, timer_id)
    if not timer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "timer not found")
    db.delete(timer)
    db.commit()
