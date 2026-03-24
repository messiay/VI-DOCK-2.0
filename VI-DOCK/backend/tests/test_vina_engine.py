import unittest
import os
import tempfile
from unittest.mock import Mock, patch, MagicMock
import sys

# Add the project root to Python path - FIXED PATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.docking_engine import VinaEngine, DockingEngineFactory


class TestVinaEngine(unittest.TestCase):
    """Test cases for VinaEngine docking functionality."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.engine = VinaEngine()
        self.temp_dir = tempfile.mkdtemp()
        
        # Create mock receptor and ligand files
        self.receptor_path = os.path.join(self.temp_dir, "test_receptor.pdb")
        self.ligand_path = os.path.join(self.temp_dir, "test_ligand.pdb")
        self.output_path = os.path.join(self.temp_dir, "output.pdbqt")
        
        # Create minimal valid PDB files for testing
        with open(self.receptor_path, 'w') as f:
            f.write("ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00  0.00           N  \n")
            f.write("ATOM      2  CA  ALA A   1       1.458   0.000   0.000  1.00  0.00           C  \n")
        
        with open(self.ligand_path, 'w') as f:
            f.write("HETATM    1  C1  LIG A   1       5.000   5.000   5.000  1.00  0.00           C  \n")
            f.write("HETATM    2  C2  LIG A   1       6.000   5.000   5.000  1.00  0.00           C  \n")
    
    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_vina_engine_initialization(self):
        """Test that VinaEngine initializes correctly."""
        self.assertEqual(self.engine.get_name(), "AutoDock Vina")
        self.assertIsNotNone(self.engine.get_version())
    
    def test_validate_parameters_valid(self):
        """Test parameter validation with valid inputs."""
        center = (10.0, 10.0, 10.0)
        size = (20.0, 20.0, 20.0)
        
        result = self.engine.validate_parameters(center, size)
        self.assertTrue(result)
    
    def test_validate_parameters_invalid(self):
        """Test parameter validation with invalid inputs."""
        # Test negative size
        center = (10.0, 10.0, 10.0)
        size = (-20.0, 20.0, 20.0)
        
        result = self.engine.validate_parameters(center, size)
        self.assertFalse(result)
    
    @patch('core.docking_engine.run_command')
    @patch('core.docking_engine.os.path.exists')
    def test_run_docking_success(self, mock_exists, mock_run_command):
        """Test successful docking execution."""
        # Mock the command execution
        mock_process = Mock()
        mock_process.stdout = """
        mode |   affinity | dist from best mode
           1         -9.1      0.000      0.000
           2         -8.5      1.234      1.234
        """
        mock_run_command.return_value = mock_process
        mock_exists.return_value = True
        
        # Mock file preparation
        with patch.object(self.engine.file_manager, 'prepare_receptor') as mock_prep_rec:
            with patch.object(self.engine.file_manager, 'prepare_ligand') as mock_prep_lig:
                mock_prep_rec.return_value = self.receptor_path + "qt"
                mock_prep_lig.return_value = self.ligand_path + "qt"
                
                center = (10.0, 10.0, 10.0)
                size = (20.0, 20.0, 20.0)
                
                result = self.engine.run_docking(
                    self.receptor_path, self.ligand_path, self.output_path,
                    center, size, exhaustiveness=8
                )
                
                self.assertTrue(result['success'])
                self.assertEqual(result['engine'], "AutoDock Vina")
                self.assertIn('scores', result)
    
    def test_parse_output_valid(self):
        """Test parsing valid Vina output."""
        output_content = """
        mode |   affinity | dist from best mode
           1         -9.1      0.000      0.000
           2         -8.5      1.234      1.234
           3         -8.2      2.567      2.567
        """
        
        scores = self.engine.parse_output(output_content)
        
        self.assertEqual(len(scores), 3)
        self.assertEqual(scores[0]['Mode'], 1)
        self.assertEqual(scores[0]['Affinity (kcal/mol)'], -9.1)
        self.assertEqual(scores[0]['RMSD L.B.'], 0.000)
        self.assertEqual(scores[0]['RMSD U.B.'], 0.000)
    
    def test_parse_output_empty(self):
        """Test parsing empty Vina output."""
        scores = self.engine.parse_output("")
        self.assertEqual(scores, [])
    
    def test_parse_output_malformed(self):
        """Test parsing malformed Vina output."""
        output_content = "This is not a valid Vina output format"
        scores = self.engine.parse_output(output_content)
        self.assertEqual(scores, [])
    
    def test_get_default_parameters(self):
        """Test retrieval of default parameters."""
        params = self.engine.get_default_parameters()
        
        self.assertIn('exhaustiveness', params)
        self.assertIn('num_modes', params)
        self.assertIn('energy_range', params)
        
        self.assertEqual(params['exhaustiveness'], 8)
    
    def test_get_parameter_ranges(self):
        """Test retrieval of parameter ranges."""
        ranges = self.engine.get_parameter_ranges()
        
        self.assertIn('exhaustiveness', ranges)
        self.assertIn('num_modes', ranges)
        self.assertIn('energy_range', ranges)
        
        self.assertEqual(ranges['exhaustiveness'], (1, 128))


class TestDockingEngineFactory(unittest.TestCase):
    """Test cases for DockingEngineFactory."""
    
    def test_create_engine_vina(self):
        """Test creating Vina engine."""
        engine = DockingEngineFactory.create_engine("vina")
        self.assertIsInstance(engine, VinaEngine)
    
    def test_create_engine_invalid(self):
        """Test creating invalid engine type."""
        with self.assertRaises(ValueError):
            DockingEngineFactory.create_engine("invalid_engine")
    
    def test_get_available_engines(self):
        """Test getting available engines."""
        engines = DockingEngineFactory.get_available_engines()
        engine_ids = [e['id'] for e in engines]
        self.assertIn("vina", engine_ids)
    
    def test_get_engine_info(self):
        """Test getting engine information."""
        info = DockingEngineFactory.get_engine_info("vina")
        
        self.assertIn('name', info)
        self.assertIn('version', info)
        self.assertIn('supported_formats', info)
        self.assertIn('default_parameters', info)


if __name__ == '__main__':
    unittest.main()