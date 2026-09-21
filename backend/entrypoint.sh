#!/bin/bash
set -e

echo "--- RUNTIME DEBUG INFO ---"
echo "Current User: $(whoami)"
echo "Current Dir: $(pwd)"
# never log the password: mask the userinfo part of the URL
echo "DATABASE_URL Env: $(printf '%s' "$DATABASE_URL" | sed -E 's#(://[^:]+:)[^@]+@#\1***@#')"
echo "--------------------------"

# Force any necessary migrations or checks
# python -m app.startup # If needed

echo "Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 7860 --workers 1
