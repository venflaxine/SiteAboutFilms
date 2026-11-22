import re
from contextlib import asynccontextmanager

from bson import ObjectId
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.database import movies_collection, check_database
from app.schemas import (
    MovieCreate,
    MovieUpdate,
    MovieStatusUpdate,
    MovieResponse
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    check_database()
    print("Подключение к MongoDB успешно!")
    yield


app = FastAPI(
    title="Movie Catalog API",
    description="API для управления личным каталогом фильмов",
    version="1.0.0",
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


def serialize_movie(movie):
    movie["_id"] = str(movie["_id"])
    return movie


@app.get("/", tags=["Общая информация"])
def home():
    return {
        "message": "Movie Catalog API работает!",
        "documentation": "/docs"
    }


@app.get("/health", tags=["Общая информация"])
def health():
    try:
        check_database()
        return {"status": "ok", "database": "connected"}
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="База данных недоступна"
        )


@app.post(
    "/movies",
    response_model=MovieResponse,
    status_code=201,
    tags=["Фильмы"]
)
def create_movie(movie: MovieCreate):
    movie_data = movie.model_dump()

    result = movies_collection.insert_one(movie_data)

    created_movie = movies_collection.find_one(
        {"_id": result.inserted_id}
    )

    return serialize_movie(created_movie)


@app.get(
    "/movies",
    response_model=list[MovieResponse],
    tags=["Фильмы"]
)
def get_movies(
    search: str = Query(default="", description="Поиск по названию"),
    genre: str | None = Query(default=None, description="Фильтр по жанру"),
    status: str = Query(default="all", description="all, watched, planned"),
    sort_by: str = Query(default="year", description="year или rating"),
    order: str = Query(default="desc", description="asc или desc")
):
    query = {}

    if search:
        query["title"] = {
            "$regex": re.escape(search),
            "$options": "i"
        }

    if genre:
        query["genres"] = genre

    if status == "watched":
        query["watched"] = True
    elif status == "planned":
        query["watched"] = False
    elif status != "all":
        raise HTTPException(
            status_code=400,
            detail="Допустимые значения status: all, watched, planned"
        )

    if sort_by not in ("year", "rating"):
        raise HTTPException(
            status_code=400,
            detail="Сортировка возможна только по year или rating"
        )

    if order not in ("asc", "desc"):
        raise HTTPException(
            status_code=400,
            detail="Допустимые значения order: asc, desc"
        )

    sort_direction = 1 if order == "asc" else -1

    movies = movies_collection.find(query).sort(
        sort_by, sort_direction
    )

    return [serialize_movie(movie) for movie in movies]


@app.get(
    "/movies/{movie_id}",
    response_model=MovieResponse,
    tags=["Фильмы"]
)
def get_movie(movie_id: str):
    if not ObjectId.is_valid(movie_id):
        raise HTTPException(
            status_code=400,
            detail="Некорректный идентификатор фильма"
        )

    movie = movies_collection.find_one(
        {"_id": ObjectId(movie_id)}
    )

    if movie is None:
        raise HTTPException(
            status_code=404,
            detail="Фильм не найден"
        )

    return serialize_movie(movie)


@app.put(
    "/movies/{movie_id}",
    response_model=MovieResponse,
    tags=["Фильмы"]
)
def update_movie(movie_id: str, movie: MovieUpdate):
    if not ObjectId.is_valid(movie_id):
        raise HTTPException(
            status_code=400,
            detail="Некорректный идентификатор фильма"
        )

    result = movies_collection.update_one(
        {"_id": ObjectId(movie_id)},
        {"$set": movie.model_dump()}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Фильм не найден"
        )

    updated_movie = movies_collection.find_one(
        {"_id": ObjectId(movie_id)}
    )

    return serialize_movie(updated_movie)


@app.patch(
    "/movies/{movie_id}/status",
    response_model=MovieResponse,
    tags=["Фильмы"]
)
def update_movie_status(
    movie_id: str,
    status: MovieStatusUpdate
):
    if not ObjectId.is_valid(movie_id):
        raise HTTPException(
            status_code=400,
            detail="Некорректный идентификатор фильма"
        )

    movie = movies_collection.find_one(
        {"_id": ObjectId(movie_id)}
    )

    if movie is None:
        raise HTTPException(
            status_code=404,
            detail="Фильм не найден"
        )

    movies_collection.update_one(
        {"_id": ObjectId(movie_id)},
        {
            "$set": {
                "watched": status.watched,
                "rating": status.rating
            }
        }
    )

    updated_movie = movies_collection.find_one(
        {"_id": ObjectId(movie_id)}
    )

    return serialize_movie(updated_movie)


@app.delete(
    "/movies/{movie_id}",
    tags=["Фильмы"]
)
def delete_movie(movie_id: str):
    if not ObjectId.is_valid(movie_id):
        raise HTTPException(
            status_code=400,
            detail="Некорректный идентификатор фильма"
        )

    result = movies_collection.delete_one(
        {"_id": ObjectId(movie_id)}
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Фильм не найден"
        )

    return {"message": "Фильм успешно удалён"}
