// Docking parameters
export interface DockingParams {
    // Box parameters
    centerX: number;
    centerY: number;
    centerZ: number;
    sizeX: number;
    sizeY: number;
    sizeZ: number;

    // Engine
    dockingEngine?: 'vina' | 'smina';

    // Vina parameters
    cpus: number;
    exhaustiveness: number;
    numModes: number;
    energyRange: number;
    seed: number | null;

    // Advanced options
    localOnly: boolean;
    scoreOnly: boolean;
    randomizeInput: boolean;
}

// Molecular Dynamics parameters
export interface MDParams {
    forcefield: string;
    waterModel: string;
    solvate: boolean;
    addIons: boolean;
    tempK: number;
    simulationTimeNs: number;
    reportIntervalPs: number;
    minimize: boolean;
}

// Docking result pose
export interface DockingPose {
    mode: number;
    affinity: number;
    rmsdLB: number;
    rmsdUB: number;
    pdbqt: string;
}

// Docking results
export interface DockingResult {
    poses: DockingPose[];
    rawOutput: string;
    logOutput: string;
}

// File data
export interface MoleculeFile {
    name: string;
    content: string;
    format: string;
}

// Application state
export interface DockingState {
    // Files
    receptorFile: MoleculeFile | null;
    ligandFile: MoleculeFile | null;
    correctPoseFile: MoleculeFile | null;

    // Parameters
    params: DockingParams;

    // Status
    isRunning: boolean;
    progress: number;
    statusMessage: string;
    consoleOutput: string[];

    // Results
    result: DockingResult | null;
    selectedPose: number;

    // UI
    activeTab: 'prep' | 'input' | 'existing' | 'running' | 'output';
}

// Tab definitions
export type TabId = 'landing' | 'prep' | 'input' | 'existing' | 'running' | 'output' | 'projects' | 'batch' | 'md';

export interface TabDefinition {
    id: TabId;
    label: string;
    icon: string;
}
