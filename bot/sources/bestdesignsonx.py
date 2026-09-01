import os
import requests
from datetime import datetime, timezone

from ._cursor import high_water_mark, upsert

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


PAGE_SIZE = 200


def fetch_posts(after_id=None):
    """Page forward from after_id in ascending id order.

    Ascending + paging (not the old newest-50 slice) so a cursor that has fallen
    behind catches all the way up instead of silently skipping the gap.
    """
    cursor = after_id
    while True:
        params = {
            "select": "*",
            "status": "eq.Published",
            "order": "id.asc",
            "limit": PAGE_SIZE,
        }
        if cursor:
            params["id"] = f"gt.{cursor}"
        response = requests.get(SUPABASE_URL, headers=HEADERS, params=params)
        response.raise_for_status()
        batch = response.json()
        if not batch:
            return
        yield from batch
        cursor = batch[-1]["id"]
        if len(batch) < PAGE_SIZE:
            return


def normalize(post):
    media = post.get("media", [])
    first = media[0] if media else {}
    return {
        "source_id": post["id"],
        "source": "bestdesignsonx",
        "handle": post["handle"],
        "author_name": post["author_name"],
        "tweet_url": f"https://x.com{post['post_url']}",
        "tweet_text": post["tweet_text"],
        "media_type": first.get("type"),
        # Photo entries carry "image"/"original_image_url"; only video entries
        # have "video_url"/"cover". Reading just the video keys left every photo
        # post with no media, so it published as a text-only thread.
        # original_image_url is the JPEG — prefer it over the AVIF in "image",
        # which the Meta Graph API will not ingest.
        "media_url": (
            first.get("video_url")
            or first.get("original_image_url")
            or first.get("image")
            or first.get("url")
        ),
        "cover_url": (
            first.get("cover")
            or first.get("original_image_url")
            or first.get("image")
            or first.get("url")
        ),
        "avatar_url": post.get("avatar"),
        "likes": post["interaction"].get("likes", 0),
        "views": post["interaction"].get("views", 0),
        "status": "pending",
        "scraped_at": datetime.now(timezone.utc),
        "posted_at": None,
    }


def scrape(posts_collection):
    after_id = high_water_mark(posts_collection, "bestdesignsonx")
    new_count = 0
    for raw_post in fetch_posts(after_id=after_id):
        if upsert(posts_collection, normalize(raw_post)):
            new_count += 1
    return new_count
