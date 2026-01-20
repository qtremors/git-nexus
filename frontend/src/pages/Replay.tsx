/**
 * GitNexus v3.1.0 - Replay Page (Worktree Manager)
 * 
 * Enhanced features:
 * - File tree from selected repo/commit (collapsed by default)
 * - Commit list with correct numbering (oldest = #1, newest = highest)
 * - Server controls: Start/Stop toggle + Open button
 * - Real-time status polling (3s)
 */

import { useState, useEffect } from 'react';
import { Layout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { useToast } from '../components/ui/Toast';
import { getFileTree, getSystemLogs, getFileContent } from '../api/client';
import type { FileTreeNode } from '../api/client';

import { WorktreeList } from '../components/replay/WorktreeList';
import { FileExplorer } from '../components/replay/FileExplorer';
import { ActiveServers } from '../components/replay/ActiveServers';
import { CommitHistory } from '../components/replay/CommitHistory';
import { AddRepoModal, DeleteRepoModal } from '../components/replay/ReplayModals';
import { EnvManager } from '../components/replay/EnvManager';
import { ResizableSplit } from '../components/ui/ResizableSplit';
import { Modal } from '../components/ui/Modal';
import { SimpleMarkdown } from '../components/ui/SimpleMarkdown';

interface LogEntry {
    id: string;
    timestamp: Date;
    type: 'info' | 'error' | 'success';
    message: string;
    details?: string;
    source?: 'frontend' | 'backend';
}

// --- Main Component ---
export default function Replay() {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const {
        replayRepos,
        selectedRepoId,
        selectedCommitHash,
        selectRepo,
        selectCommit,
        commits,
        commitsLoading,
        commitsHasMore,
        commitsTotal,
        servers,
        loadReplayRepos,
        loadCommits,
        loadMoreCommits,
        loadServers,
        startServer,
        stopServer,
        addLocalRepo,
        deleteReplayRepo,
        syncRepo,
        setDiscoveryState
    } = useApp();

    const [showAddModal, setShowAddModal] = useState(false);
    const [loadingServers, setLoadingServers] = useState<Set<string>>(new Set());
    const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
    const [fileTreeLoading, setFileTreeLoading] = useState(false);
    const [repoToDelete, setRepoToDelete] = useState<{ id: number; name: string } | null>(null);

    // Logs State
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLogsOpen, setIsLogsOpen] = useState(false);

    // Markdown Preview State
    const [markdownPreview, setMarkdownPreview] = useState<{
        isOpen: boolean;
        content: string;
        fileName: string;
        loading: boolean;
    }>({ isOpen: false, content: '', fileName: '', loading: false });

    const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info', details?: string) => {
        setLogs(prev => [{
            id: Math.random().toString(36).substring(7),
            timestamp: new Date(),
            type,
            message,
            details,
            source: 'frontend'
        }, ...prev]);
    };

    const fetchBackendLogs = async () => {
        try {
            const systemLogs = await getSystemLogs(50);
            setLogs(prev => {
                const existingIds = new Set(prev.map(l => l.id));
                const newLogs = systemLogs
                    .filter((l: any) => !existingIds.has(l.id))
                    .map((l: any) => ({
                        id: l.id,
                        timestamp: new Date(l.timestamp),
                        type: l.level.toLowerCase() === 'error' ? 'error' : 'info' as any,
                        message: l.message,
                        details: l.module !== 'gitnexus' ? `Module: ${l.module}` : undefined,
                        source: 'backend' as const
                    }));

                if (newLogs.length === 0) return prev;

                // Merge and sort by timestamp desc
                return [...newLogs, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 500);
            });
        } catch (e) {
            // silent fail
        }
    };

    // Fetch logs when modal opens
    useEffect(() => {
        if (isLogsOpen) {
            fetchBackendLogs();
        }
    }, [isLogsOpen]);

    // State for file tree expansion
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

    // Env Manager State
    const [envModal, setEnvModal] = useState<{
        isOpen: boolean;
        scope: 'project' | 'commit';
        repoId?: number;
        commitHash?: string;
        title?: string;
    }>({ isOpen: false, scope: 'project' });

    // Polling for server status
    useEffect(() => {
        loadReplayRepos();
        loadServers();

        // Poll server status every 3 seconds
        const interval = setInterval(() => {
            loadServers();
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    // Load commits when selected repo changes
    useEffect(() => {
        if (selectedRepoId) {
            loadCommits(selectedRepoId);
            setExpandedPaths(new Set()); // Reset tree when repo changes
        }
    }, [selectedRepoId]);

    // Load file tree when selected commit changes
    useEffect(() => {
        if (selectedRepoId && selectedCommitHash) {
            loadFileTree(selectedRepoId, selectedCommitHash);
            // NOTE: We don't reset expandedPaths here to preserve state across commits if possible
        } else if (selectedRepoId) {
            loadFileTree(selectedRepoId, 'HEAD');
        } else {
            setFileTree([]);
        }
    }, [selectedRepoId, selectedCommitHash]);

    // Derived data
    const activeRepo = replayRepos.find(r => r.id === selectedRepoId);

    // --- Actions ---
    const handleAuthorClick = (authorName: string) => {
        // Navigate to Discovery and search for this author
        setDiscoveryState(authorName, null, [], null);
        navigate('/discovery'); // Use useNavigate for proper React Router navigation
    };

    const loadFileTree = async (repoId: number, commit: string) => {
        setFileTreeLoading(true);
        try {
            const tree = await getFileTree(repoId, commit);
            setFileTree(tree);
        } catch {
            setFileTree([]);
        } finally {
            setFileTreeLoading(false);
        }
    };

    const handleTogglePath = (path: string) => {
        setExpandedPaths(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    const handleFileClick = async (node: FileTreeNode) => {
        if (!selectedRepoId || !node.name.endsWith('.md')) return;

        const commit = selectedCommitHash || 'HEAD';
        setMarkdownPreview({ isOpen: true, content: '', fileName: node.name, loading: true });

        try {
            const result = await getFileContent(selectedRepoId, node.path, commit);
            setMarkdownPreview(prev => ({ ...prev, content: result.content, loading: false }));
        } catch (e: any) {
            setMarkdownPreview(prev => ({ ...prev, content: `Error loading file: ${e.message}`, loading: false }));
        }
    };

    const handleAddRepo = async (path: string) => {
        try {
            await addLocalRepo(path);
            addLog(`Repository added: ${path}`, 'success');
            showToast('Repository added', 'success');
            setShowAddModal(false);
        } catch (e: any) {
            addLog('Failed to add repository', 'error', e.message);
            showToast('Failed to add repository', 'error');
        }
    };

    const handleDeleteRepo = (id: number, name: string) => {
        setRepoToDelete({ id, name });
    };

    const confirmDeleteRepo = async () => {
        if (!repoToDelete) return;

        try {
            await deleteReplayRepo(repoToDelete.id);
            await deleteReplayRepo(repoToDelete.id);
            addLog(`Repository removed: ${repoToDelete.name}`, 'success');
            showToast('Repository removed', 'neutral');
        } catch (e: any) {
            addLog(`Failed to remove repository: ${repoToDelete.name}`, 'error', e.message);
            showToast('Failed to remove repository', 'error');
        } finally {
            setRepoToDelete(null);
        }
    };

    const handleStartServer = async (commitHash: string) => {
        if (!selectedRepoId) return;

        setLoadingServers(prev => new Set(prev).add(commitHash));
        try {
            await startServer(selectedRepoId, commitHash);
            addLog(`Server started for commit ${commitHash.substring(0, 7)}`, 'success');
            showToast('Server started', 'success');
        } catch (e: any) {
            const fullError = e.message || 'Unknown error';
            addLog(`Failed to start server for ${commitHash.substring(0, 7)}`, 'error', fullError);

            let msg = fullError;
            // Sanitize common verbose errors for Toast
            if (msg.includes('No index.html found')) {
                msg = 'No index.html found. RepoReplay supports static HTML sites.';
            } else if (msg.length > 100) {
                msg = 'Server failed to start. Check logs for details.';
            }
            showToast(msg, 'error');
        } finally {
            setLoadingServers(prev => {
                const next = new Set(prev);
                next.delete(commitHash);
                return next;
            });
        }
    };

    const handleStopServer = async (serverId: string, commitHash: string) => {
        setLoadingServers(prev => new Set(prev).add(commitHash));
        try {
            await stopServer(serverId);
            addLog(`Server stopped: ${commitHash.substring(0, 7)}`, 'success');
            showToast('Server stopped', 'neutral');
        } catch (e: any) {
            addLog(`Failed to stop server: ${commitHash.substring(0, 7)}`, 'error', e.message);
            showToast(e.message || 'Failed to stop server', 'error');
        } finally {
            setLoadingServers(prev => {
                const next = new Set(prev);
                next.delete(commitHash);
                return next;
            });
        }
    };

    const handleRefreshAll = async () => {
        showToast('Refreshing data...', 'neutral');
        await Promise.allSettled([
            loadReplayRepos(),
            loadServers(),
            selectedRepoId ? syncRepo(selectedRepoId) : Promise.resolve(),
            (selectedRepoId && selectedCommitHash) ? loadFileTree(selectedRepoId, selectedCommitHash) : Promise.resolve()
        ]);
        addLog('Refreshed all data', 'info');
        showToast('Refreshed', 'success');
    };

    // --- Render ---
    return (
        <div className="flex h-full w-full bg-app-bg text-text-muted overflow-hidden">
            <ResizableSplit
                isVertical={false}
                initialSize={20} // Sidebar width 20%
                minSize={15}
                maxSize={40}
                firstChild={
                    // Left Column (Sidebar)
                    <div className="flex flex-col h-full bg-app-surface border-r border-app-border">

                        <ResizableSplit
                            isVertical={true}
                            initialSize="auto"
                            minSize={15}
                            maxSize={80}
                            gutterSize={6}
                            firstChild={
                                <div className="flex flex-col h-full overflow-hidden">
                                    <div className="h-12 flex-shrink-0 flex items-center justify-between px-4 border-b border-app-border font-medium text-text-main">
                                        <div className="flex items-center gap-2">
                                            <Layout size={18} className="text-brand-primary" />
                                            <span className="tracking-tight">Worktree Manager</span>
                                        </div>
                                    </div>
                                    <div className="overflow-hidden flex flex-col">
                                        <WorktreeList
                                            repos={replayRepos}
                                            selectedRepoId={selectedRepoId}
                                            onSelectRepo={selectRepo}
                                            onAddRepo={() => setShowAddModal(true)}
                                            onDeleteRepo={handleDeleteRepo}
                                        />
                                    </div>
                                </div>
                            }
                            secondChild={
                                <div className="flex flex-col h-full overflow-hidden border-t border-app-border/50">
                                    <FileExplorer
                                        fileTree={fileTree}
                                        loading={fileTreeLoading}
                                        selectedCommitHash={selectedCommitHash}
                                        hasActiveRepo={!!selectedRepoId}
                                        expandedPaths={expandedPaths}
                                        onTogglePath={handleTogglePath}
                                        onFileClick={handleFileClick}
                                    />
                                </div>
                            }
                        />
                    </div>
                }
                secondChild={
                    // Right Column (Main)
                    <div className="flex flex-col h-full min-w-0 bg-app-bg">
                        <ResizableSplit
                            isVertical={true}
                            initialSize="auto" // Fallback
                            minSize={15}
                            maxSize={70}
                            gutterSize={6}
                            firstChild={
                                <div className="flex flex-col overflow-hidden">
                                    <ActiveServers
                                        servers={servers}
                                        repos={replayRepos}
                                        loadingServerHashes={loadingServers}
                                        onRefresh={handleRefreshAll}
                                        onStartServer={handleStartServer}
                                        onStopServer={handleStopServer}
                                        onOpenLogs={() => setIsLogsOpen(true)}
                                    />
                                </div>
                            }
                            secondChild={
                                <div className="h-full flex flex-col overflow-hidden border-t border-app-border/50">
                                    <CommitHistory
                                        repoName={activeRepo?.name}
                                        commits={commits}
                                        loading={commitsLoading}
                                        hasMore={commitsHasMore}
                                        total={commitsTotal}
                                        selectedCommitHash={selectedCommitHash}
                                        loadingServerHashes={loadingServers}
                                        selectedRepoId={selectedRepoId}
                                        servers={servers}
                                        onLoadMore={loadMoreCommits}
                                        onSelectCommit={(c) => selectCommit(c.hash)}
                                        onStartServer={handleStartServer}
                                        onStopServer={handleStopServer}
                                        onAuthorClick={handleAuthorClick}
                                        onManageEnv={(commitHash) => setEnvModal({
                                            isOpen: true,
                                            scope: 'commit',
                                            repoId: selectedRepoId!,
                                            commitHash: commitHash,
                                            title: `Commit Env: ${commitHash.substring(0, 7)}`
                                        })}
                                        onManageProjectEnv={() => selectedRepoId && setEnvModal({
                                            isOpen: true,
                                            scope: 'project',
                                            repoId: selectedRepoId,
                                            title: `Project Env: ${activeRepo?.name}`
                                        })}
                                    />
                                </div>
                            }
                        />
                    </div>
                }
            />

            <EnvManager
                isOpen={envModal.isOpen}
                onClose={() => setEnvModal(prev => ({ ...prev, isOpen: false }))}
                scope={envModal.scope}
                repoId={envModal.repoId}
                commitHash={envModal.commitHash}
                title={envModal.title}
            />

            <AddRepoModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddRepo}
            />

            <DeleteRepoModal
                isOpen={!!repoToDelete}
                repoName={repoToDelete?.name || ''}
                onClose={() => setRepoToDelete(null)}
                onConfirm={confirmDeleteRepo}
            />

            <Modal
                isOpen={isLogsOpen}
                onClose={() => setIsLogsOpen(false)}
                title="Replay Logs"
                width="max-w-3xl"
                footer={
                    <div className="flex gap-2">
                        <button
                            onClick={fetchBackendLogs}
                            className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                        >
                            Refresh
                        </button>
                        <button
                            onClick={() => setLogs([])}
                            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        >
                            Clear Logs
                        </button>
                    </div>
                }
            >
                <div className="h-[60vh] overflow-y-auto font-mono text-sm space-y-2 pr-2">
                    {logs.length === 0 ? (
                        <div className="text-text-muted text-center py-10 italic">No logs recorded yet.</div>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} className="flex gap-3 p-2 rounded hover:bg-app-surface border border-transparent hover:border-app-border transition-colors">
                                <span className="text-text-muted text-xs shrink-0 pt-0.5">
                                    {log.timestamp.toLocaleTimeString()}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className={`flex items-center gap-2 font-medium ${log.type === 'error' ? 'text-red-400' :
                                        log.type === 'success' ? 'text-emerald-400' :
                                            'text-blue-400'
                                        }`}>
                                        <span className={`uppercase text-[10px] tracking-wider border border-current px-1 rounded-[3px] opacity-70 ${log.source === 'backend' ? 'bg-app-surface' : ''
                                            }`}>
                                            {log.source === 'backend' ? 'SYS:' : ''}{log.type}
                                        </span>
                                        <span>{log.message}</span>
                                    </div>
                                    {log.details && (
                                        <pre className="mt-1 text-xs text-text-muted bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                                            {log.details}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Modal>

            {/* Markdown Preview Modal */}
            <Modal
                isOpen={markdownPreview.isOpen}
                onClose={() => setMarkdownPreview(prev => ({ ...prev, isOpen: false }))}
                title={markdownPreview.fileName}
                width="max-w-4xl"
            >
                <div className="h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {markdownPreview.loading ? (
                        <div className="flex items-center justify-center h-full text-text-muted">
                            <span className="animate-pulse">Loading...</span>
                        </div>
                    ) : (
                        <SimpleMarkdown content={markdownPreview.content} />
                    )}
                </div>
            </Modal>
        </div>
    );
}
