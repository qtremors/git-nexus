from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class CacheEntry(db.Model):
    """
    Stores JSON responses from GitHub to reduce API usage.
    Composite key strategy: username + endpoint_type ensures uniqueness.
    """
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False, index=True)
    endpoint_type = db.Column(db.String(50), nullable=False) # e.g., 'profile', 'repos', 'readme'
    data = db.Column(db.JSON, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)

    def is_fresh(self, minutes=30):
        """Checks if the cache is older than X minutes."""
        delta = datetime.utcnow() - self.last_updated
        return delta.total_seconds() < (minutes * 60)