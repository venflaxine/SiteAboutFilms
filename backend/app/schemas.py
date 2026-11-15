from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional


class MovieCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=200,
        description="Название фильма"
    )

    year: int = Field(
        ge=1888,
        le=2100,
        description="Год выпуска"
    )

    description: str = Field(
        default="",
        max_length=2000
    )

    genres: list[str] = Field(
        default_factory=list
    )

    watched: bool = False

    rating: Optional[int] = Field(
        default=None,
        ge=1,
        le=10
    )

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
