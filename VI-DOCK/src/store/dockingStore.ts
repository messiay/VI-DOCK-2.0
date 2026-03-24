import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DockingState, DockingParams, MoleculeFile, DockingResult, TabId, MDParams } from '../types';

const defaultParams: DockingParams = {
    centerX: 0,
    centerY: 0,
    centerZ: 0,
    sizeX: 20,
    sizeY: 20,
    sizeZ: 20,
    cpus: navigator.hardwareConcurrency || 4,
    exhaustiveness: 8,
    numModes: 9,
    energyRange: 3,
    seed: null,
    localOnly: false,
    scoreOnly: false,
    randomizeInput: false,
};

const defaultMDParams: MDParams = {
    forcefield: 'amber14-all.xml',
    waterModel: 'amber14/tip3p.xml',
    solvate: true,
    addIons: true,
    tempK: 300,
    simulationTimeNs: 1.0,
    reportIntervalPs: 10.0,
    minimize: true,
};

export type DockingEngine = 'vina' | 'smina';

interface DockingStore extends DockingState {
    // Actions
    setReceptorFile: (file: MoleculeFile | null) => void;
    setLigandFile: (file: MoleculeFile | null) => void;
    setCorrectPoseFile: (file: MoleculeFile | null) => void;

    // Engine Selection
    dockingEngine: DockingEngine;
    setDockingEngine: (engine: DockingEngine) => void;

    // View State
    viewMode: 'cartoon' | 'sticks' | 'surface';
    resetViewTrigger: number;
    setViewMode: (mode: 'cartoon' | 'sticks' | 'surface') => void;
    triggerResetView: () => void;

    // Theme (Apple-Grade Scientific)
    theme: 'dark' | 'light';
    toggleTheme: () => void;

    // Visual Settings
    showBox: boolean;
    showGrid: boolean;
    showAxes: boolean;
    toggleVisual: (visual: 'grid' | 'axes' | 'box') => void;

    setParams: (params: Partial<DockingParams>) => void;
    resetParams: () => void;

    setRunning: (running: boolean) => void;
    setProgress: (progress: number) => void;
    setStatusMessage: (message: string) => void;
    addConsoleOutput: (line: string) => void;
    clearConsoleOutput: () => void;

    setResult: (result: DockingResult | null) => void;
    setSelectedPose: (pose: number) => void;

    setActiveTab: (tab: TabId) => void;

    mdParams: MDParams;
    setMDParams: (params: Partial<MDParams>) => void;

    mdInputFile: MoleculeFile | null;
    setMDInputFile: (file: MoleculeFile | null) => void;

    startOver: () => void;
}

export const useDockingStore = create<DockingStore>()(
    persist(
        (set) => ({
            // Initial state
            receptorFile: null,
            ligandFile: null,
            correctPoseFile: null,

            dockingEngine: 'vina', // Default to AutoDock Vina

            params: { ...defaultParams },

            isRunning: false,
            progress: 0,
            statusMessage: '',
            consoleOutput: [],

            result: null,
            selectedPose: 0,
            viewMode: 'cartoon',
            resetViewTrigger: 0,

            activeTab: 'landing',

            // Visual Settings Defaults
            showBox: true,
            showGrid: true,
            showAxes: true,

            // MD defaults
            mdParams: { ...defaultMDParams },
            mdInputFile: null,

            // Actions
            setReceptorFile: (file) => set({ receptorFile: file, result: null, selectedPose: 0 }),
            setLigandFile: (file) => set({ ligandFile: file, result: null, selectedPose: 0 }),
            setCorrectPoseFile: (file) => set({ correctPoseFile: file }),
            setDockingEngine: (engine) => set({ dockingEngine: engine }),

            setParams: (params) => set((state) => ({
                params: { ...state.params, ...params }
            })),
            resetParams: () => set({ params: { ...defaultParams } }),

            toggleVisual: (visual) => set((state) => {
                if (visual === 'grid') return { showGrid: !state.showGrid };
                if (visual === 'axes') return { showAxes: !state.showAxes };
                if (visual === 'box') return { showBox: !state.showBox };
                return {};
            }),

            setRunning: (isRunning) => set({ isRunning }),
            setProgress: (progress) => set({ progress }),
            setStatusMessage: (statusMessage) => set({ statusMessage }),
            addConsoleOutput: (line) => set((state) => ({
                consoleOutput: [...state.consoleOutput, line]
            })),
            clearConsoleOutput: () => set({ consoleOutput: [] }),

            setResult: (result) => {
                console.info('[SimDock] setResult called with', result?.poses?.length ?? 0, 'poses');
                set({ result });
            },
            setSelectedPose: (selectedPose) => set({ selectedPose }),

            setActiveTab: (activeTab) => set({ activeTab }),

            setMDParams: (params) => set((state: any) => ({
                mdParams: { ...state.mdParams, ...params }
            })),

            setMDInputFile: (file) => set({ mdInputFile: file }),

            startOver: () => set({
                receptorFile: null,
                ligandFile: null,
                correctPoseFile: null,
                params: { ...defaultParams },
                isRunning: false,
                progress: 0,
                statusMessage: '',
                consoleOutput: [],
                result: null,
                selectedPose: 0,
                activeTab: 'landing',
                viewMode: 'cartoon',
                resetViewTrigger: 0,
                showBox: true,
                showGrid: true,
                showAxes: true,
            }),

            // View Actions
            setViewMode: (mode) => set({ viewMode: mode }),
            triggerResetView: () => set((state) => ({ resetViewTrigger: state.resetViewTrigger + 1 })),

            // Theme State
            theme: 'light' as const,
            toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
        }),
        {
            name: 'simdock-docking-state',
            // Exclude transient state from persistence
            // Note: result is NOT persisted to avoid loading corrupted pose data
            partialize: (state) => ({
                // Files are too large to persist in localStorage (causes freezing)
                // receptorFile: state.receptorFile,
                // ligandFile: state.ligandFile,
                // correctPoseFile: state.correctPoseFile,
                params: state.params,
                // result: state.result, // Excluded
                // selectedPose: state.selectedPose, // Excluded
                viewMode: state.viewMode,
                activeTab: state.activeTab,
                showBox: state.showBox,
                showGrid: state.showGrid,
                showAxes: state.showAxes,
                theme: state.theme,
            }),
            version: 3, // Clear old state to ensure Landing Screen loads
        }
    )
);

