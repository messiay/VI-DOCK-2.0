interface Atom {
    x: number;
    y: number;
    z: number;
}

/**
 * Parse atoms from PDBQT content
 */
export function parseAtomsFromPdbqt(pdbqt: string): Atom[] {
    const atoms: Atom[] = [];
    const lines = pdbqt.split('\n');

    for (const line of lines) {
        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
            const x = parseFloat(line.substring(30, 38).trim());
            const y = parseFloat(line.substring(38, 46).trim());
            const z = parseFloat(line.substring(46, 54).trim());

            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                atoms.push({ x, y, z });
            }
        }
    }

    return atoms;
}

/**
 * Calculate bounding box from atoms
 */
export function calculateBoundingBox(atoms: Atom[]): {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
} {
    if (atoms.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const atom of atoms) {
        minX = Math.min(minX, atom.x);
        maxX = Math.max(maxX, atom.x);
        minY = Math.min(minY, atom.y);
        maxY = Math.max(maxY, atom.y);
        minZ = Math.min(minZ, atom.z);
        maxZ = Math.max(maxZ, atom.z);
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
}

/**
 * Calculate gridbox parameters from ligand atoms
 * Adds a padding around the ligand for the search space
 */
export function calculateGridbox(ligandPdbqt: string, padding: number = 5): {
    centerX: number;
    centerY: number;
    centerZ: number;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
} {
    const atoms = parseAtomsFromPdbqt(ligandPdbqt);

    if (atoms.length === 0) {
        return {
            centerX: 0,
            centerY: 0,
            centerZ: 0,
            sizeX: 20,
            sizeY: 20,
            sizeZ: 20,
        };
    }

    const bbox = calculateBoundingBox(atoms);

    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;
    const centerZ = (bbox.minZ + bbox.maxZ) / 2;

    const sizeX = (bbox.maxX - bbox.minX) + (padding * 2);
    const sizeY = (bbox.maxY - bbox.minY) + (padding * 2);
    const sizeZ = (bbox.maxZ - bbox.minZ) + (padding * 2);

    return {
        centerX: Math.round(centerX * 100) / 100,
        centerY: Math.round(centerY * 100) / 100,
        centerZ: Math.round(centerZ * 100) / 100,
        sizeX: Math.round(Math.max(sizeX, 10) * 100) / 100,
        sizeY: Math.round(Math.max(sizeY, 10) * 100) / 100,
        sizeZ: Math.round(Math.max(sizeZ, 10) * 100) / 100,
    };
}

/**
 * Calculate gridbox from receptor focusing on a specific region
 */
export function calculateGridboxFromReceptor(
    receptorPdbqt: string,
    ligandPdbqt?: string,
    padding: number = 10
): {
    centerX: number;
    centerY: number;
    centerZ: number;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
} {
    // If ligand is provided, use it for the gridbox
    if (ligandPdbqt) {
        return calculateGridbox(ligandPdbqt, padding);
    }

    // Otherwise, calculate center from receptor
    const atoms = parseAtomsFromPdbqt(receptorPdbqt);

    if (atoms.length === 0) {
        return {
            centerX: 0,
            centerY: 0,
            centerZ: 0,
            sizeX: 30,
            sizeY: 30,
            sizeZ: 30,
        };
    }

    const bbox = calculateBoundingBox(atoms);

    return {
        centerX: Math.round((bbox.minX + bbox.maxX) / 2 * 100) / 100,
        centerY: Math.round((bbox.minY + bbox.maxY) / 2 * 100) / 100,
        centerZ: Math.round((bbox.minZ + bbox.maxZ) / 2 * 100) / 100,
        sizeX: 30,
        sizeY: 30,
        sizeZ: 30,
    };
}

/**
 * BLIND DOCKING: Calculate gridbox covering the entire receptor
 * Searches the whole protein surface for binding sites
 */
export function calculateBlindDockingBox(receptorPdbqt: string, padding: number = 10): {
    centerX: number;
    centerY: number;
    centerZ: number;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
} {
    const atoms = parseAtomsFromPdbqt(receptorPdbqt);

    if (atoms.length === 0) {
        return {
            centerX: 0,
            centerY: 0,
            centerZ: 0,
            sizeX: 60,
            sizeY: 60,
            sizeZ: 60,
        };
    }

    const bbox = calculateBoundingBox(atoms);

    // Calculate center of the entire protein
    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;
    const centerZ = (bbox.minZ + bbox.maxZ) / 2;

    // Calculate size to cover entire protein + padding
    const sizeX = (bbox.maxX - bbox.minX) + (padding * 2);
    const sizeY = (bbox.maxY - bbox.minY) + (padding * 2);
    const sizeZ = (bbox.maxZ - bbox.minZ) + (padding * 2);

    return {
        centerX: Math.round(centerX * 100) / 100,
        centerY: Math.round(centerY * 100) / 100,
        centerZ: Math.round(centerZ * 100) / 100,
        sizeX: Math.round(sizeX * 100) / 100,
        sizeY: Math.round(sizeY * 100) / 100,
        sizeZ: Math.round(sizeZ * 100) / 100,
    };
}

/**
 * AUTOSITE DETECTION: Find potential binding pockets using geometric analysis
 * Uses a simplified cavity detection algorithm suitable for browser execution
 */
export function detectBindingPocket(receptorPdbqt: string): {
    centerX: number;
    centerY: number;
    centerZ: number;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
    confidence: number;
    pocketType: string;
} | null {
    const atoms = parseAtomsFromPdbqt(receptorPdbqt);

    if (atoms.length < 10) {
        return null;
    }

    const bbox = calculateBoundingBox(atoms);
    const gridSpacing = 3.0; // Angstroms - coarse grid for performance

    // Create a 3D grid
    const gridSizeX = Math.ceil((bbox.maxX - bbox.minX) / gridSpacing) + 2;
    const gridSizeY = Math.ceil((bbox.maxY - bbox.minY) / gridSpacing) + 2;
    const gridSizeZ = Math.ceil((bbox.maxZ - bbox.minZ) / gridSpacing) + 2;

    // Mark occupied grid points
    const occupied = new Set<string>();

    for (const atom of atoms) {
        const gx = Math.floor((atom.x - bbox.minX) / gridSpacing);
        const gy = Math.floor((atom.y - bbox.minY) / gridSpacing);
        const gz = Math.floor((atom.z - bbox.minZ) / gridSpacing);

        // Mark this and neighboring cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const key = `${gx + dx},${gy + dy},${gz + dz}`;
                    occupied.add(key);
                }
            }
        }
    }

    // Find cavity points (empty cells surrounded by occupied cells)
    interface CavityPoint {
        x: number;
        y: number;
        z: number;
        enclosure: number;
    }

    const cavityPoints: CavityPoint[] = [];

    for (let gx = 1; gx < gridSizeX - 1; gx++) {
        for (let gy = 1; gy < gridSizeY - 1; gy++) {
            for (let gz = 1; gz < gridSizeZ - 1; gz++) {
                const key = `${gx},${gy},${gz}`;

                if (!occupied.has(key)) {
                    // Count occupied neighbors (enclosure score)
                    let enclosure = 0;
                    for (let dx = -2; dx <= 2; dx++) {
                        for (let dy = -2; dy <= 2; dy++) {
                            for (let dz = -2; dz <= 2; dz++) {
                                if (dx === 0 && dy === 0 && dz === 0) continue;
                                const neighborKey = `${gx + dx},${gy + dy},${gz + dz}`;
                                if (occupied.has(neighborKey)) {
                                    enclosure++;
                                }
                            }
                        }
                    }

                    // Only consider points with sufficient enclosure (potential pockets)
                    if (enclosure >= 30) {
                        cavityPoints.push({
                            x: bbox.minX + gx * gridSpacing,
                            y: bbox.minY + gy * gridSpacing,
                            z: bbox.minZ + gz * gridSpacing,
                            enclosure,
                        });
                    }
                }
            }
        }
    }

    if (cavityPoints.length === 0) {
        // Fallback: use center of protein with default size
        return {
            centerX: Math.round((bbox.minX + bbox.maxX) / 2 * 100) / 100,
            centerY: Math.round((bbox.minY + bbox.maxY) / 2 * 100) / 100,
            centerZ: Math.round((bbox.minZ + bbox.maxZ) / 2 * 100) / 100,
            sizeX: 25,
            sizeY: 25,
            sizeZ: 25,
            confidence: 0.3,
            pocketType: 'center-fallback',
        };
    }

    // Cluster cavity points to find distinct pockets
    // Simple approach: find the densest region
    let bestPoint = cavityPoints[0];
    let maxScore = 0;

    for (const point of cavityPoints) {
        // Score based on how many other cavity points are nearby
        let clusterScore = point.enclosure;
        for (const other of cavityPoints) {
            const dist = Math.sqrt(
                Math.pow(point.x - other.x, 2) +
                Math.pow(point.y - other.y, 2) +
                Math.pow(point.z - other.z, 2)
            );
            if (dist < 10) {
                clusterScore += other.enclosure / (dist + 1);
            }
        }

        if (clusterScore > maxScore) {
            maxScore = clusterScore;
            bestPoint = point;
        }
    }

    // Calculate pocket bounding box from nearby cavity points
    const nearbyPoints = cavityPoints.filter(p => {
        const dist = Math.sqrt(
            Math.pow(p.x - bestPoint.x, 2) +
            Math.pow(p.y - bestPoint.y, 2) +
            Math.pow(p.z - bestPoint.z, 2)
        );
        return dist < 15;
    });

    const pocketBbox = calculateBoundingBox(nearbyPoints.map(p => ({ x: p.x, y: p.y, z: p.z })));

    const pocketCenterX = (pocketBbox.minX + pocketBbox.maxX) / 2;
    const pocketCenterY = (pocketBbox.minY + pocketBbox.maxY) / 2;
    const pocketCenterZ = (pocketBbox.minZ + pocketBbox.maxZ) / 2;

    const pocketSizeX = Math.max((pocketBbox.maxX - pocketBbox.minX) + 8, 20);
    const pocketSizeY = Math.max((pocketBbox.maxY - pocketBbox.minY) + 8, 20);
    const pocketSizeZ = Math.max((pocketBbox.maxZ - pocketBbox.minZ) + 8, 20);

    // Calculate confidence based on pocket quality
    const confidence = Math.min(nearbyPoints.length / 20, 1.0);

    return {
        centerX: Math.round(pocketCenterX * 100) / 100,
        centerY: Math.round(pocketCenterY * 100) / 100,
        centerZ: Math.round(pocketCenterZ * 100) / 100,
        sizeX: Math.round(pocketSizeX * 100) / 100,
        sizeY: Math.round(pocketSizeY * 100) / 100,
        sizeZ: Math.round(pocketSizeZ * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        pocketType: confidence > 0.7 ? 'deep-cavity' : confidence > 0.4 ? 'surface-pocket' : 'shallow-cleft',
    };
}

