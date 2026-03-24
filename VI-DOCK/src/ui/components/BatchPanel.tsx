import { useState, useRef } from 'react';
import { useDockingStore } from '../../store/dockingStore';
import { vinaService } from '../../services/vinaService';
import { pdbService } from '../../services/pdbService';
import { pubchemService } from '../../services/pubchemService';
import { sdfToPdbqt } from '../../utils/sdfConverter';
import type { DockingResult } from '../../core/types';
import { apiService } from '../../services/apiService';
import { Layers, TestTube2, Play, Download, XCircle, CheckCircle, Loader2, AlertTriangle, FileText, Upload, Plus, Trash2, ChevronRight, ChevronDown, Settings, Search } from 'lucide-react';
import { DockingBoxPanel } from './DockingBoxPanel';
import { VinaOptionsPanel } from './VinaOptionsPanel';
import { calculateBlindDockingBox } from '../../utils/gridboxCalculator';
import '../styles/BatchPanel.css';

/** Basic PDBQT to PDB converter */
function pdbqtToPdb(pdbqt: string): string {
    return pdbqt.split('\n')
        .map(line => {
            if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
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

interface BatchMolecule {
    id: string;
    name: string;
    content: string;
    source: 'upload' | 'pdb' | 'pubchem';
}

interface BatchJob {
    id: string;
    receptorName: string;
    ligandName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    affinity?: number;
    result?: DockingResult; // Full result
    error?: string;
    receptorContent: string;
    ligandContent: string;
}

export function BatchPanel() {
    const { params, setReceptorFile, setLigandFile, setResult, setSelectedPose, selectedPose, result, dockingEngine } = useDockingStore();
    const [showParams, setShowParams] = useState(false);
    const [dockingMode, setDockingMode] = useState<'blind' | 'autosite' | 'manual'>('blind'); 

    const [receptors, setReceptors] = useState<BatchMolecule[]>([]);
    const [ligands, setLigands] = useState<BatchMolecule[]>([]);

    // Text Inputs
    const [pdbList, setPdbList] = useState('');
    const [pubchemList, setPubchemList] = useState('');
    const [isFetchingPdb, setIsFetchingPdb] = useState(false);
    const [isFetchingPubchem, setIsFetchingPubchem] = useState(false);

    const [jobs, setJobs] = useState<BatchJob[]>([]);
    const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const receptorInputRef = useRef<HTMLInputElement>(null);
    const ligandInputRef = useRef<HTMLInputElement>(null);

    // View in 3D
    const handleViewJob = (job: BatchJob, poseIndex = 0) => {
        if (!job.receptorContent || !job.result) return;

        // Set Receptor
        setReceptorFile({
            name: job.receptorName,
            content: job.receptorContent,
            format: 'pdb'
        });

        // Set Result (renders specific pose)
        setResult(job.result);
        setSelectedPose(poseIndex);

        // Clear Ligand file to force viewer to use Result
        setLigandFile(null);
    };

    const toggleExpand = (jobId: string) => {
        setExpandedJobId(prev => prev === jobId ? null : jobId);
    };

    // ... (rest of file) ...

    // --- FILE UPLOADS ---
    const handleReceptorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const newMols: BatchMolecule[] = [];

            for (const file of files) {
                let text = await file.text();
                // [FIX] Auto-convert PDB to PDBQT
                if (file.name.toLowerCase().endsWith('.pdb')) {
                    try {
                        text = await apiService.convertPdbToPdbqt(text);
                    } catch (err) {
                        console.error(`Failed to convert ${file.name}`, err);
                        // Fallback: keep text (might fail in Vina, but user sees it)
                    }
                }
                newMols.push({
                    id: `rec-upload-${Date.now()}-${file.name}`,
                    name: file.name.replace(/\.pdb$/i, '.pdbqt'),
                    content: text,
                    source: 'upload'
                });
            }
            setReceptors(prev => [...prev, ...newMols]);
        }
    };

    const handleLigandUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const newMols: BatchMolecule[] = [];

            for (const file of files) {
                let text = await file.text();
                let name = file.name;

                // [FIX] Auto-convert SDF/MOL to PDBQT
                if (name.toLowerCase().endsWith('.sdf') || name.toLowerCase().endsWith('.mol')) {
                    try {
                        text = await apiService.convertSdfToPdbqt(text);
                        name = name.replace(/\.(sdf|mol)$/i, '.pdbqt');
                    } catch (err) {
                        console.error(`Failed to convert ${file.name}`, err);
                    }
                }

                newMols.push({
                    id: `lig-upload-${Date.now()}-${file.name}`,
                    name: name,
                    content: text,
                    source: 'upload'
                });
            }
            setLigands(prev => [...prev, ...newMols]);
        }
    };

    // --- ID IMPORTS ---
    const fetchPdbIds = async () => {
        const ids = pdbList.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(s => s.length === 4);
        if (ids.length === 0) return;

        setIsFetchingPdb(true);
        const newMols: BatchMolecule[] = [];

        for (const id of ids) {
            // Check duplicates
            if (receptors.some(r => r.name.startsWith(id))) continue;

            try {
                const result = await pdbService.fetchPDB(id);
                if (result.success && result.content) {
                    // [FIX] Convert fetched PDB to PDBQT
                    let pdbqt = result.content;
                    try {
                        pdbqt = await apiService.convertPdbToPdbqt(result.content);
                    } catch (e) {
                        console.warn(`Conversion failed for ${id}, using raw PDB`, e);
                    }

                    newMols.push({
                        id: `rec-pdb-${id}`,
                        name: `${id}.pdbqt`,
                        content: pdbqt,
                        source: 'pdb'
                    });
                }
            } catch (e) { console.warn(`Failed to fetch ${id}`, e); }
        }

        setReceptors(prev => [...prev, ...newMols]);
        setPdbList(''); // Clear
        setIsFetchingPdb(false);
    };

    const [importError, setImportError] = useState<string | null>(null);

    // ...

    const fetchPubchemIds = async () => {
        setImportError(null);
        const queries = pubchemList.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);
        if (queries.length === 0) return;

        setIsFetchingPubchem(true);
        const newMols: BatchMolecule[] = [];
        const errors: string[] = [];

        for (const q of queries) {
            try {
                const result = await pubchemService.fetchCompound(q);
                if (result.success && result.content) {
                    // FAST CONVERSION (JS)
                    let pdbqt: string | null = result.content;
                    if (result.format === 'sdf' || !pdbqt.includes('ATOM')) {
                        pdbqt = sdfToPdbqt(result.content);
                    }

                    if (!pdbqt) {
                        errors.push(`Failed to convert ${q}: Invalid SDF or 3D data missing`);
                        continue;
                    }

                    newMols.push({
                        id: `lig-pubchem-${result.cid}`,
                        name: (result.name || q).replace(/\s+/g, '_') + '.pdbqt',
                        content: pdbqt,
                        source: 'pubchem'
                    });
                } else {
                    errors.push(`Failed to fetch ${q}: ${result.error || 'Unknown error'}`);
                }
            } catch (e) {
                errors.push(`Error fetching ${q}: ${e}`);
            }
        }

        if (errors.length > 0) {
            setImportError(errors.join('\n'));
        }

        setLigands(prev => [...prev, ...newMols]);
        setPubchemList('');
        setIsFetchingPubchem(false);
    };

    // --- BATCH EXECUTION ---
    const generateJobs = () => {
        const newJobs: BatchJob[] = [];
        let idCounter = 1;

        for (const rec of receptors) {
            for (const lig of ligands) {
                newJobs.push({
                    id: `job-${idCounter++}`,
                    receptorName: rec.name,
                    ligandName: lig.name,
                    status: 'pending',
                    receptorContent: rec.content,
                    ligandContent: lig.content
                });
            }
        }
        setJobs(newJobs);
        return newJobs;
    };

    const runBatch = async () => {
        let executionQueue = jobs.length > 0 ? [...jobs] : generateJobs();

        setIsRunning(true);

        for (let i = 0; i < executionQueue.length; i++) {
            if (executionQueue[i].status === 'completed') continue; // Skip done

            const job = executionQueue[i];

            // Mark running
            setJobs(prev => prev.map((j, idx) => idx === i ? { ...j, status: 'running' } : j));

            try {
                // Calculate Params (Dynamic or Static)
                let jobParams = { ...params, dockingEngine };

                if (dockingMode === 'blind') {
                    const blindBox = calculateBlindDockingBox(job.receptorContent);
                    jobParams = { ...jobParams, ...blindBox };
                } else if (dockingMode === 'autosite') {
                    // 1. Create a temporary session to find pockets
                    const tempProject = `SiteDetection_${Date.now()}`;
                    try {
                        await apiService.createProject(tempProject);
                        const recFile = new File([job.receptorContent], "receptor.pdbqt", { type: "text/plain" });
                        await apiService.uploadFile(tempProject, recFile, 'receptor');
                        
                        const pockets = await apiService.findPockets(tempProject, "receptor.pdbqt");
                        if (pockets && pockets.length > 0) {
                            // Use the best pocket found
                            const bestPocket = pockets[0].gridbox;
                            jobParams = {
                                ...jobParams,
                                centerX: bestPocket.center_x,
                                centerY: bestPocket.center_y,
                                centerZ: bestPocket.center_z,
                                sizeX: bestPocket.size_x,
                                sizeY: bestPocket.size_y,
                                sizeZ: bestPocket.size_z
                            };
                        } else {
                            // Fallback to blind
                            const blindBox = calculateBlindDockingBox(job.receptorContent);
                            jobParams = { ...jobParams, ...blindBox };
                        }
                    } catch (e) {
                        console.warn("Autosite failed, falling back to blind:", e);
                        const blindBox = calculateBlindDockingBox(job.receptorContent);
                        jobParams = { ...jobParams, ...blindBox };
                    }
                }
                // If manual, jobParams already contains store params

                // RUN DOCKING
                const result = await vinaService.runDocking(
                    job.receptorContent,
                    job.ligandContent,
                    jobParams,
                    (_msg, _pct) => { } // Unused progress
                );

                const bestAffinity = result.poses.length > 0 ? result.poses[0].affinity : undefined;

                setJobs(prev => prev.map((j, idx) => idx === i ? {
                    ...j,
                    status: 'completed',
                    affinity: bestAffinity,
                    result: result
                } : j));

            } catch (err) {
                console.error(`Job ${job.id} failed`, err);
                setJobs(prev => prev.map((j, idx) => idx === i ? {
                    ...j,
                    status: 'failed',
                    error: String(err)
                } : j));
            }

            await new Promise(r => setTimeout(r, 200));
        }

        setIsRunning(false);
    };

    const downloadCSV = () => {
        const headers = "Receptor,Ligand,Status,Best Affinity (kcal/mol),RMSD l.b.,RMSD u.b.,Error\n";
        const rows = jobs.map(j => {
            const bestPose = j.result?.poses[0];
            const affinity = bestPose?.affinity ?? '';
            const rmsdLB = bestPose?.rmsdLB ?? '';
            const rmsdUB = bestPose?.rmsdUB ?? '';
            return `${j.receptorName},${j.ligandName},${j.status},${affinity},${rmsdLB},${rmsdUB},${j.error || ''}`;
        }).join("\n");

        const blob = new Blob([headers + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch_results_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    const downloadPose = (job: BatchJob, poseIndex: number, format: 'pdbqt' | 'pdb' = 'pdbqt') => {
        if (!job.result?.poses[poseIndex]) return;

        const pose = job.result.poses[poseIndex];
        const ligandContent = pose.pdbqt;
        const combinedContent = (job.receptorContent ? job.receptorContent + '\n' : '') + ligandContent;
        
        let finalContent = combinedContent;
        let filename = `Complex_${job.ligandName}_${job.receptorName}_mode${pose.mode}.pdbqt`;

        if (format === 'pdb') {
            finalContent = pdbqtToPdb(combinedContent);
            filename = `Complex_${job.ligandName}_${job.receptorName}_mode${pose.mode}.pdb`;
        }

        const blob = new Blob([finalContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    };

    const clearAll = () => {
        setReceptors([]);
        setLigands([]);
        setJobs([]);
        setIsRunning(false);
    };

    const removeReceptor = (index: number) => {
        setReceptors(prev => prev.filter((_, i) => i !== index));
    };

    const removeLigand = (index: number) => {
        setLigands(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="batch-panel">
            <div className="batch-header">
                <h2><Layers size={24} /> Batch Docking</h2>
                <p>M x N Combinatorial Screen</p>
            </div>

            <div className="batch-inputs-container">
                {/* RECEPTORS */}
                <div className="batch-column">
                    <div className="column-header">
                        <TestTube2 size={16} /> Receptors
                        <span className="count-badge">{receptors.length}</span>
                    </div>

                    {/* Input Area */}
                    <div className="input-area">
                        <textarea
                            placeholder="Enter PDB IDs (e.g. 1A7H, 3HTB)&#10;One per line or comma separated"
                            value={pdbList}
                            onChange={e => setPdbList(e.target.value)}
                            rows={3}
                        />
                        <button className="add-btn" onClick={fetchPdbIds} disabled={isFetchingPdb || !pdbList.trim()}>
                            {isFetchingPdb ? <Loader2 className="spin" size={14} /> : <Plus size={14} />} Add PDBs
                        </button>
                    </div>

                    <div className="divider">OR</div>

                    <input
                        type="file"
                        multiple
                        accept=".pdb,.pdbqt"
                        ref={receptorInputRef}
                        onChange={handleReceptorUpload}
                        style={{ display: 'none' }}
                    />
                    <button className="upload-btn" onClick={() => receptorInputRef.current?.click()}>
                        <Upload size={14} /> Upload Files
                    </button>

                    {/* List */}
                    <div className="item-list">
                        {receptors.map((rec, i) => (
                            <div key={rec.id} className="item-row">
                                <span className="name">{rec.name}</span>
                                <button className="remove-btn" onClick={() => removeReceptor(i)}><Trash2 size={12} /></button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* LIGANDS */}
                <div className="batch-column">
                    <div className="column-header">
                        <FileText size={16} /> Ligands
                        <span className="count-badge">{ligands.length}</span>
                    </div>

                    {/* Input Area */}
                    <div className="input-area">
                        <textarea
                            placeholder="Enter PubChem CIDs/Names&#10;(e.g. Aspirin, 2244)&#10;One per line"
                            value={pubchemList}
                            onChange={e => setPubchemList(e.target.value)}
                            rows={3}
                        />
                        <button className="add-btn" onClick={fetchPubchemIds} disabled={isFetchingPubchem || !pubchemList.trim()}>
                            {isFetchingPubchem ? <Loader2 className="spin" size={14} /> : <Plus size={14} />} Add PubChem
                        </button>
                    </div>

                    <div className="divider">OR</div>

                    <input
                        type="file"
                        multiple
                        accept=".sdf,.pdbqt"
                        ref={ligandInputRef}
                        onChange={handleLigandUpload}
                        style={{ display: 'none' }}
                    />
                    <button className="upload-btn" onClick={() => ligandInputRef.current?.click()}>
                        <Upload size={14} /> Upload Files
                    </button>

                    {/* List */}
                    <div className="item-list">
                        {ligands.map((lig, i) => (
                            <div key={lig.id} className="item-row">
                                <span className="name">{lig.name}</span>
                                <button className="remove-btn" onClick={() => removeLigand(i)}><Trash2 size={12} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Error Message Display */}
            {importError && (
                <div className="import-error-box">
                    <AlertTriangle size={16} />
                    <pre>{importError}</pre>
                    <button onClick={() => setImportError(null)}><XCircle size={14} /></button>
                </div>
            )}

            {/* PARAMETERS SECTION */}
            <div className="batch-params-container">
                <button
                    className="params-toggle-btn"
                    onClick={() => setShowParams(!showParams)}
                >
                    {showParams ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Settings size={16} />
                    Configure Docking Parameters (Grid Box & Vina)
                </button>

                {showParams && (
                    <div className="params-content">
                        <div className="docking-mode-selector">
                            <button 
                                className={`mode-btn ${dockingMode === 'blind' ? 'active' : ''}`}
                                onClick={() => setDockingMode('blind')}
                            >
                                <Layers size={16} /> Blind
                            </button>
                            <button 
                                className={`mode-btn ${dockingMode === 'autosite' ? 'active' : ''}`}
                                onClick={() => setDockingMode('autosite')}
                            >
                                <Search size={16} /> Autosite
                            </button>
                            <button 
                                className={`mode-btn ${dockingMode === 'manual' ? 'active' : ''}`}
                                onClick={() => setDockingMode('manual')}
                            >
                                <Settings size={16} /> Manual
                            </button>
                        </div>

                        <div className="params-grid">
                            {dockingMode === 'manual' && <DockingBoxPanel />}
                            <VinaOptionsPanel />
                        </div>
                    </div>
                )}
            </div>

            {/* CONTROLS */}
            <div className="batch-footer">
                <div className="job-summary">
                    {receptors.length * ligands.length} Potential Jobs
                </div>
                <div className="footer-actions">
                    <button className="secondary-btn" onClick={clearAll}>Clear All</button>
                    <button className="primary-btn" onClick={runBatch} disabled={isRunning || receptors.length === 0 || ligands.length === 0}>
                        {isRunning ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
                        {isRunning ? 'Running...' : 'Run Batch'}
                    </button>
                </div>
            </div>

            {/* RESULTS */}
            {jobs.length > 0 && (
                <div className="results-panel">
                    <div className="results-header">
                        <h3>Results</h3>
                        <button className="icon-btn" onClick={downloadCSV}><Download size={14} /></button>
                    </div>
                    <div className="results-list">
                        {jobs.map((job, idx) => (
                            <div key={idx} className={`result-item ${job.status}`}>
                                {/* Header Row */}
                                <div className="result-row" onClick={() => toggleExpand(job.id)}>
                                    <div className="status-icon">
                                        {job.status === 'completed' && <CheckCircle size={14} />}
                                        {job.status === 'failed' && <XCircle size={14} />}
                                        {job.status === 'running' && <Loader2 size={14} className="spin" />}
                                        {job.status === 'pending' && <span className="dot" />}
                                    </div>
                                    <div className="result-details">
                                        <span className="pair">{job.receptorName} + {job.ligandName}</span>
                                        {job.affinity && <span className="score">{job.affinity.toFixed(1)}</span>}
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedJobId === job.id && job.result && (
                                    <div className="result-expanded">
                                        <div className="action-row">
                                            <button className="view-3d-btn" onClick={(e) => { e.stopPropagation(); handleViewJob(job, 0); }}>
                                                <Play size={14} /> View Best Pose in 3D
                                            </button>

                                            {/* Download Button for Active Pose */}
                                            {params && job.result === result && (
                                                <div className="download-options">
                                                    <button
                                                        className="view-3d-btn download-btn"
                                                        onClick={(e) => { e.stopPropagation(); downloadPose(job, selectedPose, 'pdbqt'); }}
                                                    >
                                                        <Download size={14} /> PDBQT
                                                    </button>
                                                    <button
                                                        className="view-3d-btn download-btn"
                                                        onClick={(e) => { e.stopPropagation(); downloadPose(job, selectedPose, 'pdb'); }}
                                                    >
                                                        <Download size={14} /> PDB
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <table className="mini-table">
                                            <thead>
                                                <tr><th>Mode</th><th>Affinity</th><th>RMSD</th><th>Action</th></tr>
                                            </thead>
                                            <tbody>
                                                {job.result.poses.map((pose, pIdx) => {
                                                    const isActive = pIdx === selectedPose && job.result === result;
                                                    return (
                                                        <tr
                                                            key={pose.mode}
                                                            className={`pose-row ${isActive ? 'active-pose' : ''}`}
                                                            onClick={(e) => { e.stopPropagation(); handleViewJob(job, pIdx); }}
                                                        >
                                                            <td>{pose.mode}</td>
                                                            <td>{pose.affinity}</td>
                                                            <td>{pose.rmsdLB}</td>
                                                            <td>
                                                                <button className="small-view-btn">
                                                                    {isActive ? 'Viewing' : 'View'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
