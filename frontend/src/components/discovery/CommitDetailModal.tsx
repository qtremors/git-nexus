import { X, GitCommit, Calendar, User, ExternalLink } from 'lucide-react';
import type { GitHubCommit } from '../../api/client';


interface CommitDetailModalProps {
    commit: GitHubCommit | null;
    onClose: () => void;
}

export function CommitDetailModal({ commit, onClose }: CommitDetailModalProps) {
    if (!commit) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-[#0d1117] border border-slate-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <GitCommit className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-200">Commit Details</h3>
                            <p className="text-xs text-slate-500 font-mono">{commit.sha}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Message */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Message</h4>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {commit.commit.message}
                        </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-900/30 border border-slate-800/50 rounded-lg p-3 flex items-start gap-3">
                            <User className="w-4 h-4 text-slate-400 mt-1" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">Author</p>
                                <p className="text-slate-300">{commit.commit.author.name}</p>
                            </div>
                        </div>

                        <div className="bg-slate-900/30 border border-slate-800/50 rounded-lg p-3 flex items-start gap-3">
                            <Calendar className="w-4 h-4 text-slate-400 mt-1" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">Date</p>
                                <p className="text-slate-300">{new Date(commit.commit.author.date).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Close
                    </button>
                    <a
                        href={commit.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                    >
                        View on GitHub <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>
        </div>
    );
}
