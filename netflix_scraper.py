import os
import time
import csv
import re
import argparse
import threading
from datetime import datetime, timedelta
import requests
from playwright.sync_api import sync_playwright

# Configuration
URL = "https://about.netflix.com/zh_cn/new-to-watch"
OUTPUT_DIR = "images"
CSV_FILE = "netflix_records.csv"
TARGET_WIDTH = 450
HEADLESS = True

class NetflixScraper:
    def __init__(self, output_dir=OUTPUT_DIR, csv_file=CSV_FILE):
        self.output_dir = output_dir
        self.csv_file = csv_file
        self.processed_titles = set()
        self.all_records = []
        self.start_time = None
        self._stop_event = threading.Event()

    def stop(self):
        """Signal the scraper to stop gracefully."""
        self._stop_event.set()
        
    def download_image(self, url, filename):
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            res = requests.get(url, stream=True, headers=headers, timeout=10)
            if res.status_code == 200:
                with open(filename, 'wb') as f:
                    for chunk in res.iter_content(1024):
                        f.write(chunk)
                return True
        except Exception as e:
            print(f"Error downloading {url}: {e}")
        return False

    def get_high_res_url(self, url):
        if not url: return None
        if '?' in url:
            base, params = url.split('?', 1)
            new_params = [p for p in params.split('&') if not (p.startswith('w=') or p.startswith('h='))]
            new_params.append(f"w={TARGET_WIDTH}")
            return f"{base}?{'&'.join(new_params)}"
        return f"{url}?w={TARGET_WIDTH}"

    def get_description(self, browser_context, detail_url):
        if not detail_url or "netflix.com" not in detail_url:
            return "N/A"
        
        page = browser_context.new_page()
        try:
            # Optimized timeout
            page.goto(detail_url, wait_until="domcontentloaded", timeout=15000)
            
            # Fast check for description without scrolling first if possible
            selectors = [
                'div[data-uia="video-title-synopsis"]',
                'div[data-uia="title-info-synopsis"]',
                'meta[name="description"]',
                '.synopsis'
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
            
            # If not found, try scrolling a bit
            page.mouse.wheel(0, 300)
            time.sleep(1) # Reduced sleep
            
            # Try again with more selectors
            extended_selectors = selectors + [
                'div[data-uia="video-description"]',
                '.p-b-1.p-t-1'
            ]
            
            for selector in extended_selectors:
                element = page.query_selector(selector)
                if element and not selector.startswith("meta"):
                    text = element.inner_text()
                    if text: return text.strip()
                        
            return "Description not found."
        except Exception as e:
            return f"Error: {str(e)[:50]}"
        finally:
            page.close()

    def save_records(self, records):
        if not records: return
        keys = ["Title", "Release Date", "Description", "Poster Filename", "Watch URL"]
        with open(self.csv_file, 'w', newline='', encoding='utf-8-sig') as f:
            dict_writer = csv.DictWriter(f, fieldnames=keys)
            dict_writer.writeheader()
            dict_writer.writerows(records)

    def parse_date(self, date_str):
        try:
            for fmt in ("%Y/%m/%d", "%Y-%m-%d"):
                try:
                    return datetime.strptime(date_str.strip(), fmt)
                except ValueError:
                    continue
            return None
        except:
            return None

    def run(self, start_date_str=None, end_date_str=None, progress_callback=None):
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

        start_date = self.parse_date(start_date_str) if start_date_str else None
        end_date = self.parse_date(end_date_str) if end_date_str else None

        self.all_records = []
        self.processed_titles = set()
        max_pages = 5
        total_est = max_pages * 15  # Rough estimate
        
        self.start_time = time.time()
        processed_count = 0

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=HEADLESS)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1440, "height": 900}
            )
            page = context.new_page()
            
            if progress_callback:
                progress_callback({
                    "status": "running",
                    "log": "Opening Netflix page...",
                    "processed": 0,
                    "total_est": total_est,
                    "eta_seconds": 0
                })

            page.goto(URL, wait_until="domcontentloaded", timeout=60000)
            time.sleep(3)

            # Try to switch to Grid view (with poster images) — this is the default
            # We'll scrape both views: first collect dates from Grid containers by hovering
            if progress_callback:
                progress_callback({"status": "running", "log": "Scanning items..."})

            page_num = 1
            
            while True:
                # Check for stop signal
                if self._stop_event.is_set():
                    if progress_callback:
                        progress_callback({
                            "status": "stopped",
                            "log": f"Stopped by user. Total items: {len(self.all_records)}",
                            "processed": processed_count,
                            "eta_seconds": 0
                        })
                    break

                if progress_callback:
                    progress_callback({
                        "status": "running",
                        "log": f"Scraping Page {page_num}...",
                        "processed": processed_count
                    })
                
                # Scroll to load all items on the page
                for i in range(5):
                    page.mouse.wheel(0, 1000)
                    time.sleep(0.2)
                time.sleep(1)
                
                containers = page.query_selector_all("div[class*='TitleContainer']")
                
                new_items_on_page = 0
                reached_end_boundary = False
                
                for container in containers:
                    # Check for stop signal before each item
                    if self._stop_event.is_set():
                        break

                    try:
                        # Hover to reveal the overlay with title + date
                        container.hover()
                        time.sleep(0.3)  # Wait for overlay to appear
                        
                        link_el = container.query_selector("a[href*='/watch/']")
                        if not link_el: continue
                        
                        raw_title = link_el.get_attribute("aria-label") or link_el.inner_text()
                        title = raw_title.replace("在 Netflix 上观看", "").strip(" ()→").split("202")[0].strip()
                        
                        if not title or title in self.processed_titles: continue
                        
                        # After hovering, try to find the date from the overlay <p> tags or inner text
                        all_text = container.inner_text()
                        date_match = re.search(r'\d{4}/\d{1,2}/\d{1,2}', all_text)
                        date_str = date_match.group() if date_match else None
                        
                        # If still no date, check inside <a> overlay's <p> elements
                        if not date_str:
                            p_tags = link_el.query_selector_all("p")
                            for p_tag in p_tags:
                                p_text = p_tag.inner_text()
                                dm = re.search(r'\d{4}/\d{1,2}/\d{1,2}', p_text)
                                if dm:
                                    date_str = dm.group()
                                    break
                        
                        # Date filtering
                        if date_str:
                            item_date = self.parse_date(date_str)
                            if item_date:
                                if end_date and item_date > end_date:
                                    if progress_callback:
                                        progress_callback({"status": "running", "log": f"Skipped (after range): {title} ({date_str})"})
                                    self.processed_titles.add(title)
                                    reached_end_boundary = True
                                    continue
                                if start_date and item_date < start_date:
                                    if progress_callback:
                                        progress_callback({"status": "running", "log": f"Skipped (before range): {title} ({date_str})"})
                                    self.processed_titles.add(title)
                                    continue
                            else:
                                # Unparseable date with filter active → skip
                                if start_date or end_date:
                                    if progress_callback:
                                        progress_callback({"status": "running", "log": f"Skipped (bad date): {title} ({date_str})"})
                                    self.processed_titles.add(title)
                                    continue
                        else:
                            # No date found at all with filter active → skip
                            if start_date or end_date:
                                if progress_callback:
                                    progress_callback({"status": "running", "log": f"Skipped (no date): {title}"})
                                self.processed_titles.add(title)
                                continue

                        watch_url = link_el.get_attribute("href")
                        
                        # Image handling
                        img_el = container.query_selector("img")
                        src = img_el.get_attribute("src") if img_el else None
                        
                        poster_filename = "N/A"
                        if src:
                            high_res_url = self.get_high_res_url(src)
                            clean_title = "".join(x for x in title if x.isalnum() or x in " -_").strip()[:50]
                            poster_filename = f"{clean_title}.jpg"
                            target_path = os.path.join(self.output_dir, poster_filename)
                            if not os.path.exists(target_path):
                                self.download_image(high_res_url, target_path)
                        
                        description = self.get_description(context, watch_url)
                        
                        self.all_records.append({
                            "Title": title,
                            "Release Date": date_str or "Unknown",
                            "Description": description,
                            "Poster Filename": poster_filename,
                            "Watch URL": watch_url
                        })
                        self.processed_titles.add(title)
                        new_items_on_page += 1
                        processed_count += 1
                        self.save_records(self.all_records)
                        
                        # Update ETA
                        elapsed = time.time() - self.start_time
                        avg_time = elapsed / processed_count if processed_count > 0 else 0
                        remaining_items = max(0, total_est - processed_count)
                        eta = int(avg_time * remaining_items)
                        
                        if progress_callback:
                            progress_callback({
                                "status": "running",
                                "log": f"Processed: {title} ({date_str})",
                                "processed": processed_count,
                                "total_est": total_est,
                                "eta_seconds": eta
                            })

                    except Exception as e:
                        pass
                
                if page_num >= max_pages:
                    break

                # Smart truncation: if all items on this page are after end_date, stop
                # (Netflix orders oldest-first, so later pages will have even newer items)
                if reached_end_boundary and new_items_on_page == 0:
                    if progress_callback:
                        progress_callback({"status": "running", "log": "All remaining items are after date range. Stopping early."})
                    break

                # Pagination
                next_page_num = page_num + 1
                next_btn = page.query_selector(f'button:has-text("{next_page_num}")')
                if not next_btn:
                    next_btn = page.query_selector('button[aria-label="Next"], button[aria-label*="下一页"]')

                if next_btn:
                    next_btn.click()
                    page_num += 1
                    time.sleep(3)
                else:
                    break

            browser.close()
            
            if not self._stop_event.is_set() and progress_callback:
                progress_callback({
                    "status": "completed",
                    "log": f"Finished! Total items: {len(self.all_records)}",
                    "processed": processed_count,
                    "eta_seconds": 0
                })
            
            return self.all_records

def scrape_netflix_data(start_date_str=None, end_date_str=None):
    scraper = NetflixScraper()
    scraper.run(start_date_str, end_date_str)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Netflix Meta-Scraper with Date Filtering")
    parser.add_argument("--start", help="Start date (YYYY/M/D)", default=None)
    parser.add_argument("--end", help="End date (YYYY/M/D)", default=None)
    args = parser.parse_args()
    
    scrape_netflix_data(args.start, args.end)
