import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

# Load dotenv from correct path
dotenv_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=dotenv_path)

# Log config status
from app.services.llm_client_manager import API_KEYS
LLM_PROVIDER = os.getenv("LLM_PROVIDER")
MODEL_NAME = os.getenv("MODEL_NAME")

key_exists = "True" if API_KEYS else "False"
logger.info(f"Gemini API keys configured: {key_exists} (Count: {len(API_KEYS)})")
logger.info(f"LLM_PROVIDER: {LLM_PROVIDER}")
logger.info(f"MODEL_NAME: {MODEL_NAME}")

from app.routers import chatbot_router, coach_router, player_router, forecast_router

app = FastAPI(
    title="Pickle Club AI Service",
    description="Microservice cung cấp các API AI phân tích NLP cho Pickle Club",
    version="1.0.0"
)

# Cấu hình CORS để cho phép backend Node.js gọi qua
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Có thể giới hạn lại thành địa chỉ của Node.js sau
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các router
app.include_router(chatbot_router.router, prefix="/api/ai", tags=["Chatbot"])
app.include_router(coach_router.router, prefix="/api/ai/coaches", tags=["Coach"])
app.include_router(player_router.router, prefix="/api/ai/players", tags=["Player"])
app.include_router(forecast_router.router, prefix="/api/ai", tags=["Forecast"])

@app.get("/")
async def root():
    return {"message": "Welcome to Pickle Club AI Service", "status": "running"}

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "provider": "gemini",
        "model": MODEL_NAME or "gemini-1.5-flash",
        "hasApiKey": bool(API_KEYS)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
