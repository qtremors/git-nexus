import { RefreshCw, Square, Loader2, ExternalLink, Play, Power, X, FileText } from 'lucide-react';
import type { Server as ServerType, ReplayRepo } from '../../api/client';
import { removeServer } from '../../api/client';
import { useToast } from '../ui/Toast';
import { useState } from 'react';

// --- Helper for formatting URL ---
function formatUrl(url: string) {
    return url.replace('http://', '').replace('https://', '').replace(/\/$/, '');
}

interface ActiveServersProps {
    servers: ServerType[];
    repos: ReplayRepo[];
    loadingServerHashes: Set<string>;
    onRefresh: () => void;
    onStartServer: (commitHash: string) => void;
    onStopServer: (serverId: string, commitHash: string) => void;
    onOpenLogs: () => void;
}

export function ActiveServers({ servers, repos, loadingServerHashes, onRefresh, onStartServer, onStopServer, onOpenLogs }: ActiveServersProps) {
    const { showToast } = useToast();
    const [removing, setRemoving] = useState<string | null>(null);

    // Filter nothing! Show all servers including stopped ones
    const displayedServers = servers;
    const activeCount = servers.filter(s => s.status === 'running' || s.status === 'starting').length;

    const handleRemove = async (serverId: string) => {
        setRemoving(serverId);
        try {
            await removeServer(serverId);
            onRefresh();
            showToast('Server removed', 'neutral');
        } catch {
            showToast('Failed to remove server', 'error');
        } finally {
            setRemoving(null);
        }
    };

    return (
        <div className={`border-b border-slate-800 bg-[#0d1117] flex flex-col flex-shrink-0 w-full h-full overflow-hidden`}>
            {/* Header */}
            <div className="h-10 flex items-center justify-between px-6 border-b border-slate-800 bg-[#161b22]/50 flex-shrink-0">
                <h2 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
                    <Power size={16} className="text-blue-400" />
                    Active Servers
                    <span className="bg-slate-800 text-slate-300 text-xs py-0.5 px-2 rounded-full border border-slate-700">
                        {activeCount}
                    </span>
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpenLogs}
                        className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800"
                    >
                        <FileText size={12} /> Logs
                    </button>
                    <button
                        onClick={onRefresh}
                        className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800"
                    >
                        <RefreshCw size={12} /> Refresh
                    </button>
                </div>
            </div>

            {/* List Area */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0 flex flex-col">
                {displayedServers.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-lg gap-1 min-h-[120px]">
                        <Power size={24} className="opacity-50" />
                        <span className="text-sm">No active servers</span>
                        <span className="text-xs text-slate-600 px-4 text-center">Deploy a commit to start a server</span>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {displayedServers.map((server) => {
                            const repo = repos.find(r => r.id === server.repo_id);
                            const isLoading = loadingServerHashes.has(server.commit_hash);
                            const isRemoving = removing === server.id;
                            const isRunning = server.status === 'running' || server.status === 'starting';

                            return (
                                <div
                                    key={server.id}
                                    className="grid grid-rows-2 grid-cols-[100px_1fr] gap-2 p-2 bg-[#161b22] border border-slate-700/50 rounded-xl min-w-[320px] shadow-sm hover:border-slate-600 transition-colors"
                                >
                                    {/* 1. Top-Left: Commit Hash (Swapped) */}
                                    <div className="row-span-1 col-span-1 bg-[#0d1117]/50 rounded-lg border border-slate-800 flex items-center justify-center">
                                        <span className="font-mono text-xs text-blue-400 font-bold">
                                            {server.short_hash}
                                        </span>
                                    </div>

                                    {/* 2. Top-Right: Repo Name */}
                                    <div className="row-span-1 col-span-1 bg-[#0d1117]/50 rounded-lg border border-slate-800 flex items-center px-3">
                                        <span className="text-sm font-medium text-slate-200 truncate" title={repo?.name}>
                                            {repo?.name || 'Unknown Repo'}
                                        </span>
                                    </div>

                                    {/* 3. Bottom-Left: Start/Stop Button (Swapped) */}
                                    <div className="row-span-1 col-span-1">
                                        <button
                                            onClick={() => isRunning
                                                ? onStopServer(server.id, server.commit_hash)
                                                : onStartServer(server.commit_hash)
                                            }
                                            disabled={isLoading}
                                            className={`w-full h-full rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition-all
                                                ${isRunning
                                                    ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                } disabled:opacity-50`}
                                        >
                                            {isLoading ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : isRunning ? (
                                                <><Square size={14} className="fill-current" /> Stop</>
                                            ) : (
                                                <><Play size={14} className="fill-current" /> Start</>
                                            )}
                                        </button>
                                    </div>

                                    {/* 4. Bottom-Right: URL + Delete */}
                                    <div className="row-span-1 col-span-1 bg-[#0d1117]/50 rounded-lg border border-slate-800 flex items-center justify-between pl-3 pr-1.5">
                                        <div className="min-w-0 flex-1">
                                            {isRunning ? (
                                                <a
                                                    href={server.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 truncate transition-colors"
                                                    title={server.url}
                                                >
                                                    <ExternalLink size={10} />
                                                    {formatUrl(server.url)}
                                                </a>
                                            ) : server.status === 'failed' ? (
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs text-red-400 font-medium">Failed</span>
                                                    {server.error && (
                                                        <span className="text-[10px] text-red-500/80 truncate block max-w-[120px]" title={server.error}>
                                                            Check logs for error
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-600 italic">
                                                    {server.status}
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleRemove(server.id)}
                                            disabled={isRemoving || isRunning}
                                            className="p-1.5 ml-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-md transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                            title="Delete Server from List"
                                        >
                                            {isRemoving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
