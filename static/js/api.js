export async function fetchSavedToken() {
  try {
    const r = await fetch('/api/config/token');
    if (!r.ok) return '';
    return (await r.json()).token;
  } catch (e) { return ''; }
}

export async function saveTokenToDB(token) {
  try { await fetch('/api/config/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }); } catch (e) { }
}

export async function fetchDownloadPath() {
  try {
    const r = await fetch('/api/config/path');
    if (!r.ok) return '';
    return (await r.json()).path;
  } catch (e) { return ''; }
}

export async function saveDownloadPath(path) {
  try { const r = await fetch('/api/config/path', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }); return r.ok; } catch (e) { return false; }
}

export async function fetchUser(username, token, refresh = false) {
  let url = '/api/fetch-user';
  if (refresh) url += '?refresh=true';
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, token }) });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch data.');
  }
  return await response.json();
}

export async function fetchCommitCount(owner, repoName, token) {
  try {
    const response = await fetch('/api/commit-count', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner, repo: repoName, token }) });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.count !== undefined ? data.count : 0;
  } catch (e) { return 0; }
}

export async function fetchRepoReadme(owner, repoName, token) {
  const r = await fetch('/api/repo-readme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner, repo: repoName, token }) });
  return await r.json();
}

export async function fetchRepoCommits(owner, repoName, token) {
  try {
    const r = await fetch('/api/repo-commits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner, repo: repoName, token }) });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

export async function fetchSearchHistory() {
  try {
    const r = await fetch('/api/search-history');
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}

export async function fetchWatchlist() {
  try {
    const r = await fetch('/api/watchlist');
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}

export async function addRepoByUrl(url, token) {
  try {
    const res = await fetch('/api/watchlist/add-by-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token }) });
    const data = await res.json();
    return { success: res.ok, message: data.message || data.error };
  } catch (e) { return { success: false, message: "Network Error" }; }
}

export async function untrackRepo(id) {
  try { const r = await fetch('/api/watchlist/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); return r.ok; } catch (e) { return false; }
}

export async function checkUpdates(token) {
  try {
    const res = await fetch('/api/watchlist/check-updates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    return await res.json();
  } catch (e) { return { updates_found: 0 }; }
}

export async function fetchRepoDetails(owner, repo, token) {
  try {
    const res = await fetch('/api/watchlist/details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner, repo, token }) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

export async function importWatchlist(file) {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/watchlist/import', { method: 'POST', body: formData });
    const data = await res.json();
    return { success: res.ok, message: data.message || data.error };
  } catch (e) { return { success: false, message: "Upload failed" }; }
}

export async function downloadAssetLocal(url, filename, repo_name, token) {
  try {
    const res = await fetch('/api/download-asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, filename, repo_name, token })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Download failed');
    return { success: true, path: data.path };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
