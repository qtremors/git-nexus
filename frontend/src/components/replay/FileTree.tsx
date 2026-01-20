/**
 * FileTree Component
 * 
 * Displays file structure for the selected repository.
 */

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../store';
import { getFileTree, type FileTreeNode } from '../../api/client';
import './FileTree.css';

interface TreeItemProps {
    node: FileTreeNode;
    depth: number;
}

function TreeItem({ node, depth }: TreeItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpand = () => {
        if (node.type === 'directory') {
            setIsExpanded(!isExpanded);
        }
    };

    const icon = node.type === 'directory'
        ? (isExpanded ? 'folder_open' : 'folder')
        : 'description';

    return (
        <div className="tree-item">
            <div
                className={`tree-item__row ${node.type}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={toggleExpand}
            >
                <span className={`material-symbols-outlined tree-item__icon ${node.type}`}>
                    {icon}
                </span>
                <span className="tree-item__name">{node.name}</span>
            </div>

            {node.type === 'directory' && isExpanded && node.children && (
                <div className="tree-item__children">
                    {node.children.map(child => (
                        <TreeItem key={child.path} node={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

export function FileTree() {
    const { selectedRepoId, selectedCommitHash, replayRepos } = useApp();
    const [tree, setTree] = useState<FileTreeNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadTree = useCallback(async () => {
        if (!selectedRepoId) return;

        setLoading(true);
        setError('');
        try {
            // Load tree for selected commit, or HEAD if none selected
            const commit = selectedCommitHash || 'HEAD';
            const data = await getFileTree(selectedRepoId, commit);
            setTree(data);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to load file tree';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [selectedRepoId, selectedCommitHash]);

    useEffect(() => {
        loadTree();
    }, [loadTree]);

    const selectedRepo = replayRepos.find(r => r.id === selectedRepoId);

    if (!selectedRepoId) {
        return (
            <div className="file-tree">
                <div className="file-tree__header">
                    <h3 className="file-tree__title">Files</h3>
                </div>
                <div className="file-tree__empty text-muted">
                    Select a repository
                </div>
            </div>
        );
    }

    return (
        <div className="file-tree">
            <div className="file-tree__header">
                <h3 className="file-tree__title">
                    {selectedRepo?.name || 'Files'}
                </h3>
            </div>

            {loading && (
                <div className="file-tree__loading text-muted">
                    Loading...
                </div>
            )}

            {error && (
                <div className="file-tree__error error-text">
                    {error}
                </div>
            )}

            {!loading && !error && tree.length === 0 && (
                <div className="file-tree__empty text-muted">
                    No files found
                </div>
            )}

            {!loading && !error && tree.length > 0 && (
                <div className="file-tree__content">
                    {tree.map(node => (
                        <TreeItem key={node.path} node={node} depth={0} />
                    ))}
                </div>
            )}
        </div>
    );
}
