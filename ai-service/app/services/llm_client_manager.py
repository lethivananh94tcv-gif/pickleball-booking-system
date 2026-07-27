import os
import logging
from typing import Any, Optional
import google.generativeai as genai
from pathlib import Path
from dotenv import load_dotenv

# Setup logging
logger = logging.getLogger("ai-service.llm_client_manager")

# Ensure env variables are loaded
dotenv_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(dotenv_path=dotenv_path)

# Extract multiple keys
api_keys_str = os.getenv("GEMINI_API_KEYS", "")
single_api_key = os.getenv("GEMINI_API_KEY", "")

API_KEYS = []
if api_keys_str:
    API_KEYS = [k.strip() for k in api_keys_str.split(",") if k.strip()]
elif single_api_key:
    if "," in single_api_key:
        API_KEYS = [k.strip() for k in single_api_key.split(",") if k.strip()]
    else:
        API_KEYS = [single_api_key]

# Deduplicate keys while maintaining order
seen = set()
API_KEYS = [k for k in API_KEYS if not (k in seen or seen.add(k))]

_current_key_idx = 0

def configure_active_key():
    global _current_key_idx
    if not API_KEYS:
        logger.warning("No Gemini API keys found in environment variables.")
        return False
    _current_key_idx = _current_key_idx % len(API_KEYS)
    active_key = API_KEYS[_current_key_idx]
    
    # Configure genai globally
    genai.configure(api_key=active_key)
    
    masked = f"{active_key[:6]}...{active_key[-4:]}" if len(active_key) > 10 else "..."
    logger.info(f"Configured Gemini API key index {_current_key_idx} (Masked: {masked})")
    return True

# Initialize initial active key
configure_active_key()

def rotate_key():
    global _current_key_idx
    if len(API_KEYS) <= 1:
        logger.warning("Only one API key configured. Rotation is not possible.")
        return False
    
    _current_key_idx = (_current_key_idx + 1) % len(API_KEYS)
    logger.info(f"Rotating to Gemini API key index {_current_key_idx}...")
    return configure_active_key()

def get_model(model_name: Optional[str] = None) -> genai.GenerativeModel:
    if not model_name:
        model_name = os.getenv("MODEL_NAME", "gemini-1.5-flash")
    
    # Configure active key globally to make sure the library is using it
    configure_active_key()
    return genai.GenerativeModel(model_name)

def generate_content_with_retry(*args, **kwargs) -> Any:
    """
    Executes model.generate_content synchronously, rotating the API key and retrying on failure.
    """
    attempts = max(1, len(API_KEYS))
    model_name = kwargs.pop("model_name", None)
    
    for attempt in range(attempts):
        try:
            model = get_model(model_name)
            response = model.generate_content(*args, **kwargs)
            return response
        except Exception as e:
            logger.error(f"Error during generate_content (attempt {attempt+1}/{attempts}): {e}")
            if attempt < attempts - 1:
                logger.info("Retrying with rotated API key...")
                rotate_key()
            else:
                logger.error("All API keys exhausted or maximum retries reached.")
                raise e

async def generate_content_async_with_retry(*args, **kwargs) -> Any:
    """
    Executes model.generate_content_async asynchronously, rotating the API key and retrying on failure.
    """
    attempts = max(1, len(API_KEYS))
    model_name = kwargs.pop("model_name", None)
    
    for attempt in range(attempts):
        try:
            model = get_model(model_name)
            response = await model.generate_content_async(*args, **kwargs)
            return response
        except Exception as e:
            logger.error(f"Error during generate_content_async (attempt {attempt+1}/{attempts}): {e}")
            if attempt < attempts - 1:
                logger.info("Retrying with rotated API key...")
                rotate_key()
            else:
                logger.error("All API keys exhausted or maximum retries reached.")
                raise e
