import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Box, Check, Trash2 } from 'lucide-react';
import type { ReplayRepo } from '../../api/client';

interface WorktreeListProps {
    repos: ReplayRepo[];
    selectedRepoId: number | null;
    onSelectRepo: (id: number) => void;
    onAddRepo: () => void;
    onDeleteRepo: (id: number, name: string) => void;
}

export function WorktreeList({ repos, selectedRepoId, onSelectRepo, onAddRepo, onDeleteRepo }: WorktreeListProps) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="flex flex-col border-b border-slate-800">
            <div className="px-3 py-2 flex items-center justify-between">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase hover:text-slate-300 transition-colors"
                >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Worktrees ({repos.length})
                </button>
                <button
                    onClick={onAddRepo}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    title="Add Repository"
                >
                    <Plus size={14} />
                </button>
            </div>

            {isOpen && (
                <div className="pb-2">
                    {repos.map(repo => (
                        <div
                            key={repo.id}
                            onClick={() => onSelectRepo(repo.id)}
                            className={`
                      group relative px-4 py-2 cursor-pointer flex items-center gap-3 border-l-2 transition-all
                      ${selectedRepoId === repo.id
                                    ? 'bg-slate-800 border-blue-500 text-slate-100'
                                    : 'border-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                                }
                    `}
                        >
                            <Box size={14} className="text-blue-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium truncate">{repo.name}</span>
                                    {selectedRepoId === repo.id && <Check size={12} className="text-blue-500" />}
                                </div>
                                <div className="text-[10px] text-slate-600 truncate font-mono mt-0.5">
                                    {repo.path}
                                </div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteRepo(repo.id, repo.name); }}
                                className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-all"
                                title="Remove"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}

                    {repos.length === 0 && (
                        <div className="px-4 py-3 text-slate-500 text-xs text-center">
                            No worktrees added yet
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
