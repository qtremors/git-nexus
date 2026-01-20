import asyncio
import logging
import os
import subprocess
import sys
from pathlib import Path
from subprocess import Popen

from adapters.base import RuntimeAdapter
from config import settings
from utils.security import is_safe_path

logger = logging.getLogger("gitnexus.adapter.static")


class StaticHTMLAdapter(RuntimeAdapter):

    @property
    def name(self) -> str:
        return "Static HTML"

    def validate(self, workspace_path: Path) -> bool:
        index_path = workspace_path / "index.html"
        return index_path.exists()

    async def start(
        self, workspace_path: Path, port: int, env: dict[str, str]
    ) -> Popen:

        # Security: Validate port
        if not isinstance(port, int) or not (1024 <= port <= 65535):
            raise ValueError(f"Invalid port number: {port}. Must be between 1024 and 65535.")

        # Security: Validate workspace path
        if not is_safe_path(settings.workspaces_dir, workspace_path):
             raise ValueError(f"Invalid workspace path: {workspace_path}. Must be within workspaces directory.")
        
        logger.debug(f"Starting server: workspace={workspace_path}, port={port}")

        # Merge with current environment
        process_env = os.environ.copy()
        process_env.update(env)

        # Build command
        cmd = [
            sys.executable,
            "-m",
            "http.server",
            str(port),
            "--bind",
            "127.0.0.1",
        ]
        logger.debug(f"Command: {' '.join(cmd)}")

        # Start http.server using Popen (sync, Windows-compatible)
        try:
            process = subprocess.Popen(
                cmd,
                cwd=str(workspace_path),
                env=process_env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
            logger.debug(f"Process started: PID={process.pid}")
        except Exception as e:
            logger.error(f"Failed to start process: {e}")
            raise RuntimeError(f"Failed to start http.server: {e}")

        # Give server a moment to start (PERF-1: use async sleep)
        await asyncio.sleep(0.5)

        # Check if process is still running
        poll_result = process.poll()
        if poll_result is not None:
            stdout = process.stdout.read().decode() if process.stdout else ""
            stderr = process.stderr.read().decode() if process.stderr else ""
            error_msg = stderr.strip() or stdout.strip() or "Unknown error"
            logger.error(f"Process exited immediately (code {poll_result})")
            raise RuntimeError(f"Server exited immediately (code {poll_result}): {error_msg}")

        logger.info(f"Server running: port={port}")
        return process

    async def stop(self, process: Popen) -> None:
        
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


# Singleton instance
static_html_adapter = StaticHTMLAdapter()
