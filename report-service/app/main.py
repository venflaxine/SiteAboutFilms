
import os
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Movie Catalog Report Service",
    description="Микросервис формирования статистических отчётов по фильмам",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


class MovieReport(BaseModel):
    total_movies: int
    watched_movies: int
    planned_movies: int
    average_rating: Optional[float]


@app.get("/")
def root():
    return {
        "service": "Movie Catalog Report Service",
        "status": "ok",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/reports/summary", response_model=MovieReport)
async def get_summary():
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{BACKEND_URL}/movies")
            response.raise_for_status()
            movies = response.json()

    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=503,
            detail=f"Не удалось получить фильмы от основного сервиса: {error}",
        )

    total_movies = len(movies)

    watched = [
        movie for movie in movies
        if movie.get("watched") is True
    ]

    planned_movies = total_movies - len(watched)

    rated_movies = [
        movie for movie in watched
        if movie.get("rating") is not None
    ]

    average_rating = None

    if rated_movies:
        average_rating = round(
            sum(movie["rating"] for movie in rated_movies)
            / len(rated_movies),
            2,
        )

    return MovieReport(
        total_movies=total_movies,
        watched_movies=len(watched),
        planned_movies=planned_movies,
        average_rating=average_rating,
    )
