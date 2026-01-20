
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

from services.workspace_service import workspace_service
from services.git_service import git_service
from adapters.static_html import static_html_adapter
from config import settings

@pytest.mark.asyncio
async def test_workspace_service_path_traversal():
    """Test that path traversal attempts in commit hash are blocked."""
    repo_name = "test_repo"
    
    # Valid hash
    path = workspace_service.get_workspace_path(repo_name, "abcdef123456")
    assert "abcdef1" in str(path)
    
    # Invalid hash (path traversal)
    with pytest.raises(ValueError, match="Invalid commit hash"):
        workspace_service.get_workspace_path(repo_name, "../../etc/passwd")
        
    # Invalid hash (special chars)
    with pytest.raises(ValueError, match="Invalid commit hash"):
        workspace_service.get_workspace_path(repo_name, "hash;rm -rf /")

@pytest.mark.asyncio
async def test_git_service_async():
    """Verify that git methods are async."""
    import inspect
    assert inspect.iscoroutinefunction(git_service.clone_repo)
    assert inspect.iscoroutinefunction(git_service.get_commits)
    assert inspect.iscoroutinefunction(git_service.checkout_to_worktree)
    assert inspect.iscoroutinefunction(git_service.get_file_tree)

@pytest.mark.asyncio
async def test_static_html_adapter_hardening():
    """Test security validation in static html adapter."""
    
    # Invalid port (low)
    with pytest.raises(ValueError, match="Invalid port number"):
        await static_html_adapter.start(Path("/tmp"), 80, {})
        
    # Invalid port (high)
    with pytest.raises(ValueError, match="Invalid port number"):
        await static_html_adapter.start(Path("/tmp"), 70000, {})
        
    # Invalid path (outside workspaces)
    unsafe_path = Path("C:/Windows/System32")
    with pytest.raises(ValueError, match="Invalid workspace path"):
        await static_html_adapter.start(unsafe_path, 8080, {})
        
    # Valid inputs (mocked)
    safe_path = settings.workspaces_dir / "repo" / "hash"
