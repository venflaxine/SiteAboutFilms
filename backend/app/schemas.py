
from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional


class MovieCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    year: int = Field(ge=1888, le=2100)
    description: str = Field(default="", max_length=2000)
    genres: list[str] = Field(default_factory=list)

    watched: bool = False

    rating: Optional[int] = Field(
        default=None,
        ge=1,
        le=10
    )

    tmdb_id: Optional[int] = Field(default=None, gt=0)
    poster_path: Optional[str] = Field(default=None, max_length=500)
    tmdb_rating: Optional[float] = Field(default=None, ge=0, le=10)
    original_title: Optional[str] = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def validate_rating(self):
        if not self.watched and self.rating is not None:
            raise ValueError(
                "Нельзя выставить оценку непросмотренному фильму"
            )
        return self


class MovieUpdate(MovieCreate):
    pass


class MovieResponse(MovieCreate):
    id: str = Field(alias="_id")

    model_config = ConfigDict(
        populate_by_name=True
    )


class MovieStatusUpdate(BaseModel):
    watched: bool

    rating: Optional[int] = Field(
        default=None,
        ge=1,
        le=10
    )

    @model_validator(mode="after")
    def validate_rating(self):
        if not self.watched and self.rating is not None:
            raise ValueError(
                "У непросмотренного фильма не может быть оценки"
            )
        return self
