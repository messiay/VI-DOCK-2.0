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
/**
 * Convert PDB to PDBQT format with improved atom typing
 * Uses residue context to assign correct AutoDock types (A, OA, N, SA, etc.)
 */
export function pdbToPdbqt(pdbContent: string): string {
    const lines = pdbContent.split('\n');
    const outputLines: string[] = [];

    // Lookup table for standard amino acid atom types
    // Format: [Residue][AtomName] = AutoDockType
    const ATOM_TYPES: Record<string, Record<string, string>> = {
        // Backbone (applies to most, override for specific residues like PRO)
        'BACKBONE': {
            'N': 'N', 'CA': 'C', 'C': 'C', 'O': 'OA', 'OXT': 'OA'
        },
        // Aliphatic
        'ALA': { 'CB': 'C' },
        'VAL': { 'CB': 'C', 'CG1': 'C', 'CG2': 'C' },
        'LEU': { 'CB': 'C', 'CG': 'C', 'CD1': 'C', 'CD2': 'C' },
        'ILE': { 'CB': 'C', 'CG1': 'C', 'CG2': 'C', 'CD1': 'C' },
        'MET': { 'CB': 'C', 'CG': 'C', 'SD': 'SA', 'CE': 'C' },
        'PRO': { 'N': 'N', 'CA': 'C', 'CB': 'C', 'CG': 'C', 'CD': 'C', 'C': 'C', 'O': 'OA' },
        // Aromatic
        'PHE': { 'CB': 'C', 'CG': 'A', 'CD1': 'A', 'CD2': 'A', 'CE1': 'A', 'CE2': 'A', 'CZ': 'A' },
        'TYR': { 'CB': 'C', 'CG': 'A', 'CD1': 'A', 'CD2': 'A', 'CE1': 'A', 'CE2': 'A', 'CZ': 'A', 'OH': 'OA' },
        'TRP': { 'CB': 'C', 'CG': 'A', 'CD1': 'A', 'CD2': 'A', 'NE1': 'NA', 'CE2': 'A', 'CE3': 'A', 'CZ2': 'A', 'CZ3': 'A', 'CH2': 'A' },
        'HIS': { 'CB': 'C', 'CG': 'A', 'ND1': 'NA', 'CD2': 'A', 'CE1': 'A', 'NE2': 'NA' },
        // Polar
        'SER': { 'CB': 'C', 'OG': 'OA' },
        'THR': { 'CB': 'C', 'OG1': 'OA', 'CG2': 'C' },
        'CYS': { 'CB': 'C', 'SG': 'SA' },
        'ASN': { 'CB': 'C', 'CG': 'C', 'OD1': 'OA', 'ND2': 'NA' }, // ND2 denotes H-bond donor
        'GLN': { 'CB': 'C', 'CG': 'C', 'CD': 'C', 'OE1': 'OA', 'NE2': 'NA' },
        // Charged
        'ASP': { 'CB': 'C', 'CG': 'C', 'OD1': 'OA', 'OD2': 'OA' },
        'GLU': { 'CB': 'C', 'CG': 'C', 'CD': 'C', 'OE1': 'OA', 'OE2': 'OA' },
        'LYS': { 'CB': 'C', 'CG': 'C', 'CD': 'C', 'CE': 'C', 'NZ': 'N' }, // NZ is donor
        'ARG': { 'CB': 'C', 'CG': 'C', 'CD': 'C', 'NE': 'N', 'CZ': 'C', 'NH1': 'N', 'NH2': 'N' }
    };

    // Helper to get type
    const getAtomType = (resName: string, atomName: string): string => {
        // Normalize
        resName = resName.toUpperCase();
        atomName = atomName.toUpperCase();

        // Check specific residue definition
        if (ATOM_TYPES[resName] && ATOM_TYPES[resName][atomName]) {
            return ATOM_TYPES[resName][atomName];
        }

        // Check backbone
        const backbone = ATOM_TYPES['BACKBONE'];
        if (backbone[atomName]) return backbone[atomName];

        // Fallback: Infer from element
        const element = atomName.replace(/\d+$/, '').substring(0, 2).trim();
        const firstChar = atomName.charAt(0);

        switch (firstChar) {
            case 'C': return 'C';
            case 'N': return 'N';
            case 'O': return 'OA'; // Assume acceptor by default for unknown O
            case 'S': return 'SA';
            case 'H': return 'HD';
            case 'F': return 'F';
            case 'P': return 'P';
            case 'I': return 'I';
        }

        if (element === 'CL') return 'Cl';
        if (element === 'BR') return 'Br';

        return 'A'; // Default to A (Carbon-like) if unknown to avoid crashes? Or C? Let's use C.
    };

    for (const line of lines) {
        // Skip empty or very short lines
        if (line.length < 54) continue;

        // For receptors, only keep standard amino acids (ATOM records)
        // Skip HETATM entirely - these include ligands, nucleotides, etc. that cause Vina issues
        if (line.startsWith('HETATM')) continue;

        if (line.startsWith('ATOM')) {
            const atomName = line.substring(12, 16).trim();
            const resName = line.substring(17, 20).trim();

            // Skip hydrogen atoms
            if (atomName.startsWith('H') || atomName.match(/^\d*H/)) continue;

            // Only keep standard amino acids
            const standardAminoAcids = [
                'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
                'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
                'HID', 'HIE', 'HIP', 'CYX', 'ASH', 'GLH', 'LYN' // Modified residues
            ];
            if (!standardAminoAcids.includes(resName.toUpperCase())) continue;

            // Extract and validate coordinates
            const xStr = line.substring(30, 38).trim();
            const yStr = line.substring(38, 46).trim();
            const zStr = line.substring(46, 54).trim();

            const x = parseFloat(xStr);
            const y = parseFloat(yStr);
            const z = parseFloat(zStr);

            // Skip if coordinates are not valid numbers
            if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

            const vinaAtomType = getAtomType(resName, atomName);

            // Extract other fields safely
            const recordName = line.substring(0, 6);
            const serial = line.substring(6, 11);
            const name = line.substring(12, 16);
            const altLoc = line.length > 16 ? line.substring(16, 17) : ' ';
            const res = line.substring(17, 20);
            const chain = line.length > 21 ? line.substring(21, 22) : ' ';
            const resSeq = line.substring(22, 26);
            const insCode = line.length > 26 ? line.substring(26, 27) : ' ';

            // Construct PDBQT line with proper formatting
            // Format: ATOM  serial name altLoc res chain resSeq insCode    x       y       z     occ  temp    charge type
            const pdbqtLine =
                recordName.padEnd(6) +
                serial.padStart(5) + ' ' +
                name.padEnd(4) +
                altLoc +
                res.padEnd(3) + ' ' +
                chain +
                resSeq.padStart(4) +
                insCode + '   ' +
                xStr.padStart(8) +
                yStr.padStart(8) +
                zStr.padStart(8) +
                '  1.00' +
                '  0.00' +
                '    ' +
                ' 0.000' +
                ' ' +
                vinaAtomType.padEnd(2);

            outputLines.push(pdbqtLine);

        }
        // Skip TER, END, and all other record types during the loop
    }

    // Add final TER and END (matching working example format)
    if (outputLines.length > 0) {
        outputLines.push('TER');
        outputLines.push('END');
    }

    // Use CRLF for Windows compatibility with Vina
    return outputLines.join('\r\n') + '\r\n';
}

/**
 * Validate if content is valid PDBQT format
 */
export function isValidPdbqt(content: string): boolean {
    const lines = content.split('\n');
    let hasAtoms = false;
    let hasPdbSpecificTags = false;

    for (const line of lines) {
        // Vina fails on these standard PDB tags
        if (line.startsWith('HEADER') || line.startsWith('COMPND') || line.startsWith('SOURCE') || line.startsWith('SEQRES')) {
            hasPdbSpecificTags = true;
        }

        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
            hasAtoms = true;
            // Check minimum line length for PDBQT
            if (line.length < 77) {
                return false;
            }

            // Strict PDBQT check: Columns 71-76 (index 70-76) must be Partial Charge (float)
            // In standard PDB, this is usually empty (SegID) or text.
            const chargeStr = line.substring(70, 76).trim();
            const charge = parseFloat(chargeStr);

            // If it's not a number (and not just "0.00" which parsses), it's likely a PDB
            if (chargeStr === '' || isNaN(charge)) {
                return false;
            }
        }
    }

    // It must have atoms and NOT have standard PDB headers to be considered ready-to-use PDBQT
    return hasAtoms && !hasPdbSpecificTags;
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
