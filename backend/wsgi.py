import sys
import os
import asyncio
from http import HTTPStatus
from typing import Dict, Any

# Ensure backend directory is in sys.path
path = os.path.dirname(os.path.abspath(__file__))
if path not in sys.path:
    sys.path.insert(0, path)

from app.main import app

class PureSyncWSGIAdapter:
    """
    Direct single-threaded ASGI-to-WSGI adapter built specifically for PythonAnywhere.
    Executes FastAPI requests in the uWSGI worker thread synchronously without background threads.
    Eliminates thread deadlocks, hanging requests, and 502 Bad Gateway timeouts.
    """
    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    def __call__(self, environ: Dict[str, Any], start_response):
        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.0"},
            "http_version": environ.get("SERVER_PROTOCOL", "HTTP/1.1").replace("HTTP/", ""),
            "method": environ.get("REQUEST_METHOD", "GET"),
            "path": environ.get("PATH_INFO", "/"),
            "raw_path": environ.get("PATH_INFO", "/").encode("latin-1"),
            "query_string": environ.get("QUERY_STRING", "").encode("latin-1"),
            "scheme": environ.get("wsgi.url_scheme", "http"),
            "headers": [
                (k[5:].lower().replace("_", "-").encode("latin-1"), v.encode("latin-1"))
                for k, v in environ.items()
                if k.startswith("HTTP_")
            ],
            "client": (environ.get("REMOTE_ADDR", "127.0.0.1"), int(environ.get("REMOTE_PORT", 0) or 0)),
            "server": (environ.get("SERVER_NAME", "localhost"), int(environ.get("SERVER_PORT", 80) or 80)),
        }

        if "CONTENT_TYPE" in environ and environ["CONTENT_TYPE"]:
            scope["headers"].append((b"content-type", environ["CONTENT_TYPE"].encode("latin-1")))
        if "CONTENT_LENGTH" in environ and environ["CONTENT_LENGTH"]:
            scope["headers"].append((b"content-length", environ["CONTENT_LENGTH"].encode("latin-1")))

        body = b""
        if "wsgi.input" in environ:
            try:
                length = int(environ.get("CONTENT_LENGTH", 0) or 0)
            except (ValueError, TypeError):
                length = 0
            if length > 0:
                body = environ["wsgi.input"].read(length)

        body_sent = False
        status_code = 200
        headers = []
        body_chunks = []

        async def receive():
            nonlocal body_sent, body
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message):
            nonlocal status_code, headers, body_chunks
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = [
                    (k.decode("latin-1"), v.decode("latin-1"))
                    for k, v in message.get("headers", [])
                ]
            elif message["type"] == "http.response.body":
                body_chunks.append(message.get("body", b""))

        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.asgi_app(scope, receive, send))
        finally:
            loop.close()

        try:
            status_phrase = HTTPStatus(status_code).phrase
        except Exception:
            status_phrase = "OK"

        status_line = f"{status_code} {status_phrase}"
        start_response(status_line, headers)
        return body_chunks

application = PureSyncWSGIAdapter(app)
