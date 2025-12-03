import json
import os
import re
import tempfile
from datetime import datetime

import requests
from flask import Blueprint, current_app, jsonify, request, send_file

from app.models import AppConfig, CacheEntry, SearchHistory, TrackedRepo, db
from app.services import (
    fetch_and_cache,
    fetch_latest_release,
    fetch_repo_metadata,
    fetch_repo_releases,
    get_github_headers,
    parse_github_url,
)

api_bp = Blueprint("api", __name__, url_prefix="/api")

# ==========================================
#           CONFIGURATION & TOKENS
# ==========================================


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


@api_bp.route("/config/path", methods=["GET"])
def get_download_path():
    config = AppConfig.query.get("download_path")
    default_path = os.path.join(os.getcwd(), "downloads")
    return jsonify({"path": config.value if config else default_path})


@api_bp.route("/config/path", methods=["POST"])
def save_download_path():
    path = request.json.get("path", "").strip()
    if not os.path.exists(path):
        try:
            os.makedirs(path, exist_ok=True)
        except:
            return jsonify({"error": "Invalid path or permission denied"}), 400

    config = AppConfig.query.get("download_path")
    if not config:
        config = AppConfig(key="download_path", value=path)
        db.session.add(config)
    else:
        config.value = path
    db.session.commit()
    return jsonify({"status": "saved"})


# ==========================================
#           V1: USER DISCOVERY
# ==========================================


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
        print(f"History Error: {e}")

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

    # 1. Check DB Cache
    cached = CacheEntry.query.filter_by(
        username=cache_key, endpoint_type="commit_count_value"
    ).first()
    force_refresh = request.args.get("refresh") == "true"

    if cached and not force_refresh:
        return jsonify(cached.data)

    # 2. Fetch from GitHub (Pagination Trick)
    url = f"{base_url}/repos/{owner}/{repo}/commits?per_page=1"
    headers = get_github_headers(token)

    try:
        resp = requests.get(url, headers=headers)

        count = 0
        if resp.status_code == 200:
            link_header = resp.headers.get("Link")
            if link_header:
                # Regex to find the last page number in "rel=last"
                parts = link_header.split(",")
                for part in parts:
                    if 'rel="last"' in part:
                        match = re.search(r"[?&]page=(\d+)", part)
                        if match:
                            count = int(match.group(1))
                        break
            else:
                # No pagination means < 1 page of commits (0 or 1)
                resp_data = resp.json()
                if isinstance(resp_data, list):
                    count = len(resp_data)
        elif resp.status_code == 409:  # Empty repo
            count = 0
        else:
            return jsonify({"count": 0, "error": resp.status_code}), 200

        # 3. Save to DB
        final_data = {"count": count}
        if not cached:
            cached = CacheEntry(username=cache_key, endpoint_type="commit_count_value")
            db.session.add(cached)

        cached.data = final_data
        cached.last_updated = datetime.utcnow()
        db.session.commit()

        return jsonify(final_data)

    except Exception as e:
        print(f"Commit Count Error: {e}")
        return jsonify({"count": 0}), 200


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


# ==========================================
#           WATCHLIST
# ==========================================


@api_bp.route("/watchlist", methods=["GET"])
def get_watchlist():
    repos = TrackedRepo.query.order_by(TrackedRepo.last_checked.desc()).all()
    result = []
    for r in repos:
        result.append(
            {
                "id": r.id,
                "owner": r.owner,
                "name": r.repo_name,
                "current_version": r.current_version,
                "latest_version": r.latest_version,
                "description": r.description,
                "avatar_url": r.avatar_url,
                "html_url": r.html_url,
            }
        )
    return jsonify(result)


@api_bp.route("/watchlist/add-by-url", methods=["POST"])
def add_by_url():
    data = request.json
    url = data.get("url")
    token = data.get("token")

    owner, name = parse_github_url(url)
    if not owner or not name:
        return jsonify({"error": "Invalid GitHub URL"}), 400

    existing = TrackedRepo.query.filter_by(owner=owner, repo_name=name).first()
    if existing:
        return jsonify({"message": "Repository is already in your watchlist"}), 409

    meta = fetch_repo_metadata(owner, name, token)
    if not meta:
        return jsonify({"error": "Repository not found or private"}), 404

    new_repo = TrackedRepo(
        owner=owner,
        repo_name=name,
        description=meta.get("description"),
        avatar_url=meta["owner"]["avatar_url"],
        html_url=meta["html_url"],
        current_version="Not Checked",
    )
    db.session.add(new_repo)
    db.session.commit()

    return jsonify({"message": f"Added {name} to watchlist"}), 201


@api_bp.route("/watchlist/remove", methods=["POST"])
def untrack_repo():
    repo_id = request.json.get("id")
    repo = TrackedRepo.query.get(repo_id)
    if repo:
        db.session.delete(repo)
        db.session.commit()
        return jsonify({"message": "Removed"}), 200
    return jsonify({"error": "Not found"}), 404


@api_bp.route("/watchlist/check-updates", methods=["POST"])
def check_updates():
    token = request.json.get("token")
    repos = TrackedRepo.query.all()
    updates_found = 0

    for repo in repos:
        release_data = fetch_latest_release(repo.owner, repo.repo_name, token)
        if release_data:
            tag_name = release_data.get("tag_name", "Unknown")
            if repo.latest_version != tag_name:
                repo.latest_version = tag_name
                updates_found += 1
            if repo.current_version == "Not Checked":
                repo.current_version = tag_name
            repo.last_checked = datetime.utcnow()

    db.session.commit()
    return jsonify({"updates_found": updates_found, "message": "Check complete"})


@api_bp.route("/watchlist/details", methods=["POST"])
def get_watchlist_details():
    req = request.json
    owner = req.get("owner")
    repo = req.get("repo")
    token = req.get("token")

    releases = fetch_repo_releases(owner, repo, token, limit=3)
    formatted = []
    for r in releases:
        assets = []
        for a in r.get("assets", []):
            assets.append(
                {
                    "name": a["name"],
                    "size": a["size"],
                    "download_url": a["browser_download_url"],
                    "updated_at": a["updated_at"],
                }
            )
        formatted.append(
            {
                "tag_name": r["tag_name"],
                "name": r["name"],
                "published_at": r["published_at"],
                "html_url": r["html_url"],
                "assets": assets,
            }
        )

    return jsonify(formatted)


# ==========================================
#           DATA MGMT & DOWNLOADS
# ==========================================


@api_bp.route("/watchlist/export", methods=["GET"])
def export_watchlist():
    repos = TrackedRepo.query.all()
    export_data = []
    for r in repos:
        export_data.append(
            {
                "owner": r.owner,
                "name": r.repo_name,
                "description": r.description,
                "avatar_url": r.avatar_url,
                "html_url": r.html_url,
                "current_version": r.current_version,
            }
        )

    fd, path = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w") as tmp:
        json.dump(export_data, tmp, indent=4)

    return send_file(
        path,
        as_attachment=True,
        download_name=f"gitnexus_backup_{datetime.now().strftime('%Y%m%d')}.json",
    )


@api_bp.route("/watchlist/import", methods=["POST"])
def import_watchlist():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    try:
        data = json.load(file)
        added_count = 0
        for item in data:
            owner = item.get("owner")
            name = item.get("name")

            existing = TrackedRepo.query.filter_by(owner=owner, repo_name=name).first()
            if not existing:
                new_repo = TrackedRepo(
                    owner=owner,
                    repo_name=name,
                    description=item.get("description"),
                    avatar_url=item.get("avatar_url"),
                    html_url=item.get("html_url"),
                    current_version=item.get("current_version", "Not Checked"),
                )
                db.session.add(new_repo)
                added_count += 1

        db.session.commit()
        return jsonify(
            {
                "message": f"Successfully imported {added_count} repositories.",
                "success": True,
            }
        )
    except Exception as e:
        return jsonify({"error": f"Invalid JSON: {str(e)}", "success": False}), 400


@api_bp.route("/download-asset", methods=["POST"])
def download_asset():
    req = request.json
    asset_url = req.get("url")
    filename = req.get("filename")
    repo_name = req.get("repo_name")
    token = req.get("token")

    path_config = AppConfig.query.get("download_path")
    base_path = (
        path_config.value if path_config else os.path.join(os.getcwd(), "downloads")
    )

    target_dir = os.path.join(base_path, repo_name)
    try:
        os.makedirs(target_dir, exist_ok=True)
    except Exception as e:
        return jsonify({"error": f"Permission denied creating {target_dir}"}), 500

    target_file = os.path.join(target_dir, filename)

    try:
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        with requests.get(
            asset_url, stream=True, headers=headers, allow_redirects=True
        ) as r:
            r.raise_for_status()
            with open(target_file, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        return jsonify({"message": "Download complete", "path": target_file})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
