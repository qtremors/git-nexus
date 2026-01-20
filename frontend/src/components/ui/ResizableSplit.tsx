import React, { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

interface ResizableSplitProps {
    isVertical?: boolean;
    initialSize?: number | 'auto'; // Percentage (0-100) or 'auto'
    minSize?: number; // Percentage
    maxSize?: number; // Percentage
    firstChild: ReactNode;
    secondChild: ReactNode;
    gutterSize?: number;
    className?: string;
}

export function ResizableSplit({
    isVertical = false,
    initialSize = 50,
    minSize = 10,
    maxSize = 90,
    firstChild,
    secondChild,
    gutterSize = 6,
    className = ''
}: ResizableSplitProps) {
    // State to track percentage size. If null, it means "auto".
    const [size, setSize] = useState<number | null>(initialSize === 'auto' ? null : initialSize as number);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const firstChildRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();

        // If currently auto, snap to current percentage before starting drag
        if (size === null && containerRef.current && firstChildRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const childRect = firstChildRef.current.getBoundingClientRect();
            const totalSize = isVertical ? containerRect.height : containerRect.width;
            const currentSize = isVertical ? childRect.height : childRect.width;

            if (totalSize > 0) {
                const currentPct = (currentSize / totalSize) * 100;
                setSize(currentPct);
            }
        }

        setIsDragging(true);
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();

            let newSize;
            if (isVertical) {
                // Vertical split: resizing height
                const relativeY = e.clientY - rect.top;
                newSize = (relativeY / rect.height) * 100;
            } else {
                // Horizontal split: resizing width
                const relativeX = e.clientX - rect.left;
                newSize = (relativeX / rect.width) * 100;
            }

            // Clamp
            if (newSize < minSize) newSize = minSize;
            if (newSize > maxSize) newSize = maxSize;

            setSize(newSize);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isVertical, minSize, maxSize]);

    // Style generation
    const firstStyle = size === null
        ? { [isVertical ? 'height' : 'width']: 'auto' }
        : { [isVertical ? 'height' : 'width']: `${size}%` };

    const secondStyle = size === null
        ? { flex: 1 }
        : { [isVertical ? 'height' : 'width']: `${100 - size}%` };

    return (
        <div
            ref={containerRef}
            className={`relative flex ${isVertical ? 'flex-col' : 'flex-row'} w-full h-full overflow-hidden ${className}`}
        >
            {/* First Child */}
            <div
                ref={firstChildRef}
                style={firstStyle}
                className={`relative min-w-0 min-h-0 overflow-hidden ${size === null ? 'flex-shrink-0' : ''}`}
            >
                {firstChild}
            </div>

            {/* Gutter (Handle) */}
            <div
                className={`flex-shrink-0 z-10 transition-colors duration-150 ${isDragging ? 'bg-blue-600' : 'bg-transparent hover:bg-blue-500/50'
                    } ${isVertical
                        ? 'h-[6px] w-full cursor-row-resize -my-[3px]'
                        : 'w-[6px] h-full cursor-col-resize -mx-[3px]'
                    }`}
                onMouseDown={handleMouseDown}
                style={{ flexBasis: gutterSize, pointerEvents: 'auto' }}
            />

            {/* Second Child */}
            <div style={secondStyle} className="relative min-w-0 min-h-0 overflow-hidden flex-1">
                {secondChild}
            </div>
        </div>
    );
}
