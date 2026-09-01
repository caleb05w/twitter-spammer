"""Shared high-water-mark helper for id-paginated sources.

source_id was historically stored as a string, so MongoDB sorted it
lexicographically: once ids reached five digits, "10821" sorted below "9999"
and the cursor froze at the rollover. $toInt makes the max numeric regardless
of how the row was written, so this works before and after the int migration.
"""


def high_water_mark(posts_collection, source):
    """Highest numeric source_id stored for `source`, or None if there are none."""
    result = list(
        posts_collection.aggregate(
            [
                {"$match": {"source": source}},
                {"$group": {"_id": None, "max_id": {"$max": {"$toInt": "$source_id"}}}},
            ]
        )
    )
    return result[0]["max_id"] if result and result[0]["max_id"] is not None else None


def upsert(posts_collection, normalized):
    """Insert if unseen. Returns True when a row was actually created.

    Paired with the unique index on (source, source_id), this makes a re-scrape
    idempotent instead of duplicating rows.
    """
    result = posts_collection.update_one(
        {"source": normalized["source"], "source_id": normalized["source_id"]},
        {"$setOnInsert": normalized},
        upsert=True,
    )
    return result.upserted_id is not None
