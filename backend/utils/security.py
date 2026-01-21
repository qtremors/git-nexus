"""
GitNexus - Security Utility

Helper functions for path sanitization, validation, and security checks.
"""

import re
from pathlib import Path

# Blocklist of sensitive paths
SENSITIVE_PATHS = {
    # Windows
    r"C:\\Windows",
    r"C:\\Program Files",
    r"C:\\Program Files (x86)",
    r"C:\\Users\\Public",
    # Unix-like (just in case)
    "/etc",
    "/var",
    "/usr",
    "/bin",
    "/sbin",
    "/root",
}


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to prevent path traversal and remove unsafe characters.
    
    Allows: Alphanumeric, underscores, hyphens, and periods.
    Removes: Slashes, backslashes, and other special characters.
    
    Args:
        filename: The user-provided filename.
        
    Returns:
        A safe filename string.
    """
    # Remove any directory separators
    filename = filename.replace("/", "").replace("\\", "")
    
    # Keep only safe characters
    # Allow: a-z, A-Z, 0-9, -, _, ., space
    cleaned = re.sub(r'[^a-zA-Z0-9_\-\. ]', '', filename)
    
    # Remove leading/trailing periods and spaces
    cleaned = cleaned.strip(". ")
    
    return cleaned or "downloaded_file"


def validate_download_path(path_str: str) -> Path:
    """
    Validate and resolve a download path.
    
    Checks:
    1. Path is absolute (or resolves to one).
    2. Path is not in a blocklisted sensitive directory.
    3. Path does not try to traverse up to root in a weird way.
    
    Args:
        path_str: The path string to validate.
        
    Returns:
        The resolved Path object.
        
    Raises:
        ValueError: If the path is invalid or unsafe.
    """
    path = Path(path_str).resolve()
    
    # Check against sensitive paths using proper path containment check
    for sensitive in SENSITIVE_PATHS:
        try:
            sensitive_path = Path(sensitive).resolve()
            # Use is_relative_to for proper containment check (prevents bypass via startswith)
            if path == sensitive_path or path.is_relative_to(sensitive_path):
                raise ValueError(f"Path is strictly forbidden: {path}")
        except (OSError, ValueError) as e:
            # ValueError from is_relative_to means not relative - that's fine
            # OSError can occur on invalid paths - skip check for that sensitive path
            if "forbidden" in str(e):
                raise

    # Prevent root directory usage (C:\ or /)
    if str(path.parent) == str(path):
        raise ValueError("Cannot use root directory as download path")
        
    return path


def is_safe_path(base_path: Path, target_path: Path) -> bool:
    """
    Verify that target_path is inside base_path.
    
    Args:
        base_path: The trusted root directory.
        target_path: The path to check.
        
    Returns:
        True if target_path is inside or equal to base_path.
    """
    try:
        return target_path.resolve().is_relative_to(base_path.resolve())
    except ValueError:
        return False


# ============================================
#            SSRF PROTECTION
# ============================================

# Allowlisted hostnames for asset downloads
ALLOWED_DOWNLOAD_HOSTS = {
    "github.com",
    "api.github.com",
    "raw.githubusercontent.com",
    "objects.githubusercontent.com",
    "github-releases.githubusercontent.com",
    "codeload.github.com",
}


def validate_download_url(url: str) -> bool:
    """
    Validate a download URL for SSRF protection.
    
    Checks:
    1. URL scheme is HTTPS only
    2. Hostname is in the allowlist (GitHub domains only)
    3. No private/internal IP addresses
    
    Args:
        url: The URL to validate.
        
    Returns:
        True if the URL is safe for downloading.
        
    Raises:
        ValueError: If the URL is invalid or blocked.
    """
    from urllib.parse import urlparse
    import ipaddress
    import socket
    
    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError("Invalid URL format")
    
    # Check scheme - HTTPS only
    if parsed.scheme != "https":
        raise ValueError("Only HTTPS URLs are allowed")
    
    # Check hostname exists
    if not parsed.hostname:
        raise ValueError("URL must have a valid hostname")
    
    hostname = parsed.hostname.lower()
    
    # Check against allowlist
    if hostname not in ALLOWED_DOWNLOAD_HOSTS:
        raise ValueError(f"Download from '{hostname}' is not allowed. Only GitHub domains are permitted.")
    
    # Extra safety: resolve hostname and check for private IPs
    try:
        resolved_ip = socket.gethostbyname(hostname)
        ip_obj = ipaddress.ip_address(resolved_ip)
        
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved:
            raise ValueError("Download URL resolves to a private/internal IP address")
    except socket.gaierror:
        # DNS resolution failed - allow if hostname is in allowlist
        # (may be network issue, but we trust the allowlist)
        pass
    except ValueError as e:
        # Re-raise our own ValueError
        if "Download URL" in str(e) or "not allowed" in str(e):
            raise
        # ipaddress parsing errors - allow if DNS returned something unexpected
        pass
    
    return True
