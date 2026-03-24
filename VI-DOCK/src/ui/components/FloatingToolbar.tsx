import { useState } from 'react';
import { useDockingStore } from '../../store/dockingStore';
import { useUserStore } from '../../store/userStore';
import { projectService } from '../../services/projectService';
import { Dna, Network, RotateCcw, BoxSelect, Save } from 'lucide-react';
import '../styles/FloatingToolbar.css';

export function FloatingToolbar() {
    const { viewMode, setViewMode, triggerResetView, receptorFile, ligandFile, params, result } = useDockingStore();
    const { currentUser } = useUserStore();
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [missionName, setMissionName] = useState('');

    const handleSaveClick = () => {
        // Removed login check
        if (!receptorFile && !ligandFile) {
            alert('Nothing to save! Import molecules first.');
            return;
        }
        setMissionName(`Mission ${new Date().toLocaleTimeString()}`);
        setShowSaveModal(true);
    };

    const confirmSave = async () => {
        if (!missionName) return;

        console.info('[SimDock] Attempting to save mission:', missionName);

        try {
            await projectService.saveProject({
                id: (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
                name: missionName,
                username: currentUser || 'Local Researcher',
                timestamp: Date.now(),
                data: {
                    receptorFile,
                    ligandFile,
                    params,
                    result,
                    viewMode
                }
            });
            setShowSaveModal(false);
            console.info('[SimDock] Mission saved successfully!');
            alert('Mission saved successfully!');
        } catch (e) {
            console.error('[SimDock] Save failed:', e);
            alert('Failed to save mission.');
        }
    };

    return (
        <>
            {showSaveModal && (
                <div className="save-modal-overlay">
                    <div className="save-modal">
                        <h3>Save Mission Log</h3>
                        <input
                            type="text"
                            value={missionName}
                            onChange={(e) => setMissionName(e.target.value)}
                            placeholder="Mission Name"
                            autoFocus
                        />
                        <div className="save-modal-actions">
                            <button onClick={() => setShowSaveModal(false)}>Cancel</button>
                            <button className="confirm-btn" onClick={confirmSave}>Save Log</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="floating-toolbar">
                <div className="toolbar-group">
                    <button
                        className={`tool-btn ${viewMode === 'cartoon' ? 'active' : ''}`}
                        onClick={() => setViewMode('cartoon')}
                        title="Cartoon Representation"
                    >
                        <span className="icon"><Dna size={18} /></span>
                        <span className="label">Cartoon</span>
                    </button>
                    <button
                        className={`tool-btn ${viewMode === 'sticks' ? 'active' : ''}`}
                        onClick={() => setViewMode('sticks')}
                        title="Sticks Representation"
                    >
                        <span className="icon"><Network size={18} /></span>
                        <span className="label">Sticks</span>
                    </button>
                    <button
                        className={`tool-btn ${viewMode === 'surface' ? 'active' : ''}`}
                        onClick={() => setViewMode('surface')}
                        title="Surface Representation"
                    >
                        <span className="icon"><BoxSelect size={18} /></span>
                        <span className="label">Surface</span>
                    </button>
                </div>

                <div className="divider"></div>

                <div className="toolbar-group">
                    <button
                        className="tool-btn"
                        onClick={handleSaveClick}
                        title="Save Mission"
                    >
                        <span className="icon"><Save size={18} /></span>
                        <span className="label">Save</span>
                    </button>


                    <button
                        className="tool-btn"
                        onClick={() => triggerResetView()}
                        title="Reset Camera View"
                    >
                        <span className="icon"><RotateCcw size={18} /></span>
                        <span className="label">Reset</span>
                    </button>
                </div>
            </div>
        </>
    );
}
