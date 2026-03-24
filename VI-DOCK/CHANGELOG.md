# Changelog

All notable changes to VI DOCK Pro will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-01-19

### Changed
- **Repository Restructured** - Cleaner folder organization
- Moved main application to root directory
- Added comprehensive documentation in `docs/`
- Added CONTRIBUTING.md and CHANGELOG.md

### Removed
- Removed legacy Python desktop application (`old/`)
- Removed archived duplicate files (~800 files)
- Removed temporary debug files

## [3.0.0] - 2026-01-06

### Added
- Global theme system (Dark/Light modes)
- 80+ CSS custom properties for theming
- Smooth 250ms theme transitions
- Comprehensive design token system

### Fixed
- React green screen crash
- forwardRef implementation issues

## [2.0.0] - 2025-12-31

### Added
- AutoDock Vina WASM integration
- RDKit.js for SMILES processing
- OpenBabel WASM for format conversion
- PDB database integration
- PubChem compound search
- Project Library with IndexedDB persistence

### Technical
- React 18 + TypeScript + Vite stack
- Zustand state management
- NGL Viewer 3D visualization

## [1.0.0] - 2025-12-01

### Added
- Initial project setup
- Basic docking interface
- File upload support
