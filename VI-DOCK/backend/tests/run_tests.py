#!/usr/bin/env python3
"""
Test runner for VI DOCK unit tests.
"""

import unittest
import sys
import os

def run_tests():
    """Run all unit tests."""
    # Add the project root to Python path
    # run_tests.py is in tests/, so project root is one level up
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, project_root)
    
    # Discover and run tests
    loader = unittest.TestLoader()
    start_dir = os.path.join(project_root, 'tests')
    
    print(f"Running tests from: {start_dir}")
    print(f"Python path: {sys.path}")
    
    # Check if start directory exists
    if not os.path.exists(start_dir):
        print(f"Error: Test directory not found: {start_dir}")
        return 1
    
    suite = loader.discover(start_dir, pattern='test_*.py')
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Return exit code based on test results
    return 0 if result.wasSuccessful() else 1

if __name__ == '__main__':
    sys.exit(run_tests())