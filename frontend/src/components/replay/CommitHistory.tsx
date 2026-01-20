import { useState } from 'react';
import {
    GitCommit,
    Search,
    Loader2,
    Hash,
    Square,
    Play,
    ExternalLink,
    Box,
    Variable
} from 'lucide-react';
import type { Commit, Server as ServerType } from '../../api/client';

interface CommitHistoryProps {
    repoName?: string;
    commits: Commit[];
    loading: boolean;
    hasMore: boolean;
    total: number;
    selectedCommitHash: string | null;
    loadingServerHashes: Set<string>;
    servers: ServerType[];
    onLoadMore: () => void;
    onSelectCommit: (commit: Commit) => void;
    onStartServer: (hash: string) => void;
    onStopServer: (serverId: string, hash: string) => void;
    onAuthorClick?: (author: string) => void;
    // Env Props
    selectedRepoId?: number | null;
    onManageProjectEnv?: () => void;
    onManageEnv?: (commitHash: string) => void;
}

export function CommitHistory({
    repoName,
    commits,
    loading,
    hasMore,
    total,
    selectedCommitHash,
    loadingServerHashes,
    servers,
    onLoadMore,
    onSelectCommit,
    onStartServer,
    onStopServer,
    onAuthorClick,
    selectedRepoId,
    onManageProjectEnv,
    onManageEnv
}: CommitHistoryProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCommits = commits.filter(c =>
        c.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.hash.includes(searchTerm) ||
        c.short_hash.includes(searchTerm)
    );

    const getServerForCommit = (commitHash: string) => {
        return servers.find(s => s.commit_hash === commitHash && (s.status === 'running' || s.status === 'starting'));
    };

    return (
        <div className="flex-1 flex flex-col bg-[#0d1117] min-h-0 h-full">
            <div className="h-12 border-b border-slate-800 flex items-center justify-between px-6 bg-[#161b22]/50 flex-shrink-0">
                <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                    <GitCommit size={18} className="text-purple-400" />
                    Commits
                    <span className="text-blue-400">{repoName || 'Select a repo'}</span>
                    {total > 0 && (
                        <span className="bg-slate-800 text-slate-300 text-xs py-0.5 px-2 rounded-full border border-slate-700">
                            {total} total
                        </span>
                    )}
                    {selectedRepoId && (
                        <button
                            onClick={onManageProjectEnv}
                            className="ml-2 p-1 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-800 transition-all flex items-center gap-1"
                            title="Manage Project Environment Variables"
                        >
                            <Box size={14} />
                            <span className="text-[10px] uppercase font-bold tracking-wider">Env</span>
                        </button>
                    )}
                </h2>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search commits..."
                        className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500 w-56 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {!repoName ? (
                    <div className="text-center py-12 text-slate-500">
                        Select a worktree to view commits
                    </div>
                ) : loading && commits.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin" /> Loading commits...
                    </div>
                ) : filteredCommits.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        No commits found {searchTerm && `matching "${searchTerm}"`}
                    </div>
                ) : (
                    <>
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#161b22] sticky top-0 z-10">
                                <tr>
                                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[60px]">#</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[100px]">Commit</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Message</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[150px]">Author</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[100px]">Date</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[180px] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredCommits.map((commit: Commit) => {
                                    const server = getServerForCommit(commit.hash);
                                    const isSelected = selectedCommitHash === commit.hash;
                                    const isLoading = loadingServerHashes.has(commit.hash);

                                    return (
                                        <tr
                                            key={commit.hash}
                                            onClick={() => onSelectCommit(commit)}
                                            className={`cursor-pointer group transition-colors border-l-2 ${server
                                                ? 'bg-emerald-600/10 border-l-emerald-500'
                                                : isSelected
                                                    ? 'bg-blue-600/10 border-l-blue-500'
                                                    : 'hover:bg-slate-800/50 border-l-transparent'
                                                }`}
                                        >
                                            <td className="py-3 px-4 text-sm text-slate-500 font-mono">
                                                <span className="flex items-center gap-1">
                                                    <Hash size={12} className="text-slate-600" />
                                                    {commit.commit_number}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 font-mono text-sm text-blue-400">
                                                <span className="flex items-center gap-1.5">
                                                    <GitCommit size={14} className="text-slate-600" />
                                                    {commit.short_hash}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-300 font-medium max-w-0 truncate">
                                                {commit.message.split('\n')[0]}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-400">
                                                <div
                                                    className="flex items-center gap-2 hover:text-blue-400 cursor-pointer transition-colors w-fit"
                                                    title={`Search for ${commit.author}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAuthorClick?.(commit.author);
                                                    }}
                                                >
                                                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0">
                                                        {commit.author.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="truncate">{commit.author}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-500">
                                                {new Date(commit.date).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                    {/* Button 1: Start/Stop toggle */}
                                                    {server ? (
                                                        <button
                                                            onClick={() => onStopServer(server.id, commit.hash)}
                                                            disabled={isLoading}
                                                            className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-medium rounded flex items-center gap-1.5 disabled:opacity-50"
                                                        >
                                                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
                                                            Stop
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => onStartServer(commit.hash)}
                                                            disabled={isLoading}
                                                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-xs font-medium rounded flex items-center gap-1.5 disabled:opacity-50"
                                                        >
                                                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} className="fill-current" />}
                                                            Start
                                                        </button>
                                                    )}

                                                    {/* Button 2: Open (only when running) */}
                                                    {server && server.status === 'running' && (
                                                        <a
                                                            href={server.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded flex items-center gap-1.5"
                                                        >
                                                            <ExternalLink size={12} /> Open
                                                        </a>
                                                    )}

                                                    {/* Env Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onManageEnv?.(commit.hash);
                                                        }}
                                                        className="p-1.5 text-slate-500 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors"
                                                        title="Commit Environment Variables"
                                                    >
                                                        <Variable size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Load More Button */}
                        {hasMore && (
                            <div className="p-4 text-center border-t border-slate-800">
                                <button
                                    onClick={onLoadMore}
                                    disabled={loading}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
                                >
                                    {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                                    Load More Commits
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
