import type { DockingResult, DockingPose } from '../core/types';
import type { DockingParams } from '../types';

// ============================================================================
// WEBINA BRIDGE - Worker Based
// ============================================================================

export interface WebinaCallbacks {
    onDone?: (outTxt: string, stdOut: string, stdErr: string) => void;
    onError?: (error: any) => void;
    onStdout?: (text: string) => void;
    onStderr?: (text: string) => void;
    onProgress?: (msg: string, percent: number) => void;
}

// Convert camelCase params to snake_case for Vina CLI
function convertParamsToVinaArgs(params: DockingParams): string[] {
    const args: string[] = [];

    const add = (flag: string, val: any) => {
        args.push(`--${flag}`);
        args.push(val.toString());
    };

    add('center_x', params.centerX);
    add('center_y', params.centerY);
    add('center_z', params.centerZ);
    add('size_x', params.sizeX);
    add('size_y', params.sizeY);
    add('size_z', params.sizeZ);
    add('exhaustiveness', params.exhaustiveness);
    add('num_modes', params.numModes || 9);
    add('energy_range', params.energyRange || 3);

    if (params.seed) add('seed', params.seed);

    // NOTE: Do NOT add --cpu here. The Worker adds it carefully.
    // Adding it here causes a "naked 1" bug because the worker naively filters only the flag.

    return args;
}

function parseVinaOutput(output: string, pdbqtOutput: string): DockingResult {
    const poses: DockingPose[] = [];
    const lines = output.split('\n');
    let inResultsTable = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('mode |   affinity')) {
            inResultsTable = true;
            continue;
        }

        if (inResultsTable && line.trim().match(/^\d+/)) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
                const mode = parseInt(parts[0], 10);
                const affinity = parseFloat(parts[1]);
                const rmsdLB = parseFloat(parts[2]);
                const rmsdUB = parseFloat(parts[3]);

                if (!isNaN(mode) && !isNaN(affinity)) {
                    poses.push({
                        mode: mode,
                        affinity: affinity,
                        rmsdLB: isNaN(rmsdLB) ? 0 : rmsdLB,
                        rmsdUB: isNaN(rmsdUB) ? 0 : rmsdUB,
                        pdbqt: ''
                    });
                }
            }
        }

        if (inResultsTable && line.trim() === '') {
            inResultsTable = false;
        }
    }

    if (pdbqtOutput) {
        const models = pdbqtOutput.split("MODEL");
        let poseIndex = 0;
        for (let i = 1; i < models.length; i++) {
            const modelContent = "MODEL" + models[i];
            if (modelContent.includes("ENDMDL") && poseIndex < poses.length) {
                poses[poseIndex].pdbqt = modelContent;
                poseIndex++;
            }
        }
        if (poses.length > 0 && poses[0].pdbqt === '') {
            poses[0].pdbqt = pdbqtOutput;
        }
    }

    return {
        poses,
        rawOutput: pdbqtOutput,
        logOutput: output
    };
}

let activeWorker: Worker | null = null;

export async function runWebinaVina(
    receptorPdbqt: string,
    ligandPdbqt: string,
    params: DockingParams,
    callbacks?: WebinaCallbacks
): Promise<DockingResult> {

    // Terminate existing worker if any (brutal restart to ensure clean state)
    if (activeWorker) {
        activeWorker.terminate();
    }

    // Create new Worker
    activeWorker = new Worker(new URL('./webina.worker.ts', import.meta.url), { type: 'module' });

    return new Promise<DockingResult>((resolve, reject) => {
        let capturedStdout = '';
        let capturedStderr = '';

        // Prepare the payload, but don't send it yet
        const runPayload = {
            receptor: receptorPdbqt,
            ligand: ligandPdbqt,
            args: convertParamsToVinaArgs(params)
        };

        const TIMEOUT_MS = 60000; // 60s timeout
        const timeoutId = setTimeout(() => {
            if (activeWorker) activeWorker.terminate();
            const msg = `Docking timed out after ${TIMEOUT_MS / 1000}s`;
            if (callbacks?.onStderr) callbacks.onStderr(msg);
            reject(new Error(msg));
        }, TIMEOUT_MS);

        activeWorker!.onmessage = (e) => {
            const { type, payload } = e.data;

            try {
                switch (type) {
                    case 'init_complete':
                        if (callbacks?.onProgress) callbacks.onProgress("Engine Initialized. Starting Docking...", 10);
                        // HANDSHAKE COMPLETE: NOW SEND RUN COMMAND
                        activeWorker?.postMessage({
                            type: 'run',
                            payload: runPayload
                        });
                        break;

                    case 'stdout':
                        console.log(`[Worker] ${payload}`);
                        capturedStdout += payload + '\n';
                        if (callbacks?.onStdout) callbacks.onStdout(payload);
                        break;
                    case 'stderr':
                        console.warn(`[Worker] ${payload}`);
                        capturedStderr += payload + '\n';
                        if (callbacks?.onStderr) callbacks.onStderr(payload);
                        // Also log stderr to stdout for visibility in diary
                        if (callbacks?.onStdout) callbacks.onStdout(`[ERR] ${payload}`);
                        break;
                    case 'progress':
                        if (callbacks?.onProgress) callbacks.onProgress(payload.message, payload.percent);
                        break;
                    case 'error':
                        console.error(`[Worker Error] ${payload}`);
                        if (callbacks?.onError) callbacks.onError(payload);
                        clearTimeout(timeoutId);
                        activeWorker?.terminate();
                        reject(new Error(payload));
                        break;
                    case 'done':
                        clearTimeout(timeoutId);
                        const result = parseVinaOutput(capturedStdout, payload);
                        activeWorker?.terminate();
                        activeWorker = null;
                        resolve(result);
                        break;
                }
            } catch (err) {
                console.error("Error processing worker message", err);
                reject(err);
            }
        };

        activeWorker!.onerror = (err) => {
            clearTimeout(timeoutId);
            console.error("Worker generic error", err);
            reject(new Error("Worker failed silently or crashed"));
        };

        // Start the job logic
        callbacks?.onProgress?.("Initializing Worker...", 5);

        // Environment Diagnostics
        const isSecure = typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false;
        const diagMsg = `[Diagnostics] Secure Context: ${isSecure}, SAB: ${typeof SharedArrayBuffer}`;
        console.log(diagMsg);
        if (callbacks?.onStdout) callbacks.onStdout(diagMsg);

        if (!isSecure) {
            const warning = "WARNING: App is NOT crossOriginIsolated. Multi-threading WILL fail.";
            console.warn(warning);
            if (callbacks?.onStdout) callbacks.onStdout(warning);
        }

        console.log("[WebinaBridge] Sending INIT...");

        // KICKOFF: Send INIT only.
        activeWorker!.postMessage({ type: 'init' });
    });
}

// Add simple abort function
export function abortDocking() {
    if (activeWorker) {
        activeWorker.terminate();
        activeWorker = null;
        console.log("Docking aborted by user.");
    }
}
