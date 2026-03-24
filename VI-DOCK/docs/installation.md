# Installation Guide

## Prerequisites

- **Node.js** v18 or higher ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge)

## Quick Install

```bash
# Clone the repository
git clone https://github.com/messiay/vidock-new.git
cd vidock-new

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`.

## Production Build

```bash
# Create optimized production build
npm run build

# Preview the production build
npm run preview
```

The production files will be in the `dist/` folder.

## Backend API Configuration

VI DOCK connects to a FastAPI backend for docking computations. Configure the API endpoint in your environment:

```bash
# .env file
VITE_API_URL=https://your-api-endpoint.com
```

## Troubleshooting

### API Connection Issues
- Verify the API endpoint is accessible
- Check that CORS is properly configured on the backend
- Ensure your network allows outbound connections to the API

### Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Port Already in Use
```bash
# Use a different port
npm run dev -- --port 3000
```
