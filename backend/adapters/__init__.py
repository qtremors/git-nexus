"""
GitNexus v3.0.0 - Adapters Package

Runtime adapters for serving commit workspaces.
"""

from adapters.base import RuntimeAdapter
from adapters.static_html import StaticHTMLAdapter, static_html_adapter

__all__ = [
    "RuntimeAdapter",
    "StaticHTMLAdapter",
    "static_html_adapter",
]
