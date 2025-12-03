# Changelog

## v2.0.0 - The Asset Watchtower Update

**Major Release:** GitNexus has evolved from a simple repository viewer into a full-featured **Asset Watcher & Manager**.

### 🚀 New Features

- **Asset Watchlist:** - Dedicated dashboard to track repositories for new releases.
    
    - **Update Detection:** Visual indicators (Green Border/Badge) when a new version is available on GitHub compared to your local history.
        
    - **Add by URL:** Quickly track repositories by pasting their GitHub link.
        
- **Local Asset Downloader:** - **Bypass Browser Limits:** Downloads are now handled server-side (Python), allowing for bulk downloads without browser pop-up blockers.
    
    - **Custom Download Path:** Configure a specific local directory (e.g., `D:/Software/`) where assets are saved automatically in organized subfolders.
        
- **Data Management:** - **Import/Export:** Backup your entire watchlist to a JSON file and restore it on any machine.
    
- **Release Explorer:** - **Accordion UI:** View the latest 3 releases for any tracked repo directly in the card.
    
    - **Direct Links:** One-click download for binary assets or quick navigation to the GitHub Releases page.
        

### 🎨 UI/UX Overhaul

- **Dedicated Settings Page:** moved settings from a dropdown to a full-page interface with a visual Theme Grid and improved input layouts.
    
- **Metro-Style Dashboard:** Dark, sleek card design for the Watchlist with "Glassmorphism" headers.
    
- **Refined Navigation:** - Combined "Search Pill" in the header for the Discover page.
    
    - Simplified navigation flow between "Watchlist" and "Discover".
        
- **Visual Polish:**
    
    - Fixed card alignment issues using CSS Grid `align-items: start`.
        
    - Added "Secure Text" masking for API tokens (avoids browser password prompts).
        
    - Added a User Icon to the search bar for better context.
        

### 💾 Backend

- **New Database Models:** Added `TrackedRepo` to store version history and metadata.
    
- **API Expansion:** Added endpoints for `/watchlist`, `/download-asset`, and `/config/path`.
    
- **Smart Caching:** Release details are lazy-loaded on demand to ensure the dashboard loads instantly.
    
---
---
---

## v1.1.0 - Architecture & Polish

### 🏗️ Architecture & Refactoring

- **Modularization:** Refactored the monolithic codebase into a scalable modular structure.
    
    - **HTML:** Split `index.html` into reusable partials (`header.html`, `partials/header.html`, etc.).
        
    - **CSS:** Broken down into feature-specific modules (`header.css`, `watchlist.css`, `settings.css`).
        
    - **JavaScript:** Split logic into ES6 modules (`main.js`, `api.js`, `watchlist.js`).
        

### 🎨 UI/UX Polish

- **Glassmorphism Header:** Applied a backdrop-blur effect with a semi-transparent background.
    
- **Visual Enhancements:**
    
    - **Invisible Scrollbars:** Hid native browser scrollbars globally for a cleaner look.
        
    - **Glowing Language Dots:** Added a `box-shadow` glow effect to language indicators.
        
    - **Interactive Hover States:** Implemented `:has()` selectors on Repo Cards to prevent card lift when clicking inner buttons.
        
- **Empty States:** Added visual illustrations for empty search results.
    

### 📱 Mobile Responsiveness

- **Adaptive Layouts:** Profile info, Header controls, and Grids now stack gracefully on mobile devices.
    
- **Touch Optimizations:** Increased touch targets for buttons.
    

### 💾 Backend & Database

- **Infinite Caching Strategy:** Implemented "cache-first" logic where data persists in `project.db` indefinitely.
    
- **Rate Limit Handling:** UI now displays a warning icon (⚠️) if the GitHub API rate limit is hit.