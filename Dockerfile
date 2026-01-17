# Multi-stage Dockerfile for Hugging Face Spaces
# Builds both frontend and backend in a single container

# ==================== STAGE 1: Frontend Build ====================
FROM node:20-slim AS frontend-builder

WORKDIR /build/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy frontend source
COPY frontend/ ./

# Build production bundle
RUN npm run build

# ==================== STAGE 2: Python Backend ====================
FROM python:3.10-slim

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create user (HF Spaces requires UID 1000)
RUN useradd -m -u 1000 user

# Create necessary directories as root and set permissions
RUN mkdir -p /home/user/app/temp_uploads /home/user/app/logs /data && \
    chown -R user:user /home/user/app /data && \
    chmod -R 777 /data /home/user/app/temp_uploads /home/user/app/logs

# Switch to non-root user
USER user

# Set environment
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR $HOME/app

# Copy backend requirements and install
COPY --chown=user backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY --chown=user backend/ ./

# Copy built frontend from stage 1
COPY --from=frontend-builder --chown=user /build/frontend/dist ./frontend/dist

# Hugging Face Spaces listens on port 7860
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7860/ || exit 1

# Start application
# Uses --workers 1 as base, but for HF Pro (4 vCPU+) it will scale if WEB_CONCURRENCY is set
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
