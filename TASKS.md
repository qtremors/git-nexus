# GitNexus - Tasks

> **Project:** GitNexus
> **Version:** 3.0.0
> **Last Updated:** 2026-01-20

---

## 🟠 HIGH Priority

### BUG-HIGH-3: Incomplete Test File
- **File:** `backend/tests/test_critical_fixes.py`
- **Issue:** File ends abruptly at line 56 without completing the last test.
- **Fix:** Complete the test or remove incomplete stub.

---

## 🟡 MEDIUM Priority

### Architecture

| ID | Issue | File | Action |
|----|-------|------|--------|
| ARCH-1 | API client is 452 lines | `frontend/src/api/client.ts` | Split by module |
| ARCH-2 | Store context is 365 lines | `frontend/src/store/index.tsx` | Split into contexts |
| ARCH-3 | Watchlist page is 697 lines | `frontend/src/pages/Watchlist.tsx` | Extract components |
| ARCH-4 | Replay page is 526 lines | `frontend/src/pages/Replay.tsx` | Extract components |
| ARCH-5 | Missing DB indexes | `backend/models/` | Add composite indexes |
| ARCH-6 | No connection pool config | `backend/database.py` | Configure pool settings |

### Performance

*All performance issues have been resolved.*

---

## 🔵 LOW Priority

### Code Quality

| ID | Issue | File | Status |
|----|-------|------|--------|
| CQ-3 | Inconsistent error responses | `backend/routers/discovery.py` | Deferred |
| CQ-6 | Missing type annotations | Various | Backlog |
| CQ-8 | Hardcoded magic numbers | Various | Backlog |
| CQ-9 | Missing theme validation | `backend/schemas.py` | Backlog |

---

## 🧪 Testing

| ID | Issue | Action |
|----|-------|--------|
| TEST-1 | Minimal backend tests | Add API and service tests |
| TEST-2 | No frontend tests | Add React Testing Library |
| TEST-3 | Security tests need cleanup | Fix pytest compatibility |

---

## 📝 Documentation

| ID | Issue | Action |
|----|-------|--------|
| DOC-1 | Alembic migrations unused | Document workflow |
| DOC-2 | API docs lack examples | Add request/response examples |
| DOC-3 | No ADRs | Create decision records |
| DOC-4 | Placeholder screenshot | Add real screenshot |

---

## 🛡️ Security Hardening (Low Priority)

| ID | Issue | Action |
|----|-------|--------|
| SEC-LOW-1 | CORS overly permissive | Restrict methods/headers |
| SEC-LOW-2 | No rate limiting | Add slowapi middleware |
| SEC-LOW-3 | Logs may leak secrets | Sanitize before storage |

---

## ✅ Completed (v3.0.0)

> These issues were identified and fixed during the v3.0.0 release.

<details>
<summary>View completed items (14 total)</summary>

### Security
- **SEC-CRIT-1:** Fernet key now loadable from `FERNET_KEY` env var
- **SEC-CRIT-2:** Environment variable values now encrypted in database

### Bugs
- **BUG-HIGH-1:** Server port allocation retry logic with exponential backoff
- **BUG-HIGH-2:** Moved `async_session` import to module level
- **BUG-HIGH-4:** Added Pydantic validation for commit hashes

### Architecture & Performance
- **ARCH-7:** GitHub HTTP client cleanup in shutdown handler
- **PERF-1:** Replaced blocking `time.sleep()` with `asyncio.sleep()`
- **PERF-2:** Batch query for watchlist releases (N+1 fix)

### Code Quality
- **CQ-1:** Fixed `Promise<any>` return types in API client
- **CQ-2:** Fixed `Promise<any>` in store interface
- **CQ-4:** Replaced debug prints with proper logging
- **CQ-5:** Removed unused `CacheEntry` import
- **CQ-7:** Synchronized version numbers to 3.0.0
- **CQ-10:** Confirmed Tailwind + Glassmorphism coexistence is intentional

</details>

---

## 🐰 CodeRabbit PR Review (v3.0.0)

> Feedback from automated PR review. Address before merge.

### Backend

| ID | File | Issue | Action |
|----|------|-------|--------|
| ~~CR-BE-1~~ | ~~`config.py:35-38`~~ | ~~Deprecated inner `class Config`~~ | ✅ Replaced with `model_config = SettingsConfigDict(...)` |
| ~~CR-BE-2~~ | ~~`models/cache.py:9-22`~~ | ~~Missing unique constraint~~ | ✅ Added `UniqueConstraint("username", "endpoint_type")` |
| ~~CR-BE-3~~ | ~~`models/github.py:25-28`~~ | ~~Redundant `UniqueConstraint` on PK `sha`~~ | ✅ Replaced with composite `Index` |
| ~~CR-BE-4~~ | ~~`routers/replay.py:272-300`~~ | ~~`sync_repo_commits` truncates history (limit=10000)~~ | ✅ Removed hard-coded limit |
| ~~CR-BE-5~~ | ~~`routers/settings.py`~~ | ~~`download_asset` has no URL validation~~ | ✅ Added SSRF protection with allowlist |
| ~~CR-BE-6~~ | ~~`routers/settings.py:31-59`~~ | ~~`get_saved_token` returns raw decrypted token~~ | ✅ Returns masked value (last 4 chars) |
| ~~CR-BE-7~~ | ~~`routers/watchlist.py:152-193`~~ | ~~`check_updates` mutates ORM in concurrent tasks~~ | ✅ Returns results, mutates sequentially after gather |
| ~~CR-BE-8~~ | ~~`services/github_service.py:26-63`~~ | ~~`_update_rate_limit` commits independently~~ | ✅ Replaced with `flush()`, added `rollback()` |
| ~~CR-BE-9~~ | ~~`services/github_service.py:215-260`~~ | ~~`fetch_recent_commits` drops error payloads~~ | ✅ Detects and returns errors immediately |
| ~~CR-BE-10~~ | ~~`tests/security_verification.py:17-26`~~ | ~~Secret-looking test literal `ghp_...`~~ | ✅ Replaced with `test-token-1234567890` |
| ~~CR-BE-11~~ | ~~`utils/security.py:73-80`~~ | ~~Path containment bypass via `startswith`~~ | ✅ Uses `Path.is_relative_to()` |

### Frontend

| ID | File | Issue | Action |
|----|------|-------|--------|
| ~~CR-FE-1~~ | ~~`api/client.ts:156-163`~~ | ~~`addToWatchlist` expects `{ success }` but backend returns `{ message }`~~ | ✅ Synthesized `success` from `res.ok` |
| ~~CR-FE-2~~ | ~~`components/discovery/RepoList.tsx`~~ | ~~Render-time state updates from `fetchContributions()`~~ | ✅ Wrapped in `useCallback` + `useEffect` |
| ~~CR-FE-3~~ | ~~`components/replay/EnvManager.tsx:63-81`~~ | ~~`handleSave` proceeds without required identifiers~~ | ✅ Added guards with early return + toast |
| ~~CR-FE-4~~ | ~~`components/replay/FileTree.tsx:31-41`~~ | ~~Tree row not keyboard-accessible~~ | ✅ Added `role`, `tabIndex`, `aria-expanded`, `onKeyDown` |
| ~~CR-FE-5~~ | ~~`components/replay/ServerList.tsx:42-45`~~ | ~~`window.open` leaves `opener` exposed~~ | ✅ Used `noopener,noreferrer` |
| ~~CR-FE-6~~ | ~~`components/ui/Badge.tsx:26-35`~~ | ~~Interactive `<span>` with `onClick`~~ | ✅ Renders `<button>` when `onClick` provided |
| ~~CR-FE-7~~ | ~~`pages/Discovery.tsx:101-161`~~ | ~~`fetchCommitCounts` can overwrite newer results~~ | ✅ Verify query match before updating state |
| ~~CR-FE-8~~ | ~~`pages/Replay.tsx:236-250`~~ | ~~`confirmDeleteRepo` calls `deleteReplayRepo` twice~~ | ✅ Removed duplicate call |
| ~~CR-FE-9~~ | ~~`pages/Watchlist.tsx:447-454`~~ | ~~Download button triggers parent card navigation~~ | ✅ Added `e.stopPropagation()` |

---

## Summary

| Priority | Open | Completed |
|----------|------|-----------|
| 🔴 Critical | 0 | 2 |
| 🟠 High | 1 | 4 |
| 🟡 Medium | 6 | 3 |
| 🔵 Low | 4 | 4 |
| 📋 Testing | 3 | 0 |
| 📝 Documentation | 4 | 0 |
| 🛡️ Security (Low) | 3 | 0 |
| 🐰 CodeRabbit (BE) | 0 | 11 |
| 🐰 CodeRabbit (FE) | 0 | 9 |
| **Total** | **21** | **34** |

---

## Next Steps

1. **Immediate:** Address CodeRabbit PR review feedback (CR-BE-*, CR-FE-*)
2. **Short-Term:** Fix or remove incomplete test file (BUG-HIGH-3)
3. **Medium-Term:** Add database indexes (ARCH-5)
4. **Long-Term:** Split monolithic frontend files (ARCH-1-4)

