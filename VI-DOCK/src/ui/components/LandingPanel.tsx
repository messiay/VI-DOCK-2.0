import { useDockingStore } from '../../store/dockingStore';
import { ArrowRight, TestTube2, Layers } from 'lucide-react';
import '../styles/LandingPanel.css';

export function LandingPanel() {
    const { setActiveTab } = useDockingStore();

    return (
        <div className="landing-overlay">
            <div className="landing-content">

                {/* Header */}
                <div className="landing-header">
                    <div className="logo-badge">
                        <img src="/logo.png" alt="VIDocks Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
                    </div>
                    <h1>VIDocks <span className="pro-tag">Pro</span></h1>
                    <p className="subtitle">High-Performance Cloud-Powered Molecular Docking</p>
                </div>

                {/* Mode Selection Cards */}
                <div className="mode-grid">

                    {/* Single Docking Card */}
                    <div className="mode-card single" onClick={() => setActiveTab('prep')}>
                        <div className="card-bg"></div>
                        <div className="card-icon">
                            <TestTube2 size={40} />
                        </div>
                        <div className="card-info">
                            <h3>Single Docking</h3>
                            <p>Interactive single-ligand screening with real-time visualization.</p>
                        </div>
                        <div className="card-arrow">
                            <ArrowRight size={20} />
                        </div>
                    </div>

                    {/* Batch Docking Card */}
                    <div className="mode-card batch" onClick={() => setActiveTab('batch')}>
                        <div className="card-bg"></div>
                        <div className="card-icon">
                            <Layers size={40} />
                        </div>
                        <div className="card-info">
                            <h3>Batch Docking</h3>
                            <p>High-throughput M × N screening for library validation.</p>
                        </div>
                        <div className="card-arrow">
                            <ArrowRight size={20} />
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="landing-footer">
                    <span className="version">v3.1.0</span>
                </div>

            </div>
        </div>
    );
}
