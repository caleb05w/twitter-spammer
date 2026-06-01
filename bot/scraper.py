import os
import requests
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime, timezone

load_dotenv("../.env")

SUPABASE_URL = "https://tuzpqmdnxvlzwqthgseg.supabase.co/rest/v1/bestdesignsonx"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1enBxbWRueHZsendxdGhnc2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxOTY4MjYsImV4cCI6MjA1MDc3MjgyNn0.rIjO0FCY9rPgsJXCxBho3sCRiepy3s319_BoK6DPZ-U"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}


def fetch_posts(limit=120):
    response = requests.get(SUPABASE_URL, headers=HEADERS, params={
        "select": "*",
        "status": "eq.Published",
        "order": "created_at.desc",
        "offset": 0,
        "limit": limit,
    })
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


def run():
    client = MongoClient(os.getenv("MONGODB_URI"))
    db = client["design-scrape"]
    posts = db["posts"]
    runs = db["scrape_runs"]

    raw = fetch_posts()
    new_count = 0

    for raw_post in raw:
        normalized = normalize(raw_post)
        existing = posts.find_one({"source_id": normalized["source_id"]})
        if not existing:
            posts.insert_one(normalized)
            new_count += 1

    runs.insert_one({
        "source": "bestdesignsonx",
        "ran_at": datetime.now(timezone.utc),
        "new_posts": new_count,
        "total_fetched": len(raw),
    })

    result = f"Done — {new_count} new posts added, {len(raw) - new_count} already existed"
    print(result)
    client.close()


if __name__ == "__main__":
    run()
