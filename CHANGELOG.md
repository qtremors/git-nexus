# Changelog - v1.10

## 🏗️ Architecture & Refactoring

- **Modularization:** Refactored the monolithic codebase into a scalable modular structure.
    - **HTML:** Split `index.html` into reusable partials (`header.html`, `profile.html`, `filters.html`, `modals.html`, `graph.html`).
    - **CSS:** Broken down into feature-specific modules (`header.css`, `profile.css`, `repos.css`, `modals.css`, `filters.css`).
    - **JavaScript:** Split logic into ES6 modules (`main.js`, `api.js`, `ui.js`, `utils.js`).

## 🎨 UI/UX Polish

- **Glassmorphism Header:** - Applied a backdrop-blur effect (`backdrop-filter: blur(12px)`) with a semi-transparent background for a modern, frosted aesthetic.
- **Visual Enhancements:**
    - **Invisible Scrollbars:** Hid native browser scrollbars globally while maintaining scroll functionality for a cleaner look.
    - **Glowing Language Dots:** Added a `box-shadow` glow effect to language indicators.
    - **Interactive Hover States:** implemented `:has()` selectors on Repo Cards to prevent card lift when clicking inner buttons, and added distinct hover states for buttons and links.
    - **Copy Feedback:** Added an active scale animation (click press effect) to the "Copy Clone URL" button.
- **Empty States:**
    - Added a visual illustration (icon + message) for empty search results or zero-repository users, replacing plain text errors.
- **Filter UI Overhaul:**
    - Redesigned filters (Language, Topic, Sort) to use a "Pill" shape design.
    - Removed browser-default styling from Select inputs for consistent dark theming.

## 📱 Mobile Responsiveness

- **Adaptive Layouts:**
    - **Profile:** Profile info and stats now stack vertically on smaller screens.
    - **Header:** Controls, search bar, and settings dropdown now stack gracefully on mobile devices.
    - **Filters:** Sort and Filter inputs expand to full width for easier touch interaction.
- **Touch Optimizations:** Increased touch targets for buttons and inputs on mobile viewports.

## 🚀 New Features

- **Global Settings Menu:**
    - Introduced a "Settings" dropdown in the header consolidating Theme Selection and GitHub Token Input.
    - Added a "Show/Hide" toggle for the token password field.
- **Persistent Search History:**
    - Added a custom dropdown in the search bar showing the last 10 searched users.
- **Modals:**
    - **Download Modal:** Restored multi-column layout for desktop and ensured full-width adaptation for mobile.
    - **Readme/Commits:** optimized modal containers to prevent horizontal stretching.

## 💾 Backend & Database

- **Database Schema Updates:**
    - Added `SearchHistory` model to track user searches.
    - Added `AppConfig` model for persistent GitHub Token storage.
- **Infinite Caching Strategy:**
    - Implemented a "cache-first" logic where data persists in `project.db` indefinitely unless a manual "Refresh" is triggered.
- **Rate Limit Handling:**
    - UI now displays a warning icon (⚠️) with a tooltip if the GitHub API rate limit is hit, rather than breaking the UI.
