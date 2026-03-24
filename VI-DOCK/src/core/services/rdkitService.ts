/**
 * RDKit.js Service - Chemical Intelligence Layer
 * Provides SMILES processing, 3D conformation generation, and property calculation
 */

// RDKit module type declarations
interface RDKitModule {
    get_mol: (input: string) => RDKitMolecule | null;
    get_mol_from_molblock: (molblock: string) => RDKitMolecule | null;
    version: () => string;
    prefer_coordgen: (prefer: boolean) => void;
}

interface RDKitMolecule {
    is_valid: () => boolean;
    get_smiles: () => string;
    get_molblock: () => string;
    get_v3Kmolblock: () => string;
    get_inchi: () => string;
    get_svg: (width?: number, height?: number) => string;
    get_svg_with_highlights: (details: string) => string;
    get_substruct_match: (query: RDKitMolecule) => string;
    get_descriptors: () => string;
    get_morgan_fp: (radius?: number, nBits?: number) => string;
    add_hs: () => boolean;
    remove_hs: () => boolean;
    normalize_depiction: (canonicalize?: number, scaleFactor?: number) => void;
    straighten_depiction: (minimize_rotation?: boolean) => void;
    condense_abbreviations: (maxCoverage?: number, contractDegree?: number) => boolean;
    set_new_coords: (useCoordGen?: boolean) => boolean;
    generate_aligned_coords: (template: RDKitMolecule, options?: string) => string;
    has_coords: () => number;
    get_num_atoms: () => number;
    delete: () => void;
}

// Molecular properties interface
export interface MolecularProperties {
    molecularWeight: number;
    exactMass: number;
    logP: number;
    tpsa: number;
    hbd: number;  // H-bond donors
    hba: number;  // H-bond acceptors
    rotatableBonds: number;
    rings: number;
    aromaticRings: number;
    heavyAtoms: number;
    formula: string;
    lipinskiViolations: number;
    drugLikeness: 'pass' | 'warning' | 'fail';
}

// Result interfaces
export interface SMILESParseResult {
    success: boolean;
    molecule?: RDKitMolecule;
    canonicalSmiles?: string;
    error?: string;
}

export interface ConformerResult {
    success: boolean;
    molblock?: string;
    pdbBlock?: string;
    error?: string;
}

class RDKitService {
    private rdkit: RDKitModule | null = null;
    private initPromise: Promise<void> | null = null;
    private isInitialized = false;

    /**
     * Initialize RDKit WASM module
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.doInit();
        return this.initPromise;
    }

    private async doInit(): Promise<void> {
        try {
            // Load RDKit from CDN - this is more reliable for browser usage
            // as it properly handles WASM loading
            const RDKIT_CDN_URL = 'https://unpkg.com/@rdkit/rdkit/dist/RDKit_minimal.js';

            // Check if already loaded
            if ((window as any).initRDKitModule) {
                console.log('RDKit already loaded, initializing...');
                this.rdkit = await (window as any).initRDKitModule();
                console.log(`RDKit.js initialized: version ${this.rdkit?.version()}`);
                this.isInitialized = true;
                return;
            }

            // Load the script
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement('script');
                script.src = RDKIT_CDN_URL;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load RDKit script from CDN'));
                document.head.appendChild(script);
            });

            // Wait a bit for the module to be available
            await new Promise(resolve => setTimeout(resolve, 100));

            // Initialize RDKit
            if (!(window as any).initRDKitModule) {
                throw new Error('initRDKitModule not found after loading script');
            }

            this.rdkit = await (window as any).initRDKitModule();
            console.log(`RDKit.js initialized: version ${this.rdkit?.version()}`);
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize RDKit:', error);
            throw new Error(`RDKit initialization failed: ${error}`);
        }
    }

    /**
     * Check if RDKit is ready
     */
    isReady(): boolean {
        return this.isInitialized && this.rdkit !== null;
    }

    /**
     * Parse a SMILES string into a molecule
     */
    parseSMILES(smiles: string): SMILESParseResult {
        if (!this.rdkit) {
            return { success: false, error: 'RDKit not initialized' };
        }

        try {
            const mol = this.rdkit.get_mol(smiles.trim());

            if (!mol || !mol.is_valid()) {
                mol?.delete();
                return { success: false, error: 'Invalid SMILES string' };
            }

            return {
                success: true,
                molecule: mol,
                canonicalSmiles: mol.get_smiles(),
            };
        } catch (error) {
            return { success: false, error: `Parse error: ${error}` };
        }
    }

    /**
     * Generate 3D conformer from molecule
     */
    generate3DConformer(mol: RDKitMolecule): ConformerResult {
        if (!this.rdkit) {
            return { success: false, error: 'RDKit not initialized' };
        }

        try {
            // Add hydrogens for proper 3D generation
            mol.add_hs();

            // Generate 3D coordinates
            // Note: In RDKit.js, we need to use set_new_coords with useCoordGen
            const success = mol.set_new_coords(true);

            if (!success) {
                return { success: false, error: 'Failed to generate 3D coordinates' };
            }

            // Get the 3D molblock
            const molblock = mol.get_molblock();

            // Convert to PDB-like format for viewer compatibility
            const pdbBlock = this.molblockToPDB(molblock);

            return {
                success: true,
                molblock,
                pdbBlock,
            };
        } catch (error) {
            return { success: false, error: `3D generation error: ${error}` };
        }
    }

    /**
     * Calculate molecular properties
     */
    calculateProperties(mol: RDKitMolecule): MolecularProperties | null {
        if (!this.rdkit) return null;

        try {
            const descriptorsJson = mol.get_descriptors();
            const descriptors = JSON.parse(descriptorsJson);

            const mw = descriptors.exactmw || descriptors.amw || 0;
            const logP = descriptors.CrippenClogP || 0;
            const tpsa = descriptors.tpsa || 0;
            const hbd = descriptors.NumHBD || 0;
            const hba = descriptors.NumHBA || 0;
            const rotBonds = descriptors.NumRotatableBonds || 0;

            // Calculate Lipinski violations
            let violations = 0;
            if (mw > 500) violations++;
            if (logP > 5) violations++;
            if (hbd > 5) violations++;
            if (hba > 10) violations++;

            return {
                molecularWeight: Math.round(mw * 100) / 100,
                exactMass: Math.round((descriptors.exactmw || mw) * 10000) / 10000,
                logP: Math.round(logP * 100) / 100,
                tpsa: Math.round(tpsa * 100) / 100,
                hbd,
                hba,
                rotatableBonds: rotBonds,
                rings: descriptors.NumRings || 0,
                aromaticRings: descriptors.NumAromaticRings || 0,
                heavyAtoms: descriptors.NumHeavyAtoms || mol.get_num_atoms(),
                formula: descriptors.formula || '',
                lipinskiViolations: violations,
                drugLikeness: violations === 0 ? 'pass' : violations <= 1 ? 'warning' : 'fail',
            };
        } catch (error) {
            console.error('Failed to calculate properties:', error);
            return null;
        }
    }

    /**
     * Generate 2D SVG depiction of molecule
     */
    getSVG(mol: RDKitMolecule, width = 300, height = 200): string {
        try {
            // Ensure we have 2D coordinates
            if (mol.has_coords() === 0) {
                mol.set_new_coords(false);
            }
            mol.normalize_depiction();
            return mol.get_svg(width, height);
        } catch (error) {
            console.error('Failed to generate SVG:', error);
            return '';
        }
    }

    /**
     * Get canonical SMILES from molecule
     */
    getCanonicalSMILES(mol: RDKitMolecule): string {
        return mol.get_smiles();
    }

    /**
     * Convert molblock to simple PDB format
     * This is a simplified conversion for visualization purposes
     */
    private molblockToPDB(molblock: string): string {
        const lines = molblock.split('\n');
        const pdbLines: string[] = [];

        // Skip header lines (first 4 lines in V2000 format)
        let atomSection = false;
        let atomIndex = 1;

        for (const line of lines) {
            if (line.includes('V2000') || line.includes('V3000')) {
                atomSection = true;
                continue;
            }

            if (line.startsWith('M  END')) break;

            if (atomSection && line.length >= 31) {
                // Parse atom line from molblock
                const x = parseFloat(line.substring(0, 10).trim());
                const y = parseFloat(line.substring(10, 20).trim());
                const z = parseFloat(line.substring(20, 30).trim());
                const symbol = line.substring(31, 34).trim();

                if (symbol && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    // Format as PDB ATOM record
                    const atomName = symbol.padEnd(4);
                    const pdbLine = `HETATM${atomIndex.toString().padStart(5)} ${atomName} LIG A   1    ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}  1.00  0.00          ${symbol.padStart(2)}`;
                    pdbLines.push(pdbLine);
                    atomIndex++;
                }
            }
        }

        pdbLines.push('END');
        return pdbLines.join('\n');
    }

    /**
     * Clean up molecule resources
     */
    disposeMolecule(mol: RDKitMolecule): void {
        try {
            mol.delete();
        } catch {
            // Ignore cleanup errors
        }
    }

    /**
     * Full pipeline: SMILES → 3D → Properties
     */
    async processSMILES(smiles: string): Promise<{
        success: boolean;
        canonicalSmiles?: string;
        molblock?: string;
        pdbBlock?: string;
        svg?: string;
        properties?: MolecularProperties;
        error?: string;
    }> {
        await this.initialize();

        const parseResult = this.parseSMILES(smiles);
        if (!parseResult.success || !parseResult.molecule) {
            return { success: false, error: parseResult.error };
        }

        const mol = parseResult.molecule;
        const svg = this.getSVG(mol);
        const properties = this.calculateProperties(mol);

        const conformerResult = this.generate3DConformer(mol);

        // Clean up
        this.disposeMolecule(mol);

        if (!conformerResult.success) {
            return {
                success: false,
                error: conformerResult.error,
                canonicalSmiles: parseResult.canonicalSmiles,
                svg,
                properties: properties || undefined,
            };
        }

        return {
            success: true,
            canonicalSmiles: parseResult.canonicalSmiles,
            molblock: conformerResult.molblock,
            pdbBlock: conformerResult.pdbBlock,
            svg,
            properties: properties || undefined,
        };
    }
}

// Singleton instance
export const rdkitService = new RDKitService();
