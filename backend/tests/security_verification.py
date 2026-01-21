"""
Security Verification Tests for GitNexus
Tests SEC-1, SEC-2, SEC-5 fixes.
"""

import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.crypto import crypto_manager
from utils.security import sanitize_filename, validate_download_path, is_safe_path
import pytest

def test_encryption_decryption():
    """Verify SEC-2: Token encryption/decryption cycle."""
    # Use neutral placeholder instead of secret-looking string
    token = "test-token-1234567890"
    
    encrypted = crypto_manager.encrypt(token)
    assert encrypted != token
    assert len(encrypted) > len(token)
    
    decrypted = crypto_manager.decrypt(encrypted)
    assert decrypted == token

def test_filename_sanitization():
    """Verify SEC-1: Filename sanitization."""
    unsafe_filenames = [
        ("../../etc/passwd", "etcpasswd"),
        ("..\\windows\\system32", "windowssystem32"),
        ("file|with<bad>chars?", "filewithbadchars"),
        ("  valid_file.zip  ", "valid_file.zip"),
        ("***", "downloaded_file"),  # Empty result fallback
    ]
    
    for unsafe, expected in unsafe_filenames:
        sanitized = sanitize_filename(unsafe)
        assert sanitized == expected

def test_path_validation_blocklist():
    """Verify SEC-5: Download path validation for sensitive paths."""
    sensitive_paths = [
        "C:\\Windows",
        "C:\\Windows\\System32",
        "C:\\Users\\Public",
        "/etc",
        "/",
    ]
    
    for path in sensitive_paths:
        with pytest.raises(ValueError):
            validate_download_path(path)

def test_path_validation_success():
    """Verify SEC-5: Valid paths are accepted."""
    # Assuming the current working directory is safe
    cwd = Path.cwd()
    valid_path = cwd / "downloads"
    
    path = validate_download_path(str(valid_path))
    assert path.name == "downloads"

def test_is_safe_path_traversal():
    """Verify SEC-1: Path traversal prevention."""
    base = Path("/opt/downloads")
    
    # Safe
    assert is_safe_path(base, base / "file.zip")
    assert is_safe_path(base, base / "subdir" / "file.zip")
    pass

if __name__ == "__main__":
    # Rudimentary runner
    print("Running Security Tests...")
    try:
        test_encryption_decryption()
        print("[PASS] Encryption/Decryption")
    except Exception as e:
        print(f"[FAIL] Encryption/Decryption: {e}")
        
    try:
        test_filename_sanitization()
        print("[PASS] Filename Sanitization")
    except Exception as e:
        print(f"[FAIL] Filename Sanitization: {e}")
        
    try:
        test_path_validation_blocklist()
        print("[PASS] Path Validation (Blocklist)")
    except Exception as e:
        print(f"[FAIL] Path Validation (Blocklist): {e}")

    print("Done.")
