/**
 * GitNexus v3.1.0 - Settings Page
 * 
 * Modern settings configuration with tokens and preferences.
 */

import { useState, useEffect } from 'react';
import {
    Key,
    FolderOpen,
    Info,
    Save,
    ExternalLink,
    RefreshCw,
    Activity,
    Clock,
    Trash2,
    FileText,
    Database,
    ChevronUp
} from 'lucide-react';
import {
    getToken,
    saveToken,
    getDownloadPath,
    saveDownloadPath,
    getGitHubApiStatus,
    getSystemLogs,
    clearCache,
    clearLogs
} from '../api/client';
import { useToast } from '../components/ui/Toast';
import { ThemeSelector } from '../components/ThemeSelector';
import { EnvManager } from '../components/replay/EnvManager';
import { Globe } from 'lucide-react';

export default function Settings() {
    const { showToast } = useToast();

    const [token, setToken] = useState('');
    const [tokenSource, setTokenSource] = useState<'env' | 'db' | 'none'>('none');
    const [downloadPath, setDownloadPath] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingToken, setSavingToken] = useState(false);
    const [savingPath, setSavingPath] = useState(false);

    // API Status State
    const [apiStatus, setApiStatus] = useState<{ limit: number; remaining: number; reset_time: number; token_source: string; last_updated: string | null } | null>(null);

    // UI State
    const [showGlobalEnv, setShowGlobalEnv] = useState(false);

    // Logs State
    const [logs, setLogs] = useState<{ id: string; timestamp: string; level: string; message: string; module: string }[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [clearingLogs, setClearingLogs] = useState(false);

    // Cache State
    const [clearingCache, setClearingCache] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const [tokenRes, pathRes, apiRes] = await Promise.all([
                getToken(),
                getDownloadPath(),
                getGitHubApiStatus()
            ]);
            setToken(tokenRes.token);
            setTokenSource(tokenRes.source || (tokenRes.token ? 'db' : 'none'));
            setDownloadPath(pathRes.path);
            setApiStatus(apiRes);
        } catch {
            showToast('Failed to load settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToken = async () => {
        setSavingToken(true);
        try {
            await saveToken(token);
            setTokenSource('db');
            const tokenRes = await getToken();
            setTokenSource(tokenRes.source || 'db');
            showToast('GitHub Token saved to Database', 'success');
        } catch {
            showToast('Failed to save token', 'error');
        } finally {
            setSavingToken(false);
        }
    };

    const handleSavePath = async () => {
        setSavingPath(true);
        try {
            await saveDownloadPath(downloadPath);
            showToast('Download path saved successfully', 'success');
        } catch {
            showToast('Failed to save path', 'error');
        } finally {
            setSavingPath(false);
        }
    };

    const handleLoadLogs = async () => {
        setLoadingLogs(true);
        try {
            const data = await getSystemLogs(100);
            setLogs(data);
            setShowLogs(true);
        } catch {
            showToast('Failed to load logs', 'error');
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleClearLogs = async () => {
        setClearingLogs(true);
        try {
            const result = await clearLogs(0);
            showToast(result.message, 'success');
            setLogs([]);
        } catch {
            showToast('Failed to clear logs', 'error');
        } finally {
            setClearingLogs(false);
        }
    };

    const handleClearCache = async () => {
        setClearingCache(true);
        try {
            await clearCache();
            showToast('Cache cleared successfully', 'success');
        } catch {
            showToast('Failed to clear cache', 'error');
        } finally {
            setClearingCache(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
        );
    }

    const isEnvManaged = tokenSource === 'env';

    return (
        <div className="max-w-7xl mx-auto p-6 min-h-[calc(100vh-3.5rem)] flex flex-col">
            {/* Header */}
            <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <h1 className="text-3xl font-bold text-text-main mb-2 tracking-tight">Settings</h1>
                <p className="text-text-muted max-w-2xl">
                    Manage your GitHub connection, storage preferences, and application appearance.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 items-start content-start">

                {/* GitHub Token Section - Full Width */}
                <section className="lg:col-span-2 bg-app-surface/50 border border-app-border rounded-xl p-6 backdrop-blur-sm hover:border-text-muted/20 transition-all shadow-lg shadow-black/20 group">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                                <Key className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-text-main flex items-center gap-2">
                                    GitHub Access Token
                                    {isEnvManaged && (
                                        <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[10px] uppercase font-bold tracking-wider rounded border border-brand-primary/20">
                                            ENV
                                        </span>
                                    )}
                                    {!isEnvManaged && tokenSource === 'db' && (
                                        <span className="px-2 py-0.5 bg-brand-secondary/10 text-brand-secondary text-[10px] uppercase font-bold tracking-wider rounded border border-brand-secondary/20">
                                            SAVED
                                        </span>
                                    )}
                                </h2>
                                <p className="text-sm text-text-muted mt-1">
                                    Required for accessing private repositories and increasing API rate limits.
                                </p>
                            </div>
                        </div>
                        <a
                            href="https://github.com/settings/tokens"
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-brand-primary hover:text-brand-primary/80 flex items-center gap-1 bg-brand-primary/10 px-3 py-1.5 rounded-lg border border-brand-primary/20 hover:bg-brand-primary/20 transition-colors self-start"
                        >
                            Generate new token <ExternalLink size={12} />
                        </a>
                    </div>

                    <div className="space-y-4 max-w-3xl">
                        <div className="relative">
                            <input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                className={`w-full bg-app-bg border rounded-lg pl-4 pr-12 py-3 text-text-main placeholder-text-muted focus:outline-none focus:border-brand-primary transition-all font-mono text-sm shadow-inner ${isEnvManaged ? 'opacity-60 cursor-not-allowed border-app-border' : 'border-app-border focus:ring-1 focus:ring-brand-primary/50'
                                    }`}
                                autoComplete="new-password"
                                spellCheck={false}
                                disabled={isEnvManaged}
                            />
                            {!isEnvManaged && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <button
                                        onClick={handleSaveToken}
                                        disabled={savingToken || !token}
                                        className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 shadow-sm"
                                        title="Save Token"
                                    >
                                        {savingToken ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                    </button>
                                </div>
                            )}
                        </div>

                        {isEnvManaged && (
                            <div className="flex items-start gap-2 text-xs text-brand-primary/80 bg-brand-primary/5 p-3 rounded-lg border border-brand-primary/10">
                                <Info size={14} className="mt-0.5 shrink-0" />
                                <p>
                                    Token is mapped from <code>GITHUB_TOKEN</code> in your <code>.env</code> file. To manage it here, remove it from the environment file.
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                {/* API & Storage Row - 2 Column Grid */}
                <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* API Status - Left Side */}
                    {apiStatus && (
                        <section className="bg-app-surface/50 border border-app-border rounded-xl p-6 backdrop-blur-sm hover:border-text-muted/20 transition-all flex flex-col h-full group">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-colors">
                                        <Activity className="w-5 h-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
                                            API Usage
                                            {apiStatus.token_source && apiStatus.token_source !== 'none' && (
                                                <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border ${apiStatus.token_source === 'env'
                                                    ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'
                                                    : 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20'
                                                    }`}>
                                                    {apiStatus.token_source === 'env' ? 'ENV' : 'DB'}
                                                </span>
                                            )}
                                            {(!apiStatus.token_source || apiStatus.token_source === 'none') && (
                                                <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] uppercase font-bold tracking-wider rounded border border-red-500/20">
                                                    NO TOKEN
                                                </span>
                                            )}
                                        </h2>
                                        <p className="text-xs text-text-muted">Rate & quotas</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-mono bg-app-bg px-2 py-1 rounded border border-app-border text-text-muted">
                                    <Clock size={12} className="text-brand-primary" />
                                    <span>Resets</span>
                                    <span className="text-text-main">
                                        {(apiStatus?.reset_time ?? 0) > 0
                                            ? new Date((apiStatus?.reset_time ?? 0) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : '--:--'
                                        }
                                    </span>
                                </div>
                            </div>

                            <div className="mt-auto">
                                <div className="flex items-baseline justify-between mb-2">
                                    <span className="text-text-muted text-xs font-medium uppercase tracking-wider">Remaining</span>
                                    <div className="text-right">
                                        <span className={`text-2xl font-mono font-bold ${(apiStatus?.remaining ?? 0) < 500 ? 'text-red-400' : 'text-brand-secondary'}`}>
                                            {apiStatus?.remaining}
                                        </span>
                                        <span className="text-text-muted text-xs font-mono ml-1">/ {apiStatus?.limit}</span>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="h-2 w-full bg-app-bg rounded-full overflow-hidden border border-app-border">
                                    <div
                                        className={`h-full transition-all duration-500 ease-out ${(apiStatus?.remaining ?? 0) < 500 ? 'bg-red-500' : 'bg-brand-secondary'}`}
                                        style={{ width: `${Math.min((apiStatus?.remaining ?? 0) / (apiStatus?.limit ?? 5000) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Storage - Right Side */}
                    <section className="bg-app-surface/50 border border-app-border rounded-xl p-6 backdrop-blur-sm hover:border-text-muted/20 transition-all shadow-lg shadow-black/20 group flex flex-col h-full">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-brand-secondary/10 rounded-lg flex items-center justify-center border border-brand-secondary/20 group-hover:bg-brand-secondary/20 transition-colors">
                                    <FolderOpen className="w-5 h-5 text-brand-secondary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-text-main">Storage</h2>
                                    <p className="text-xs text-text-muted">Local path</p>
                                </div>
                            </div>
                            <button
                                onClick={handleSavePath}
                                disabled={savingPath}
                                className="p-2 bg-brand-secondary/10 hover:bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/20 rounded-lg transition-colors disabled:opacity-50"
                                title="Save Path"
                            >
                                {savingPath ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            </button>
                        </div>

                        <div className="w-full relative flex-1 flex flex-col justify-end">
                            <input
                                type="text"
                                value={downloadPath}
                                onChange={(e) => setDownloadPath(e.target.value)}
                                placeholder="C:\Downloads\GitNexus"
                                style={{ width: '100%' }}
                                className="block w-full bg-app-bg border border-app-border rounded-lg px-4 py-3 text-text-main placeholder-text-muted focus:outline-none focus:border-brand-secondary/50 focus:ring-1 focus:ring-brand-secondary/50 transition-all font-mono text-xs shadow-inner min-w-full"
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </div>
                    </section>
                </div>

                {/* Theme & Extras */}
                <section className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Theme */}
                    <div className="bg-app-surface/50 border border-app-border rounded-xl p-6 backdrop-blur-sm hover:border-text-muted/20 transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
                                <span className="text-lg">🎨</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-text-main">Appearance</h2>
                                <p className="text-xs text-text-muted">Color themes</p>
                            </div>
                        </div>
                        <ThemeSelector />
                    </div>

                    {/* Environment Variables */}
                    <div className="bg-app-surface/50 border border-app-border rounded-xl p-6 backdrop-blur-sm hover:border-text-muted/20 transition-all flex flex-col justify-between group">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                                <Globe className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-text-main">Global Environment</h2>
                                <p className="text-xs text-text-muted">Variables for all replay servers</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 bg-app-bg p-4 rounded-lg border border-app-border">
                            <span className="text-sm text-text-muted">Configure global vars</span>
                            <button
                                onClick={() => setShowGlobalEnv(true)}
                                className="text-xs font-medium bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                Manage Variables
                            </button>
                        </div>
                    </div>
                </section>

                {/* Maintenance Section - Full Width */}
                <section className="lg:col-span-2 bg-app-surface/50 border border-app-border rounded-xl p-6 backdrop-blur-sm hover:border-text-muted/20 transition-all shadow-lg shadow-black/20">
                    <h2 className="text-lg font-semibold text-text-main mb-4 flex items-center gap-2">
                        <Database className="w-5 h-5 text-orange-400" />
                        System Maintenance
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Cache Clear */}
                        <div className="bg-app-bg p-4 rounded-lg border border-app-border">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="text-sm font-medium text-text-main">API Cache</h3>
                                    <p className="text-xs text-text-muted">Clear cached GitHub API responses</p>
                                </div>
                                <button
                                    onClick={handleClearCache}
                                    disabled={clearingCache}
                                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg border border-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {clearingCache ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    Clear Cache
                                </button>
                            </div>
                        </div>

                        {/* Logs */}
                        <div className="bg-app-bg p-4 rounded-lg border border-app-border">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="text-sm font-medium text-text-main">System Logs</h3>
                                    <p className="text-xs text-text-muted">View and manage application logs</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleClearLogs}
                                        disabled={clearingLogs}
                                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg border border-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {clearingLogs ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                        Clear
                                    </button>
                                    <button
                                        onClick={() => showLogs ? setShowLogs(false) : handleLoadLogs()}
                                        disabled={loadingLogs}
                                        className="px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-medium rounded-lg border border-brand-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {loadingLogs ? <RefreshCw size={12} className="animate-spin" /> : <FileText size={12} />}
                                        {showLogs ? 'Hide' : 'View'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Log Viewer */}
                    {showLogs && (
                        <div className="mt-4 bg-app-bg rounded-lg border border-app-border overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-app-border bg-app-surface/50">
                                <span className="text-xs font-medium text-text-muted">Recent Logs ({logs.length})</span>
                                <button
                                    onClick={() => setShowLogs(false)}
                                    className="text-text-muted hover:text-text-main transition-colors"
                                >
                                    <ChevronUp size={14} />
                                </button>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-2 space-y-1 font-mono text-xs">
                                {logs.length === 0 ? (
                                    <div className="text-center py-4 text-text-muted">No logs available</div>
                                ) : (
                                    logs.map((log) => (
                                        <div key={log.id} className="flex items-start gap-2 px-2 py-1 rounded hover:bg-app-surface/50">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                                                log.level === 'WARNING' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    log.level === 'INFO' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {log.level.slice(0, 4)}
                                            </span>
                                            <span className="text-text-muted whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                            <span className="text-cyan-400 whitespace-nowrap">[{log.module}]</span>
                                            <span className="text-text-main break-all">{log.message}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* About Footer */}
                <section className="lg:col-span-2 mt-4 bg-app-surface/20 border border-app-border/50 rounded-xl p-4 flex items-center justify-between text-xs text-text-muted hover:bg-app-surface/40 transition-colors">
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        <span>GitNexus <span className="font-mono text-text-muted/80">v3.1.0</span></span>
                    </div>
                    <span className="font-mono opacity-50">Production Environment</span>
                </section>

            </div>

            <EnvManager
                isOpen={showGlobalEnv}
                onClose={() => setShowGlobalEnv(false)}
                scope="global"
                title="Global Environment Variables"
            />
        </div>
    );
}
