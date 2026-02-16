import os
import time
import csv
import re
import argparse
from datetime import datetime
import requests
from playwright.sync_api import sync_playwright

# Configuration
URL = "https://about.netflix.com/zh_cn/new-to-watch"
OUTPUT_DIR = "images"
CSV_FILE = "netflix_records.csv"
TARGET_WIDTH = 450
HEADLESS = True

def download_image(url, filename):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res = requests.get(url, stream=True, headers=headers, timeout=15)
        if res.status_code == 200:
            with open(filename, 'wb') as f:
                for chunk in res.iter_content(1024):
                    f.write(chunk)
            return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
    return False

def get_high_res_url(url):
    if not url: return None
    if '?' in url:
        base, params = url.split('?', 1)
        new_params = [p for p in params.split('&') if not (p.startswith('w=') or p.startswith('h='))]
        new_params.append(f"w={TARGET_WIDTH}")
        return f"{base}?{'&'.join(new_params)}"
    return f"{url}?w={TARGET_WIDTH}"

def get_description(browser_context, detail_url):
    if not detail_url or "netflix.com" not in detail_url:
        return "N/A"
    
    page = browser_context.new_page()
    try:
        page.goto(detail_url, wait_until="domcontentloaded", timeout=30000)
        page.mouse.wheel(0, 300)
        time.sleep(3)
        
        selectors = [
            'div[data-uia="video-title-synopsis"]',
            'div[data-uia="title-info-synopsis"]',
            'div[data-uia="video-description"]',
            '.p-b-1.p-t-1',
            '.synopsis',
            'meta[name="description"]'
        ]
        
        for selector in selectors:
            if selector.startswith("meta"):
                element = page.query_selector(selector)
                if element:
                    content = element.get_attribute("content")
                    if content: return content.strip()
            else:
                element = page.query_selector(selector)
                if element:
                    text = element.inner_text()
                    if text: return text.strip()
                    
        return "Description not found."
    except Exception as e:
        return f"Error: {str(e)[:50]}"
    finally:
        page.close()

def save_records(records):
    if not records: return
    keys = ["Title", "Release Date", "Description", "Poster Filename", "Watch URL"]
    with open(CSV_FILE, 'w', newline='', encoding='utf-8-sig') as f:
        dict_writer = csv.DictWriter(f, fieldnames=keys)
        dict_writer.writeheader()
        dict_writer.writerows(records)

def parse_date(date_str):
    try:
        # Standardize format: 2026/2/9 -> 2026-02-09
        # Try multiple formats
        for fmt in ("%Y/%m/%d", "%Y-%m-%d"):
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        return None
    except:
        return None

def scrape_netflix_data(start_date_str=None, end_date_str=None):
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    start_date = parse_date(start_date_str) if start_date_str else None
    end_date = parse_date(end_date_str) if end_date_str else None

    all_records = []
    processed_titles = set()
    max_pages = 5  # Safety limit to avoid infinite loops

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1440, "height": 900}
        )
        page = context.new_page()
        
        print(f"Opening: {URL}")
        page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        time.sleep(10)

        page_num = 1
        
        while True:
            print(f"\n--- Scraping Page {page_num} ---")
            
            for i in range(10):
                page.mouse.wheel(0, 800)
                time.sleep(0.5)
            time.sleep(2)
            
            containers = page.query_selector_all("div[class*='TitleContainer']")
            print(f"Found {len(containers)} containers.")
            
            new_items_on_page = 0
            
            for container in containers:
                try:
                    container.hover()
                    time.sleep(0.5)
                    
                    link_el = container.query_selector("a[href*='/watch/']")
                    if not link_el: continue
                    
                    raw_title = link_el.get_attribute("aria-label") or link_el.inner_text()
                    title = raw_title.replace("在 Netflix 上观看", "").strip(" ()→").split("202")[0].strip()
                    
                    if not title or title in processed_titles: continue
                    
                    watch_url = link_el.get_attribute("href")
                    
                    all_text = container.inner_text()
                    date_match = re.search(r'\d{4}/\d{1,2}/\d{1,2}', all_text)
                    date_str = date_match.group() if date_match else None
                    
                    # Filtering Logic: skip items outside the date range, but keep scanning
                    if date_str:
                        item_date = parse_date(date_str)
                        if item_date:
                            if end_date and item_date > end_date:
                                print(f"  Skipping {title} ({date_str}) — newer than end date.")
                                continue
                            if start_date and item_date < start_date:
                                print(f"  Skipping {title} ({date_str}) — older than start date.")
                                continue
                    


                    img_el = container.query_selector("img")
                    src = img_el.get_attribute("src") if img_el else None
                    
                    print(f"  [{len(all_records)+1}] {title} ({date_str or 'Unknown'})")
                    
                    poster_filename = "N/A"
                    if src:
                        high_res_url = get_high_res_url(src)
                        clean_title = "".join(x for x in title if x.isalnum() or x in " -_").strip()[:50]
                        poster_filename = f"{clean_title}.jpg"
                        target_path = os.path.join(OUTPUT_DIR, poster_filename)
                        if not os.path.exists(target_path):
                            download_image(high_res_url, target_path)
                    
                    description = get_description(context, watch_url)
                    
                    all_records.append({
                        "Title": title,
                        "Release Date": date_str or "Unknown",
                        "Description": description,
                        "Poster Filename": poster_filename,
                        "Watch URL": watch_url
                    })
                    processed_titles.add(title)
                    new_items_on_page += 1
                    save_records(all_records)

                except Exception as e:
                    pass
            


            print(f"Page {page_num} completed. Collected {new_items_on_page} items.")

            next_page_num = page_num + 1
            next_btn = page.query_selector(f'button:has-text("{next_page_num}")')
            if not next_btn:
                next_btn = page.query_selector('button[aria-label="Next"], button[aria-label*="下一页"]')

            if next_btn and page_num < max_pages:
                print(f"Moving to Page {next_page_num}...")
                next_btn.click()
                page_num += 1
                time.sleep(10)
            else:
                break

        print(f"\nScraping Task Finished. Total: {len(all_records)}")
        browser.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Netflix Meta-Scraper with Date Filtering")
    parser.add_argument("--start", help="Start date (YYYY/M/D)", default=None)
    parser.add_argument("--end", help="End date (YYYY/M/D)", default=None)
    args = parser.parse_args()
    
    scrape_netflix_data(args.start, args.end)
