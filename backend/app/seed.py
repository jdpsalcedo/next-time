from sqlalchemy.orm import Session

from .models import Activity, Tag, Timer, timer_activities


SEED_TAGS = [
    {"name": "cardio", "color": "#ef4444"},
    {"name": "strength", "color": "#3b82f6"},
    {"name": "stretch", "color": "#22c55e"},
]

SEED_ACTIVITIES = [
    {
        "title": "Jumping jacks",
        "description": "Warm-up",
        "duration_seconds": 30,
        "tag_names": ["cardio"],
    },
    {
        "title": "Pushups",
        "description": "20 reps",
        "duration_seconds": 60,
        "tag_names": ["strength"],
    },
    {
        "title": "Hamstring stretch",
        "description": "Hold per side",
        "duration_seconds": 45,
        "tag_names": ["stretch"],
    },
]

SEED_TIMERS = [
    {
        "title": "Quick warm-up",
        "description": "3 short activities",
        "activity_titles": ["Jumping jacks", "Pushups", "Hamstring stretch"],
    },
]


def seed_dummy_data(db: Session) -> None:
    tag_by_name: dict[str, Tag] = {}
    for spec in SEED_TAGS:
        existing = db.query(Tag).filter(Tag.name == spec["name"], Tag.is_seed.is_(True)).first()
        if existing:
            tag_by_name[spec["name"]] = existing
            continue
        if db.query(Tag).filter(Tag.name == spec["name"]).first():
            continue
        tag = Tag(name=spec["name"], color=spec["color"], is_seed=True)
        db.add(tag)
        db.flush()
        tag_by_name[spec["name"]] = tag

    activity_by_title: dict[str, Activity] = {}
    for spec in SEED_ACTIVITIES:
        existing = (
            db.query(Activity)
            .filter(Activity.title == spec["title"], Activity.is_seed.is_(True))
            .first()
        )
        if existing:
            activity_by_title[spec["title"]] = existing
            continue
        activity = Activity(
            title=spec["title"],
            description=spec["description"],
            duration_seconds=spec["duration_seconds"],
            is_seed=True,
            tags=[tag_by_name[n] for n in spec["tag_names"] if n in tag_by_name],
        )
        db.add(activity)
        db.flush()
        activity_by_title[spec["title"]] = activity

    for spec in SEED_TIMERS:
        existing = (
            db.query(Timer)
            .filter(Timer.title == spec["title"], Timer.is_seed.is_(True))
            .first()
        )
        if existing:
            continue
        timer = Timer(
            title=spec["title"],
            description=spec["description"],
            is_seed=True,
        )
        db.add(timer)
        db.flush()
        for pos, title in enumerate(spec["activity_titles"]):
            activity = activity_by_title.get(title)
            if activity is None:
                continue
            db.execute(
                timer_activities.insert().values(
                    timer_id=timer.id, activity_id=activity.id, position=pos
                )
            )

    db.commit()


def clear_dummy_data(db: Session) -> None:
    for timer in db.query(Timer).filter(Timer.is_seed.is_(True)).all():
        db.delete(timer)
    for activity in db.query(Activity).filter(Activity.is_seed.is_(True)).all():
        db.delete(activity)
    for tag in db.query(Tag).filter(Tag.is_seed.is_(True)).all():
        db.delete(tag)
    db.commit()
