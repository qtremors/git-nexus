from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class CacheEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False, index=True)
    endpoint_type = db.Column(db.String(50), nullable=False)
    data = db.Column(db.JSON, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)

    def is_fresh(self, minutes=30):
        delta = datetime.utcnow() - self.last_updated
        return delta.total_seconds() < (minutes * 60)


class SearchHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    last_searched = db.Column(db.DateTime, default=datetime.utcnow)


class AppConfig(db.Model):
    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.String(255), nullable=True)
