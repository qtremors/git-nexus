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
| ARCH-5 | Missing DB indexes | `backend/models/` | Add composite indexes |
| ARCH-6 | No connection pool config | `backend/database.py` | Configure pool settings |

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
| ~~TEST-1~~ | ~~Minimal backend tests~~ | ✅ Added 49 tests (API, services, security) |
| ~~TEST-2~~ | ~~No frontend tests~~ | ✅ Added 20 tests (Badge, Modal, Toast) |
| ~~TEST-3~~ | ~~Security tests need cleanup~~ | ✅ Updated to proper pytest patterns |

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

## Summary

| Priority | Open | Completed |
|----------|------|-----------|
| 🟠 High | 1 | 0 |
| 🟡 Medium | 6 | 0 |
| 🔵 Low | 4 | 0 |
| 📋 Testing | 0 | 3 |
| 📝 Documentation | 4 | 0 |
| 🛡️ Security (Low) | 3 | 0 |
| **Total** | **18** | **3** |

---

## Next Steps

1. **Immediate:** Fix or remove incomplete test file (BUG-HIGH-3)
2. **Short-Term:** Add database indexes (ARCH-5)
3. **Medium-Term:** Split monolithic frontend files (ARCH-1-4)
4. **Long-Term:** Improve test coverage (TEST-1, TEST-2)
