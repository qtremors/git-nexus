/**
 * GitNexus v3.1.0 - Layout Component
 * 
 * Header-based navigation with theme support.
 */

import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    Search,
    Eye,
    History,
    Settings,
    Github,
    Clock
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getSearchHistory } from '../api/client';

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();

    // These pages handle their own full-bleed layout
    const fullBleedPages = ['/discovery', '/watchlist', '/replay'];
    const isFullBleed = fullBleedPages.some(p => location.pathname.startsWith(p));

    const navItems = [
        { path: '/discovery', icon: Search, label: 'Discovery' },
        { path: '/watchlist', icon: Eye, label: 'Watchlist' },
        { path: '/replay', icon: History, label: 'Replay' },
    ];

    // Search Autocomplete Logic
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch history on mount
    useEffect(() => {
        if (location.pathname === '/discovery') {
            getSearchHistory().then(history => {
                setSearchHistory(history.map(h => h.username));
            }).catch(() => { });
        }
    }, [location.pathname]);

    // Close suggestions on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (val: string) => {
        if (val.trim()) {
            navigate(`/discovery?q=${encodeURIComponent(val.trim())}`);
            setShowSuggestions(false);
            // Optimistically add to history locally or refetch
            if (!searchHistory.includes(val.trim())) {
                setSearchHistory(prev => [val.trim(), ...prev].slice(0, 10));
            }
        }
    };

    // Filter suggestions
    const filteredHistory = searchHistory.filter(item =>
        item.toLowerCase().includes(inputValue.toLowerCase()) &&
        item.toLowerCase() !== inputValue.toLowerCase() // Don't show exact match if already typed
    ).slice(0, 5);

    return (
        <div className="flex flex-col h-screen bg-app-bg text-text-main overflow-hidden">

            {/* Header */}
            <header className="absolute top-0 left-0 right-0 h-14 bg-transparent flex items-center justify-between px-6 z-50 pointer-events-none">
                {/* Logo (Home) */}
                <NavLink to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity pointer-events-auto">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <Github size={18} className="text-white" />
                    </div>
                    <span className="text-lg font-bold text-white tracking-tight">
                        GitNexus
                    </span>
                </NavLink>

                {/* Navigation Dock */}
                <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-app-surface/90 backdrop-blur-xl border border-white/5 rounded-full px-2 py-1.5 shadow-2xl pointer-events-auto">
                    {navItems.map(({ path, icon: Icon, label }) => (
                        <NavLink
                            key={path}
                            to={path}
                            className={({ isActive }) => `
                                flex items-center gap-2 px-4 py-1.5 rounded-full transition-all text-sm font-medium
                                ${isActive
                                    ? 'bg-brand-primary/90 text-white shadow-lg shadow-brand-primary/30'
                                    : 'text-text-muted hover:text-white hover:bg-white/10'
                                }
                            `}
                        >
                            <Icon size={16} />
                            <span className="hidden sm:inline">{label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Right Side: Search & Settings */}
                <div className="flex items-center gap-3 pointer-events-auto">

                    {/* Discovery Search Bar */}
                    {location.pathname === '/discovery' && (
                        <div className="relative group" ref={containerRef}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-brand-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                className="w-64 bg-app-surface/90 backdrop-blur-md border border-app-border/50 rounded-full pl-9 pr-4 py-1.5 text-sm text-text-main placeholder-text-muted focus:outline-none focus:border-brand-primary/50 focus:bg-app-surface-accent transition-all shadow-sm"
                                onFocus={() => setShowSuggestions(true)}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSearch((e.target as HTMLInputElement).value);
                                    }
                                }}
                            />

                            {/* Autocomplete Dropdown */}
                            {showSuggestions && filteredHistory.length > 0 && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-app-surface border border-app-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                    <div className="p-1.5">
                                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                            Recent
                                        </div>
                                        {filteredHistory.map(item => (
                                            <button
                                                key={item}
                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-text-muted hover:bg-app-surface-accent hover:text-white text-left transition-colors"
                                                onClick={() => handleSearch(item)}
                                            >
                                                <Clock className="w-3.5 h-3.5 text-text-muted" />
                                                <span>{item}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <NavLink
                        to="/settings"
                        className={({ isActive }) => `
                            p-2 rounded-lg transition-colors
                            ${isActive ? 'text-brand-primary bg-brand-primary/10' : 'text-text-muted hover:text-white hover:bg-white/5'}
                        `}
                    >
                        <Settings size={20} />
                    </NavLink>
                </div>
            </header>

            {/* Main Content */}
            <main className={`flex-1 overflow-auto pt-16 ${isFullBleed ? '' : 'p-6 lg:p-8'}`}>
                <Outlet />
            </main>
        </div>
    );
}
