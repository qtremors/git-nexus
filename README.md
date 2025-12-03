# 🧭 GitNexus (v1.0.0)

**GitNexus** is a powerful, self-hosted web application for exploring and filtering GitHub repositories. It serves as a robust interface to the GitHub API, featuring server-side caching, advanced filtering, and a clean, responsive UI.

Built with **Flask** and **Vanilla JavaScript**, it solves the problem of API rate limiting by caching data in a local SQLite database, making repeated searches instant.

## 🌐 Live Demo (Legacy Version)
> **Note:** The live link below demonstrates the frontend interface (v0.1.0). 
> The current version (v1.0.0) in this repository features a Flask backend with caching and advanced filtering, which requires local installation.

* **View Legacy Static Demo:** [https://qtremors.github.io/repo-nav](https://qtremors.github.io/repo-nav/)


## ✨ Features

* **🔍 Deep Repository Search:** Instantly fetch and display all public repositories for any GitHub user.
* **⚡ Server-Side Caching:** automatically caches API responses (Profiles, Repo Lists, READMEs) in a local SQLite database (`project.db`) for 30 minutes. This drastically reduces API calls and speeds up subsequent loads.
* **📂 Advanced Filtering:**
    * Filter by Repository Name.
    * Filter by **Language** (Python, JavaScript, Go, etc.).
    * Filter by **Topics**.
    * Filter by **Commit Count** (Min/Max range).
* **📄 Markdown Rendering:** View repository `README.md` files rendered beautifully in a modal without leaving the app.
* **clock_history Commit History:** Browse the latest commits for any repository directly within the interface.
* **🎨 Theming:** Three built-in themes:
    * **Default:** High Contrast Dark.
    * **Regular:** GitHub Dimmed.
    * **Contrast:** Deep Blue/Purple.
* **📥 Direct Downloads:** One-click download for repository source code (`.zip`).


## 🛠️ Tech Stack

* **Backend:** Python, Flask, SQLAlchemy (SQLite).
* **Frontend:** HTML5, CSS3 (CSS Variables), JavaScript (ES6+).
* **API:** GitHub REST API.
* **Utilities:** `marked.js` (Markdown parsing).


## 🚀 Installation & Setup

### Prerequisites
* Python 3.11+
* `uv` by astral **(Python Package & Environment Manager)**
```bash
# uv installation command
pip install uv
```

### 1. Clone the Repository
```bash
git clone https://github.com/qtremors/git-nexus.git
```

### 2. Install Dependencies & activate the virtual environment

```python
# Change the directory to the repo
cd git-nexus

# create the environment and install dependencies
uv sync
```

### 3. Run the Application

```python
uv run app.py
```

### 4. Access GitNexus

Open your browser and navigate to:

http://127.0.0.1:5000

---

## 📂 Project Structure

Plaintext

```
gitnexus/
├── instance/
│   └── project.db       # SQLite Database (Auto-created)
├── static/
│   ├── assets/          # Images and Icons
│   ├── css/
│   │   ├── style.css    # Base layout & typography
│   │   ├── repo.css     # Repository grid & card styles
│   │   └── theme.css    # Color variables & themes
│   └── js/
│       └── script.js    # Frontend logic (Fetch, Modals, UI)
├── templates/
│   └── index.html       # Main Application View
├── app.py               # Flask Backend & API Routes
├── models.py            # Database Models (CacheEntry)
└── README.md            # Documentation
```

---

## ⚙️ Configuration

### GitHub Token (Optional but Recommended)

To increase your API rate limit (from 60 requests/hr to 5,000/hr), you can input a **Personal Access Token** in the UI.

1. Generate a token at [GitHub Settings > Developer Settings](https://github.com/settings/tokens).
    
2. Paste it into the "GitHub Token" field in the GitNexus header.
    
3. The token is sent securely to the Flask backend for that session's requests.

---
Made with 💖 by **Tremors**
