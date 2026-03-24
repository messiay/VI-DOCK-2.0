import { useCallback } from 'react';
import { useDockingStore } from '../../store/dockingStore';
import type { MoleculeFile } from '../../types';
import { UploadCloud, FileText, X } from 'lucide-react';
import { sdfToPdbqt, isSdfFormat } from '../../utils/sdfConverter';
import '../styles/FileUpload.css';

interface FileUploadProps {
    label: string;
    description: string;
    acceptedFormats: string[];
    file: MoleculeFile | null;
    onFileChange: (file: MoleculeFile | null) => void;
    optional?: boolean;
}

export function FileUpload({
    label,
    description,
    acceptedFormats,
    file,
    onFileChange,
    optional = false,
}: FileUploadProps) {
    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();

            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile) {
                readFile(droppedFile, onFileChange);
            }
        },
        [onFileChange]
    );

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) {
                readFile(selectedFile, onFileChange);
            }
        },
        [onFileChange]
    );

    const handleRemove = useCallback(() => {
        onFileChange(null);
    }, [onFileChange]);

    return (
        <div className="file-upload">
            <div className="file-upload-header">
                <span className="file-upload-label">
                    {label}
                    {optional && <span className="optional-badge">Optional</span>}
                </span>
            </div>

            {file ? (
                <div className="file-uploaded">
                    <div className="file-info">
                        <span className="file-icon"><FileText size={20} /></span>
                        <div className="file-details">
                            <span className="file-name">{file.name}</span>
                            <span className="file-format">{file.format.toUpperCase()}</span>
                        </div>
                    </div>
                    <button className="remove-btn" onClick={handleRemove}>
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <div
                    className="file-dropzone"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                    <div className="dropzone-content">
                        <span className="dropzone-icon"><UploadCloud size={32} /></span>
                        <p className="dropzone-text">
                            Drag & drop or{' '}
                            <label className="file-browse">
                                browse
                                <input
                                    type="file"
                                    accept={acceptedFormats.map(f => `.${f}`).join(',')}
                                    onChange={handleFileInput}
                                    hidden
                                />
                            </label>
                        </p>
                        <p className="dropzone-formats">
                            {description}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function readFile(
    file: File,
    onFileChange: (file: MoleculeFile | null) => void
): void {
    const reader = new FileReader();

    reader.onload = (e) => {
        const content = e.target?.result as string;
        const format = file.name.split('.').pop()?.toLowerCase() || 'pdbqt';

        onFileChange({
            name: file.name,
            content,
            format,
        });
    };

    reader.onerror = () => {
        console.error('Failed to read file:', file.name);
    };

    reader.readAsText(file);
}

// Preset file upload components
export function ReceptorUpload() {
    const { receptorFile, setReceptorFile } = useDockingStore();

    return (
        <FileUpload
            label="Receptor File"
            description="PDBQT (best), PDB, ENT, XYZ, PQR, MMCIF"
            acceptedFormats={['pdbqt', 'pdb', 'ent', 'xyz', 'pqr', 'mcif', 'mmcif']}
            file={receptorFile}
            onFileChange={setReceptorFile}
        />
    );
}

export function LigandUpload() {
    const { ligandFile, setLigandFile } = useDockingStore();

    // Wrapper that converts SDF to PDBQT on upload
    const handleLigandChange = useCallback((file: MoleculeFile | null) => {
        if (!file) {
            setLigandFile(null);
            return;
        }

        // Check if file is SDF format and convert immediately
        if (file.format === 'sdf' || file.format === 'mol' || file.format === 'sd' || isSdfFormat(file.content)) {
            console.info('[LigandUpload] Converting SDF to PDBQT on upload...');
            const pdbqtContent = sdfToPdbqt(file.content);

            // If conversion succeeded (has HETATM lines), use converted content
            if (pdbqtContent && (pdbqtContent.includes('HETATM') || pdbqtContent.includes('ATOM'))) {
                setLigandFile({
                    name: file.name.replace(/\.(sdf|mol|sd)$/i, '.pdbqt'),
                    content: pdbqtContent,
                    format: 'pdbqt',
                });
                console.info('[LigandUpload] SDF converted to PDBQT successfully!');
            } else {
                // Conversion failed, keep original
                console.warn('[LigandUpload] SDF conversion failed, keeping original');
                setLigandFile(file);
            }
        } else {
            setLigandFile(file);
        }
    }, [setLigandFile]);

    return (
        <FileUpload
            label="Ligand File"
            description="PDBQT (best), MOL, MOL2, SDF, PDB, SMI, XYZ"
            acceptedFormats={['pdbqt', 'mol', 'mol2', 'sdf', 'sd', 'pdb', 'smi', 'smiles', 'xyz', 'can', 'mdl']}
            file={ligandFile}
            onFileChange={handleLigandChange}
        />
    );
}

export function CorrectPoseUpload() {
    const { correctPoseFile, setCorrectPoseFile } = useDockingStore();

    return (
        <FileUpload
            label="Correct Pose"
            description="Reference ligand for RMSD comparison"
            acceptedFormats={['pdbqt', 'pdb']}
            file={correctPoseFile}
            onFileChange={setCorrectPoseFile}
            optional
        />
    );
}
