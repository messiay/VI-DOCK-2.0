// Docking parameters
export interface DockingParams {
    // Box parameters
    centerX: number;
    centerY: number;
    centerZ: number;
    sizeX: number;
    sizeY: number;
    sizeZ: number;

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
    dockingEngine?: 'vina' | 'smina';
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

export interface SavedProject {
    id: string;
    name: string;
    username: string;
    timestamp: number;
    data: {
        receptorFile: MoleculeFile | null;
        ligandFile: MoleculeFile | null;
        params: DockingParams;
        result: DockingResult | null;
        viewMode: 'cartoon' | 'sticks' | 'surface';
    };
}

// File data
export interface MoleculeFile {
    name: string;
    content: string;
    format: string;
    loading?: boolean;
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
    // UI
    activeTab: TabId;
}

// Tab definitions
export type TabId = 'landing' | 'prep' | 'input' | 'existing' | 'running' | 'output' | 'projects' | 'batch';

export interface TabDefinition {
    id: TabId;
    label: string;
    icon: string;
}
