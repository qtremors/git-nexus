/**
 * WorktreeRail Component
 * 
 * Vertical icon rail for repository selection. Shows compact icons
 * for each repo with an add button at the top and delete on right-click.
 */

import { useState } from 'react';
import { useApp } from '../../store';
import './WorktreeRail.css';

interface WorktreeRailProps {
    onAddClick: () => void;
}

export function WorktreeRail({ onAddClick }: WorktreeRailProps) {
    const { replayRepos, selectedRepoId, selectRepo, deleteReplayRepo } = useApp();
    const [contextMenuId, setContextMenuId] = useState<number | null>(null);

    // Generate initials from repo name
    const getInitials = (name: string): string => {
        const parts = name.split(/[-_\s]+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const handleContextMenu = (e: React.MouseEvent, repoId: number) => {
        e.preventDefault();
        setContextMenuId(repoId);
    };

    const handleDelete = async (repoId: number) => {
        if (confirm('Remove this repository from the list?')) {
            await deleteReplayRepo(repoId);
        }
        setContextMenuId(null);
    };

    const closeContextMenu = () => {
        setContextMenuId(null);
    };

    return (
        <div className="worktree-rail" onClick={closeContextMenu}>
            <button
                className="worktree-rail__add-btn"
                onClick={onAddClick}
                title="Add Repository"
            >
                <span className="material-symbols-outlined">add</span>
            </button>

            <div className="worktree-rail__divider" />

            <div className="worktree-rail__list">
                {replayRepos.map(repo => (
                    <div key={repo.id} className="worktree-rail__item-wrapper">
                        <button
                            className={`worktree-rail__item ${selectedRepoId === repo.id ? 'active' : ''}`}
                            onClick={() => selectRepo(repo.id)}
                            onContextMenu={(e) => handleContextMenu(e, repo.id)}
                            title={`${repo.name}\n${repo.path}\n(Right-click to remove)`}
                        >
                            <span className="worktree-rail__initials">
                                {getInitials(repo.name)}
                            </span>
                        </button>

                        {contextMenuId === repo.id && (
                            <div className="worktree-rail__context-menu">
                                <button
                                    className="worktree-rail__context-item"
                                    onClick={() => handleDelete(repo.id)}
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                    Remove
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
