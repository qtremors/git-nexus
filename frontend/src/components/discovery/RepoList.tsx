import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Star, GitFork, CheckCircle, Layers, Code, Search, ArrowUp, ArrowDown, Calendar, Clock, GitCommit, Download, ExternalLink } from 'lucide-react';
import type { Repository } from '../../api/client';
import { SimpleMarkdown } from '../ui/SimpleMarkdown';
import { ContributionGraph } from './ContributionGraph';
import { getContributionGraph } from '../../api/client';


interface RepoListProps {
    repos: Repository[];
    profileReadme: string | null;
    downloadCart: Map<number, Repository>;
    onToggleCartItem: (repo: Repository) => void;
    onOpenRepoDetail: (repo: Repository) => void;
    onDownload: () => Promise<any>;
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

export function RepoList({ repos, profileReadme, downloadCart, onToggleCartItem, onOpenRepoDetail, onDownload }: RepoListProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'repositories'>('repositories');

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState('All');
    const [selectedTopic, setSelectedTopic] = useState('All Topics');
    const [minCommits, setMinCommits] = useState<string>('');
    const [maxCommits, setMaxCommits] = useState<string>('');
    const [sortBy, setSortBy] = useState<'stars' | 'updated' | 'created' | 'commits' | 'name'>('updated');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // View State: 1 = List, 2/3/4 = Grid
    const [columns, setColumns] = useState<1 | 2 | 3 | 4>(1);

    // Contribution Graph State
    const [contributionData, setContributionData] = useState<{ date: string; count: number; repos: string[]; commits: any[] }[]>([]);
    const [contributionLoading, setContributionLoading] = useState(false);
    const [contributionsFetched, setContributionsFetched] = useState(false);

    // Day Details Modal State
    const [selectedDay, setSelectedDay] = useState<{ date: string; count: number; repos: string[]; commits: any[] } | null>(null);

    // Effect to fetch contributions when Overview tab is active
    useState(() => {
        // We use a "strict mode safe" check or just standard effect
    });

    // Actually using useEffect
    useMemo(() => {
        // Just defining helper to be called in effect
    }, []);

    // Fetch contributions logic
    const fetchContributions = useCallback(async (forceRefresh = false) => {
        if ((contributionsFetched && !forceRefresh) || repos.length === 0) return;
        setContributionLoading(true);

        try {
            // Initial fetch
            // We use the first repo's owner as the username context (assuming all repos belong to the profile user)
            // Or passage username prop? RepoListProps doesn't have username.
            // But repos[0].owner.login should be the profile user.
            const username = repos[0]?.owner.login;
            if (!username) {
                setContributionLoading(false);
                return;
            }

            let response = await getContributionGraph(username, repos, forceRefresh);

            // Polling if loading
            if (response.loading) {
                // Poll every 2 seconds for up to 30 seconds
                const maxPolls = 15;
                let polls = 0;
                while (response.loading && polls < maxPolls) {
                    await new Promise(r => setTimeout(r, 2000));
                    response = await getContributionGraph(username, repos, false); // check status
                    polls++;
                }
            }

            const rawCommits = response.commits;

            // Transform flattened commits to daily map
            const dailyMap = new Map<string, { count: number; repos: Set<string>; commits: any[] }>();

            for (const commit of rawCommits) {
                const date = commit.date.split('T')[0];
                if (!dailyMap.has(date)) {
                    dailyMap.set(date, { count: 0, repos: new Set(), commits: [] });
                }
                const entry = dailyMap.get(date)!;
                entry.count++;
                entry.repos.add(commit.repo);
                entry.commits.push({
                    message: commit.message,
                    repo: commit.repo,
                    sha: commit.sha,
                    time: commit.date, // already ISO
                    url: commit.url
                });
            }

            // Convert to array
            const result = Array.from(dailyMap.entries()).map(([date, data]) => ({
                date,
                count: data.count,
                repos: Array.from(data.repos),
                commits: data.commits
            }));

            setContributionData(result);
        } catch (e) {
            console.error("Failed to fetch contribution graph", e);
        } finally {
            setContributionLoading(false);
            setContributionsFetched(true);
        }
    }, [repos, contributionsFetched]);

    // Trigger fetch on tab switch via useEffect (fixes render-time state update)
    useEffect(() => {
        if (activeTab === 'overview' && !contributionsFetched && !contributionLoading) {
            fetchContributions();
        }
    }, [activeTab, contributionsFetched, contributionLoading, fetchContributions]);


    // Extract unique languages for Chips
    const uniqueLanguages = useMemo(() => {
        const langs = new Set<string>();
        repos.forEach(repo => {
            if (repo.language) langs.add(repo.language);
        });
        return ['All', ...Array.from(langs).sort()];
    }, [repos]);

    // Extract unique topics for Dropdown
    const uniqueTopics = useMemo(() => {
        const tops = new Set<string>();
        repos.forEach(repo => {
            if (repo.topics) repo.topics.forEach(t => tops.add(t));
        });
        return ['All Topics', ...Array.from(tops).sort()];
    }, [repos]);

    // Filtering Logic
    const filteredRepos = useMemo(() => {
        return repos.filter(repo => {
            // Text Search
            const query = searchQuery.toLowerCase().trim();
            const matchesSearch = !query ||
                repo.name.toLowerCase().includes(query) ||
                (repo.description && repo.description.toLowerCase().includes(query));

            // Language Filter (Chips)
            const matchesLanguage = selectedLanguage === 'All' || repo.language === selectedLanguage;

            // Topic Filter (Dropdown)
            const matchesTopic = selectedTopic === 'All Topics' ||
                (repo.topics && repo.topics.includes(selectedTopic));

            // Commit Range
            const count = repo.commit_count || 0;
            const min = minCommits === '' ? 0 : parseInt(minCommits);
            const max = maxCommits === '' ? Infinity : parseInt(maxCommits);
            const matchesCommits = count >= min && count <= max;

            return matchesSearch && matchesLanguage && matchesTopic && matchesCommits;
        });
    }, [repos, searchQuery, selectedLanguage, selectedTopic, minCommits, maxCommits]);

    // Sorting Logic
    const sortedRepos = useMemo(() => {
        const sorted = [...filteredRepos].sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'stars': comparison = a.stargazers_count - b.stargazers_count; break;
                case 'updated': comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(); break;
                case 'created': comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
                case 'commits': comparison = (a.commit_count || 0) - (b.commit_count || 0); break;
                case 'name': comparison = b.name.localeCompare(a.name); break;
                default: comparison = 0;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [filteredRepos, sortBy, sortOrder]);

    const toggleSortOrder = () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');

    return (
        <section className="flex-1 min-w-0 space-y-4">
            {/* CSS to hide spinners and style options */}
            <style>{`
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
                input[type=number] {
                    -moz-appearance: textfield;
                }
                select option {
                    background-color: var(--color-app-bg);
                    color: var(--color-text-main);
                }
            `}</style>

            {/* Tabs */}
            <div className="flex items-center justify-between border-b border-app-border pb-2">
                <div className="flex gap-4">
                    {(['overview', 'repositories'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-1 py-2 text-sm font-medium capitalize transition-all relative ${activeTab === tab ? "text-brand-primary" : "text-text-muted hover:text-white"
                                }`}
                        >
                            {tab}
                            {activeTab === tab && (
                                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-primary rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Filters moved to header */}
                {activeTab === 'repositories' && (
                    <div className="flex-1 flex items-center justify-between min-w-0 ml-4">
                        {/* Left Group: Filters */}
                        <div className="flex items-center gap-2">
                            {/* Search */}
                            <div className="relative w-[240px] shrink-0 h-8">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                                <input
                                    type="text"
                                    placeholder="Filter..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-full bg-app-bg border border-app-border text-text-main rounded-full pl-8 pr-3 text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all placeholder:text-text-muted"
                                />
                            </div>

                            {/* Commits Range */}
                            <div className="flex items-center bg-app-bg border border-app-border rounded-full px-2 gap-1.5 group focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary transition-all h-8 max-w-[150px]">
                                <GitCommit className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Min"
                                    value={minCommits}
                                    onChange={(e) => {
                                        if (/^\d*$/.test(e.target.value)) {
                                            setMinCommits(e.target.value);
                                        }
                                    }}
                                    className="w-10 bg-transparent text-text-main text-xs focus:outline-none placeholder:text-text-muted text-center h-full min-w-0"
                                />
                                <span className="text-text-muted text-[10px] shrink-0">-</span>
                                <input
                                    type="text"
                                    placeholder="Max"
                                    value={maxCommits}
                                    onChange={(e) => {
                                        if (/^\d*$/.test(e.target.value)) {
                                            setMaxCommits(e.target.value);
                                        }
                                    }}
                                    className="w-10 bg-transparent text-text-main text-xs focus:outline-none placeholder:text-text-muted text-center h-full min-w-0"
                                />
                            </div>

                            {/* Sort (Combined) */}
                            <div className="flex items-center bg-app-bg border border-app-border hover:border-text-muted/20 rounded-full pl-3 pr-1 gap-1 transition-all focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary hidden lg:flex h-8">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="bg-app-bg border-none text-text-main text-xs focus:outline-none cursor-pointer appearance-none h-full"
                                >
                                    <option value="stars">Stars</option>
                                    <option value="updated">Updated</option>
                                    <option value="created">Created</option>
                                    <option value="commits">Commits</option>
                                    <option value="name">Name</option>
                                </select>
                                <button
                                    onClick={toggleSortOrder}
                                    className="p-1 text-text-muted hover:text-white rounded-full bg-app-surface hover:bg-app-surface-accent transition-all"
                                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                                >
                                    {sortOrder === 'asc' ? (
                                        <ArrowUp className="w-3.5 h-3.5" />
                                    ) : (
                                        <ArrowDown className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </div>

                            {/* Topic Dropdown */}
                            <div className="relative hidden xl:block w-[160px] h-8">
                                <select
                                    value={selectedTopic}
                                    onChange={(e) => setSelectedTopic(e.target.value)}
                                    className="appearance-none w-full h-full bg-app-bg border border-app-border text-text-main rounded-full pl-3 pr-8 text-xs focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all cursor-pointer hover:border-text-muted/20 truncate"
                                >
                                    {uniqueTopics.map(topic => (
                                        <option key={topic} value={topic}>{topic}</option>
                                    ))}
                                </select>
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-slate-500" />
                                </div>
                            </div>
                        </div>



                        {/* Column Selector */}
                        <div className="flex items-center gap-1 bg-app-bg border border-app-border rounded-full p-1 shrink-0 h-8">
                            {[1, 2, 3, 4].map((col) => (
                                <button
                                    key={col}
                                    onClick={() => setColumns(col as 1 | 2 | 3 | 4)}
                                    className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center transition-all ${columns === col
                                        ? 'bg-brand-primary text-white shadow-sm'
                                        : 'text-text-muted hover:text-text-main hover:bg-app-surface'
                                        }`}
                                    title={col === 1 ? 'List View' : `${col} Columns`}
                                >
                                    {col}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in duration-300">

                    {profileReadme ? (
                        <div className="bg-app-surface/50 border border-app-border rounded-xl p-6">
                            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Profile README</h3>
                            <SimpleMarkdown content={profileReadme} />
                        </div>
                    ) : (
                        <div className="bg-app-surface/50 border border-app-border rounded-xl p-12 text-center text-text-muted">
                            <p>No profile README available.</p>
                        </div>
                    )}

                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                        {/* Languages & Stats (25%) */}
                        <div className="w-full lg:w-[25%] shrink-0">
                            <div className="bg-app-surface/50 border border-app-border rounded-xl p-5">
                                <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Code className="w-4 h-4" /> Top Languages
                                </h3>

                                {/* Calculation */}
                                {(() => {
                                    const langMap = repos.reduce((acc, repo) => {
                                        if (repo.language) acc[repo.language] = (acc[repo.language] || 0) + 1;
                                        return acc;
                                    }, {} as Record<string, number>);

                                    const total = Object.values(langMap).reduce((a, b) => a + b, 0);
                                    const sortedLangs = Object.entries(langMap)
                                        .sort((a, b) => b[1] - a[1])
                                        .slice(0, 6); // Top 6

                                    if (total === 0) return <p className="text-text-muted text-sm">No language data.</p>;

                                    return (
                                        <>
                                            {/* Distribution Bar */}
                                            <div className="flex h-3 w-full rounded-full overflow-hidden mb-4 bg-app-surface">
                                                {sortedLangs.map(([lang, count]) => (
                                                    <div
                                                        key={lang}
                                                        style={{ width: `${(count / total) * 100}%`, backgroundColor: getLangColor(lang) }}
                                                        className="h-full hover:opacity-90 transition-opacity"
                                                        title={`${lang}: ${count} repos`}
                                                    />
                                                ))}
                                            </div>

                                            {/* Legend List */}
                                            <div className="space-y-2">
                                                {sortedLangs.map(([lang, count]) => {
                                                    const percent = ((count / total) * 100).toFixed(1);
                                                    return (
                                                        <div key={lang} className="flex items-center justify-between text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: getLangColor(lang) }} />
                                                                <span className="font-medium text-text-main">{lang}</span>
                                                            </div>
                                                            <span className="text-text-muted">{percent}%</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Activity/Commits Graph (75%) */}
                        <div className="flex-1 min-w-0 w-full relative">
                            <div className="bg-app-surface/50 border border-app-border rounded-xl p-6 h-full min-h-[200px]">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                                        <GitCommit className="w-4 h-4" /> Contribution Activity (Last Year)
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {contributionLoading && (
                                            <span className="text-xs text-brand-primary animate-pulse">Fetching updates...</span>
                                        )}
                                        <button
                                            onClick={() => fetchContributions(true)}
                                            disabled={contributionLoading}
                                            className="p-1.5 rounded-md hover:bg-app-surface-accent text-text-muted hover:text-white transition-colors"
                                            title="Force Refresh from GitHub"
                                        >
                                            <Clock className={`w-3.5 h-3.5 ${contributionLoading ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                                <ContributionGraph
                                    data={contributionData}
                                    isLoading={contributionLoading}
                                    onDayClick={setSelectedDay}
                                />
                            </div>

                            {/* Day Detail Modal - Portaled */}
                            {selectedDay && createPortal(
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                                    <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                                        <div className="flex items-center justify-between p-4 border-b border-app-border">
                                            <div>
                                                <h4 className="text-lg font-semibold text-text-main flex items-center gap-2">
                                                    <Calendar className="w-5 h-5 text-brand-primary" />
                                                    Activity on {new Date(selectedDay.date).toLocaleDateString(undefined, { dateStyle: 'full' })}
                                                </h4>
                                                <p className="text-sm text-text-muted">{selectedDay.count} contribution{selectedDay.count !== 1 ? 's' : ''}</p>
                                            </div>
                                            <button
                                                onClick={() => setSelectedDay(null)}
                                                className="text-text-muted hover:text-white p-1 hover:bg-app-bg rounded-lg transition-colors"
                                            >
                                                <span className="sr-only">Close</span>
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                            {selectedDay.repos.length === 0 ? (
                                                <div className="text-center py-12 text-text-muted">
                                                    <p>No activity recorded for this day.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {(() => {
                                                        const commitsByRepo: Record<string, any[]> = {};
                                                        selectedDay.commits.forEach((c: any) => {
                                                            if (!commitsByRepo[c.repo]) commitsByRepo[c.repo] = [];
                                                            commitsByRepo[c.repo].push(c);
                                                        });

                                                        return Object.entries(commitsByRepo).map(([repoName, commits]) => (
                                                            <div key={repoName} className="bg-app-bg/30 rounded-xl border border-app-border/50 overflow-hidden">
                                                                <div className="bg-app-bg/50 px-4 py-2 flex items-center gap-2 border-b border-app-border/50">
                                                                    <GitCommit className="w-4 h-4 text-brand-primary" />
                                                                    <h5 className="font-semibold text-brand-primary text-sm">{repoName}</h5>
                                                                    <span className="ml-auto text-xs text-text-muted bg-app-surface px-2 py-0.5 rounded-full border border-app-border">
                                                                        {commits.length} commits
                                                                    </span>
                                                                </div>
                                                                <div className="divide-y divide-slate-800/50">
                                                                    {commits.map((commit: any) => (
                                                                        <a
                                                                            key={commit.sha}
                                                                            href={commit.url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="block p-3 hover:bg-app-surface-accent transition-colors group"
                                                                        >
                                                                            <div className="flex items-start justify-between gap-4">
                                                                                <div className="min-w-0">
                                                                                    <p className="text-sm text-text-main group-hover:text-brand-primary transition-colors font-medium line-clamp-1 break-all">
                                                                                        {commit.message.split('\n')[0]}
                                                                                    </p>
                                                                                    <p className="text-xs text-text-muted mt-1 flex items-center gap-3">
                                                                                        <span className="font-mono">{commit.sha.substring(0, 7)}</span>
                                                                                        <span>{new Date(commit.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                                                                                    </p>
                                                                                </div>
                                                                                <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-text-main opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                                                                            </div>
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* Repositories Tab */}
            {activeTab === 'repositories' && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">



                    {/* Filter Toolbar (Pill Layout) */}
                    <div className="flex items-center justify-between gap-4">
                        {/* Language Chips (Available Space) */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 min-w-0 mask-gradient-x flex-1">
                            <button
                                onClick={() => setSelectedLanguage('All')}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border shrink-0 ${selectedLanguage === 'All'
                                    ? 'bg-brand-primary text-white border-brand-primary'
                                    : 'bg-app-surface text-text-muted border-app-border hover:border-text-muted/50'
                                    }`}
                            >
                                All
                            </button>
                            {uniqueLanguages.filter(l => l !== 'All').map(lang => (
                                <button
                                    key={lang}
                                    onClick={() => setSelectedLanguage(lang)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border shrink-0 ${selectedLanguage === lang
                                        ? 'bg-brand-primary text-white border-brand-primary'
                                        : 'bg-app-surface text-text-muted border-app-border hover:border-text-muted/50'
                                        }`}
                                >
                                    {lang}
                                </button>
                            ))}
                        </div>

                        {/* Download Cart Button */}
                        {downloadCart.size > 0 && (
                            <button
                                onClick={onDownload}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20 hover:bg-brand-secondary/20 hover:text-brand-secondary/80 transition-colors shrink-0 animate-in fade-in zoom-in duration-300"
                                title={`Download ${downloadCart.size} selected repositories`}
                            >
                                <Download className="w-4 h-4" />
                                <span className="text-xs font-bold">{downloadCart.size}</span>
                            </button>
                        )}
                    </div>

                    {/* Repo List Grid/List */}
                    <div className={
                        columns === 1
                            ? "space-y-3"
                            : `grid grid-cols-1 ${columns === 2 ? 'md:grid-cols-2' : columns === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'} gap-4`
                    }>
                        {sortedRepos.length === 0 ? (
                            <div className="col-span-full text-center py-12 text-text-muted">
                                <p>No repositories match your filters.</p>
                            </div>
                        ) : (
                            sortedRepos.map(repo => (
                                <div
                                    key={repo.id}
                                    onClick={() => onOpenRepoDetail(repo)}
                                    className={`bg-app-surface/50 border border-app-border rounded-xl p-4 hover:border-text-muted/20 hover:bg-app-surface/80 transition-all group flex cursor-pointer ${columns === 1 ? 'flex-col sm:flex-row sm:items-start justify-between gap-4' : 'flex-col h-full'}`}
                                >
                                    <div className="flex-1 min-w-0 flex flex-col h-full">
                                        {/* Header */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3
                                                className="text-lg font-semibold text-brand-primary group-hover:underline truncate"
                                                title={repo.name}
                                            >
                                                {repo.name}
                                            </h3>
                                            {repo.language && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-app-surface text-text-muted border border-app-border shrink-0">
                                                    {repo.language}
                                                </span>
                                            )}
                                        </div>

                                        {/* Description */}
                                        <p className="text-text-muted text-sm mb-4 flex-1">
                                            {repo.description || 'No description provided.'}
                                        </p>

                                        {/* Stats */}
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted mt-auto">
                                            <span className="flex items-center gap-1" title="Stars">
                                                <Star className="w-3.5 h-3.5" /> {repo.stargazers_count}
                                            </span>
                                            <span className="flex items-center gap-1" title="Forks">
                                                <GitFork className="w-3.5 h-3.5" /> {repo.forks_count}
                                            </span>
                                            <span className="flex items-center gap-1" title="Commits">
                                                <GitCommit className="w-3.5 h-3.5" /> {repo.commit_count || 0}
                                            </span>
                                            <span className="flex items-center gap-1" title="Last Updated">
                                                <Clock className="w-3.5 h-3.5" /> {new Date(repo.updated_at).toLocaleDateString()}
                                            </span>
                                            <span className="flex items-center gap-1" title="Created On">
                                                <Calendar className="w-3.5 h-3.5" /> {new Date(repo.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {/* Topics Chips */}
                                        {repo.topics && repo.topics.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-app-border/50">
                                                {repo.topics.slice(0, columns === 1 ? 10 : 5).map(topic => (
                                                    <span key={topic} className="text-[10px] px-2 py-0.5 rounded-full bg-app-surface/50 text-text-muted">
                                                        #{topic}
                                                    </span>
                                                ))}
                                                {repo.topics.length > (columns === 1 ? 10 : 5) && (
                                                    <span className="text-[10px] px-2 py-0.5 text-slate-600">+{repo.topics.length - (columns === 1 ? 10 : 5)}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className={`flex shrink-0 ${columns === 1 ? 'flex-row sm:flex-col items-center sm:items-end gap-2 mt-4 sm:mt-0' : 'flex-row items-center justify-between w-full mt-4 pt-4 border-t border-app-border/50'}`}>
                                        {/* Homepage Button (if available) */}
                                        {repo.homepage ? (
                                            <a
                                                href={repo.homepage}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="px-3 py-1.5 text-sm text-text-muted hover:text-white bg-app-surface hover:bg-app-surface-accent rounded-lg transition-colors whitespace-nowrap flex-1 sm:flex-none text-center flex items-center justify-center gap-1.5"
                                                title={repo.homepage}
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                Website
                                            </a>
                                        ) : (
                                            // Spacer or alternative if needed, but keeping empty to reduce clutter
                                            null
                                        )}

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleCartItem(repo);
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none ${downloadCart.has(repo.id)
                                                ? "bg-brand-secondary text-white"
                                                : "bg-app-surface text-text-muted hover:bg-app-surface-accent"
                                                }`}
                                        >
                                            {downloadCart.has(repo.id) ? (
                                                <><CheckCircle className="w-4 h-4" /> Selected</>
                                            ) : (
                                                <><Layers className="w-4 h-4" /> Select</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

