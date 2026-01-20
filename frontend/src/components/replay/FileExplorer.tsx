import {
    Folder,
    FolderOpen,
    FileCode,
    FileJson,
    FileType,
    ChevronRight,
    Loader2
} from 'lucide-react';
import type { FileTreeNode } from '../../types';

// --- File Node Component ---
interface FileNodeItemProps {
    node: FileTreeNode;
    level: number;
    expandedPaths: Set<string>;
    onToggle: (path: string) => void;
    onFileClick?: (node: FileTreeNode) => void;
}

function FileNodeItem({ node, level, expandedPaths, onToggle, onFileClick }: FileNodeItemProps) {
    const isOpen = expandedPaths.has(node.path);
    const isMarkdown = node.name.endsWith('.md');

    const getIcon = (name: string, type: string) => {
        if (type === 'directory') return isOpen ? <FolderOpen size={16} className="text-blue-400" /> : <Folder size={16} className="text-blue-400" />;
        if (name.endsWith('.tsx') || name.endsWith('.ts')) return <FileCode size={16} className="text-cyan-400" />;
        if (name.endsWith('.css') || name.endsWith('.scss')) return <FileType size={16} className="text-purple-400" />;
        if (name.endsWith('.json')) return <FileJson size={16} className="text-yellow-400" />;
        if (name.endsWith('.md')) return <FileType size={16} className="text-slate-400" />;
        return <FileType size={16} className="text-slate-500" />;
    };

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-2 py-1.5 px-2 cursor-pointer text-sm transition-colors border-l-2 ${node.type === 'directory'
                    ? 'text-slate-300 hover:bg-slate-800 border-transparent hover:border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-transparent'
                    }`}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={() => {
                    if (node.type === 'directory') {
                        onToggle(node.path);
                    } else if (isMarkdown && onFileClick) {
                        onFileClick(node);
                    }
                }}
            >
                {node.type === 'directory' && (
                    <ChevronRight size={14} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                )}
                {getIcon(node.name, node.type)}
                <span className="truncate">{node.name}</span>
                {node.size && <span className="ml-auto text-xs text-slate-600">{(node.size / 1024).toFixed(1)}KB</span>}
            </div>
            {isOpen && node.children && (
                <div>
                    {node.children.map((child, idx) => (
                        <FileNodeItem
                            key={node.path + child.name + idx}
                            node={child}
                            level={level + 1}
                            expandedPaths={expandedPaths}
                            onToggle={onToggle}
                            onFileClick={onFileClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// --- Main Explorer Component ---
interface FileExplorerProps {
    fileTree: FileTreeNode[];
    loading: boolean;
    selectedCommitHash: string | null;
    hasActiveRepo: boolean;
    expandedPaths: Set<string>;
    onTogglePath: (path: string) => void;
    onFileClick?: (node: FileTreeNode) => void;
}

export function FileExplorer({
    fileTree,
    loading,
    selectedCommitHash,
    hasActiveRepo,
    expandedPaths,
    onTogglePath,
    onFileClick
}: FileExplorerProps) {
    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    Files
                    {selectedCommitHash && (
                        <span className="font-mono normal-case text-slate-400 px-1.5 rounded border border-slate-700 text-[10px]">
                            {selectedCommitHash.substring(0, 7)}
                        </span>
                    )}
                </span>
                {loading && <Loader2 size={12} className="animate-spin text-slate-500" />}
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
                {hasActiveRepo ? (
                    fileTree.length > 0 ? (
                        fileTree.map((node, idx) => (
                            <FileNodeItem
                                key={node.path + idx}
                                node={node}
                                level={0}
                                expandedPaths={expandedPaths}
                                onToggle={onTogglePath}
                                onFileClick={onFileClick}
                            />
                        ))
                    ) : loading ? (
                        <div className="px-4 text-slate-500 text-xs text-center py-4">
                            Loading files...
                        </div>
                    ) : (
                        <div className="px-4 text-slate-500 text-xs text-center py-4">
                            No files found
                        </div>
                    )
                ) : (
                    <div className="px-4 text-slate-500 text-xs text-center py-4">
                        Select a worktree to view files
                    </div>
                )}
            </div>
        </div>
    );
}
