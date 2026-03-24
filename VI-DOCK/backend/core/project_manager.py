import json
import shutil
import uuid
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from pathlib import Path
from .database_manager import DatabaseManager


class ProjectManager:
    """
    Manages VI DOCK projects with organized folder structure and file management.
    Each project is stored in a dedicated folder with all necessary files.
    """
    
    def __init__(self):
        self.current_project_path: Optional[Path] = None
        self.project_data: Dict[str, Any] = {}
        self.db_manager: Optional[DatabaseManager] = None
    
    def create_new_project(self, project_name: str, base_directory: Union[str, Path]) -> str:
        """
        Create a new project with organized folder structure.
        
        Args:
            project_name: Name for the new project
            base_directory: Directory where project folder will be created
            
        Returns:
            Path to the created project folder as string
        """
        try:
            base_dir = Path(base_directory)
            # Create project folder with timestamp and unique ID
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_id = str(uuid.uuid4())[:8]
            folder_name = f"{project_name}_{timestamp}_{unique_id}"
            project_path = base_dir / folder_name
            
            # Create main project folder
            project_path.mkdir(parents=True, exist_ok=True)
            
            # Create subdirectories
            subdirs = [
                'receptors',
                'ligands',
                'results',
                'docking_runs',
                'temp',
                'backups'
            ]
            
            for subdir in subdirs:
                (project_path / subdir).mkdir(exist_ok=True)
            
            # Initialize project data
            self.project_data = {
                'project_info': {
                    'name': project_name,
                    'created': datetime.now().isoformat(),
                    'version': '1.0',
                    'vidock_version': '3.1'
                },
                'files': {
                    'receptors': [],
                    'ligands': [],
                    'results': []
                },
                'docking_sessions': [],
                'settings': {},
                'metadata': {}
            }
            
            self.current_project_path = project_path
            self._save_project_file()
            
            # Initialize database
            self.db_manager = DatabaseManager(project_path / 'project.db')
            
            return str(project_path)
            
        except Exception as e:
            raise Exception(f"Failed to create project: {e}")
    
    def load_project(self, project_path: Union[str, Path]) -> Dict[str, Any]:
        """
        Load an existing project.
        
        Args:
            project_path: Path to project folder or project.json file
            
        Returns:
            Project data dictionary
        """
        try:
            path_obj = Path(project_path)
            
            # If path is to project.json, get the folder path
            if path_obj.name == 'project.json':
                project_path_obj = path_obj.parent
            else:
                project_path_obj = path_obj
            
            project_file = project_path_obj / 'project.json'
            
            if not project_file.exists():
                raise FileNotFoundError(f"Project file not found: {project_file}")
            
            with open(project_file, 'r') as f:
                self.project_data = json.load(f)
            
            self.current_project_path = project_path_obj
            
            # Update paths to be absolute
            self._update_paths_to_absolute()
            
            # Initialize database
            self.db_manager = DatabaseManager(project_path_obj / 'project.db')
            
            return self.project_data
            
        except Exception as e:
            raise Exception(f"Failed to load project: {e}")
    
    def save_project(self) -> bool:
        """Save current project state."""
        if not self.current_project_path:
            raise Exception("No project loaded")
        
        try:
            # Update modification time
            self.project_data['project_info']['modified'] = datetime.now().isoformat()
            
            # Convert absolute paths to relative before saving
            self._update_paths_to_relative()
            
            self._save_project_file()
            return True
            
        except Exception as e:
            raise Exception(f"Failed to save project: {e}")
        finally:
            # Convert back to absolute for continued use, even if save failed
            # This prevents in-memory state corruption
            self._update_paths_to_absolute()
    
    def add_receptor(self, receptor_path: Union[str, Path], copy_file: bool = True) -> str:
        """
        Add a receptor file to the project.
        """
        if not self.current_project_path:
            raise Exception("No project loaded")
            
        # [SAFETY] Reload project data from disk to minimize race conditions with other API threads
        self.load_project(self.current_project_path)
        
        try:
            receptor_path_obj = Path(receptor_path)
            receptor_name = receptor_path_obj.name
            
            if copy_file:
                # Copy to project receptors folder
                project_receptor_path = self.current_project_path / 'receptors' / receptor_name
                shutil.copy2(receptor_path_obj, project_receptor_path)
                stored_path = project_receptor_path
            else:
                stored_path = receptor_path_obj
            
            # Prepare new receptor info
            receptor_info = {
                'name': receptor_name,
                'path': str(stored_path),
                'added': datetime.now().isoformat(),
                'file_size': stored_path.stat().st_size
            }
            
            # Atomic update: append to list
            self.project_data['files']['receptors'].append(receptor_info)
            
            # Save immediately
            self.save_project()
            
            return str(stored_path)
            
        except Exception as e:
            raise Exception(f"Failed to add receptor: {e}")
    
    def add_ligands(self, ligand_paths: List[Union[str, Path]], copy_files: bool = True) -> List[str]:
        """
        Add multiple ligand files to the project.
        """
        if not self.current_project_path:
            raise Exception("No project loaded")
            
        # [SAFETY] Reload project data from disk
        self.load_project(self.current_project_path)
        
        # Keep track of added ligands to rollback if needed
        added_indices = []
        
        try:
            project_ligand_paths = []
            new_ligand_infos = []
            
            for ligand_path in ligand_paths:
                ligand_path_obj = Path(ligand_path)
                ligand_name = ligand_path_obj.name
                
                if copy_files:
                    # Copy to project ligands folder
                    project_ligand_path = self.current_project_path / 'ligands' / ligand_name
                    shutil.copy2(ligand_path_obj, project_ligand_path)
                    stored_path = project_ligand_path
                else:
                    stored_path = ligand_path_obj
                
                # Prepare info
                ligand_info = {
                    'name': ligand_name,
                    'path': str(stored_path),
                    'added': datetime.now().isoformat(),
                    'file_size': stored_path.stat().st_size
                }
                
                new_ligand_infos.append(ligand_info)
                project_ligand_paths.append(str(stored_path))
            
            # Atomic-like update
            start_index = len(self.project_data['files']['ligands'])
            self.project_data['files']['ligands'].extend(new_ligand_infos)
            
            # Attempt to save
            try:
                self.save_project()
            except Exception as save_error:
                # Rollback in-memory changes if save fails
                self.project_data['files']['ligands'] = self.project_data['files']['ligands'][:start_index]
                raise save_error
            
            return project_ligand_paths
            
        except Exception as e:
            raise Exception(f"Failed to add ligands: {e}")
    
    def save_docking_session(self, session_data: Dict[str, Any]) -> str:
        """
        Save a docking session to the project.
        """
        if not self.current_project_path:
            raise Exception("No project loaded")
            
        # [SAFETY] Reload project data from disk
        self.load_project(self.current_project_path)
        
        try:
            # Create session ID and timestamp
            session_id = str(uuid.uuid4())[:8]
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            session_name = f"docking_session_{timestamp}_{session_id}"
            
            # Create session folder
            session_folder = self.current_project_path / 'docking_runs' / session_name
            session_folder.mkdir(parents=True, exist_ok=True)
            
            # Copy result files to session folder
            copied_files = {}
            
            if 'receptor_pdbqt_path' in session_data:
                src_path = Path(session_data['receptor_pdbqt_path'])
                if src_path.exists():
                    new_receptor_path = session_folder / src_path.name
                    shutil.copy2(src_path, new_receptor_path)
                    copied_files['receptor_pdbqt_path'] = str(new_receptor_path)
            
            if 'single_docking_output_path' in session_data:
                src_path = Path(session_data['single_docking_output_path'])
                if src_path.exists():
                    new_result_path = session_folder / src_path.name
                    shutil.copy2(src_path, new_result_path)
                    copied_files['single_docking_output_path'] = str(new_result_path)
            
            # Copy batch result files
            batch_files = []
            for result in session_data.get('batch_results_summary', []):
                if result.get('OutputFile'):
                    src_path = Path(result['OutputFile'])
                    if src_path.exists():
                        new_result_path = session_folder / src_path.name
                        shutil.copy2(src_path, new_result_path)
                        batch_files.append({
                            'Ligand': result['Ligand'],
                            'OutputFile': str(new_result_path)
                        })
            
            # Update session data with new paths
            session_data.update(copied_files)
            if batch_files:
                session_data['batch_files'] = batch_files
            
            # Save session file (Metadata only - Keep it lightweight)
            # [OPTIMIZATION] Strip large results from JSON, rely on SQLite (project.db) for data
            session_meta_data = session_data.copy()
            if 'batch_results_summary' in session_meta_data:
                del session_meta_data['batch_results_summary']
            if 'last_results' in session_meta_data:
                # Keep top 1 result for quick reference, discard the rest from JSON
                top_results = session_meta_data['last_results'][:1] if session_meta_data['last_results'] else []
                session_meta_data['last_results'] = top_results
            
            session_file = session_folder / 'session.json'
            with open(session_file, 'w') as f:
                json.dump(session_meta_data, f, indent=4)
            
            # Add to project data
            session_info = {
                'name': session_name,
                'session_file': str(session_file),
                'created': datetime.now().isoformat(),
                'type': session_data.get('last_run_type', 'unknown'),
                'ligand_count': len(session_data.get('ligand_library', [])),
                'results_count': len(session_data.get('last_results', [])) + len(session_data.get('batch_results_summary', []))
            }
            
            self.project_data['docking_sessions'].append(session_info)
            self.save_project()
            
            # Save to database
            if self.db_manager:
                try:
                    self.db_manager.save_session(session_data, str(self.current_project_path))
                except Exception as db_error:
                    # Log error but don't fail the whole operation if DB save fails
                    print(f"Warning: Failed to save session to database: {db_error}")
            
            return str(session_file)
            
        except Exception as e:
            raise Exception(f"Failed to save docking session: {e}")
    
    def export_results(self, output_format: str = 'csv', include_files: bool = True) -> str:
        """
        Export project results in specified format.
        
        Args:
            output_format: Export format ('csv', 'json', 'xlsx')
            include_files: Whether to include result files in export
            
        Returns:
            Path to export file/folder as string
        """
        if not self.current_project_path:
            raise Exception("No project loaded")
        
        try:
            export_time = datetime.now().strftime("%Y%m%d_%H%M%S")
            export_name = f"project_export_{export_time}"
            export_path = self.current_project_path / 'exports' / export_name
            export_path.mkdir(parents=True, exist_ok=True)
            
            if output_format == 'csv':
                self._export_to_csv(export_path)
            elif output_format == 'json':
                self._export_to_json(export_path)
            elif output_format == 'xlsx':
                self._export_to_excel(export_path)
            
            if include_files:
                # Copy important files to export folder
                self._copy_files_for_export(export_path)
            
            return str(export_path)
            
        except Exception as e:
            raise Exception(f"Failed to export project: {e}")
    
    def get_project_summary(self) -> Dict[str, Any]:
        """Get summary of project contents."""
        if not self.current_project_path:
            raise Exception("No project loaded")
        
        summary = {
            'project_info': self.project_data.get('project_info', {}),
            'file_counts': {
                'receptors': len(self.project_data.get('files', {}).get('receptors', [])),
                'ligands': len(self.project_data.get('files', {}).get('ligands', [])),
                'sessions': len(self.project_data.get('docking_sessions', []))
            },
            'total_file_size': self._calculate_total_size(),
            'recent_sessions': self.project_data.get('docking_sessions', [])[-5:]  # Last 5 sessions
        }
        
        return summary
    
    def backup_project(self) -> str:
        """Create a backup of the entire project."""
        if not self.current_project_path:
            raise Exception("No project loaded")
        
        try:
            backup_time = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"project_backup_{backup_time}"
            backup_path = self.current_project_path / 'backups' / backup_name
            
            # Create zip of entire project
            # shutil.make_archive expects base_name (without extension) and root_dir
            shutil.make_archive(str(backup_path), 'zip', self.current_project_path)
            
            zip_path = Path(f"{backup_path}.zip")
            
            # Add backup info to project
            backup_info = {
                'name': backup_name,
                'path': str(zip_path),
                'created': datetime.now().isoformat(),
                'size': zip_path.stat().st_size
            }
            
            if 'backups' not in self.project_data:
                self.project_data['backups'] = []
            
            self.project_data['backups'].append(backup_info)
            self.save_project()
            
            return str(zip_path)
            
        except Exception as e:
            raise Exception(f"Failed to create backup: {e}")
    
    def _save_project_file(self):
        """Save project.json file."""
        if not self.current_project_path:
            return
        project_file = self.current_project_path / 'project.json'
        with open(project_file, 'w') as f:
            json.dump(self.project_data, f, indent=4)
    
    def _update_paths_to_relative(self):
        """Convert absolute paths to relative paths for storage."""
        if not self.current_project_path:
            return
        
        def to_relative(path_str: str) -> str:
            try:
                p = Path(path_str)
                if p.is_absolute():
                    return str(p.relative_to(self.current_project_path))
                return path_str
            except ValueError:
                # Path is not relative to project path (e.g. external file)
                return path_str

        # Update receptor paths
        for receptor in self.project_data.get('files', {}).get('receptors', []):
            if 'path' in receptor:
                receptor['path'] = to_relative(receptor['path'])
        
        # Update ligand paths
        for ligand in self.project_data.get('files', {}).get('ligands', []):
            if 'path' in ligand:
                ligand['path'] = to_relative(ligand['path'])
        
        # Update session paths
        for session in self.project_data.get('docking_sessions', []):
            if 'session_file' in session:
                session['session_file'] = to_relative(session['session_file'])
    
    def _update_paths_to_absolute(self):
        """Convert relative paths to absolute paths for use."""
        if not self.current_project_path:
            return
        
        def to_absolute(path_str: str) -> str:
            p = Path(path_str)
            if not p.is_absolute():
                return str(self.current_project_path / p)
            return path_str

        # Update receptor paths
        for receptor in self.project_data.get('files', {}).get('receptors', []):
            if 'path' in receptor:
                receptor['path'] = to_absolute(receptor['path'])
        
        # Update ligand paths
        for ligand in self.project_data.get('files', {}).get('ligands', []):
            if 'path' in ligand:
                ligand['path'] = to_absolute(ligand['path'])
        
        # Update session paths
        for session in self.project_data.get('docking_sessions', []):
            if 'session_file' in session:
                session['session_file'] = to_absolute(session['session_file'])
    
    def _calculate_total_size(self) -> int:
        """Calculate total size of project files."""
        total_size = 0
        if not self.current_project_path:
            return 0
            
        # Calculate size of all files in project
        for p in self.current_project_path.rglob('*'):
            if p.is_file():
                total_size += p.stat().st_size
        
        return total_size
    
    def _export_to_csv(self, export_path: Path):
        """Export project data to CSV format."""
        # Implementation for CSV export
        pass
    
    def _export_to_json(self, export_path: Path):
        """Export project data to JSON format."""
        export_file = export_path / 'project_export.json'
        with open(export_file, 'w') as f:
            json.dump(self.project_data, f, indent=4)
    
    def _export_to_excel(self, export_path: Path):
        """Export project data to Excel format."""
        # Implementation for Excel export (would require openpyxl)
        pass
    
    def _copy_files_for_export(self, export_path: Path):
        """Copy important files for export."""
        # Copy receptors
        receptors_dir = export_path / 'receptors'
        receptors_dir.mkdir(exist_ok=True)
        for receptor in self.project_data.get('files', {}).get('receptors', []):
            p = Path(receptor['path'])
            if p.exists():
                shutil.copy2(p, receptors_dir)
        
        # Copy ligands
        ligands_dir = export_path / 'ligands'
        ligands_dir.mkdir(exist_ok=True)
        for ligand in self.project_data.get('files', {}).get('ligands', []):
            p = Path(ligand['path'])
            if p.exists():
                shutil.copy2(p, ligands_dir)
        
        # Copy session results
        results_dir = export_path / 'results'
        results_dir.mkdir(exist_ok=True)
        for session in self.project_data.get('docking_sessions', []):
            p = Path(session['session_file'])
            if p.exists():
                shutil.copy2(p, results_dir)


class ProjectBrowser:
    """
    Utility class for browsing and managing multiple projects.
    """
    
    @staticmethod
    def list_projects(projects_directory: Union[str, Path]) -> List[Dict[str, Any]]:
        """
        List all projects in a directory.
        
        Args:
            projects_directory: Directory containing projects
            
        Returns:
            List of project information dictionaries
        """
        projects = []
        projects_dir = Path(projects_directory)
        
        if not projects_dir.exists():
            return projects
        
        for item_path in projects_dir.iterdir():
            project_file = item_path / 'project.json'
            
            if item_path.is_dir() and project_file.exists():
                try:
                    with open(project_file, 'r') as f:
                        project_data = json.load(f)
                    
                    project_info = {
                        'name': project_data.get('project_info', {}).get('name', item_path.name),
                        'path': str(item_path),
                        'created': project_data.get('project_info', {}).get('created', ''),
                        'modified': project_data.get('project_info', {}).get('modified', ''),
                        'file_count': len(project_data.get('files', {}).get('receptors', [])) +
                                     len(project_data.get('files', {}).get('ligands', [])),
                        'session_count': len(project_data.get('docking_sessions', []))
                    }
                    
                    projects.append(project_info)
                    
                except Exception:
                    # Skip projects that can't be read
                    continue
        
        # Sort by modification time (newest first)
        projects.sort(key=lambda x: x.get('modified', ''), reverse=True)
        
        return projects
    
    @staticmethod
    def get_recent_projects(projects_directory: Union[str, Path], limit: int = 5) -> List[Dict[str, Any]]:
        """
        Get most recently modified projects.
        
        Args:
            projects_directory: Directory containing projects
            limit: Maximum number of projects to return
            
        Returns:
            List of recent project information
        """
        all_projects = ProjectBrowser.list_projects(projects_directory)
        return all_projects[:limit]