from enum import Enum


class RepoStatus(str, Enum):
    """Status of a tracked repository version check."""
    NOT_CHECKED = "Not Checked"
    UNKNOWN = "Unknown"


# Default Values
DEFAULT_DOWNLOAD_DIR = "downloads"
DEFAULT_GITHUB_API_URL = "https://api.github.com"
