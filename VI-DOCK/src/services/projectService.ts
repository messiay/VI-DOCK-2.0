import { openDB, type IDBPDatabase } from 'idb';
import type { SavedProject } from '../core/types';

const DB_NAME = 'SimDockDB';
const STORE_NAME = 'projects';
const VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDB = async () => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('username', 'username');
                    store.createIndex('timestamp', 'timestamp');
                }
            },
        });
    }
    return dbPromise;
};

export const projectService = {
    async saveProject(project: SavedProject): Promise<void> {
        console.info('[projectService] Saving project:', project.name, project.id);
        const db = await getDB();
        await db.put(STORE_NAME, project);
        console.info('[projectService] Project saved successfully');
    },

    async getProjects(username: string): Promise<SavedProject[]> {
        console.info('[projectService] Loading projects for:', username);
        const db = await getDB();

        // Try to get by username first
        let list = await db.getAllFromIndex(STORE_NAME, 'username', username);

        // If no results, get all projects (in case of username mismatch)
        if (list.length === 0) {
            console.info('[projectService] No projects for username, fetching all');
            list = await db.getAll(STORE_NAME);
        }

        console.info('[projectService] Found', list.length, 'projects');
        // Sort by timestamp desc (newest first)
        return list.sort((a, b) => b.timestamp - a.timestamp);
    },

    async getAllProjects(): Promise<SavedProject[]> {
        const db = await getDB();
        const list = await db.getAll(STORE_NAME);
        return list.sort((a, b) => b.timestamp - a.timestamp);
    },

    async deleteProject(id: string): Promise<void> {
        console.info('[projectService] Deleting project:', id);
        const db = await getDB();
        await db.delete(STORE_NAME, id);
    },

    async loadProject(id: string): Promise<SavedProject | undefined> {
        const db = await getDB();
        return db.get(STORE_NAME, id);
    }
};
