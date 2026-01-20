import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Download,
    Github,
    FileCode,
    Smartphone,
    Monitor,
    Box
} from 'lucide-react';
import { getWatchlist, fetchRepoDetails, downloadAsset } from '../api/client';
import { useToast } from '../components/ui/Toast';
import type { TrackedRepo, ReleaseDetails, ReleaseAsset } from '../types';


export default function WatchlistDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [repo, setRepo] = useState<TrackedRepo | null>(null);
    const [releases, setReleases] = useState<ReleaseDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [downloadingAssets, setDownloadingAssets] = useState<Set<string>>(new Set());

    // Load Repo Data
    useEffect(() => {
        if (!id) return;
        loadData(parseInt(id));
    }, [id]);

    const loadData = async (repoId: number) => {
        setIsLoading(true);
        try {
            // 1. Get Repo Metadata (from full list for now, or add explicit endpoint later)
            const allRepos = await getWatchlist();
            const found = allRepos.find(r => r.id === repoId);

            if (!found) {
                showToast('Repository not found', 'error');
                navigate('/watchlist');
                return;
            }
            setRepo(found);

            // 2. Fetch Releases
            try {
                // Fetch up to 30 releases
                const rels = await fetchRepoDetails(found.owner, found.name, 30);
                setReleases(rels);
            } catch (err) {
                console.error("Failed to fetch releases", err);
                showToast('Failed to fetch release history', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to load repository', 'error');
            navigate('/watchlist');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async (asset: ReleaseAsset, repoName: string) => {
        if (!repo) return;
        const assetKey = `${asset.id}-${asset.name}`;
        setDownloadingAssets(prev => new Set(prev).add(assetKey));

        // Fix Filename for Source Code
        let filename = asset.name;
        if (filename.includes('Source Code (zip)') && !filename.endsWith('.zip')) {
            filename += '.zip';
        } else if (filename.includes('Source Code (tar)') && !filename.endsWith('.tar.gz')) {
            filename += '.tar.gz';
        }

        try {
            await downloadAsset(asset.download_url, filename, repoName);
            showToast(`Downloaded: ${asset.name}`, 'success');
        } catch (error) {
            console.error("Download failed", error);
            showToast(`Download failed: ${asset.name}`, 'error');
        } finally {
            setDownloadingAssets(prev => {
                const next = new Set(prev);
                next.delete(assetKey);
                return next;
            });
        }
    };

    if (isLoading && !repo) {
        return <div className="p-8 text-center text-text-muted">Loading repository...</div>;
    }

    if (!repo) return null;

    const hasUpdate = repo.current_version !== repo.latest_version && repo.latest_version !== null;

    return (
        <div className="min-h-screen bg-app-bg text-text-main p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/watchlist')}
                    className="p-2 hover:bg-app-surface rounded-full text-text-muted hover:text-text-main transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        {repo.name}
                        {hasUpdate && (
                            <span className="text-[10px] bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                                Update Available
                            </span>
                        )}
                    </h1>
                    <p className="text-text-muted text-sm">{repo.owner}</p>
                </div>
                <div className="flex gap-2">
                    <a
                        href={repo.html_url || `https://github.com/${repo.owner}/${repo.name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-app-surface border border-app-border rounded-lg text-text-muted hover:text-white hover:border-brand-primary transition-all"
                    >
                        <Github size={20} />
                    </a>
                </div>
            </div>

            {/* Releases List */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold border-b border-app-border pb-2">Release History</h2>

                {releases.length === 0 ? (
                    <div className="text-center py-8 text-text-muted italic bg-app-surface/50 rounded-xl border border-app-border border-dashed">
                        No releases found or failed to load.
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {releases.map((release) => (
                            <div key={release.tag_name} className="bg-app-surface border border-app-border rounded-xl p-5 hover:border-text-muted/30 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold font-mono">{release.tag_name}</h3>
                                            {release.tag_name === repo.latest_version && (
                                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                                                    Latest
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-text-muted">
                                            Published on {new Date(release.published_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <a href={release.html_url} target="_blank" rel="noreferrer" className="text-xs text-brand-primary hover:underline">
                                        Release Notes
                                    </a>
                                </div>

                                {/* Assets Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {release.assets.map((asset, idx) => (
                                        <div
                                            // Combine name + size logic to ensure unique keys roughly
                                            key={`${asset.name}-${idx}`}
                                            className="flex items-center justify-between p-3 bg-app-bg/50 rounded-lg border border-app-border/50 hover:border-brand-primary/50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <AssetIcon type={asset.name} />
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-sm font-medium truncate group-hover:text-brand-primary transition-colors" title={asset.name}>
                                                        {asset.name}
                                                    </span>
                                                    <span className="text-[10px] text-text-muted">
                                                        {(asset.size / 1024 / 1024).toFixed(2)} MB
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDownload(asset, repo.name)}
                                                disabled={downloadingAssets.has(`${asset.id}-${asset.name}`)}
                                                className={`p-2 rounded-lg transition-colors ${downloadingAssets.has(`${asset.id}-${asset.name}`)
                                                    ? 'bg-app-surface text-text-muted cursor-wait'
                                                    : 'hover:bg-brand-primary hover:text-white text-text-muted'
                                                    }`}
                                            >
                                                <Download size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {release.assets.length === 0 && (
                                    <p className="text-sm text-text-muted italic">No assets found.</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function AssetIcon({ type }: { type: string }) {
    const ext = type.toLowerCase();
    if (ext.includes('apk')) return <Smartphone size={18} className="text-emerald-400" />;
    if (ext.includes('exe') || ext.includes('msi')) return <Monitor size={18} className="text-blue-400" />;
    if (ext.includes('dmg') || ext.includes('pkg')) return <Box size={18} className="text-purple-400" />;
    if (ext.includes('deb') || ext.includes('rpm')) return <FileCode size={18} className="text-orange-400" />;
    if (ext.includes('zip') || ext.includes('tar')) return <FileCode size={18} className="text-yellow-400" />;
    return <FileCode size={18} className="text-text-muted" />;
}
