import os
import requests
from datetime import datetime, timezone

SUPABASE_URL = os.getenv(
    "BESTDESIGNSONX_SUPABASE_URL",
    "https://tuzpqmdnxvlzwqthgseg.supabase.co/rest/v1/bestdesignsonx",
)
SUPABASE_KEY = os.getenv(
    "BESTDESIGNSONX_SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1enBxbWRueHZsendxdGhnc2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxOTY4MjYsImV4cCI6MjA1MDc3MjgyNn0.rIjO0FCY9rPgsJXCxBho3sCRiepy3s319_BoK6DPZ-U",
)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}


def fetch_posts(after_id=None):
    params = {
        "select": "*",
        "status": "eq.Published",
        "order": "id.desc",
        "limit": 50,
    }
    if after_id:
        params["id"] = f"gt.{after_id}"
    response = requests.get(SUPABASE_URL, headers=HEADERS, params=params)
    response.raise_for_status()
    return response.json()


def normalize(post):
    media = post.get("media", [])
    first = media[0] if media else {}
    return {
        "source_id": str(post["id"]),
        "source": "bestdesignsonx",
        "handle": post["handle"],
        "author_name": post["author_name"],
        "tweet_url": f"https://x.com{post['post_url']}",
        "tweet_text": post["tweet_text"],
        "media_type": first.get("type"),
        "media_url": first.get("video_url") or first.get("url"),
        "cover_url": first.get("cover") or first.get("url"),
        "avatar_url": post.get("avatar"),
        "likes": post["interaction"].get("likes", 0),
        "views": post["interaction"].get("views", 0),
        "status": "pending",
        "scraped_at": datetime.now(timezone.utc),
        "posted_at": None,
    }


def scrape(posts_collection):
    latest = posts_collection.find_one({"source": "bestdesignsonx"}, sort=[("source_id", -1)])
    after_id = int(latest["source_id"]) if latest else None
    raw = fetch_posts(after_id=after_id)
    new_count = 0
    for raw_post in raw:
        normalized = normalize(raw_post)
        posts_collection.insert_one(normalized)
        new_count += 1
    return new_count
