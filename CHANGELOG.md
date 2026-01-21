# GitNexus - Changelog

> **Project:** GitNexus
> **Version:** 3.0.1
> **Last Updated:** 2026-01-21

---

## [3.0.1] - 2026-01-21

### 🔒 Security

- **CR-BE-5**: Added SSRF protection with URL validation for downloads (allowlist, private IP blocking)
- **CR-BE-6**: Token endpoint now returns masked values (last 4 chars only)
- **CR-BE-10**: Replaced secret-looking test literals with neutral placeholders
- **CR-BE-11**: Improved path containment checks using `Path.is_relative_to()`
- **CR-FE-5**: Added `noopener,noreferrer` to `window.open` calls

### 🐛 Bug Fixes

- **CR-BE-4**: Removed hard-coded 10,000 commit limit in replay sync
- **CR-BE-7**: Fixed ORM mutation in concurrent tasks (sequential after gather)
- **CR-BE-8**: Replaced `commit()` with `flush()` in rate limit updates, added `rollback()`
- **CR-BE-9**: Fixed error payload handling in `fetch_recent_commits`
- **CR-FE-1**: Fixed `addToWatchlist` success detection (synthesize from `res.ok`)
- **CR-FE-7**: Prevented stale data overwrites in Discovery page
- **CR-FE-8**: Removed duplicate `deleteReplayRepo` call
- **CR-FE-9**: Added `stopPropagation()` to download button clicks

### ♿ Accessibility

- **CR-FE-4**: Added keyboard accessibility to FileTree component
- **CR-FE-6**: Badge renders as `<button>` when interactive

### 🏗️ Architecture

- **CR-BE-1**: Updated to Pydantic v2 `model_config` pattern
- **CR-BE-2**: Added `UniqueConstraint` to CacheEntry model
- **CR-BE-3**: Replaced redundant constraint with composite Index on commits
- **CR-FE-2**: Fixed render-time state updates with `useCallback` + `useEffect`
- **CR-FE-3**: Added guards for missing identifiers in EnvManager

### 🧪 Testing

- Added **49 backend tests** (pytest + pytest-asyncio)
  - API endpoint tests (health, settings, watchlist, replay)
  - Service layer tests (workspace, git, cache)
  - Security tests (encryption, sanitization, SSRF)
- Added **20 frontend tests** (Vitest + React Testing Library)
  - Badge component tests
  - Modal component tests
  - Toast component tests

---

## [3.0.0] - 2026-01-20

### 🚀 Complete Overhaul

Version 3.0.0 is a **complete rewrite** of GitNexus. Every component has been rebuilt from scratch with a modern, async-first architecture.

> See [MIGRATION.md](MIGRATION.md) for detailed upgrade instructions from v2.0.0.

### Architecture

- **Backend**: Migrated from Flask to FastAPI with full async/await support
- **Frontend**: Rebuilt as React 19 SPA with TypeScript and Vite
- **Database**: Expanded from 2 tables to 9+ tables with async SQLAlchemy
- **API**: RESTful JSON API with Pydantic validation

### Added

#### Repo Replay 🎬 (New Module)
- Add local repositories or clone from remote URLs
- Sync and store complete commit history with sequential numbering
- Browse file trees at any commit point in time
- Launch isolated HTTP dev servers for any commit
- Scoped environment variables (Global → Project → Commit)
- Automatic workspace management with Git worktrees

#### Discovery Engine (Enhanced)
- GitHub contribution graph visualization
- Commit count per repository
- Profile README rendering with markdown support
- Multi-repo download cart with batch downloads
- Search history persistence

#### Asset Watchtower (Enhanced)
- Drag-and-drop reorder for watchlist items
- Per-release asset filtering by file type
- Cached release data for faster loading
- Batch update checking with concurrency control

#### Security
- Fernet encryption for stored tokens and secrets
- Environment variable key loading (recommended over file storage)
- Path traversal protection with blocklist validation
- Port validation for server spawning
- Commit hash regex validation

#### Developer Experience
- Colored console logging with DB persistence
- API rate limit tracking and display
- Cache cleanup on startup
- Graceful shutdown with resource cleanup

### Changed

- **URL Structure**: Backend on `:8000`, Frontend on `:5173`
- **Database Location**: Now in `backend/data/gitnexus.db`
- **Configuration**: Moved from `config.py` to `.env` file
- **Styling**: Added Tailwind CSS alongside Glassmorphism theme system
- **State Management**: React Context with typed state

### Removed

- Jinja2 templates (replaced by React components)
- Synchronous Flask routes (replaced by async FastAPI)
- In-memory session state (replaced by SQLite persistence)

### Technical Details

| Component | Old (v2.0.0) | New (v3.0.0) |
|-----------|--------------|--------------|
| Backend | Flask 3.x | FastAPI 0.115+ |
| Frontend | Vanilla JS | React 19 + TypeScript |
| Build | None | Vite 7.x |
| HTTP Client | requests | httpx (async) |
| ORM | SQLAlchemy (sync) | SQLAlchemy (async) |

---

## [2.0.0] - 2026-01-12

### Added
- **Asset Watchtower**: Dedicated dashboard to track repositories for new releases.
- **Smart Update Detection**: Visual indicators (Green Border/Badge) when a new version is released.
- **Server-Side Downloader**: Python-based download handler to bypass browser CORS and limitation issues.
- **Data Portability**: Import/Export watchlist configuration to JSON.

### Changed
- Refactored entire UI to use a modular CSS architecture (Glassmorphism).
- Moved settings from a dropdown to a dedicated full-page interface.

### Fixed
- Fixed GitHub API rate limiting handling with better visual warnings.
- Fixed card alignment issues on mobile devices.

---

## [1.1.0] - 2024-12-28

### Added
- **Glassmorphism Header**: New backdrop-blur effect navigation bar.
- **Mobile Responsiveness**: Adaptive layouts for phones and tablets.

### Changed
- Split monolithic `index.html` into reusable Jinja2 partials.
- Hidden native browser scrollbars for a cleaner aesthetic.

### Fixed
- Fixed button hover states causing card layout shifts.

---

<p align="center">
  <a href="README.md">← Back to README</a>
</p>