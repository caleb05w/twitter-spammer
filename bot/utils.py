import requests


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
