from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


activity_tags = Table(
    "activity_tags",
    Base.metadata,
    Column("activity_id", ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#888888")
    is_seed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    activities: Mapped[list["Activity"]] = relationship(
        secondary=activity_tags, back_populates="tags"
    )


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    liked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_inline: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_seed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    tags: Mapped[list[Tag]] = relationship(
        secondary=activity_tags, back_populates="activities"
    )


class TimerSplit(Base):
    __tablename__ = "timer_activities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    timer_id: Mapped[int] = mapped_column(
        ForeignKey("timers.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    activity_id: Mapped[int | None] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), nullable=True
    )
    duration_seconds_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    inline_title: Mapped[str | None] = mapped_column(String(128), nullable=True)
    inline_description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    inline_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    activity: Mapped[Activity | None] = relationship("Activity")
    timer: Mapped["Timer"] = relationship(back_populates="splits")


class Timer(Base):
    __tablename__ = "timers"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    is_seed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    splits: Mapped[list[TimerSplit]] = relationship(
        back_populates="timer",
        order_by=TimerSplit.position,
        cascade="all, delete-orphan",
    )
