import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

FEED_URL = "https://www.awwwards.com/feed/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}

def fetch_feed():
    r = requests.get(FEED_URL, headers=HEADERS, timeout=15)
    r.raise_for_status()
    return ET.fromstring(r.content)


def normalize(item):
    title = item.findtext("title") or ""
    link = item.findtext("link") or ""
    raw_description = item.findtext("description") or ""
    pub_date = item.findtext("pubDate") or ""

    soup = BeautifulSoup(raw_description, "html.parser")
    img = soup.find("img")
    cover_url = img["src"] if img else None
    description = soup.get_text(separator=" ").strip()

    slug = link.rstrip("/").split("/sites/")[-1] if "/sites/" in link else link

    try:
        pub_dt = parsedate_to_datetime(pub_date).astimezone(timezone.utc)
    except Exception:
        pub_dt = datetime.now(timezone.utc)

    return {
        "source_id": slug,
        "source": "awwwards",
        "handle": slug,
        "author_name": title,
        "tweet_url": link,
        "tweet_text": description,
        "media_type": "image",
        "media_url": cover_url,
        "cover_url": cover_url,
        "avatar_url": None,
        "likes": 0,
        "views": 0,
        "status": "pending",
        "scraped_at": datetime.now(timezone.utc),
        "posted_at": None,
    }


def scrape(posts_collection):
    root = fetch_feed()
    channel = root.find("channel")
    items = channel.findall("item") if channel is not None else root.findall("item")

    new_count = 0
    for item in items:
        normalized = normalize(item)
        if not posts_collection.find_one({"source_id": normalized["source_id"], "source": "awwwards"}):
            posts_collection.insert_one(normalized)
            new_count += 1

    return new_count
