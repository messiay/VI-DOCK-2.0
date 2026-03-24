// Local type definitions for worker (avoid import issues)
interface DockingRequest {
    type: 'dock';
    receptorPdbqt: string;
    ligandPdbqt: string;
    params: {
        centerX: number;
        centerY: number;
        centerZ: number;
        sizeX: number;
        sizeY: number;
        sizeZ: number;
        exhaustiveness: number;
        numModes?: number;
    };
}

interface WorkerResponse {
    type: 'progress' | 'complete' | 'error';
    message?: string;
    progress?: number;
    result?: DockingResult;
}
import type { DockingResult } from '../types';
import { parseVinaOutput } from '../utils/vinaOutputParser';

// ============================================================================
// VINA WASM DOCKING WORKER
// Uses REAL AutoDock Vina WASM binary via Aioli (BioWasm)
// NO SYNTHETIC OR SIMULATED DATA - ALL REAL COMPUTATIONS
// ============================================================================

let CLI: any = null;

// Logging utility with verification prefix
function logVerify(stage: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    console.log(`[VINA_VERIFY][${timestamp}][${stage}] ${message}`);
    if (data !== undefined) {
        console.log(`[VINA_VERIFY][${stage}] Data:`, data);
    }
}

// Post progress message to main thread
function postProgress(message: string, progress: number): void {
    logVerify('PROGRESS', `${progress}% - ${message}`);
    const response: WorkerResponse = {
        type: 'progress',
        message,
        progress,
    };
    self.postMessage(response);
}

// Post completion message to main thread
function postComplete(result: DockingResult): void {
    logVerify('COMPLETE', `Docking completed with ${result.poses.length} poses`);
    const response: WorkerResponse = {
        type: 'complete',
        result,
    };
    self.postMessage(response);
}

// Post error message to main thread
function postError(message: string): void {
    logVerify('ERROR', message);
    const response: WorkerResponse = {
        type: 'error',
        message,
    };
    self.postMessage(response);
}

// Initialize Aioli and Vina
async function initializeVina(): Promise<void> {
    if (CLI) {
        logVerify('INIT', 'Vina CLI already initialized, reusing');
        return;
    }

    logVerify('INIT', 'Starting Aioli/Vina initialization...');
    postProgress('Initializing BioWasm (Aioli)...', 5);

    try {
        // Check if Aioli is already loaded
        let Aioli = (self as any).Aioli;

        if (!Aioli) {
            // For module workers, we cannot use importScripts()
            // Instead, fetch and eval the script
            logVerify('INIT', 'Fetching aioli.js via fetch (module worker compatible)');

            const response = await fetch('/aioli.js');
            if (!response.ok) {
                throw new Error(`Failed to fetch aioli.js: ${response.status} ${response.statusText}`);
            }
            const scriptText = await response.text();
            logVerify('INIT', `Loaded aioli.js (${scriptText.length} bytes)`);

            // Evaluate the script in global scope
            // This is safe since aioli.js is a bundled library from our server
            (0, eval)(scriptText);

            Aioli = (self as any).Aioli;
        }

        if (!Aioli) {
            throw new Error('Aioli failed to load - global not found after script evaluation');
        }
        logVerify('INIT', 'Aioli global loaded successfully');

        postProgress('Loading AutoDock Vina v1.2.3 from BioWasm CDN...', 10);
        logVerify('INIT', 'Fetching autodock-vina/1.2.3 WASM from biowasm.com CDN...');

        // Initialize Aioli with LOCAL AutoDock Vina
        // Use the files in /webina/ directory (vina.js, vina.wasm)
        logVerify('INIT', 'Initializing Aioli with LOCAL files from /webina/...');

        CLI = await new Aioli({
            tools: [{
                name: "vina",
                program: "vina",
                urlPrefix: "/webina/"
            }],
            printInterleaved: false,
            debug: false
        });

        logVerify('INIT', 'Vina WASM module loaded and ready!');
        postProgress('Vina engine ready', 15);
    } catch (error) {
        logVerify('INIT_ERROR', 'Aioli initialization failed', error);
        console.error('Aioli Initialization Failed FULL ERROR:', error);

        let errMsg = 'Unknown error';
        if (error instanceof Error) errMsg = error.message;
        else if (typeof error === 'string') errMsg = error;
        else errMsg = JSON.stringify(error);

        throw new Error(`Failed to initialize Vina Engine: ${errMsg}`);
    }
}

// Run docking (REAL WASM EXECUTION - NO SIMULATION)
async function runDocking(request: DockingRequest): Promise<void> {
    logVerify('START', '========== DOCKING JOB STARTED ==========');
    logVerify('START', 'This is REAL WASM execution, not simulated');

    // Check SharedArrayBuffer requirements
    if (typeof SharedArrayBuffer === 'undefined') {
        logVerify('PREREQ', 'CRITICAL: SharedArrayBuffer is not available!');
        console.error('[Worker] SharedArrayBuffer is missing! COOP/COEP headers likely required.');
        postError('Browser Error: SharedArrayBuffer is not enabled. Is the server sending COOP/COEP headers?');
        return;
    }
    logVerify('PREREQ', 'SharedArrayBuffer is available ✓');

    const { receptorPdbqt, ligandPdbqt, params } = request;

    // ========== INPUT VALIDATION ==========
    logVerify('INPUT', '---------- INPUT VALIDATION ----------');
    logVerify('INPUT', `Receptor PDBQT size: ${receptorPdbqt.length} characters`);
    logVerify('INPUT', `Ligand PDBQT size: ${ligandPdbqt.length} characters`);
    logVerify('INPUT', `Receptor first 200 chars: ${receptorPdbqt.substring(0, 200)}`);
    logVerify('INPUT', `Ligand first 200 chars: ${ligandPdbqt.substring(0, 200)}`);

    // Validate receptor content
    const receptorHasAtoms = receptorPdbqt.includes('ATOM') || receptorPdbqt.includes('HETATM');
    logVerify('INPUT', `Receptor contains ATOM/HETATM records: ${receptorHasAtoms}`);

    // Validate ligand content
    const ligandHasRoot = ligandPdbqt.includes('ROOT');
    const ligandHasBranch = ligandPdbqt.includes('BRANCH');
    const ligandHasAtoms = ligandPdbqt.includes('ATOM') || ligandPdbqt.includes('HETATM');
    logVerify('INPUT', `Ligand has ROOT: ${ligandHasRoot}, BRANCH: ${ligandHasBranch}, ATOMS: ${ligandHasAtoms}`);

    // Log docking parameters
    logVerify('PARAMS', '---------- DOCKING PARAMETERS ----------');
    logVerify('PARAMS', `Center: (${params.centerX}, ${params.centerY}, ${params.centerZ})`);
    logVerify('PARAMS', `Size: (${params.sizeX}, ${params.sizeY}, ${params.sizeZ})`);
    logVerify('PARAMS', `Exhaustiveness: ${params.exhaustiveness}`);
    logVerify('PARAMS', `Num Modes: ${params.numModes || 9}`);

    try {
        await initializeVina();

        // ========== FILE MOUNTING ==========
        logVerify('MOUNT', '---------- MOUNTING FILES TO VIRTUAL FS ----------');
        postProgress('Mounting files to virtual filesystem...', 20);

        await CLI.mount('/receptor.pdbqt', receptorPdbqt);
        logVerify('MOUNT', 'Mounted /receptor.pdbqt ✓');

        await CLI.mount('/ligand.pdbqt', ligandPdbqt);
        logVerify('MOUNT', 'Mounted /ligand.pdbqt ✓');

        postProgress('Configuring parameters...', 25);

        // ========== COMMAND CONSTRUCTION ==========
        logVerify('CMD', '---------- COMMAND CONSTRUCTION ----------');
        const args = [
            '--receptor', '/receptor.pdbqt',
            '--ligand', '/ligand.pdbqt',
            '--center_x', params.centerX.toString(),
            '--center_y', params.centerY.toString(),
            '--center_z', params.centerZ.toString(),
            '--size_x', params.sizeX.toString(),
            '--size_y', params.sizeY.toString(),
            '--size_z', params.sizeZ.toString(),
            '--exhaustiveness', params.exhaustiveness.toString(),
            '--num_modes', (params.numModes || 9).toString(),
            '--out', '/output.pdbqt',
            '--cpu', '1'
        ];

        const cmd = `vina ${args.join(' ')}`;
        logVerify('CMD', `Full command: ${cmd}`);

        // ========== VINA EXECUTION ==========
        logVerify('EXEC', '---------- EXECUTING VINA WASM ----------');
        postProgress('Running AutoDock Vina (REAL WASM computation)...', 30);

        const startTime = performance.now();
        const output = await CLI.exec(cmd);
        const endTime = performance.now();

        logVerify('EXEC', `Vina execution completed in ${(endTime - startTime).toFixed(2)}ms`);

        // ========== OUTPUT CAPTURE ==========
        logVerify('OUTPUT', '---------- VINA OUTPUT ----------');
        logVerify('OUTPUT', `stdout length: ${output.stdout?.length || 0} chars`);
        logVerify('OUTPUT', `stderr length: ${output.stderr?.length || 0} chars`);
        logVerify('OUTPUT', 'STDOUT CONTENT:');
        console.log(output.stdout);
        if (output.stderr && output.stderr.length > 0) {
            logVerify('OUTPUT', 'STDERR CONTENT:');
            console.log(output.stderr);
        }

        // Check for results table in stdout
        const hasResultsTable = output.stdout?.includes('mode |   affinity');
        logVerify('OUTPUT', `Contains results table (mode | affinity): ${hasResultsTable}`);

        postProgress('Processing results...', 90);

        // ========== READ OUTPUT FILE ==========
        logVerify('READ', '---------- READING OUTPUT FILE ----------');
        const outputPdbqt = await CLI.cat('/output.pdbqt');
        logVerify('READ', `Output PDBQT size: ${outputPdbqt.length} characters`);
        logVerify('READ', `Output PDBQT first 500 chars: ${outputPdbqt.substring(0, 500)}`);

        // Validate output
        const hasVinaResult = outputPdbqt.includes('REMARK VINA RESULT');
        const hasModels = outputPdbqt.includes('MODEL');
        logVerify('READ', `Output has REMARK VINA RESULT: ${hasVinaResult}`);
        logVerify('READ', `Output has MODEL sections: ${hasModels}`);

        // ========== CLEANUP ==========
        logVerify('CLEANUP', 'Cleaning up virtual filesystem...');
        await CLI.unlink('/receptor.pdbqt');
        await CLI.unlink('/ligand.pdbqt');
        await CLI.unlink('/output.pdbqt');
        logVerify('CLEANUP', 'Virtual files removed ✓');

        // ========== PARSE RESULTS ==========
        logVerify('PARSE', '---------- PARSING RESULTS ----------');
        const result = parseVinaOutput(output.stdout, outputPdbqt);
        logVerify('PARSE', `Parsed ${result.poses.length} binding poses`);

        if (result.poses.length > 0) {
            logVerify('PARSE', 'Binding affinities:');
            result.poses.forEach((pose) => {
                logVerify('PARSE', `  Mode ${pose.mode}: ${pose.affinity} kcal/mol (RMSD: ${pose.rmsdLB}/${pose.rmsdUB})`);
            });
            logVerify('PARSE', `Best affinity: ${result.poses[0].affinity} kcal/mol`);
        }

        // ========== COMPLETE ==========
        logVerify('DONE', '========== DOCKING JOB COMPLETED ==========');
        logVerify('DONE', 'This was REAL Vina WASM computation, not simulated!');

        postProgress('Docking complete!', 100);
        postComplete(result);

    } catch (error) {
        logVerify('ERROR', '========== DOCKING ERROR ==========');
        logVerify('ERROR', `Error: ${error instanceof Error ? error.message : String(error)}`);
        console.error('Docking Error:', error);
        postError(`Docking execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<DockingRequest>) => {
    const request = event.data;
    logVerify('MESSAGE', `Received message type: ${request.type || 'dock'}`);

    // Always run docking for now (type check optional)
    await runDocking(request);
};
