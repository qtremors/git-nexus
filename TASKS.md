# GitNexus - Tasks

> **Project:** GitNexus
> **Version:** 3.0.1
> **Last Updated:** 2026-01-21

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

## 🟡 MEDIUM Priority

### Architecture

| ID | Issue | File | Action |
|----|-------|------|--------|
| ARCH-1 | API client is 452 lines | `frontend/src/api/client.ts` | Split by module |
| ARCH-2 | Store context is 365 lines | `frontend/src/store/index.tsx` | Split into contexts |
| ARCH-3 | Watchlist page is 697 lines | `frontend/src/pages/Watchlist.tsx` | Extract components |
| ARCH-4 | Replay page is 526 lines | `frontend/src/pages/Replay.tsx` | Extract components |

---

## 🔵 LOW Priority

### Code Quality

| ID | Issue | File | Status |
|----|-------|------|--------|
| CQ-3 | Inconsistent error responses | `backend/routers/discovery.py` | Deferred |
| CQ-6 | Missing type annotations | Various | Backlog |
| CQ-8 | Hardcoded magic numbers | Various | Backlog |

---

## 🛡️ Security Hardening (Low Priority)

| ID | Issue | Action |
|----|-------|--------|
| SEC-LOW-1 | CORS overly permissive | Restrict methods/headers |
| SEC-LOW-2 | No rate limiting | Add slowapi middleware |
| SEC-LOW-3 | Logs may leak secrets | Sanitize before storage |

---