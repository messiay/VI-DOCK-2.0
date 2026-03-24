import { useState, useRef } from 'react';
import { apiService } from '../../services/apiService';
import { INPUT_FORMATS, OUTPUT_FORMATS, type SupportedInputFormat, type SupportedOutputFormat } from '../../services/openBabelService';
import { MolecularPropertiesDisplay } from './MolecularProperties';
import { useDockingStore } from '../../store/dockingStore';
import { rdkitService, type MolecularProperties } from '../../services/rdkitService';
import {
    TestTube2,
    Dna,
    Pill,
    Search,
    Download,
    CheckCircle,
    AlertTriangle,
    FileText,
    RefreshCw,
    ArrowRight,
    FolderOpen,
    Zap,
    Target,
    Loader2
} from 'lucide-react';
import '../styles/PrepPanel.css';

// Common drug SMILES examples
const EXAMPLE_MOLECULES = [
    { name: 'Aspirin', smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O' },
    { name: 'Ibuprofen', smiles: 'CC(C)CC1=CC=C(C=C1)C(C)C(=O)O' },
    { name: 'Caffeine', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C' },
    { name: 'Acetaminophen', smiles: 'CC(=O)NC1=CC=C(C=C1)O' },
    { name: 'Metformin', smiles: 'CN(C)C(=N)NC(=N)N' },
];

// Example PDB IDs
const EXAMPLE_PDBS = [
    { id: '1A7H', name: 'HIV-1 Protease' },
    { id: '3HTB', name: 'Thrombin' },
    { id: '4HJO', name: 'EGFR Kinase' },
    { id: '2HYY', name: 'COX-2' },
];

// Example PubChem compounds
const EXAMPLE_COMPOUNDS = [
    { query: '2244', name: 'Aspirin' },
    { query: '2519', name: 'Caffeine' },
    { query: '3672', name: 'Ibuprofen' },
    { query: '5743', name: 'Morphine' },
];

export function PrepPanel() {
    // SMILES state
    const [smilesInput, setSmilesInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [svgDepiction, setSvgDepiction] = useState<string | null>(null);
    const [properties, setProperties] = useState<MolecularProperties | null>(null);
    const [processedData, setProcessedData] = useState<{
        canonicalSmiles?: string;
        pdbBlock?: string;
    } | null>(null);

    // PDB import state
    const [pdbInput, setPdbInput] = useState('');
    const [isFetchingPdb, setIsFetchingPdb] = useState(false);
    const [pdbResult, setPdbResult] = useState<{ title: string; content: string } | null>(null);
    const [pdbError, setPdbError] = useState<string | null>(null);

    // PubChem import state
    const [pubchemInput, setPubchemInput] = useState('');
    const [isFetchingPubchem, setIsFetchingPubchem] = useState(false);
    const [pubchemResult, setPubchemResult] = useState<{ name: string; content: string; format: string; properties?: any } | null>(null);
    const [pubchemError, setPubchemError] = useState<string | null>(null);

    // Format conversion state
    const [conversionFile, setConversionFile] = useState<File | null>(null);
    const [conversionFileContent, setConversionFileContent] = useState<string>('');
    const [inputFormat, setInputFormat] = useState<SupportedInputFormat>('pdb');
    const [outputFormat, setOutputFormat] = useState<SupportedOutputFormat>('pdbqt');
    const [isConverting, setIsConverting] = useState(false);
    const [conversionResult, setConversionResult] = useState<string | null>(null);
    const [conversionError, setConversionError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { setLigandFile, setReceptorFile, setActiveTab } = useDockingStore();

    // Services are initialized lazily when needed using init-on-demand patterns.
    // No useEffect() is used here to prevent startup blocks.

    // PDB Import Handler - Now uses backend API
    const handleFetchPDB = async () => {
        if (!pdbInput.trim()) {
            setPdbError('Please enter a PDB ID');
            return;
        }

        setIsFetchingPdb(true);
        setPdbError(null);
        setPdbResult(null);

        try {
            const result = await apiService.fetchPdb(pdbInput.trim());
            setPdbResult({ title: result.title || pdbInput.toUpperCase(), content: result.pdb_content });
        } catch (err: any) {
            setPdbError(err.message || 'Failed to fetch PDB');
        }

        setIsFetchingPdb(false);
    };

    const handleUsePdbAsReceptor = () => {
        if (!pdbResult) return;
        setReceptorFile({
            name: `${pdbInput.toUpperCase()}.pdb`,
            content: pdbResult.content,
            format: 'pdb',
        });
        setActiveTab('input');
    };

    // PubChem Import Handler - Now uses backend API
    const handleFetchPubChem = async () => {
        if (!pubchemInput.trim()) {
            setPubchemError('Please enter a CID or compound name');
            return;
        }

        setIsFetchingPubchem(true);
        setPubchemError(null);
        setPubchemResult(null);

        try {
            const result = await apiService.fetchPubChem(pubchemInput.trim());
            
            // Calculate properties using RDKit
            let properties: MolecularProperties | undefined;
            try {
                const molData = result.sdf_content || result.pdbqt_content;
                if (molData) {
                    const propResult = await rdkitService.processMolblock(molData);
                    if (propResult.success) {
                        properties = propResult.properties;
                    }
                }
            } catch (propErr) {
                console.warn('Could not calculate properties for PubChem ligand:', propErr);
            }

            setPubchemResult({
                name: result.name || pubchemInput,
                content: result.pdbqt_content || result.sdf_content,
                format: result.pdbqt_content ? 'pdbqt' : 'sdf',
                properties: properties // Store RDKit properties
            });
        } catch (err: any) {
            setPubchemError(err.message || 'Failed to fetch compound');
        }

        setIsFetchingPubchem(false);
    };

    const handleUsePubchemAsLigand = async () => {
        if (!pubchemResult) return;

        setLigandFile({
            name: `${pubchemResult.name.replace(/\s+/g, '_')}.pdbqt`,
            content: pubchemResult.content,
            format: pubchemResult.format as 'pdbqt' | 'sdf',
        });
        setActiveTab('input');
    };

    const handleUsePubchemAsReceptor = async () => {
        if (!pubchemResult) return;

        setReceptorFile({
            name: `${pubchemResult.name.replace(/\s+/g, '_')}.pdbqt`,
            content: pubchemResult.content,
            format: pubchemResult.format as 'pdbqt' | 'sdf',
        });
        setActiveTab('input');
    };

    // SMILES Processing - Now uses backend API
    const handleProcessSMILES = async () => {
        if (!smilesInput.trim()) {
            setError('Please enter a SMILES string');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setSvgDepiction(null);
        setProperties(null);
        setProcessedData(null);

        try {
            const pdbqtContent = await apiService.convertSmilesToPdbqt(smilesInput.trim(), 'smiles_ligand');
            setProcessedData({
                canonicalSmiles: smilesInput.trim(),
                pdbBlock: pdbqtContent,
            });
        } catch (err: any) {
            setError(`Processing error: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUseAsLigand = () => {
        if (!processedData?.pdbBlock) {
            setError('No 3D structure available');
            return;
        }

        setLigandFile({
            name: `${processedData.canonicalSmiles?.substring(0, 20) || 'ligand'}.pdb`,
            content: processedData.pdbBlock,
            format: 'pdb',
        });

        setActiveTab('input');
    };

    const handleUseAsReceptor = () => {
        if (!processedData?.pdbBlock) {
            setError('No 3D structure available');
            return;
        }

        setReceptorFile({
            name: `${processedData.canonicalSmiles?.substring(0, 20) || 'receptor'}.pdb`,
            content: processedData.pdbBlock,
            format: 'pdb',
        });

        setActiveTab('input');
    };

    // Format conversion handlers
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setConversionFile(file);
        setConversionResult(null);
        setConversionError(null);

        const content = await file.text();
        setConversionFileContent(content);

        // Simple format detection from extension
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext && ['pdb', 'sdf', 'mol', 'mol2', 'xyz'].includes(ext)) {
            setInputFormat(ext as SupportedInputFormat);
        }
    };

    const handleConvert = async () => {
        if (!conversionFileContent) {
            setConversionError('Please select a file to convert');
            return;
        }

        setIsConverting(true);
        setConversionError(null);
        setConversionResult(null);

        try {
            let pdbqtContent: string;

            if (inputFormat === 'pdb') {
                pdbqtContent = await apiService.convertPdbToPdbqt(conversionFileContent);
            } else if (inputFormat === 'sdf' || inputFormat === 'mol') {
                pdbqtContent = await apiService.convertSdfToPdbqt(conversionFileContent);
            } else {
                throw new Error(`Conversion from ${inputFormat} not supported via backend yet`);
            }

            setConversionResult(pdbqtContent);
        } catch (err: any) {
            setConversionError(`Conversion error: ${err.message}`);
        } finally {
            setIsConverting(false);
        }
    };

    const handleUseConvertedAsLigand = () => {
        if (!conversionResult) return;
        setLigandFile({
            name: `converted.${outputFormat}`,
            content: conversionResult,
            format: outputFormat,
            loading: false
        });
        setActiveTab('input');
    };

    const handleUseConvertedAsReceptor = () => {
        if (!conversionResult) return;
        setReceptorFile({
            name: `converted.${outputFormat}`,
            content: conversionResult,
            format: outputFormat,
            loading: false
        });
        setActiveTab('input');
    };

    const handleDownloadConverted = () => {
        if (!conversionResult) return;
        const blob = new Blob([conversionResult], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `converted.${outputFormat}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="prep-panel">
            <div className="prep-header">
                <h2><TestTube2 style={{ verticalAlign: 'middle', marginRight: '10px' }} size={32} /> Molecule Import</h2>
                <p>Import receptors from PDB, ligands from PubChem, or process SMILES</p>
            </div>

            {/* PDB Import Section */}
            <div className="import-section">
                <div className="section-header">
                    <h3><Dna size={20} /> Receptor from PDB</h3>
                    <span className="source-badge">RCSB PDB</span>
                </div>

                <div className="import-input-wrapper">
                    <input
                        type="text"
                        className="import-input"
                        placeholder="Enter PDB ID (e.g., 1A7H)"
                        value={pdbInput}
                        onChange={(e) => setPdbInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleFetchPDB()}
                        maxLength={4}
                    />
                    <button
                        className="fetch-btn"
                        onClick={handleFetchPDB}
                        disabled={isFetchingPdb || !pdbInput.trim()}
                    >
                        {isFetchingPdb ? (
                            <><Loader2 size={16} className="spin-icon" /> Fetching...</>
                        ) : (
                            <><Download size={16} /> Fetch</>
                        )}
                    </button>
                </div>

                <div className="example-items">
                    <span className="examples-label">Try:</span>
                    {EXAMPLE_PDBS.map((pdb) => (
                        <button
                            key={pdb.id}
                            className="example-btn"
                            onClick={() => setPdbInput(pdb.id)}
                            title={pdb.name}
                        >
                            {pdb.id}
                        </button>
                    ))}
                </div>

                {pdbError && <div className="import-error"><AlertTriangle size={16} /> {pdbError}</div>}

                {pdbResult && (
                    <div className="import-result">
                        <div className="result-header">
                            <span className="success-icon"><CheckCircle size={16} /></span>
                            <span>{pdbResult.title}</span>
                        </div>
                        <button className="action-btn primary" onClick={handleUsePdbAsReceptor}>
                            <Dna size={16} /> Use as Receptor
                        </button>
                    </div>
                )}
            </div>

            {/* PubChem Import Section */}
            <div className="import-section">
                <div className="section-header">
                    <h3><Pill size={20} /> Ligand from PubChem</h3>
                    <span className="source-badge">PubChem</span>
                </div>

                <div className="import-input-wrapper">
                    <input
                        type="text"
                        className="import-input"
                        placeholder="Enter CID or compound name (e.g., 2244 or aspirin)"
                        value={pubchemInput}
                        onChange={(e) => setPubchemInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleFetchPubChem()}
                    />
                    <button
                        className="fetch-btn"
                        onClick={handleFetchPubChem}
                        disabled={isFetchingPubchem || !pubchemInput.trim()}
                    >
                        {isFetchingPubchem ? (
                            <><Loader2 size={16} className="spin-icon" /> Fetching...</>
                        ) : (
                            <><Download size={16} /> Fetch</>
                        )}
                    </button>
                </div>

                <div className="example-items">
                    <span className="examples-label">Try:</span>
                    {EXAMPLE_COMPOUNDS.map((cmp) => (
                        <button
                            key={cmp.query}
                            className="example-btn"
                            onClick={() => setPubchemInput(cmp.query)}
                            title={`CID: ${cmp.query}`}
                        >
                            {cmp.name}
                        </button>
                    ))}
                </div>

                {pubchemError && <div className="import-error"><AlertTriangle size={16} /> {pubchemError}</div>}

                {pubchemResult && (
                    <div className="import-result pubchem-result">
                        <div className="result-header">
                            <span className="success-icon"><CheckCircle size={16} /></span>
                            <span>{pubchemResult.name}</span>
                        </div>

                        {/* Professional Molecular Properties Display */}
                        {pubchemResult.properties && (
                            <MolecularPropertiesDisplay properties={pubchemResult.properties} />
                        )}

                        <div className="result-actions">
                            <button className="action-btn primary" onClick={handleUsePubchemAsLigand}>
                                <Target size={16} /> Use as Ligand
                            </button>
                            <button className="action-btn" onClick={handleUsePubchemAsReceptor}>
                                <Dna size={16} /> Use as Receptor
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* SMILES Input Section */}
            <div className="import-section">
                <div className="section-header">
                    <h3><FileText size={20} /> SMILES to 3D</h3>
                    <span className="source-badge">RDKit</span>
                </div>

                <div className="smiles-input-wrapper">
                    <input
                        type="text"
                        className="smiles-input"
                        placeholder="Enter SMILES string (e.g., CCO for ethanol)"
                        value={smilesInput}
                        onChange={(e) => setSmilesInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleProcessSMILES()}
                    />
                    <button
                        className="process-btn"
                        onClick={handleProcessSMILES}
                        disabled={isProcessing || !smilesInput.trim()}
                    >
                        {isProcessing ? (
                            <><Loader2 size={16} className="spin-icon" /> Processing...</>
                        ) : (
                            <><Search size={16} /> Process</>
                        )}
                    </button>
                </div>

                <div className="example-items">
                    <span className="examples-label">Try:</span>
                    {EXAMPLE_MOLECULES.map((mol) => (
                        <button
                            key={mol.name}
                            className="example-btn"
                            onClick={() => setSmilesInput(mol.smiles)}
                        >
                            {mol.name}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="prep-error"><span><AlertTriangle size={16} /></span> {error}</div>}

            {/* SMILES Results Section */}
            {(svgDepiction || properties) && (
                <div className="results-section">
                    <div className="results-grid">
                        {svgDepiction && (
                            <div className="depiction-card">
                                <h3>2D Structure</h3>
                                <div
                                    className="svg-container"
                                    dangerouslySetInnerHTML={{ __html: svgDepiction }}
                                />
                                {processedData?.canonicalSmiles && (
                                    <div className="canonical-smiles">
                                        <span className="label">Canonical:</span>
                                        <code>{processedData.canonicalSmiles}</code>
                                    </div>
                                )}
                            </div>
                        )}

                        {processedData?.pdbBlock && (
                            <div className="actions-card">
                                <h3>Actions</h3>
                                <div className="result-actions">
                                    <button className="action-btn primary" onClick={handleUseAsLigand}>
                                        <Target size={16} /> Use as Ligand
                                    </button>
                                    <button className="action-btn" onClick={handleUseAsReceptor}>
                                        <Dna size={16} /> Use as Receptor
                                    </button>
                                </div>
                                <button
                                    className="action-btn secondary"
                                    style={{ marginTop: '12px', width: '100%' }}
                                    onClick={() => {
                                        const blob = new Blob([processedData.pdbBlock!], { type: 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'molecule.pdb';
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                >
                                    <Download size={16} /> Download PDB
                                </button>
                            </div>
                        )}
                    </div>

                    {properties && <MolecularPropertiesDisplay properties={properties} />}
                </div>
            )}

            {/* Format Conversion Section */}
            <div className="conversion-section active">
                <div className="section-header">
                    <h3><RefreshCw size={20} /> Format Conversion</h3>
                    <span className="format-badge">PDB → PDBQT</span>
                </div>

                <div className="conversion-content">
                    <div className="file-select-row">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".pdb,.sdf,.mol,.mol2,.xyz"
                            style={{ display: 'none' }}
                        />
                        <button
                            className="file-select-btn"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FolderOpen size={16} /> Select File
                        </button>
                        {conversionFile && (
                            <span className="file-name">{conversionFile.name}</span>
                        )}
                    </div>

                    <div className="format-selectors">
                        <div className="format-select">
                            <label>From:</label>
                            <select
                                value={inputFormat}
                                onChange={(e) => setInputFormat(e.target.value as SupportedInputFormat)}
                            >
                                {INPUT_FORMATS.map((fmt) => (
                                    <option key={fmt.extension} value={fmt.extension}>
                                        {fmt.name} (.{fmt.extension})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <span className="arrow"><ArrowRight size={20} /></span>

                        <div className="format-select">
                            <label>To:</label>
                            <select
                                value={outputFormat}
                                onChange={(e) => setOutputFormat(e.target.value as SupportedOutputFormat)}
                            >
                                {OUTPUT_FORMATS.map((fmt) => (
                                    <option key={fmt.extension} value={fmt.extension}>
                                        {fmt.name} (.{fmt.extension})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        className="convert-btn"
                        onClick={handleConvert}
                        disabled={isConverting || !conversionFileContent}
                    >
                        {isConverting ? (
                            <><Loader2 size={16} className="spin-icon" /> Converting...</>
                        ) : (
                            <><Zap size={16} /> Convert</>
                        )}
                    </button>

                    {conversionError && (
                        <div className="conversion-error"><AlertTriangle size={16} /> {conversionError}</div>
                    )}

                    {conversionResult && (
                        <div className="conversion-result">
                            <div className="result-header">
                                <span className="success-icon"><CheckCircle size={16} /></span>
                                <span>Conversion successful!</span>
                            </div>
                            <div className="result-actions">
                                <button className="action-btn primary" onClick={handleUseConvertedAsLigand}>
                                    <Target size={16} /> Use as Ligand
                                </button>
                                <button className="action-btn secondary" onClick={handleUseConvertedAsReceptor}>
                                    <Dna size={16} /> Use as Receptor
                                </button>
                                <button className="action-btn secondary" onClick={handleDownloadConverted}>
                                    <Download size={16} /> Download
                                </button>
                            </div>
                            <div className="result-preview">
                                <pre>{conversionResult.substring(0, 500)}...</pre>
                            </div>
                        </div>

                    )}
                </div>
            </div>
        </div>
    );
}
