# GitNexus - Changelog

> **Project:** GitNexus
> **Version:** 3.0.0
> **Last Updated:** 2026-01-20

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