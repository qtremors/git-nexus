import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    width?: string;
}

export function Modal({ isOpen, onClose, title, children, footer, width = 'max-w-md' }: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Use portal to render at body level to avoid z-index issues
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                ref={modalRef}
                className={`bg-[#161b22] border border-slate-700 w-full ${width} rounded-xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200`}
            >
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold text-white">{title}</h3>
                        <button
                            onClick={onClose}
                            className="text-slate-500 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div>
                        {children}
                    </div>

                    {footer && (
                        <div className="mt-8 flex justify-end gap-3">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
