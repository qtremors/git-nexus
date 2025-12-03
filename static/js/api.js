// Fetch Token from DB
export async function fetchSavedToken() {
    try {
        const res = await fetch('/api/config/token');
        const data = await res.json();
        return data.token;
    } catch (e) {
        console.error("Failed to load token from DB", e);
        return '';
    }
}

// Save Token to DB
export async function saveTokenToDB(token) {
    try {
        await fetch('/api/config/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
    } catch (e) {
        console.error("Failed to save token to DB", e);
    }
}

export async function fetchUser(username, token, refresh = false) {
    let url = '/api/fetch-user';
    if (refresh) url += '?refresh=true';

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, token })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch data.');
    return data;
}

export async function fetchCommitCount(owner, repoName, token) {
    try {
        const response = await fetch('/api/commit-count', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner, repo: repoName, token })
        });

        // 403 = Rate Limit, 429 = Too Many Requests
        if (response.status === 403 || response.status === 429) {
            console.warn(`[Rate Limit Hit] Could not fetch commits for ${repoName}`);
            return null; // Return null to signal an error state
        }

        const data = await response.json();
        return data.count !== undefined ? data.count : 0;
    } catch (error) {
        console.error("Network error fetching commits:", error);
        return null;
    }
}

export async function fetchRepoReadme(owner, repoName, token) {
    const response = await fetch('/api/repo-readme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo: repoName, token })
    });
    const data = await response.json();
    if (data.error) throw new Error('README not found.');
    return data;
}

export async function fetchRepoCommits(owner, repoName, token) {
    const response = await fetch('/api/repo-commits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo: repoName, token })
    });
    const data = await response.json();
    if (data.error) throw new Error('Commits could not be fetched.');
    return data;
}

export async function fetchSearchHistory() {
    try {
        const res = await fetch('/api/search-history');
        if (res.ok) return await res.json();
        return [];
    } catch (e) {
        console.error("Failed to fetch history", e);
        return [];
    }
}
