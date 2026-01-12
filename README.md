<p align="center">
  <img src="static/assets/octocat.svg" alt="GitNexus Logo" width="120"/>
</p>

<h1 align="center"><a href="https://qtremors.github.io/scrap/projects/demo/demo-git-nexus/">GitNexus</a></h1>

<p align="center">
  A comprehensive, self-hosted dashboard designed to bridge the gap between GitHub's vast repository network and your local machine.
</p>
<p align="center">
  It functions as a hybrid between a <b>User Discovery Engine</b>, a <b>Repository Analyzer</b>, and a <b>Personal Asset Watchtower</b>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-blue?logo=python" alt="Python">
  <img src="https://img.shields.io/badge/Flask-3.1.2-green?logo=flask" alt="Flask">
  <img src="https://img.shields.io/badge/License-TSL-red" alt="License">
</p>

> [!NOTE]
> **Personal Project** 🎯 I built this to solve my own need for better analyzing and archiving GitHub tools. It bridges the gap between "browsing" code and "owning" it locally.

## Live Website 

**➡️ [Legacy Static Demo](https://qtremors.github.io/scrap/projects/demo/demo-git-nexus/)**

> **Live Demo Limitations**: The live link is a legacy static prototype (v0.1). It **does not** include the active downloader or Python backend features of this v2.0 release.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔍 **Deep Discovery** | Instantly fetch standard user profiles, view bio stats, and render contribution graphs. |
| 📂 **Repo Explorer** | View a user's entire repository catalog in a sortable grid with language breakdown charts. |
| 🔭 **Asset Watchtower** | Build a "Watchlist" of tools. The system glows **Green** when a new release is detected. |
| 📥 **Server-Side Downloader** | Bypass browser limits to download assets directly to your local drive (`/Downloads/{Repo}/{File}`). |
| 🎨 **Theme Engine** | Switch between Dark Contrast, GitHub Dimmed, and AMOLED Deep Blue themes. |
| 🔒 **Secure Mode** | Mask your API token in the UI to prevent shoulder-surfing during demos. |

---

## 🚀 Quick Start

```bash
# Clone and navigate
git clone https://github.com/qtremors/git-nexus.git
cd git-nexus

# Install dependencies (using uv)
uv sync

# Run the application
uv run app.py
```

Visit **http://127.0.0.1:5000**

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.11+, Flask, SQLAlchemy (SQLite), GitHub REST API |
| **Frontend** | Vanilla JavaScript (ES6), Glassmorphism CSS, Jinja2 Templates |
| **Tools** | `uv` (Package Manager), `marked.js` (Markdown Parsing) |

---

## 📁 Project Structure

```
git-nexus/
├── app/                  # Flask Backend (Routes, Models, Services)
├── static/               # Frontend Assets (CSS, JS, Images)
├── templates/            # Jinja2 HTML Templates
├── DEVELOPMENT.md        # Developer documentation
├── CHANGELOG.md          # Version history
├── LICENSE.md            # License terms
└── README.md
```

---

## 🧪 Testing

*(Tests are planned for a future update)*

```bash
# Future command
uv run pytest
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Architecture, setup, API reference |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [LICENSE.md](LICENSE.md) | License terms and attribution |

---

## 📄 License

**Tremors Source License (TSL)** - Source-available license allowing viewing, forking, and derivative works with **mandatory attribution**. Commercial use requires written permission.

See [LICENSE.md](LICENSE.md) for full terms.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/qtremors">Tremors</a>
</p>
