import os
from pymongo import MongoClient

MONGO_URL = os.getenv(
    "MONGO_URL",
    "mongodb://localhost:27017"
)

client = MongoClient(MONGO_URL)

database = client["movie_catalog"]

movies_collection = database["movies"]


def check_database():
    """Проверка подключения к MongoDB."""
    client.admin.command("ping")
    return True
