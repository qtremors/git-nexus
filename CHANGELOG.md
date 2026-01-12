# GitNexus Changelog

> **Project:** GitNexus
> **Version:** 2.0.0
> **Last Updated:** 2026-01-12

---

## [2.0.0] - 2025-01-12

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