/**
 * GitNexus v3.1.0 - Discovery Page
 * 
 * Direct dashboard with integrated search - no separate landing page.
 * Two views: Dashboard (search + results) and Repo Detail.
 */

import { useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
    Github,
    RefreshCw
} from 'lucide-react';
import {
    fetchUser,
    getCommitCount,
    getRepoReadme,
    getRepoCommits,
    getSearchHistory
} from '../api/client';
import type {
    FetchUserResponse,
    Repository,
    UserProfile,
    GitHubCommit
} from '../api/client';
import { useToast } from '../components/ui/Toast';
import { useApp } from '../store';
import { DiscoveryProfileHeader } from '../components/discovery/DiscoveryProfileHeader';
import { RepoList } from '../components/discovery/RepoList';
import { RepoDetailView } from '../components/discovery/RepoDetailView';

// --- Types ---
type ViewState = 'dashboard' | 'repo-detail';

// --- Helper: Decode Base64 UTF-8 ---
const decodeBase64UTF8 = (str: string): string => {
    try {
        const binaryString = atob(str);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    } catch {
        return atob(str);
    }
};

export default function Discovery() {
    const {
        discoverySearchQuery,
        discoveryUserData,
        discoveryRepos,
        discoveryProfileReadme,
        setDiscoveryState,

        // Global Cart
        downloadCart,
        toggleCartItem,
        downloadSelectedRepos
    } = useApp();

    const { showToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    // View state
    const [view, setView] = useState<ViewState>('dashboard');
    const [loading, setLoading] = useState(false);
    const [searchHistory, setSearchHistory] = useState<{ username: string }[]>([]);

    // Data states
    const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
    const [repoReadme, setRepoReadme] = useState<string | null>(null);
    const [repoCommits, setRepoCommits] = useState<GitHubCommit[]>([]);

    // Initial load for history
    useEffect(() => {
        loadHistory();
    }, []);

    // Sync with URL params
    const queryParam = searchParams.get('q');
    useEffect(() => {
        if (queryParam && queryParam !== discoverySearchQuery) {
            performSearch(queryParam);
        }
    }, [queryParam]);

    const loadHistory = async () => {
        try {
            const history = await getSearchHistory();
            setSearchHistory(history);
        } catch {
            // fail silently
        }
    };

    // --- Actions ---

    const performSearch = async (query: string, refresh = false) => {
        if (!query.trim()) return;
        setLoading(true);

        // Clear global state temporarily if it's a new search (and not a refresh)
        if (query !== discoverySearchQuery && !refresh) {
            setDiscoveryState(query, null, [], null);
        }

        try {
            const data: FetchUserResponse = await fetchUser(query.trim(), refresh);

            if (data.error) {
                showToast('User not found', 'error');
                setLoading(false);
                return;
            }

            let profileReadmeContent: string | null = null;
            if (data.profileReadme?.content) {
                try {
                    profileReadmeContent = decodeBase64UTF8(data.profileReadme.content);
                } catch { /* ignore */ }
            }

            setDiscoveryState(query, data.profile, data.repos, profileReadmeContent);
            loadHistory();
            fetchCommitCounts(data.repos, data.profile, profileReadmeContent, refresh);

            if (refresh) showToast('Profile refreshed successfully', 'success');
        } catch {
            showToast('Failed to fetch user data', 'error');
            setLoading(false);
        }
    };

    const handleHistoryClick = (username: string) => {
        setSearchParams({ q: username });
    };

    const fetchCommitCounts = async (
        repoList: Repository[],
        profile: UserProfile,
        readme: string | null,
        refresh = false
    ) => {
        const updates = [...repoList];
        await Promise.allSettled(
            updates.map(async (repo, index) => {
                try {
                    const res = await getCommitCount(repo.owner.login, repo.name, refresh);
                    updates[index] = { ...repo, commit_count: res.count };
                } catch {
                    updates[index] = { ...repo, commit_count: 0 };
                }
            })
        );
        // Note: we use queryParam or discoverySearchQuery here
        setDiscoveryState(discoverySearchQuery, profile, updates, readme);
        setLoading(false);
    };

    const handleOpenRepoDetail = async (repo: Repository) => {
        setSelectedRepo(repo);
        setRepoReadme(null);
        setRepoCommits([]);
        setView('repo-detail');

        // Fetch README
        try {
            const res = await getRepoReadme(repo.owner.login, repo.name);
            if (res.content) {
                setRepoReadme(decodeBase64UTF8(res.content));
            } else {
                setRepoReadme('No README found.');
            }
        } catch {
            setRepoReadme('Error fetching README.');
        }

        // Fetch commits
        try {
            // Fetch 1000 commits to show "all" (or reasonably recent history)
            const commits = await getRepoCommits(repo.owner.login, repo.name, 1, 1000);
            if (Array.isArray(commits)) {
                setRepoCommits(commits as GitHubCommit[]);
            }
        } catch {
            setRepoCommits([]);
        }
    };

    const handleRefreshRepoCommits = async (repo: Repository) => {
        setRepoCommits([]); // Show loading state
        try {
            // owner, repo, page, perPage, since, refresh
            const commits = await getRepoCommits(repo.owner.login, repo.name, 1, 1000, undefined, true);
            if (Array.isArray(commits)) {
                setRepoCommits(commits.slice(0, 1000) as GitHubCommit[]); // Increased limit for detail view
            }
        } catch {
            showToast('Failed to refresh commits', 'error');
            setRepoCommits([]);
        }
    };

    // --- Dashboard View ---
    const renderDashboard = () => (
        <div className="h-full flex flex-col pt-6"> {/* Added pt-6 for spacing since header is gone */}

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {!discoveryUserData ? (
                    // Empty State
                    <div className="h-full flex flex-col items-center justify-center text-text-muted p-8">
                        {loading ? (
                            <div className="flex flex-col items-center animate-pulse">
                                <RefreshCw className="w-12 h-12 mb-4 text-blue-500 animate-spin" />
                                <span className="text-lg text-blue-400">Searching GitHub...</span>
                            </div>
                        ) : (
                            <>
                                <Github className="w-16 h-16 mb-4 opacity-20" />
                                <h2 className="text-xl font-semibold text-text-muted mb-2">Search for a GitHub User</h2>
                                <p className="text-center max-w-md mb-8">
                                    Use the search bar in the header to explore profiles and repositories.
                                </p>

                                {searchHistory.length > 0 ? (
                                    <div className="max-w-md w-full">
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {searchHistory.map(entry => (
                                                <button
                                                    key={entry.username}
                                                    onClick={() => handleHistoryClick(entry.username)}
                                                    className="px-3 py-1.5 bg-app-surface text-text-muted rounded-lg hover:bg-app-surface-accent hover:text-white transition-colors text-sm"
                                                >
                                                    {entry.username}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-6 flex gap-2">
                                        {['vercel', 'facebook', 'microsoft'].map(name => (
                                            <button
                                                key={name}
                                                onClick={() => handleHistoryClick(name)}
                                                className="px-3 py-1.5 bg-app-surface text-text-brand-muted rounded-lg hover:bg-app-surface-accent hover:text-white transition-colors text-sm"
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    // User Results
                    <div className="p-6 flex flex-col gap-6 max-w-[1600px] mx-auto">

                        {/* Profile Header */}
                        <div className="relative">
                            <DiscoveryProfileHeader
                                userData={discoveryUserData}
                                totalCommits={discoveryRepos.reduce((acc, repo) => acc + (repo.commit_count || 0), 0)}
                            />
                            <button
                                onClick={() => performSearch(discoveryUserData?.login || discoverySearchQuery, true)}
                                disabled={loading}
                                className="absolute top-0 right-0 p-2 text-text-muted hover:text-white bg-app-surface hover:bg-app-surface-accent rounded-lg transition-colors border border-app-border"
                                title="Refresh Profile"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin text-blue-400' : ''} />
                            </button>
                        </div>
                        <RepoList
                            repos={discoveryRepos}
                            profileReadme={discoveryProfileReadme}
                            downloadCart={downloadCart}
                            onToggleCartItem={toggleCartItem}
                            onDownload={downloadSelectedRepos}
                            onOpenRepoDetail={handleOpenRepoDetail}
                        />
                    </div>
                )}
            </div>
        </div>
    );

    // --- Render ---
    return (
        <div className="h-full bg-app-bg text-text-main">
            {view === 'dashboard' && renderDashboard()}
            {view === 'repo-detail' && selectedRepo && (
                <RepoDetailView
                    repo={selectedRepo}
                    readme={repoReadme}
                    commits={repoCommits}
                    onBack={() => setView('dashboard')}
                    onRefresh={() => handleRefreshRepoCommits(selectedRepo)}
                />
            )}
        </div>
    );
}
