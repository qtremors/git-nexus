import type {
    UserProfile,
    Repository,
    GitHubCommit,
    TrackedRepo,
    Release,
    ReplayRepo,
    Commit,
    PaginatedCommits,
    Server,
    FileTreeNode
} from '../types';

export type {
    UserProfile,
    Repository,
    GitHubCommit,
    TrackedRepo,
    Release,
    ReplayRepo,
    Commit,
    PaginatedCommits,
    Server,
    FileTreeNode
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || `HTTP error! status: ${res.status}`);
    }
    return res.json();
}

// ============================================
//              DISCOVERY API
// ============================================

export interface FetchUserResponse {
    profile: UserProfile;
    repos: Repository[];
    profileReadme: { content: string } | null;
    error?: number;
}

export async function getSystemLogs(limit = 100): Promise<{ id: string; timestamp: string; level: string; message: string; module: string }[]> {
    const res = await fetch(`${API_BASE}/logs?limit=${limit}`);
    return handleResponse<{ id: string; timestamp: string; level: string; message: string; module: string }[]>(res);
}

export async function fetchUser(username: string, refresh = false): Promise<FetchUserResponse> {
    const res = await fetch(`${API_BASE}/discovery/fetch-user?refresh=${refresh}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
    });
    return handleResponse<FetchUserResponse>(res);
}

export async function getSearchHistory(): Promise<{ username: string }[]> {
    const res = await fetch(`${API_BASE}/discovery/search-history`);
    return handleResponse<{ username: string }[]>(res);
}

export async function getCommitCount(owner: string, repo: string, refresh = false): Promise<{ count: number }> {
    const res = await fetch(`${API_BASE}/discovery/commit-count?refresh=${refresh}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo }),
    });
    return handleResponse<{ count: number }>(res);
}

export async function getRepoReadme(owner: string, repo: string): Promise<{ content?: string; error?: number }> {
    const res = await fetch(`${API_BASE}/discovery/repo-readme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo }),
    });
    return handleResponse<{ content?: string; error?: number }>(res);
}

export async function getRepoCommits(owner: string, repo: string, page = 1, perPage = 30, since?: string, refresh = false): Promise<GitHubCommit[]> {
    const res = await fetch(`${API_BASE}/discovery/repo-commits?refresh=${refresh}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, page, per_page: perPage, since }),
    });
    return handleResponse<GitHubCommit[]>(res);
}

export interface DownloadResult {
    id: number;
    name: string;
    owner: string;
    path?: string;
    error?: string;
}

export async function downloadRepos(repos: { id: number; name: string; owner: string }[]): Promise<{ success: DownloadResult[]; failed: DownloadResult[]; base_path: string }> {
    const res = await fetch(`${API_BASE}/discovery/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            repos: repos.map(r => ({ id: r.id, name: r.name, owner: r.owner }))
        }),
    });
    return handleResponse<{ success: DownloadResult[]; failed: DownloadResult[]; base_path: string }>(res);
}

// ============================================
//              CONTRIBUTION GRAPH API
// ============================================

export interface ContributionCommit {
    sha: string;
    date: string;
    message: string;
    repo: string;
    url: string;
}

export interface ContributionGraphResponse {
    commits: ContributionCommit[];
    loading: boolean;
}

export async function getContributionGraph(username: string, repos: Repository[], refresh = false): Promise<ContributionGraphResponse> {
    const res = await fetch(`${API_BASE}/discovery/contribution-graph?refresh=${refresh}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username,
            repos: repos.map(r => ({ id: r.id, name: r.name, owner: r.owner.login }))
        }),
    });
    return handleResponse<ContributionGraphResponse>(res);
}

export async function getGitHubApiStatus(): Promise<{ limit: number; remaining: number; reset_time: number; token_source: string; last_updated: string | null }> {
    const res = await fetch(`${API_BASE}/discovery/api-status`);
    return handleResponse<{ limit: number; remaining: number; reset_time: number; token_source: string; last_updated: string | null }>(res);
}

// ============================================
//              WATCHLIST API
// ============================================

export async function getWatchlist(): Promise<TrackedRepo[]> {
    const res = await fetch(`${API_BASE}/watchlist`);
    return handleResponse<TrackedRepo[]>(res);
}

export async function addToWatchlist(url: string): Promise<{ message: string; success: boolean }> {
    const res = await fetch(`${API_BASE}/watchlist/add-by-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    });
    return handleResponse<{ message: string; success: boolean }>(res);
}

export async function removeFromWatchlist(id: number): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/watchlist/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
    return handleResponse<{ message: string }>(res);
}

export async function checkUpdates(): Promise<{ updates_found: number }> {
    const res = await fetch(`${API_BASE}/watchlist/check-updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
    return handleResponse<{ updates_found: number }>(res);
}

export async function reorderWatchlist(ids: number[]): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/watchlist/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
    });
    return handleResponse<{ message: string }>(res);
}

export async function fetchRepoDetails(owner: string, repo: string, limit = 30): Promise<Release[]> {
    const res = await fetch(`${API_BASE}/watchlist/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, limit }),
    });
    return handleResponse<Release[]>(res);
}

export async function exportWatchlist(): Promise<Blob> {
    const res = await fetch(`${API_BASE}/watchlist/export`);
    if (!res.ok) {
        throw new Error('Export failed');
    }
    return res.blob();
}

export async function importWatchlist(file: File): Promise<{ message: string; success: boolean }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/watchlist/import`, {
        method: 'POST',
        body: formData,
    });
    return handleResponse<{ message: string; success: boolean }>(res);
}

// ============================================
//              SETTINGS API
// ============================================

export async function getToken(): Promise<{ token: string; source?: 'env' | 'db' | 'none'; isActive?: boolean }> {
    const res = await fetch(`${API_BASE}/settings/token`);
    return handleResponse<{ token: string; source?: 'env' | 'db' | 'none'; isActive?: boolean }>(res);
}

export async function saveToken(token: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/settings/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    });
    return handleResponse<{ status: string }>(res);
}

export async function getDownloadPath(): Promise<{ path: string }> {
    const res = await fetch(`${API_BASE}/settings/download-path`);
    return handleResponse<{ path: string }>(res);
}

export async function saveDownloadPath(path: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/settings/download-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
    });
    return handleResponse<{ status: string }>(res);
}

export async function downloadAsset(url: string, filename: string, repoName: string): Promise<{ message: string; path: string; success: boolean }> {
    const res = await fetch(`${API_BASE}/settings/download-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, filename, repo_name: repoName }),
    });

    const data = await handleResponse<{ message: string; path: string }>(res);
    return { ...data, success: true };
}

export async function getTheme(): Promise<{ theme: string }> {
    const res = await fetch(`${API_BASE}/settings/theme`);
    return handleResponse<{ theme: string }>(res);
}

export async function saveTheme(theme: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/settings/theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
    });
    return handleResponse<{ status: string }>(res);
}

export async function getLastRepo(): Promise<{ repo_id: number | null }> {
    const res = await fetch(`${API_BASE}/settings/last-repo`);
    return handleResponse<{ repo_id: number | null }>(res);
}

export async function saveLastRepo(repoId: number | null): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/settings/last-repo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repoId }),
    });
    return handleResponse<{ status: string }>(res);
}

export async function clearCache(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/settings/clear-cache`, { method: 'POST' });
    return handleResponse<{ message: string }>(res);
}

export async function clearLogs(daysToKeep = 0): Promise<{ message: string; deleted: number }> {
    const res = await fetch(`${API_BASE}/settings/clear-logs?days_to_keep=${daysToKeep}`, { method: 'POST' });
    return handleResponse<{ message: string; deleted: number }>(res);
}

// ============================================
//              REPLAY API
// ============================================

export async function getReplayRepos(): Promise<ReplayRepo[]> {
    const res = await fetch(`${API_BASE}/replay/repos`);
    return handleResponse<ReplayRepo[]>(res);
}

export async function addLocalRepo(path: string): Promise<ReplayRepo> {
    const res = await fetch(`${API_BASE}/replay/repos/local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
    });
    return handleResponse<ReplayRepo>(res);
}

export async function cloneRepo(url: string, dest: string): Promise<ReplayRepo> {
    const res = await fetch(`${API_BASE}/replay/repos/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, dest }),
    });
    return handleResponse<ReplayRepo>(res);
}

export async function deleteReplayRepo(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/replay/repos/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to delete repository: ${res.status}`);
    }
}

export async function getStoredRepoCommits(repoId: number, page = 1, pageSize = 50): Promise<PaginatedCommits> {
    const res = await fetch(`${API_BASE}/replay/repos/${repoId}/commits?page=${page}&page_size=${pageSize}`);
    return handleResponse<PaginatedCommits>(res);
}

export async function syncRepoCommits(repoId: number): Promise<{ synced: number; message: string }> {
    const res = await fetch(`${API_BASE}/replay/repos/${repoId}/sync-commits`, {
        method: 'POST',
    });
    return handleResponse<{ synced: number; message: string }>(res);
}

export async function getServers(): Promise<Server[]> {
    const res = await fetch(`${API_BASE}/replay/servers`);
    return handleResponse<Server[]>(res);
}

export async function startServer(repoId: number, commitHash: string, port?: number): Promise<Server> {
    const res = await fetch(`${API_BASE}/replay/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repoId, commit_hash: commitHash, port }),
    });
    return handleResponse<Server>(res);
}

export async function stopServer(serverId: string): Promise<{ stopped: boolean }> {
    const res = await fetch(`${API_BASE}/replay/servers/${serverId}/stop`, {
        method: 'POST',
    });
    return handleResponse<{ stopped: boolean }>(res);
}

export async function removeServer(serverId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/replay/servers/${serverId}`, {
        method: 'DELETE',
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to remove server: ${res.status}`);
    }
}

export async function stopAllServers(): Promise<{ stopped: number }> {
    const res = await fetch(`${API_BASE}/replay/servers/stop-all`, {
        method: 'POST',
    });
    return handleResponse<{ stopped: number }>(res);
}

export async function getFileTree(repoId: number, commit = 'HEAD'): Promise<FileTreeNode[]> {
    const res = await fetch(`${API_BASE}/replay/repos/${repoId}/files?commit=${encodeURIComponent(commit)}`);
    return handleResponse<FileTreeNode[]>(res);
}

export async function getFileContent(repoId: number, filePath: string, commit = 'HEAD'): Promise<{ content: string; path: string; commit: string }> {
    const res = await fetch(`${API_BASE}/replay/repos/${repoId}/file-content?path=${encodeURIComponent(filePath)}&commit=${encodeURIComponent(commit)}`);
    return handleResponse<{ content: string; path: string; commit: string }>(res);
}

// ============================================
//            ENV VARS API
// ============================================

export interface EnvVar {
    id: number;
    key: string;
    value: string;
}

export interface EnvVarUpdate {
    key: string;
    value: string;
}

export async function getGlobalVars(): Promise<EnvVar[]> {
    const res = await fetch(`${API_BASE}/env/global`);
    return handleResponse<EnvVar[]>(res);
}

export async function setGlobalVars(vars: EnvVarUpdate[]): Promise<EnvVar[]> {
    const res = await fetch(`${API_BASE}/env/global`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars }),
    });
    return handleResponse<EnvVar[]>(res);
}

export async function getProjectVars(repoId: number): Promise<EnvVar[]> {
    const res = await fetch(`${API_BASE}/env/project/${repoId}`);
    return handleResponse<EnvVar[]>(res);
}

export async function setProjectVars(repoId: number, vars: EnvVarUpdate[]): Promise<EnvVar[]> {
    const res = await fetch(`${API_BASE}/env/project/${repoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars }),
    });
    return handleResponse<EnvVar[]>(res);
}

export async function getCommitVars(repoId: number, commitHash: string): Promise<EnvVar[]> {
    const res = await fetch(`${API_BASE}/env/commit/${repoId}/${commitHash}`);
    return handleResponse<EnvVar[]>(res);
}

export async function setCommitVars(repoId: number, commitHash: string, vars: EnvVarUpdate[]): Promise<EnvVar[]> {
    const res = await fetch(`${API_BASE}/env/commit/${repoId}/${commitHash}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars }),
    });
    return handleResponse<EnvVar[]>(res);
}
