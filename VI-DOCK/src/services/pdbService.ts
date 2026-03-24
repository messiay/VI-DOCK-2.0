/**
 * PDB Service - Fetch structures from RCSB Protein Data Bank
 * https://www.rcsb.org/
 */

export interface PDBFetchResult {
    success: boolean;
    pdbId?: string;
    content?: string;
    title?: string;
    error?: string;
}

export interface PDBInfo {
    pdbId: string;
    title: string;
    organism?: string;
    resolution?: number;
    releaseDate?: string;
}

class PDBService {
    private readonly RCSB_BASE_URL = 'https://files.rcsb.org/download';
    private readonly RCSB_API_URL = 'https://data.rcsb.org/rest/v1/core/entry';

    /**
     * Fetch PDB file by ID
     * @param pdbId - 4-character PDB ID (e.g., "1A7H")
     */
    async fetchPDB(pdbId: string): Promise<PDBFetchResult> {
        // Validate PDB ID format (4 alphanumeric characters)
        const normalizedId = pdbId.trim().toUpperCase();
        if (!/^[A-Z0-9]{4}$/.test(normalizedId)) {
            return { success: false, error: 'Invalid PDB ID format. Must be 4 characters (e.g., 1A7H)' };
        }

        try {
            // Fetch PDB file
            const pdbUrl = `${this.RCSB_BASE_URL}/${normalizedId}.pdb`;
            const response = await fetch(pdbUrl);

            if (!response.ok) {
                if (response.status === 404) {
                    return { success: false, error: `PDB ID "${normalizedId}" not found` };
                }
                return { success: false, error: `Failed to fetch PDB: ${response.statusText}` };
            }

            const content = await response.text();

            // Extract title from PDB file
            const titleMatch = content.match(/^TITLE\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1].trim() : normalizedId;

            return {
                success: true,
                pdbId: normalizedId,
                content,
                title,
            };
        } catch (error) {
            return { success: false, error: `Network error: ${error}` };
        }
    }

    /**
     * Get PDB entry info from API
     */
    async getPDBInfo(pdbId: string): Promise<PDBInfo | null> {
        const normalizedId = pdbId.trim().toUpperCase();

        try {
            const response = await fetch(`${this.RCSB_API_URL}/${normalizedId}`);
            if (!response.ok) return null;

            const data = await response.json();

            return {
                pdbId: normalizedId,
                title: data.struct?.title || normalizedId,
                organism: data.rcsb_entry_info?.polymer_entity_count_protein
                    ? data.polymer_entities?.[0]?.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name
                    : undefined,
                resolution: data.rcsb_entry_info?.resolution_combined?.[0],
                releaseDate: data.rcsb_accession_info?.initial_release_date,
            };
        } catch {
            return null;
        }
    }

    /**
     * Search for PDB entries by keyword
     */
    async searchPDB(query: string, limit = 10): Promise<string[]> {
        try {
            const searchUrl = 'https://search.rcsb.org/rcsbsearch/v2/query';
            const searchQuery = {
                query: {
                    type: 'terminal',
                    service: 'full_text',
                    parameters: {
                        value: query,
                    },
                },
                return_type: 'entry',
                request_options: {
                    paginate: {
                        start: 0,
                        rows: limit,
                    },
                },
            };

            const response = await fetch(searchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(searchQuery),
            });

            if (!response.ok) return [];

            const data = await response.json();
            return data.result_set?.map((r: { identifier: string }) => r.identifier) || [];
        } catch {
            return [];
        }
    }
}

export const pdbService = new PDBService();
