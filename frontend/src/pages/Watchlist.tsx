/**
 * GitNexus v3.1.0 - Watchlist Page (Asset Watchtower)
 * 
 * Complete redesign with:
 * - Grid/list view toggle
 * - Drag-and-drop reordering
 * - Per-card asset filter
 * - Import/export config
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    Github,
    Download,
    RefreshCw,
    Trash2,
    Smartphone,
    Monitor,
    Box,
    FileCode,
    ShieldCheck,
    ExternalLink,
    LayoutGrid,
    List,
    FileJson,
    Upload,
    History,
    Move,
    Filter,
    Eye,
    EyeOff
} from 'lucide-react';
import {
    getWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    checkUpdates,
    downloadAsset,
    fetchRepoDetails,
    reorderWatchlist
} from '../api/client';
import type { TrackedRepo } from '../api/client';
import type { ReleaseDetails, ReleaseAsset } from '../types';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';

// --- Asset Icon Component ---
function AssetIcon({ type }: { type: string }) {
    const ext = type.toLowerCase();
    if (ext.includes('apk')) return <Smartphone size={16} className="text-emerald-400" />;
    if (ext.includes('exe') || ext.includes('msi')) return <Monitor size={16} className="text-blue-400" />;
    if (ext.includes('dmg') || ext.includes('pkg')) return <Box size={16} className="text-purple-400" />;
    if (ext.includes('deb') || ext.includes('rpm')) return <FileCode size={16} className="text-orange-400" />;
    return <FileCode size={16} className="text-text-muted" />;
}

// --- Main Component ---
export default function Watchlist() {
    const { showToast } = useToast();
    const navigate = useNavigate();

    // State
    const [repos, setRepos] = useState<(TrackedRepo)[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    // Modal State
    const [addRepoUrl, setAddRepoUrl] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [repoToDelete, setRepoToDelete] = useState<{ id: number; name: string } | null>(null);

    // View settings
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showPreReleases, setShowPreReleases] = useState(true);
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
    const [downloadHistory, setDownloadHistory] = useState<Record<number, string>>({});
    const [downloadingAssets, setDownloadingAssets] = useState<Set<string>>(new Set());

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load repos on mount
    useEffect(() => {
        loadRepos();
    }, []);

    const loadRepos = async () => {
        setIsLoading(true);
        try {
            const data = await getWatchlist();
            if (!Array.isArray(data)) {
                showToast('Failed to load watchlist: Invalid data format', 'error');
                setRepos([]);
                return;
            }
            const reposWithReleases = data.map(repo => ({ ...repo, releases: undefined as ReleaseDetails[] | undefined }));
            setRepos(reposWithReleases);

            // Fetch releases in background
            fetchAllReleases(reposWithReleases);
        } catch {
            showToast('Failed to load watchlist', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAllReleases = async (repoList: (TrackedRepo & { release?: ReleaseDetails })[]) => {
        const updates = [...repoList];
        await Promise.allSettled(
            updates.map(async (repo, index) => {
                try {
                    const releases = await fetchRepoDetails(repo.owner, repo.name);
                    if (releases.length > 0) {
                        updates[index] = { ...repo, releases: releases };
                    }
                } catch {
                    // No release found
                }
            })
        );
        setRepos([...updates]);
    };

    // Derived data
    const filteredRepos = repos.filter(repo => {
        const matchesSearch =
            repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            repo.owner.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    }).map(repo => {
        // Filter pre-releases if toggle is off
        if (!showPreReleases && repo.releases) {
            return {
                ...repo,
                releases: repo.releases.filter(r => !r.prerelease)
            };
        }
        return repo;
    });

    // --- Actions ---

    const handleRefreshAll = async () => {
        setIsRefreshing(true);
        try {
            await checkUpdates();
            await loadRepos();
            showToast('All repositories synchronized', 'success');
        } catch {
            showToast('Failed to refresh', 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleDelete = (id: number, name: string) => {
        setRepoToDelete({ id, name });
    };

    const confirmDelete = async () => {
        if (!repoToDelete) return;

        try {
            await removeFromWatchlist(repoToDelete.id);
            setRepos(repos.filter(r => r.id !== repoToDelete.id));
            showToast('Repository removed from Watchtower', 'neutral');
        } catch {
            showToast('Failed to remove repository', 'error');
        } finally {
            setRepoToDelete(null);
        }
    };

    const handleAddRepo = async () => {
        if (!addRepoUrl.trim()) return;

        try {
            // The API expects a URL string
            await addToWatchlist(addRepoUrl.trim());
            showToast('Repository added successfully', 'success');
            setShowAddModal(false);
            setAddRepoUrl('');
            loadRepos();
        } catch {
            showToast('Failed to add repository', 'error');
        }
    };

    const handleDownloadAsset = async (repoId: number, asset: ReleaseAsset, repoName: string) => {
        const assetKey = `${repoId}-${asset.name}`;
        setDownloadingAssets(prev => new Set(prev).add(assetKey));

        let filename = asset.name;
        if (filename.includes('Source Code (zip)') && !filename.endsWith('.zip')) {
            filename += '.zip';
        } else if (filename.includes('Source Code (tar)') && !filename.endsWith('.tar.gz')) {
            filename += '.tar.gz';
        }

        try {
            await downloadAsset(asset.download_url, filename, repoName);
            setDownloadHistory(prev => ({ ...prev, [repoId]: asset.name }));
            showToast(`Downloaded: ${asset.name}`, 'success');
        } catch {
            showToast(`Download failed: ${asset.name}`, 'error');
        } finally {
            setDownloadingAssets(prev => {
                const next = new Set(prev);
                next.delete(assetKey);
                return next;
            });
        }
    };

    // --- Drag and Drop ---
    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const onDragEnter = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === index) return;

        const newRepos = [...repos];
        const draggedItem = newRepos[draggedItemIndex];
        newRepos.splice(draggedItemIndex, 1);
        newRepos.splice(index, 0, draggedItem);

        setRepos(newRepos);
        setDraggedItemIndex(index);
    };

    const onDragEnd = async () => {
        if (draggedItemIndex !== null) {
            setDraggedItemIndex(null);

            // Persist new order
            const ids = repos.map(r => r.id);
            try {
                await reorderWatchlist(ids);
            } catch {
                showToast('Failed to save new order', 'error');
            }
        }
    };

    // --- Import/Export ---
    const handleExportConfig = () => {
        const config = JSON.stringify(repos.map(r => ({ owner: r.owner, name: r.name })), null, 2);
        const blob = new Blob([config], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `watchtower-config-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Configuration exported', 'success');
    };

    const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event: ProgressEvent<FileReader>) => {
            try {
                const importedRepos = JSON.parse(event.target?.result as string);
                if (Array.isArray(importedRepos)) {
                    for (const repo of importedRepos) {
                        if (repo.owner && repo.name) {
                            await addToWatchlist(`https://github.com/${repo.owner}/${repo.name}`);
                        }
                    }
                    await loadRepos();
                    showToast('Configuration imported successfully', 'success');
                } else {
                    showToast('Invalid configuration file', 'error');
                }
            } catch {
                showToast('Failed to parse JSON', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // --- Repo Card Component ---
    function RepoCard({ repo, index }: { repo: TrackedRepo, index: number }) {
        const [isExpanded, setIsExpanded] = useState(false);
        const [assetFilter, setAssetFilter] = useState('');

        const latestRelease = repo.releases?.[0];
        const hasUpdate = repo.current_version !== repo.latest_version && repo.latest_version !== null;

        // Ensure we don't crash if no releases
        const assets = latestRelease?.assets || [];
        const displayAssets = assets.filter((a: ReleaseAsset) =>
            a.name.toLowerCase().includes(assetFilter.toLowerCase())
        );

        return (
            <div
                draggable
                onDragStart={(e) => onDragStart(e, index)}
                onDragEnter={(e) => onDragEnter(e, index)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={`${draggedItemIndex === index ? 'opacity-40' : 'opacity-100'}`}
            >
                <div
                    onClick={() => navigate(`/watchlist/${repo.id}`)}
                    className={`bg-app-surface border border-app-border rounded-xl overflow-hidden hover:border-text-muted/20 transition-all group shadow-sm hover:shadow-xl hover:shadow-black/20 relative cursor-pointer ${viewMode === 'list' ? 'flex flex-col md:flex-row' : 'flex-col'
                        }`}>

                    {/* Drag Handle */}
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 left-1/2 -translate-x-1/2 md:left-3 md:translate-x-0 cursor-move text-text-muted hover:text-text-main z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Move size={14} />
                    </div>

                    {/* Card Header / Main Info */}
                    <div className={`p-5 flex-1 ${viewMode === 'list' ? 'md:border-r md:border-slate-800 md:max-w-md' : ''}`}>
                        <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                                <img
                                    src={repo.avatar_url || `https://github.com/${repo.owner}.png`}
                                    alt={repo.name}
                                    className="w-12 h-12 rounded-lg bg-app-surface object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png' }}
                                />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-text-main group-hover:text-brand-primary transition-colors">
                                            {repo.name}
                                        </h3>
                                        {hasUpdate && (
                                            <span className="flex h-2 w-2 rounded-full bg-brand-primary" title="Update Available"></span>
                                        )}
                                    </div>
                                    <p className="text-text-muted text-sm">by {repo.owner}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <a
                                    href={repo.html_url || `https://github.com/${repo.owner}/${repo.name}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 text-text-muted hover:text-white transition-colors rounded-lg hover:bg-app-surface-accent"
                                >
                                    <ExternalLink size={18} />
                                </a>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(repo.id, repo.name); }}
                                    className="p-2 text-text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-app-surface-accent"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <p className="text-text-muted text-sm mt-3 line-clamp-2 min-h-[2.5rem]">
                            {repo.description || 'No description'}
                        </p>

                        {/* Version Info */}
                        <div className="mt-4 flex items-center gap-6 text-sm">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">Current</span>
                                <span className="font-mono text-text-main">{repo.current_version || 'Unknown'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">Latest</span>
                                <span className={`font-mono font-medium ${hasUpdate ? 'text-brand-primary' : 'text-brand-secondary'}`}>
                                    {repo.latest_version || 'Not Checked'}
                                </span>
                            </div>
                        </div>

                        {/* History Button Removed */}
                    </div>

                    {/* Assets Section */}
                    <div className={`bg-app-bg p-4 flex-1 ${viewMode === 'list' ? 'flex flex-col justify-center' : ''}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                                Assets
                                {/* Inline Asset Filter */}
                                <div className="relative group/filter ml-2">
                                    <Filter size={12} className={`cursor-pointer ${assetFilter ? 'text-brand-primary' : 'text-text-muted'}`} />
                                    <input
                                        type="text"
                                        placeholder="Filter (.apk, .exe)..."
                                        value={assetFilter}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setAssetFilter(e.target.value)}
                                        className="absolute left-0 -top-1 ml-5 w-24 bg-app-bg border border-app-border text-xs text-text-main rounded px-2 py-1 opacity-0 group-hover/filter:opacity-100 focus:opacity-100 transition-opacity outline-none focus:border-brand-primary"
                                        autoComplete="off"
                                        data-form-type="other"
                                    />
                                </div>
                            </span>
                            <span className="text-xs text-text-muted bg-app-surface px-2 py-1 rounded border border-app-border">
                                {displayAssets.length} Files
                            </span>
                        </div>

                        <div className="space-y-2">
                            {displayAssets.length === 0 ? (
                                <div className="text-xs text-text-muted italic text-center py-2">
                                    {assets.length === 0 ? 'No release assets' : 'No assets match filter'}
                                </div>
                            ) : (
                                displayAssets.slice(0, (isExpanded || viewMode === 'list') ? undefined : 2).map((asset: ReleaseAsset) => {
                                    const isDownloaded = downloadHistory[repo.id] === asset.name;
                                    const isDownloading = downloadingAssets.has(`${repo.id}-${asset.name}`);

                                    return (
                                        <div
                                            key={asset.id}
                                            className={`group/asset flex items-center justify-between p-2.5 rounded-lg border bg-app-surface transition-all ${isDownloaded ? 'border-brand-secondary/30 bg-brand-secondary/10' : 'border-app-border hover:border-brand-primary/30 hover:bg-app-surface-accent'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="min-w-[32px] h-8 rounded bg-app-bg flex items-center justify-center border border-app-border relative">
                                                    <AssetIcon type={asset.name} />
                                                    {isDownloaded && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-secondary rounded-full border border-app-bg"></div>}
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className={`text-sm truncate font-medium group-hover/asset:text-white ${isDownloaded ? 'text-brand-secondary' : 'text-text-main'}`}>
                                                        {asset.name}
                                                    </span>
                                                    <span className="text-xs text-text-muted flex gap-2">
                                                        {(asset.size / 1024 / 1024).toFixed(1)} MB
                                                        {isDownloaded && <span className="text-brand-secondary ml-1 flex items-center gap-0.5"><History size={10} /> Downloaded</span>}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDownloadAsset(repo.id, asset, repo.name); }}
                                                disabled={isDownloading}
                                                className="p-2 text-brand-primary hover:text-white hover:bg-brand-primary rounded-md transition-colors disabled:opacity-50"
                                            >
                                                {isDownloading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                                            </button>
                                        </div>
                                    );
                                })
                            )}

                            {displayAssets.length > 2 && viewMode === 'grid' && (
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="w-full py-2 text-xs text-text-muted hover:text-text-main font-medium flex items-center justify-center gap-1 transition-colors border-t border-dashed border-app-border mt-2"
                                >
                                    {isExpanded ? 'Show Less' : `Show ${displayAssets.length - 2} More Assets`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- Render ---
    return (
        <div className="min-h-screen bg-app-bg text-text-main font-sans selection:bg-brand-primary/30">

            {/* Header / Navbar */}
            <header className="sticky top-0 z-30 bg-app-surface backdrop-blur-md border-b border-app-border">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center shadow-lg shadow-brand-primary/20">
                            <ShieldCheck className="text-white" size={20} />
                        </div>
                        <h1 className="text-lg font-bold tracking-tight text-white hidden sm:block">Watchtower</h1>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* View Toggles */}
                        <div className="flex items-center bg-app-surface-accent rounded-lg p-1 border border-app-border">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-brand-primary text-white shadow' : 'text-text-muted hover:text-text-main'}`}
                                title="Grid View"
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-brand-primary text-white shadow' : 'text-text-muted hover:text-text-main'}`}
                                title="List View"
                            >
                                <List size={16} />
                            </button>
                        </div>

                        <div className="h-4 w-px bg-app-border hidden sm:block"></div>

                        {/* Config Actions */}
                        <button
                            onClick={() => setShowPreReleases(!showPreReleases)}
                            className={`p-2 transition-colors rounded-lg border border-transparent ${showPreReleases ? 'text-brand-primary bg-brand-primary/10 border-brand-primary/20' : 'text-text-muted hover:text-white'}`}
                            title={showPreReleases ? "Hide Pre-releases" : "Show Pre-releases"}
                        >
                            {showPreReleases ? <Eye size={20} /> : <EyeOff size={20} />}
                        </button>

                        <button
                            onClick={handleExportConfig}
                            className="p-2 text-text-muted hover:text-white transition-colors"
                            title="Export Config"
                        >
                            <FileJson size={20} />
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-text-muted hover:text-white transition-colors"
                            title="Import Config"
                        >
                            <Upload size={20} />
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImportConfig}
                                accept=".json"
                                className="hidden"
                            />
                        </button>

                        <div className="h-4 w-px bg-app-border hidden sm:block"></div>

                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-brand-primary hover:bg-brand-primary/90 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-brand-primary/20 active:scale-95"
                        >
                            <Plus size={16} />
                            <span className="hidden sm:inline">Add Repo</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

                {/* Stats & Controls */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-semibold text-text-main">Your Assets</h2>
                        <p className="text-text-muted text-sm">Tracking {filteredRepos.length} repositories.</p>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                            <input
                                type="text"
                                placeholder="Filter repositories..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-app-surface border border-app-border text-text-main text-sm rounded-lg pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none transition-all"
                                autoComplete="off"
                                data-form-type="other"
                            />
                        </div>
                        <button
                            onClick={handleRefreshAll}
                            className={`px-3 py-2 bg-app-surface border border-app-border rounded-lg text-text-muted hover:text-white hover:border-app-border/80 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>

                {/* Repository Grid/List */}
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <RefreshCw size={32} className="animate-spin text-indigo-400" />
                    </div>
                ) : (
                    <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                        {filteredRepos.length === 0 ? (
                            <div className="col-span-full py-12 flex flex-col items-center justify-center text-text-muted border border-dashed border-app-border rounded-xl bg-app-surface">
                                <Search size={48} className="mb-4 opacity-50" />
                                <p className="text-lg">No repositories found matching your filter.</p>
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="mt-4 text-brand-primary hover:text-brand-primary/80 text-sm font-medium"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        ) : (
                            filteredRepos.map((repo, index) => (
                                <RepoCard key={repo.id} repo={repo} index={index} />
                            ))
                        )}
                    </div>
                )}
            </main>

            {/* Add Repo Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="Add Repository"
                footer={(
                    <>
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddRepo}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-900/20"
                        >
                            Track Asset
                        </button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-1.5">GitHub URL</label>
                        <div className="relative">
                            <Github className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                            <input
                                type="text"
                                placeholder="https://github.com/owner/repo"
                                value={addRepoUrl}
                                onChange={(e) => setAddRepoUrl(e.target.value)}
                                className="w-full bg-app-bg border border-app-border text-text-main rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddRepo();
                                }}
                                autoComplete="off"
                                data-form-type="other"
                            />
                        </div>
                        <p className="text-xs text-text-muted mt-2">
                            Paste the full GitHub URL. We'll fetch the latest releases automatically.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!repoToDelete}
                onClose={() => setRepoToDelete(null)}
                title="Stop Tracking?"
                footer={(
                    <>
                        <button
                            onClick={() => setRepoToDelete(null)}
                            className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-red-900/20 flex items-center gap-2"
                        >
                            <Trash2 size={16} />
                            Remove
                        </button>
                    </>
                )}
            >
                <div className="text-text-main">
                    <p>Are you sure you want to remove <span className="font-semibold text-white">{repoToDelete?.name}</span> from the watchtower?</p>
                    <p className="text-sm text-text-muted mt-2">
                        You will no longer receive notifications about new releases for this repository.
                    </p>
                </div>
            </Modal>



        </div >
    );
}


