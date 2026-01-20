/**
 * GitNexus v3.1.0 - Home Page
 * 
 * Clean, technical dashboard interface with premium accents.
 */

import { Link } from 'react-router-dom';
import {
    Search,
    Eye,
    History,
    ArrowRight,
    Star,
    Download,
    GitBranch,
    Terminal
} from 'lucide-react';

export default function Home() {
    const features = [
        {
            path: '/discovery',
            icon: Search,
            title: 'User Discovery',
            description: 'Explore GitHub profiles, browse repositories, view READMEs, and analyze commit history.',
            tags: ['Profile Search', 'Repo Browser', 'README Render'],
            accent: 'from-blue-500 to-cyan-400',
            iconColor: 'text-blue-400'
        },
        {
            path: '/watchlist',
            icon: Eye,
            title: 'Asset Watchtower',
            description: 'Track repositories, get release notifications, download assets with version tracking.',
            tags: ['Release Alerts', 'Asset Downloads', 'Import/Export'],
            accent: 'from-purple-500 to-pink-400',
            iconColor: 'text-purple-400'
        },
        {
            path: '/replay',
            icon: History,
            title: 'Code Replay',
            description: 'Browse commit history and launch dev servers to preview any point in time.',
            tags: ['Commit Browser', 'Server Launch', 'Multi-Version'],
            accent: 'from-emerald-500 to-teal-400',
            iconColor: 'text-emerald-400'
        }
    ];

    const stats = [
        { icon: Star, label: 'Repositories', value: '--' },
        { icon: Download, label: 'Downloads', value: '--' },
        { icon: GitBranch, label: 'Commits', value: '--' },
    ];

    return (
        <div className="min-h-full flex flex-col items-center justify-center py-20 relative overflow-hidden">

            {/* Technical Background Grid */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.15]"
                style={{
                    backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    maskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)'
                }}
            />

            {/* Ambient Soul Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />

            <div className="w-full max-w-5xl px-6 relative z-10">

                {/* Hero Section */}
                <div className="text-center mb-20">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161b22] border border-[#30363d] text-xs font-mono text-blue-400 mb-8 shadow-lg shadow-blue-900/20">
                        <Terminal size={12} />
                        <span className="tracking-wider">GITNEXUS_V3.1.0</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold text-[#f0f6fc] tracking-tight mb-6">
                        Your GitHub <br className="hidden md:block" />
                        <span className="bg-gradient-to-r from-blue-200 via-white to-blue-200 bg-clip-text text-transparent drop-shadow-sm">
                            Command Center
                        </span>
                    </h1>

                    <p className="text-[#8b949e] text-lg max-w-2xl mx-auto leading-relaxed">
                        A unified interface for discovery, asset tracking, and historical code replay.
                        Designed for precision and control.
                    </p>
                </div>

                {/* Feature Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
                    {features.map(feature => (
                        <Link
                            key={feature.path}
                            to={feature.path}
                            className="group relative flex flex-col bg-[#161b22] border border-[#30363d] rounded-xl p-6 hover:bg-[#1c2128] hover:border-blue-500/30 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40"
                        >
                            <div className="flex items-center justify-between mb-5">
                                <div className={`w-12 h-12 bg-[#0d1117] border border-[#30363d] rounded-lg flex items-center justify-center ${feature.iconColor} group-hover:scale-110 transition-transform duration-200`}>
                                    <feature.icon size={22} />
                                </div>
                                <ArrowRight size={16} className="text-[#8b949e] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                            </div>

                            <h2 className="text-lg font-bold text-[#f0f6fc] mb-3">
                                {feature.title}
                            </h2>

                            <p className="text-[#8b949e] text-sm mb-6 leading-relaxed flex-grow">
                                {feature.description}
                            </p>

                            <div className="flex flex-wrap gap-2 pt-4 border-t border-[#30363d]/50 mt-auto">
                                {feature.tags.map(tag => (
                                    <span
                                        key={tag}
                                        className="px-2 py-1 bg-[#0d1117] border border-[#30363d] text-[#8b949e] text-[10px] font-mono rounded tracking-tight"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Technical Stats Strip */}
                <div className="border-t border-[#30363d] pt-10 flex justify-center">
                    <div className="inline-flex gap-16 md:gap-24 opacity-70 hover:opacity-100 transition-opacity">
                        {stats.map((stat, i) => (
                            <div key={i} className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2 text-[#8b949e] text-xs font-mono uppercase tracking-widest">
                                    <stat.icon size={12} />
                                    {stat.label}
                                </div>
                                <div className="text-2xl font-bold text-[#f0f6fc] font-mono tracking-tighter">
                                    {stat.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
