import os
import sys
import time
import requests
from dotenv import load_dotenv

_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_dir, "../.env"))
load_dotenv(os.path.join(_dir, "../.env.local"))

from utils import build_caption, media_url, run_poster

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


if __name__ == "__main__":
    post_id = sys.argv[1] if len(sys.argv) > 1 else None
    run_poster("post_hours_instagram", 660, post_to_instagram, "ig_media_id", post_id)
