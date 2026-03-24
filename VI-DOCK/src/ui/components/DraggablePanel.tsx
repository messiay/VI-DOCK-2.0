import { useState, useRef, useEffect, type ReactNode } from 'react';
import '../styles/DraggablePanel.css';

interface DraggablePanelProps {
    title: string;
    children: ReactNode;
    initialX?: number;
    initialY?: number;
    width?: string;
    height?: string;
    onClose?: () => void;
    className?: string;
}

export function DraggablePanel({
    title,
    children,
    initialX = 100,
    initialY = 100,
    width = '400px',
    height = 'auto',
    onClose,
    className = ''
}: DraggablePanelProps) {
    const [position, setPosition] = useState({ x: initialX, y: initialY });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            let newX = e.clientX - dragOffset.x;
            let newY = e.clientY - dragOffset.y;

            const maxX = window.innerWidth - 50;
            const maxY = window.innerHeight - 50;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.cursor = 'default';
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'grabbing';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [isDragging, dragOffset]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    return (
        <div
            ref={panelRef}
            className={`draggable-panel ${className}`}
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: width,
                height: height
            }}
        >
            <div className="panel-header" onMouseDown={handleMouseDown}>
                <span className="panel-grip">⋮⋮</span>
                <span className="panel-title">{title}</span>
                {onClose && (
                    <button className="panel-close" onClick={onClose}>×</button>
                )}
            </div>

            {/* Scrollable content area with native scrollbars */}
            <div className="panel-content">
                {children}
            </div>
        </div>
    );
}

