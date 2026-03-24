/**
 * PubChem Service - Fetch compounds from PubChem database
 * https://pubchem.ncbi.nlm.nih.gov/
 */

export interface PubChemFetchResult {
    success: boolean;
    cid?: number;
    content?: string;
    name?: string;
    format?: 'sdf' | 'pdb';
    error?: string;
    properties?: CompoundInfo;
}

export interface ADMEProperties {
    xLogP?: number;           // Lipophilicity - affects absorption
    tpsa?: number;            // Topological Polar Surface Area - affects permeability
    hBondDonors?: number;     // Hydrogen Bond Donor Count (Lipinski: ≤5)
    hBondAcceptors?: number;  // Hydrogen Bond Acceptor Count (Lipinski: ≤10)
    rotatableBonds?: number;  // Rotatable Bond Count (drug-likeness)
    complexity?: number;      // Molecular complexity
    heavyAtomCount?: number;  // Heavy atom count
}

export interface CompoundInfo {
    cid: number;
    name: string;
    formula?: string;
    molecularWeight?: number;
    smiles?: string;
    inchiKey?: string;
    adme?: ADMEProperties;
}

class PubChemService {
    private readonly PUBCHEM_BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

    /**
     * Fetch compound 3D structure by CID
     * @param cid - PubChem Compound ID number
     */
    async fetchByCID(cid: number | string): Promise<PubChemFetchResult> {
        const cidNum = typeof cid === 'string' ? parseInt(cid, 10) : cid;

        if (isNaN(cidNum) || cidNum <= 0) {
            return { success: false, error: 'Invalid CID. Must be a positive number.' };
        }

        try {
            // Try to get 3D SDF first
            const sdfUrl = `${this.PUBCHEM_BASE_URL}/compound/cid/${cidNum}/SDF?record_type=3d`;
            let response = await fetch(sdfUrl);

            if (response.ok) {
                const content = await response.text();
                const info = await this.getCompoundInfo(cidNum);
                return {
                    success: true,
                    cid: cidNum,
                    content,
                    name: info?.name || `CID ${cidNum}`,
                    format: 'sdf',
                    properties: info || undefined,
                };
            }

            // Fall back to 2D SDF if 3D not available
            const sdf2dUrl = `${this.PUBCHEM_BASE_URL}/compound/cid/${cidNum}/SDF`;
            response = await fetch(sdf2dUrl);

            if (response.ok) {
                const content = await response.text();
                const info = await this.getCompoundInfo(cidNum);
                return {
                    success: true,
                    cid: cidNum,
                    content,
                    name: info?.name || `CID ${cidNum}`,
                    format: 'sdf',
                    properties: info || undefined,
                };
            }

            if (response.status === 404) {
                return { success: false, error: `CID ${cidNum} not found in PubChem` };
            }

            return { success: false, error: `Failed to fetch compound: ${response.statusText}` };
        } catch (error) {
            return { success: false, error: `Network error: ${error}` };
        }
    }

    /**
     * Search compound by name and fetch structure
     * @param name - Compound name (e.g., "aspirin", "caffeine")
     */
    async fetchByName(name: string): Promise<PubChemFetchResult> {
        const trimmedName = name.trim();
        if (!trimmedName) {
            return { success: false, error: 'Please enter a compound name' };
        }

        try {
            // First, search for the compound to get CID
            const searchUrl = `${this.PUBCHEM_BASE_URL}/compound/name/${encodeURIComponent(trimmedName)}/cids/JSON`;
            const searchResponse = await fetch(searchUrl);

            if (!searchResponse.ok) {
                if (searchResponse.status === 404) {
                    return { success: false, error: `Compound "${trimmedName}" not found` };
                }
                return { success: false, error: `Search failed: ${searchResponse.statusText}` };
            }

            const searchData = await searchResponse.json();
            const cid = searchData.IdentifierList?.CID?.[0];

            if (!cid) {
                return { success: false, error: `No CID found for "${trimmedName}"` };
            }

            // Fetch the structure by CID
            return this.fetchByCID(cid);
        } catch (error) {
            return { success: false, error: `Network error: ${error}` };
        }
    }

    /**
     * Get compound information including ADME properties
     */
    async getCompoundInfo(cid: number): Promise<CompoundInfo | null> {
        try {
            // Fetch basic properties and ADME properties in one request
            const properties = [
                'Title', 'MolecularFormula', 'MolecularWeight', 'CanonicalSMILES', 'InChIKey',
                'XLogP', 'TPSA', 'HBondDonorCount', 'HBondAcceptorCount',
                'RotatableBondCount', 'Complexity', 'HeavyAtomCount'
            ].join(',');

            const url = `${this.PUBCHEM_BASE_URL}/compound/cid/${cid}/property/${properties}/JSON`;
            const response = await fetch(url);

            if (!response.ok) return null;

            const data = await response.json();
            const props = data.PropertyTable?.Properties?.[0];

            if (!props) return null;

            return {
                cid,
                name: props.Title || `CID ${cid}`,
                formula: props.MolecularFormula,
                molecularWeight: props.MolecularWeight ? parseFloat(props.MolecularWeight) : undefined,
                smiles: props.CanonicalSMILES,
                inchiKey: props.InChIKey,
                adme: {
                    xLogP: props.XLogP ? parseFloat(props.XLogP) : undefined,
                    tpsa: props.TPSA ? parseFloat(props.TPSA) : undefined,
                    hBondDonors: props.HBondDonorCount ? parseInt(props.HBondDonorCount) : undefined,
                    hBondAcceptors: props.HBondAcceptorCount ? parseInt(props.HBondAcceptorCount) : undefined,
                    rotatableBonds: props.RotatableBondCount ? parseInt(props.RotatableBondCount) : undefined,
                    complexity: props.Complexity ? parseFloat(props.Complexity) : undefined,
                    heavyAtomCount: props.HeavyAtomCount ? parseInt(props.HeavyAtomCount) : undefined,
                }
            };
        } catch {
            return null;
        }
    }

    /**
     * Search compounds by name (returns list of matches)
     */
    async searchCompounds(query: string, limit = 10): Promise<CompoundInfo[]> {
        try {
            const url = `${this.PUBCHEM_BASE_URL}/compound/name/${encodeURIComponent(query)}/cids/JSON?name_type=word`;
            const response = await fetch(url);

            if (!response.ok) return [];

            const data = await response.json();
            const cids = (data.IdentifierList?.CID || []).slice(0, limit);

            // Get info for each CID
            const results: CompoundInfo[] = [];
            for (const cid of cids) {
                const info = await this.getCompoundInfo(cid);
                if (info) results.push(info);
            }

            return results;
        } catch {
            return [];
        }
    }

    /**
     * Get compound by name or CID (auto-detect)
     */
    async fetchCompound(input: string): Promise<PubChemFetchResult> {
        const trimmed = input.trim();

        // Check if input is a number (CID)
        if (/^\d+$/.test(trimmed)) {
            return this.fetchByCID(parseInt(trimmed, 10));
        }

        // Otherwise treat as compound name
        return this.fetchByName(trimmed);
    }
}

export const pubchemService = new PubChemService();
