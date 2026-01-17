# Music Metadata Engine

AI-Powered Audio Analysis & Metadata Enrichment Platform

## Quick Start

1. **Clone the repository**
2. **Install dependencies** (see below)
3. **Configure environment variables** (backend/.env)
4. **Run locally** or **deploy to Hugging Face Spaces**

---

## Local Development

### Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8888
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Access at: http://localhost:5173

---

## Deployment

For Hugging Face Spaces deployment, see: [HF_DEPLOYMENT_GUIDE.md](HF_DEPLOYMENT_GUIDE.md)

---

## Documentation

- **README.md** - This file (overview)
- **HF_DEPLOYMENT_GUIDE.md** - Step-by-step deployment instructions
- **FINAL_VERIFICATION_REPORT.md** - Full system verification & testing
- **UX_UI_DESIGN_SYSTEM.md** - Design tokens & component library

---

## License

MIT License - See LICENSE file
