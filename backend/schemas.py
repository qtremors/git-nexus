from pydantic import BaseModel, Field


# ============================================
#                DISCOVERY
# ============================================


class FetchUserRequest(BaseModel):
    """Request to fetch a GitHub user."""
    username: str = Field(..., min_length=1, max_length=80)
    token: str | None = None


class CommitCountRequest(BaseModel):
    """Request to get commit count for a repo."""
    owner: str
    repo: str
    token: str | None = None


class RepoReadmeRequest(BaseModel):
    """Request to fetch a repo's README."""
    owner: str
    repo: str
    token: str | None = None


class RepoCommitsRequest(BaseModel):
    """Request to fetch a repo's commits."""
    owner: str
    repo: str
    token: str | None = None
    since: str | None = None
    page: int = 1
    per_page: int = 30


class RepoItem(BaseModel):
    id: int
    name: str
    owner: str  # login


class DownloadReposRequest(BaseModel):
    """Request to download multiple repos."""
    repos: list[RepoItem]
    token: str | None = None


class ContributionGraphRequest(BaseModel):
    """Request for contribution graph data."""
    username: str
    repos: list[RepoItem]
    token: str | None = None


# ============================================
#               WATCHLIST
# ============================================


class AddByUrlRequest(BaseModel):
    """Request to add a repo by GitHub URL."""
    url: str
    token: str | None = None


class RemoveRepoRequest(BaseModel):
    """Request to remove a tracked repo."""
    id: int


class CheckUpdatesRequest(BaseModel):
    """Request to check for updates."""
    token: str | None = None


class WatchlistDetailsRequest(BaseModel):
    """Request for release details."""
    owner: str
    repo: str
    token: str | None = None
    limit: int = 30


class ReorderWatchlistRequest(BaseModel):
    """Request to reorder watchlist items."""
    ids: list[int]
    token: str | None = None


class TrackedRepoResponse(BaseModel):
    """Response model for tracked repository."""
    id: int
    owner: str
    name: str
    current_version: str
    latest_version: str | None
    description: str | None
    avatar_url: str | None
    html_url: str | None
    sort_order: int
    releases: list[dict] | None = None  # PERF-1: Include cached releases

    class Config:
        from_attributes = True


# ============================================
#               SETTINGS
# ============================================


class TokenRequest(BaseModel):
    """Request to save token."""
    token: str = ""


class PathRequest(BaseModel):
    """Request to save download path."""
    path: str


class DownloadAssetRequest(BaseModel):
    """Request to download an asset."""
    url: str
    filename: str
    repo_name: str
    token: str | None = None


class ThemeRequest(BaseModel):
    """Request to save theme."""
    theme: str


class LastRepoRequest(BaseModel):
    """Request to save last active repository ID."""
    repo_id: int | None
