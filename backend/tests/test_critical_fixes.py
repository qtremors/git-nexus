"""
Critical Fixes Verification Tests for GitNexus Backend

Tests critical bug fixes and security hardening.
"""

import pytest
import pytest_asyncio
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.workspace_service import workspace_service
from services.git_service import git_service
from adapters.static_html import static_html_adapter
from config import settings


# ============================================
#              WORKSPACE PATH SECURITY
# ============================================

class TestWorkspacePathSecurity:
    """Test workspace path security measures."""
    
    def test_valid_commit_hash(self):
        """Test that valid commit hashes are accepted."""
        path = workspace_service.get_workspace_path("test_repo", "abcdef123456")
        assert "abcdef1" in str(path)
    
    def test_path_traversal_blocked(self):
        """Test that path traversal attempts are blocked."""
        with pytest.raises(ValueError, match="Invalid commit hash"):
            workspace_service.get_workspace_path("repo", "../../etc/passwd")
    
    def test_shell_injection_blocked(self):
        """Test that shell injection attempts are blocked."""
        with pytest.raises(ValueError, match="Invalid commit hash"):
            workspace_service.get_workspace_path("repo", "hash;rm -rf /")
    
    def test_null_byte_blocked(self):
        """Test that null byte injection is blocked."""
        with pytest.raises(ValueError, match="Invalid commit hash"):
            workspace_service.get_workspace_path("repo", "abc123\x00../etc")


# ============================================
#              ASYNC GIT SERVICE
# ============================================

class TestAsyncGitService:
    """Verify git service methods are async (non-blocking)."""
    
    def test_clone_repo_is_async(self):
        """Verify clone_repo is async."""
        import inspect
        assert inspect.iscoroutinefunction(git_service.clone_repo)
    
    def test_get_commits_is_async(self):
        """Verify get_commits is async."""
        import inspect
        assert inspect.iscoroutinefunction(git_service.get_commits)
    
    def test_checkout_to_worktree_is_async(self):
        """Verify checkout_to_worktree is async."""
        import inspect
        assert inspect.iscoroutinefunction(git_service.checkout_to_worktree)
    
    def test_get_file_tree_is_async(self):
        """Verify get_file_tree is async."""
        import inspect
        assert inspect.iscoroutinefunction(git_service.get_file_tree)
    
    def test_get_file_content_is_async(self):
        """Verify get_file_content is async."""
        import inspect
        assert inspect.iscoroutinefunction(git_service.get_file_content)


# ============================================
#              STATIC HTML ADAPTER HARDENING
# ============================================

class TestStaticHtmlAdapterHardening:
    """Test security validation in static HTML adapter."""
    
    @pytest.mark.asyncio
    async def test_port_too_low(self):
        """Test that privileged ports are rejected."""
        with pytest.raises(ValueError, match="Invalid port number"):
            await static_html_adapter.start(Path("/tmp"), 80, {})
    
    @pytest.mark.asyncio
    async def test_port_too_high(self):
        """Test that invalid high ports are rejected."""
        with pytest.raises(ValueError, match="Invalid port number"):
            await static_html_adapter.start(Path("/tmp"), 70000, {})
    
    @pytest.mark.asyncio
    async def test_port_boundary_low(self):
        """Test lower boundary of valid port range."""
        # Port is valid but path is not
        with pytest.raises(ValueError, match="Invalid workspace path"):
            await static_html_adapter.start(Path("/tmp"), 1024, {})
    
    @pytest.mark.asyncio
    async def test_port_boundary_high(self):
        """Test upper boundary of valid port range."""
        # Port is valid but path is not
        with pytest.raises(ValueError, match="Invalid workspace path"):
            await static_html_adapter.start(Path("/tmp"), 65535, {})
    
    @pytest.mark.asyncio
    async def test_unsafe_windows_path(self):
        """Test that Windows system paths are rejected."""
        unsafe_path = Path("C:/Windows/System32")
        with pytest.raises(ValueError, match="Invalid workspace path"):
            await static_html_adapter.start(unsafe_path, 8080, {})
    
    @pytest.mark.asyncio
    async def test_unsafe_unix_path(self):
        """Test that Unix system paths are rejected."""
        unsafe_path = Path("/etc")
        with pytest.raises(ValueError, match="Invalid workspace path"):
            await static_html_adapter.start(unsafe_path, 8080, {})


# ============================================
#              COMMIT HASH VALIDATION
# ============================================

class TestCommitHashValidation:
    """Test Pydantic commit hash validation."""
    
    def test_valid_full_hash(self):
        """Test valid 40-char hex hash."""
        from routers.replay import StartServerRequest
        
        request = StartServerRequest(
            repo_id=1,
            commit_hash="a" * 40
        )
        assert request.commit_hash == "a" * 40
    
    def test_valid_short_hash(self):
        """Test valid 7-char short hash."""
        from routers.replay import StartServerRequest
        
        request = StartServerRequest(
            repo_id=1,
            commit_hash="abc1234"
        )
        assert request.commit_hash == "abc1234"
    
    def test_invalid_hash_too_short(self):
        """Test hash too short is rejected."""
        from routers.replay import StartServerRequest
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError):
            StartServerRequest(
                repo_id=1,
                commit_hash="abc"  # Too short
            )
    
    def test_invalid_hash_non_hex(self):
        """Test non-hex characters are rejected."""
        from routers.replay import StartServerRequest
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError):
            StartServerRequest(
                repo_id=1,
                commit_hash="ghijklm"  # Not hex
            )
