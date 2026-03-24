import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useDockingStore } from '../../store/dockingStore';

const BackgroundGrid = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    const theme = useDockingStore(state => state.theme);

    useEffect(() => {
        if (!mountRef.current) return;

        // 1. Scene Setup
        const scene = new THREE.Scene();

        // --- THEME COLORS ---
        const isLight = theme === 'light';
        // Dark: #0F172A (Slate 900) | Light: #F8FAFC (Clinical White)
        const bgHex = isLight ? 0xF8FAFC : 0x0F172A;
        const fogHex = bgHex;

        scene.background = new THREE.Color(bgHex);
        scene.fog = new THREE.FogExp2(fogHex, 0.02);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 2, 12);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        mountRef.current.innerHTML = '';
        mountRef.current.appendChild(renderer.domElement);

        // --- GRID CONFIG ---
        // Dark: 0x38BDF8 (Biotech Blue) | Light: 0xCBD5E1 (Slate Gray)
        const gridColor = isLight ? 0xCBD5E1 : 0x38BDF8;
        const gridOpacity = isLight ? 0.6 : 0.15; // Lower opacity for dark mode subtlety

        const createGrid = (yPosition: number, opacity: number) => {
            const grid = new THREE.GridHelper(100, 50, gridColor, gridColor);
            grid.position.y = yPosition;

            const material = grid.material as THREE.LineBasicMaterial;
            material.transparent = true;
            material.opacity = opacity;

            return grid;
        };

        // 1. Floor
        const gridBottom = createGrid(-4, gridOpacity);
        scene.add(gridBottom);

        // 2. Ceiling
        const gridTop = createGrid(4, gridOpacity * 0.5);
        scene.add(gridTop);

        // 3. Horizon
        const gridBack = new THREE.GridHelper(100, 50, gridColor, gridColor);
        gridBack.rotation.x = Math.PI / 2;
        gridBack.position.z = -30;
        (gridBack.material as THREE.LineBasicMaterial).transparent = true;
        (gridBack.material as THREE.LineBasicMaterial).opacity = gridOpacity * 0.3;
        scene.add(gridBack);

        // Animation
        let time = 0;
        const animate = () => {
            requestAnimationFrame(animate);
            time += 0.002;
            gridBottom.position.z = (time * 2) % 2;
            gridTop.position.z = (time * 2) % 2;
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (mountRef.current) mountRef.current.innerHTML = '';
            renderer.dispose();
        };
    }, [theme]); // Re-run when theme changes

    return (
        <div
            ref={mountRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 0, /* Background layer, ensure App content is transparent or higher z-index */
                pointerEvents: 'none'
            }}
        />
    );
};

export default BackgroundGrid;
