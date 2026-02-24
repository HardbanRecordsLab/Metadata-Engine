import uvicorn
from app.main import app  # Corrected import path

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8888, reload=True)
