# GitNexus - Tasks

> **Project:** GitNexus
> **Version:** 3.0.1
> **Last Updated:** 2026-01-21

---

## 🟡 MEDIUM Priority

### Architecture

| ID | Issue | File | Action |
|----|-------|------|--------|
| ARCH-1 | API client is 452 lines | `frontend/src/api/client.ts` | Split by module |
| ARCH-2 | Store context is 365 lines | `frontend/src/store/index.tsx` | Split into contexts |
| ARCH-3 | Watchlist page is 697 lines | `frontend/src/pages/Watchlist.tsx` | Extract components |
| ARCH-4 | Replay page is 526 lines | `frontend/src/pages/Replay.tsx` | Extract components |
| ~~ARCH-5~~ | ~~Missing DB indexes~~ | ~~`backend/models/`~~ | ✅ Added 8 indexes |
| ~~ARCH-6~~ | ~~No connection pool config~~ | ~~`backend/database.py`~~ | ✅ StaticPool + timeout |

---

## 🔵 LOW Priority

### Code Quality

| ID | Issue | File | Status |
|----|-------|------|--------|
| CQ-3 | Inconsistent error responses | `backend/routers/discovery.py` | Deferred |
| CQ-6 | Missing type annotations | Various | Backlog |
| CQ-8 | Hardcoded magic numbers | Various | Backlog |
| ~~CQ-9~~ | ~~Missing theme validation~~ | ~~`backend/schemas.py`~~ | ✅ Regex pattern validation |

---

## 📝 Documentation

| ID | Issue | Action |
|----|-------|--------|
| DOC-1 | Alembic migrations unused | Document workflow |
| ~~DOC-2~~ | ~~API docs lack examples~~ | ✅ Added OpenAPI examples |

---

## 🛡️ Security Hardening (Low Priority)

| ID | Issue | Action |
|----|-------|--------|
| SEC-LOW-1 | CORS overly permissive | Restrict methods/headers |
| SEC-LOW-2 | No rate limiting | Add slowapi middleware |
| SEC-LOW-3 | Logs may leak secrets | Sanitize before storage |

---

## Summary

| Priority | Open | Completed |
|----------|------|-----------|
|  Medium | 4 | 2 |
| 🔵 Low | 3 | 1 |
|  Documentation | 1 | 1 |
| 🛡️ Security (Low) | 3 | 0 |
| **Total** | **11** | **4** |

---

## Next Steps

1. **Short-Term:** Split monolithic frontend files (ARCH-1-4)
2. **Medium-Term:** Document Alembic workflow (DOC-1)
3. **Long-Term:** Security hardening (SEC-LOW-1-3)
