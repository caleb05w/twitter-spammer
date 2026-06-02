import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// Normalize source names for matching: "details.so" ↔ "details_so"
function normalizeSource(s: string) {
  return s.replace(/\./g, "_");
}

export async function GET() {
  const db = await getDb();
  const posts = db.collection("posts");
  const runs = db.collection("scrape_runs");

  const [sources, statusCounts, recentPosts, recentRuns, postedPosts] = await Promise.all([
    posts.aggregate([
      { $match: { source: { $ne: null } } },
      {
        $group: {
          _id: "$source",
          total: { $sum: 1 },
          lastScraped: { $max: "$scraped_at" },
          lastPost: { $first: "$$ROOT" },
        },
      },
      { $sort: { lastScraped: -1 } },
    ]).toArray(),

    posts.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).toArray(),

    posts.find({})
      .sort({ scraped_at: -1 })
      .limit(10)
      .toArray(),

    runs.find({}).sort({ ran_at: -1 }).limit(20).toArray(),

    posts.find({ status: "posted" })
      .sort({ posted_at: -1 })
      .limit(20)
      .toArray(),

  ]);

  // Derive last-run-per-source from already-fetched recentRuns — no extra DB round-trip
  const lastRunMap: Record<string, Date> = {};
  for (const r of recentRuns) {
    const key = normalizeSource(r.source);
    if (!lastRunMap[key] || r.ran_at > lastRunMap[key]) lastRunMap[key] = r.ran_at;
  }

  return NextResponse.json({
    sources: sources.map((s) => ({
      ...s,
      // Use last run time from scrape_runs; fall back to last post's scraped_at
      lastScraped: (lastRunMap[normalizeSource(s._id)] ?? s.lastScraped)?.toISOString?.() ?? s.lastScraped,
      lastPost: s.lastPost ? { ...s.lastPost, _id: s.lastPost._id.toString() } : null,
    })),
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
    recentPosts: recentPosts.map((p) => ({ ...p, _id: p._id.toString() })),
    postedPosts: postedPosts.map((p) => ({ ...p, _id: p._id.toString() })),
    recentRuns: recentRuns.map((r) => ({ ...r, _id: r._id.toString() })),
  });
}
