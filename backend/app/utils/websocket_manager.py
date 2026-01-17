
import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    """
    Manages WebSocket connections for real-time analysis progress.
    """
    def __init__(self):
        # job_id -> list of websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, job_id: str):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = []
        self.active_connections[job_id].append(websocket)
        logger.info(f"WebSocket connected for job: {job_id}")

    def disconnect(self, websocket: WebSocket, job_id: str):
        if job_id in self.active_connections:
            if websocket in self.active_connections[job_id]:
                self.active_connections[job_id].remove(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]
        logger.info(f"WebSocket disconnected for job: {job_id}")

    async def send_progress(self, job_id: str, message: str, progress: int = 0, status: str = "processing"):
        """
        Sends a progress update to all clients watching a specific job.
        """
        if job_id not in self.active_connections:
            return

        payload = {
            "job_id": job_id,
            "status": status,
            "message": message,
            "progress": progress
        }

        # Broadcast to all connected clients for this job
        disconnected = []
        for connection in self.active_connections[job_id]:
            try:
                await connection.send_json(payload)
            except Exception as e:
                logger.error(f"Error sending WebSocket message: {e}")
                disconnected.append(connection)
        
        # Cleanup stale connections
        for conn in disconnected:
            self.disconnect(conn, job_id)

# Global manager
manager = ConnectionManager()
