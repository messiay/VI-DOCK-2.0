import { useDockingStore } from '../../store/dockingStore';
import { useState } from 'react';
import { saveAs } from 'file-saver';
import { BarChart4, FileSpreadsheet, FileText } from 'lucide-react';
import '../../ui/styles/OutputPanel.css';

/**
 * Basic PDBQT to PDB converter for frontend usage.
 * Only keeps ATOM/HETATM/MODEL/ENDMDL lines and strips partial charges.
 */
function pdbqtToPdb(pdbqt: string): string {
    return pdbqt.split('\n')
        .map(line => {
            if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
                // Truncate to column 66 to remove PDBQT-specific charges/types
                return line.length > 66 ? line.substring(0, 66) : line;
            }
            if (line.startsWith('MODEL') || line.startsWith('ENDMDL') || line.startsWith('TER') || line.startsWith('END')) {
                return line;
            }
            return ''; 
        })
        .filter(line => line.length > 0)
        .join('\n');
}

export function OutputPanel() {
    const { result, selectedPose, setSelectedPose, receptorFile, setMDInputFile, setActiveTab } = useDockingStore();

    if (!result) {
        return (
            <div className="output-workspace empty">
                <div className="no-results-state">
                    <span className="icon"><BarChart4 size={48} opacity={0.5} /></span>
                    <h2>Ready to Dock</h2>
                    <p>Configure your receptor and ligand, then start the simulation.</p>
                </div>
            </div>
        );
    }

    const handleLaunchMD = (index: number) => {
        const pose = result.poses[index];
        const combinedContent = (receptorFile?.content ? receptorFile.content + '\n' : '') + pose.pdbqt;
        const pdbContent = pdbqtToPdb(combinedContent);
        
        setMDInputFile({
            name: `complex_pose_${pose.mode}.pdb`,
            content: pdbContent,
            format: 'pdb'
        });
        
        setActiveTab('md');
    };

    const handleDownload = (type: 'pdbqt' | 'pdb' | 'log' | 'all' | 'csv') => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Use only the selected pose if available, otherwise fallback to raw output
        const selectedLigandContent = result.poses[selectedPose]?.pdbqt || result.rawOutput;

        if (type === 'pdbqt' || type === 'all') {
            const combinedContent = (receptorFile?.content ? receptorFile.content + '\n' : '') + selectedLigandContent;
            const blob = new Blob([combinedContent], { type: 'text/plain;charset=utf-8' });
            saveAs(blob, `webvina_complex_${timestamp}.pdbqt`);
        }

        if (type === 'pdb' || type === 'all') {
            const combinedContent = (receptorFile?.content ? receptorFile.content + '\n' : '') + selectedLigandContent;
            const pdbContent = pdbqtToPdb(combinedContent);
            const blob = new Blob([pdbContent], { type: 'text/plain;charset=utf-8' });
            saveAs(blob, `webvina_complex_${timestamp}.pdb`);
        }

        if (type === 'log' || type === 'all') {
            const blob = new Blob([result.logOutput], { type: 'text/plain;charset=utf-8' });
            saveAs(blob, `webvina_log_${timestamp}.txt`);
        }

        if (type === 'csv') {
            const header = 'Mode,Affinity (kcal/mol),RMSD l.b.,RMSD u.b.\n';
            const rows = result.poses.map(p =>
                `${p.mode},${p.affinity},${p.rmsdLB},${p.rmsdUB}`
            ).join('\n');
            const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
            saveAs(blob, `webvina_scores_${timestamp}.csv`);
        }
    };

    const [showLog, setShowLog] = useState(false);

    return (
        <div className="output-workspace-panel">
            {/* LEFT PANEL: DATA & CONTROLS */}
            <div
                className="workspace-sidebar full-width"
            >
                <div className="sidebar-header">
                    <h3>Docking Results</h3>
                    <div className="toolbar-actions">
                        <button onClick={() => handleDownload('csv')} title="Export CSV">
                            <FileSpreadsheet size={16} /> CSV
                        </button>
                        <button onClick={() => handleDownload('pdbqt')} title="Download Complex PDBQT">
                            <FileText size={16} /> PDBQT
                        </button>
                        <button onClick={() => handleDownload('pdb')} title="Download Complex PDB">
                            <FileText size={16} /> PDB
                        </button>
                    </div>
                </div>

                <div className="results-list-container">
                    <table className="pro-table">
                        <thead>
                            <tr>
                                <th>Mode</th>
                                <th>Affinity</th>
                                <th>RMSD l.b.</th>
                                <th>RMSD u.b.</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.poses.map((pose, index) => (
                                <tr
                                    key={pose.mode}
                                    className={selectedPose === index ? 'active' : ''}
                                    onClick={() => setSelectedPose(index)}
                                >
                                    <td className="mode-col">
                                        <span className="mode-number">{pose.mode}</span>
                                        {index === 0 && <span className="badge-best">Best</span>}
                                    </td>
                                    <td className={`affinity-col ${pose.affinity < -7 ? 'high-score' : ''}`}>
                                        {pose.affinity.toFixed(1)}
                                    </td>
                                    <td className="rmsd-col">
                                        {pose.rmsdLB.toFixed(1)}
                                    </td>
                                    <td className="rmsd-col">
                                        {pose.rmsdUB.toFixed(1)}
                                    </td>
                                    <td className="action-col">
                                        <button 
                                            className="action-btn md-btn"
                                            onClick={(e) => { e.stopPropagation(); handleLaunchMD(index); }}
                                            title="Run MD Simulation on this pose"
                                        >
                                            🧪 MD
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className={`log-panel ${showLog ? 'expanded' : 'collapsed'}`}>
                    <div className="log-header" onClick={() => setShowLog(!showLog)} style={{ cursor: 'pointer' }}>
                        <h4>Simulation Log</h4>
                        <span className="toggle-icon">{showLog ? '−' : '+'}</span>
                    </div>
                    {showLog && <pre className="log-content">{result.logOutput}</pre>}
                </div>
            </div>
        </div>
    );
}
