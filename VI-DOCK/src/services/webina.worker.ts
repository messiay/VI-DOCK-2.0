
// Web Worker for running AutoDock Vina WASM (Modern ESM Version)
// Uses vina.js / vina.wasm

interface WorkerMessage {
    type: 'init' | 'run' | 'abort';
    payload?: any;
}

interface RunPayload {
    receptor: string;
    ligand: string;
    args: string[];
}

// Global reference
let vinaModule: any = null;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { type, payload } = e.data;

    try {
        switch (type) {
            case 'init':
                await initializeVina();
                self.postMessage({ type: 'init_complete' });
                break;

            case 'run':
                await runVina(payload);
                break;
        }
    } catch (err: any) {
        self.postMessage({ type: 'error', payload: err.message || String(err) });
    }
};

async function initializeVina() {
    if (vinaModule) return;

    self.postMessage({ type: 'progress', payload: { message: "Loading Vina Engine...", percent: 5 } });

    const cacheBuster = Date.now();
    // Import strict ESM module 'vina.js'
    const scriptUrl = new URL("/webina/vina.js", self.location.origin).href + `?t=${cacheBuster}`;

    console.log(`[Worker] Importing ESM vina.js from ${scriptUrl}`);

    let moduleFactory;
    try {
        /* @vite-ignore */
        const imported = await import(scriptUrl);
        moduleFactory = imported.default;
    } catch (e) {
        throw new Error(`Failed to import ESM vina.js: ${e}`);
    }

    if (!moduleFactory) {
        throw new Error("vina.js did not export a default module factory.");
    }

    // Initialize the module
    vinaModule = await moduleFactory({
        noInitialRun: true,

        // STABILITY SETTINGS - Consolidated
        PTHREAD_POOL_SIZE: 0,           // Disable threading for stability
        INITIAL_MEMORY: 536870912,      // 512MB heap
        TOTAL_STACK: 10 * 1024 * 1024,  // 10MB stack (Vina uses recursion)

        thisProgram: "vina",

        locateFile: (path: string) => {
            if (path.endsWith('.wasm')) {
                // IMPORTANT: Use standard vina.wasm for vina.js
                return new URL('/webina/vina.wasm', self.location.origin).href + `?t=${cacheBuster}`;
            }
            if (path === 'vina.worker.js') {
                return new URL('/webina/vina.worker.js', self.location.origin).href;
            }
            return new URL(path, self.location.origin).href;
        },

        print: (text: string) => {
            self.postMessage({ type: 'stdout', payload: "[Print] " + text });
        },
        printErr: (text: string) => {
            self.postMessage({ type: 'stderr', payload: "[PrintErr] " + text });
        },
        onExit: (code: number) => {
            console.log(`[Worker] Vina exited with code ${code}`);
        },
        onAbort: (what: any) => {
            self.postMessage({ type: 'error', payload: `Vina Aborted: ${what}` });
        }
    });

    // Console Overrides
    const originalLog = console.log;
    console.log = (...args) => {
        const msg = args.map(a => String(a)).join(' ');
        self.postMessage({ type: 'stdout', payload: "[Console.log] " + msg });
        originalLog(...args);
    };
    console.error = (...args) => {
        const msg = args.map(a => String(a)).join(' ');
        self.postMessage({ type: 'stderr', payload: "[Console.error] " + msg });
        originalLog(...args);
    };

    console.log("[Worker] Engine loaded (ESM). Ready.");
}

async function runVina(payload: RunPayload) {
    if (!vinaModule) throw new Error("Vina not initialized");

    const { receptor, ligand, args } = payload;
    const FS = vinaModule.FS;

    self.postMessage({ type: 'progress', payload: { message: "Mounting Files...", percent: 10 } });

    try {
        FS.writeFile('/receptor.pdbqt', receptor);
        FS.writeFile('/ligand.pdbqt', ligand);
    } catch (e: any) {
        throw new Error(`FS Write Failed: ${e.message}`);
    }

    self.postMessage({ type: 'progress', payload: { message: "Starting Docking...", percent: 20 } });

    // Ensure we don't duplicate cpu flag
    const safeArgs = args.filter(a => !a.includes('--cpu'));
    const fullArgs = [
        ...safeArgs,
        '--cpu', '1',
        '--receptor', '/receptor.pdbqt',
        '--ligand', '/ligand.pdbqt',
        '--out', '/output.pdbqt'
    ];

    // Paranoid Check: Verify Input Files
    try {
        const receptorCheck = FS.readFile('/receptor.pdbqt', { encoding: 'utf8' });
        const ligandCheck = FS.readFile('/ligand.pdbqt', { encoding: 'utf8' });

        console.log(`[Worker] Receptor Check: ${receptorCheck.length} bytes.`);
        console.log(`[Worker] Ligand Check: ${ligandCheck.length} bytes.`);

        if (receptorCheck.length < 100 || ligandCheck.length < 100) {
            console.error('[Worker] CRITICAL: Input files are suspiciously small!');
        }
    } catch (e) {
        console.error('[Worker] CRITICAL: Failed to read back input files!', e);
    }

    console.log(`[Worker] Running callMain: ${JSON.stringify(fullArgs)}`);

    try {
        vinaModule.callMain(fullArgs);
        console.log("[Worker] Vina Completed.");

        if (FS.analyzePath('/output.pdbqt').exists) {
            const output = FS.readFile('/output.pdbqt', { encoding: 'utf8' });
            self.postMessage({ type: 'done', payload: output });
        } else {
            console.error("[Worker] Vina ran but no output.pdbqt found.");
            self.postMessage({ type: 'done', payload: "" });
        }

    } catch (e: any) {
        throw new Error(`Vina Crash: ${e.message}`);
    } finally {
        // Cleanup
        try {
            if (FS.analyzePath('/receptor.pdbqt').exists) FS.unlink('/receptor.pdbqt');
            if (FS.analyzePath('/ligand.pdbqt').exists) FS.unlink('/ligand.pdbqt');
            if (FS.analyzePath('/output.pdbqt').exists) FS.unlink('/output.pdbqt');
        } catch (x) { }
    }
}
