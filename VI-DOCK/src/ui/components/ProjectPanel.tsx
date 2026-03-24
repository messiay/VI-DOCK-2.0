import { useEffect, useState } from 'react';
import { useUserStore } from '../../store/userStore';
import { useDockingStore } from '../../store/dockingStore';
import { projectService } from '../../services/projectService';
import type { SavedProject } from '../../core/types';
import { FolderOpen, Trash2, Calendar, Database } from 'lucide-react';
import '../styles/ProjectPanel.css';

export function ProjectPanel() {
    const { currentUser } = useUserStore();
    const { startOver, setReceptorFile, setLigandFile, setParams, setResult, setViewMode, setActiveTab } = useDockingStore();
    const [projects, setProjects] = useState<SavedProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadProjects();
    }, [currentUser]);

    const loadProjects = async () => {
        const username = currentUser || 'Local Researcher';
        setIsLoading(true);
        try {
            const list = await projectService.getProjects(username);
            setProjects(list);
        } catch (error) {
            console.error('Failed to load projects', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this project?')) {
            await projectService.deleteProject(id);
            loadProjects();
        }
    };

    const handleLoad = (project: SavedProject) => {
        if (confirm('Load this project? Current unsaved work will be lost.')) {
            // Reset current state
            startOver();

            // Restore data
            const { data } = project;
            if (data.receptorFile) setReceptorFile(data.receptorFile);
            if (data.ligandFile) setLigandFile(data.ligandFile);
            setParams(data.params);
            if (data.result) setResult(data.result);
            if (data.viewMode) setViewMode(data.viewMode);

            // Go to input if no result, or output if result exists
            const targetTab = data.result ? 'output' : 'input';
            setActiveTab(targetTab);
        }
    };

    return (
        <div className="project-panel">
            <div className="project-header">
                <h2>Mission Log</h2>
                <button className="refresh-btn" onClick={loadProjects} title="Refresh List">
                    <Database size={18} />
                </button>
            </div>

            {isLoading ? (
                <div className="loading-projects">Accessing Database...</div>
            ) : projects.length === 0 ? (
                <div className="empty-state">
                    <FolderOpen size={48} />
                    <p>No missions recorded.</p>
                    <small>Save your current work from the toolbar to see it here.</small>
                </div>
            ) : (
                <div className="projects-grid">
                    {projects.map((p) => (
                        <div key={p.id} className="project-card" onClick={() => handleLoad(p)}>
                            <div className="card-icon">
                                <Database size={24} />
                            </div>
                            <div className="card-content">
                                <h3>{p.name}</h3>
                                <div className="card-meta">
                                    <Calendar size={12} />
                                    <span>{new Date(p.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="card-tags">
                                    {p.data.receptorFile && <span className="tag receptor">{p.data.receptorFile.name}</span>}
                                    {p.data.ligandFile && <span className="tag ligand">{p.data.ligandFile.name}</span>}
                                </div>
                            </div>
                            <button
                                className="delete-btn"
                                onClick={(e) => handleDelete(p.id, e)}
                                title="Delete Project"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
