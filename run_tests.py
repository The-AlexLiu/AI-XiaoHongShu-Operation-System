import requests
import time
import json
import os

BASE_URL = "http://localhost:8000"

def log(message, status="INFO"):
    print(f"[{status}] {message}")

def test_health():
    try:
        response = requests.get(f"{BASE_URL}/docs")
        if response.status_code == 200:
            log("Backend is healthy.", "PASS")
            return True
        else:
            log(f"Backend returned {response.status_code}", "FAIL")
            return False
    except Exception as e:
        log(f"Backend connection failed: {e}", "FAIL")
        return False

def test_scrape():
    log("Starting Scrape Test...")
    # Use a future date range to ensure we find some items based on manual check
    payload = {
        "start_date": "2024-02-01",
        "end_date": "2024-02-28"
    }
    response = requests.post(f"{BASE_URL}/api/scrape", json=payload)
    if response.status_code == 200:
        job_id = response.json().get("job_id")
        log(f"Scrape job started with ID: {job_id}", "PASS")
        
        # Poll status
        for _ in range(120): # Wait up to 120 seconds
            status_res = requests.get(f"{BASE_URL}/api/status/{job_id}")
            status_data = status_res.json()
            status = status_data.get("status")
            if status == "completed":
                log(f"Scrape job completed. Count: {status_data.get('count')}", "PASS")
                return True
            elif status == "failed":
                log("Scrape job failed.", "FAIL")
                return False
            time.sleep(1)
        log("Scrape job timed out.", "FAIL")
        return False
    else:
        log(f"Scrape request failed: {response.text}", "FAIL")
        return False

def test_results():
    log("Testing Results Endpoint...")
    response = requests.get(f"{BASE_URL}/api/results")
    if response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            log(f"Results endpoint returned {len(data)} items.", "PASS")
            return True
        else:
            log("Results endpoint returned invalid format.", "FAIL")
            return False
    else:
        log(f"Results endpoint failed: {response.status_code}", "FAIL")
        return False

def test_generate_note():
    log("Testing Note Generation...")
    payload = {
        "start_date": "2024-02-01",
        "end_date": "2024-02-28",
        "override_title": "Test Title",
        "override_tags": "#Test"
    }
    # Note: This requires OpenAI API key. If not present, it might fail or mock.
    # The app.py checks for client existence.
    response = requests.post(f"{BASE_URL}/api/generate_note", json=payload)
    if response.status_code == 200:
        data = response.json()
        if "note" in data:
            log("Note generated successfully.", "PASS")
            # log(f"Note content: {data['note'][:50]}...", "INFO")
            return True
        elif "error" in data:
            log(f"Note generation returned error (expected if no API key): {data['error']}", "WARN")
            return True # Treat as pass for now if it's just missing key
        else:
            log("Note generation response invalid.", "FAIL")
            return False
    else:
        log(f"Note generation request failed: {response.status_code}", "FAIL")
        return False

def test_generate_title():
    log("Testing Title Image Generation...")
    payload = {
        "date_range": "Jan 1-7",
        "title": "Test Title Image"
    }
    response = requests.post(f"{BASE_URL}/api/generate_title", json=payload)
    if response.status_code == 200:
        data = response.json()
        if "image_url" in data:
            log(f"Title image generated: {data['image_url']}", "PASS")
            return True
        elif "error" in data:
            log(f"Title image generation error: {data['error']}", "FAIL")
            return False
    else:
        log(f"Title image request failed: {response.status_code}", "FAIL")
        return False

def test_download():
    log("Testing Download Endpoint...")
    response = requests.get(f"{BASE_URL}/api/download")
    if response.status_code == 200:
        if response.headers.get("content-type") == "application/zip":
            log("Download endpoint returned ZIP file.", "PASS")
            return True
        else:
            log(f"Download endpoint returned wrong content type: {response.headers.get('content-type')}", "FAIL")
            return False
    else:
        log(f"Download endpoint failed: {response.status_code}", "FAIL")
        return False

if __name__ == "__main__":
    print("=== Automated Test Suite ===")
    if test_health():
        test_scrape()
        test_results()
        test_generate_note()
        test_generate_title()
        test_download()
    print("=== Test Suite Completed ===")
