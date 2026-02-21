#!/bin/bash
set -e

echo "--- RUNTIME DEBUG INFO ---"
echo "Current User: $(whoami)"
echo "Current Dir: $(pwd)"
echo "DATABASE_URL Env: $DATABASE_URL"
echo "--------------------------"

# Force any necessary migrations or checks
# python -m app.startup # If needed

echo "Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 7860 --workers 1
