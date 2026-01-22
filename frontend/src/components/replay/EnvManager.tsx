import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, RotateCcw, Box, GitBranch, Globe } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import * as API from '../../api/client';
import type { EnvVar, EnvVarUpdate } from '../../api/client';

export type EnvScope = 'global' | 'project' | 'commit';

interface EnvManagerProps {
    isOpen: boolean;
    onClose: () => void;
    scope: EnvScope;
    repoId?: number;
    commitHash?: string;
    title?: string;
}

export function EnvManager({ isOpen, onClose, scope, repoId, commitHash, title }: EnvManagerProps) {
    const { showToast } = useToast();
    // const [vars, setVars] = useState<EnvVar[]>([]); // Future use for diffing?
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Edit state
    const [edits, setEdits] = useState<EnvVarUpdate[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadVars();
        } else {
            // Reset state on close
            // setVars([]);
            setEdits([]);
            setHasChanges(false);
        }
    }, [isOpen, scope, repoId, commitHash]);

    const loadVars = async () => {
        setLoading(true);
        try {
            let data: EnvVar[] = [];
            if (scope === 'global') {
                data = await API.getGlobalVars();
            } else if (scope === 'project' && repoId) {
                data = await API.getProjectVars(repoId);
            } else if (scope === 'commit' && repoId && commitHash) {
                data = await API.getCommitVars(repoId, commitHash);
            }

            // setVars(data);
            // Initialize edits with current values
            setEdits(data.map(v => ({ key: v.key, value: v.value })));
            setHasChanges(false);
        } catch {
            showToast('Failed to load environment variables', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Guard: validate required identifiers based on scope
        if (scope === 'project' && !repoId) {
            showToast('Cannot save: project ID is missing', 'error');
            return;
        }
        if (scope === 'commit' && (!repoId || !commitHash)) {
            showToast('Cannot save: repository or commit information is missing', 'error');
            return;
        }

        setSaving(true);
        try {
            // Filter out empty keys
            const valid = edits.filter(v => v.key.trim() !== '');
            const finalVars = valid.map(v => ({ key: v.key.trim(), value: v.value }));

            if (scope === 'global') {
                await API.setGlobalVars(finalVars);
            } else if (scope === 'project' && repoId) {
                await API.setProjectVars(repoId, finalVars);
            } else if (scope === 'commit' && repoId && commitHash) {
                await API.setCommitVars(repoId, commitHash, finalVars);
            }

            showToast('Environment variables saved', 'success');
            onClose();
        } catch {
            showToast('Failed to save variables', 'error');
        } finally {
            setSaving(false);
        }
    };

    const addVar = () => {
        setEdits([...edits, { key: '', value: '' }]);
        setHasChanges(true);
    };

    const removeVar = (index: number) => {
        const newEdits = [...edits];
        newEdits.splice(index, 1);
        setEdits(newEdits);
        setHasChanges(true);
    };

    const updateVar = (index: number, field: 'key' | 'value', val: string) => {
        const newEdits = [...edits];
        newEdits[index] = { ...newEdits[index], [field]: val };
        setEdits(newEdits);
        setHasChanges(true);
    };

    // UI Helpers
    const getScopeIcon = () => {
        if (scope === 'global') return <Globe className="text-blue-400" size={20} />;
        if (scope === 'project') return <Box className="text-orange-400" size={20} />;
        return <GitBranch className="text-purple-400" size={20} />;
    };

    const getScopeDescription = () => {
        if (scope === 'global') return "These variables apply to ALL servers unless overridden.";
        if (scope === 'project') return "These variables apply to all commits in this project.";
        return "These variables apply ONLY to this specific commit.";
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2">
                    {getScopeIcon()}
                    <span>{title || 'Environment Variables'}</span>
                </div> as unknown as string // Modal title expects string but renders node fine usually, or we need to adjust Modal
            }
            footer={(
                <>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? <RotateCcw className="animate-spin" size={16} /> : <Save size={16} />}
                        Save Changes
                    </button>
                </>
            )}
        >
            <div className="space-y-4 min-h-[300px] flex flex-col">
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-sm text-slate-400 flex gap-2">
                    <div className="mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /></div>
                    <p>{getScopeDescription()}</p>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[400px] space-y-2 pr-2">
                    {loading ? (
                        <div className="flex justify-center py-8 text-slate-500">
                            <RotateCcw className="animate-spin" size={24} />
                        </div>
                    ) : edits.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                            <Box size={32} className="opacity-20 mb-2" />
                            <p>No variables defined</p>
                        </div>
                    ) : (
                        edits.map((v, idx) => (
                            <div key={idx} className="flex items-center gap-2 group">
                                <input
                                    type="text"
                                    placeholder="KEY"
                                    value={v.key}
                                    onChange={(e) => updateVar(idx, 'key', e.target.value)}
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-blue-300 placeholder-slate-600 focus:border-blue-500 outline-none font-mono uppercase"
                                />
                                <span className="text-slate-600">=</span>
                                <input
                                    type="text"
                                    placeholder="Value"
                                    value={v.value}
                                    onChange={(e) => updateVar(idx, 'value', e.target.value)}
                                    className="flex-[1.5] bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:border-blue-500 outline-none font-mono"
                                />
                                <button
                                    onClick={() => removeVar(idx)}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-all"
                                    title="Remove variable"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <button
                    onClick={addVar}
                    className="w-full py-2 border border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <Plus size={16} /> Add Variable
                </button>
            </div>
        </Modal>
    );
}
