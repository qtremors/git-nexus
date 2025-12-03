import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(
        BASE_DIR, "instance", "gitnexus.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GITHUB_API_URL = "https://api.github.com"
