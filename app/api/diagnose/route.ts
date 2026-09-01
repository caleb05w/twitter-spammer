import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { Post } from "@/lib/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Read-only diagnosis of why posting stalled. Sits behind the password
// middleware like every other non-cron route, so it is reachable only once
// logged in. Purely diagnostic — it never writes.
export async function GET() {
  const db = await getDb();
  const posts = db.collection<Post>("posts");
  const since = (days: number) => new Date(Date.now() - days * 86_400_000);
  const daysAgo = (d?: Date) => (d ? Math.round((Date.now() - d.getTime()) / 86_400_000) : null);

  const settingsDoc =
    (await db.collection("settings").findOne({ _id: "global" as never })) ?? {};
  const settings = settingsDoc as Record<string, unknown>;

  // (A) The wedge: an approved post that never got retired blocks every later
  // run, because nextCandidate() always returns the approved queue first.
  const approvedCount = await posts.countDocuments({ status: "approved" });
  const approvedHead = await posts
    .find({ status: "approved" })
    .sort({ scraped_at: 1 })
    .limit(5)
    .toArray();

  // (B) Last thing that actually published, per platform.
  const lastPosted: Record<string, unknown> = {};
  for (const [label, field] of [
    ["x", "tweet_id"],
    ["threads", "threads_media_id"],
    ["instagram", "ig_media_id"],
  ] as const) {
    const last = await posts
      .find({ [field]: { $exists: true } })
      .sort({ posted_at: -1 })
      .limit(1)
      .next();
    lastPosted[label] = last?.posted_at
      ? { at: last.posted_at, daysAgo: daysAgo(last.posted_at), source: last.source }
      : "NEVER POSTED";
  }

  // (C) Retired posts and the verbatim platform errors — the actual answer.
  const failed = await posts
    .find({ status: "failed", failed_at: { $gte: since(60) } })
    .sort({ failed_at: -1 })
    .toArray();
  const errorCounts: Record<string, number> = {};
  const failedBySource: Record<string, number> = {};
  for (const f of failed) {
    const key = (f.last_error ?? "(no message)").slice(0, 200);
    errorCounts[key] = (errorCounts[key] ?? 0) + 1;
    failedBySource[f.source] = (failedBySource[f.source] ?? 0) + 1;
  }

  const byStatus: Record<string, number> = {};
  for (const r of await posts
    .aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }])
    .toArray())
    byStatus[String(r._id)] = r.n;

  const pendingBySource: Record<string, number> = {};
  for (const r of await posts
    .aggregate<{ _id: string; n: number }>([
      { $match: { status: "pending" } },
      { $group: { _id: "$source", n: { $sum: 1 } } },
    ])
    .toArray())
    pendingBySource[String(r._id)] = r.n;

  // Duplicate load and missing media — the damage from the frozen cursor.
  // Untyped handle: these filters match on null, which the Post type disallows.
  const raw = db.collection("posts");
  const totalRows = await raw.countDocuments({ source: "bestdesignsonx" });
  const [uniqueAgg] = await raw
    .aggregate<{ unique: number }>([
      { $match: { source: "bestdesignsonx" } },
      { $group: { _id: "$source_id" } },
      { $count: "unique" },
    ])
    .toArray();
  const uniqueSourceIds = uniqueAgg?.unique ?? 0;

  const missingMedia = await raw.countDocuments({
    source: "bestdesignsonx",
    status: { $in: ["pending", "approved"] },
    $or: [{ cover_url: null }, { cover_url: { $exists: false } }],
  });

  return NextResponse.json(
    {
      settings: {
        auto_run: settings.auto_run ?? "(unset -> false)",
        post_hours_threads: settings.post_hours_threads ?? "(unset -> [600])",
        post_hours_instagram: settings.post_hours_instagram ?? "(unset -> [660])",
        post_hours_x: settings.post_hours_x ?? "(unset -> [540])",
      },
      A_wedge: {
        approvedCount,
        head: approvedHead.map((p) => ({
          id: p._id.toString(),
          source: p.source,
          media_type: p.media_type,
          scrapedDaysAgo: daysAgo(p.scraped_at),
          media: p.media_type === "video" ? p.media_url : p.cover_url ?? p.media_url ?? null,
        })),
      },
      B_lastPosted: lastPosted,
      C_failures: {
        retiredInLast60d: failed.length,
        bySource: failedBySource,
        distinctErrors: Object.entries(errorCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([message, count]) => ({ count, message })),
        mostRecent: failed.slice(0, 5).map((f) => ({
          at: f.failed_at,
          source: f.source,
          error: f.last_error,
        })),
      },
      D_queue: {
        byStatus,
        pendingBySource,
        bestdesignsonx: {
          totalRows,
          uniqueSourceIds,
          duplicateRows: totalRows - uniqueSourceIds,
          pendingWithNoMedia: missingMedia,
        },
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
