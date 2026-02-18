# GitNexus - Tasks

> **Project:** GitNexus
> **Version:** 3.0.2
> **Last Updated:** 2026-02-17
> **Last Audit:** 2026-02-17

---

## 🔴 HIGH Priority

### Bugs

| ID | Issue | File | Details |
|----|-------|------|---------|
| BUG-1 | `CachedRelease.assets` type annotation mismatch | `backend/models/release.py` | Annotated as `Mapped[dict]` but `default=list` — should be `Mapped[list]` |
| BUG-2 | `hash()` produces non-deterministic asset IDs | `backend/routers/watchlist.py`, `backend/services/release_cache_service.py` | `hash()` output varies across Python sessions (PYTHONHASHSEED). Use `hashlib` for stable IDs |
| BUG-3 | Unused variable `synced_key` | `backend/routers/discovery.py:254` | Declared but never used — dead code |
| BUG-4 | `clear_logs` endpoint misplaced in envvars router | `backend/routers/envvars.py` | Lives in `/env/clear-logs` but frontend calls `/settings/clear-logs` — endpoint is duplicated across routers |
| BUG-5 | `addToWatchlist` success detection unreliable | `frontend/src/api/client.ts:164` | `res.ok` is checked *after* `handleResponse` consumed the response — always `true` at that point since `handleResponse` throws on failure |

### Security

| ID | Issue | File | Details |
|----|-------|------|---------|
| SEC-1 | `download_asset` in `github_service.py` has no SSRF validation | `backend/services/github_service.py:418` | Unlike the `settings.py` download endpoint which validates URLs, the github_service `download_asset` method accepts any URL without SSRF checks |
| SEC-2 | `parse_github_url` does not validate hostname | `backend/services/github_service.py:451` | Accepts any URL, extracts path parts — no check that hostname is actually `github.com` |
| SEC-3 | `import_watchlist` has no file size limit | `backend/routers/watchlist.py` | Uploaded JSON file size is unbounded, enables memory exhaustion DoS |
| SEC-4 | `days_to_keep` lacks input validation | `backend/routers/envvars.py` | No minimum/maximum bounds — negative values or zero could delete all logs unexpectedly |

---

## 🟠 CodeRabbit Review (Immediate Action)

| ID | Task | File | Status |
|----|------|------|--------|
| CR-1 | Add `UniqueConstraint` (`username`, `endpoint_type`) to `cache_entries` via Alembic | `backend/models/cache.py` | Pending |
| CR-2 | Ensure `repo.last_checked` is always updated in watchlist loop | `backend/routers/watchlist.py` | Pending |
| CR-3 | Remove custom `event_loop` fixture to fix scope mismatch | `backend/tests/conftest.py` | Pending |
| CR-4 | Assert success of first POST before testing duplicate in `test_api.py` | `backend/tests/test_api.py` | Pending |
| CR-5 | Replace ineffective `urlparse` try/except with explicit validation | `backend/utils/security.py` | Pending |
| CR-6 | Make Modal close button test deterministic (remove conditional) | `frontend/src/components/__tests__/Modal.test.tsx` | Pending |
| CR-7 | Use `data-testid` for Modal backdrop test | `frontend/src/components/__tests__/Modal.test.tsx` | Pending |
| CR-8 | Make Toast dismiss button test deterministic (remove conditional) | `frontend/src/components/__tests__/Toast.test.tsx` | Pending |

---

## 🟡 MEDIUM Priority

### Documentation / Version Consistency

| ID | Issue | File | Details |
|----|-------|------|---------|
| DOC-1 | Version mismatch across the project | Multiple files | `config.py` says `3.0.1`, `CHANGELOG.md` says `3.0.2`, `.env.example` says `3.0.0`, `TASKS.md` said `3.0.1`, frontend `App.tsx`/pages say `v3.1.0`, `adapters/__init__.py` says `v3.0.0`, `release.py` docstring says `v3.1.0` — must unify to a single source of truth |
| DOC-3 | `MIGRATION.md` references `v3.0.0` env config | `MIGRATION.md:120` | Shows `APP_VERSION="3.0.0"` — should match current version or reference `.env.example` instead |
| DOC-4 | `DEVELOPMENT.md` table count lists "9+ models" | `DEVELOPMENT.md` | Actual model count is 11 (including `Log` and `ApiStatus`) — should be accurate |

### Architecture

| ID | Issue | File | Action |
|----|-------|------|--------|
| ARCH-1 | API client is 452 lines | `frontend/src/api/client.ts` | Split by module |
| ARCH-2 | Store context is 365 lines | `frontend/src/store/index.tsx` | Split into contexts |
| ARCH-3 | Watchlist page is 697 lines | `frontend/src/pages/Watchlist.tsx` | Extract components |
| ARCH-4 | Replay page is 526 lines | `frontend/src/pages/Replay.tsx` | Extract components |
| ARCH-7 | `Commit` model lacks `ondelete="CASCADE"` on ForeignKey | `backend/models/replay.py` | Deleting a `Repository` orphans its `Commit` rows — add cascade delete |
| ARCH-8 | `_sync_repo_commits` accesses `repo.owner` inconsistently | `backend/services/github_service.py:293` | Uses `hasattr(repo.owner, "login")` duck-typing — callers should provide a consistent contract |
| ARCH-9 | `server_service.py` re-imports `asyncio` inside a function | `backend/services/server_service.py:181` | `asyncio` already imported at module top — redundant inner import |
| ARCH-10 | Singleton pattern used everywhere without DI framework | `backend/services/*.py` | All services use module-level singleton instances — makes testing harder, consider FastAPI dependency injection |

### Code Quality

| ID | Issue | File | Details |
|----|-------|------|---------|
| CQ-3 | Inconsistent error responses | `backend/routers/discovery.py` | Some endpoints return `{"error": code}`, others raise HTTPException — should standardize |
| CQ-6 | Missing type annotations | Various | Some function parameters lack annotations |
| CQ-8 | Hardcoded magic numbers | Various | Cache TTLs, port ranges, retry counts scattered as literals |
| CQ-10 | `release_cache_service.py` duplicates `hash()` logic from `watchlist.py` | `backend/services/release_cache_service.py:175-187` | Same non-deterministic `hash()` pattern for source code archive IDs — should be a shared utility |
| CQ-11 | `crypto.py` returns empty string on decryption failure | `backend/utils/crypto.py:80` | Silent failure — callers may not distinguish between "empty value" and "decryption error" |
| CQ-12 | `_update_rate_limit` calls `rollback()` which may break caller's transaction | `backend/services/github_service.py:64` | If rate limit update fails, rolling back could undo the caller's pending changes |
| CQ-13 | `fetch_commit_count` fallback returns `len(data)` when no pagination | `backend/services/github_service.py:363` | With `per_page=1`, a repo with 1 commit returns 1 correctly, but a repo with 0 returns 0 from empty list — seems correct but comment says "<30 commits" which is misleading since `per_page=1` |
| CQ-14 | Frontend `Watchlist.handleImportConfig` uses `FileReader` instead of `file.text()` | `frontend/src/pages/Watchlist.tsx:266` | `FileReader` with `onload` is unnecessarily complex — `await file.text()` is simpler and async |

---

## 🔵 LOW Priority

### Test Coverage

| ID | Issue | Details |
|----|-------|---------|
| TEST-1 | No tests for `discovery.py` router | Noted in test file: "Discovery tests require complex mocking" |
| TEST-2 | No tests for `env_service.py` encryption/decryption | Encryption logic untested |
| TEST-3 | No tests for `release_cache_service.py` | Cache TTL logic untested |
| TEST-4 | No tests for `server_service.py` port allocation | Port conflict and retry logic untested |
| TEST-5 | No tests for `github_service.py` pagination | Pagination and rate limit tracking untested |
| TEST-6 | Frontend test coverage limited to 3 UI components | Only Badge, Modal, Toast tested — no page-level or integration tests |

---

## 🛡️ Security Hardening (Low Priority)

| ID | Issue | Action |
|----|-------|--------|
| SEC-LOW-1 | CORS overly permissive | Restrict `allow_methods` and `allow_headers` to specific values instead of `["*"]` |
| SEC-LOW-2 | No rate limiting on API endpoints | Add slowapi middleware or similar |
| SEC-LOW-3 | Logs may leak sensitive data | Sanitize tokens/secrets before writing to log DB |
| SEC-LOW-4 | `crypto.py` logs the generated Fernet key in a warning message | `backend/utils/crypto.py:50` — key value appears in log output on first run |
| SEC-LOW-5 | `SENSITIVE_PATHS` blocklist uses Windows raw string paths with double backslashes | `backend/utils/security.py:13` — `r"C:\\Windows"` resolves to `C:\Windows` which is correct, but only covers a small subset of sensitive directories |

---