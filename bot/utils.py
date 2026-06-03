import os
import random
import requests
from bson import ObjectId
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pymongo import MongoClient


def build_caption(post):
    if post.get("tweet_text"):
        return f"{post['tweet_text']}\n\nby @{post['handle']}"
    return f"Design by @{post['handle']}"


def media_url(post):
    if post.get("media_type") == "video":
        return post.get("media_url")
    return post.get("cover_url") or post.get("media_url")


def download_media(url):
    headers = {}
    if "b-cdn.net" in url or "details.so" in url:
        headers["Referer"] = "https://www.details.so"
    res = requests.get(url, headers=headers, timeout=30)
    res.raise_for_status()
    return res.content


_PT = ZoneInfo("America/Los_Angeles")


def _pt_to_utc_minutes(pt_minutes):
    """Convert a list of Pacific-time minutes-from-midnight to UTC minutes, respecting DST."""
    result = []
    for m in pt_minutes:
        h, mn = divmod(m, 60)
        dt_pt = datetime.now(_PT).replace(hour=h, minute=mn, second=0, microsecond=0)
        dt_utc = dt_pt.astimezone(timezone.utc)
        result.append(dt_utc.hour * 60 + dt_utc.minute)
    return result


def _in_window(current, targets, window=28):
    """True if current UTC minutes falls within `window` minutes after any target."""
    return any((current - t) % 1440 <= window for t in targets)


def run_poster(platform_key, default_minutes, post_fn, result_field, post_id=None):
    """Shared scheduler + dispatch loop for all platform posters.

    platform_key:    settings field name, e.g. "post_hours_threads"
    default_minutes: fallback PT minutes-from-midnight if setting is absent
    post_fn:         callable(post_doc) → platform media/tweet ID
    result_field:    DB field to store the returned ID, e.g. "threads_media_id"
    post_id:         optional ObjectId hex string to post a specific document
    """
    mongo = MongoClient(os.getenv("MONGODB_URI"))
    db = mongo["design-scrape"]
    posts = db["posts"]
    config = {}

    force = bool(os.getenv("FORCE_POST"))
    if not post_id and not force:
        config = db["settings"].find_one({"_id": "global"}) or {}
        post_times_utc = _pt_to_utc_minutes(config.get(platform_key, [default_minutes]))
        now = datetime.now(timezone.utc)
        current_minutes = now.hour * 60 + now.minute
        if not _in_window(current_minutes, post_times_utc):
            print(f"Skipping — current UTC {current_minutes}m, post times {post_times_utc}")
            mongo.close()
            return

    if post_id:
        try:
            oid = ObjectId(post_id)
        except Exception:
            print(f"Invalid post ID: {post_id}")
            mongo.close()
            return
        queue = [p for p in [posts.find_one({"_id": oid})] if p]
    else:
        queue = list(posts.find({"status": "approved"}).sort("scraped_at", 1).limit(1))

    if not queue and not post_id and config.get("auto_run", False):
        pending = list(posts.find({"status": "pending"}).limit(50))
        if pending:
            pick = random.choice(pending)
            posts.update_one({"_id": pick["_id"]}, {"$set": {"status": "approved"}})
            queue = [pick]
            print(f"Auto-approved: @{pick['handle']}")

    if not queue:
        print("No posts to send.")
        mongo.close()
        return

    for post in queue:
        try:
            result_id = post_fn(post)
            posts.update_one(
                {"_id": post["_id"]},
                {"$set": {"status": "posted", "posted_at": datetime.now(timezone.utc), result_field: result_id}},
            )
            print(f"Posted @{post['handle']} — {result_field}: {result_id}")
        except Exception as e:
            print(f"Failed to post {post['_id']}: {e}")
            raise

    mongo.close()
