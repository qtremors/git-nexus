# 🧭 GitNexus

**GitNexus** is a comprehensive, self-hosted dashboard designed to bridge the gap between GitHub's vast repository network and your local machine. It functions as a hybrid between a **User Discovery Engine**, a **Repository Analyzer**, and a **Personal Asset Watchtower**.

While GitHub is built for collaboration and coding, GitNexus is built for **consumption and management**. It allows you to explore user profiles deeply, analyze their repository statistics without navigating away, and most importantly, treat GitHub repositories like a personal "App Store." You can track specific tools for updates, visualize version history, and download assets directly to your server or local drive, bypassing standard browser limitations.

Whether you are a data hoarder, a developer tracking dependencies, or just someone who loves open-source tools, GitNexus provides a centralized, private interface to manage the software you care about.

> ---
> **🌐 Live Demo (Legacy Prototype)**
>
> The current version of GitNexus utilizes a **Python Flask backend** to handle server-side downloads, maintain a local database, and bypass browser API restrictions. Because of these advanced capabilities, it is designed to be self-hosted locally.
>
> You can view the **[Legacy Static Frontend (v0.1)](https://qtremors.github.io/repo-nav/)** to see the original UI concept.
> *Note: The legacy demo **does not** include the Asset Watchtower, Downloader, or Theme Engine.*

---

## ✨ Features

### 🔍 Deep Discovery & Analysis
* **User Profiler:** Instantly fetch any public GitHub user profile to view bio, follower stats, and a visual contribution graph.
* **Repository Explorer:** View a user's entire repository catalog in a sortable, filterable grid.
* **Instant Insights:** Render `README.md` files, view commit history, and check language statistics without opening new tabs.
* **Advanced Filtering:** Filter repositories by **Topic**, **Language**, **Star Count**, or **Commit Activity**.
* **Data Visualization:** View analytics charts breaking down language usage and repository sizes.

### 🔭 The Asset Watchtower
* **Repository Tracking:** Build a personalized "Watchlist" of repositories you want to monitor (e.g., tools, libraries, apps).
* **Smart Update Detection:** The system automatically compares your local history with the latest GitHub tags.
* **Visual Notifications:** Cards glow **Green** 🟢 and display a "Update Available" badge when a new version is released.
* **Release History:** Expand any card to view the latest 3 releases, complete with changelogs and publication dates.

### 📥 High-Performance Downloader
* **Server-Side Pipeline:** Downloads are handled by the Python backend, not your browser. This bypasses pop-up blockers, speed throttling, and multiple-file restrictions.
* **Automated Organization:** Assets are saved to your configured directory in a structured format: `/Downloads/{RepoName}/{FileName}`.
* **Bulk Actions:** Select multiple repositories and download their source code or binary assets in a single click.

### ⚙️ System & Customization
* **Theme Engine:** Includes three distinct visual modes:
    * **Dark Contrast:** Deep blues and high contrast (Default).
    * **Dimmed:** Matches GitHub's native "Dimmed" dark mode.
    * **Deep Blue:** An AMOLED-friendly pitch-black theme.
* **Data Portability:** Export your entire watchlist to JSON for backup or import it to another GitNexus instance.
* **Secure Mode:** API Tokens are visually masked in the UI to prevent shoulder-surfing.

## 🛠️ Tech Stack

* **Backend:** Python 3.11+, Flask, SQLAlchemy (SQLite).
* **Frontend:** Vanilla JavaScript (ES6 Modules), CSS3 Variables, Glassmorphism UI.
* **API:** GitHub REST API.
* **Libraries:** `marked.js` (Markdown parsing).

## 🚀 Installation & Setup

### Prerequisites
* Python 3.11+
* `uv` (Python Package Manager)

### 1. Clone the Repository
```bash
git clone https://github.com/qtremors/git-nexus.git
cd git-nexus
````

### 2. Install Dependencies

Using `uv` (Recommended):

```bash
uv sync
```

### 3. Run the Application

```bash
uv run app.py
```

### 4. Access GitNexus

Open your browser and navigate to:

**http://127.0.0.1:5000**

---

## 📂 Project Structure

```
## 📂 Project Structure

git-nexus/
├── app/                             # Main application package
│   ├── routes/                      # Flask Blueprints (Route controllers)
│   │   ├── api.py                   # JSON API endpoints (Data, Logic, & Downloads)
│   │   └── main.py                  # Frontend routes (Serves HTML pages)
│   ├── __init__.py                  # App factory, DB initialization, & Blueprint registration
│   ├── models.py                    # SQLAlchemy Database Models (TrackedRepo, CacheEntry)
│   └── services.py                  # Business Logic (GitHub API wrapper, Caching strategies)
├── static/                          # Frontend static assets
│   ├── assets/                      # Images and Icons
│   │   └── octocat.svg              # Favicon/Logo asset
│   ├── css/                         # Modular CSS Architecture
│   │   ├── filters.css              # Styles for search & filter inputs
│   │   ├── graph.css                # Styles for the contribution graph container
│   │   ├── header.css               # Glassmorphism navigation bar styles
│   │   ├── modals.css               # Styles for pop-ups (README, Commits, Downloads)
│   │   ├── profile.css              # User profile & bio section styles
│   │   ├── repos.css                # Repository grid & card styles
│   │   ├── settings.css             # Layout for the Settings page
│   │   ├── style.css                # Global resets, typography, & shared components
│   │   ├── theme.css                # CSS Variables for Dark/Dimmed/Blue themes
│   │   └── watchlist.css            # Styles specific to the Watchtower Dashboard
│   └── js/                          # ES6 JavaScript Modules
│       ├── api.js                   # Centralized API fetch wrapper & error handling
│       ├── main.js                  # Logic for Discovery Page (Search, Filtering)
│       ├── settings.js              # Logic for Settings (Theme switching, Token saving)
│       ├── ui.js                    # DOM Rendering functions (Cards, Lists, Stats)
│       ├── utils.js                 # Shared helpers (Toast, Clipboard, Theme apply)
│       └── watchlist.js             # Logic for Watchlist (Update checks, Accordions)
├── templates/                       # Jinja2 HTML Templates
│   ├── partials/                    # Reusable HTML Components
│   │   ├── filters.html             # Filter controls for generic lists
│   │   ├── filters_repos.html       # Specific filters for the Repo Discovery grid
│   │   ├── graph.html               # Contribution graph container
│   │   ├── header.html              # Main navigation bar partial
│   │   ├── modals.html              # Hidden modal structures (popups)
│   │   └── profile.html             # User profile summary section
│   ├── index.html                   # Main Landing/Discovery Page
│   ├── settings.html                # Configuration & Settings Page
│   └── watchlist.html               # Watchlist Dashboard Page
├── .git/                            # Git Version Control metadata
├── .gitignore                       # Specifies intentionally untracked files
├── app.py                           # Application Entry Point (Run this to start)
├── CHANGELOG.md                     # Version history and release notes
├── config.py                        # Flask configuration settings (Secret keys, Paths)
├── pyproject.toml                   # Python dependencies & build configuration (uv/pip)
└── README.md                        # Project documentation
```


## ⚙️ Configuration Guide

### 1. Set Local Storage Path

Go to **Settings > Local Storage**. Enter the absolute path where you want files to be saved (e.g., `D:/Software/GitNexus` or `/home/user/downloads`). The system will automatically create subfolders for every repository you download.

### 2. Add GitHub Access Token (Recommended)

To increase your API rate limit (from 60 to 5,000 requests/hour) and access private repositories, you should add a **Fine-grained Personal Access Token**.

**How to obtain a Granular Token:**

1. Log in to GitHub and go to **Settings > Developer Settings**.
    
2. Select **Personal access tokens > Fine-grained tokens**.
    
3. Click **Generate new token**.
    
4. **Repository Access:** Choose "All repositories" (easiest) or "Only select repositories".
    
5. **Permissions:** Under "Repository permissions", ensure you grant **Read-only** access to:
    
    - `Contents` (to read code and READMEs)
        
    - `Metadata` (to read stars, forks, and release info)
        
6. Generate the token and copy the string (starts with `github_pat_...`).
    

**How to add it to GitNexus:**

1. Navigate to **Settings > GitHub Access**.
    
2. Paste your token into the input field.
    
3. Click **Save Token**.
    

### 3. Import/Export Data

If you are moving to a new machine, use the **Export JSON** button in Settings to download your watchlist configuration. You can restore it later using **Import JSON**.

---

Made with 💖 by **Tremors**