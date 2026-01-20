<p align="center">
  <img src="frontend/public/octocat.svg" alt="GitNexus Logo" width="120"/>
</p>

<h1 align="center">GitNexus</h1>

<p align="center">
  <b>Your GitHub Command Center</b>
</p>

<p align="center">
  A powerful, self-hosted dashboard that bridges the gap between the cloud and your local machine.<br/>
  Discover users, track releases, and time-travel through commit history - all in one unified workspace.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-3.0.0-blue?style=flat&logo=git" alt="Version">
  <img src="https://img.shields.io/badge/Python-3.11+-blue?logo=python" alt="Python">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React">
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/License-TSL-red" alt="License">
</p>

> [!NOTE]
> **Personal Project** 🎯 I built this to bridge the gap between cloud and local development. Feel free to explore and learn from it!

> [!TIP]
> **Upgrading from v2.0.0?** See [MIGRATION.md](MIGRATION.md) for the complete upgrade guide.

---

## ✨ Features

### 🔍 Discovery Engine
Deep dive into any GitHub user's profile. Visualize statistics, filter repositories by language/topic, view contribution graphs, and download repos directly to your machine.

### 🔭 Asset Watchtower
Never miss a release again. Build a watchlist of your favorite tools, get visual indicators when updates are available, and download assets directly - bypassing browser limitations.

### ⏪ Repo Replay (NEW in v3.0.0)
"Time Travel" for your code. Add any Git repository, browse the complete commit history, and spin up isolated dev servers for any commit. Perfect for:
- Debugging regressions by comparing versions
- Demoing historical states to stakeholders
- Running multiple versions simultaneously

### ⚙️ Local-First Privacy
All data stays on your machine. SQLite database, local file storage, and encrypted secrets. No telemetry, no cloud dependencies.

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/qtremors/git-nexus.git
cd git-nexus

# Backend Setup
cd backend
uv sync
uv run uvicorn main:app --reload
# API server starts at http://127.0.0.1:8000

# Frontend Setup (new terminal)
cd frontend
npm install
npm run dev
# UI available at http://127.0.0.1:5173
```

**Visit** → http://127.0.0.1:5173

### Configuration (Optional)

Create `backend/.env` for enhanced security:

```env
# Generate with: uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FERNET_KEY=<your-generated-key>

# For higher GitHub API rate limits
GITHUB_TOKEN=<your-personal-access-token>
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind + Glassmorphism CSS |
| **Backend** | FastAPI (Python 3.11+), SQLAlchemy Async, Pydantic |
| **Database** | SQLite (aiosqlite) |
| **External API** | GitHub REST API v3 |

---

## 📁 Project Structure

```
git-nexus/
├── backend/                  # FastAPI async backend
│   ├── routers/              # API route handlers
│   ├── services/             # Business logic layer
│   ├── models/               # SQLAlchemy ORM models
│   ├── adapters/             # Runtime adapters (servers)
│   ├── utils/                # Crypto, security, logging
│   ├── data/                 # SQLite database
│   └── main.py               # Entry point
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── api/              # API client
│   │   ├── components/       # Reusable components
│   │   ├── pages/            # Route pages
│   │   └── store/            # State management
│   └── package.json
├── workspaces/               # Git worktrees for Replay
├── DEVELOPMENT.md            # Developer documentation
├── CHANGELOG.md              # Version history
├── MIGRATION.md              # v2 → v3 upgrade guide
├── LICENSE.md                # License terms
└── README.md
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Architecture, API reference, setup guide |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [MIGRATION.md](MIGRATION.md) | Upgrading from v2.0.0 |
| [LICENSE.md](LICENSE.md) | License terms and attribution |

---

## 🧪 Testing

```bash
# Backend Tests
cd backend
uv run pytest

# Frontend Build Check
cd frontend
npm run build
```

---

## 📄 License

**Tremors Source License (TSL)** - Source-available license allowing viewing, forking, and derivative works with **mandatory attribution**. Commercial use requires written permission.

See [LICENSE.md](LICENSE.md) for full terms.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/qtremors">Tremors</a>
</p>
