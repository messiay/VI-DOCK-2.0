/**
 * OpenBabel Service - Minimal Stub for API-Only UI
 * 
 * This file now only exports format definitions used by the UI.
 * All actual conversions are handled by the backend API.
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

// Format definitions for UI dropdowns
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

/**
 * @deprecated Use apiService instead for conversions.
 * This stub is kept for backward compatibility with format definitions.
 */
class OpenBabelService {
    isReady(): boolean {
        return false; // WASM disabled, use API
    }

    hasNativeSupport(): boolean {
        return false;
    }

    async convert(): Promise<ConversionResult> {
        return {
            success: false,
            error: 'WASM disabled. Use apiService for conversions.'
        };
    }

    detectFormat(filename: string): SupportedInputFormat | null {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext && ['pdb', 'sdf', 'mol', 'mol2', 'xyz', 'cif'].includes(ext)) {
            return ext as SupportedInputFormat;
        }
        return null;
    }
}

export const openBabelService = new OpenBabelService();
