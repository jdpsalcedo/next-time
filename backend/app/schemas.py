from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TagBase(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    color: str = Field(default="#888888", max_length=16)


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    color: str | None = Field(default=None, max_length=16)


class TagRead(TagBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ActivityBase(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=1024)
    duration_seconds: int = Field(ge=0)
    liked: bool = False
    is_inline: bool = False


class ActivityCreate(ActivityBase):
    tag_ids: list[int] = Field(default_factory=list)


class ActivityUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=1024)
    duration_seconds: int | None = Field(default=None, ge=0)
    tag_ids: list[int] | None = None
    liked: bool | None = None
    is_inline: bool | None = None


class ActivityRead(ActivityBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tags: list[TagRead] = []


class TimerActivityIn(BaseModel):
    activity_id: int | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    inline_title: str | None = Field(default=None, min_length=1, max_length=128)
    inline_description: str | None = Field(default="", max_length=1024)

    @model_validator(mode="after")
    def _has_ref_or_inline(self):
        if self.activity_id is None and not self.inline_title:
            raise ValueError("Either activity_id or inline_title must be provided")
        return self


class TimerSplitOut(BaseModel):
    id: int
    type: Literal["ref", "inline"]
    activity_id: int | None = None
    title: str
    description: str = ""
    duration_seconds: int = 0
    liked: bool = False
    tags: list[TagRead] = []


class TimerBase(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=1024)


class TimerCreate(TimerBase):
    activities: list[TimerActivityIn] = Field(default_factory=list)


class TimerUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=1024)
    activities: list[TimerActivityIn] | None = None


class TimerRead(TimerBase):
    id: int
    activities: list[TimerSplitOut] = []


class SettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    dark_mode: bool
    reverse_countdown: bool
    dummy_data: bool
    static_mode: bool


class SettingsUpdate(BaseModel):
    dark_mode: bool | None = None
    reverse_countdown: bool | None = None
    dummy_data: bool | None = None
    static_mode: bool | None = None
