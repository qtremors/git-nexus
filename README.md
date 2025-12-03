# 🧭 GitNexus (v2.0.0)

**GitNexus** is a self-hosted **GitHub Asset Manager & Watchtower**. It has evolved from a simple repository viewer into a powerful tool that allows you to track your favorite repositories, detect new software releases, and download assets directly to your local machine without browser restrictions.

Beyond just viewing repositories, GitNexus now acts as a personal "App Store" dashboard for your GitHub tools.

---

## ✨ Key Features

### 🔭 Asset Watchlist (v2.0)
* **Track Repositories:** Add any public GitHub repository to your personal watchlist using its URL.
* **Update Detection:** Automatically compares the latest release tag on GitHub with your locally tracked version.
* **Visual Indicators:** Cards glow green 🟢 when an update is available.
* **Release History:** View the latest 3 releases and their assets in an accordion view without leaving the dashboard.

### 📥 Power Downloader
* **Server-Side Downloading:** Assets are downloaded by the Python backend, bypassing browser pop-up blockers and speed throttling.
* **Custom Storage:** Configure a specific folder (e.g., `D:/MyTools`) where downloads are saved.
* **Auto-Organization:** Files are automatically sorted into subfolders: `/Downloads/RepoName/FileName`.

### 🔍 Discovery & Analysis
* **Deep User Search:** Fetch and filter all public repositories for any user.
* **Advanced Filtering:** Filter by Language, Topic, Star count, and Commit activity.
* **Markdown Viewer:** Render `README.md` files instantly in a modal.
* **Analytics:** View visualizations of repository data and commit history.

### ⚙️ Advanced Configuration
* **Data Portability:** Import and Export your watchlist as JSON to sync between machines.
* **Theme Engine:** Choose between **Dark Contrast**, **Dimmed**, and **Deep Blue** themes.
* **Token Management:** Securely store your GitHub Personal Access Token to increase API rate limits (5,000 req/hr).

---

## 🛠️ Tech Stack

* **Backend:** Python 3.11+, Flask, SQLAlchemy (SQLite).
* **Frontend:** Vanilla JavaScript (ES6 Modules), CSS3 Variables, Glassmorphism UI.
* **API:** GitHub REST API.
* **Libraries:** `marked.js` (Markdown parsing).

---

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

Plaintext

```
gitnexus/
├── instance/
│   └── project.db       # SQLite Database (Stores Watchlist & Cache)
├── static/
│   ├── css/             # Modular CSS
│   │   ├── header.css
│   │   ├── watchlist.css
│   │   ├── settings.css
│   │   └── ...
│   ├── js/              # ES6 Modules
│   │   ├── main.js      # Discover Page Logic
│   │   ├── watchlist.js # Dashboard Logic
│   │   ├── api.js       # Centralized API Handler
│   │   └── ...
├── templates/
│   ├── partials/        # Reusable HTML Components
│   ├── index.html       # Discover Page
│   ├── watchlist.html   # Watchlist Dashboard
│   └── settings.html    # Configuration Page
├── app.py               # Flask Entry Point
├── api.py               # API Routes & Logic
├── models.py            # DB Models (TrackedRepo, CacheEntry)
└── services.py          # GitHub API Interaction Helpers
```

---

## ⚙️ Configuration Guide

1. **Set Download Path:** Go to **Settings > Local Storage** and enter an absolute path (e.g., `C:/Users/You/Downloads/GitNexus`).
    
2. **Add Token:** Go to **Settings > GitHub Access** and paste a classic Personal Access Token (read-only is fine) to avoid rate limits.
    
3. **Import Data:** Use the **Import JSON** feature to restore a previously exported watchlist.
    

---

Made with 💖 by **Tremors**