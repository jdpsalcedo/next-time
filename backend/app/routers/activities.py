from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Activity, Tag
from ..schemas import ActivityCreate, ActivityRead, ActivityUpdate

router = APIRouter(prefix="/api/activities", tags=["activities"])


def _load_tags(db: Session, tag_ids: list[int]) -> list[Tag]:
    if not tag_ids:
        return []
    tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
    found_ids = {t.id for t in tags}
    missing = [tid for tid in tag_ids if tid not in found_ids]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"unknown tag ids: {missing}")
    return tags


@router.get("", response_model=list[ActivityRead])
def list_activities(db: Session = Depends(get_db)):
    return db.query(Activity).order_by(Activity.id.desc()).all()


@router.post("", response_model=ActivityRead, status_code=status.HTTP_201_CREATED)
def create_activity(payload: ActivityCreate, db: Session = Depends(get_db)):
    activity = Activity(
        title=payload.title,
        description=payload.description,
        duration_seconds=payload.duration_seconds,
        tags=_load_tags(db, payload.tag_ids),
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.get("/{activity_id}", response_model=ActivityRead)
def get_activity(activity_id: int, db: Session = Depends(get_db)):
    activity = db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "activity not found")
    return activity


@router.patch("/{activity_id}", response_model=ActivityRead)
def update_activity(activity_id: int, payload: ActivityUpdate, db: Session = Depends(get_db)):
    activity = db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "activity not found")
    if payload.title is not None:
        activity.title = payload.title
    if payload.description is not None:
        activity.description = payload.description
    if payload.duration_seconds is not None:
        activity.duration_seconds = payload.duration_seconds
    if payload.tag_ids is not None:
        activity.tags = _load_tags(db, payload.tag_ids)
    db.commit()
    db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(activity_id: int, db: Session = Depends(get_db)):
    activity = db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "activity not found")
    db.delete(activity)
    db.commit()
