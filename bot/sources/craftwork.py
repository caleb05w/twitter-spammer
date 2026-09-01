import requests
from datetime import datetime, timezone

from ._cursor import high_water_mark, upsert

BASE_URL = "https://craftwork.design"
CATALOG_URL = f"{BASE_URL}/api/v2/curated/websites/catalog"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer": f"{BASE_URL}/curated/websites/",
}


def fetch_page(offset, limit=60):
    r = requests.get(CATALOG_URL, headers=HEADERS, params={
        "limit": limit,
        "offset": offset,
        "styleIds": "",
        "illustrationIds": "",
        "attributeIds": "",
    }, timeout=15)
    r.raise_for_status()
    body = r.json()
    return body["data"]["data"], body["data"]["pagination"]


def normalize(item):
    categories = [c["name"] for c in item.get("categories", [])]
    styles = [s["name"] for s in item.get("styles", [])]
    tags = ", ".join(categories + styles)

    has_video = bool(item.get("videoCover"))

    return {
        "source_id": item["id"],
        "source": "craftwork",
        "handle": item["slug"],
        "author_name": item["name"],
        "tweet_url": item.get("externalReference") or f"{BASE_URL}/curated/websites/{item['slug']}",
        "tweet_text": item.get("description") or tags,
        "media_type": "video" if has_video else "image",
        "media_url": item.get("videoCover") or item.get("coverUrl"),
        "cover_url": item.get("coverUrl"),
        "avatar_url": None,
        "likes": 0,
        "views": 0,
        "status": "pending",
        "scraped_at": datetime.now(timezone.utc),
        "posted_at": None,
    }


def scrape(posts_collection):
    latest_id = high_water_mark(posts_collection, "craftwork") or 0

    new_count = 0
    offset = 0
    limit = 60

    while True:
        items, pagination = fetch_page(offset, limit)
        if not items:
            break

        # The catalog is ordered by curation, not by id, so a page can hold an
        # old item ahead of a newer one. Scan every item on the page instead of
        # breaking at the first id below the cursor, and stop only once a whole
        # page contained nothing new.
        page_new = 0
        for item in items:
            if item["id"] <= latest_id:
                continue
            if upsert(posts_collection, normalize(item)):
                page_new += 1
        new_count += page_new

        if page_new == 0 or offset + limit >= pagination["total"]:
            break

        offset += limit

    return new_count
