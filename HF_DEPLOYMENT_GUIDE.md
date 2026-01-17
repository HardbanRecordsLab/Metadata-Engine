# Hugging Face Spaces Deployment Guide
# Music Metadata Engine - Complete Instructions

## 📋 Prerequisites

1. **Hugging Face Account** with Pro subscription (for Docker Spaces)
2. **Git** installed locally
3. **Hugging Face CLI** (optional but recommended):
   ```bash
   pip install huggingface_hub
   huggingface-cli login
   ```

---

## 🚀 Step-by-Step Deployment

### 1. Create New Space on Hugging Face

1. Go to: https://huggingface.co/new-space
2. Fill in:
   - **Owner**: Your username/organization
   - **Space name**: `music-metadata-engine`
   - **License**: **other** (Proprietary / HardbanRecords Lab)
   - **SDK**: **Docker**
   - **Space Hardware**: **CPU Basic** (Free) or **CPU Upgrade** (for faster processing)

3. Click "Create Space"

---

### 2. Clone the Repository

```bash
# Clone your new HF Space
git clone https://huggingface.co/spaces/YOUR_USERNAME/music-metadata-engine
cd music-metadata-engine

# Add your local project as remote
git remote add local E:/Music-Metadata-Engine
git pull local main --allow-unrelated-histories
```

---

### 3. Verify Required Files

Ensure these files exist in the root:

```
music-metadata-engine/
├── Dockerfile                 ✅ Multi-stage build
├── README.md                  ✅ HF frontmatter + docs
├── .dockerignore              ✅ Build optimization
├── backend/
│   ├── app/
│   ├── requirements.txt       ✅
│   └── .env.example           ❗ Create this
└── frontend/
    ├── package.json           ✅
    └── ...
```

---

### 4. Configure Environment Variables

#### Option A: HF Spaces Secrets (Recommended)

1. Go to your Space settings: `https://huggingface.co/spaces/YOUR_USERNAME/music-metadata-engine/settings`
2. Scroll to **"Repository secrets"**
3. Add required secrets:

```
GEMINI_API_KEY=your_gemini_api_key_here
PINATA_JWT=your_pinata_jwt_here
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

Optional secrets:
```
GROQ_API_KEY=your_groq_key
SPOTIFY_CLIENT_ID=your_spotify_id
SPOTIFY_CLIENT_SECRET=your_spotify_secret
LASTFM_API_KEY=your_lastfm_key
```

#### Option B: .env file (Not recommended for production)

Create `backend/.env`:
```bash
GEMINI_API_KEY=your_key
PINATA_JWT=your_jwt
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

---

### 5. Push to Hugging Face

```bash
# Stage all files
git add .

# Commit
git commit -m "Initial deployment: Music Metadata Engine v2.1.0"

# Push to HF Space
git push origin main
```

---

### 6. Monitor Build

1. Go to your Space: `https://huggingface.co/spaces/YOUR_USERNAME/music-metadata-engine`
2. Click **"Logs"** tab
3. Wait for Docker build (~10-15 minutes first time)

Expected log output:
```
[Stage 1/2] Building frontend...
[Stage 2/2] Installing Python dependencies...
Successfully built music-metadata-engine
Container started on port 7860
✅ Serving frontend from: /home/user/app/frontend/dist
```

---

### 7. Verify Deployment

Once build completes:

1. **Frontend**: Visit your Space URL
   - Should show Music Metadata Engine UI
   - Test file upload

2. **Backend API**: Visit `/docs`
   - Should show FastAPI Swagger UI
   - Test `/` endpoint (should return `{"status": "MME Worker Online"}`)

3. **Health Check**:
   ```bash
   curl https://YOUR_USERNAME-music-metadata-engine.hf.space/
   ```

---

## 🔧 Troubleshooting

### Build Fails

**Error**: `COPY failed: file not found`
- **Fix**: Check `.dockerignore` isn't excluding necessary files

**Error**: `npm ERR! code ELIFECYCLE`
- **Fix**: Delete `frontend/node_modules` and `frontend/package-lock.json`, recommit

**Error**: `ModuleNotFoundError: No module named 'essentia'`
- **Fix**: Ensure `essentia-tensorflow` is in `backend/requirements.txt`

### Runtime Errors

**Error**: `Frontend build not found`
- **Fix**: Check Dockerfile COPY path for frontend/dist

**Error**: `GEMINI_API_KEY not found`
- **Fix**: Add secret in Space settings (see Step 4)

**Error**: `Port 7860 already in use`
- **Fix**: HF handles this automatically, restart Space if needed

### Performance Issues

**Slow analysis (>2 minutes)**
- **Solution**: Upgrade to **CPU Upgrade** hardware ($9/month)
- **Alternative**: Use Groq instead of Gemini (set `GROQ_API_KEY`)

**Out of memory**
- **Solution**: Upgrade to **2 vCPU** or **4 vCPU** hardware
- **Alternative**: Reduce `max_concurrent` in `batch_processor.py` to 1

## 💎 HF Pro Optimization (Power User)

Jeśli używasz **Hugging Face Pro**, możesz znacząco przyspieszyć działanie aplikacji:

### 1. Persistent Storage (Trwałość Danych)
W ustawieniach Space włącz **Persistent Storage** (np. 20GB). 
*   Aplikacja automatycznie wykryje folder `/data` i tam przeniesie bazę danych SQLite.
*   Dzięki temu historia analiz i statusy zadań przetrwają restarty kontenera.

### 2. Większa Współbieżność (Batch Processing)
Przy hardware **CPU Upgrade** (8 vCPU), możesz zwiększyć liczbę analizowanych plików naraz:
Dodaj sekret (Environment Variable):
*   `BATCH_MAX_CONCURRENT`: `8` (domyślnie 3)

### 3. Skalowanie API
Opracowaliśmy system, który dynamicznie wykorzystuje moc obliczeniową:
*   Standardowo uvicorn działa na 1 workerze (oszczędność RAM).
*   Możesz to zmienić w `Dockerfile` zmieniając `--workers 1` na większą liczbę, jeśli planujesz obsługiwać wielu użytkowników jednocześnie na wersji Pro.

---

## 🎛️ Hardware Recommendations

| Hardware | vCPU | RAM | Price | Best For |
|----------|------|-----|-------|----------|
| CPU Basic | 2 | 16GB | Free | Testing, low traffic |
| CPU Upgrade | 4 | 32GB | $9/mo | Production, 10-50 users/day |
| T4 GPU (Small) | 4 | 15GB | $60/mo | Heavy AI, stem separation |

**Recommended**: **CPU Upgrade** (4 vCPU, 32GB RAM)

---

## 🔐 Security Best Practices

1. **Never commit API keys** to Git
   - Use HF Secrets exclusively
   - Add `.env` to `.gitignore`

2. **CORS Configuration**
   - Update `backend/app/main.py` line 49
   - Change `allow_origins=["*"]` to your domain:
     ```python
     allow_origins=["https://YOUR_USERNAME-music-metadata-engine.hf.space"]
     ```

3. **Rate Limiting**
   - Install `slowapi`:
     ```bash
     pip install slowapi
     ```
   - Add to `main.py`:
     ```python
     from slowapi import Limiter, _rate_limit_exceeded_handler
     from slowapi.util import get_remote_address
     
     limiter = Limiter(key_func=get_remote_address)
     app.state.limiter = limiter
     app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
     
     @app.post("/analyze")
     @limiter.limit("10/hour")  # 10 requests per hour per IP
     async def analyze(...):
         ...
     ```

---

## 📊 Monitoring

### Built-in Metrics

Access at: `https://YOUR_USERNAME-music-metadata-engine.hf.space/metrics`

### Custom Logging

View real-time logs:
1. Go to Space → **Logs** tab
2. Filter by level (INFO, WARNING, ERROR)

### Uptime Monitoring

Use external service:
- **UptimeRobot**: https://uptimerobot.com
- **Pingdom**: https://pingdom.com
- Monitor endpoint: `https://YOUR_USERNAME-music-metadata-engine.hf.space/`

---

## 🔄 Updating the Space

### Push Updates

```bash
# Make changes locally
git add .
git commit -m "Update: feature XYZ"
git push origin main
```

HF will automatically rebuild and redeploy.

### Force Rebuild

If build is stuck:
1. Go to Space Settings
2. Click **"Factory reboot"**
3. Confirm

---

## 💰 Cost Estimation

| Component | Free Tier | Paid (Pro) |
|-----------|-----------|------------|
| HF Space (Basic) | ✅ Included | - |
| HF Space (Upgrade) | - | $9/mo |
| Gemini API | 15 RPM free | Pay-as-you-go |
| Pinata | 1GB free | $20/mo (100GB) |
| **Total (Basic)** | **$0/mo** | **~$9-30/mo** |

---

## 🎓 Advanced: Custom Domain

1. Get domain (e.g., `metadata.hardbanrecords.com`)
2. In Space Settings → **Custom Domain**
3. Add CNAME record in DNS:
   ```
   metadata.hardbanrecords.com → YOUR_USERNAME-music-metadata-engine.hf.space
   ```
4. Wait for SSL certificate (automatic)

---

## 📞 Support

**HF Spaces Issues**: https://huggingface.co/spaces/YOUR_USERNAME/music-metadata-engine/discussions

**Project Issues**: hardbanrecords@proton.me

---

## ✅ Deployment Checklist

- [ ] HF Space created with Docker SDK
- [ ] All files committed to Git
- [ ] Secrets configured (GEMINI_API_KEY, PINATA_JWT)
- [ ] Code pushed to HF
- [ ] Build completed successfully
- [ ] Frontend accessible
- [ ] API `/docs` working
- [ ] Test file analysis end-to-end
- [ ] CORS configured for production
- [ ] Rate limiting enabled
- [ ] Monitoring set up

---

**Your Space will be live at:**
`https://huggingface.co/spaces/YOUR_USERNAME/music-metadata-engine`

Good luck! 🚀
