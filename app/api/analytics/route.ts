import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  const db = await getDb();
  const posts = db.collection("posts");
  const runs = db.collection("scrape_runs");

  const [sources, statusCounts, recentPosts, lastRun, postedPosts] = await Promise.all([
    posts.aggregate([
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
      .limit(8)
      .toArray(),

    runs.findOne({}, { sort: { ran_at: -1 } }),

    posts.find({ status: "posted" })
      .sort({ posted_at: -1 })
      .limit(20)
      .toArray(),
  ]);

  return NextResponse.json({
    sources: sources.map((s) => ({
      ...s,
      lastPost: s.lastPost ? { ...s.lastPost, _id: s.lastPost._id.toString() } : null,
    })),
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
    recentPosts: recentPosts.map((p) => ({ ...p, _id: p._id.toString() })),
    postedPosts: postedPosts.map((p) => ({ ...p, _id: p._id.toString() })),
    lastRun: lastRun ? { ...lastRun, _id: lastRun._id.toString() } : null,
  });
}
