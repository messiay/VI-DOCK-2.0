import { useState } from 'react';
import { useDockingStore } from '../../store/dockingStore';
import '../styles/VinaOptionsPanel.css';

export function VinaOptionsPanel() {
    const { params, setParams } = useDockingStore();
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showMisc, setShowMisc] = useState(false);

    const handleChange = (field: string, value: string | number | boolean) => {
        if (typeof value === 'string') {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                setParams({ [field]: numValue });
            }
        } else {
            setParams({ [field]: value });
        }
    };

    return (
        <div className="vina-options-panel">
            <h3 className="panel-title">
                <span className="title-icon">⚙️</span>
                Vina Parameters
            </h3>

            <div className="options-grid">
                <div className="option-item">
                    <label>CPU(s)</label>
                    <input
                        type="number"
                        min="1"
                        max={navigator.hardwareConcurrency || 8}
                        value={params.cpus}
                        onChange={(e) => handleChange('cpus', e.target.value)}
                    />
                    <span className="option-hint">Max: {navigator.hardwareConcurrency || 8}</span>
                </div>

                <div className="option-item">
                    <label>Exhaustiveness</label>
                    <input
                        type="number"
                        min="1"
                        max="32"
                        value={params.exhaustiveness}
                        onChange={(e) => handleChange('exhaustiveness', e.target.value)}
                    />
                    <span className="option-hint">Default: 8</span>
                </div>
            </div>

            {/* Advanced Options */}
            <div className="collapsible-section">
                <button
                    className="section-toggle"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                >
                    <span>Advanced Parameters</span>
                    <span className="toggle-icon">{showAdvanced ? '▼' : '▶'}</span>
                </button>

                {showAdvanced && (
                    <div className="section-content">
                        <div className="checkbox-option">
                            <input
                                type="checkbox"
                                id="localOnly"
                                checked={params.localOnly}
                                onChange={(e) => handleChange('localOnly', e.target.checked)}
                            />
                            <label htmlFor="localOnly">Local search only</label>
                        </div>

                        <div className="checkbox-option">
                            <input
                                type="checkbox"
                                id="scoreOnly"
                                checked={params.scoreOnly}
                                onChange={(e) => handleChange('scoreOnly', e.target.checked)}
                            />
                            <label htmlFor="scoreOnly">Score only (no docking)</label>
                        </div>

                        <div className="checkbox-option">
                            <input
                                type="checkbox"
                                id="randomizeInput"
                                checked={params.randomizeInput}
                                onChange={(e) => handleChange('randomizeInput', e.target.checked)}
                            />
                            <label htmlFor="randomizeInput">Randomize input</label>
                        </div>
                    </div>
                )}
            </div>

            {/* Misc Options */}
            <div className="collapsible-section">
                <button
                    className="section-toggle"
                    onClick={() => setShowMisc(!showMisc)}
                >
                    <span>Output Parameters</span>
                    <span className="toggle-icon">{showMisc ? '▼' : '▶'}</span>
                </button>

                {showMisc && (
                    <div className="section-content">
                        <div className="option-item">
                            <label>Random Seed</label>
                            <input
                                type="number"
                                placeholder="Auto"
                                value={params.seed ?? ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setParams({ seed: val === '' ? null : parseInt(val, 10) });
                                }}
                            />
                        </div>

                        <div className="option-item">
                            <label>Binding Modes</label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={params.numModes}
                                onChange={(e) => handleChange('numModes', e.target.value)}
                            />
                        </div>

                        <div className="option-item">
                            <label>Energy Range (kcal/mol)</label>
                            <input
                                type="number"
                                min="1"
                                step="0.5"
                                value={params.energyRange}
                                onChange={(e) => handleChange('energyRange', e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
