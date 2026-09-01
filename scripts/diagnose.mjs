// Read-only diagnosis of why THREADS stopped posting.
// Usage: MONGODB_URI="..." node scripts/diagnose.mjs
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("Set MONGODB_URI first."); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db();
const posts = db.collection("posts");

const s = await db.collection("settings").findOne({ _id: "global" });
console.log("\n=== SETTINGS ===");
console.log("auto_run:           ", s?.auto_run ?? "(unset -> false)");
console.log("post_hours_threads: ", s?.post_hours_threads ?? "(unset -> [600] = 10:00 PT)");

// (A) THE WEDGE: an approved post that never got retired blocks every later run.
console.log("\n=== (A) STUCK APPROVED QUEUE  [wedge check] ===");
const approved = await posts.find({ status: "approved" }).sort({ scraped_at: 1 }).limit(5).toArray();
console.log(`approved count: ${await posts.countDocuments({ status: "approved" })}`);
for (const a of approved) {
  const age = Math.round((Date.now() - a.scraped_at) / 86400000);
  console.log(` HEAD? ${a._id}  src=${a.source}  type=${a.media_type}  scraped ${age}d ago`);
  console.log(`        media=${(a.media_type === "video" ? a.media_url : a.cover_url || a.media_url) ?? "(none)"}`);
}
console.log("^ if the head is a VIDEO and this list is stable across runs, waitForContainer");
console.log("  is blowing maxDuration=300 and the post never gets marked failed.");

// (B) Last successful Threads post.
const last = await posts.find({ threads_media_id: { $exists: true } }).sort({ posted_at: -1 }).limit(1).next();
console.log("\n=== (B) LAST SUCCESSFUL THREADS POST ===");
console.log(last?.posted_at
  ? `${last.posted_at.toISOString()} (${Math.round((Date.now() - last.posted_at) / 86400000)}d ago)  source=${last.source}`
  : "NEVER POSTED");

// (C) Retired posts + verbatim platform errors.
const since = new Date(Date.now() - 60 * 86400000);
const failed = await posts.find({ status: "failed", failed_at: { $gte: since } }).sort({ failed_at: -1 }).toArray();
console.log(`\n=== (C) RETIRED IN LAST 60d: ${failed.length} ===`);
const bySrc = {}, byErr = {};
for (const f of failed) {
  bySrc[f.source] = (bySrc[f.source] ?? 0) + 1;
  const k = (f.last_error ?? "(no message)").slice(0, 150);
  byErr[k] = (byErr[k] ?? 0) + 1;
}
console.log("by source:", bySrc);
console.log("\n--- distinct errors, most common first ---");
for (const [m, n] of Object.entries(byErr).sort((a, b) => b[1] - a[1])) console.log(`\n[${n}x] ${m}`);

// (D) Did the July 14 80/20 reweight starve the working source?
console.log("\n=== (D) PENDING POOL BY SOURCE (what the 80/20 picker draws from) ===");
for (const r of await posts.aggregate([
  { $match: { status: "pending" } },
  { $group: { _id: "$source", n: { $sum: 1 } } }, { $sort: { n: -1 } },
]).toArray()) console.log(String(r._id).padEnd(18), r.n);

await client.close();
