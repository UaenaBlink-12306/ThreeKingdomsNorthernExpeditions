import sys
import os

# Ensure the backend directory is on sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.main import app as fastapi_app

# Expose the FastAPI app as the entry point for Vercel
app = fastapi_app
