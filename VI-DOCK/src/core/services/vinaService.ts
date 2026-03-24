import type { DockingParams, DockingResult } from '../types';

// Worker message types
export interface DockingRequest {
    type: 'dock';
    receptorPdbqt: string;
    ligandPdbqt: string;
    params: DockingParams;
}

export interface DockingProgress {
    type: 'progress';
    message: string;
    progress: number;
}

export interface DockingComplete {
    type: 'complete';
    result: DockingResult;
}

export interface DockingError {
    type: 'error';
    message: string;
}

export type WorkerMessage = DockingRequest;
export type WorkerResponse = DockingProgress | DockingComplete | DockingError;

/**
 * VinaService - Wrapper for the Vina WebAssembly module
 * Uses a Web Worker to run docking in the background
 */
class VinaService {
    private worker: Worker | null = null;
    private isInitialized = false;

    /**
     * Initialize the Vina service by loading the WASM module
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // Check for SharedArrayBuffer support (required for threading)
        if (typeof SharedArrayBuffer === 'undefined') {
            throw new Error(
                'SharedArrayBuffer is not available. ' +
                'Please ensure the page is served with proper CORS headers: ' +
                'Cross-Origin-Embedder-Policy: require-corp, ' +
                'Cross-Origin-Opener-Policy: same-origin'
            );
        }

        this.isInitialized = true;
    }

    /**
     * Run molecular docking
     */
    async runDocking(
        receptorPdbqt: string,
        ligandPdbqt: string,
        params: DockingParams,
        onProgress?: (message: string, progress: number) => void
    ): Promise<DockingResult> {
        await this.initialize();

        return new Promise((resolve, reject) => {
            // Create a new CLASSIC worker for this docking run
            // Must be a classic (non-module) worker to support Aioli's importScripts
            this.worker = new Worker('/dockingWorker.js');

            this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                const data = event.data;

                switch (data.type) {
                    case 'progress':
                        onProgress?.(data.message, data.progress);
                        break;

                    case 'complete':
                        this.cleanupWorker();
                        resolve(data.result);
                        break;

                    case 'error':
                        this.cleanupWorker();
                        reject(new Error(data.message));
                        break;
                }
            };

            this.worker.onerror = (error) => {
                this.cleanupWorker();
                reject(new Error(`Worker error: ${error.message}`));
            };

            // Send docking request to worker
            const request: DockingRequest = {
                type: 'dock',
                receptorPdbqt,
                ligandPdbqt,
                params,
            };

            this.worker.postMessage(request);
        });
    }

    /**
     * Abort the current docking run
     */
    abort(): void {
        this.cleanupWorker();
    }

    private cleanupWorker(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

// Singleton instance
export const vinaService = new VinaService();

// NOTE: simulateDocking() has been REMOVED
// The docking pipeline now ONLY uses real Vina WASM via the dockingWorker
// All computation is real - no synthetic/simulated/fake data

