import type { DockingPose, DockingResult } from '../types';

/**
 * Parse Vina output to extract binding affinities and poses
 */
export function parseVinaOutput(output: string, pdbqtOutput: string): DockingResult {
    const poses: DockingPose[] = [];
    const lines = output.split('\n');

    // Find the results table in the output
    let inResultsTable = false;

    for (const line of lines) {
        // Look for results header
        if (line.includes('mode |   affinity')) {
            inResultsTable = true;
            continue;
        }

        // Parse result lines
        if (inResultsTable && line.trim().match(/^\d+/)) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
                const mode = parseInt(parts[0], 10);
                const affinity = parseFloat(parts[1]);
                const rmsdLB = parseFloat(parts[2]);
                const rmsdUB = parseFloat(parts[3]);

                if (!isNaN(mode) && !isNaN(affinity)) {
                    poses.push({
                        mode,
                        affinity,
                        rmsdLB: isNaN(rmsdLB) ? 0 : rmsdLB,
                        rmsdUB: isNaN(rmsdUB) ? 0 : rmsdUB,
                        pdbqt: '', // Will be filled from pdbqtOutput
                    });
                }
            }
        }

        // End of results table
        if (inResultsTable && line.trim() === '') {
            inResultsTable = false;
        }
    }

    // Parse PDBQT output to extract individual poses
    const poseContents = splitPdbqtPoses(pdbqtOutput);
    for (let i = 0; i < poses.length && i < poseContents.length; i++) {
        poses[i].pdbqt = poseContents[i];
    }

    return {
        poses,
        rawOutput: pdbqtOutput,
        logOutput: output,
    };
}

/**
 * Split PDBQT output file into individual poses
 */
export function splitPdbqtPoses(pdbqtContent: string): string[] {
    const poses: string[] = [];
    const lines = pdbqtContent.split('\n');
    let currentPose: string[] = [];
    let insideModel = false;

    for (const line of lines) {
        if (line.startsWith('MODEL')) {
            if (currentPose.length > 0 && !insideModel) {
                // We found a new MODEL start but we had some previous content.
                // This shouldn't happen in standard PDBQT but safekeeping.
                poses.push(currentPose.join('\n'));
                currentPose = [];
            }
            insideModel = true;
            currentPose.push(line);
        } else if (line.startsWith('ENDMDL')) {
            currentPose.push(line);
            poses.push(currentPose.join('\n'));
            currentPose = [];
            insideModel = false;
        } else {
            // If we are inside a model, add lines.
            // If we are NOT inside a model, we might be in header/footer or a file without MODEL tags.
            // For safety, if we aren't "insideModel" yet, we just accumulate.
            // But if we encounter MODEL later, we might need to discard previous?
            // Vina output usually starts with MODEL 1 immediately after header.
            // We'll accumulate everything. If we hit MODEL later, we might treat previous as "preamble" which we probably don't need for individual poses?
            // Actually, best strategy: if we see MODEL, we start fresh.
            if (insideModel) {
                currentPose.push(line);
            } else if (line.trim().length > 0) {
                // lines outside MODEL blocks (remarks etc). We can ignore or keep.
                // For Vina split, we really just want the ATOM lines within models.
                // But if there are NO model tags, we want everything.
            }
        }
    }

    // If we never found MODEL tags, treat the whole file as one pose
    if (poses.length === 0 && pdbqtContent.trim()) {
        poses.push(pdbqtContent);
    }

    return poses;
}

/**
 * Extract affinity from a single pose PDBQT
 */
export function extractAffinityFromPose(pdbqt: string): number | null {
    const match = pdbqt.match(/REMARK VINA RESULT:\s+([-\d.]+)/);
    return match ? parseFloat(match[1]) : null;
}
