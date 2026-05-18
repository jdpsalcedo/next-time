from pydantic import BaseModel, ConfigDict, Field


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


class ActivityCreate(ActivityBase):
    tag_ids: list[int] = Field(default_factory=list)


class ActivityUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=1024)
    duration_seconds: int | None = Field(default=None, ge=0)
    tag_ids: list[int] | None = None


class ActivityRead(ActivityBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tags: list[TagRead] = []


class TimerBase(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=1024)


class TimerCreate(TimerBase):
    activity_ids: list[int] = Field(default_factory=list)


class TimerUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=1024)
    activity_ids: list[int] | None = None


class TimerRead(TimerBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    activities: list[ActivityRead] = []


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
