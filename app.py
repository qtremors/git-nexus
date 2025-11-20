import os
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from models import db, CacheEntry

app = Flask(__name__)

# Configuration
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(BASE_DIR, 'instance', 'project.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
GITHUB_API_URL = 'https://api.github.com'

# Initialize DB
db.init_app(app)

with app.app_context():
    os.makedirs(os.path.join(BASE_DIR, 'instance'), exist_ok=True)
    db.create_all()

def get_github_headers(token=None):
    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'
    return headers

def fetch_and_cache(username, endpoint_type, url, token=None, params=None):
    cached = CacheEntry.query.filter_by(username=username, endpoint_type=endpoint_type).first()
    force_refresh = request.args.get('refresh') == 'true'
    
    if cached and cached.is_fresh() and not force_refresh:
        print(f"[{endpoint_type}] Serving from DB Cache for {username}")
        return cached.data

    print(f"[{endpoint_type}] Fetching from GitHub API for {username}")
    headers = get_github_headers(token)
    
    try:
        if endpoint_type == 'repos':
            all_data = []
            page = 1
            while True:
                current_params = params.copy() if params else {}
                current_params['page'] = page
                current_params['per_page'] = 100
                
                resp = requests.get(url, headers=headers, params=current_params)
                if resp.status_code != 200:
                    if page == 1:
                        return {'error': resp.status_code, 'message': resp.json().get('message', 'API Error')}
                    break
                
                data = resp.json()
                if not data: break
                all_data.extend(data)
                if 'rel="next"' not in resp.headers.get('Link', ''): break
                page += 1
            final_data = all_data
        else:
            # Profile, Readme, or Commits
            resp = requests.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                return {'error': resp.status_code, 'message': resp.json().get('message', 'API Error')}
            final_data = resp.json()

        if not cached:
            cached = CacheEntry(username=username, endpoint_type=endpoint_type)
            db.session.add(cached)
        
        cached.data = final_data
        cached.last_updated = datetime.utcnow()
        db.session.commit()
        
        return final_data

    except requests.RequestException as e:
        return {'error': 500, 'message': str(e)}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/fetch-user', methods=['POST'])
def fetch_user():
    req_data = request.json
    username = req_data.get('username')
    token = req_data.get('token')

    if not username:
        return jsonify({'error': 'Username required'}), 400

    profile_url = f"{GITHUB_API_URL}/users/{username}"
    profile_data = fetch_and_cache(username, 'profile', profile_url, token)
    
    if 'error' in profile_data:
        return jsonify(profile_data), profile_data.get('error', 500)

    repos_url = f"{GITHUB_API_URL}/users/{username}/repos"
    repos_data = fetch_and_cache(username, 'repos', repos_url, token, params={'sort': 'pushed'})

    readme_url = f"{GITHUB_API_URL}/repos/{username}/{username}/readme"
    readme_data = fetch_and_cache(username, 'profile_readme', readme_url, token)
    if 'error' in readme_data: readme_data = None

    return jsonify({
        'profile': profile_data,
        'repos': repos_data,
        'profileReadme': readme_data
    })

@app.route('/api/commit-count', methods=['POST'])
def get_commit_count():
    req_data = request.json
    owner = req_data.get('owner')
    repo = req_data.get('repo')
    token = req_data.get('token')
    
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/commits?per_page=1"
    headers = get_github_headers(token)
    
    try:
        resp = requests.get(url, headers=headers)
        if resp.status_code == 409: return jsonify({'count': 0}) # Empty repo
        if resp.status_code != 200: return jsonify({'error': resp.status_code}), resp.status_code

        link_header = resp.headers.get('Link')
        count = 1
        if link_header:
            parts = link_header.split(',')
            for part in parts:
                if 'rel="last"' in part:
                    import re
                    match = re.search(r'[?&]page=(\d+)', part)
                    if match:
                        count = int(match.group(1))
                    break
        else:
            # Handle cases where result is a list (normal) or dict (error/edge case)
            data = resp.json()
            if isinstance(data, list):
                count = len(data)
            else:
                count = 0 

        return jsonify({'count': count})
    except Exception as e:
         return jsonify({'error': str(e)}), 500

@app.route('/api/repo-readme', methods=['POST'])
def get_repo_readme():
    req_data = request.json
    username = req_data.get('owner')
    repo = req_data.get('repo')
    token = req_data.get('token')
    
    url = f"{GITHUB_API_URL}/repos/{username}/{repo}/readme"
    cache_key = f"{username}/{repo}"
    
    data = fetch_and_cache(cache_key, 'repo_readme', url, token)
    if 'error' in data: return jsonify(data), data.get('error', 404)
    return jsonify(data)

@app.route('/api/repo-commits', methods=['POST'])
def get_repo_commits():
    req_data = request.json
    username = req_data.get('owner')
    repo = req_data.get('repo')
    token = req_data.get('token')
    
    url = f"{GITHUB_API_URL}/repos/{username}/{repo}/commits?per_page=30"
    cache_key = f"{username}/{repo}"
    
    data = fetch_and_cache(cache_key, 'repo_history', url, token)
    if isinstance(data, dict) and 'error' in data:
        return jsonify(data), data.get('error', 404)
        
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True)