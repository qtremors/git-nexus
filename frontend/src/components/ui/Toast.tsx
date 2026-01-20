/**
 * Toast Component
 * 
 * Shared toast notification system using React Context.
 */

import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

// --- Types ---

type ToastType = 'success' | 'error' | 'neutral';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void;
}

// --- Context ---

const ToastContext = createContext<ToastContextValue | null>(null);

// --- Provider ---

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'neutral') => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    const dismissToast = (id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`
              animate-in px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 backdrop-blur-md
              ${toast.type === 'success'
                                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                                : toast.type === 'error'
                                    ? 'bg-red-950/80 border-red-500/50 text-red-200'
                                    : 'bg-slate-800/80 border-slate-700 text-slate-200'
                            }
            `}
                    >
                        {toast.type === 'success' && <CheckCircle2 size={18} />}
                        {toast.type === 'error' && <AlertCircle size={18} />}
                        {toast.type === 'neutral' && <AlertCircle size={18} />}
                        <span className="text-sm font-medium">{toast.message}</span>
                        <button
                            onClick={() => dismissToast(toast.id)}
                            className="ml-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// --- Hook ---

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
