import os
import json
import shutil
from typing import Dict, Any, List


class SessionManager:
    """Manages saving and loading application sessions."""
    
    def __init__(self):
        self.session_data = {}
        
    def save_session(self, filepath: str, app_data: Dict[str, Any]) -> bool:
        """Save current session to file."""
        try:
            # Create session directory for files
            session_dir = os.path.splitext(filepath)[0] + "_files"
            os.makedirs(session_dir, exist_ok=True)
            
            # Prepare session data
            session_data = self._prepare_session_data(app_data, session_dir)
            
            # Write session file
            with open(filepath, 'w') as f:
                json.dump(session_data, f, indent=4)
                
            return True
            
        except Exception as e:
            raise Exception(f"Failed to save session: {e}")
    
    def load_session(self, filepath: str) -> Dict[str, Any]:
        """Load session from file."""
        try:
            with open(filepath, 'r') as f:
                session_data = json.load(f)
            return session_data
        except Exception as e:
            raise Exception(f"Failed to load session: {e}")
    
    def _prepare_session_data(self, app_data: Dict[str, Any], session_dir: str) -> Dict[str, Any]:
        """Prepare session data and copy necessary files."""
        session_data = app_data.copy()
        session_data['session_directory'] = session_dir
        
        # Copy result files to session directory
        if app_data.get('last_run_type') == 'single':
            self._copy_single_docking_files(app_data, session_dir, session_data)
        elif app_data.get('last_run_type') == 'batch':
            self._copy_batch_docking_files(app_data, session_dir, session_data)
            
        return session_data
    
    def _copy_single_docking_files(self, app_data: Dict, session_dir: str, session_data: Dict):
        """Copy single docking files to session directory."""
        receptor_path = app_data.get('receptor_pdbqt_path')
        results_path = app_data.get('single_docking_output_path')
        
        if receptor_path and results_path and os.path.exists(receptor_path) and os.path.exists(results_path):
            receptor_filename = os.path.basename(receptor_path)
            results_filename = os.path.basename(results_path)
            
            new_receptor_path = os.path.join(session_dir, receptor_filename)
            new_results_path = os.path.join(session_dir, results_filename)
            
            shutil.copy2(receptor_path, new_receptor_path)
            shutil.copy2(results_path, new_results_path)
            
            session_data['receptor_pdbqt_path'] = new_receptor_path
            session_data['single_docking_output_path'] = new_results_path
    
    def _copy_batch_docking_files(self, app_data: Dict, session_dir: str, session_data: Dict):
        """Copy batch docking files to session directory."""
        receptor_path = app_data.get('receptor_pdbqt_path')
        if not receptor_path or not os.path.exists(receptor_path):
            return
            
        receptor_filename = os.path.basename(receptor_path)
        new_receptor_path = os.path.join(session_dir, receptor_filename)
        shutil.copy2(receptor_path, new_receptor_path)
        session_data['receptor_pdbqt_path'] = new_receptor_path
        
        # Copy batch result files
        batch_files = []
        for result in app_data.get('batch_results_summary', []):
            if result.get('OutputFile') and os.path.exists(result['OutputFile']):
                filename = os.path.basename(result['OutputFile'])
                new_path = os.path.join(session_dir, filename)
                shutil.copy2(result['OutputFile'], new_path)
                batch_files.append({
                    'Ligand': result['Ligand'],
                    'OutputFile': new_path
                })
        
        session_data['batch_files'] = batch_files
