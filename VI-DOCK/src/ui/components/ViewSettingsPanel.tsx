import { useDockingStore } from '../../store/dockingStore';
import '../styles/ViewSettingsPanel.css';

export function ViewSettingsPanel() {
    const { showGrid, showAxes, showBox, toggleVisual } = useDockingStore();

    return (
        <div className="view-settings-panel">
            <div className="settings-header">
                <h4>Viewport Layers</h4>
            </div>

            <div className="settings-content">
                {/* Visual Toggles */}
                <div className="setting-item">
                    <span className="setting-label">Grid</span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={showGrid}
                            onChange={() => toggleVisual('grid')}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>

                <div className="setting-item">
                    <span className="setting-label">Axes (XYZ)</span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={showAxes}
                            onChange={() => toggleVisual('axes')}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>

                <div className="setting-item">
                    <span className="setting-label">Docking Box</span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={showBox}
                            onChange={() => toggleVisual('box')}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>
            </div>
        </div>
    );
}
