import { useState } from 'react';
import { ArrowLeft, BookOpen, Download, Star, GitFork, RefreshCw, Github, ExternalLink, History, Link as LinkIcon, Code } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { SimpleMarkdown } from '../ui/SimpleMarkdown';
import type { Repository, GitHubCommit } from '../../api/client';
import { useToast } from '../ui/Toast';
import { CommitDetailModal } from './CommitDetailModal';

interface RepoDetailViewProps {
    repo: Repository;
    readme: string | null;
    commits: GitHubCommit[];
    onBack: () => void;
    onRefresh?: () => void;
}

const getLangColor = (lang: string | null): string => {
    if (!lang) return '#ccc';
    const colors: Record<string, string> = {
        'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'HTML': '#e34c26',
        'CSS': '#563d7c', 'Python': '#3572A5', 'Java': '#b07219',
        'C#': '#178600', 'C++': '#f34b7d', 'Go': '#00ADD8',
        'Ruby': '#701516', 'PHP': '#4F5D95', 'Shell': '#89e051',
        'Svelte': '#ff3e00', 'Vue': '#4FC08D', 'Rust': '#dea584',
        'Kotlin': '#A97BFF', 'Dart': '#00B4AB', 'Swift': '#F05138',
    };
    return colors[lang] || '#cccccc';
};

export function RepoDetailView({ repo, readme, commits, onBack, onRefresh }: RepoDetailViewProps) {
    const { showToast } = useToast();
    const [selectedCommit, setSelectedCommit] = useState<GitHubCommit | null>(null);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
    };

    return (
        <div className="h-full flex flex-col">
            <CommitDetailModal
                commit={selectedCommit}
                onClose={() => setSelectedCommit(null)}
            />

            {/* Header */}
            <div className="flex-shrink-0 bg-slate-900/50 border-b border-slate-800 p-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Search
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* README */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                            <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-slate-400" />
                                    <span className="font-semibold text-white">{repo.name}</span>
                                    <Badge color="slate">Public</Badge>
                                </div>
                                <a
                                    href={`${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                                >
                                    <Download className="w-4 h-4" /> Download
                                </a>
                            </div>

                            <div className="p-6">
                                <p className="text-slate-400 mb-4">{repo.description || 'No description'}</p>

                                <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-6 pb-6 border-b border-slate-700">
                                    <span className="flex items-center gap-1"><Star className="w-4 h-4" /> {repo.stargazers_count} stars</span>
                                    <span className="flex items-center gap-1"><GitFork className="w-4 h-4" /> {repo.forks_count} forks</span>
                                    {repo.language && (
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getLangColor(repo.language) }} />
                                            {repo.language}
                                        </span>
                                    )}
                                </div>

                                {readme ? (
                                    <SimpleMarkdown content={readme} />
                                ) : (
                                    <div className="flex items-center justify-center py-8 text-slate-500">
                                        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading README...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Links */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Links</h3>
                            <div className="space-y-2">
                                <a
                                    href={repo.html_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                                >
                                    <span className="flex items-center gap-2 text-slate-300">
                                        <Github className="w-4 h-4" /> View on GitHub
                                    </span>
                                    <ExternalLink className="w-4 h-4 text-slate-500" />
                                </a>
                                {repo.homepage && (
                                    <a
                                        href={repo.homepage}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                                    >
                                        <span className="flex items-center gap-2 text-slate-300">
                                            <LinkIcon className="w-4 h-4" /> Homepage
                                        </span>
                                        <ExternalLink className="w-4 h-4 text-slate-500" />
                                    </a>
                                )}
                                <button
                                    onClick={() => copyToClipboard(repo.clone_url)}
                                    className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors text-left"
                                >
                                    <span className="flex items-center gap-2 text-slate-300">
                                        <Code className="w-4 h-4" /> Clone URL
                                    </span>
                                    <span className="text-xs text-slate-500">Click to copy</span>
                                </button>
                            </div>
                        </div>

                        {/* Recent Commits */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col h-[600px]">
                            <div className="flex-shrink-0 flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <History className="w-4 h-4" /> Recent Commits
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-600 font-mono">{commits.length} loaded</span>
                                    <button
                                        onClick={onRefresh}
                                        title="Refresh Commits"
                                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-lg transition-colors"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1">
                                {commits.length === 0 ? (
                                    <div className="h-full flex items-center justify-center">
                                        <p className="text-slate-500 text-sm">
                                            {commits === null ? 'Loading...' : 'No commits found (or loading...)'}
                                        </p>
                                    </div>
                                ) : (
                                    commits.map(commit => (
                                        <button
                                            key={commit.sha}
                                            onClick={() => setSelectedCommit(commit)}
                                            className="w-full text-left relative pl-4 border-l-2 border-slate-800 hover:border-blue-500 py-3 group transition-colors"
                                        >
                                            <div className="absolute -left-[5px] top-4 w-2 h-2 rounded-full bg-slate-700 group-hover:bg-blue-500 transition-colors" />

                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <p className="text-sm text-slate-300 font-medium line-clamp-1 group-hover:text-blue-400 transition-colors">
                                                    {commit.commit.message.split('\n')[0]}
                                                </p>
                                                <span className="text-[10px] font-mono text-slate-600 bg-slate-900 px-1.5 py-0.5 rounded">
                                                    {commit.sha.substring(0, 7)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="text-xs text-slate-500 truncate">
                                                        {commit.commit.author.name}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-slate-600 whitespace-nowrap">
                                                    {new Date(commit.commit.author.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
