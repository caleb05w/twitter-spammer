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


def run():
    client = MongoClient(os.getenv("MONGODB_URI"))
    db = client["design-scrape"]
    posts = db["posts"]
    runs = db["scrape_runs"]
    settings = db["settings"]

    # check if enough time has passed since last run
    config = settings.find_one({"_id": "global"}) or {}
    interval_hours = config.get("scrape_interval_hours", 6)
    last_run = runs.find_one({"source": "bestdesignsonx"}, sort=[("ran_at", -1)])
    if last_run:
        ran_at = last_run["ran_at"].replace(tzinfo=timezone.utc) if last_run["ran_at"].tzinfo is None else last_run["ran_at"]
        elapsed = (datetime.now(timezone.utc) - ran_at).total_seconds() / 3600
        if elapsed < interval_hours:
            print(f"Skipping — last ran {elapsed:.1f}h ago, interval is {interval_hours}h")
            client.close()
            return

    # find the highest source_id already in the database
    latest = posts.find_one({"source": "bestdesignsonx"}, sort=[("source_id", -1)])
    after_id = int(latest["source_id"]) if latest else None

    raw = fetch_posts(after_id=after_id)
    new_count = 0

    for raw_post in raw:
        normalized = normalize(raw_post)
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
