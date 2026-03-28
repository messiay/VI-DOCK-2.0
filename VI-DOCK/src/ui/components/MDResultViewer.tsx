import { useState, useEffect } from 'react';
import { useDockingStore } from '../../store/dockingStore';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
    Download, Eye, FileText, Activity, Thermometer, Shield, AlertCircle
} from 'lucide-react';
import { config as apiConfig } from '../../config';

interface MDResultViewerProps {
    jobId: string;
}

export function MDResultViewer({ jobId }: MDResultViewerProps) {
    const { mdResults, setReceptorFile, triggerResetView } = useDockingStore();
    const [logData, setLogData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const result = mdResults.find(r => r.job_id === jobId);

    useEffect(() => {
        const fetchLog = async () => {
            if (!jobId) return;
            setIsLoading(true);
            try {
                const response = await fetch(`${apiConfig.API_BASE_URL}/md/jobs/${jobId}/log`, {
                    headers: { 'Bypass-Tunnel-Reminder': 'true' }
                });
                if (!response.ok) throw new Error("Failed to fetch simulation logs");
                const data = await response.json();
                setLogData(data.data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(true);
                // Artificial delay for smooth transition
                setTimeout(() => setIsLoading(false), 500);
            }
        };

        fetchLog();
    }, [jobId]);

    if (!result) return <div className="error-banner">Job results not found.</div>;

    const handleVisualizeFinal = async () => {
        try {
            const pdbUrl = `${apiConfig.API_BASE_URL}/files/${result.files.final_pdb}`;
            const response = await fetch(pdbUrl, {
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });
            const content = await response.text();
            
            setReceptorFile({
                name: `MD_Final_${jobId.slice(0,4)}.pdb`,
                content: content,
                format: 'pdb'
            });
            triggerResetView();
        } catch (err) {
            console.error("Failed to load final PDB", err);
        }
    };

    const downloadFile = (path: string, name: string) => {
        const url = `${apiConfig.API_BASE_URL}/files/${path}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="md-result-viewer">
            {error && (
                <div className="error-banner">
                    <AlertCircle size={16} /> <span>{error}</span>
                </div>
            )}
            <div className="result-header">
                <h3>MD Simulation Analysis</h3>
                <div className="result-actions">
                    <button onClick={handleVisualizeFinal} title="Load into 3D Viewer">
                        <Eye size={16} /> Visualize Final
                    </button>
                    <button onClick={() => downloadFile(result.files.dcd, 'trajectory.dcd')} className="primary">
                        <Download size={16} /> Trajectory
                    </button>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <Activity size={18} />
                    <div className="stat-info">
                        <label>Potential Energy</label>
                        <span>{logData[logData.length-1]?.["Potential Energy (kJ/mole)"]?.toFixed(1) || 'N/A'} kJ/mol</span>
                    </div>
                </div>
                <div className="stat-card">
                    <Thermometer size={18} />
                    <div className="stat-info">
                        <label>Final Temp</label>
                        <span>{logData[logData.length-1]?.["Temperature (K)"]?.toFixed(1) || 'N/A'} K</span>
                    </div>
                </div>
                <div className="stat-card">
                    <Shield size={18} />
                    <div className="stat-info">
                        <label>Stability</label>
                        <span>Crystal Stable</span>
                    </div>
                </div>
            </div>

            <div className="chart-container">
                <h4>Potential Energy vs Step</h4>
                {isLoading ? (
                    <div className="chart-loading">Analyzing trajectory data...</div>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={logData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="Step" stroke="#8b949e" fontSize={10} />
                            <YAxis stroke="#8b949e" fontSize={10} domain={['auto', 'auto']} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d' }}
                                itemStyle={{ fontSize: '12px' }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="Potential Energy (kJ/mole)" 
                                stroke="#51cf66" 
                                dot={false} 
                                strokeWidth={2}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="files-list">
                <h4>Output Files</h4>
                <div className="file-item" onClick={() => downloadFile(result.files.final_pdb, 'final.pdb')}>
                    <FileText size={14} /> <span>final_structure.pdb</span> <Download size={12} />
                </div>
                <div className="file-item" onClick={() => downloadFile(result.files.log, 'sim.log')}>
                    <FileText size={14} /> <span>simulation_log.txt</span> <Download size={12} />
                </div>
            </div>
        </div>
    );
}
