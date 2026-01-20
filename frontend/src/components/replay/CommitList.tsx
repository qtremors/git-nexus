/**
 * CommitList Component
 * 
 * Displays commits for selected repository with numbering and selection.
 */

import { useApp } from '../../store';
import type { Server } from '../../api/client';
import './CommitList.css';

export function CommitList() {
    const {
        selectedRepoId,
        selectedCommitHash,
        replayRepos,
        commits,
        commitsLoading,
        commitsHasMore,
        commitsTotal,
        loadMoreCommits,
        servers,
        startServer,
        stopServer,
        serversLoading,
        selectCommit,
        loadServers
    } = useApp();

    // Get server for a commit
    const getServerForCommit = (commitHash: string): Server | undefined => {
        return servers.find(
            (s) => s.commit_hash === commitHash || s.short_hash === commitHash.slice(0, 7)
        );
    };

    const handleStart = async (e: React.MouseEvent, commitHash: string) => {
        e.stopPropagation();
        if (!selectedRepoId) return;
        await startServer(selectedRepoId, commitHash);
    };

    const handleStop = async (e: React.MouseEvent, serverId: string) => {
        e.stopPropagation();
        await stopServer(serverId);
        // Force refresh after a brief delay to get updated status
        setTimeout(() => loadServers(), 300);
    };

    const handleOpen = (e: React.MouseEvent, url: string) => {
        e.stopPropagation();
        window.open(url, '_blank');
    };

    const handleCommitClick = (hash: string) => {
        selectCommit(hash);
    };

    if (!selectedRepoId) {
        return (
            <div className="commit-list card">
                <h2 className="commit-list__title">Commits</h2>
                <div className="commit-list__empty">
                    Select a repository to view commits
                </div>
            </div>
        );
    }

    const selectedRepo = replayRepos.find((r) => r.id === selectedRepoId);

    // Commit numbering: total - index (so first loaded = highest number)
    // The commits array has all loaded commits in order (newest first)
    const getCommitNumber = (index: number): number => {
        return commitsTotal - index;
    };

    return (
        <div className="commit-list card">
            <h2 className="commit-list__title">
                Commits — {selectedRepo?.name}
            </h2>

            {commitsLoading && commits.length === 0 && (
                <div className="commit-list__empty">Loading commits...</div>
            )}

            {!commitsLoading && commits.length === 0 && (
                <div className="commit-list__empty">No commits found.</div>
            )}

            <div className="commit-list__items">
                {commits.map((commit, index) => {
                    const server = getServerForCommit(commit.hash);
                    const isRunning = server?.status === 'running';
                    const isSelected = selectedCommitHash === commit.hash;
                    const commitNumber = getCommitNumber(index);

                    return (
                        <div
                            key={commit.hash}
                            className={`commit-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleCommitClick(commit.hash)}
                        >
                            <div className="commit-item__number">
                                #{commitNumber}
                            </div>
                            <div className="commit-item__info">
                                <div className="commit-item__header">
                                    <code className="commit-item__hash">{commit.short_hash}</code>
                                    {server && (
                                        <span className={`replay-badge badge-${server.status === 'running' ? 'success' : server.status === 'failed' ? 'danger' : 'warning'}`}>
                                            {server.status}
                                        </span>
                                    )}
                                </div>
                                <div className="commit-item__message">{commit.message}</div>
                                <div className="commit-item__meta">
                                    {commit.author} • {new Date(commit.date).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="commit-item__actions">
                                {isRunning && server ? (
                                    <>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={(e) => handleOpen(e, server.url)}
                                        >
                                            Open
                                        </button>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={(e) => handleStop(e, server.id)}
                                        >
                                            Stop
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={(e) => handleStart(e, commit.hash)}
                                        disabled={serversLoading}
                                    >
                                        Start
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Load More button */}
            {commitsHasMore && (
                <div className="commit-list__load-more">
                    <button
                        className="commit-list__load-btn"
                        onClick={loadMoreCommits}
                        disabled={commitsLoading}
                    >
                        {commitsLoading ? (
                            <span className="loader-small" />
                        ) : (
                            <>
                                <span className="material-symbols-outlined">expand_more</span>
                                Load More
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Commit count */}
            {commits.length > 0 && (
                <div className="commit-list__count">
                    Showing {commits.length} of ~{commitsTotal} commits
                </div>
            )}
        </div>
    );
}
