import os
import sys
import uuid
import requests
import tweepy
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime, timezone

_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_dir, "../.env"))
load_dotenv(os.path.join(_dir, "../.env.local"))


def get_twitter_client():
    return tweepy.Client(
        consumer_key=os.getenv("X_API_KEY"),
        consumer_secret=os.getenv("X_API_SECRET"),
        access_token=os.getenv("X_ACCESS_TOKEN"),
        access_token_secret=os.getenv("X_ACCESS_TOKEN_SECRET"),
    )


def get_twitter_v1():
    auth = tweepy.OAuth1UserHandler(
        os.getenv("X_API_KEY"),
        os.getenv("X_API_SECRET"),
        os.getenv("X_ACCESS_TOKEN"),
        os.getenv("X_ACCESS_TOKEN_SECRET"),
    )
    return tweepy.API(auth)


def download_media(url):
    headers = {}
    if "b-cdn.net" in url or "details.so" in url:
        headers["Referer"] = "https://www.details.so"
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    return response.content


def format_caption(post):
    return f"Design by @{post['handle']}"


def post_to_x(post):
    client = get_twitter_client()
    api_v1 = get_twitter_v1()

    caption = format_caption(post)
    is_video = post.get("media_type") == "video"

    if is_video:
        media_url = post.get("media_url")
    else:
        media_url = post.get("media_url") or post.get("cover_url")

    if media_url:
        media_data = download_media(media_url)
        ext = "mp4" if is_video else "jpg"
        filename = f"/tmp/design_post_{uuid.uuid4().hex}.{ext}"
        with open(filename, "wb") as f:
            f.write(media_data)

        try:
            if is_video:
                media = api_v1.media_upload(
                    filename=filename,
                    media_category="tweet_video",
                    chunked=True,
                )
            else:
                media = api_v1.media_upload(filename=filename)

            response = client.create_tweet(text=caption, media_ids=[media.media_id])
        finally:
            try:
                os.remove(filename)
            except OSError:
                pass
    else:
        response = client.create_tweet(text=caption)

    return response.data["id"]


def run(post_id=None):
    mongo = MongoClient(os.getenv("MONGODB_URI"))
    db = mongo["design-scrape"]
    posts = db["posts"]

    if not post_id:
        config = db["settings"].find_one({"_id": "global"}) or {}
        post_hour_pst = config.get("post_hour_pst", 9)
        post_hour_utc = (post_hour_pst + 8) % 24
        current_hour_utc = datetime.now(timezone.utc).hour
        if current_hour_utc != post_hour_utc:
            print(f"Skipping — current UTC hour is {current_hour_utc}, post hour is {post_hour_utc}")
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

    if not queue:
        print("No posts to send.")
        mongo.close()
        return

    for post in queue:
        try:
            tweet_id = post_to_x(post)
            posts.update_one(
                {"_id": post["_id"]},
                {"$set": {"status": "posted", "posted_at": datetime.now(timezone.utc), "tweet_id": tweet_id}}
            )
            print(f"Posted: @{post['handle']} — tweet ID {tweet_id}")
        except Exception as e:
            print(f"Failed to post {post['_id']}: {e}")
            raise

    mongo.close()


if __name__ == "__main__":
    post_id = sys.argv[1] if len(sys.argv) > 1 else None
    run(post_id=post_id)
