/**
 * RepoManager Component
 * 
 * Panel for adding local and remote repositories.
 * Appears as an overlay when triggered from WorktreeRail.
 */

import { useState } from 'react';
import { useApp } from '../../store';
import './RepoManager.css';

interface RepoManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function RepoManager({ isOpen, onClose }: RepoManagerProps) {
    const { addLocalRepo, cloneRepo } = useApp();

    const [activeTab, setActiveTab] = useState<'local' | 'remote'>('local');
    const [localPath, setLocalPath] = useState('');
    const [remoteUrl, setRemoteUrl] = useState('');
    const [remoteDest, setRemoteDest] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAddLocal = async () => {
        if (!localPath) return;
        setLoading(true);
        setError('');
        try {
            await addLocalRepo(localPath);
            setLocalPath('');
            onClose();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to add local repo';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleClone = async () => {
        if (!remoteUrl || !remoteDest) return;
        setLoading(true);
        setError('');
        try {
            await cloneRepo(remoteUrl, remoteDest);
            setRemoteUrl('');
            setRemoteDest('');
            onClose();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to clone repo';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="repo-manager-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
            <div className="repo-manager-panel" onClick={(e) => e.stopPropagation()}>
                <div className="repo-manager-panel__header">
                    <h3 className="repo-manager-panel__title">Add Repository</h3>
                    <button className="repo-manager-panel__close" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="repo-manager-panel__tabs">
                    <button
                        className={`tab-btn ${activeTab === 'local' ? 'active' : ''}`}
                        onClick={() => setActiveTab('local')}
                    >
                        Local
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'remote' ? 'active' : ''}`}
                        onClick={() => setActiveTab('remote')}
                    >
                        Clone Remote
                    </button>
                </div>

                <div className="repo-manager-panel__form">
                    {activeTab === 'local' ? (
                        <div className="form-column">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Absolute path to local repo"
                                value={localPath}
                                onChange={(e) => setLocalPath(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddLocal()}
                            />
                            <button
                                className="btn btn-primary full-width"
                                onClick={handleAddLocal}
                                disabled={loading || !localPath}
                            >
                                {loading ? 'Adding...' : 'Add Repository'}
                            </button>
                        </div>
                    ) : (
                        <div className="form-column">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Git URL (https://...)"
                                value={remoteUrl}
                                onChange={(e) => setRemoteUrl(e.target.value)}
                            />
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Destination Path"
                                value={remoteDest}
                                onChange={(e) => setRemoteDest(e.target.value)}
                            />
                            <button
                                className="btn btn-primary full-width"
                                onClick={handleClone}
                                disabled={loading || !remoteUrl || !remoteDest}
                            >
                                {loading ? 'Cloning...' : 'Clone Repository'}
                            </button>
                        </div>
                    )}
                    {error && <div className="error-text">{error}</div>}
                </div>
            </div>
        </div>
    );
}
