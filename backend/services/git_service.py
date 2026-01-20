import asyncio
import io
import shutil
import subprocess
import tarfile
from datetime import datetime, timezone
from pathlib import Path

from git import InvalidGitRepositoryError, Repo
from git.exc import GitCommandError


class GitService:
    """Service for Git repository operations."""

    @staticmethod
    def is_valid_repo(path: str) -> bool:
        """Check if a path is a valid Git repository."""
        try:
            Repo(path)
            return True
        except InvalidGitRepositoryError:
            return False

    @staticmethod
    def get_repo_name(path: str) -> str:
        """Extract repository name from path."""
        return Path(path).name

    @staticmethod
    async def clone_repo(url: str, dest: str) -> None:
        """
        Clone a remote repository to a destination path (runs in thread pool).

        Args:
            url: Git remote URL
            dest: Destination directory path
        """
        loop = asyncio.get_running_loop()
        
        def _clone():
            dest_path = Path(dest)
            dest_path.mkdir(parents=True, exist_ok=True)
            Repo.clone_from(url, dest_path)

        await loop.run_in_executor(None, _clone)

    @staticmethod
    async def get_commits(
        repo_path: str, limit: int = 100, branch: str | None = None
    ) -> list[dict]:
        """
        Get commits from a repository (runs in thread pool).

        Args:
            repo_path: Path to the repository
            limit: Maximum number of commits to return
            branch: Branch name (defaults to active branch)

        Returns:
            List of commit dictionaries
        """
        loop = asyncio.get_running_loop()

        def _get_commits_sync():
            repo = Repo(repo_path)

            if branch:
                commits = repo.iter_commits(branch, max_count=limit)
            else:
                commits = repo.iter_commits(max_count=limit)

            result = []
            for commit in commits:
                commit_date = datetime.fromtimestamp(commit.committed_date, tz=timezone.utc)

                result.append({
                    "hash": commit.hexsha,
                    "short_hash": commit.hexsha[:7],
                    "message": commit.message.split("\n")[0].strip(),
                    "author": commit.author.name,
                    "author_email": commit.author.email,
                    "date": commit_date.isoformat(),
                })
            return result

        return await loop.run_in_executor(None, _get_commits_sync)

    @staticmethod
    async def checkout_to_worktree(
        repo_path: str, commit_hash: str, worktree_path: str
    ) -> Path:
        """
        Create a git worktree for a specific commit (runs in thread pool).

        Falls back to git archive extraction if worktree fails.

        Args:
            repo_path: Path to the original repository
            commit_hash: Commit hash to checkout
            worktree_path: Path for the new worktree

        Returns:
            Path to the created worktree
        """
        loop = asyncio.get_running_loop()

        def _checkout_sync():
            repo = Repo(repo_path)
            worktree = Path(worktree_path)

            # Create parent directories
            worktree.parent.mkdir(parents=True, exist_ok=True)

            # Try git worktree first
            try:
                repo.git.worktree("add", "--detach", str(worktree), commit_hash)
                return worktree
            except GitCommandError as e:
                # Worktree might already exist or be locked
                if worktree.exists():
                    return worktree

                # Fallback: Use git archive to extract files
                try:
                    worktree.mkdir(parents=True, exist_ok=True)

                    result = subprocess.run(
                        ["git", "archive", commit_hash],
                        cwd=repo_path,
                        capture_output=True,
                        check=True,
                    )

                    tar_data = io.BytesIO(result.stdout)
                    with tarfile.open(fileobj=tar_data, mode="r") as tar:
                        # CVE-2007-4559: Safe extraction with member validation
                        def is_safe_member(member: tarfile.TarInfo, dest: Path) -> bool:
                            """Check if tar member is safe to extract."""
                            # Reject absolute paths
                            if member.name.startswith('/') or member.name.startswith('\\'):
                                return False
                            # Reject path traversal
                            if '..' in member.name:
                                return False
                            # Ensure resolved path is within destination
                            target = (dest / member.name).resolve()
                            return target.is_relative_to(dest.resolve())
                        
                        safe_members = [m for m in tar.getmembers() if is_safe_member(m, worktree)]
                        tar.extractall(path=worktree, members=safe_members)

                    return worktree

                except Exception as fallback_error:
                    if worktree.exists():
                        shutil.rmtree(worktree, ignore_errors=True)
                    raise RuntimeError(
                        f"Failed to create workspace. Worktree error: {e}. "
                        f"Fallback error: {fallback_error}"
                    )

        return await loop.run_in_executor(None, _checkout_sync)

    @staticmethod
    async def remove_worktree(repo_path: str, worktree_path: str) -> None:
        """
        Remove a git worktree (runs in thread pool).

        Args:
            repo_path: Path to the original repository
            worktree_path: Path to the worktree to remove
        """
        loop = asyncio.get_running_loop()

        def _remove_sync():
            try:
                repo = Repo(repo_path)
                repo.git.worktree("remove", "--force", str(worktree_path))
            except GitCommandError:
                # If worktree remove fails, try to clean up manually
                worktree = Path(worktree_path)
                if worktree.exists():
                    shutil.rmtree(worktree, ignore_errors=True)

        await loop.run_in_executor(None, _remove_sync)


    @staticmethod
    async def get_file_tree(repo_path: str, commit_hash: str = "HEAD") -> list[dict]:
        """
        Get the file tree for a specific commit (runs in thread pool).

        Args:
            repo_path: Path to the repository
            commit_hash: Commit hash (defaults to HEAD)

        Returns:
            List of file/directory entries with nested structure
        """
        loop = asyncio.get_running_loop()

        def _get_tree_sync():
            repo = Repo(repo_path)
            
            try:
                commit = repo.commit(commit_hash)
            except Exception:
                # Fallback to HEAD if commit not found
                commit = repo.head.commit
            
            def build_tree(tree, path: str = "") -> list[dict]:
                """Recursively build tree structure."""
                items: list[dict] = []
                
                for item in tree:
                    full_path = f"{path}/{item.name}" if path else item.name
                    
                    if item.type == "tree":
                        # Directory
                        items.append({
                            "name": item.name,
                            "path": full_path,
                            "type": "directory",
                            "children": build_tree(item, full_path),
                        })
                    else:
                        # File
                        items.append({
                            "name": item.name,
                            "path": full_path,
                            "type": "file",
                            "size": item.size if hasattr(item, 'size') else 0,
                        })
                
                # Sort: directories first, then files, both alphabetically
                items.sort(key=lambda x: (x["type"] == "file", x["name"].lower()))
                return items
            
            return build_tree(commit.tree)

        return await loop.run_in_executor(None, _get_tree_sync)

    async def get_file_content(
        self, repo_path: str, commit_hash: str, file_path: str
    ) -> str:
        """
        Get the content of a file at a specific commit.

        Args:
            repo_path: Path to the repository
            commit_hash: Commit hash (or "HEAD")
            file_path: Path to the file within the repository

        Returns:
            File content as string
        """
        loop = asyncio.get_running_loop()

        def _get_content_sync() -> str:
            repo = Repo(repo_path)
            
            try:
                commit = repo.commit(commit_hash)
            except Exception:
                commit = repo.head.commit
            
            # Navigate to the file in the tree
            try:
                blob = commit.tree / file_path
                return blob.data_stream.read().decode("utf-8", errors="replace")
            except KeyError:
                raise FileNotFoundError(f"File not found: {file_path}")

        return await loop.run_in_executor(None, _get_content_sync)


# Singleton instance
git_service = GitService()
