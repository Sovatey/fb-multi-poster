# FB Multi Poster - Deployment Guide

This guide covers how to deploy the **Frontend (React + Vite UI)** to **Vercel** and the **Backend (FastAPI)** to **PythonAnywhere**.

---

## 1. Codebase Changes Applied

The codebase has been configured for deployment:
1. **Frontend API URL**: Updated to use `import.meta.env.VITE_API_BASE_URL` dynamically.
2. **Vercel Route Rewrites**: Added `frontend/vercel.json` for SPA router support.
3. **PythonAnywhere WSGI Compatibility**: Added `a2wsgi` requirement and created `backend/wsgi.py`.
4. **PythonAnywhere Scheduled Task Script**: Added `backend/run_scheduler.py` for reliable background post scheduling.

---

## 2. Deploying Backend to PythonAnywhere

### Step 1: Push Code to GitHub
Push your latest changes (including `backend/wsgi.py`, `backend/requirements.txt`, etc.) to your GitHub repository.

### Step 2: Set Up Code on PythonAnywhere
1. Log into your [PythonAnywhere Account](https://www.pythonanywhere.com/).
2. Open a **Bash Console** from the Dashboard.
3. Clone your GitHub repository:
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/fb-multi-poster.git
   cd fb-multi-poster/backend
   ```

### Step 3: Create Virtual Environment & Install Dependencies
In the PythonAnywhere Bash console, run:
```bash
mkvirtualenv --python=python3.10 fb-poster-env
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Configure Web App in PythonAnywhere Dashboard
1. Go to the **Web** tab on PythonAnywhere.
2. Click **Add a new web app**.
3. Select **Manual configuration** (do NOT choose FastAPI directly as PA uses WSGI).
4. Choose **Python 3.10**.
5. Scroll down to **Virtualenv** and set the path:
   `/home/YOUR_USERNAME/.virtualenvs/fb-poster-env`
6. Scroll to **Code**:
   - **Source code**: `/home/YOUR_USERNAME/fb-multi-poster/backend`
   - **Working directory**: `/home/YOUR_USERNAME/fb-multi-poster/backend`

### Step 5: Edit WSGI Configuration File
1. Under **Code**, click on the link for **WSGI configuration file** (e.g. `/var/www/YOUR_USERNAME_pythonanywhere_com_wsgi.py`).
2. Delete existing contents and paste:
   ```python
   import sys
   import os

   project_home = '/home/YOUR_USERNAME/fb-multi-poster/backend'
   if project_home not in sys.path:
       sys.path.insert(0, project_home)

   from a2wsgi import ASGIMiddleware
   from app.main import app

   application = ASGIMiddleware(app)
   ```
3. Click **Save** in the top right corner.

### Step 6: Configure Static File Mapping
On the **Web** tab, scroll down to **Static Files** and add two mappings:

| URL | Directory |
| :--- | :--- |
| `/static/videos/` | `/home/YOUR_USERNAME/fb-multi-poster/backend/storage/videos` |
| `/static/thumbnails/` | `/home/YOUR_USERNAME/fb-multi-poster/backend/storage/thumbnails` |

### Step 7: Set Up Scheduled Task (Cron for Scheduled Posts)
1. Go to the **Tasks** tab on PythonAnywhere.
2. Under **Scheduled Tasks**, create a task to run every 5 minutes:
   - **Command**: `/home/YOUR_USERNAME/.virtualenvs/fb-poster-env/bin/python /home/YOUR_USERNAME/fb-multi-poster/backend/run_scheduler.py`
   - **Time**: Select every 5 or 10 minutes.

### Step 8: Reload Web App
Go back to the **Web** tab and click the green **Reload YOUR_USERNAME.pythonanywhere.com** button.
Test your API by navigating to `https://YOUR_USERNAME.pythonanywhere.com/`. You should see `{"name":"FB Multi Poster API","status":"running"}`.

---

## 3. Deploying UI (Frontend) to Vercel

### Step 1: Connect Repository to Vercel
1. Log into [Vercel](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Select your GitHub repository.

### Step 2: Configure Vercel Build Settings
1. In the import settings:
   - **Framework Preset**: Vite
   - **Root Directory**: Click Edit and select `frontend`
2. Open **Environment Variables**:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://YOUR_USERNAME.pythonanywhere.com` *(Replace `YOUR_USERNAME` with your PythonAnywhere account name, without a trailing slash)*
3. Click **Deploy**.

---

## 4. Google / YouTube OAuth Setup (Optional)

If using YouTube channel publishing:
1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Edit your OAuth 2.0 Web Client ID.
3. Under **Authorized redirect URIs**, add:
   `https://YOUR_USERNAME.pythonanywhere.com/google/callback`
4. Under **Authorized JavaScript origins**, add your Vercel frontend URL:
   `https://your-app-name.vercel.app`
