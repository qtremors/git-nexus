/**
 * GitNexus v3.0.0 - Store
 * 
 * Simple React context-based state management.
 * Unified for both GitNexus Discovery and RepoReplay features.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import * as API from '../api/client';
import { themes, type ThemeValue } from '../constants/themes';

export type Theme = ThemeValue;

interface AppState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    token: string;
    setToken: (token: string) => void;
    downloadPath: string;
    setDownloadPath: (path: string) => void;

    // Replay State
    replayRepos: API.ReplayRepo[];
    selectedRepoId: number | null;
    selectedCommitHash: string | null;
    commits: API.Commit[];
    commitsLoading: boolean;
    commitsHasMore: boolean;
    commitsTotal: number;
    commitsPage: number;
    servers: API.Server[];
    serversLoading: boolean;

    // Replay Actions
    loadReplayRepos: () => Promise<void>;
    addLocalRepo: (path: string) => Promise<void>;
    cloneRepo: (url: string, dest: string) => Promise<void>;
    deleteReplayRepo: (id: number) => Promise<void>;
    selectRepo: (id: number) => void;
    selectCommit: (hash: string) => void;
    loadCommits: (repoId: number) => Promise<void>;
    loadMoreCommits: () => Promise<void>;
    loadServers: () => Promise<void>;
    startServer: (repoId: number, commitHash: string) => Promise<void>;
    stopServer: (serverId: string) => Promise<void>;
    syncRepo: (repoId: number) => Promise<void>;

    // Discovery State
    discoverySearchQuery: string;
    discoveryUserData: API.UserProfile | null;
    discoveryRepos: API.Repository[];
    discoveryProfileReadme: string | null;
    setDiscoveryState: (query: string, user: API.UserProfile | null, repos: API.Repository[], readme: string | null) => void;

    // Download Cart
    downloadCart: Map<number, API.Repository>;
    toggleCartItem: (repo: API.Repository) => void;
    clearCart: () => void;
    isDownloading: boolean;
    setIsDownloading: (val: boolean) => void;
    downloadSelectedRepos: () => Promise<{ success: API.DownloadResult[]; failed: API.DownloadResult[]; base_path: string } | undefined>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
    // --- Global Settings ---
    const [theme, setThemeState] = useState<Theme>('default');

    // Load theme from DB
    useEffect(() => {
        API.getTheme().then(res => {
            if (res.theme) {
                setThemeState(res.theme as Theme);
            }
        }).catch(() => { });
    }, []);
    const [token, setTokenState] = useState('');
    const [downloadPath, setDownloadPathState] = useState('');

    // --- Replay State ---
    const [replayRepos, setReplayRepos] = useState<API.ReplayRepo[]>([]);
    const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);

    // Initial Load
    useEffect(() => {
        const init = async () => {
            // Load last repo
            try {
                const { repo_id } = await API.getLastRepo();
                if (repo_id) {
                    setSelectedRepoId(repo_id);
                }
            } catch { }
        };
        init();
    }, []);
    const [commits, setCommits] = useState<API.Commit[]>([]);
    const [commitsLoading, setCommitsLoading] = useState(false);
    const [commitsHasMore, setCommitsHasMore] = useState(false);
    const [commitsTotal, setCommitsTotal] = useState(0);
    const [commitsPage, setCommitsPage] = useState(1);
    const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
    const [servers, setServers] = useState<API.Server[]>([]);
    const [serversLoading, setServersLoading] = useState(false);

    // --- Discovery State ---
    const [discoverySearchQuery, setDiscoverySearchQuery] = useState('');
    const [discoveryUserData, setDiscoveryUserData] = useState<API.UserProfile | null>(null);
    const [discoveryRepos, setDiscoveryRepos] = useState<API.Repository[]>([]);
    const [discoveryProfileReadme, setDiscoveryProfileReadme] = useState<string | null>(null);

    // --- Download Cart State ---
    const [downloadCart, setDownloadCart] = useState<Map<number, API.Repository>>(new Map());
    const [isDownloading, setIsDownloading] = useState(false);

    // --- Actions ---

    // Cart Actions
    const toggleCartItem = (repo: API.Repository) => {
        setDownloadCart(prev => {
            const next = new Map(prev);
            if (next.has(repo.id)) {
                next.delete(repo.id);
            } else {
                next.set(repo.id, repo);
            }
            return next;
        });
    };

    const clearCart = () => setDownloadCart(new Map());

    const downloadSelectedRepos = async () => {
        if (downloadCart.size === 0) return;
        setIsDownloading(true);

        try {
            const reposToDownload = Array.from(downloadCart.values()).map(r => ({
                id: r.id,
                name: r.name,
                owner: r.owner.login
            }));

            const result = await API.downloadRepos(reposToDownload);

            clearCart();
            return result;
        } catch (e) {
            console.error("Download failed", e);
            throw e;
        } finally {
            setIsDownloading(false);
        }
    };


    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        API.saveTheme(newTheme).catch(console.error);
    };

    const setToken = (newToken: string) => setTokenState(newToken);
    const setDownloadPath = (path: string) => setDownloadPathState(path);

    // Replay Actions
    const loadReplayRepos = useCallback(async () => {
        try {
            const data = await API.getReplayRepos();
            setReplayRepos(data);

            // If we have a selected repo but its not in data (deleted?), unselect
            if (selectedRepoId) {
                if (!data.some(r => r.id === selectedRepoId)) {
                    setSelectedRepoId(null);
                    API.saveLastRepo(null);
                } else {
                    // Reload commits just in case
                    loadCommitsForRepo(selectedRepoId);
                }
            } else {
                // Check if we have a saved ID from DB (via state)
                try {
                    const { repo_id } = await API.getLastRepo();
                    if (repo_id && data.some(r => r.id === repo_id)) {
                        setSelectedRepoId(repo_id);
                        loadCommitsForRepo(repo_id);
                    } else if (data.length > 0) {
                        // Auto-select first? Maybe optional.
                        // For now let's NOT auto-select first to be clean unless user picks one.
                    }
                } catch { }
            }
        } catch (e) {
            console.error("Failed to load repos", e);
        }
    }, [selectedRepoId]); // Added dep

    const loadCommitsForRepo = async (repoId: number) => {
        setCommitsLoading(true);
        setCommitsPage(1);
        try {
            const data = await API.getStoredRepoCommits(repoId, 1);
            setCommits(data.commits);
            setCommitsHasMore(data.has_more);
            setCommitsTotal(data.total);
            // Auto-select first commit for filetree
            if (data.commits.length > 0) {
                setSelectedCommitHash(data.commits[0].hash);
            }
        } catch (e) {
            console.error(e);
            setCommits([]);
        } finally {
            setCommitsLoading(false);
        }
    };

    const addLocalRepo = async (path: string) => {
        await API.addLocalRepo(path);
        await loadReplayRepos();
    };

    const cloneRepo = async (url: string, dest: string) => {
        await API.cloneRepo(url, dest);
        await loadReplayRepos();
    };

    const deleteReplayRepo = async (id: number) => {
        await API.deleteReplayRepo(id);
        if (selectedRepoId === id) {
            setSelectedRepoId(null);
            await API.saveLastRepo(null);
            setCommits([]);
        }
        await loadReplayRepos();
    };

    const selectRepo = (id: number) => {
        setSelectedRepoId(id);
        API.saveLastRepo(id);
        setSelectedCommitHash(null); // Reset commit selection
        loadCommits(id);
    };

    const selectCommit = (hash: string) => {
        setSelectedCommitHash(hash);
    };

    const loadCommits = async (repoId: number) => {
        await loadCommitsForRepo(repoId);
    };

    const loadMoreCommits = async () => {
        if (!selectedRepoId || !commitsHasMore || commitsLoading) return;
        setCommitsLoading(true);
        const nextPage = commitsPage + 1;
        try {
            const data = await API.getStoredRepoCommits(selectedRepoId, nextPage);
            if (data && Array.isArray(data.commits)) {
                setCommits(prev => [...prev, ...data.commits]);
                setCommitsHasMore(data.has_more);
                setCommitsPage(nextPage);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setCommitsLoading(false);
        }
    };

    const loadServers = useCallback(async () => {
        try {
            const data = await API.getServers();
            if (Array.isArray(data)) {
                setServers(data);
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    const startServer = async (repoId: number, commitHash: string) => {
        setServersLoading(true);
        try {
            await API.startServer(repoId, commitHash);
            await loadServers();
        } finally {
            setServersLoading(false);
        }
    };

    const stopServer = async (serverId: string) => {
        await API.stopServer(serverId);
        await loadServers();
    };

    const syncRepo = async (repoId: number) => {
        await API.syncRepoCommits(repoId);
        await loadCommits(repoId);
    };

    const setDiscoveryState = (query: string, user: API.UserProfile | null, repos: API.Repository[], readme: string | null) => {
        setDiscoverySearchQuery(query);
        setDiscoveryUserData(user);
        setDiscoveryRepos(repos);
        setDiscoveryProfileReadme(readme);
    };

    useEffect(() => {
        // Remove all known theme classes to prevent conflicts
        themes.forEach(t => {
            document.body.classList.remove(`theme-${t.value}`);
        });
        // Add current theme class
        document.body.classList.add(`theme-${theme}`);
    }, [theme]);

    return (
        <AppContext.Provider value={{
            theme, setTheme,
            token, setToken,
            downloadPath, setDownloadPath,

            replayRepos, selectedRepoId, selectedCommitHash,
            commits, commitsLoading, commitsHasMore, commitsTotal, commitsPage,
            servers, serversLoading,

            loadReplayRepos, addLocalRepo, cloneRepo, deleteReplayRepo,
            selectRepo, selectCommit, loadCommits, loadMoreCommits,
            loadServers, startServer, stopServer, syncRepo,

            discoverySearchQuery, discoveryUserData, discoveryRepos, discoveryProfileReadme,
            setDiscoveryState,

            downloadCart, toggleCartItem, clearCart, isDownloading, setIsDownloading, downloadSelectedRepos
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
}
