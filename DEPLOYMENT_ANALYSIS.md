# Vercel Deployment Compatibility Check

## Architecture Analysis
Your project consists of:
1. **Frontend**: Vite + React
2. **Backend**: FastAPI (Python)
3. **Core Task**: Playwright Scraper (Long-running, requires browser)

## Compatibility Issues with Vercel

### 1. Long-Running Tasks (Critical)
- **Issue**: Vercel Serverless Functions have a strict timeout (max 60s for Pro, 10s for Hobby). Your scraping task (`run_scraper_task`) likely exceeds this.
- **Impact**: The scraper will be killed mid-execution. `BackgroundTasks` in FastAPI do NOT guarantee execution after the response is sent in a Serverless environment because the Lambda freezes immediately.

### 2. Playwright on Serverless (Critical)
- **Issue**: Playwright requires browser binaries (Chromium). These are large and exceed the 50MB-250MB size limit of AWS Lambda / Vercel Functions.
- **Solution**: You usually need a specialized layer or a different hosting provider for the browser part.

### 3. File System Persistence (Critical)
- **Issue**: Vercel Serverless functions have an ephemeral file system. Files written to `images/` or `netflix_records.csv` during one request **WILL NOT BE VISIBLE** to subsequent requests (e.g., `/api/results` or `/api/download`).
- **Impact**: The "Download" and "Gallery" features will fail because the data disappears instantly after the scraper finishes (if it even finishes).

### 4. In-Memory State
- **Issue**: The `jobs` dictionary in `app.py` is in-memory. In Serverless, every request might hit a new instance.
- **Impact**: Polling `/api/status/{job_id}` will likely return "Job not found" because the instance that started the job is different from the one checking status.

## Recommendation: NOT Recommended for Vercel

**This specific architecture (Long-running scraper + Local File Storage + In-Memory State) is fundamentally incompatible with Vercel's Serverless model.**

### Alternative Hosting Solutions (Better Fit)
1. **Render / Railway / Fly.io (Highly Recommended)**
   - These platforms support **Docker** containers.
   - You can deploy the exact same code you have now (as a persistent server).
   - **Persistent Disk**: You can mount a volume to store CSVs and Images.
   - **Long-running processes**: No 10s timeout; background threads work fine.
   - **Browser Support**: You can use a Docker image with Playwright pre-installed.

2. **AWS EC2 / DigitalOcean Droplet**
   - Traditional VM, full control.

### If You MUST Use Vercel...
You would need to rewrite the entire backend architecture:
1. **Scraper**: Move to **Vercel Cron Jobs** or an external queue (e.g., QStash) trigger.
2. **Browser**: Use a headless browser service (e.g., Browserless.io) instead of local Playwright.
3. **Storage**: Upload images to **AWS S3 / Vercel Blob** and store metadata in **Vercel KV / Postgres**. Local FS is impossible.
4. **State**: Store Job ID and status in Redis/Database, not in Python memory.

## Immediate Action Plan (Deployment to Render/Railway)

Since refactoring for Serverless is a huge undertaking that changes your code logic significantly, I recommend deploying to a container-based PaaS like **Render** or **Railway**.

### Steps for Container Deployment:

1. **Create `Dockerfile`**:
   - Install Python, Node.js, and Playwright browsers.
   - Build frontend.
   - Start FastAPI.

2. **Create `docker-compose.yml`** (Optional, for local testing).

3. **Deploy**:
   - Push to GitHub.
   - Connect Railway/Render to repo.
   - Success!

I will prepare the `Dockerfile` for you now, which is the standard way to solve these compatibility issues for this type of app.
