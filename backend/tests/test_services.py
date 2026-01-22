"""
Service Layer Tests for GitNexus Backend

Tests the core business logic in services.
"""

import pytest
import pytest_asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.workspace_service import workspace_service
from services.git_service import git_service
from adapters.static_html import static_html_adapter
from config import settings


# ============================================
#              WORKSPACE SERVICE
# ============================================

class TestWorkspaceService:
    """Tests for the workspace service."""
    
    def test_get_workspace_path_valid_hash(self):
        """Test valid commit hash generates correct path."""
        path = workspace_service.get_workspace_path("my-repo", "abc123def456")
        
        assert "my-repo" in str(path)
        assert "abc123d" in str(path)  # Short hash
    
    def test_get_workspace_path_traversal_blocked(self):
        """Test path traversal attempts are blocked."""
        with pytest.raises(ValueError, match="Invalid commit hash"):
            workspace_service.get_workspace_path("repo", "../../etc/passwd")
    
    def test_get_workspace_path_special_chars_blocked(self):
        """Test special characters in hash are blocked."""
        with pytest.raises(ValueError, match="Invalid commit hash"):
            workspace_service.get_workspace_path("repo", "hash;rm -rf /")
    
    def test_get_workspace_path_empty_hash(self):
        """Test empty commit hash is rejected."""
        with pytest.raises(ValueError, match="Invalid commit hash"):
            workspace_service.get_workspace_path("repo", "")
    
    def test_get_workspace_path_short_hash(self):
        """Test short hash (7 chars) is accepted."""
        path = workspace_service.get_workspace_path("repo", "abc1234")
        assert "abc1234" in str(path)


# ============================================
#              GIT SERVICE
# ============================================

class TestGitService:
    """Tests for the git service."""
    
    def test_is_valid_repo_with_non_repo_path(self):
        """Test is_valid_repo returns False for path that's not a git repo."""
        # Use the tests directory which exists but is not a git root
        test_dir = Path(__file__).parent
        result = git_service.is_valid_repo(str(test_dir))
        assert result is False
    
    def test_methods_are_async(self):
        """Verify that git methods are async."""
        import inspect
        
        assert inspect.iscoroutinefunction(git_service.clone_repo)
        assert inspect.iscoroutinefunction(git_service.get_commits)
        assert inspect.iscoroutinefunction(git_service.checkout_to_worktree)
        assert inspect.iscoroutinefunction(git_service.get_file_tree)
        assert inspect.iscoroutinefunction(git_service.get_file_content)


# ============================================
#              STATIC HTML ADAPTER
# ============================================

class TestStaticHtmlAdapter:
    """Tests for the static HTML adapter."""
    
    @pytest.mark.asyncio
    async def test_invalid_port_low(self):
        """Test that low port numbers are rejected."""
        with pytest.raises(ValueError, match="Invalid port number"):
            await static_html_adapter.start(Path("/tmp"), 80, {})
    
    @pytest.mark.asyncio
    async def test_invalid_port_high(self):
        """Test that high port numbers are rejected."""
        with pytest.raises(ValueError, match="Invalid port number"):
            await static_html_adapter.start(Path("/tmp"), 70000, {})
    
    @pytest.mark.asyncio
    async def test_invalid_workspace_path(self):
        """Test that paths outside workspaces are rejected."""
        unsafe_path = Path("C:/Windows/System32")
        with pytest.raises(ValueError, match="Invalid workspace path"):
            await static_html_adapter.start(unsafe_path, 8080, {})
    
    @pytest.mark.asyncio
    async def test_valid_port_range(self):
        """Test valid port numbers within allowed range."""
        # This test just validates the port check logic
        # Actual server start would require more complex mocking
        valid_ports = [1024, 3000, 8080, 9000, 65535]
        for port in valid_ports:
            # Port validation happens at start, but path validation will fail
            # so we expect path error, not port error
            with pytest.raises(ValueError, match="Invalid workspace path"):
                await static_html_adapter.start(Path("/tmp"), port, {})


# ============================================
#              CACHE SERVICE
# ============================================

class TestCacheService:
    """Tests for the cache service."""
    
    @pytest.mark.asyncio
    async def test_cache_miss(self, test_session):
        """Test cache returns None on miss."""
        from services.cache_service import cache_service
        
        result = await cache_service.get_cached(test_session, "nonexistent", "repos")
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_cache_set_and_get(self, test_session):
        """Test setting and getting cached data."""
        from services.cache_service import cache_service
        
        test_data = {"repos": [{"name": "test"}]}
        
        # Set cache
        await cache_service.set_cached(test_session, "testuser", "repos", test_data)
        
        # Get cache
        result = await cache_service.get_cached(test_session, "testuser", "repos")
        
        assert result is not None
        assert result["repos"][0]["name"] == "test"
