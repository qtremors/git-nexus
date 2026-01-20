// Core Domain Entities

export interface UserProfile {
    login: string;
    name: string | null;
    avatar_url: string;
    bio: string | null;
    followers: number;
    following: number;
    public_repos: number;
    html_url: string;
}

export interface Repository {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    topics: string[];
    html_url: string;
    clone_url: string;
    homepage: string | null;
    created_at: string;
    updated_at: string;
    default_branch: string;
    owner: { login: string; avatar_url: string };
    commit_count?: number;
}

export interface GitHubCommit {
    sha: string;
    commit: {
        message: string;
        author: {
            name: string;
            date: string;
        };
    };
    author: {
        avatar_url: string;
    } | null;
    html_url: string;
}

// Flat commit structure returned by contribution graph API
export interface ContributionCommit {
    sha: string;
    date: string;
    message: string;
    repo: string;
    url: string;
}

// Replay / Worktree Entities

export interface ReplayRepo {
    id: number;
    name: string;
    path: string;
    is_remote: boolean;
    remote_url: string | null;
}

export interface Commit {
    hash: string;
    short_hash: string;
    message: string;
    author: string;
    author_email: string;
    date: string;
    commit_number: number;
}

export interface PaginatedCommits {
    commits: Commit[];
    total: number;
    page: number;
    page_size: number;
    has_more: boolean;
}

export interface Server {
    id: string;
    repo_id: number;
    repo_name: string;
    commit_hash: string;
    short_hash: string;
    port: number;
    url: string;
    status: string;
    started_at: string | null;
    error: string | null;
}

export interface FileTreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    children?: FileTreeNode[];
}

// Watchlist Entities

export interface TrackedRepo {
    id: number;
    owner: string;
    name: string;
    current_version: string;
    latest_version: string | null;
    description: string | null;
    avatar_url: string | null;
    html_url: string | null;
    last_checked?: string;
    sort_order: number;
    releases?: ReleaseDetails[];
}

export interface ReleaseAsset {
    id: number;
    name: string;
    size: number;
    download_url: string;
    updated_at: string;
}

export interface ReleaseDetails {
    id: number;
    tag_name: string;
    name: string;
    published_at: string;
    html_url: string;
    prerelease: boolean;
    assets: ReleaseAsset[];
}

export type Release = ReleaseDetails;

// Discovery UI Types
export type DiscoveryViewState = 'dashboard' | 'repo-detail';
