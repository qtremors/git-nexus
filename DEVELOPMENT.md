# GitNexus - Developer Documentation

> Comprehensive documentation for developers working on GitNexus.

**Version:** 3.0.0 | **Last Updated:** 2026-01-20

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Environment Variables](#environment-variables)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Architecture Overview

GitNexus v3.0.0 uses a **Decoupled Client-Server Architecture**:

```
┌──────────────────────────────────────────────────────────────┐
│                    Frontend (Port 5173)                      │
│           React 19 + Vite + TypeScript (SPA)                 │
│           Communicates via JSON REST API                     │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTP / JSON
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     Backend (Port 8000)                      │
│           FastAPI (Python 3.11+, Fully Async)                │
│           Services: GitHub, Cache, Git, Server Orchestrator  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      Persistence                             │
│           SQLite (aiosqlite) + Local File System             │
│           Encrypted secrets, Git worktrees                   │
└──────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Async FastAPI** | Non-blocking I/O for Git operations, GitHub API calls, and multi-server management. |
| **SQLite + aiosqlite** | Zero-configuration, local-first persistence. Perfect for single-user desktop tools. |
| **React SPA** | Rich, responsive UI with proper state management. Decoupled from backend. |
| **Vite** | Extremely fast HMR (<100ms) and optimized production builds. |
| **Fernet Encryption** | Industry-standard symmetric encryption for secrets (tokens, env vars). |

---

## Project Structure

```
git-nexus/
├── backend/
│   ├── main.py                  # FastAPI entry point, lifespan handlers
│   ├── config.py                # Pydantic settings (loads .env)
│   ├── database.py              # Async SQLAlchemy engine + session
│   ├── schemas.py               # Pydantic request/response models
│   ├── constants.py             # App-wide constants
│   ├── adapters/                # Runtime adapters
│   │   ├── base.py              # Abstract RuntimeAdapter
│   │   └── static_html.py       # Python http.server adapter
│   ├── models/                  # SQLAlchemy ORM models (9 files)
│   │   ├── cache.py             # CacheEntry, SearchHistory
│   │   ├── config.py            # AppConfig (settings storage)
│   │   ├── envvar.py            # EnvVar (scoped env variables)
│   │   ├── github.py            # GitHubCommit, ApiStatus
│   │   ├── log.py               # Log (system logs)
│   │   ├── release.py           # CachedRelease
│   │   ├── replay.py            # Repository, Commit
│   │   └── watchlist.py         # TrackedRepo
│   ├── routers/                 # API route handlers (5 modules)
│   │   ├── discovery.py         # User discovery, repos, contribution graph
│   │   ├── envvars.py           # Environment variable management
│   │   ├── replay.py            # Repository + commit + server management
│   │   ├── settings.py          # App configuration, downloads
│   │   └── watchlist.py         # Release tracking
│   ├── services/                # Business logic (8 modules)
│   │   ├── cache_service.py     # API response caching
│   │   ├── env_service.py       # Scoped env var management (encrypted)
│   │   ├── git_service.py       # GitPython operations
│   │   ├── github_service.py    # GitHub API client (async httpx)
│   │   ├── release_cache_service.py  # Release data caching
│   │   ├── server_service.py    # Server orchestrator
│   │   ├── token_service.py     # Token retrieval
│   │   └── workspace_service.py # Git worktree management
│   ├── utils/                   # Utilities (3 files)
│   │   ├── crypto.py            # Fernet encryption/decryption
│   │   ├── logger.py            # DB-backed logging with colors
│   │   └── security.py          # Path validation, sanitization
│   ├── tests/                   # Pytest tests
│   └── data/                    # Runtime data (gitignored)
│       ├── gitnexus.db          # SQLite database
│       └── secret.key           # Encryption key (legacy)
├── frontend/
│   ├── src/
│   │   ├── api/                 # API client (typed)
│   │   │   └── client.ts        # All API calls
│   │   ├── components/          # Reusable components
│   │   │   ├── discovery/       # Discovery-specific components
│   │   │   ├── replay/          # Replay-specific components
│   │   │   └── ui/              # Generic UI components
│   │   ├── pages/               # Route pages
│   │   │   ├── Discovery.tsx
│   │   │   ├── Watchlist.tsx
│   │   │   ├── WatchlistDetail.tsx
│   │   │   ├── Replay.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Home.tsx
│   │   ├── store/               # React Context state
│   │   ├── types/               # TypeScript interfaces
│   │   └── constants/           # Theme definitions
│   ├── public/                  # Static assets
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── workspaces/                  # Git worktrees for Replay (gitignored)
├── CHANGELOG.md                 # Version history
├── DEVELOPMENT.md               # This file
├── MIGRATION.md                 # v2 → v3 upgrade guide
├── README.md                    # User documentation
├── TASKS.md                     # Development roadmap
└── LICENSE.md                   # License terms
```

---

## Database Schema

### Models Overview (11 tables)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **AppConfig** | Key-value settings | `key`, `value` (encrypted tokens) |
| **CacheEntry** | API response cache | `username`, `endpoint_type`, `data`, `last_updated` |
| **SearchHistory** | Recent user searches | `username`, `last_searched` |
| **TrackedRepo** | Watchlist items | `owner`, `repo_name`, `current_version`, `latest_version` |
| **CachedRelease** | Release data cache | `repo_id`, `tag_name`, `assets`, `cached_at` |
| **Repository** | Local repos for Replay | `path`, `is_remote`, `remote_url` |
| **Commit** | Synced commit history | `repo_id`, `hash`, `message`, `commit_number` |
| **GitHubCommit** | Contribution graph data | `sha`, `repo_owner`, `repo_name`, `author_date` |
| **EnvVar** | Scoped env variables | `scope`, `repository_id`, `commit_hash`, `key`, `value` (encrypted) |
| **ApiStatus** | GitHub rate limit tracking | `limit`, `remaining`, `reset_time`, `token_source` |
| **Log** | System logs | `timestamp`, `level`, `message`, `module` |

---

## API Routes

> **Interactive Docs:** http://127.0.0.1:8000/docs (Swagger UI)

### Discovery (`/api/discovery/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/fetch-user` | Fetch user profile + repos |
| GET | `/search-history` | Get recent searches |
| POST | `/commit-count` | Get commit count for repo |
| POST | `/repo-readme` | Get repository README content |
| POST | `/repo-commits` | Get repository commits |
| POST | `/contribution-graph` | Get contribution data for graph |
| POST | `/download` | Download repositories to disk |
| GET | `/api-status` | Get GitHub API rate limit status |

### Watchlist (`/api/watchlist/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all tracked repos with releases |
| POST | `/add-by-url` | Add repo by GitHub URL |
| POST | `/remove` | Remove tracked repo |
| POST | `/reorder` | Reorder watchlist items |
| POST | `/check-updates` | Check for new releases |
| POST | `/details` | Get release details for repo |
| GET | `/export` | Export watchlist to JSON |
| POST | `/import` | Import watchlist from JSON |

### Replay (`/api/replay/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos` | List loaded repositories |
| POST | `/repos/local` | Add local repository |
| POST | `/repos/clone` | Clone remote repository |
| GET | `/repos/{id}` | Get repository details |
| DELETE | `/repos/{id}` | Remove repository |
| GET | `/repos/{id}/commits` | List commits (paginated) |
| POST | `/repos/{id}/sync-commits` | Sync commit history |
| GET | `/repos/{id}/files` | Get file tree at commit |
| GET | `/repos/{id}/file-content` | Get file content at commit |
| GET | `/servers` | List all servers |
| POST | `/servers` | Start server for commit |
| POST | `/servers/{id}/stop` | Stop server |
| DELETE | `/servers/{id}` | Remove stopped server |
| POST | `/servers/stop-all` | Stop all servers |

### Settings (`/api/settings/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/token` | Get/save GitHub token |
| GET/POST | `/download-path` | Get/set download path |
| GET/POST | `/theme` | Get/set UI theme |
| GET/POST | `/last-repo` | Get/set last active repo |
| POST | `/download-asset` | Download asset to disk |
| POST | `/clear-cache` | Clear API cache |
| POST | `/clear-logs` | Clear system logs |

### Environment Variables (`/api/env/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/global` | Global env vars |
| GET/PUT | `/project/{repo_id}` | Project-level env vars |
| GET/PUT | `/commit/{repo_id}/{hash}` | Commit-level env vars |
| GET | `/merged/{repo_id}/{hash}` | Get merged vars (readonly) |

---

## Environment Variables

Create `backend/.env` (optional but recommended):

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `GitNexus` | Application name |
| `APP_VERSION` | `3.0.0` | Application version |
| `DEBUG` | `false` | Enable debug mode |
| `FERNET_KEY` | (generated) | Encryption key for secrets |
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/gitnexus.db` | Database path |
| `GITHUB_API_URL` | `https://api.github.com` | GitHub API base URL |
| `GITHUB_TOKEN` | (optional) | Personal access token |
| `HOST` | `127.0.0.1` | Server bind host |
| `PORT` | `8000` | Server bind port |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Allowed CORS origins |
| `BASE_SERVER_PORT` | `9000` | Starting port for Replay servers |

---

## Security

### Encryption
- **Fernet symmetric encryption** for tokens and environment variable values
- Key priority: `FERNET_KEY` env var → `data/secret.key` file → auto-generate

### Path Validation
- **Blocklist** of sensitive paths (Windows System32, /etc, etc.)
- **Path traversal protection** with `is_safe_path()` checks
- **Filename sanitization** for downloads

### Input Validation
- **Pydantic Field validation** with regex patterns
- **Commit hash validation**: `^[a-f0-9]{7,40}$`
- **Port range validation**: 1024-65535

---

## Testing

### Backend

```bash
cd backend
uv run pytest
```

### Frontend

```bash
cd frontend
npm run build  # Type-check + build
npm run lint   # ESLint check
```

---

## Deployment

GitNexus is a **local-first** application. Deployment means running it on your machine.

### Development Mode

```bash
# Terminal 1: Backend
cd backend
uv sync
uv run uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

### Production Build

```bash
# Build frontend for production
cd frontend
npm run build

# Serve built files (or configure backend to serve from dist/)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Server failed to start** | Check if port 8000 is in use. The backend has retry logic for Replay servers. |
| **GitHub API Rate Limit** | Add your Personal Access Token in Settings. |
| **Database Locked** | Ensure only one backend instance is running. |
| **Encryption errors** | Regenerate `FERNET_KEY` and delete old `data/secret.key`. Note: this invalidates existing encrypted data. |
| **Frontend not loading** | Ensure both backend (:8000) and frontend (:5173) are running. |

### Debug Mode

Check the colored terminal output for detailed logs. Logs are also stored in the database and viewable at `/api/logs`.

---

## Contributing

### Code Style

- **Python**: PEP 8 compliant. Type hints are **mandatory**.
- **TypeScript**: Strict mode enabled. Prefer `const`, avoid `any`.
- **CSS**: Glassmorphism design system with CSS variables.

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run lint and type checks
5. Commit with clear, conventional messages
6. Push and create a Pull Request

---

<p align="center">
  <a href="README.md">← Back to README</a>
</p>
