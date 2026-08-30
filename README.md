# FB Multi Poster

**FB Multi Poster** is a production-ready, single-user full-stack application designed to publish videos and reels across multiple Facebook Pages (e.g., *NT Video*, *Midnight Tales*, and *StoryVerse*) in a single click.

---

## Key Features

1. **Multi-Page Broadcast**: Upload once and post to one or multiple Facebook Pages simultaneously using the Facebook Graph API.
2. **Chunked Video Upload**: Implements standard Facebook chunked video upload protocol, allowing reliable transfers of files up to 10GB.
3. **Local Filesystem Database**: Lightweight storage system using structured JSON files—no external database servers required.
4. **APScheduler Background Jobs**: Periodically scans for pending posts and executes publishes in the background.
5. **AI Content generator**: Connects to any OpenAI-compatible API to generate optimized titles, captions, hashtags, and customized per-page tone variations.
6. **Live Preview Panel**: Mimics a Facebook feed layout rendering real-time caption formatting, titles, page headers, and video thumbnails.
7. **Interactive Analytics**: Displays visual publishing volume trends (Daily, Weekly, Monthly) using SVG-based interactive charts.
8. **Media Library**: Manage, play, delete, and easily reuse previously uploaded videos.

---

## Directory Structure

```
fb-multi-poster/
├── backend/
│   ├── app/
│   │   ├── main.py             # Entrypoint
│   │   ├── models/             # Schema definitions
│   │   ├── routers/            # Upload, publish, history, settings, AI routers
│   │   ├── services/           # Facebook publisher, Storage, AI, Thumbnail services
│   │   └── scheduler/          # APScheduler background tasks
│   └── storage/                # JSON configs and media files
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   └── services/
│   └── index.html
└── README.md
```

---

## Prerequisites

- **Python**: Version 3.12 or newer.
- **Node.js**: Version 20.x or newer (npm 10.x).
- **FFmpeg** (Optional): If installed in the system PATH, it is automatically used to extract video thumbnails at `00:00:01`. If missing, the app gracefully falls back to generating sleek abstract gradient previews using Pillow.

---

## Setup & Running Guide

### 1. Backend Setup

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```

3. Activate the virtual environment:
   - **Windows PowerShell**:
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   - **Windows Command Prompt**:
     ```cmd
     .venv\Scripts\activate.bat
     ```
   - **macOS/Linux**:
     ```bash
     source .venv/bin/activate
     ```

4. Install the backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8800
   ```

   The Swagger documentation will be available at `http://127.0.0.1:8800/docs`.

---

### 2. Frontend Setup

1. Open a separate terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```

2. Install the node modules:
   ```bash
   npm install
   ```

3. Start the Vite React development server:
   ```bash
   npm run dev
   ```

   The frontend web interface will open at `http://localhost:5173` (or the port specified by the dev server).

---

## Configurations

### 1. Facebook Page Setup
1. Launch the frontend and navigate to the **Settings** page.
2. Under **Facebook Pages**, insert the respective Page ID and Page Access Token for *NT Video*, *Midnight Tales*, and *StoryVerse*.
3. Click the **Test Connection** button on each card to verify credential validity:
   - ✅ **Connected**: Successfully fetched credentials.
   - ❌ **Token Expired**: Retrieve a new long-lived token via Facebook Graph Explorer.
   - ❌ **Invalid Page ID**: Check the page ID formatting.

### 2. AI Content Generator Setup
1. Under **Settings** -> **OpenAI API**, enter your API Key.
2. Modify the **Base API URL** if using OpenRouter, Gemini API Proxy, or a local model (e.g. `http://localhost:11434/v1`).
3. Set the target **Model Name** (e.g. `gpt-4o-mini`).

---

## Storage Files Location

All persistent user records, credentials, queue schedules, and uploaded media are located inside `backend/storage/`:
- `storage/videos/`: Raw MP4/MOV/AVI/MKV video files.
- `storage/thumbnails/`: Extracted or fallback JPEG thumbnails.
- `storage/config.json`: Facebook token credentials, templates, and server settings.
- `storage/history.json`: List of all previous broadcasts.
- `storage/scheduled.json`: List of pending scheduled publications.
- `storage/logs/app.log`: Rotating logging files recording publishing responses and errors.
