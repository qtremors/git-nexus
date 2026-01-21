"""
Security Verification Tests for GitNexus Backend

Tests security fixes including:
- SEC-1: Path sanitization
- SEC-2: Token encryption
- SEC-5: Download path validation
- SSRF protection
"""

import pytest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.crypto import crypto_manager
from utils.security import (
    sanitize_filename, 
    validate_download_path, 
    is_safe_path,
    validate_download_url,
    ALLOWED_DOWNLOAD_HOSTS,
)


# ============================================
#              TOKEN ENCRYPTION (SEC-2)
# ============================================

class TestTokenEncryption:
    """Tests for SEC-2: Token encryption/decryption."""
    
    def test_encryption_different_from_plaintext(self):
        """Encrypted value should differ from plaintext."""
        token = "test-token-1234567890"
        encrypted = crypto_manager.encrypt(token)
        
        assert encrypted != token
        assert len(encrypted) > len(token)
    
    def test_decryption_restores_original(self):
        """Decryption should restore original value."""
        token = "test-token-1234567890"
        encrypted = crypto_manager.encrypt(token)
        decrypted = crypto_manager.decrypt(encrypted)
        
        assert decrypted == token
    
    def test_encrypt_empty_string(self):
        """Empty string encryption should work."""
        encrypted = crypto_manager.encrypt("")
        decrypted = crypto_manager.decrypt(encrypted)
        
        assert decrypted == ""
    
    def test_encrypt_unicode(self):
        """Unicode strings should encrypt correctly."""
        token = "token-with-émojis-🔐"
        encrypted = crypto_manager.encrypt(token)
        decrypted = crypto_manager.decrypt(encrypted)
        
        assert decrypted == token
    
    def test_different_tokens_different_ciphertext(self):
        """Different tokens should produce different ciphertext."""
        token1 = "token-one"
        token2 = "token-two"
        
        encrypted1 = crypto_manager.encrypt(token1)
        encrypted2 = crypto_manager.encrypt(token2)
        
        assert encrypted1 != encrypted2


# ============================================
#              FILENAME SANITIZATION (SEC-1)
# ============================================

class TestFilenameSanitization:
    """Tests for SEC-1: Filename sanitization."""
    
    @pytest.mark.parametrize("unsafe,expected", [
        ("../../etc/passwd", "etcpasswd"),
        ("..\\windows\\system32", "windowssystem32"),
        ("file|with<bad>chars?", "filewithbadchars"),
        ("  valid_file.zip  ", "valid_file.zip"),
        ("***", "downloaded_file"),
        ("normal-file.tar.gz", "normal-file.tar.gz"),
        ("file with spaces.zip", "file with spaces.zip"),
        ("../../../root/.ssh/id_rsa", "rootsshid_rsa"),
    ])
    def test_sanitize_filename(self, unsafe: str, expected: str):
        """Test various unsafe filenames are sanitized correctly."""
        assert sanitize_filename(unsafe) == expected
    
    def test_sanitize_removes_directory_separators(self):
        """Directory separators should be removed."""
        result = sanitize_filename("path/to/file.zip")
        assert "/" not in result
        assert "\\" not in result
    
    def test_sanitize_fallback_for_empty(self):
        """Empty result should fall back to default name."""
        result = sanitize_filename("***")
        assert result == "downloaded_file"


# ============================================
#              PATH VALIDATION (SEC-5)
# ============================================

class TestPathValidation:
    """Tests for SEC-5: Download path validation."""
    
    @pytest.mark.parametrize("sensitive_path", [
        "C:\\Windows",
        "C:\\Windows\\System32",
        "C:\\Users\\Public",
        "/etc",
        "/var",
        "/usr",
    ])
    def test_sensitive_paths_rejected(self, sensitive_path: str):
        """Sensitive system paths should be rejected."""
        with pytest.raises(ValueError):
            validate_download_path(sensitive_path)
    
    def test_root_path_rejected(self):
        """Root directory should be rejected."""
        with pytest.raises(ValueError):
            validate_download_path("/")
    
    def test_valid_path_accepted(self):
        """Valid download paths should be accepted."""
        cwd = Path.cwd()
        valid_path = cwd / "downloads"
        
        path = validate_download_path(str(valid_path))
        assert path.name == "downloads"
    
    def test_resolved_path_returned(self):
        """Returned path should be resolved (absolute)."""
        path = validate_download_path("./downloads")
        assert path.is_absolute()


# ============================================
#              PATH TRAVERSAL PREVENTION
# ============================================

class TestPathTraversalPrevention:
    """Tests for path traversal prevention."""
    
    def test_safe_path_inside_base(self):
        """Paths inside base should be safe."""
        base = Path("/opt/downloads")
        
        assert is_safe_path(base, base / "file.zip")
        assert is_safe_path(base, base / "subdir" / "file.zip")
    
    def test_path_at_base_is_safe(self):
        """Path equal to base should be safe."""
        base = Path("/opt/downloads")
        assert is_safe_path(base, base)
    
    def test_path_outside_base_is_unsafe(self):
        """Paths outside base should be unsafe."""
        base = Path("/opt/downloads")
        
        assert not is_safe_path(base, Path("/etc/passwd"))
        assert not is_safe_path(base, Path("/opt/other"))


# ============================================
#              SSRF PROTECTION
# ============================================

class TestSSRFProtection:
    """Tests for SSRF protection in download URLs."""
    
    def test_allowed_github_hosts(self):
        """GitHub hosts should be allowed."""
        allowed_urls = [
            "https://github.com/user/repo/releases/download/v1/file.zip",
            "https://api.github.com/repos/user/repo",
            "https://raw.githubusercontent.com/user/repo/main/file.txt",
            "https://objects.githubusercontent.com/file",
            "https://codeload.github.com/user/repo/zip/main",
        ]
        
        for url in allowed_urls:
            assert validate_download_url(url) is True
    
    def test_non_github_hosts_blocked(self):
        """Non-GitHub hosts should be blocked."""
        blocked_urls = [
            "https://evil.com/malware.exe",
            "https://localhost:8080/internal",
            "https://192.168.1.1/admin",
        ]
        
        for url in blocked_urls:
            with pytest.raises(ValueError):
                validate_download_url(url)
    
    def test_http_scheme_blocked(self):
        """HTTP (non-HTTPS) scheme should be blocked."""
        with pytest.raises(ValueError, match="HTTPS"):
            validate_download_url("http://github.com/user/repo")
    
    def test_invalid_url_format(self):
        """Invalid URL formats should be rejected."""
        invalid_urls = [
            "",
            "not-a-url",
            "ftp://github.com/file",
        ]
        
        for url in invalid_urls:
            with pytest.raises(ValueError):
                validate_download_url(url)
    
    def test_allowed_hosts_constant(self):
        """Verify allowed hosts list contains expected domains."""
        assert "github.com" in ALLOWED_DOWNLOAD_HOSTS
        assert "api.github.com" in ALLOWED_DOWNLOAD_HOSTS
        assert "raw.githubusercontent.com" in ALLOWED_DOWNLOAD_HOSTS


# ============================================
#              RUN STANDALONE
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
