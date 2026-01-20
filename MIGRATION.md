# GitNexus v3.0.0 - Complete Overhaul

> **From:** v2.0.0 (Flask + Jinja2)
> **To:** v3.0.0 (FastAPI + React)
> **Date:** January 2026

---

## What Changed?

GitNexus v3.0.0 is a **complete rewrite** of the application. Every single file has been rebuilt from scratch with a modern, async-first architecture.

### Architecture Transformation

```
┌────────────────────────────────────────────────────────────────────────┐
│                           v2.0.0 (OLD)                                 │
│                                                                        │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐             │
│   │   Flask     │────▶│   Jinja2    │────▶│   Browser   │             │
│   │  (Python)   │     │  Templates  │     │  (HTML/JS)  │             │
│   └─────────────┘     └─────────────┘     └─────────────┘             │
│         │                                                              │
│         ▼                                                              │
│   ┌─────────────┐                                                      │
│   │   SQLite    │                                                      │
│   │  (2 tables) │                                                      │
│   └─────────────┘                                                      │
└────────────────────────────────────────────────────────────────────────┘

                              ▼ REWRITE ▼

┌────────────────────────────────────────────────────────────────────────┐
│                           v3.0.0 (NEW)                                 │
│                                                                        │
│   ┌─────────────┐                       ┌─────────────┐               │
│   │   FastAPI   │◀───── REST API ──────▶│   React     │               │
│   │   (Async)   │                       │  (TypeScript)│               │
│   └─────────────┘                       └─────────────┘               │
│         │                                     │                        │
│         ▼                                     ▼                        │
│   ┌─────────────┐                       ┌─────────────┐               │
│   │   SQLite    │                       │    Vite     │               │
│   │ (9+ tables) │                       │  Dev Server │               │
│   └─────────────┘                       └─────────────┘               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Why The Rewrite?

| Problem in v2.0.0 | Solution in v3.0.0 |
|-------------------|-------------------|
| Flask is synchronous, blocking on API calls | FastAPI is async-first, non-blocking |
| Jinja2 templates mixed logic and presentation | React SPA with clean component architecture |
| Vanilla JS with no type safety | TypeScript for type-safe frontend |
| Limited to 2 database tables | Expanded to 9+ tables for new features |
| No commit history exploration | New **Repo Replay** feature for time-travel |
| No dev server orchestration | Launch isolated servers for any commit |

---

## New Feature: Repo Replay 🎬

The flagship addition in v3.0.0 is **Repo Replay** - a feature that lets you:

1. **Add Repositories** - Local or cloned from remote
2. **Sync Commit History** - Store all commits with sequential numbering
3. **Time Travel** - Browse files at any commit point
4. **Launch Dev Servers** - Spin up isolated http servers for any commit
5. **Environment Variables** - Scoped env vars (Global → Project → Commit)

This enables workflows like:
- Comparing how a UI looked 50 commits ago
- Testing old versions without `git checkout`
- Running multiple commit versions simultaneously

---

## Migration Guide

### ⚠️ Database Not Compatible

v3.0.0 uses a completely new database schema. There is **no migration path** from v2.0.0.

**If you have watchlist data to preserve:**
1. In v2.0.0, export your watchlist to JSON
2. Install v3.0.0 fresh
3. Import the JSON into the new watchlist

### Fresh Installation

```bash
# Clone the new version
git clone https://github.com/qtremors/git-nexus.git
cd git-nexus

# Backend setup
cd backend
uv sync

# Frontend setup
cd ../frontend
npm install

# Run (two terminals)
# Terminal 1: Backend
cd backend && uv run uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Configuration

Create `backend/.env` with:

```env
# Application
APP_NAME="GitNexus"
APP_VERSION="3.0.0"
DEBUG=false

# Security (RECOMMENDED - generate your own key)
FERNET_KEY=<your-key-here>

# GitHub API (optional - for higher rate limits)
GITHUB_TOKEN=<your-token>

# Server
HOST="127.0.0.1"
PORT=8000
CORS_ORIGINS='["http://localhost:5173", "http://127.0.0.1:5173"]'
BASE_SERVER_PORT=9000
```

Generate FERNET_KEY with:
```bash
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## Breaking Changes

| Area | v2.0.0 | v3.0.0 |
|------|--------|--------|
| **URL** | `http://127.0.0.1:5000` | Backend: `:8000`, Frontend: `:5173` |
| **Database** | `instance/gitnexus.db` | `backend/data/gitnexus.db` |
| **Config** | `config.py` | `.env` file |
| **Templates** | `templates/*.html` | React components |
| **Static Files** | `static/` | `frontend/dist/` (built) |
| **API Prefix** | `/api/` | `/api/` (unchanged) |

---

## Tech Stack Comparison

| Component | v2.0.0 | v3.0.0 |
|-----------|--------|--------|
| **Backend Framework** | Flask 3.x | FastAPI 0.115+ |
| **Python Version** | 3.11+ | 3.11+ |
| **Database** | SQLAlchemy (sync) | SQLAlchemy (async) |
| **Frontend** | Vanilla JS + Jinja2 | React 19 + TypeScript |
| **Build Tool** | None (no build) | Vite 7.x |
| **Styling** | Glassmorphism CSS | Glassmorphism CSS + Tailwind |
| **State Management** | DOM manipulation | React Context |
| **HTTP Client** | `requests` | `httpx` (async) |

---

## Database Schema Expansion

### v2.0.0 (2 tables)
- `AppConfig` - Key-value settings
- `CacheEntry` - API response cache

### v3.0.0 (9+ tables)
- `AppConfig` - Settings (expanded)
- `CacheEntry` - API cache (with TTL)
- `SearchHistory` - Recent user searches
- `TrackedRepo` - Watchlist items
- `CachedRelease` - Release data cache
- `Repository` - Local/cloned repos for Replay
- `Commit` - Synced commit history
- `GitHubCommit` - GitHub commit cache for graphs
- `EnvVar` - Scoped environment variables
- `ApiStatus` - Rate limit tracking
- `Log` - System logs

---

## File Structure Comparison

### v2.0.0
```
git-nexus/
├── app/
│   ├── routes/
│   ├── models.py
│   └── services.py
├── static/
├── templates/
└── app.py
```

### v3.0.0
```
git-nexus/
├── backend/
│   ├── routers/        # 5 API routers
│   ├── services/       # 8 service modules
│   ├── models/         # 9 database models
│   ├── adapters/       # Runtime adapters
│   ├── utils/          # Crypto, security, logging
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── api/        # API client
│   │   ├── components/ # React components
│   │   ├── pages/      # Route pages
│   │   └── store/      # State management
│   └── package.json
└── workspaces/         # Git worktrees for Replay
```

---

## Summary

GitNexus v3.0.0 is not an upgrade - it's a **new application** built with lessons learned from v2.0.0. The core mission remains the same: bridge the gap between GitHub and your local machine.

What's new:
- ⚡ **Faster** - Async operations throughout
- 🔒 **More Secure** - Encrypted secrets, path validation
- 🎬 **Repo Replay** - Time-travel through commits
- 📊 **Better UI** - React SPA with proper state management
- 🛠️ **Extensible** - Adapter pattern for future runtime support

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/qtremors">Tremors</a>
</p>
