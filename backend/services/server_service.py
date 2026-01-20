import asyncio
import logging
import socket
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from subprocess import Popen

from adapters import RuntimeAdapter, static_html_adapter
from config import settings


@dataclass
class ServerInstance:
    """Represents a running server instance."""

    id: str
    repo_id: int
    repo_name: str
    repo_path: str
    commit_hash: str
    port: int
    workspace_path: Path
    process: Popen | None = None
    started_at: datetime | None = None
    status: str = "starting"  # starting, running, stopped, failed
    error: str | None = None
    adapter: RuntimeAdapter = field(default_factory=lambda: static_html_adapter)


logger = logging.getLogger("gitnexus.server")


class ServerOrchestrator:
    """Orchestrates multiple commit servers."""

    def __init__(self) -> None:
        """Initialize the orchestrator."""
        self._servers: dict[str, ServerInstance] = {}
        self._next_port = settings.base_server_port
        self._port_lock = asyncio.Lock()

    def _is_port_available(self, port: int) -> bool:
        """Check if a port is available for binding."""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind((settings.host, port))
                return True
        except OSError:
            return False

    async def _get_next_available_port(self, preferred: int | None = None) -> int:
        """Get the next available port."""
        async with self._port_lock:
            if preferred is not None:
                if self._is_port_available(preferred):
                    return preferred

            port = self._next_port
            max_attempts = 1000

            for _ in range(max_attempts):
                if self._is_port_available(port):
                    self._next_port = port + 1
                    return port
                port += 1

            raise RuntimeError(f"Could not find available port after {max_attempts} attempts")

    def _get_adapter(self, workspace_path: Path) -> RuntimeAdapter:
        """Get the appropriate adapter for a workspace."""
        if static_html_adapter.validate(workspace_path):
            return static_html_adapter

        files = list(workspace_path.iterdir()) if workspace_path.exists() else []
        file_names = [f.name for f in files[:10]]

        raise ValueError(
            f"Cannot serve this commit. No index.html found in workspace. "
            f"RepoReplay only supports static HTML websites. "
            f"Files found: {file_names if file_names else 'none'}"
        )

    async def start_server(
        self,
        repo_id: int,
        repo_name: str,
        repo_path: str,
        commit_hash: str,
        workspace_path: Path,
        env: dict[str, str],
        preferred_port: int | None = None,
    ) -> ServerInstance:
        """Start a server for a commit workspace with retry logic for port conflicts."""
        # Check for existing instance for this commit
        existing_id = None
        for s_id, s_instance in self._servers.items():
            if s_instance.repo_id == repo_id and s_instance.commit_hash == commit_hash:
                existing_id = s_id
                break
        
        if existing_id:
            instance = self._servers[existing_id]
            if instance.status == "running":
                return instance
            
            # Reuse existing instance and port
            try:
                process = await instance.adapter.start(workspace_path, instance.port, env)
                instance.process = process
                instance.started_at = datetime.now()
                instance.status = "running"
                instance.error = None
                logger.info(f"Restarted existing server {instance.id} for {instance.repo_name} on port {instance.port}")
                return instance
            except Exception as e:
                instance.status = "failed"
                instance.error = str(e)
                logger.error(f"Failed to restart server {instance.id}: {e}")
                return instance

        server_id = str(uuid.uuid4())[:8]

        # Get adapter
        try:
            adapter = self._get_adapter(workspace_path)
        except ValueError as e:
            instance = ServerInstance(
                id=server_id,
                repo_id=repo_id,
                repo_name=repo_name,
                repo_path=repo_path,
                commit_hash=commit_hash,
                port=0,
                workspace_path=workspace_path,
                status="failed",
                error=str(e),
            )
            self._servers[server_id] = instance
            return instance

        # Retry logic for port allocation and server startup
        max_retries = 3
        last_error = None
        
        for attempt in range(max_retries):
            # Get port (skip preferred_port on retry)
            try:
                port = await self._get_next_available_port(preferred_port if attempt == 0 else None)
            except RuntimeError as e:
                last_error = str(e)
                continue

            # Create instance
            instance = ServerInstance(
                id=server_id,
                repo_id=repo_id,
                repo_name=repo_name,
                repo_path=repo_path,
                commit_hash=commit_hash,
                port=port,
                workspace_path=workspace_path,
                adapter=adapter,
            )

            # Start server
            try:
                process = await adapter.start(workspace_path, port, env)
                instance.process = process
                instance.started_at = datetime.now()
                instance.status = "running"
                logger.info(f"Started server {server_id} for {repo_name} ({commit_hash[:7]}) on port {port}")
                self._servers[server_id] = instance
                return instance
            except OSError as e:
                # Port conflict - retry with a new port
                last_error = str(e)
                logger.warning(f"Port {port} conflict on attempt {attempt + 1}/{max_retries}: {e}")
                if attempt < max_retries - 1:
                    import asyncio
                    await asyncio.sleep(0.1 * (2 ** attempt))  # Exponential backoff: 0.1s, 0.2s, 0.4s
                continue
            except Exception as e:
                # Non-retryable error
                instance.status = "failed"
                instance.error = str(e)
                logger.error(f"Failed to start server for {repo_name}: {e}")
                self._servers[server_id] = instance
                return instance

        # All retries exhausted
        instance = ServerInstance(
            id=server_id,
            repo_id=repo_id,
            repo_name=repo_name,
            repo_path=repo_path,
            commit_hash=commit_hash,
            port=0,
            workspace_path=workspace_path,
            status="failed",
            error=f"Failed after {max_retries} attempts: {last_error}",
        )
        self._servers[server_id] = instance
        return instance

    async def stop_server(self, server_id: str) -> bool:
        """Stop a running server."""
        instance = self._servers.get(server_id)
        if not instance:
            return False

        if instance.process and instance.status == "running":
            await instance.adapter.stop(instance.process)
            logger.info(f"Stopped server {server_id} for {instance.repo_name}")

        instance.status = "stopped"
        return True

    async def stop_all(self) -> int:
        """Stop all running servers."""
        count = 0
        server_ids = list(self._servers.keys())  # Create copy to iterate safely
        for server_id in server_ids:
            if await self.stop_server(server_id):
                count += 1
        return count

    def cleanup_sync(self) -> None:
        """Synchronous cleanup for atexit."""
        running = self.get_running_servers()
        if not running:
            return
            
        logger.info(f"Cleaning up {len(running)} zombie processes...")
        for server in running:
            if server.process:
                try:
                    server.process.terminate()
                    server.process.wait(timeout=1)
                except Exception:
                    try:
                        server.process.kill()
                    except Exception:
                        pass
        logger.info("Cleanup complete.")

    def get_server(self, server_id: str) -> ServerInstance | None:
        """Get a server instance by ID."""
        return self._servers.get(server_id)

    def get_all_servers(self) -> list[ServerInstance]:
        """Get all server instances."""
        return list(self._servers.values())

    def get_running_servers(self) -> list[ServerInstance]:
        """Get only running servers."""
        return [s for s in self._servers.values() if s.status == "running"]

    def to_response(self, instance: ServerInstance) -> dict:
        """Convert ServerInstance to API response."""
        return {
            "id": instance.id,
            "repo_id": instance.repo_id,
            "repo_name": instance.repo_name,
            "commit_hash": instance.commit_hash,
            "short_hash": instance.commit_hash[:7],
            "port": instance.port,
            "url": instance.adapter.get_url(instance.port) if instance.port else "",
            "status": instance.status,
            "started_at": instance.started_at.isoformat() if instance.started_at else None,
            "error": instance.error,
        }

    def remove_server(self, server_id: str) -> bool:
        """Remove a server from tracking (must be stopped first)."""
        instance = self._servers.get(server_id)
        if not instance:
            return False

        if instance.status == "running":
            return False

        del self._servers[server_id]
        return True


# Singleton instance
server_orchestrator = ServerOrchestrator()

# Register cleanup on exit
import atexit
atexit.register(server_orchestrator.cleanup_sync)
