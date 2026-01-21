"""
API Endpoint Tests for GitNexus Backend

Tests the main API endpoints for health, settings, and watchlist.
Note: Discovery tests require complex mocking of the services module.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch


# ============================================
#              HEALTH CHECK
# ============================================

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test the health check endpoint returns OK."""
    response = await client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data


# ============================================
#              SETTINGS ENDPOINTS
# ============================================

@pytest.mark.asyncio
async def test_get_token_empty(client: AsyncClient):
    """Test getting token when none is saved."""
    with patch("routers.settings.settings") as mock_settings:
        mock_settings.github_token = None
        
        response = await client.get("/api/settings/token")
        
        assert response.status_code == 200
        data = response.json()
        assert data["token"] == ""
        assert data["source"] == "none"
        assert data["isActive"] is False


@pytest.mark.asyncio
async def test_save_and_get_token(client: AsyncClient):
    """Test saving and retrieving a token (masked)."""
    # Save token
    save_response = await client.post(
        "/api/settings/token",
        json={"token": "test-token-value-1234"}
    )
    assert save_response.status_code == 200
    
    # Get token (should be masked) - patch out env token
    with patch("routers.settings.settings") as mock_settings:
        mock_settings.github_token = None
        
        get_response = await client.get("/api/settings/token")
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data["source"] == "db"
        assert data["isActive"] is True
        # Token should be masked - only last 4 chars visible
        assert data["token"].endswith("1234")
        assert "*" in data["token"]


@pytest.mark.asyncio
async def test_get_theme_default(client: AsyncClient):
    """Test getting default theme."""
    response = await client.get("/api/settings/theme")
    
    assert response.status_code == 200
    data = response.json()
    assert data["theme"] == "default"


@pytest.mark.asyncio
async def test_save_theme(client: AsyncClient):
    """Test saving a theme."""
    response = await client.post(
        "/api/settings/theme",
        json={"theme": "dark"}
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "saved"
    
    # Verify it was saved
    get_response = await client.get("/api/settings/theme")
    assert get_response.json()["theme"] == "dark"


@pytest.mark.asyncio
async def test_get_last_repo_empty(client: AsyncClient):
    """Test getting last repo when none is saved."""
    response = await client.get("/api/settings/last-repo")
    
    assert response.status_code == 200
    data = response.json()
    assert data["repo_id"] is None


@pytest.mark.asyncio
async def test_save_last_repo(client: AsyncClient):
    """Test saving last active repo."""
    response = await client.post(
        "/api/settings/last-repo",
        json={"repo_id": 123}
    )
    
    assert response.status_code == 200
    
    # Verify it was saved
    get_response = await client.get("/api/settings/last-repo")
    assert get_response.json()["repo_id"] == 123


# ============================================
#              WATCHLIST ENDPOINTS
# ============================================

@pytest.mark.asyncio
async def test_get_empty_watchlist(client: AsyncClient):
    """Test getting an empty watchlist."""
    response = await client.get("/api/watchlist")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


@pytest.mark.asyncio
async def test_add_invalid_url_to_watchlist(client: AsyncClient):
    """Test that invalid GitHub URLs are rejected."""
    response = await client.post(
        "/api/watchlist/add-by-url",
        json={"url": "not-a-valid-url"}
    )
    
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_remove_nonexistent_repo(client: AsyncClient):
    """Test removing a repo that doesn't exist returns 404."""
    response = await client.post(
        "/api/watchlist/remove",
        json={"id": 99999}
    )
    
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_add_repo_to_watchlist_mocked(client: AsyncClient):
    """Test adding a repository to watchlist with mocked GitHub service."""
    mock_metadata = {
        "id": 1,
        "name": "test-repo",
        "owner": {"avatar_url": "https://example.com/avatar.png"},
        "html_url": "https://github.com/testuser/test-repo",
        "description": "A test repository",
    }
    
    with patch("routers.watchlist.github_service") as mock_gh:
        mock_gh.parse_github_url = MagicMock(return_value=("testuser", "test-repo"))
        mock_gh.fetch_repo_metadata = AsyncMock(return_value=mock_metadata)
        
        response = await client.post(
            "/api/watchlist/add-by-url",
            json={"url": "https://github.com/testuser/test-repo"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert "message" in data


@pytest.mark.asyncio
async def test_watchlist_add_and_remove(client: AsyncClient):
    """Test full workflow: add repo, verify, remove, verify."""
    mock_metadata = {
        "id": 1,
        "name": "workflow-repo",
        "owner": {"avatar_url": "https://example.com/avatar.png"},
        "html_url": "https://github.com/user/workflow-repo",
        "description": "Test workflow",
    }
    
    with patch("routers.watchlist.github_service") as mock_gh:
        mock_gh.parse_github_url = MagicMock(return_value=("user", "workflow-repo"))
        mock_gh.fetch_repo_metadata = AsyncMock(return_value=mock_metadata)
        
        # Add
        add_response = await client.post(
            "/api/watchlist/add-by-url",
            json={"url": "https://github.com/user/workflow-repo"}
        )
        assert add_response.status_code == 201
    
    # Verify added
    list_response = await client.get("/api/watchlist")
    watchlist = list_response.json()
    assert len(watchlist) == 1
    repo_id = watchlist[0]["id"]
    
    # Remove
    remove_response = await client.post(
        "/api/watchlist/remove",
        json={"id": repo_id}
    )
    assert remove_response.status_code == 200
    
    # Verify removed
    final_list = await client.get("/api/watchlist")
    assert len(final_list.json()) == 0


@pytest.mark.asyncio
async def test_duplicate_repo_rejected(client: AsyncClient):
    """Test that adding a duplicate repo returns conflict."""
    mock_metadata = {
        "id": 1,
        "name": "dup-repo",
        "owner": {"avatar_url": "https://example.com/avatar.png"},
        "html_url": "https://github.com/user/dup-repo",
        "description": "Duplicate test",
    }
    
    with patch("routers.watchlist.github_service") as mock_gh:
        mock_gh.parse_github_url = MagicMock(return_value=("user", "dup-repo"))
        mock_gh.fetch_repo_metadata = AsyncMock(return_value=mock_metadata)
        
        # Add first time
        await client.post(
            "/api/watchlist/add-by-url",
            json={"url": "https://github.com/user/dup-repo"}
        )
        
        # Try to add again
        response = await client.post(
            "/api/watchlist/add-by-url",
            json={"url": "https://github.com/user/dup-repo"}
        )
        
        assert response.status_code == 409


# ============================================
#              REPLAY ENDPOINTS
# ============================================

@pytest.mark.asyncio
async def test_get_empty_repos(client: AsyncClient):
    """Test getting repos when none exist."""
    response = await client.get("/api/replay/repos")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


@pytest.mark.asyncio
async def test_get_nonexistent_repo(client: AsyncClient):
    """Test getting a repo that doesn't exist returns 404."""
    response = await client.get("/api/replay/repos/99999")
    
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_servers_empty(client: AsyncClient):
    """Test getting servers when none are running."""
    response = await client.get("/api/replay/servers")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_running_servers_empty(client: AsyncClient):
    """Test getting running servers when none are running."""
    response = await client.get("/api/replay/servers/running")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0
