import sqlite3
import json
import csv
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from datetime import datetime

class DatabaseManager:
    """
    Manages SQLite database operations for VI DOCK projects.
    Handles storage and retrieval of docking sessions and results.
    """
    
    def __init__(self, db_path: Union[str, Path]):
        self.db_path = Path(db_path)
        self._init_db()
    
    def _init_db(self):
        """Initialize database schema."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Enable foreign keys
        cursor.execute("PRAGMA foreign_keys = ON")
        
        # Create sessions table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            engine TEXT,
            parameters TEXT,  -- JSON string of docking parameters
            project_path TEXT
        )
        """)
        
        # Create results table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            receptor TEXT NOT NULL,
            ligand TEXT NOT NULL,
            mode INTEGER,
            affinity REAL,
            rmsd_lb REAL,
            rmsd_ub REAL,
            output_file TEXT,
            full_data TEXT,  -- JSON string for extra data
            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
        )
        """)
        
        conn.commit()
        conn.close()
    
    def save_session(self, session_data: Dict[str, Any], project_path: str) -> int:
        """
        Save a docking session and its results to the database.
        
        Args:
            session_data: Dictionary containing session info and results
            project_path: Path to the project root
            
        Returns:
            session_id: ID of the inserted session
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Extract session info
            name = session_data.get('name', f"Session_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            created_at = datetime.now().isoformat()
            engine = session_data.get('engine', 'Unknown')
            
            # Extract parameters (everything except results)
            parameters = {k: v for k, v in session_data.items() 
                         if k not in ['batch_results_summary', 'last_results', 'full_batch_results']}
            
            cursor.execute("""
            INSERT INTO sessions (name, created_at, engine, parameters, project_path)
            VALUES (?, ?, ?, ?, ?)
            """, (name, created_at, engine, json.dumps(parameters), str(project_path)))
            
            session_id = cursor.lastrowid
            
            # Insert results
            # Handle batch results
            if 'full_batch_results' in session_data and session_data['full_batch_results']:
                self._insert_results(cursor, session_id, session_data['full_batch_results'])
            elif 'batch_results_summary' in session_data and session_data['batch_results_summary']:
                # If full results are missing, use summary (might lack mode info)
                self._insert_results(cursor, session_id, session_data['batch_results_summary'])
            elif 'last_results' in session_data and session_data['last_results']:
                # Single run results
                # Add receptor/ligand info if missing
                results = session_data['last_results']
                receptor = Path(session_data.get('receptor_pdbqt_path', 'unknown')).name
                ligand = Path(session_data.get('ligand_library', ['unknown'])[0]).name
                
                for res in results:
                    res['Receptor'] = receptor
                    res['Ligand'] = ligand
                
                self._insert_results(cursor, session_id, results)
            
            conn.commit()
            return session_id
            
        except Exception as e:
            conn.rollback()
            raise Exception(f"Failed to save session to database: {e}")
        finally:
            conn.close()
    
    def _insert_results(self, cursor, session_id: int, results: List[Dict[str, Any]]):
        """Helper to insert a list of results."""
        for res in results:
            receptor = res.get('Receptor', 'Unknown')
            ligand = res.get('Ligand', 'Unknown')
            mode = res.get('Mode', 1)
            
            # Handle affinity keys (could be 'Affinity (kcal/mol)' or 'Best Affinity (kcal/mol)')
            affinity = res.get('Affinity (kcal/mol)')
            if affinity is None:
                affinity = res.get('Best Affinity (kcal/mol)')
            
            rmsd_lb = res.get('RMSD L.B.')
            rmsd_ub = res.get('RMSD U.B.')
            output_file = res.get('OutputFile') or res.get('output_path')
            
            # Store everything else in full_data
            full_data = json.dumps(res)
            
            cursor.execute("""
            INSERT INTO results (session_id, receptor, ligand, mode, affinity, rmsd_lb, rmsd_ub, output_file, full_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, receptor, ligand, mode, affinity, rmsd_lb, rmsd_ub, output_file, full_data))

    def get_session_results(self, session_id: int) -> List[Dict[str, Any]]:
        """Get all results for a specific session."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM results WHERE session_id = ?", (session_id,))
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            res = dict(row)
            # Parse full_data if needed, or just return the flat structure
            if res['full_data']:
                try:
                    extra = json.loads(res['full_data'])
                    res.update(extra)
                except:
                    pass
            del res['full_data'] # Remove the raw json string to avoid clutter
            results.append(res)
            
        conn.close()
        return results

    def get_all_sessions(self) -> List[Dict[str, Any]]:
        """Get list of all sessions."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM sessions ORDER BY created_at DESC")
        rows = cursor.fetchall()
        
        sessions = []
        for row in rows:
            sess = dict(row)
            if sess['parameters']:
                try:
                    sess['parameters'] = json.loads(sess['parameters'])
                except:
                    pass
            sessions.append(sess)
            
        conn.close()
        return sessions

    def export_to_csv(self, results: List[Dict[str, Any]], output_path: str):
        """Export results to CSV."""
        if not results:
            return
            
        # Collect all keys
        all_keys = set()
        for res in results:
            all_keys.update(res.keys())
            
        # Define priority columns
        priority_cols = ['Receptor', 'Ligand', 'Mode', 'Affinity (kcal/mol)', 'RMSD L.B.', 'RMSD U.B.', 'Engine']
        
        # Build fieldnames list
        fieldnames = [c for c in priority_cols if c in all_keys]
        fieldnames.extend([c for c in sorted(all_keys) if c not in priority_cols])
        
        with open(output_path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)
