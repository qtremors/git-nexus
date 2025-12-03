import re
from datetime import datetime

import requests
from flask import Blueprint, current_app, jsonify, request

from app.models import AppConfig, CacheEntry, SearchHistory, db
from app.services import fetch_and_cache, get_github_headers

api_bp = Blueprint("api", __name__, url_prefix="/api")


# --- Token Management ---
@api_bp.route("/config/token", methods=["GET"])
def get_saved_token():
    config = AppConfig.query.get("github_token")
    return jsonify({"token": config.value if config else ""})


@api_bp.route("/config/token", methods=["POST"])
def save_token():
    token = request.json.get("token", "").strip()
    config = AppConfig.query.get("github_token")

    if not config:
        config = AppConfig(key="github_token", value=token)
        db.session.add(config)
    else:
        config.value = token

    db.session.commit()
    return jsonify({"status": "saved"})


# --- Fetch User Data ---
@api_bp.route("/fetch-user", methods=["POST"])
def fetch_user():
    req_data = request.json
    username = req_data.get("username")
    token = req_data.get("token")

    base_url = current_app.config["GITHUB_API_URL"]

    if not username:
        return jsonify({"error": "Username required"}), 400

    # Save History
    try:
        existing = SearchHistory.query.filter_by(username=username).first()
        if existing:
            existing.last_searched = datetime.utcnow()
        else:
            db.session.add(SearchHistory(username=username))
        db.session.commit()
    except Exception as e:
        print(f"Error saving history: {e}")

    profile_url = f"{base_url}/users/{username}"
    profile_data = fetch_and_cache(username, "profile", profile_url, token)

    if "error" in profile_data:
        return jsonify(profile_data), profile_data.get("error", 500)

    repos_url = f"{base_url}/users/{username}/repos"
    repos_data = fetch_and_cache(
        username, "repos", repos_url, token, params={"sort": "pushed"}
    )

    readme_url = f"{base_url}/repos/{username}/{username}/readme"
    readme_data = fetch_and_cache(username, "profile_readme", readme_url, token)
    if "error" in readme_data:
        readme_data = None

    return jsonify(
        {"profile": profile_data, "repos": repos_data, "profileReadme": readme_data}
    )


@api_bp.route("/search-history", methods=["GET"])
def get_search_history():
    try:
        history = (
            SearchHistory.query.order_by(SearchHistory.last_searched.desc())
            .limit(10)
            .all()
        )
        return jsonify([{"username": h.username} for h in history])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/commit-count", methods=["POST"])
def get_commit_count():
    req_data = request.json
    owner = req_data.get("owner")
    repo = req_data.get("repo")
    token = req_data.get("token")

    base_url = current_app.config["GITHUB_API_URL"]
    cache_key = f"{owner}/{repo}"

    # Check "Value Cache" first (Stores just the integer count)
    cached = CacheEntry.query.filter_by(
        username=cache_key, endpoint_type="commit_count_value"
    ).first()
    force_refresh = request.args.get("refresh") == "true"

    if cached and not force_refresh:
        return jsonify({"count": cached.data["count"]})

    # If no cache, call API to get Link header
    url = f"{base_url}/repos/{owner}/{repo}/commits?per_page=1"
    headers = get_github_headers(token)

    try:
        resp = requests.get(url, headers=headers)

        count = 0
        if resp.status_code == 200:
            link_header = resp.headers.get("Link")
            if link_header:
                parts = link_header.split(",")
                for part in parts:
                    if 'rel="last"' in part:
                        match = re.search(r"[?&]page=(\d+)", part)
                        if match:
                            count = int(match.group(1))
                        break
            else:
                resp_data = resp.json()
                if isinstance(resp_data, list):
                    count = len(resp_data)
        elif resp.status_code == 409:
            count = 0
        else:
            return jsonify({"error": resp.status_code}), resp.status_code

        # Save COUNT to DB
        final_data = {"count": count}
        if not cached:
            cached = CacheEntry(username=cache_key, endpoint_type="commit_count_value")
            db.session.add(cached)

        cached.data = final_data
        cached.last_updated = datetime.utcnow()
        db.session.commit()

        return jsonify(final_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/repo-readme", methods=["POST"])
def get_repo_readme():
    req_data = request.json
    username = req_data.get("owner")
    repo = req_data.get("repo")
    token = req_data.get("token")

    base_url = current_app.config["GITHUB_API_URL"]
    url = f"{base_url}/repos/{username}/{repo}/readme"
    cache_key = f"{username}/{repo}"

    data = fetch_and_cache(cache_key, "repo_readme", url, token)
    if "error" in data:
        return jsonify(data), data.get("error", 404)
    return jsonify(data)


@api_bp.route("/repo-commits", methods=["POST"])
def get_repo_commits():
    req_data = request.json
    username = req_data.get("owner")
    repo = req_data.get("repo")
    token = req_data.get("token")

    base_url = current_app.config["GITHUB_API_URL"]
    url = f"{base_url}/repos/{username}/{repo}/commits?per_page=30"
    cache_key = f"{username}/{repo}"

    data = fetch_and_cache(cache_key, "repo_history", url, token)
    if isinstance(data, dict) and "error" in data:
        return jsonify(data), data.get("error", 404)

    return jsonify(data)
