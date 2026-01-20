from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.envvar import EnvVar
from utils.crypto import crypto_manager


class EnvService:
    """Service for managing scoped environment variables with encryption."""

    def _decrypt_value(self, encrypted_value: str) -> str:
        """Decrypt an env var value. Returns original if decryption fails (legacy unencrypted data)."""
        if not encrypted_value:
            return ""
        decrypted = crypto_manager.decrypt(encrypted_value)
        # If decryption returns empty but original wasn't empty, it's legacy unencrypted data
        if not decrypted and encrypted_value:
            return encrypted_value
        return decrypted

    def _encrypt_value(self, plaintext_value: str) -> str:
        """Encrypt an env var value for storage."""
        if not plaintext_value:
            return ""
        return crypto_manager.encrypt(plaintext_value)

    async def get_global_vars(self, db: AsyncSession) -> list[dict]:
        """Get all global environment variables (decrypted)."""
        result = await db.execute(select(EnvVar).where(EnvVar.scope == "global"))
        vars = result.scalars().all()
        return [{"id": v.id, "key": v.key, "value": self._decrypt_value(v.value)} for v in vars]

    async def get_project_vars(self, db: AsyncSession, repo_id: int) -> list[dict]:
        """Get project-level environment variables for a repository (decrypted)."""
        result = await db.execute(
            select(EnvVar).where(
                and_(EnvVar.scope == "project", EnvVar.repository_id == repo_id)
            )
        )
        vars = result.scalars().all()
        return [{"id": v.id, "key": v.key, "value": self._decrypt_value(v.value)} for v in vars]

    async def get_commit_vars(
        self, db: AsyncSession, repo_id: int, commit_hash: str
    ) -> list[dict]:
        """Get commit-level environment variables (decrypted)."""
        result = await db.execute(
            select(EnvVar).where(
                and_(
                    EnvVar.scope == "commit",
                    EnvVar.repository_id == repo_id,
                    EnvVar.commit_hash == commit_hash,
                )
            )
        )
        vars = result.scalars().all()
        return [{"id": v.id, "key": v.key, "value": self._decrypt_value(v.value)} for v in vars]

    async def get_merged_vars(
        self, db: AsyncSession, repo_id: int, commit_hash: str
    ) -> dict[str, str]:
        """
        Get merged environment variables for a commit (decrypted).
        Resolution order: Global -> Project -> Commit
        """
        merged: dict[str, str] = {}

        # Global vars (lowest priority)
        global_vars = await self.get_global_vars(db)
        for var in global_vars:
            merged[var["key"]] = var["value"]

        # Project vars (override global)
        project_vars = await self.get_project_vars(db, repo_id)
        for var in project_vars:
            merged[var["key"]] = var["value"]

        # Commit vars (highest priority)
        commit_vars = await self.get_commit_vars(db, repo_id, commit_hash)
        for var in commit_vars:
            merged[var["key"]] = var["value"]

        return merged

    async def set_vars(
        self,
        db: AsyncSession,
        scope: str,
        vars: list[dict],
        repo_id: int | None = None,
        commit_hash: str | None = None,
    ) -> list[dict]:
        """Set environment variables for a scope (replaces existing, encrypts values)."""
        # Delete existing vars for this scope
        conditions = [EnvVar.scope == scope]
        if repo_id is not None:
            conditions.append(EnvVar.repository_id == repo_id)
        if commit_hash is not None:
            conditions.append(EnvVar.commit_hash == commit_hash)

        existing = await db.execute(select(EnvVar).where(and_(*conditions)))
        for var in existing.scalars().all():
            await db.delete(var)

        # Create new vars with encrypted values
        created = []
        for var_data in vars:
            var = EnvVar(
                key=var_data["key"],
                value=self._encrypt_value(var_data["value"]),
                scope=scope,
                repository_id=repo_id,
                commit_hash=commit_hash,
            )
            db.add(var)
            created.append(var)

        await db.commit()

        # Refresh to get IDs and return decrypted values for response
        for var in created:
            await db.refresh(var)

        return [{"id": v.id, "key": v.key, "value": self._decrypt_value(v.value)} for v in created]


# Singleton instance
env_service = EnvService()

