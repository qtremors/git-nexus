from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class CacheEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False, index=True)
    endpoint_type = db.Column(db.String(50), nullable=False)
    data = db.Column(db.JSON, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)


class SearchHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    last_searched = db.Column(db.DateTime, default=datetime.utcnow)


class AppConfig(db.Model):
    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.String(255), nullable=True)


# --- NEW V2 MODEL ---
class TrackedRepo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    owner = db.Column(db.String(80), nullable=False)
    repo_name = db.Column(db.String(80), nullable=False)

    # Version Tracking
    current_version = db.Column(db.String(50), default="Unknown")
    latest_version = db.Column(db.String(50), nullable=True)

    # Metadata
    description = db.Column(db.String(255), nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
    html_url = db.Column(db.String(255), nullable=True)

    last_checked = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("owner", "repo_name", name="_owner_repo_uc"),)
