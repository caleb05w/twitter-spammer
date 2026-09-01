// Dedupe + repair the bestdesignsonx queue poisoned by the string-cursor bug.
// DRY RUN by default. Add --apply to actually write.
//   MONGODB_URI="..." node scripts/cleanup-bestdesignsonx.mjs
//   MONGODB_URI="..." node scripts/cleanup-bestdesignsonx.mjs --apply
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;
if (!uri) { console.error("Set MONGODB_URI first."); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const posts = client.db("design-scrape").collection("posts");
const PUBLISHED = ["tweet_id", "threads_media_id", "ig_media_id"];
const isPublished = (d) => d.status === "posted" || PUBLISHED.some((k) => d[k]);

console.log(APPLY ? "=== APPLY MODE — writing ===" : "=== DRY RUN — no writes (add --apply) ===");
console.log("total bestdesignsonx rows:", await posts.countDocuments({ source: "bestdesignsonx" }));

// 1. Group duplicates by (source, source_id) across EVERY source. The unique
//    index at the end is collection-wide, so leaving another source's duplicates
//    in place would make createIndex throw.
const groups = await posts.aggregate([
  { $group: { _id: { s: "$source", sid: "$source_id" }, n: { $sum: 1 }, ids: { $push: "$_id" } } },
  { $match: { n: { $gt: 1 } } },
]).toArray();
const perSource = {};
for (const g of groups) perSource[g._id.s] = (perSource[g._id.s] ?? 0) + (g.n - 1);
console.log("duplicate rows by source:", perSource);

let toDelete = [];
for (const g of groups) {
  const docs = await posts.find({ _id: { $in: g.ids } }).sort({ scraped_at: 1 }).toArray();
  const published = docs.filter(isPublished);
  // Never delete a post that actually went out. If one did, drop all its unpublished
  // clones (already shipped). Otherwise keep the single oldest copy.
  const survivors = published.length ? published : [docs[0]];
  const keep = new Set(survivors.map((d) => String(d._id)));
  toDelete.push(...docs.filter((d) => !keep.has(String(d._id))).map((d) => d._id));
}
console.log(`duplicate rows to delete: ${toDelete.length}`);

// 2. Un-retire posts falsely marked failed since the posting break (Jul 14).
const falseFailed = await posts.countDocuments({
  source: "bestdesignsonx", status: "failed", failed_at: { $gte: new Date("2026-07-14") },
});
console.log(`"failed" rows to reset to pending: ${falseFailed}`);

// 2b. Backfill media on rows written before the media-key fix. The scraper only
//     $setOnInsert, so a re-scrape never repairs a row that already exists.
const SUPA = "https://tuzpqmdnxvlzwqthgseg.supabase.co/rest/v1/bestdesignsonx";
const SUPA_KEY = process.env.BESTDESIGNSONX_SUPABASE_KEY;
const needMedia = await posts.distinct("source_id", {
  source: "bestdesignsonx",
  status: { $in: ["pending", "approved"] },
  $or: [{ cover_url: null }, { cover_url: { $exists: false } }],
});
console.log(`rows needing media backfill: ${needMedia.length}`);

async function backfillMedia(ids) {
  if (!SUPA_KEY) {
    console.log("  BESTDESIGNSONX_SUPABASE_KEY not set — skipping backfill");
    return 0;
  }
  let fixed = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).map((n) => parseInt(n, 10)).filter(Number.isInteger);
    if (!chunk.length) continue;
    const res = await fetch(`${SUPA}?select=id,media&id=in.(${chunk.join(",")})`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    if (!res.ok) { console.log(`  supabase ${res.status} — skipping chunk`); continue; }
    for (const row of await res.json()) {
      const m = (row.media ?? [])[0] ?? {};
      // Prefer the JPEG in original_image_url over the AVIF in image — the Meta
      // Graph API will not ingest AVIF.
      const media = m.video_url || m.original_image_url || m.image || m.url;
      const cover = m.cover || m.original_image_url || m.image || m.url;
      if (!media && !cover) continue;
      const r = await posts.updateMany(
        { source: "bestdesignsonx", source_id: { $in: [row.id, String(row.id)] } },
        { $set: { media_type: m.type ?? null, media_url: media ?? null, cover_url: cover ?? null } }
      );
      fixed += r.modifiedCount;
    }
  }
  return fixed;
}

// 3. Migrate source_id string -> int so the cursor sorts numerically.
const stringIds = await posts.countDocuments({ source: "bestdesignsonx", source_id: { $type: "string" } });
console.log(`source_id string->int conversions: ${stringIds}`);

if (!APPLY) { console.log("\nDry run complete. Re-run with --apply."); await client.close(); process.exit(0); }

if (toDelete.length) {
  for (let i = 0; i < toDelete.length; i += 5000) {
    const r = await posts.deleteMany({ _id: { $in: toDelete.slice(i, i + 5000) } });
    console.log(`  deleted ${r.deletedCount}`);
  }
}
await posts.updateMany(
  { source: "bestdesignsonx", status: "failed", failed_at: { $gte: new Date("2026-07-14") } },
  { $set: { status: "pending" }, $unset: { failed_at: "", last_error: "" } }
);
console.log("backfilling media...");
console.log(`  media repaired on ${await backfillMedia(needMedia)} rows`);

await posts.updateMany(
  { source: "bestdesignsonx", source_id: { $type: "string" } },
  [{ $set: { source_id: { $toInt: "$source_id" } } }]
);
// 4. Unique index makes re-inserts impossible from here on.
await posts.createIndex({ source: 1, source_id: 1 }, { unique: true });
console.log("done — unique index (source, source_id) created");

await client.close();
