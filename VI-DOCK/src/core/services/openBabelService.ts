/**
 * Open Babel Wasm Service - Format Conversion Layer
 * Provides PDB/SDF/MOL2 to PDBQT conversion using Open Babel WebAssembly
 */

// Supported input formats
export type SupportedInputFormat = 'pdb' | 'sdf' | 'mol' | 'mol2' | 'xyz' | 'cif';
export type SupportedOutputFormat = 'pdbqt' | 'pdb' | 'sdf' | 'mol' | 'mol2' | 'xyz';

export interface ConversionResult {
    success: boolean;
    output?: string;
    format?: string;
    error?: string;
}

export interface FormatInfo {
    extension: string;
    name: string;
    description: string;
}

// Format definitions
export const INPUT_FORMATS: FormatInfo[] = [
    { extension: 'pdb', name: 'PDB', description: 'Protein Data Bank format' },
    { extension: 'sdf', name: 'SDF', description: 'Structure Data File' },
    { extension: 'mol', name: 'MOL', description: 'MDL Molfile' },
    { extension: 'mol2', name: 'MOL2', description: 'Tripos Mol2 format' },
    { extension: 'xyz', name: 'XYZ', description: 'XYZ Cartesian coordinates' },
];

export const OUTPUT_FORMATS: FormatInfo[] = [
    { extension: 'pdbqt', name: 'PDBQT', description: 'AutoDock PDBQT format' },
    { extension: 'pdb', name: 'PDB', description: 'Protein Data Bank format' },
    { extension: 'sdf', name: 'SDF', description: 'Structure Data File' },
    { extension: 'mol', name: 'MOL', description: 'MDL Molfile' },
    { extension: 'mol2', name: 'MOL2', description: 'Tripos Mol2 format' },
];

// Open Babel module interface
interface OpenBabelModule {
    ObConversionWrapper: new () => ObConversionWrapper;
    OBMol: new () => OBMol;
}

interface ObConversionWrapper {
    setInFormat(format: string): boolean;
    setOutFormat(format: string): boolean;
    readString(mol: OBMol, data: string): boolean;
    writeString(mol: OBMol, trimWhitespace?: boolean): string;
    getSupportedInputFormats(): string[];
    getSupportedOutputFormats(): string[];
}

interface OBMol {
    addHydrogens(): boolean;
    deleteHydrogens(): boolean;
    getNumAtoms(): number;
    getNumBonds(): number;
    getTitle(): string;
    setTitle(title: string): void;
}

class OpenBabelService {
    private obModule: OpenBabelModule | null = null;
    private initPromise: Promise<void> | null = null;
    private isInitialized = false;
    private initError: string | null = null;

    /**
     * Initialize Open Babel Wasm module
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        if (this.initError) throw new Error(this.initError);

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.doInit();
        return this.initPromise;
    }

    private async doInit(): Promise<void> {
        try {
            // Load Open Babel from jsDelivr CDN
            const OPENBABEL_CDN_URL = 'https://cdn.jsdelivr.net/npm/openbabel@1.0.2/openbabel.min.js';

            // Check if already loaded
            if ((window as any).OpenBabel) {
                console.log('OpenBabel already loaded');
                this.obModule = (window as any).OpenBabel;
                this.isInitialized = true;
                return;
            }

            // Load the script
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement('script');
                script.src = OPENBABEL_CDN_URL;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load Open Babel script from CDN'));
                document.head.appendChild(script);
            });

            // Wait for module to be available
            await new Promise(resolve => setTimeout(resolve, 500));

            // Try to get the OpenBabel module
            if ((window as any).OpenBabel) {
                this.obModule = (window as any).OpenBabel;
                console.log('OpenBabel.js initialized successfully');
                this.isInitialized = true;
            } else if ((window as any).Module) {
                // Some builds expose via Module global
                this.obModule = (window as any).Module;
                console.log('OpenBabel Module initialized');
                this.isInitialized = true;
            } else {
                // If CDN doesn't work, fall back to JavaScript-based conversion
                console.warn('OpenBabel not available, using fallback converter');
                this.isInitialized = true; // Mark as initialized but use fallback
            }
        } catch (error) {
            console.error('Failed to initialize OpenBabel:', error);
            this.initError = `OpenBabel initialization failed: ${error}`;
            // Don't throw - we'll use fallback methods
            this.isInitialized = true;
        }
    }

    /**
     * Check if Open Babel is ready
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Check if native Open Babel is available (vs fallback)
     */
    hasNativeSupport(): boolean {
        return this.obModule !== null;
    }

    /**
     * Convert molecular data between formats
     */
    async convert(
        inputData: string,
        inputFormat: SupportedInputFormat,
        outputFormat: SupportedOutputFormat
    ): Promise<ConversionResult> {
        await this.initialize();

        // If we have native Open Babel support, use it
        if (this.obModule) {
            try {
                const conv = new this.obModule.ObConversionWrapper();
                const mol = new this.obModule.OBMol();

                if (!conv.setInFormat(inputFormat)) {
                    return { success: false, error: `Unsupported input format: ${inputFormat}` };
                }

                if (!conv.setOutFormat(outputFormat)) {
                    return { success: false, error: `Unsupported output format: ${outputFormat}` };
                }

                if (!conv.readString(mol, inputData)) {
                    return { success: false, error: 'Failed to parse input file' };
                }

                // Add hydrogens for PDBQT conversion
                if (outputFormat === 'pdbqt') {
                    mol.addHydrogens();
                }

                const output = conv.writeString(mol, true);

                return {
                    success: true,
                    output,
                    format: outputFormat,
                };
            } catch (error) {
                console.error('OpenBabel conversion error:', error);
                // Fall through to fallback
            }
        }

        // Use JavaScript-based fallback conversion
        return this.fallbackConvert(inputData, inputFormat, outputFormat);
    }

    /**
     * Fallback conversion using pure JavaScript
     * This provides basic PDB to PDBQT conversion
     */
    private fallbackConvert(
        inputData: string,
        inputFormat: SupportedInputFormat,
        outputFormat: SupportedOutputFormat
    ): ConversionResult {
        // Only support PDB to PDBQT for now in fallback mode
        if (inputFormat === 'pdb' && outputFormat === 'pdbqt') {
            return this.pdbToPdbqt(inputData);
        }

        // For other conversions, indicate that native Open Babel is required
        return {
            success: false,
            error: `Conversion from ${inputFormat.toUpperCase()} to ${outputFormat.toUpperCase()} requires Open Babel. Please try PDB to PDBQT conversion, or load a PDBQT file directly.`,
        };
    }

    /**
     * Convert PDB to PDBQT format
     * This is a simplified conversion - adds partial charges and atom types
     */
    private pdbToPdbqt(pdbData: string): ConversionResult {
        try {
            const lines = pdbData.split('\n');
            const pdbqtLines: string[] = [];

            // Standard atom type mappings for common elements
            const atomTypes: Record<string, string> = {
                'C': 'C',
                'N': 'N',
                'O': 'OA',
                'S': 'S',
                'H': 'HD',
                'P': 'P',
                'F': 'F',
                'CL': 'Cl',
                'BR': 'Br',
                'I': 'I',
                'ZN': 'Zn',
                'MG': 'Mg',
                'CA': 'Ca',
                'FE': 'Fe',
                'MN': 'Mn',
            };

            // Approximate partial charges (Gasteiger-like)
            const partialCharges: Record<string, number> = {
                'C': 0.0,
                'N': -0.4,
                'O': -0.4,
                'S': -0.1,
                'H': 0.1,
                'P': 0.4,
            };

            pdbqtLines.push('REMARK  Generated by WebVina - PDBQT Converter');
            pdbqtLines.push('REMARK  Approximate partial charges and atom types');

            for (const line of lines) {
                if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
                    // Parse PDB atom record
                    const record = line.substring(0, 6).trim();
                    const serial = line.substring(6, 11).trim();
                    const atomName = line.substring(12, 16).trim();
                    const altLoc = line.substring(16, 17);
                    const resName = line.substring(17, 20).trim();
                    const chainId = line.substring(21, 22);
                    const resSeq = line.substring(22, 26).trim();
                    const iCode = line.substring(26, 27);
                    const x = line.substring(30, 38).trim();
                    const y = line.substring(38, 46).trim();
                    const z = line.substring(46, 54).trim();
                    const occupancy = line.substring(54, 60).trim() || '1.00';
                    const tempFactor = line.substring(60, 66).trim() || '0.00';
                    const element = line.substring(76, 78).trim() || atomName.replace(/[0-9]/g, '').substring(0, 1);

                    // Determine atom type for PDBQT
                    const elementUpper = element.toUpperCase();
                    let adType = atomTypes[elementUpper] || elementUpper;

                    // Special handling for hydrogen bonding atoms
                    if (elementUpper === 'O' && atomName.includes('H')) {
                        adType = 'OA'; // Hydrogen bond acceptor oxygen
                    }
                    if (elementUpper === 'N' && atomName.includes('H')) {
                        adType = 'NA'; // Hydrogen bond acceptor nitrogen
                    }

                    // Get partial charge
                    const charge = partialCharges[elementUpper] || 0.0;

                    // Format PDBQT line (AutoDock format)
                    const pdbqtLine = `${record.padEnd(6)}${serial.padStart(5)} ${atomName.padEnd(4)}${altLoc}${resName.padStart(3)} ${chainId}${resSeq.padStart(4)}${iCode}   ${x.padStart(8)}${y.padStart(8)}${z.padStart(8)}${occupancy.padStart(6)}${tempFactor.padStart(6)}    ${charge.toFixed(3).padStart(6)} ${adType.padEnd(2)}`;

                    pdbqtLines.push(pdbqtLine);
                } else if (line.startsWith('TER') || line.startsWith('END')) {
                    pdbqtLines.push(line);
                }
            }

            if (!pdbqtLines.some(l => l.startsWith('END'))) {
                pdbqtLines.push('END');
            }

            return {
                success: true,
                output: pdbqtLines.join('\n'),
                format: 'pdbqt',
            };
        } catch (error) {
            return {
                success: false,
                error: `PDB to PDBQT conversion failed: ${error}`,
            };
        }
    }

    /**
     * Detect format from file extension or content
     */
    detectFormat(filename: string, content?: string): SupportedInputFormat | null {
        const ext = filename.split('.').pop()?.toLowerCase();

        if (ext && ['pdb', 'sdf', 'mol', 'mol2', 'xyz', 'cif'].includes(ext)) {
            return ext as SupportedInputFormat;
        }

        // Try to detect from content
        if (content) {
            if (content.includes('ATOM') || content.includes('HETATM')) {
                return 'pdb';
            }
            if (content.includes('$$$$') || content.includes('M  END')) {
                return content.includes('V2000') || content.includes('V3000') ? 'sdf' : 'mol';
            }
            if (content.includes('@<TRIPOS>')) {
                return 'mol2';
            }
        }

        return null;
    }
}

// Singleton instance
export const openBabelService = new OpenBabelService();
