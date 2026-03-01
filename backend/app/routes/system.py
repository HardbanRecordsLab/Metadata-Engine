from fastapi import APIRouter
import subprocess
import os
import json
import logging
import asyncio
from datetime import datetime

router = APIRouter(prefix="/system", tags=["system"])
logger = logging.getLogger(__name__)

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../frontend"))

@router.get("/validate")
async def project_validate():
    """
    Runs project validation (lint, type-check, tests) by executing npm commands in the frontend directory.
    This works locally by bridging the Python backend to the Node.js frontend tools.
    """
    logger.info("Starting system-wide project validation...")
    
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    # helper to run shell commands
    async def run_cmd(cmd_str: str, cwd: str):
        try:
            logger.info(f"Executing: {cmd_str} in {cwd}")
            process = await asyncio.create_subprocess_shell(
                cmd_str,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd
            )
            stdout, stderr = await process.communicate()
            return {
                "success": process.returncode == 0,
                "stdout": stdout.decode(errors='ignore'),
                "stderr": stderr.decode(errors='ignore'),
                "code": process.returncode
            }
        except Exception as e:
            logger.error(f"Command execution failed: {e}")
            return {"success": False, "error": str(e), "code": -1}

    try:
        # 1. Run Lint
        lint_res = await run_cmd("npm run lint", FRONTEND_DIR)
        
        # 2. Run Type Check
        type_res = await run_cmd("npm run type-check", FRONTEND_DIR)
        
        # 3. Run Unit Tests (Vitest)
        test_res = await run_cmd("npm run test -- --run", FRONTEND_DIR)

        # Transform outputs into the schema the frontend expects
        report = {
            "lint": [],
            "typeCheck": [],
            "unitTests": [],
            "timestamp": timestamp,
            "raw_logs": {
                "lint": lint_res,
                "type_check": type_res,
                "tests": test_res
            }
        }
        
        # Mocking structural response if they failed, for UI display
        if not lint_res["success"]:
            report["lint"].append({
                "filePath": "Frontend Project (all)",
                "messages": [{"line": 1, "column": 1, "severity": 2, "message": "Linting failed. See raw logs for details."}]
            })
            
        if not type_res["success"]:
            report["typeCheck"].append({
                "file": "TypeScript Scope",
                "errors": [line for line in type_res["stdout"].split('\n') if line.strip()][:10]
            })
            
        if not test_res["success"]:
            report["unitTests"].append({
                "suite": "Vitest / Unit Tests",
                "success": False,
                "total": 1,
                "passed": 0,
                "failed": 1,
                "failures": [{"test": "Execution", "message": test_res["stderr"] or "Tests failed to execute correctly."}]
            })
        else:
            report["unitTests"].append({
                "suite": "Vitest / Unit Tests",
                "success": True,
                "total": 1,
                "passed": 1,
                "failed": 0
            })

        return report

    except Exception as e:
        logger.error(f"Global validation failure: {e}")
        return {
            "lint": [],
            "typeCheck": [],
            "unitTests": [],
            "timestamp": timestamp,
            "error": str(e)
        }
