# Configuration Guide

## Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```env
# Optional: API endpoints for fetching molecules
VITE_CORS_PROXY=https://your-cors-proxy.com

# Development mode
VITE_DEBUG=false
```

## Vite Configuration

The `vite.config.ts` configures the build system:

```typescript
// Key settings for WASM support
headers: {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin'
}
```

## WASM Modules

VI DOCK uses three WebAssembly modules:

| Module | Purpose | Location |
|--------|---------|----------|
| vina.wasm | AutoDock Vina docking engine | `public/` |
| rdkit.wasm | Chemical intelligence | CDN |
| openbabel.wasm | Format conversion | CDN |

### Vina Configuration

Default docking parameters in the Input panel:

```yaml
# Docking Parameters
exhaustiveness: 8    # Search thoroughness (1-32)
num_modes: 9         # Max poses to generate
energy_range: 3      # Max energy difference (kcal/mol)
cpu: 1               # Threads (limited in browser)

# Grid Box
center: [0, 0, 0]    # Auto-calculated from receptor
size: [20, 20, 20]   # Search space dimensions (Å)
```

## Theme Configuration

Themes are defined in `src/index.css` using CSS custom properties:

```css
:root {
  /* Light mode defaults */
  --bg-viewport: #F3F5F7;
  --text-primary: #1D1E20;
}

[data-theme="dark"] {
  --bg-viewport: #0A0D10;
  --text-primary: #EDEEF0;
}
```

## Project Structure

```
vidock-new/
├── src/
│   ├── components/    # React UI components
│   ├── services/      # WASM integration
│   ├── store/         # Zustand state
│   └── utils/         # Helpers
├── public/            # Static assets & WASM
├── docs/              # Documentation
└── dist/              # Production build
```
