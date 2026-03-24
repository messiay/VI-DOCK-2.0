import unittest
import os
import tempfile
import json
import shutil
from datetime import datetime
from unittest.mock import patch

import sys
# Add the project root to Python path - FIXED PATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.project_manager import ProjectManager, ProjectBrowser


class TestProjectManager(unittest.TestCase):
    """Test cases for ProjectManager functionality."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.project_manager = ProjectManager()
        
        # Create test files
        self.test_receptor = os.path.join(self.temp_dir, "test_receptor.pdb")
        self.test_ligand = os.path.join(self.temp_dir, "test_ligand.pdb")
        
        with open(self.test_receptor, 'w') as f:
            f.write("ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00  0.00           N  \n")
        
        with open(self.test_ligand, 'w') as f:
            f.write("HETATM    1  C1  LIG A   1       5.000   5.000   5.000  1.00  0.00           C  \n")
    
    def tearDown(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_create_new_project(self):
        """Test creating a new project."""
        project_path = self.project_manager.create_new_project(
            "TestProject", self.temp_dir
        )
        
        self.assertTrue(os.path.exists(project_path))
        self.assertTrue(os.path.isdir(project_path))
        
        # Check project structure
        expected_dirs = ['receptors', 'ligands', 'results', 'docking_runs', 'temp', 'backups']
        for subdir in expected_dirs:
            self.assertTrue(os.path.exists(os.path.join(project_path, subdir)))
        
        # Check project.json file
        project_file = os.path.join(project_path, 'project.json')
        self.assertTrue(os.path.exists(project_file))
        
        # Verify project data was initialized
        self.assertIsNotNone(self.project_manager.project_data)
        self.assertEqual(self.project_manager.project_data['project_info']['name'], 'TestProject')
    
    def test_load_project(self):
        """Test loading an existing project."""
        # First create a project
        project_path = self.project_manager.create_new_project(
            "LoadTestProject", self.temp_dir
        )
        
        # Now load it
        loaded_data = self.project_manager.load_project(project_path)
        
        self.assertEqual(loaded_data['project_info']['name'], 'LoadTestProject')
        # Convert Path to string for comparison or compare Path objects
        self.assertEqual(str(self.project_manager.current_project_path), str(project_path))
    
    def test_load_project_invalid_path(self):
        """Test loading project from invalid path."""
        with self.assertRaises(Exception):
            self.project_manager.load_project("/invalid/path/project.json")
    
    def test_save_project(self):
        """Test saving project state."""
        project_path = self.project_manager.create_new_project(
            "SaveTestProject", self.temp_dir
        )
        
        # Modify project data
        self.project_manager.project_data['project_info']['test_key'] = 'test_value'
        
        # Save project
        result = self.project_manager.save_project()
        self.assertTrue(result)
        
        # Verify save
        project_file = os.path.join(project_path, 'project.json')
        with open(project_file, 'r') as f:
            saved_data = json.load(f)
        
        self.assertEqual(saved_data['project_info']['test_key'], 'test_value')
        self.assertIn('modified', saved_data['project_info'])
    
    def test_add_receptor_with_copy(self):
        """Test adding receptor with file copy."""
        project_path = self.project_manager.create_new_project(
            "ReceptorTest", self.temp_dir
        )
        
        stored_path = self.project_manager.add_receptor(self.test_receptor, copy_file=True)
        
        # Check that file was copied
        expected_path = os.path.join(project_path, 'receptors', 'test_receptor.pdb')
        self.assertEqual(stored_path, expected_path)
        self.assertTrue(os.path.exists(expected_path))
        
        # Check that receptor was added to project data
        receptors = self.project_manager.project_data['files']['receptors']
        self.assertEqual(len(receptors), 1)
        self.assertEqual(receptors[0]['name'], 'test_receptor.pdb')
    
    def test_add_receptor_without_copy(self):
        """Test adding receptor without file copy."""
        project_path = self.project_manager.create_new_project(
            "ReceptorNoCopyTest", self.temp_dir
        )
        
        stored_path = self.project_manager.add_receptor(self.test_receptor, copy_file=False)
        
        # Check that original path is used
        self.assertEqual(stored_path, self.test_receptor)
        
        # Check that receptor was still added to project data
        receptors = self.project_manager.project_data['files']['receptors']
        self.assertEqual(len(receptors), 1)
    
    def test_add_ligands(self):
        """Test adding multiple ligands."""
        project_path = self.project_manager.create_new_project(
            "LigandTest", self.temp_dir
        )
        
        # Create multiple test ligands
        ligand_paths = [
            os.path.join(self.temp_dir, "ligand1.pdb"),
            os.path.join(self.temp_dir, "ligand2.pdb")
        ]
        
        for path in ligand_paths:
            with open(path, 'w') as f:
                f.write("HETATM    1  C1  LIG A   1       5.000   5.000   5.000  1.00  0.00           C  \n")
        
        stored_paths = self.project_manager.add_ligands(ligand_paths, copy_files=True)
        
        self.assertEqual(len(stored_paths), 2)
        
        # Check that files were copied
        for i, path in enumerate(stored_paths):
            expected_path = os.path.join(project_path, 'ligands', f'ligand{i+1}.pdb')
            self.assertEqual(path, expected_path)
            self.assertTrue(os.path.exists(expected_path))
        
        # Check that ligands were added to project data
        ligands = self.project_manager.project_data['files']['ligands']
        self.assertEqual(len(ligands), 2)
    
    def test_save_docking_session(self):
        """Test saving docking session."""
        project_path = self.project_manager.create_new_project(
            "SessionTest", self.temp_dir
        )
        
        # Create test session data
        session_data = {
            'last_run_type': 'single',
            'receptor_pdbqt_path': self.test_receptor,
            'single_docking_output_path': self.test_ligand,
            'ligand_library': [self.test_ligand],
            'last_results': [{'affinity': -9.1, 'mode': 1}]
        }
        
        session_file = self.project_manager.save_docking_session(session_data)
        
        self.assertTrue(os.path.exists(session_file))
        
        # Check that session was added to project data
        sessions = self.project_manager.project_data['docking_sessions']
        self.assertEqual(len(sessions), 1)
        self.assertEqual(sessions[0]['type'], 'single')
    
    def test_get_project_summary(self):
        """Test getting project summary."""
        project_path = self.project_manager.create_new_project(
            "SummaryTest", self.temp_dir
        )
        
        # Add some files
        self.project_manager.add_receptor(self.test_receptor, copy_file=True)
        self.project_manager.add_ligands([self.test_ligand], copy_files=True)
        
        summary = self.project_manager.get_project_summary()
        
        self.assertIn('project_info', summary)
        self.assertIn('file_counts', summary)
        self.assertIn('total_file_size', summary)
        
        self.assertEqual(summary['file_counts']['receptors'], 1)
        self.assertEqual(summary['file_counts']['ligands'], 1)
    
    def test_backup_project(self):
        """Test creating project backup."""
        project_path = self.project_manager.create_new_project(
            "BackupTest", self.temp_dir
        )
        
        backup_path = self.project_manager.backup_project()
        
        self.assertTrue(os.path.exists(backup_path))
        self.assertTrue(backup_path.endswith('.zip'))
        
        # Check that backup info was added to project data
        self.assertIn('backups', self.project_manager.project_data)
        self.assertEqual(len(self.project_manager.project_data['backups']), 1)


class TestProjectBrowser(unittest.TestCase):
    """Test cases for ProjectBrowser functionality."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.projects_dir = os.path.join(self.temp_dir, "projects")
        os.makedirs(self.projects_dir)
    
    def tearDown(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_list_projects_empty(self):
        """Test listing projects from empty directory."""
        projects = ProjectBrowser.list_projects(self.projects_dir)
        self.assertEqual(projects, [])
    
    def test_list_projects_with_valid_projects(self):
        """Test listing projects with valid project directories."""
        # Create a valid project
        project_dir = os.path.join(self.projects_dir, "test_project_20240101_120000_abc123")
        os.makedirs(project_dir)
        
        project_data = {
            'project_info': {
                'name': 'Test Project',
                'created': '2024-01-01T12:00:00',
                'modified': '2024-01-01T12:30:00',
                'version': '1.0'
            },
            'files': {
                'receptors': [{'name': 'rec1.pdb'}],
                'ligands': [{'name': 'lig1.pdb'}, {'name': 'lig2.pdb'}]
            },
            'docking_sessions': [{'name': 'session1'}]
        }
        
        with open(os.path.join(project_dir, 'project.json'), 'w') as f:
            json.dump(project_data, f)
        
        projects = ProjectBrowser.list_projects(self.projects_dir)
        
        self.assertEqual(len(projects), 1)
        self.assertEqual(projects[0]['name'], 'Test Project')
        self.assertEqual(projects[0]['file_count'], 3)  # 1 receptor + 2 ligands
        self.assertEqual(projects[0]['session_count'], 1)
    
    def test_list_projects_with_invalid_projects(self):
        """Test listing projects with invalid project directories."""
        # Create directory without project.json
        invalid_dir = os.path.join(self.projects_dir, "invalid_project")
        os.makedirs(invalid_dir)
        
        projects = ProjectBrowser.list_projects(self.projects_dir)
        self.assertEqual(projects, [])
    
    def test_get_recent_projects(self):
        """Test getting recent projects."""
        # Create multiple projects
        for i in range(3):
            project_dir = os.path.join(self.projects_dir, f"project_{i}")
            os.makedirs(project_dir)
            
            project_data = {
                'project_info': {
                    'name': f'Project {i}',
                    'created': f'2024-01-0{i+1}T12:00:00',
                    'modified': f'2024-01-0{i+1}T12:30:00'
                },
                'files': {'receptors': [], 'ligands': []},
                'docking_sessions': []
            }
            
            with open(os.path.join(project_dir, 'project.json'), 'w') as f:
                json.dump(project_data, f)
        
        recent_projects = ProjectBrowser.get_recent_projects(self.projects_dir, limit=2)
        
        self.assertEqual(len(recent_projects), 2)
        # Should be sorted by modification time (newest first)
        self.assertEqual(recent_projects[0]['name'], 'Project 2')


if __name__ == '__main__':
    unittest.main()