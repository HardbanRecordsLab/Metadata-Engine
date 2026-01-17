import os
import logging
import asyncio

logger = logging.getLogger(__name__)


class SeparationService:
    @staticmethod
    def is_available():
        # Check if pytorch/demucs is installed
        try:
            import torch
            import demucs

            return True
        except ImportError:
            return False

    @staticmethod
    async def separate_vocals(input_path: str, output_dir: str):
        """
        Runs Demucs to separate audio into 'vocals' and 'no_vocals'.
        Returns paths to the generated files.
        """
        if not SeparationService.is_available():
            raise RuntimeError("Demucs/Torch not installed.")

        # Demucs is best run via subprocess (CLI) to avoid conflicting generic args,
        # or we can wrap the python API. CLI is often more stable for memory management.
        # We use the Hybrid Transformer model (htdemucs) for speed/quality balance.
        # We perform 2-stem separation (vocals + other).

        cmd = [
            "python3",
            "-m",
            "demucs.separate",
            "-n",
            "htdemucs",  # Model
            "--two-stems",
            "vocals",  # Only vocals vs instrumental
            "--mp3",  # Output MP3 (smaller for web transfer)
            "--out",
            output_dir,  # Output directory
            input_path,
        ]

        logger.info(f"Starting Demucs Separation: {' '.join(cmd)}")

        # Run in threadpool to not block asyncio loop
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode()
            logger.error(f"Demucs Failed: {error_msg}")
            raise RuntimeError(f"Demucs separation failed: {error_msg}")

        # Demucs structure: output_dir / htdemucs / <track_name> / vocals.mp3
        # We need to find the file.
        track_name = os.path.splitext(os.path.basename(input_path))[0]
        model_dir = os.path.join(output_dir, "htdemucs", track_name)

        vocals_path = os.path.join(model_dir, "vocals.mp3")
        no_vocals_path = os.path.join(model_dir, "no_vocals.mp3")

        if not os.path.exists(vocals_path):
            # Try fallback search if track name handling (spaces/special chars) varied
            # Simplest: list dir
            base_model_dir = os.path.join(output_dir, "htdemucs")
            # Find likely folder
            pass

        return {
            "vocals": vocals_path if os.path.exists(vocals_path) else None,
            "instrumental": no_vocals_path if os.path.exists(no_vocals_path) else None,
        }
