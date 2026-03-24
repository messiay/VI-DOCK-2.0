import { useState } from 'react';
import { useDockingStore } from '../../store/dockingStore';
import { 
    Settings, 
    Zap, 
    Droplets, 
    Clock, 
    Database,
    AlertCircle,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { config as apiConfig } from '../../config';
import { apiService } from '../../services/apiService';
import '../styles/MDPanel.css';

export function MDPanel() {
    const { 
        mdParams, 
        setMDParams, 
        receptorFile, 
        setStatusMessage,
        setRunning
    } = useDockingStore();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [taskStatus, setTaskStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
    const [error, setError] = useState<string | null>(null);

    // Guard: wait for Zustand persist rehydration
    if (!mdParams) return null;

    const handleRunMD = async () => {
        if (!receptorFile) {
            setError("Please upload a receptor file first.");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setTaskStatus('running');
        setStatusMessage("Initializing Molecular Dynamics...");

        try {
            // 0. Auto-create project and upload receptor to backend
            const timestamp = new Date().getTime();
            const projectName = `MD_Sim_${timestamp}`;
            
            setStatusMessage("Creating backend project...");
            await apiService.createProject(projectName);
            
            setStatusMessage("Uploading receptor to Colab...");
            const receptorBlob = new Blob([receptorFile.content], { type: 'text/plain' });
            const receptorFileObj = new File([receptorBlob], receptorFile.name, { type: 'text/plain' });
            await apiService.uploadFile(projectName, receptorFileObj, 'receptor');

            // 1. Submit Job to Colab Backend
            const response = await fetch(`${apiConfig.API_BASE_URL}/md/${projectName}/run`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Bypass-Tunnel-Reminder': 'true' 
                },
                body: JSON.stringify({
                    pdb_file: receptorFile.name,
                    forcefield: mdParams.forcefield,
                    // Avoid redundancy conflict if using -all forcefield
                    water_model: mdParams.forcefield.includes('-all') ? '' : mdParams.waterModel,
                    solvate: mdParams.solvate,
                    add_ions: mdParams.addIons,
                    temp_k: mdParams.tempK,
                    simulation_time_ns: mdParams.simulationTimeNs,
                    report_interval_ps: mdParams.reportIntervalPs,
                    minimize: mdParams.minimize
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Failed to submit MD job");
            }

            const data = await response.json();
            setRunning(true);
            
            // 2. Start polling for status
            pollStatus(data.job_id);

        } catch (err: any) {
            setError(err.message);
            setTaskStatus('failed');
            setRunning(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const pollStatus = async (id: string) => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${apiConfig.API_BASE_URL}/md/jobs/${id}`, {
                    headers: { 'Bypass-Tunnel-Reminder': 'true' }
                });
                const data = await res.json();

                if (data.status === 'completed') {
                    setTaskStatus('completed');
                    setRunning(false);
                    setStatusMessage("MD Simulation Completed!");
                    clearInterval(interval);
                } else if (data.status === 'failed') {
                    setTaskStatus('failed');
                    setError(data.error);
                    setRunning(false);
                    clearInterval(interval);
                } else {
                    setStatusMessage(`MD Simulation: ${data.status}...`);
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 5000);
    };

    return (
        <div className="md-panel">
            <div className="panel-section">
                <h3 className="section-title"><Settings size={16} /> Forcefield Settings</h3>
                <div className="input-group">
                    <label>Forcefield</label>
                    <select 
                        value={mdParams.forcefield} 
                        onChange={(e) => setMDParams({ forcefield: e.target.value })}
                    >
                        <option value="amber14-all.xml">Amber14-SB</option>
                        <option value="charmm36.xml">CHARMM36</option>
                        <option value="amber99sb.xml">Amber99SB</option>
                    </select>
                </div>
                <div className="input-group">
                    <label>Water Model</label>
                    <select 
                        value={mdParams.waterModel} 
                        onChange={(e) => setMDParams({ waterModel: e.target.value })}
                    >
                        <option value="amber14/tip3p.xml">TIP3P</option>
                        <option value="amber14/tip3pfb.xml">TIP3P-FB</option>
                        <option value="amber14/spce.xml">SPC/E</option>
                    </select>
                </div>
            </div>

            <div className="panel-section">
                <h3 className="section-title"><Droplets size={16} /> Solvation & Ions</h3>
                <div className="checkbox-group">
                    <label>
                        <input 
                            type="checkbox" 
                            checked={mdParams.solvate} 
                            onChange={(e) => setMDParams({ solvate: e.target.checked })}
                        />
                        Solvate System (Water Box)
                    </label>
                </div>
                <div className="checkbox-group">
                    <label>
                        <input 
                            type="checkbox" 
                            checked={mdParams.addIons} 
                            onChange={(e) => setMDParams({ addIons: e.target.checked })}
                        />
                        Add Neutralizing Ions (NaCl)
                    </label>
                </div>
            </div>

            <div className="panel-section">
                <h3 className="section-title"><Clock size={16} /> Simulation Parameters</h3>
                <div className="input-grid">
                    <div className="input-group">
                        <label>Time (ns)</label>
                        <input 
                            type="number" 
                            value={mdParams.simulationTimeNs} 
                            step="0.1"
                            onChange={(e) => setMDParams({ simulationTimeNs: parseFloat(e.target.value) })}
                        />
                    </div>
                    <div className="input-group">
                        <label>Temp (K)</label>
                        <input 
                            type="number" 
                            value={mdParams.tempK} 
                            onChange={(e) => setMDParams({ tempK: parseFloat(e.target.value) })}
                        />
                    </div>
                </div>
                <div className="checkbox-group">
                    <label>
                        <input 
                            type="checkbox" 
                            checked={mdParams.minimize} 
                            onChange={(e) => setMDParams({ minimize: e.target.checked })}
                        />
                        Run Energy Minimization
                    </label>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {taskStatus === 'completed' && (
                <div className="success-banner">
                    <CheckCircle2 size={16} />
                    <span>Simulation complete. View results in History.</span>
                </div>
            )}

            <button 
                className={`run-button ${taskStatus === 'running' ? 'running' : ''}`}
                onClick={handleRunMD}
                disabled={isSubmitting || taskStatus === 'running'}
            >
                {taskStatus === 'running' ? (
                    <><Loader2 size={18} className="spin" /> Simulating...</>
                ) : (
                    <><Zap size={18} /> Launch MD Simulation</>
                )}
            </button>
            
            <p className="md-note">
                <Database size={12} /> Note: MD runs on Colab GPU. Results will appear in the results folder once finished.
            </p>
        </div>
    );
}
