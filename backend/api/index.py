import sys
import os

# Ensure 'app' package can be imported
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.main import app as fastapi_app

app = fastapi_app
