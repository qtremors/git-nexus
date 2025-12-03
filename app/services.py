from datetime import datetime

import requests
from flask import current_app, request

from app.models import AppConfig, CacheEntry, db


# --- Helper: Get Token (Priority: Request > DB) ---
def get_effective_token(request_token):
    if request_token and request_token.strip():
        return request_token.strip()

    # Fallback to DB
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
    # 1. CHECK CACHE FIRST
    cached = CacheEntry.query.filter_by(
        username=username, endpoint_type=endpoint_type
    ).first()
    force_refresh = request.args.get("refresh") == "true"

    # INFINITE CACHE LOGIC:
    if cached and not force_refresh:
        print(
            f"[{endpoint_type}] Serving from DB Cache for {username} (Infinite Cache)"
        )
        return cached.data

    # 2. ONLY IF NO CACHE OR FORCED REFRESH, CALL API
    print(f"[{endpoint_type}] Fetching from GitHub API (Refresh={force_refresh})")
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
                        return {
                            "error": resp.status_code,
                            "message": resp.json().get("message", "API Error"),
                        }
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
                return {
                    "error": resp.status_code,
                    "message": resp.json().get("message", "API Error"),
                }
            final_data = resp.json()

        # 3. SAVE TO DB (Update or Create)
        if not cached:
            cached = CacheEntry(username=username, endpoint_type=endpoint_type)
            db.session.add(cached)

        cached.data = final_data
        cached.last_updated = datetime.utcnow()
        db.session.commit()

        return final_data

    except requests.RequestException as e:
        return {"error": 500, "message": str(e)}
    except Exception as e:
        return {"error": 500, "message": f"Server Error: {str(e)}"}
