import os
import sys
import uuid
import tweepy
from dotenv import load_dotenv

_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_dir, "../.env"))
load_dotenv(os.path.join(_dir, "../.env.local"))

from utils import download_media, run_poster


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


def post_to_x(post):
    client = get_twitter_client()
    api_v1 = get_twitter_v1()

    caption = f"Design by @{post['handle']}"
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


if __name__ == "__main__":
    post_id = sys.argv[1] if len(sys.argv) > 1 else None
    run_poster("post_hours_x", 540, post_to_x, "tweet_id", post_id)
