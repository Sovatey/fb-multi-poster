import sys
import os

# Add backend directory to sys.path
path = os.path.dirname(os.path.abspath(__file__))
if path not in sys.path:
    sys.path.insert(0, path)

from a2wsgi import ASGIMiddleware
from app.main import app

# Convert FastAPI (ASGI) to WSGI application for PythonAnywhere
application = ASGIMiddleware(app)
