from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Settings
from ..schemas import SettingsRead, SettingsUpdate
from ..seed import clear_dummy_data, seed_dummy_data

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_or_create(db: Session) -> Settings:
    settings = db.get(Settings, 1)
    if settings is None:
        settings = Settings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=SettingsRead)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.patch("", response_model=SettingsRead)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    settings = _get_or_create(db)
    prev_dummy = settings.dummy_data

    if payload.dark_mode is not None:
        settings.dark_mode = payload.dark_mode
    if payload.reverse_countdown is not None:
        settings.reverse_countdown = payload.reverse_countdown
    if payload.static_mode is not None:
        settings.static_mode = payload.static_mode
    if payload.dummy_data is not None:
        settings.dummy_data = payload.dummy_data

    db.commit()
    db.refresh(settings)

    if payload.dummy_data is not None and payload.dummy_data != prev_dummy:
        if payload.dummy_data:
            seed_dummy_data(db)
        else:
            clear_dummy_data(db)

    return settings
