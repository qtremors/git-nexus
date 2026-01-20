import shutil
from pathlib import Path

from config import settings
from services.git_service import git_service


class WorkspaceService:
    """Service for managing commit workspaces."""

    def __init__(self) -> None:
        """Initialize workspace service."""
        self._workspaces_dir = settings.workspaces_dir

    def get_workspace_path(self, repo_name: str, commit_hash: str) -> Path:
        """Get the workspace path for a repo/commit combination."""
        # Security: Validate commit hash to prevent path traversal
        if not commit_hash.isalnum():
            raise ValueError(f"Invalid commit hash: {commit_hash}")
            
        short_hash = commit_hash[:7]
        return self._workspaces_dir / repo_name / short_hash

    def workspace_exists(self, repo_name: str, commit_hash: str) -> bool:
        """Check if a workspace already exists."""
        try:
            workspace_path = self.get_workspace_path(repo_name, commit_hash)
            return workspace_path.exists()
        except ValueError:
            return False

    async def create_workspace(
        self, repo_path: str, repo_name: str, commit_hash: str
    ) -> Path:
        """
        Create an isolated workspace for a commit.
        Uses git worktree for efficient disk usage.
        """
        workspace_path = self.get_workspace_path(repo_name, commit_hash)

        if workspace_path.exists():
            return workspace_path

        await git_service.checkout_to_worktree(repo_path, commit_hash, str(workspace_path))
        return workspace_path

    async def delete_workspace(
        self, repo_path: str, repo_name: str, commit_hash: str
    ) -> bool:
        """Delete a workspace."""
        workspace_path = self.get_workspace_path(repo_name, commit_hash)

        if not workspace_path.exists():
            return False

        try:
            await git_service.remove_worktree(repo_path, str(workspace_path))
        except Exception:
            shutil.rmtree(workspace_path, ignore_errors=True)

        return True

    def delete_all_repo_workspaces(self, repo_name: str) -> int:
        """Delete all workspaces for a repository."""
        repo_workspaces = self._workspaces_dir / repo_name

        if not repo_workspaces.exists():
            return 0

        count = len(list(repo_workspaces.iterdir()))
        shutil.rmtree(repo_workspaces, ignore_errors=True)
        return count

    def list_workspaces(self, repo_name: str | None = None) -> list[dict]:
        """List all workspaces, optionally filtered by repo."""
        workspaces = []

        if repo_name:
            search_dirs = [self._workspaces_dir / repo_name]
        else:
            if not self._workspaces_dir.exists():
                return []
            search_dirs = [d for d in self._workspaces_dir.iterdir() if d.is_dir()]

        for repo_dir in search_dirs:
            if not repo_dir.exists():
                continue

            for commit_dir in repo_dir.iterdir():
                if commit_dir.is_dir():
                    workspaces.append({
                        "repo_name": repo_dir.name,
                        "commit_hash": commit_dir.name,
                        "path": str(commit_dir),
                    })

        return workspaces


# Singleton instance
workspace_service = WorkspaceService()
