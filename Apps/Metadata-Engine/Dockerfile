# Multi-stage Dockerfile for Music Metadata Engine
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
RUN node node_modules/vite/bin/vite.js build

# ==================== STAGE 2: Python Backend ====================
FROM python:3.10-slim

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create user
RUN useradd -m -u 1000 user

# Create necessary directories and set permissions
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

# Port
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7860/api/worker_status || exit 1

# Copy entrypoint script
COPY --chown=user backend/entrypoint.sh /home/user/app/entrypoint.sh
RUN chmod +x /home/user/app/entrypoint.sh

# Start application
CMD ["/home/user/app/entrypoint.sh"]
