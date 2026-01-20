import { Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useState } from 'react';

// --- Add Repo Modal ---
interface AddRepoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (path: string) => void;
}

export function AddRepoModal({ isOpen, onClose, onAdd }: AddRepoModalProps) {
    const [path, setPath] = useState('');

    const handleAdd = () => {
        if (path.trim()) {
            onAdd(path);
            setPath('');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Add Worktree"
            footer={(
                <>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAdd}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-900/20"
                    >
                        Add Worktree
                    </button>
                </>
            )}
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Local Path</label>
                    <input
                        type="text"
                        placeholder="e.g., C:\dev\my-project"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAdd();
                        }}
                    />
                    <p className="text-xs text-slate-500 mt-2">
                        Enter the full path to a local git repository.
                    </p>
                </div>
            </div>
        </Modal>
    );
}

// --- Delete Repo Modal ---
interface DeleteRepoModalProps {
    isOpen: boolean;
    repoName: string;
    onClose: () => void;
    onConfirm: () => void;
}

export function DeleteRepoModal({ isOpen, repoName, onClose, onConfirm }: DeleteRepoModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Remove Worktree"
            footer={(
                <>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-red-900/20 flex items-center gap-2"
                    >
                        <Trash2 size={16} />
                        Remove
                    </button>
                </>
            )}
        >
            <div className="text-slate-300">
                <p>Are you sure you want to remove <span className="font-semibold text-white">{repoName}</span> from the replay list?</p>
                <p className="text-sm text-slate-500 mt-2">
                    This will only remove it from GitNexus. The local files on disk will not be deleted.
                </p>
            </div>
        </Modal>
    );
}
