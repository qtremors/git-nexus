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
    
    # Check against sensitive paths
    path_str_lower = str(path).lower()
    for sensitive in SENSITIVE_PATHS:
        # Simple string check - if the resolved path STARTS with a sensitive path
        # (normalized to the OS separators)
        sensitive_normalized = str(Path(sensitive).resolve()).lower()
        if path_str_lower.startswith(sensitive_normalized):
             raise ValueError(f"Path is strictly forbidden: {path}")

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
