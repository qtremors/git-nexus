from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class RuntimeAdapter(ABC):

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def validate(self, workspace_path: Path) -> bool:
        pass

    @abstractmethod
    async def start(
        self, workspace_path: Path, port: int, env: dict[str, str]
    ) -> Any:
        pass

    @abstractmethod
    async def stop(self, process: Any) -> None:
        pass

    def get_url(self, port: int) -> str:
        return f"http://localhost:{port}"
