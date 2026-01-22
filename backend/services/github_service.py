import asyncio
import logging
import re
from datetime import datetime
from urllib.parse import urlparse

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import ApiStatus, GitHubCommit, Repository
from config import settings
from database import async_session

logger = logging.getLogger("gitnexus.github")


class GitHubService:
    """Service for GitHub API operations."""

    def __init__(self) -> None:
        self.base_url = settings.github_api_url
        self._client: httpx.AsyncClient | None = None
        self._semaphore = asyncio.Semaphore(5)  # Limit concurrent requests

    async def _update_rate_limit(self, headers: dict, db: AsyncSession | None, token_source: str | None = None) -> None:
        """Update API rate limit status in DB with token source tracking."""
        if not db or "x-ratelimit-remaining" not in headers:
            return

        try:
            limit = int(headers.get("x-ratelimit-limit", 60))
            remaining = int(headers.get("x-ratelimit-remaining", 0))
            reset = int(headers.get("x-ratelimit-reset", 0))
            
            # Determine source based on limit (authenticated = 5000, unauthenticated = 60)
            new_source = token_source if token_source else ("authed" if limit > 500 else "none")

            # Upsert ApiStatus
            query = select(ApiStatus).limit(1)
            result = await db.execute(query)
            status = result.scalar_one_or_none()

            if status:
                # Protect authenticated limits from being overwritten by unauthenticated requests
                is_downgrade = limit < status.limit
                was_authed = status.token_source in ("env", "db", "authed")
                
                if is_downgrade and was_authed and new_source == "none":
                    logger.debug(f"Skipping rate limit update: {limit} < {status.limit} (protected)")
                    return

                status.limit = limit
                status.remaining = remaining
                status.reset_time = reset
                status.token_source = new_source
            else:
                db.add(ApiStatus(limit=limit, remaining=remaining, reset_time=reset, token_source=new_source))
            
            # Use flush instead of commit to avoid independent transaction commits
            await db.flush()
        except Exception as e:
            # Rollback to maintain transaction integrity
            await db.rollback()
            # Don't fail request if stats update fails
            logger.debug(f"Rate limit update failed: {e}")

    async def _request(
        self, 
        method: str, 
        url: str, 
        headers: dict, 
        params: dict | None = None, 
        db: AsyncSession | None = None
    ) -> httpx.Response:
        """Centralized request handler with rate limit tracking."""
        client = await self._get_client()
        response = await client.request(method, url, headers=headers, params=params)
        
        if db:
            # Determine token source based on authorization header presence
            token_source = "authed" if "Authorization" in headers else None
            await self._update_rate_limit(response.headers, db, token_source=token_source)
            
        return response

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    def _get_headers(self, token: str | None = None) -> dict[str, str]:
        """Build GitHub API headers."""
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def fetch_user(self, username: str, token: str | None = None, db: AsyncSession | None = None) -> dict | None:
        """Fetch user profile from GitHub."""
        url = f"{self.base_url}/users/{username}"

        try:
            response = await self._request("GET", url, headers=self._get_headers(token), db=db)
            if response.status_code == 200:
                return response.json()
            return {"error": response.status_code}
        except httpx.TimeoutException:
            return {"error": 504, "message": "Request timed out"}
        except httpx.RequestError as e:
            return {"error": 503, "message": f"Network error: {str(e)}"}
        except Exception as e:
            return {"error": 500, "message": str(e)}

    async def fetch_user_repos(
        self, username: str, token: str | None = None, sort: str = "pushed", db: AsyncSession | None = None
    ) -> list[dict]:
        """Fetch all repositories for a user (handles pagination)."""
        client = await self._get_client()
        all_repos: list[dict] = []
        page = 1

        while True:
            url = f"{self.base_url}/users/{username}/repos"
            params = {"page": page, "per_page": 100, "sort": sort}

            try:
                response = await self._request(
                    "GET", url, headers=self._get_headers(token), params=params, db=db
                )
                if response.status_code != 200:
                    if page == 1:
                        return [{"error": response.status_code}]
                    break

                data = response.json()
                if not data:
                    break

                all_repos.extend(data)

                # Check for next page
                link_header = response.headers.get("Link", "")
                if 'rel="next"' not in link_header:
                    break
                page += 1
            except httpx.TimeoutException:
                if page == 1:
                    return [{"error": 504, "message": "Request timed out"}]
                break
            except Exception as e:
                if page == 1:
                    return [{"error": 500, "message": str(e)}]
                break

        return all_repos

    async def fetch_readme(
        self, owner: str, repo: str, token: str | None = None, db: AsyncSession | None = None
    ) -> dict | None:
        """Fetch README for a repository."""
        url = f"{self.base_url}/repos/{owner}/{repo}/readme"

        try:
            response = await self._request("GET", url, headers=self._get_headers(token), db=db)
            if response.status_code == 200:
                return response.json()
            return {"error": response.status_code}
        except Exception as e:
            return {"error": 500, "message": str(e)}

    async def fetch_rate_limit(self, token: str | None = None, db: AsyncSession | None = None) -> dict | None:
        """Explicitly fetch fresh rate limits from GitHub."""
        url = f"{self.base_url}/rate_limit"
        try:
            # The request itself triggers _update_rate_limit via headers
            response = await self._request("GET", url, headers=self._get_headers(token), db=db)
            if response.status_code == 200:
                return response.json()
            return {"error": response.status_code}
        except httpx.TimeoutException:
            return {"error": 504, "message": "Request timed out"}
        except Exception as e:
            return {"error": 500, "message": str(e)}

    async def fetch_commits(
        self,
        owner: str,
        repo: str,
        token: str | None = None,
        per_page: int = 100, # Increased default
        page: int = 1,
        since: str | None = None,
        db: AsyncSession | None = None,
    ) -> list[dict]:
        """Fetch recent commits for a repository."""
        url = f"{self.base_url}/repos/{owner}/{repo}/commits"
        params = {"per_page": per_page, "page": page}
        if since:
            params["since"] = since

        try:
            response = await self._request("GET", url, headers=self._get_headers(token), params=params, db=db)
            if response.status_code == 200:
                return response.json()
            return [{"error": response.status_code}]
        except httpx.TimeoutException:
            return [{"error": 504, "message": "Request timed out"}]
        except Exception as e:
            return [{"error": 500, "message": str(e)}]



    async def fetch_recent_commits(
        self,
        owner: str,
        repo: str,
        token: str | None = None,
        limit: int = 1000,
        db: AsyncSession | None = None,
    ) -> list[dict]:
        """Fetch recent commits handling pagination up to a limit."""
        all_commits = []
        page = 1
        per_page = 100 # Max per page for GitHub API is usually 100
        
        while len(all_commits) < limit:
            commits = await self.fetch_commits(
                owner, 
                repo, 
                token, 
                per_page=per_page, 
                page=page, 
                db=db
            )
            
            # Detect error payload immediately and return it
            if isinstance(commits, list) and commits and "error" in commits[0]:
                # Return error on first page, break on subsequent pages
                if not all_commits:
                    return commits
                break
            
            if not commits:
                break
                 
            # Filter valid commits
            valid_batch = [c for c in commits if isinstance(c, dict) and "sha" in c]
            if not valid_batch:
                break
                
            all_commits.extend(valid_batch)
            
            if len(commits) < per_page:
                # End of results
                break
                
            page += 1
            
        return all_commits[:limit]

    async def fetch_all_commits_for_graph(
        self,
        repos: list[Repository], # Using generic dict or the model if available
        token: str | None,
        since: str
    ) -> None:
        """
        Efficiently fetch commits for multiple repos and save to DB.
        Uses semaphore to limit concurrency.
        """
        tasks = []
        for repo in repos:
            tasks.append(self._sync_repo_commits(repo, token, since))
        
        await asyncio.gather(*tasks)

    async def _sync_repo_commits(
        self,
        repo: Repository, # expecting object with owner and name
        token: str | None,
        since: str
    ) -> None:
        """Worker to sync commits for a single repo."""
        async with self._semaphore:
            async with async_session() as db:
                page = 1
                while True:
                    owner_login = repo.owner.login if hasattr(repo.owner, "login") else repo.owner
                    
                    commits = await self.fetch_commits(
                        owner_login, 
                        repo.name, 
                        token, 
                        page=page, 
                        per_page=100, 
                        since=since,
                        db=db
                    )
                    
                    if not commits or (isinstance(commits, list) and commits and "error" in commits[0]):
                        break
                    
                    valid_commits = [c for c in commits if isinstance(c, dict) and "sha" in c]
                    if not valid_commits:
                        break

                    # Save batch to DB
                    commit_objs = []
                    for c in valid_commits:
                        commit = c.get("commit", {})
                        author = commit.get("author", {})
                        
                        commit_objs.append(GitHubCommit(
                            sha=c["sha"],
                            repo_owner=owner_login,
                            repo_name=repo.name,
                            author_name=author.get("name", "Unknown"),
                            author_date=datetime.fromisoformat(author.get("date").replace("Z", "+00:00")),
                            message=commit.get("message", ""),
                            url=c.get("html_url", "")
                        ))
                    
                    # Upsert (merge)
                    for obj in commit_objs:
                        await db.merge(obj)
                    await db.commit()

                    if len(valid_commits) < 100:
                        break
                    page += 1

    async def fetch_commit_count(
        self, owner: str, repo: str, token: str | None = None, db: AsyncSession | None = None
    ) -> int:
        """Fetch total commit count for a repository using pagination trick."""
        url = f"{self.base_url}/repos/{owner}/{repo}/commits"
        params = {"per_page": 1}

        try:
            response = await self._request(
                "GET", url, headers=self._get_headers(token), params=params, db=db
            )

            if response.status_code == 200:
                # 1. Check for Link header (standard pagination)
                link_header = response.headers.get("Link", "")
                if link_header:
                    links = link_header.split(",")
                    for link in links:
                        if 'rel="last"' in link:
                            match = re.search(r'[?&]page=(\d+)', link)
                            if match:
                                return int(match.group(1))

                # 2. Fallback: No pagination means less than 30 commits (or empty Link header)
                data = response.json()
                if isinstance(data, list):
                    return len(data)
                return 0

            elif response.status_code == 409:  # Empty repository (no commits)
                return 0
            
            return 0
        except Exception:
            return 0

    async def fetch_repo_metadata(
        self, owner: str, repo: str, token: str | None = None, db: AsyncSession | None = None
    ) -> dict | None:
        """Fetch repository metadata."""
        url = f"{self.base_url}/repos/{owner}/{repo}"

        try:
            response = await self._request("GET", url, headers=self._get_headers(token), db=db)
            if response.status_code == 200:
                return response.json()
            return None
        except Exception:
            return None

    async def fetch_latest_release(
        self, owner: str, repo: str, token: str | None = None, db: AsyncSession | None = None
    ) -> dict | None:
        """Fetch latest release for a repository."""
        url = f"{self.base_url}/repos/{owner}/{repo}/releases/latest"

        try:
            response = await self._request("GET", url, headers=self._get_headers(token), db=db)
            if response.status_code == 200:
                return response.json()
            return None
        except Exception:
            return None

    async def fetch_releases(
        self, owner: str, repo: str, token: str | None = None, limit: int = 3, db: AsyncSession | None = None
    ) -> list[dict]:
        """Fetch recent releases for a repository."""
        url = f"{self.base_url}/repos/{owner}/{repo}/releases"
        params = {"per_page": limit}

        try:
            response = await self._request(
                "GET", url, headers=self._get_headers(token), params=params, db=db
            )
            if response.status_code == 200:
                return response.json()
            return []
        except Exception:
            return []

    async def download_asset(
        self, url: str, dest_path: str, token: str | None = None, db: AsyncSession | None = None
    ) -> bool:
        """Download an asset to a local path (streaming, long timeout)."""
        # Create a throwaway client for this download to enforce custom timeout
        async with httpx.AsyncClient(timeout=300.0) as dl_client:
            headers = {}
            if token:
                headers["Authorization"] = f"Bearer {token}"

            try:
                # Use follow_redirects=True for GitHub assets
                async with dl_client.stream("GET", url, headers=headers, follow_redirects=True) as response:
                    # Update usage if DB provided
                    if db:
                        token_source = "authed" if token else None
                        await self._update_rate_limit(response.headers, db, token_source=token_source)
                         
                    response.raise_for_status()
                    with open(dest_path, "wb") as f:
                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            f.write(chunk)
                return True
            except httpx.HTTPStatusError as e:
                logger.error(f"Download failed (HTTP {e.response.status_code}): {url}")
                return False
            except httpx.RequestError as e:
                logger.error(f"Download request failed: {url} - {e}")
                return False
            except IOError as e:
                logger.error(f"Download IO error writing to {dest_path}: {e}")
                return False

    @staticmethod
    def parse_github_url(url: str) -> tuple[str | None, str | None]:
        """Extract owner and repo from a GitHub URL."""
        try:
            parsed = urlparse(url)
            path_parts = parsed.path.strip("/").split("/")
            if len(path_parts) >= 2:
                return path_parts[0], path_parts[1]
        except Exception:
            pass
        return None, None

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Singleton instance
github_service = GitHubService()
