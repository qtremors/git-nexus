/**
 * Badge Component
 * 
 * Reusable badge for status indicators and tags.
 */

import type { ReactNode } from 'react';

interface BadgeProps {
    children: ReactNode;
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'gray' | 'yellow' | 'slate';
    className?: string;
    onClick?: () => void;
}

const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    gray: 'bg-slate-700/50 text-slate-400 border-slate-600',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    slate: 'bg-slate-700/50 text-slate-300 border-slate-600',
};

export function Badge({ children, color = 'blue', className = '', onClick }: BadgeProps) {
    return (
        <span
            onClick={onClick}
            className={`
        px-2.5 py-0.5 rounded-full text-xs font-medium border
        ${colorClasses[color]}
        ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
        ${className}
      `}
        >
            {children}
        </span>
    );
}
