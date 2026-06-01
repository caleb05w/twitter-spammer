import json
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone

CATEGORIES = [
    "hero", "navigation", "footer", "features", "button",
    "scroll-animations", "preloader", "page-transition", "section-transition",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html",
}


def fetch_category(category):
    url = f"https://www.details.so/inspo/category/{category}"
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    script = soup.find("script", type="application/json")
    if not script:
        return []
    return json.loads(script.text)


def normalize(item):
    has_video = bool(item.get("fullHDUrl"))
    return {
        "source_id": item["_id"],
        "source": "details.so",
        "handle": item["siteHost"],
        "author_name": item["title"],
        "tweet_url": f"https://www.details.so/inspo/site/{item['siteSlug']}",
        "tweet_text": ", ".join(item.get("tags", [])),
        "media_type": "video" if has_video else "image",
        "media_url": item["fullHDUrl"] if has_video else item["thumbUrl"],
        "cover_url": item["thumbUrl"],
        "avatar_url": f"https://favicon.im/{item['siteHost']}?larger=true",
        "likes": 0,
        "views": 0,
        "status": "pending",
        "scraped_at": datetime.now(timezone.utc),
        "posted_at": None,
    }


def scrape(posts_collection):
    new_count = 0
    for category in CATEGORIES:
        try:
            items = fetch_category(category)
            for item in items:
                normalized = normalize(item)
                if not posts_collection.find_one({"source_id": normalized["source_id"]}):
                    posts_collection.insert_one(normalized)
                    new_count += 1
            time.sleep(1)
        except Exception as e:
            print(f"Error scraping {category}: {e}")
    return new_count
