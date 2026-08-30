import httpx
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse, HTMLResponse
from app.services.storage_service import StorageService
from app.services.yt_publisher import YouTubePublisher
from app.utils.logger import get_logger

logger = get_logger("router.youtube_auth")
router = APIRouter()

def get_storage():
    return StorageService()

def get_yt_publisher():
    return YouTubePublisher()

@router.get("/google/auth")
def google_auth_redirect(storage: StorageService = Depends(get_storage)):
    """Redirects the user to Google OAuth Consent Screen."""
    settings = storage.get_settings()
    client_id = settings.get("googleClientId")
    
    if not client_id:
        return HTMLResponse(
            status_code=400,
            content="""
            <html>
              <body style="background:#18191a;color:#ff4d4f;font-family:sans-serif;text-align:center;padding:50px;">
                <h1>Configuration Missing</h1>
                <p style="color:#eee;">Please configure your Google Client ID in the Settings tab and click Save before connecting.</p>
              </body>
            </html>
            """
        )
        
    import urllib.parse
    redirect_uri = "http://localhost:8800/google/callback"
    scopes_list = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly"
    ]
    encoded_scopes = urllib.parse.quote(" ".join(scopes_list))
    
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={encoded_scopes}&"
        f"access_type=offline&"
        f"prompt=consent"
    )
    return RedirectResponse(auth_url)

@router.get("/google/callback")
async def google_auth_callback(
    code: str = None,
    error: str = None,
    storage: StorageService = Depends(get_storage),
    yt_publisher: YouTubePublisher = Depends(get_yt_publisher)
):
    """Handles OAuth 2.0 authorization code callback from Google."""
    if error:
        logger.error(f"Google OAuth callback error: {error}")
        return HTMLResponse(
            status_code=400,
            content=f"<html><body style='background:#18191a;color:#ff4d4f;font-family:sans-serif;padding:50px;text-align:center;'><h1>Auth Failed</h1><p>{error}</p></body></html>"
        )
        
    if not code:
        return HTMLResponse(
            status_code=400,
            content="""
            <html>
              <body style="background:#18191a;color:#ff4d4f;font-family:sans-serif;text-align:center;padding:50px;">
                <h1>Missing Authorization Code</h1>
                <p style="color:#eee;">This callback endpoint expects an authorization code from Google OAuth.</p>
                <p style="color:rgba(255,255,255,0.45);font-size:14px;">Please connect your YouTube channel from the Settings tab in the application interface.</p>
              </body>
            </html>
            """
        )
        
    settings = storage.get_settings()
    client_id = settings.get("googleClientId")
    client_secret = settings.get("googleClientSecret")
    
    if not client_id or not client_secret:
        return HTMLResponse(
            status_code=400,
            content="""
            <html>
              <body style="background:#18191a;color:#ff4d4f;font-family:sans-serif;text-align:center;padding:50px;">
                <h1>Credentials Missing</h1>
                <p style="color:#eee;">Google Client ID or Client Secret is not configured in settings.</p>
                <p style="color:rgba(255,255,255,0.45);font-size:14px;">Please enter and save your Google credentials in the Settings tab before authenticating.</p>
              </body>
            </html>
            """
        )
        
    # Exchange authorization code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": "http://localhost:8800/google/callback"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(token_url, data=token_payload, timeout=15.0)
            if response.status_code != 200:
                logger.error(f"Token exchange failed: {response.text}")
                return HTMLResponse(
                    status_code=400,
                    content=f"<html><body style='background:#18191a;color:#ff4d4f;font-family:sans-serif;padding:50px;text-align:center;'><h1>Exchange Failed</h1><p>{response.text}</p></body></html>"
                )
                
            res_data = response.json()
            access_token = res_data.get("access_token")
            refresh_token = res_data.get("refresh_token")
            
            if not access_token:
                return HTMLResponse(
                    status_code=400,
                    content="<html><body style='background:#18191a;color:#ff4d4f;font-family:sans-serif;padding:50px;text-align:center;'><h1>Auth Error</h1><p>No access token returned.</p></body></html>"
                )
                
            # Get YouTube Channel Information
            channel_info = await yt_publisher.get_channel_info(access_token)
            
            # Save connection to config.json
            config = storage.get_config()
            if "youtubeChannels" not in config:
                config["youtubeChannels"] = []
                
            # Create or update entry
            new_channel = {
                "name": channel_info["name"].strip(),
                "channelId": channel_info["channelId"],
                "avatarUrl": channel_info["avatarUrl"],
                "refreshToken": refresh_token or next((c["refreshToken"] for c in config["youtubeChannels"] if c["channelId"] == channel_info["channelId"]), ""),
                "status": "connected"
            }
            
            # Remove duplicate channel if it exists
            config["youtubeChannels"] = [c for c in config["youtubeChannels"] if c["channelId"] != channel_info["channelId"]]
            config["youtubeChannels"].append(new_channel)
            storage.save_config(config)
            
            logger.info(f"Successfully linked YouTube Channel: {new_channel['name']}")
            
            return HTMLResponse(
                content=f"""
                <html>
                  <body style="background:#18191a;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
                    <h1 style="color:#c084fc;">Connection Successful!</h1>
                    <p style="font-size:18px;margin-bottom:10px;">Linked Channel: <b>{new_channel['name']}</b></p>
                    <p style="color:rgba(255,255,255,0.45);">You can now close this tab and return to the FB Multi Poster app settings.</p>
                    <script>
                      setTimeout(() => {{ window.close(); }}, 3000);
                    </script>
                  </body>
                </html>
                """
            )
            
        except Exception as e:
            logger.error(f"Callback exception: {e}")
            return HTMLResponse(
                status_code=500,
                content=f"<html><body style='background:#18191a;color:#ff4d4f;font-family:sans-serif;padding:50px;text-align:center;'><h1>Server Error</h1><p>{str(e)}</p></body></html>"
            )
