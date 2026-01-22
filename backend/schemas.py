from pydantic import BaseModel, Field, ConfigDict


# ============================================
#                DISCOVERY
# ============================================


class FetchUserRequest(BaseModel):
    """Request to fetch a GitHub user's profile and repositories."""
    username: str = Field(
        ..., 
        min_length=1, 
        max_length=80,
        examples=["torvalds", "gaearon"],
        description="GitHub username to fetch"
    )
    token: str | None = Field(
        default=None,
        description="Optional GitHub token for higher rate limits"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"username": "torvalds"}
        }
    )


class CommitCountRequest(BaseModel):
    """Request to get commit count for a repository."""
    owner: str = Field(..., examples=["facebook"], description="Repository owner")
    repo: str = Field(..., examples=["react"], description="Repository name")
    token: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"owner": "facebook", "repo": "react"}
        }
    )


class RepoReadmeRequest(BaseModel):
    """Request to fetch a repository's README."""
    owner: str = Field(..., examples=["microsoft"])
    repo: str = Field(..., examples=["vscode"])
    token: str | None = None


class RepoCommitsRequest(BaseModel):
    """Request to fetch a repository's commits."""
    owner: str = Field(..., examples=["vercel"])
    repo: str = Field(..., examples=["next.js"])
    token: str | None = None
    since: str | None = Field(default=None, examples=["2024-01-01T00:00:00Z"])
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=30, ge=1, le=100)


class RepoItem(BaseModel):
    """Repository item for batch operations."""
    id: int = Field(..., examples=[1234567])
    name: str = Field(..., examples=["my-repo"])
    owner: str = Field(..., examples=["octocat"])


class DownloadReposRequest(BaseModel):
    """Request to download multiple repositories as ZIP archives."""
    repos: list[RepoItem]
    token: str | None = None


class ContributionGraphRequest(BaseModel):
    """Request for contribution graph data."""
    username: str = Field(..., examples=["octocat"])
    repos: list[RepoItem]
    token: str | None = None


# ============================================
#               WATCHLIST
# ============================================


class AddByUrlRequest(BaseModel):
    """Request to add a repository by GitHub URL."""
    url: str = Field(
        ..., 
        examples=["https://github.com/facebook/react"],
        description="Full GitHub repository URL"
    )
    token: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"url": "https://github.com/facebook/react"}
        }
    )


class RemoveRepoRequest(BaseModel):
    """Request to remove a tracked repository."""
    id: int = Field(..., examples=[1], description="ID of the tracked repo to remove")


class CheckUpdatesRequest(BaseModel):
    """Request to check all tracked repositories for updates."""
    token: str | None = None


class WatchlistDetailsRequest(BaseModel):
    """Request for release details of a repository."""
    owner: str = Field(..., examples=["tailwindlabs"])
    repo: str = Field(..., examples=["tailwindcss"])
    token: str | None = None
    limit: int = Field(default=30, ge=1, le=100)


class ReorderWatchlistRequest(BaseModel):
    """Request to reorder watchlist items."""
    ids: list[int] = Field(..., examples=[[3, 1, 2]], description="Ordered list of repo IDs")
    token: str | None = None


class TrackedRepoResponse(BaseModel):
    """Response model for a tracked repository."""
    id: int
    owner: str
    name: str
    current_version: str
    latest_version: str | None
    description: str | None
    avatar_url: str | None
    html_url: str | None
    sort_order: int
    releases: list[dict] | None = None

    model_config = ConfigDict(from_attributes=True)


# ============================================
#               SETTINGS
# ============================================


class TokenRequest(BaseModel):
    """Request to save GitHub token."""
    token: str = Field(
        default="",
        description="GitHub personal access token (leave empty to clear)"
    )


class PathRequest(BaseModel):
    """Request to save download path."""
    path: str = Field(
        ..., 
        examples=["C:/Users/You/Downloads/GitNexus"],
        description="Absolute path for downloads"
    )


class DownloadAssetRequest(BaseModel):
    """Request to download a release asset."""
    url: str = Field(..., description="Asset download URL")
    filename: str = Field(..., examples=["release-v1.0.0.zip"])
    repo_name: str = Field(..., examples=["my-app"])
    token: str | None = None


class ThemeRequest(BaseModel):
    """Request to save theme preference."""
    theme: str = Field(
        ..., 
        pattern=r"^(default|dark|light|midnight|aurora|sunset)$",
        description="Valid themes: default, dark, light, midnight, aurora, sunset",
        examples=["dark", "midnight"]
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"theme": "dark"}
        }
    )


class LastRepoRequest(BaseModel):
    """Request to save last active repository ID."""
    repo_id: int | None = Field(
        default=None,
        examples=[1],
        description="ID of the last active repository (null to clear)"
    )
