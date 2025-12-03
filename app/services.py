from datetime import datetime
from urllib.parse import urlparse

import requests
from flask import request

from app.models import AppConfig, CacheEntry, db


def get_effective_token(request_token):
    if request_token and request_token.strip():
        return request_token.strip()
    config = AppConfig.query.get("github_token")
    return config.value if config else None


def get_github_headers(token=None):
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    effective_token = get_effective_token(token)
    if effective_token:
        headers["Authorization"] = f"Bearer {effective_token}"
    return headers


def fetch_and_cache(username, endpoint_type, url, token=None, params=None):
    cached = CacheEntry.query.filter_by(
        username=username, endpoint_type=endpoint_type
    ).first()
    force_refresh = request.args.get("refresh") == "true"

    if cached and not force_refresh:
        return cached.data

    headers = get_github_headers(token)

    try:
        if endpoint_type == "repos":
            all_data = []
            page = 1
            while True:
                current_params = params.copy() if params else {}
                current_params["page"] = page
                current_params["per_page"] = 100

                resp = requests.get(url, headers=headers, params=current_params)
                if resp.status_code != 200:
                    if page == 1:
                        return {"error": resp.status_code}
                    break

                data = resp.json()
                if not data:
                    break
                all_data.extend(data)
                if 'rel="next"' not in resp.headers.get("Link", ""):
                    break
                page += 1
            final_data = all_data
        else:
            resp = requests.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                return {"error": resp.status_code}
            final_data = resp.json()

        if not cached:
            cached = CacheEntry(username=username, endpoint_type=endpoint_type)
            db.session.add(cached)

        cached.data = final_data
        cached.last_updated = datetime.utcnow()
        db.session.commit()
        return final_data

    except Exception as e:
        return {"error": 500, "message": str(e)}


# --- HELPERS ---


def parse_github_url(url):
    """Extracts owner and repo from https://github.com/owner/repo"""
    try:
        parsed = urlparse(url)
        path_parts = parsed.path.strip("/").split("/")
        if len(path_parts) >= 2:
            return path_parts[0], path_parts[1]
    except:
        pass
    return None, None


def fetch_repo_metadata(owner, repo, token=None):
    url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = get_github_headers(token)
    try:
        resp = requests.get(url, headers=headers)
        if resp.status_code == 200:
            return resp.json()
    except:
        pass
    return None


# NEW: Fetch List of Releases (default 3)
def fetch_repo_releases(owner, repo, token=None, limit=3):
    url = f"https://api.github.com/repos/{owner}/{repo}/releases?per_page={limit}"
    headers = get_github_headers(token)
    try:
        resp = requests.get(url, headers=headers)
        if resp.status_code == 200:
            return resp.json()
        return []
    except:
        return []


# Fetch Just the Latest (for quick version checking)
def fetch_latest_release(owner, repo, token=None):
    url = f"https://api.github.com/repos/{owner}/{repo}/releases/latest"
    headers = get_github_headers(token)
    try:
        resp = requests.get(url, headers=headers)
        if resp.status_code == 200:
            return resp.json()
        return None
    except:
        return None
