import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime, timezone

_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_dir, "../.env"))
load_dotenv(os.path.join(_dir, "../.env.local"))

from sources import bestdesignsonx, details_so, craftwork

SOURCES = [bestdesignsonx, details_so, craftwork]


def run():
    client = MongoClient(os.getenv("MONGODB_URI"))
    db = client["design-scrape"]
    posts = db["posts"]
    runs = db["scrape_runs"]
    settings = db["settings"]

    force = "--force" in sys.argv
    source_filter = None
    for arg in sys.argv:
        if arg.startswith("--source="):
            source_filter = arg.split("=", 1)[1]

    if not force:
        config = settings.find_one({"_id": "global"}) or {}
        interval_hours = config.get("scrape_interval_hours", 6)
        last_run = runs.find_one({}, sort=[("ran_at", -1)])
        if last_run:
            ran_at = last_run["ran_at"].replace(tzinfo=timezone.utc) if last_run["ran_at"].tzinfo is None else last_run["ran_at"]
            elapsed = (datetime.now(timezone.utc) - ran_at).total_seconds() / 3600
            if elapsed < interval_hours:
                print(f"Skipping — last ran {elapsed:.1f}h ago, interval is {interval_hours}h")
                client.close()
                return

    active_sources = [s for s in SOURCES if not source_filter or s.__name__.split(".")[-1] == source_filter]

    total_new = 0
    for source in active_sources:
        try:
            new_count = source.scrape(posts)
            source_name = getattr(source, "SOURCE_NAME", source.__name__.split(".")[-1])
            runs.insert_one({
                "source": source_name,
                "ran_at": datetime.now(timezone.utc),
                "new_posts": new_count,
            })
            print(f"{source.__name__.split('.')[-1]}: {new_count} new posts")
            total_new += new_count
        except Exception as e:
            print(f"Error in {source.__name__}: {e}")

    print(f"Done — {total_new} total new posts")
    client.close()


if __name__ == "__main__":
    run()
