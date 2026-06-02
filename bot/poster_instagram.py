import os
import sys
import time
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime, timezone

_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_dir, "../.env"))
load_dotenv(os.path.join(_dir, "../.env.local"))

from utils import build_caption, media_url

GRAPH_URL = "https://graph.facebook.com/v21.0"


def create_container(post, user_id, token):
    url = media_url(post)
    if not url:
        raise Exception("No media URL available for Instagram post")
    params = {"caption": build_caption(post), "access_token": token}
    if post.get("media_type") == "video":
        params["video_url"] = url
        params["media_type"] = "REELS"
    else:
        params["image_url"] = url
    res = requests.post(f"{GRAPH_URL}/{user_id}/media", data=params, timeout=30)
    data = res.json()
    if not res.ok or data.get("error"):
        raise Exception(data.get("error", {}).get("message") or "Failed to create IG container")
    return data["id"]


def wait_for_container(container_id, token, timeout=120):
    deadline = time.time() + timeout
    while time.time() < deadline:
        res = requests.get(
            f"{GRAPH_URL}/{container_id}",
            params={"fields": "status_code,status,error_message", "access_token": token},
            timeout=15,
        )
        data = res.json()
        status = data.get("status_code")
        if status == "FINISHED":
            return
        if status == "ERROR":
            raise Exception(f"Container processing failed: {data.get('error_message', status)}")
        time.sleep(4)
    raise Exception("Timed out waiting for IG media container")


def publish_container(container_id, user_id, token):
    res = requests.post(
        f"{GRAPH_URL}/{user_id}/media_publish",
        data={"creation_id": container_id, "access_token": token},
        timeout=30,
    )
    data = res.json()
    if not res.ok or data.get("error"):
        raise Exception(data.get("error", {}).get("message") or "Failed to publish IG post")
    return data["id"]


def post_to_instagram(post):
    user_id = os.getenv("IG_USER_ID")
    token = os.getenv("IG_ACCESS_TOKEN")
    container_id = create_container(post, user_id, token)
    if post.get("media_type") == "video":
        wait_for_container(container_id, token)
    return publish_container(container_id, user_id, token)


def run(post_id=None):
    mongo = MongoClient(os.getenv("MONGODB_URI"))
    db = mongo["design-scrape"]
    posts = db["posts"]

    if not post_id:
        config = db["settings"].find_one({"_id": "global"}) or {}
        post_times_pst = config.get("post_hours_instagram", [660])  # minutes from midnight PST
        post_times_utc = [(m + 8 * 60) % (24 * 60) for m in post_times_pst]
        now = datetime.now(timezone.utc)
        current_minutes = now.hour * 60 + now.minute
        if current_minutes not in post_times_utc:
            print(f"Skipping — current UTC minutes is {current_minutes}, post times are {post_times_utc}")
            mongo.close()
            return

    if post_id:
        try:
            oid = ObjectId(post_id)
        except Exception:
            print(f"Invalid post ID: {post_id}")
            mongo.close()
            return
        queue = [posts.find_one({"_id": oid})]
        queue = [p for p in queue if p]
    else:
        queue = list(posts.find({"status": "approved"}).sort("scraped_at", 1).limit(1))

    if not queue and not post_id:
        if config.get("auto_run", False):
            import random
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
            ig_media_id = post_to_instagram(post)
            posts.update_one(
                {"_id": post["_id"]},
                {"$set": {"status": "posted", "posted_at": datetime.now(timezone.utc), "ig_media_id": ig_media_id}},
            )
            print(f"Posted to Instagram: @{post['handle']} — media ID {ig_media_id}")
        except Exception as e:
            print(f"Failed to post {post['_id']}: {e}")
            raise

    mongo.close()


if __name__ == "__main__":
    post_id = sys.argv[1] if len(sys.argv) > 1 else None
    run(post_id=post_id)
