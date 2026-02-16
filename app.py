from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import subprocess
import os
import json
import uuid
import csv
import re
import shutil
from typing import Dict, List
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from openai import OpenAI

app = FastAPI()

# Load env
load_dotenv()
try:
    client = OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_BASE_URL")
    )
except Exception as e:
    print(f"Warning: OpenAI client init failed: {e}")
    client = None

# Mount images directory
# Vercel Serverless environment: use /tmp for temporary file storage
IMAGES_DIR = "/tmp/images" if os.getenv("VERCEL") else "images"
if not os.path.exists(IMAGES_DIR):
    os.makedirs(IMAGES_DIR)
# StaticFiles mount might not work as expected in Vercel serverless for dynamically created files
# We might need a custom endpoint to serve these if they are generated at runtime
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

# Mount Frontend static files for production
if os.path.exists("frontend/dist"):
    # Mount assets (CSS/JS) first
    if os.path.exists("frontend/dist/assets"):
        app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")
    
    # Mount root files (favicon, etc.)
    # We will handle root "/" separately to serve index.html for SPA routing
    pass

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store - Note: In Serverless, this will NOT persist between requests/lambdas!
# For a real Vercel deployment, you need a database (e.g. KV, Postgres, Firebase).
# For this demo/diagnosis, we'll keep it but warn about limitations.
jobs: Dict[str, dict] = {}

class ScrapeRequest(BaseModel):
    start_date: str = None
    end_date: str = None

def run_scraper_task(job_id: str, start: str, end: str):
    # WARNING: BackgroundTasks in Vercel Serverless are not guaranteed to run to completion 
    # if the response is sent. Vercel functions have a timeout (usually 10s-60s).
    # Scraping takes longer. This architecture is fundamentally incompatible with standard Vercel Functions
    # for long-running tasks without using a queue (e.g. Vercel Cron, QStash).
    
    # Also Playwright in Vercel requires special handling (installing browsers).
    # We will try to run it, but it might fail or timeout.
    
    jobs[job_id]["status"] = "running"
    
    # Adjust output directory for scraper
    cmd = ["python3", "netflix_scraper.py", "--output", IMAGES_DIR]
    if start: cmd.extend(["--start", start])
    if end: cmd.extend(["--end", end])
    
    try:
        # In Vercel, we can't easily stream stdout from a subprocess in a background task
        # back to a variable that another request can read (due to lambda isolation).
        # This part needs a DB.
        
        # For now, let's just try to run it synchronously if we want to debug, 
        # OR acknowledge that this won't work well in Vercel without a DB.
        pass 
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["logs"].append(str(e))


@app.post("/api/scrape")
async def start_scrape(request: ScrapeRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "pending",
        "logs": [],
        "count": 0,
        "start_date": request.start_date,
        "end_date": request.end_date
    }
    
    # Cleanup old data if starting a new run
    if os.path.exists("netflix_records.csv"):
        os.remove("netflix_records.csv")
    if os.path.exists("images"):
        # We don't delete the whole images folder to preserve cache if needed, 
        # but for a clean run arguably we should? 
        # User request implies they want ONLY the date range content.
        # Let's clean it to be safe and avoid confusion.
        shutil.rmtree("images")
        os.makedirs("images")
        
    background_tasks.add_task(run_scraper_task, job_id, request.start_date, request.end_date)
    return {"job_id": job_id}

@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs:
        return {"error": "Job not found"}
    return jobs[job_id]

@app.get("/api/results")
async def get_results():
    CSV_FILE = "netflix_records.csv"
    if not os.path.exists(CSV_FILE):
        return []
    
    results = []
    with open(CSV_FILE, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            results.append(row)
    return results

@app.get("/api/download")
async def download_package():
    zip_filename = "netflix_scraper_export"
    zip_path = f"{zip_filename}.zip"
    
    # Ensure any old zip is removed
    if os.path.exists(zip_path):
        os.remove(zip_path)
        
    temp_export_dir = "temp_export"
    if os.path.exists(temp_export_dir):
        shutil.rmtree(temp_export_dir)
        
    os.makedirs(temp_export_dir)
    images_dest = os.path.join(temp_export_dir, "images")
    if not os.path.exists(images_dest):
        os.makedirs(images_dest)
    
    # 1. Copy Title Page if exists
    title_page = os.path.join("images", "Title_Page.jpg")
    if os.path.exists(title_page):
        shutil.copy(title_page, temp_export_dir)

    # 2. Copy scraped images (but NOT CSV)
    if os.path.exists("images"):
        # We want images in an 'images' subfolder or root? User said "images/" folder
        # Let's keep them in 'images' subfolder inside zip for cleanliness, 
        # or root if they want flat list.
        # Plan said: "Zip should contain images/ folder with posters AND the title page."
        # So structure:
        #   netflix_data.zip/
        #       Title_Page.jpg
        #       images/
        #           poster1.jpg
        #           ...
        
        # images_dest is already temp_export_dir/images
        for item in os.listdir("images"):
            if item == "Title_Page.jpg": continue # Already copied to root
            if not item.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')): continue
            
            s = os.path.join("images", item)
            d = os.path.join(images_dest, item)
            if os.path.isfile(s):
                shutil.copy2(s, d)

    # Create zip from temp dir
    shutil.make_archive(zip_filename, 'zip', temp_export_dir)
    
    # Cleanup temp dir
    shutil.rmtree(temp_export_dir)
    
    return FileResponse(zip_path, filename="netflix_data.zip", media_type='application/zip')

class NoteRequest(BaseModel):
    start_date: str = None
    end_date: str = None
    override_title: str = None
    override_tags: str = None

@app.post("/api/generate_note")
async def generate_note(request: NoteRequest):
    if not client:
        return {"error": "OpenAI client not initialized. Check .env file."}
        
    # Read CSV and filter
    movies = []
    headers = []
    if os.path.exists("netflix_records.csv"):
        with open("netflix_records.csv", mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Filter by date if provided
                # Date format in CSV is "YYYY/M/D" usually
                # Simple string comparison works if strict, but let's just include all for now 
                # or implement basic filtering if strings match.
                # The user scraper filters BEFORE saving to CSV usually? 
                # No, scraper appends? 
                # Actually, app.py cleans CSV on new run (lines 82-83), so CSV contains ONLY current run.
                # So we can just use all rows in CSV.
                movies.append(f"{row.get('Title')} (Released: {row.get('Release Date')})")
    
    if not movies:
        return {"note": "No movies found to generate a note for. Please scrape first!"}
        
    movie_list_str = "\n".join(movies)
    
    prompt = f"""
    You are a top-tier movie blogger on Xiaohongshu (Little Red Book). 
    Your task is to write a viral, emoji-rich recommendation post for the latest Netflix movies.

    Movies to recommend:
    {movie_list_str}

    Critical Requirements:
    1. **Title**: {f'MUST be exactly: "{request.override_title}"' if request.override_title else 'Create a click-bait title under 20 chars with emojis.'}
    2. **Tone**: Super enthusiastic, engaging, and "internet-native" (use popular slang like "绝绝子", "宝藏", "狠狠期待").
    3. **Structure**:
       - Start with a hook (e.g., "Netflix 本周杀疯了！🔥").
       - List the movies with brief, punchy highlights (1-2 sentences each).
       - Use plenty of emojis to break up text 🎬 🍿 ✨.
       - Keep paragraphs short for mobile readability.
    4. **Call to Action (MANDATORY)**: You MUST end the post with a strong CTA inviting users to join the community for free viewing. 
       - Example: "想要免费看片的小伙伴，快戳主页进群啦！👀" or "评论区滴滴，拉你进免费观影群！👇"
    5. **Tags**: Use these tags: {request.override_tags if request.override_tags else '#Netflix #网飞 #追剧 #电影推荐 #周末看什么'}.
    6. **Formatting**: 
       - Language: Chinese (Simplified).
       - STRICTLY NO Markdown bold (**text**) or italic (*text*). Plain text only.

    Make it look like a real human wrote it, not a robot!
    """
    
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant specialized in social media content creation."},
                {"role": "user", "content": prompt}
            ]
        )
        note_content = completion.choices[0].message.content
        # Post-processing to remove any markdown bold syntax if it still appears
        note_content = note_content.replace("**", "").replace("__", "")
        return {"note": note_content}
    except Exception as e:
        return {"error": str(e)}

from title_generator.generate_image import generate_title_image

class TitleRequest(BaseModel):
    date_range: str
    title: str = "收视冠军"

@app.post("/api/generate_title")
async def generate_title(request: TitleRequest):
    try:
        # Output to "images/Title_Page.jpg"
        # Use simple fixed name for now or timestamp?
        # User wants it in the package. So "images/Title_Page.jpg" is good.
        output_path = os.path.join(IMAGES_DIR, "Title_Page.jpg")
        
        # Run in executor to avoid blocking event loop? Playwright sync api blocks.
        # But for local tool it's fine.
        generated_path = await generate_title_image(request.title, request.date_range, output_path)
        
        if generated_path and os.path.exists(generated_path):
            return {"image_url": "Title_Page.jpg", "full_path": generated_path}
        else:
            return {"error": "Failed to generate image"}
    except Exception as e:
        return {"error": str(e)}

# Serve React App for all other routes (SPA support)
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    # API routes are handled above.
    # If file exists in frontend/dist, serve it.
    if os.path.exists("frontend/dist"):
        file_path = os.path.join("frontend/dist", full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # Otherwise serve index.html
        return FileResponse("frontend/dist/index.html")
    return {"error": "Frontend not built"}

if __name__ == "__main__":
    import uvicorn
    import csv
    import re
    uvicorn.run(app, host="0.0.0.0", port=8000)
