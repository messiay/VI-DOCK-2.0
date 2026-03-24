export const config = {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://substitute-booth-tba-conversations.trycloudflare.com',
    ENDPOINTS: {
        PROJECTS: '/projects',
        DOCKING: '/docking',
        ANALYSIS: '/analysis',
        SYSTEM: '/system',
        FETCH: '/fetch',
        CONVERT: '/convert',
        MD: '/md'
    }
};
