"""
SHA-256 Hash Generator for Audio Files
Zero-cost cryptographic fingerprinting
"""

import hashlib
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def generate_file_hash(file_path: str, chunk_size: int = 8192) -> str:
    """
    Generate SHA-256 hash for a file.
    
    Args:
        file_path: Path to the audio file
        chunk_size: Size of chunks to read (default: 8KB)
    
    Returns:
        64-character hexadecimal SHA-256 hash
    
    Raises:
        FileNotFoundError: If file doesn't exist
        Exception: If hashing fails
    """
    try:
        sha256_hash = hashlib.sha256()
        
        with open(file_path, 'rb') as f:
            while chunk := f.read(chunk_size):
                sha256_hash.update(chunk)
        
        hash_hex = sha256_hash.hexdigest()
        logger.info(f"Generated SHA-256 hash for {file_path}: {hash_hex[:16]}...")
        
        return hash_hex
    
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        raise
    except Exception as e:
        logger.error(f"Hash generation failed for {file_path}: {e}")
        raise


def verify_file_hash(file_path: str, expected_hash: str) -> bool:
    """
    Verify if file matches expected SHA-256 hash.
    
    Args:
        file_path: Path to the audio file
        expected_hash: Expected SHA-256 hash (64 hex chars)
    
    Returns:
        True if hash matches, False otherwise
    """
    try:
        actual_hash = generate_file_hash(file_path)
        matches = actual_hash.lower() == expected_hash.lower()
        
        if matches:
            logger.info(f"Hash verification SUCCESS for {file_path}")
        else:
            logger.warning(f"Hash verification FAILED for {file_path}")
            logger.warning(f"Expected: {expected_hash}")
            logger.warning(f"Actual:   {actual_hash}")
        
        return matches
    
    except Exception as e:
        logger.error(f"Hash verification error: {e}")
        return False


def generate_hash_from_bytes(data: bytes) -> str:
    """
    Generate SHA-256 hash from bytes.
    
    Args:
        data: Binary data
    
    Returns:
        64-character hexadecimal SHA-256 hash
    """
    return hashlib.sha256(data).hexdigest()
