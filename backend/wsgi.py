import sys
import os
import asyncio

# Ensure backend directory is in sys.path
path = os.path.dirname(os.path.abspath(__file__))
if path not in sys.path:
    sys.path.insert(0, path)

from a2wsgi import ASGIMiddleware
from app.main import app

# Robust WSGI wrapper ensuring asyncio event loop exists in Python 3.10+ uWSGI worker threads
class WSGIApp:
    def __init__(self, asgi_app):
        self.wsgi = ASGIMiddleware(asgi_app)

    def __call__(self, environ, start_response):
        try:
            asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return self.wsgi(environ, start_response)

application = WSGIApp(app)
