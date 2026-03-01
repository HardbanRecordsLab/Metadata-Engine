"""
Batch Processing Service using FastAPI BackgroundTasks.
Provides a queue-based approach for processing multiple files efficiently.
"""
import asyncio
import logging
from typing import List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.db import Job, SessionLocal
from app.services.audio_analyzer import AudioAnalyzer
import os

logger = logging.getLogger(__name__)

class BatchProcessor:
    """
    Handles batch processing of audio files with proper queue management.
    Uses asyncio for concurrent processing while respecting resource limits.
    """
    
    def __init__(self, max_concurrent: int = 3):
        """
        Args:
            max_concurrent: Maximum number of files to process simultaneously
        """
        self.max_concurrent = max_concurrent
        self.processing_queue: List[str] = []
        self.active_jobs: Dict[str, asyncio.Task] = {}
    
    async def process_file_job(self, job_id: str, file_path: str) -> Dict[str, Any]:
        """
        Process a single file and update the job status in the database.
        
        Args:
            job_id: Database job ID
            file_path: Path to audio file
            
        Returns:
            Analysis results dictionary
        """
        db = SessionLocal()
        try:
            # Update job status to processing
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            job.status = "processing"
            db.commit()
            
            logger.info(f"[BatchProcessor] Starting analysis for job {job_id}: {file_path}")
            
            # Run analysis
            analyzer = AudioAnalyzer(file_path)
            result = await analyzer.analyze()
            
            # Update job with results
            job.status = "completed"
            job.result = result
            job.timestamp = datetime.now()
            db.commit()
            
            logger.info(f"[BatchProcessor] Completed job {job_id}")
            return result
            
        except Exception as e:
            logger.error(f"[BatchProcessor] Job {job_id} failed: {e}")
            if job:
                job.status = "failed"
                job.result = {"error": str(e)}
                db.commit()
            raise
        finally:
            db.close()
    
    async def process_batch(self, job_file_pairs: List[tuple]) -> List[Dict[str, Any]]:
        """
        Process multiple files with concurrency control.
        
        Args:
            job_file_pairs: List of (job_id, file_path) tuples
            
        Returns:
            List of results for each job
        """
        results = []
        semaphore = asyncio.Semaphore(self.max_concurrent)
        
        async def process_with_limit(job_id: str, file_path: str):
            async with semaphore:
                return await self.process_file_job(job_id, file_path)
        
        # Create tasks for all jobs
        tasks = [
            process_with_limit(job_id, file_path)
            for job_id, file_path in job_file_pairs
        ]
        
        # Wait for all to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log any failures
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Batch job {job_file_pairs[i][0]} failed: {result}")
        
        return results
    
    def queue_batch(self, job_ids: List[str]) -> None:
        """
        Add jobs to the processing queue.
        
        Args:
            job_ids: List of job IDs to queue
        """
        self.processing_queue.extend(job_ids)
        logger.info(f"[BatchProcessor] Queued {len(job_ids)} jobs. Total in queue: {len(self.processing_queue)}")
    
    def get_queue_status(self) -> Dict[str, Any]:
        """
        Get current queue status.
        
        Returns:
            Dictionary with queue metrics
        """
        return {
            "queued": len(self.processing_queue),
            "active": len(self.active_jobs),
            "max_concurrent": self.max_concurrent
        }


# Global instance
# HF Pro can handle more (default to 6 if likely on high-end hardware, else 3)
max_concurrent = int(os.getenv("BATCH_MAX_CONCURRENT", "3"))
batch_processor = BatchProcessor(max_concurrent=max_concurrent)
