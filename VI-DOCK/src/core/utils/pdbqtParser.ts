/**
 * Parse PDBQT file format
 */
export interface PdbqtAtom {
    recordType: string;
    serial: number;
    name: string;
    altLoc: string;
    resName: string;
    chainId: string;
    resSeq: number;
    iCode: string;
    x: number;
    y: number;
    z: number;
    occupancy: number;
    tempFactor: number;
    partialCharge: number;
    atomType: string;
}

/**
 * Parse a PDBQT file and extract atoms
 */
export function parsePdbqt(content: string): PdbqtAtom[] {
    const atoms: PdbqtAtom[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
            try {
                const atom: PdbqtAtom = {
                    recordType: line.substring(0, 6).trim(),
                    serial: parseInt(line.substring(6, 11).trim(), 10),
                    name: line.substring(12, 16).trim(),
                    altLoc: line.substring(16, 17).trim(),
                    resName: line.substring(17, 20).trim(),
                    chainId: line.substring(21, 22).trim(),
                    resSeq: parseInt(line.substring(22, 26).trim(), 10),
                    iCode: line.substring(26, 27).trim(),
                    x: parseFloat(line.substring(30, 38).trim()),
                    y: parseFloat(line.substring(38, 46).trim()),
                    z: parseFloat(line.substring(46, 54).trim()),
                    occupancy: parseFloat(line.substring(54, 60).trim()) || 1.0,
                    tempFactor: parseFloat(line.substring(60, 66).trim()) || 0.0,
                    partialCharge: parseFloat(line.substring(70, 76).trim()) || 0.0,
                    atomType: line.substring(77, 79).trim(),
                };
                atoms.push(atom);
            } catch {
                // Skip malformed lines
                continue;
            }
        }
    }

    return atoms;
}

/**
 * Convert PDB to basic PDBQT format
 * Note: This is a simplified conversion - real conversion requires proper
 * charge assignment and atom type detection (typically done by Open Babel)
 */
export function pdbToPdbqt(pdbContent: string): string {
    const lines = pdbContent.split('\n');
    const outputLines: string[] = [];

    for (const line of lines) {
        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
            // Extract atom info
            const atomName = line.substring(12, 16).trim();

            // Determine atom type from atom name (simplified)
            let atomType = atomName.charAt(0);
            if (atomName.length > 1 && /[A-Z]/.test(atomName.charAt(1))) {
                atomType = atomName.substring(0, 2);
            }

            // Map common atom types
            const atomTypeMap: { [key: string]: string } = {
                'C': 'C',
                'CA': 'C',
                'CB': 'C',
                'N': 'N',
                'O': 'O',
                'S': 'S',
                'H': 'HD',
                'P': 'P',
                'CL': 'Cl',
                'BR': 'Br',
                'F': 'F',
                'I': 'I',
            };

            const vinaAtomType = atomTypeMap[atomType.toUpperCase()] || atomType;

            // Build PDBQT line (add charges and atom type columns)
            // Pad to 70 chars, add charge (0.000) and atom type
            let pdbqtLine = line.padEnd(70, ' ');
            pdbqtLine = pdbqtLine.substring(0, 70) + ' 0.000 ' + vinaAtomType.padEnd(2, ' ');

            outputLines.push(pdbqtLine);
        } else if (line.startsWith('TER') || line.startsWith('END')) {
            outputLines.push(line);
        }
    }

    return outputLines.join('\n');
}

/**
 * Validate if content is valid PDBQT format
 */
export function isValidPdbqt(content: string): boolean {
    const lines = content.split('\n');
    let hasAtoms = false;

    for (const line of lines) {
        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
            hasAtoms = true;
            // Check minimum line length for PDBQT (should have atom type column)
            if (line.length < 77) {
                return false;
            }
        }
    }

    return hasAtoms;
}

/**
 * Remove non-protein atoms from PDBQT (waters, ions, ligands)
 */
export function removeNonProteinAtoms(pdbqtContent: string): string {
    const proteinResidues = new Set([
        'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
        'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
        // Modified residues
        'HID', 'HIE', 'HIP', 'CYX', 'ASH', 'GLH', 'LYN',
    ]);

    const lines = pdbqtContent.split('\n');
    const outputLines: string[] = [];

    for (const line of lines) {
        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
            const resName = line.substring(17, 20).trim();
            if (proteinResidues.has(resName)) {
                outputLines.push(line);
            }
        } else if (!line.startsWith('HETATM')) {
            // Keep non-HETATM records (like TER, END, etc.)
            outputLines.push(line);
        }
    }

    return outputLines.join('\n');
}
