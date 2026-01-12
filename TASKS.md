# GitNexus - Tasks

> **Project:** GitNexus
> **Version:** 2.0.0
> **Last Updated:** 2026-01-12

---

---

## ✅ Completed (v2.0.0)

### Documentation
- [x] Standardize README.md
- [x] Create LICENSE.md (TSL)
- [x] Create DEVELOPMENT.md
- [x] Create TASKS.md

---

## 🚧 In Progress

### Documentation Overhaul
- [/] Update CHANGELOG.md to new format
- [/] Finalize README.md structure

---

## 📋 To Do

### High Priority
- [ ] **Add Tests:** No tests currently exist. Create `tests/` directory and add Pytest suite.
- [ ] **Refactor:** Move standardizing logic to a helper function.

### Medium Priority
- [ ] **UI:** Improve mobile responsiveness for the "Watchlist" grid.
- [ ] **Backend:** Add error handling for rate-limited GitHub API tokens.

### Low Priority
- [ ] **Feature:** Add "Dark Blue" theme option to settings.

---

## 🐛 Bug Fixes

- [ ] **BUG-1:** Large repositories may timeout during download.
  - *Fix Approach:* Implement chunked streaming response in Flask.

---

## 💡 Ideas / Future

- Add support for GitLab repositories.
- Create a Docker container for easier deployment.

---

## 🏗️ Architecture Notes

- **Flask Blueprints:** All routes are modularized in `app/routes/`.
- **No-Build Frontend:** kept intentionally simple to allow users to edit HTML/JS directly.

---
