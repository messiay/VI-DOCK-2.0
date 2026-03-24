import { useState, useRef, useEffect } from 'react';
import { useDockingStore } from '../../store/dockingStore';
import type { TabId } from '../../types';
import {
    TestTube2,
    ClipboardList,
    PlayCircle,
    BarChart3,
    Sun,
    Moon,
    RotateCcw,
    Database,
    ChevronLeft,
    ChevronRight,
    Layers,
    Activity
} from 'lucide-react';
import '../styles/Sidebar.css';

interface TabConfig {
    id: TabId;
    label: string;
    icon: React.ReactNode;
    disabled?: () => boolean;
}

export function Sidebar() {
    const { activeTab, setActiveTab, isRunning, result, startOver, theme, toggleTheme } = useDockingStore();
    const navRef = useRef<HTMLElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const tabs: TabConfig[] = [
        { id: 'prep', label: 'Molecule Import', icon: <TestTube2 size={20} /> },
        { id: 'input', label: 'Input Parameters', icon: <ClipboardList size={20} /> },
        { id: 'batch', label: 'Batch Mode', icon: <Layers size={20} /> },
        { id: 'md', label: 'Molecular Dynamics', icon: <Activity size={20} /> },
        { id: 'running', label: 'Running Docking', icon: <PlayCircle size={20} />, disabled: () => !isRunning },
        { id: 'output', label: 'Output', icon: <BarChart3 size={20} />, disabled: () => !result },
        { id: 'projects', label: 'Mission Log', icon: <Database size={20} /> },
    ];

    // Check if scrolling is possible
    useEffect(() => {
        const checkScroll = () => {
            if (navRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = navRef.current;
                setCanScrollLeft(scrollTop > 0);
                setCanScrollRight(scrollTop + clientHeight < scrollHeight - 5);
            }
        };

        checkScroll();
        navRef.current?.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll);

        return () => {
            navRef.current?.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, []);

    const scrollNav = (direction: 'up' | 'down') => {
        if (navRef.current) {
            const scrollAmount = 100;
            navRef.current.scrollBy({
                top: direction === 'down' ? scrollAmount : -scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1 className="app-logo">
                    <span className="logo-icon">
                        <img src="/logo.png" alt="VIDocks Logo" style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
                    </span>
                    <span className="logo-text">VIDocks</span>
                </h1>
                <p className="app-subtitle">Powered by High-Performance Computing</p>
            </div>

            {/* Scroll Up Button */}
            {canScrollLeft && (
                <button className="nav-scroll-btn scroll-up" onClick={() => scrollNav('up')}>
                    <ChevronLeft size={20} style={{ transform: 'rotate(90deg)' }} />
                </button>
            )}

            <nav className="sidebar-nav" ref={navRef}>
                {tabs.map((tab) => {
                    const isDisabled = tab.disabled?.() ?? false;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            className={`nav-tab ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                            onClick={() => !isDisabled && setActiveTab(tab.id)}
                            disabled={isDisabled}
                        >
                            <span className="tab-icon">{tab.icon}</span>
                            <span className="tab-label">{tab.label}</span>
                            {isActive && <span className="tab-indicator" />}
                        </button>
                    );
                })}
            </nav>

            {/* Scroll Down Button */}
            {canScrollRight && (
                <button className="nav-scroll-btn scroll-down" onClick={() => scrollNav('down')}>
                    <ChevronRight size={20} style={{ transform: 'rotate(90deg)' }} />
                </button>
            )}

            <div className="sidebar-footer">
                <button className="theme-toggle-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}>
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <div className="spacer" style={{ height: '10px' }} />
                <button className="start-over-btn" onClick={startOver}>
                    <RotateCcw size={16} style={{ marginRight: '8px' }} /> Start Over
                </button>
                <div className="footer-info">
                    <p>Powered by AutoDock Vina</p>
                </div>
            </div>
        </aside>
    );
}

