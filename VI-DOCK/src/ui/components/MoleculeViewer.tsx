import { useEffect, useRef, useState, useCallback } from 'react';
import { useDockingStore } from '../../store/dockingStore';
import { Dna } from 'lucide-react';
import '../styles/MoleculeViewer.css';

// Declare 3Dmol on window
declare global {
    interface Window {
        $3Dmol: any;
    }
}

export function MoleculeViewer() {
    // Use a separate ref for the 3Dmol container that React won't manage
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerInstanceRef = useRef<any>(null);
    const scriptLoadedRef = useRef(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);

    // Consume global state including VIEW CONTROL
    const {
        receptorFile,
        ligandFile,
        params,
        result,
        selectedPose,
        viewMode,
        resetViewTrigger,
        theme,
        showBox,
    } = useDockingStore();

    // Initialize the viewer
    const initializeViewer = useCallback(() => {
        if (!containerRef.current || !window.$3Dmol || viewerInstanceRef.current) return;

        try {
            // Transparent background for Grid visibility
            // 0x000000 with 0 alpha if supported, or just rely on CSS
            // 3Dmol.js: setBackgroundColor(color, alpha)

            const viewer = window.$3Dmol.createViewer(containerRef.current, {
                backgroundColor: 'black', // Default, but we will override with setBackgroundColor
                antialias: true,
                alpha: true // Enable alpha channel in WebGL
            });

            // Immediately set transparent
            viewer.setBackgroundColor(0x000000, 0);

            viewerInstanceRef.current = viewer;
            viewer.render();
            setIsReady(true);
        } catch (error) {
            console.error('Failed to initialize 3Dmol viewer:', error);
        }
    }, [theme]);

    // Load 3Dmol.js script only once
    useEffect(() => {
        if (window.$3Dmol) {
            setIsLoading(false);
            scriptLoadedRef.current = true;
            return;
        }

        const existingScript = document.querySelector('script[src="/3Dmol-min.js"]');
        if (existingScript) {
            const checkLoaded = setInterval(() => {
                if (window.$3Dmol) {
                    setIsLoading(false);
                    scriptLoadedRef.current = true;
                    clearInterval(checkLoaded);
                }
            }, 100);
            return () => clearInterval(checkLoaded);
        }

        const script = document.createElement('script');
        script.src = '/3Dmol-min.js';
        script.async = true;
        script.onload = () => {
            setIsLoading(false);
            scriptLoadedRef.current = true;
        };
        script.onerror = () => {
            console.error('Failed to load 3Dmol.js');
            setIsLoading(false);
        };
        document.head.appendChild(script);
        return () => { };
    }, []);

    // Initialize viewer when script is loaded
    useEffect(() => {
        if (!isLoading && containerRef.current && !viewerInstanceRef.current) {
            initializeViewer();
        }
    }, [isLoading, initializeViewer]);

    // Handle Theme Change
    useEffect(() => {
        if (viewerInstanceRef.current) {
            // Keep transparent, or maybe just slight tint?
            // For now, keep fully transparent to show the grid.
            viewerInstanceRef.current.setBackgroundColor(0x000000, 0);
            viewerInstanceRef.current.render();
        }
    }, [theme]);

    // Handle Reset View Trigger
    useEffect(() => {
        if (resetViewTrigger > 0 && viewerInstanceRef.current) {
            viewerInstanceRef.current.zoomTo();
            viewerInstanceRef.current.render();
        }
    }, [resetViewTrigger]);

    // Cleanup viewer on unmount
    useEffect(() => {
        return () => {
            if (viewerInstanceRef.current) {
                try {
                    viewerInstanceRef.current.clear();
                } catch (e) { }
                viewerInstanceRef.current = null;
            }
        };
    }, []);

    // DATA REFRESH TRIGGER (Combined Effect for Atom/Surface and Shapes)
    // We combine them to ensure 3Dmol renders once per state change and handles transparency sorting correctly.
    useEffect(() => {
        if (!isReady || !viewerInstanceRef.current) return;
        const viewer = viewerInstanceRef.current;
        
        const updateViewer = async () => {
            try {
                // 1. CLEAR CURRENT STATE
                viewer.removeAllModels();
                viewer.removeAllSurfaces();
                viewer.removeAllShapes();

                // 2. PREPARE LIGAND CONTENT
                const hasResult = !!(result && result.poses && result.poses[selectedPose]);
                const ligandContent = hasResult
                    ? result!.poses[selectedPose].pdbqt
                    : ligandFile?.content;

                // 3. ADD RECEPTOR
                let receptorModel: any = null;
                if (receptorFile?.content) {
                    let format = receptorFile.format || 'pdb';
                    if (format === 'pdbqt') format = "pdb"; 
                    
                    receptorModel = viewer.addModel(receptorFile.content, format);
                    if (receptorModel && receptorModel.selectedAtoms().length > 0) {
                        if (viewMode === 'cartoon') {
                            viewer.setStyle({ model: receptorModel }, { cartoon: { color: 'spectrum' } });
                        } else if (viewMode === 'sticks') {
                            viewer.setStyle({ model: receptorModel }, { stick: { colorscheme: 'Jmol' } });
                        } else if (viewMode === 'surface') {
                            viewer.setStyle({ model: receptorModel }, { cartoon: { color: 'spectrum', opacity: 0.2 } });
                            try {
                                const surfaceColor = theme === 'light' ? '#38BDF8' : '#2FACB2';
                                // SES surface with professional shading for PyMOL-like look
                                viewer.addSurface(window.$3Dmol.SurfaceType.SES, {
                                    opacity: 0.9,
                                    color: surfaceColor,
                                    quality: 1,
                                    specular: 0x444444,
                                    diffuse: 0x888888,
                                    smoothness: 10
                                }, { model: receptorModel });
                            } catch (e) { console.warn("Surface failed", e); }
                        }
                    }
                }

                // 4. ADD LIGAND
                if (ligandContent && ligandContent.trim().length > 0) {
                    // Detect format for cleaning
                    const contentLower = ligandContent.toLowerCase();
                    const isSdf = contentLower.includes('m  end') || contentLower.includes('v2000') || contentLower.includes('$$$$');
                    const isPdbqt = hasResult || ligandFile?.format === 'pdbqt' || (contentLower.includes('atom') && contentLower.includes('root'));
                    
                    let processedContent = ligandContent;
                    let renderFormat = isSdf ? 'sdf' : 'pdb';

                    // If it's PDBQT, we clean it to be a pure PDB for robust 3D rendering
                    if (isPdbqt) {
                        processedContent = ligandContent
                            .split('\n')
                            .filter(line => line.startsWith('ATOM') || line.startsWith('HETATM') || line.startsWith('CONECT'))
                            .join('\n');
                        renderFormat = 'pdb';
                    }
                    
                    const lModel = viewer.addModel(processedContent, renderFormat);
                    // Use ball-and-stick style for better visibility
                    lModel.setStyle({}, { 
                        stick: { colorscheme: 'ligandCarbon', radius: 0.15 },
                        sphere: { colorscheme: 'ligandCarbon', scale: 0.25 }
                    });
                    
                    // Zoom to ligand if it's a result pose (might have moved significantly)
                    if (hasResult) {
                        viewer.zoomTo({ model: lModel });
                    }
                    
                    console.log(`DEBUG: Added ligand model as ${renderFormat} from`, hasResult ? "result" : "input");
                }

                // 5. ADD GRID BOX
                if (showBox && params.sizeX > 0 && params.sizeY > 0 && params.sizeZ > 0) {
                    const { centerX, centerY, centerZ, sizeX, sizeY, sizeZ } = params;
                    const halfX = sizeX / 2, halfY = sizeY / 2, halfZ = sizeZ / 2;
                    const c = [
                        [centerX - halfX, centerY - halfY, centerZ - halfZ],
                        [centerX + halfX, centerY - halfY, centerZ - halfZ],
                        [centerX + halfX, centerY + halfY, centerZ - halfZ],
                        [centerX - halfX, centerY + halfY, centerZ - halfZ],
                        [centerX - halfX, centerY - halfY, centerZ + halfZ],
                        [centerX + halfX, centerY - halfY, centerZ + halfZ],
                        [centerX + halfX, centerY + halfY, centerZ + halfZ],
                        [centerX - halfX, centerY + halfY, centerZ + halfZ],
                    ];
                    const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
                    
                    for (const [i, j] of edges) {
                        viewer.addCylinder({
                            start: { x: c[i][0], y: c[i][1], z: c[i][2] },
                            end: { x: c[j][0], y: c[j][1], z: c[j][2] },
                            radius: 0.2, // THICKER as requested
                            color: theme === 'dark' ? '#00fbff' : '#00a2ff',
                            fromCap: true,
                            toCap: true,
                        });
                    }
                }

                // 6. FINALIZE
                viewer.render();
                // Only zoom once when core files change to avoid jumpy box editing
            } catch (err) {
                console.error("3Dmol Render Error:", err);
            }
        };

        updateViewer();
    }, [isReady, receptorFile?.name, ligandFile?.name, ligandFile?.content, result, selectedPose, viewMode, params, showBox, theme]);

    // Independent effect for Zooming to avoid jumpiness during box editing
    useEffect(() => {
        if (isReady && viewerInstanceRef.current && (receptorFile || ligandFile)) {
            viewerInstanceRef.current.zoomTo();
            viewerInstanceRef.current.render();
        }
    }, [isReady, receptorFile?.name, ligandFile?.name]);

    return (
        <div className="molecule-viewer">
            <div className="viewer-container-wrapper">
                {/* 3Dmol container - no React children inside */}
                <div
                    className="viewer-canvas"
                    ref={containerRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        position: 'absolute',
                        left: 0,
                        backgroundColor: 'transparent'
                    }}
                />

                {isLoading && (
                    <div className="viewer-overlay">
                        <div className="loading-spinner" />
                        <p>Loading 3D Viewer...</p>
                    </div>
                )}

                {isReady && !receptorFile && !ligandFile && (
                    <div className={`viewer-overlay viewer-placeholder ${theme}`}>
                        <span className="placeholder-icon"><Dna size={80} strokeWidth={1} /></span>
                        <p>VIDocks 3D Space</p>
                    </div>
                )}
            </div>
        </div>
    );
}
