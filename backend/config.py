from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    # Application
    app_name: str = "GitNexus"
    app_version: str = "3.0.1"
    debug: bool = False

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/gitnexus.db"

    # GitHub API
    github_api_url: str = "https://api.github.com"
    github_token: str | None = None

    # Server
    host: str = "127.0.0.1"
    port: int = 8000

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Paths
    data_dir: Path = Path(__file__).parent / "data"
    workspaces_dir: Path = Path(__file__).parent.parent / "workspaces"

    # Replay Server
    base_server_port: int = 9000

    # Configuration
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent.parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
