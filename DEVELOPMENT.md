# GitNexus - Developer Documentation

> Comprehensive documentation for developers working on GitNexus.

**Version:** 2.0.0 | **Last Updated:** 2026-01-12

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Environment Variables](#environment-variables)
- [Configuration](#configuration)
- [Testing](#testing)
- [Contributing](#contributing)

---

## Architecture Overview

GitNexus follows a **Modular Monolith** architecture:

```
┌──────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│       Vanilla JS modules, Glassmorphism CSS, Jinja2          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                         Backend                              │
│         Python Flask, SQLAlchemy (ORM), GitHub Interaction   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                         Database                             │
│             SQLite (Instance-based persistence)              │
└──────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Vanilla JS over React** | Keeps the app lightweight and zero-build for easier local hacking. |
| **SQLite (Local)** | Ensures total data privacy and zero setup overhead for self-hosting. |
| **Server-Side Downloads** | Bypasses browser CORS/Blob limits to handle large zip files efficiently. |

---

## Project Structure

```
git-nexus/
├── app/                             # Main application package
│   ├── routes/                      # Flask Blueprints (Route controllers)
│   │   ├── api.py                   # JSON API endpoints
│   │   └── main.py                  # HTML View routes
│   ├── models.py                    # SQLAlchemy Models
│   └── services.py                  # Business logic & GitHub API wrapper
├── static/                          # Frontend assets
│   ├── css/                         # Modular CSS
│   └── js/                          # ES6 Javascript modules
├── templates/                       # Jinja2 HTML Templates
├── README.md                        # User-facing documentation
├── DEVELOPMENT.md                   # This file
├── CHANGELOG.md                     # Version history
├── LICENSE.md                       # License terms
└── pyproject.toml                   # Dependency management
```

---

## Database Schema

### Models Overview (2 total)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **AppConfig** | Stores user settings | `key`, `value` |
| **CacheEntry** | Caches GitHub API responses | `username`, `endpoint_type`, `data`, `last_updated` |

---

## API Routes

### API endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/repos/<username>` | `get_repos` | Fetches repositories for a user (cached). |
| POST | `/api/download` | `download_repo` | Triggers a server-side zip download. |
| GET | `/api/user/<username>` | `get_user_profile` | Fetches a GitHub user profile. |

---

## Environment Variables

### Required

No external `.env` file is required for basic operation as config is stored in `config.py` or the database.

---

## Configuration

### Application Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `GITHUB_API_URL` | `https://api.github.com` | Base URL for GitHub API. |
| `SQLALCHEMY_DATABASE_URI` | `sqlite:///instance/gitnexus.db` | Local database path. |

---

## Testing

### Running Tests

*(Note: Test suite coverage is currently pending implementation in `tests/`)*

```bash
# Run future test suite
uv run pytest
```

---

## Contributing

### Code Style

- **Python**: Follow PEP 8 (black formatter recommended).
- **JavaScript**: Use ES6+ syntax, avoid global variables.
- **CSS**: Use CSS Variables for theming.

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit with clear messages
5. Push and create a Pull Request

---

<p align="center">
  <a href="README.md">← Back to README</a>
</p>
