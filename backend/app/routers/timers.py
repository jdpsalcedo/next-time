from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, insert
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Activity, Timer, timer_activities
from ..schemas import TimerCreate, TimerRead, TimerUpdate

router = APIRouter(prefix="/api/timers", tags=["timers"])


def _validate_activities(db: Session, activity_ids: list[int]) -> None:
    if not activity_ids:
        return
    found = {a.id for a in db.query(Activity.id).filter(Activity.id.in_(activity_ids)).all()}
    missing = [aid for aid in activity_ids if aid not in found]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"unknown activity ids: {missing}")


def _set_timer_activities(db: Session, timer_id: int, activity_ids: list[int]) -> None:
    db.execute(delete(timer_activities).where(timer_activities.c.timer_id == timer_id))
    if activity_ids:
        db.execute(
            insert(timer_activities),
            [
                {"timer_id": timer_id, "activity_id": aid, "position": idx}
                for idx, aid in enumerate(activity_ids)
            ],
        )


@router.get("", response_model=list[TimerRead])
def list_timers(db: Session = Depends(get_db)):
    return db.query(Timer).order_by(Timer.id.desc()).all()


@router.post("", response_model=TimerRead, status_code=status.HTTP_201_CREATED)
def create_timer(payload: TimerCreate, db: Session = Depends(get_db)):
    _validate_activities(db, payload.activity_ids)
    timer = Timer(title=payload.title, description=payload.description)
    db.add(timer)
    db.flush()
    _set_timer_activities(db, timer.id, payload.activity_ids)
    db.commit()
    db.refresh(timer)
    return timer


@router.get("/{timer_id}", response_model=TimerRead)
def get_timer(timer_id: int, db: Session = Depends(get_db)):
    timer = db.get(Timer, timer_id)
    if not timer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "timer not found")
    return timer


@router.patch("/{timer_id}", response_model=TimerRead)
def update_timer(timer_id: int, payload: TimerUpdate, db: Session = Depends(get_db)):
    timer = db.get(Timer, timer_id)
    if not timer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "timer not found")
    if payload.title is not None:
        timer.title = payload.title
    if payload.description is not None:
        timer.description = payload.description
    if payload.activity_ids is not None:
        _validate_activities(db, payload.activity_ids)
        _set_timer_activities(db, timer.id, payload.activity_ids)
    db.commit()
    db.refresh(timer)
    return timer


@router.delete("/{timer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timer(timer_id: int, db: Session = Depends(get_db)):
    timer = db.get(Timer, timer_id)
    if not timer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "timer not found")
    db.delete(timer)
    db.commit()
