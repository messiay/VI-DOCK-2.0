import logging
import os
import sys
from datetime import datetime

def setup_logging(log_file: str = "vidock.log", level=logging.INFO):
    """
    Setup application logging to file and console.
    
    Args:
        log_file: Path to the log file.
        level: Logging level.
    """
    # Create logger
    logger = logging.getLogger("VI DOCK")
    logger.setLevel(level)
    
    # Check if handlers already exist to avoid duplicate logs
    if logger.handlers:
        return logger
    
    # Create file handler
    try:
        file_handler = logging.FileHandler(log_file, mode='a', encoding='utf-8')
        file_handler.setLevel(level)
        
        # Create console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # Add formatter to handlers
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        # Add handlers to logger
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        logger.info("Logging initialized")
        
    except Exception as e:
        print(f"Failed to setup logging: {e}")
        
    return logger

def get_logger():
    """Get the global logger instance."""
    return logging.getLogger("VI DOCK")
