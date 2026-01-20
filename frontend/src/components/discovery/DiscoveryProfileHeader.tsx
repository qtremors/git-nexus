import { Users, User, Book, GitCommit } from 'lucide-react';
import type { UserProfile } from '../../api/client';

interface UserSidebarProps {
    userData: UserProfile;
    totalCommits?: number;
}

export function DiscoveryProfileHeader({ userData, totalCommits = 0 }: UserSidebarProps) {
    return (
        <div className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-blue-500 rounded-full opacity-75 blur-sm group-hover:opacity-100 transition duration-200"></div>
                    <img
                        src={userData.avatar_url}
                        alt={userData.login}
                        className="relative w-24 h-24 rounded-full border-2 border-[#0d1117] bg-[#0d1117]"
                    />
                </div>

                <div className="flex-1 min-w-0 pt-1">
                    <h2 className="text-2xl font-bold text-blue-500 hover:underline cursor-pointer">
                        {userData.name || userData.login}
                    </h2>
                    <p className="text-slate-400 font-medium text-sm mb-3">@{userData.login}</p>
                    <p className="text-slate-300 text-sm mb-4 leading-relaxed max-w-2xl">{userData.bio || 'No bio available.'}</p>

                    <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
                        <div className="flex items-center gap-2 hover:text-white transition-colors cursor-default">
                            <Users className="w-4 h-4" />
                            <span className="font-semibold text-white">{userData.followers}</span> followers
                        </div>
                        <div className="flex items-center gap-2 hover:text-white transition-colors cursor-default">
                            <User className="w-4 h-4" />
                            <span className="font-semibold text-white">{userData.following}</span> following
                        </div>
                        <div className="flex items-center gap-2 hover:text-white transition-colors cursor-default">
                            <Book className="w-4 h-4" />
                            <span className="font-semibold text-white">{userData.public_repos}</span> public repos
                        </div>
                        {totalCommits > 0 && (
                            <>
                                <div className="hidden md:block w-px h-4 bg-slate-700 mx-2" />
                                <div className="flex items-center gap-2 hover:text-white transition-colors cursor-default">
                                    <GitCommit className="w-4 h-4" />
                                    <span className="font-semibold text-white">{totalCommits}</span> commits (public)
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
