import sys
import os
from mangum import Mangum

# Add the parent directory to sys.path so that 'app' can be imported
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.main import app as fastapi_app

# Create a handler for AWS Lambda / Vercel
handler = Mangum(fastapi_app)
