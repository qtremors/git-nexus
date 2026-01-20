import sqlite3
import os

db_path = "gitnexus.db"
if not os.path.exists(db_path):
    print("DB file not found")
    exit(0)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
table_names = [t[0] for t in tables]
print(f"Tables: {table_names}")

if 'alembic_version' in table_names:
    version = cursor.execute("SELECT * FROM alembic_version").fetchall()
    print(f"Alembic Version: {version}")
else:
    print("Alembic Version: None")

if 'tracked_repos' in table_names:
    cols = cursor.execute("PRAGMA table_info(tracked_repos)").fetchall()
    col_names = [c[1] for c in cols]
    print(f"TrackedRepo Columns: {col_names}")
