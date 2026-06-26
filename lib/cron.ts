import type { Db } from "mongodb";
import { getDb } from "./mongodb";
import type { Post } from "./types";

function getPtUtcOffsetMinutes(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  let ptH = parseInt(parts.find((p) => p.type === "hour")!.value);
  const ptM = parseInt(parts.find((p) => p.type === "minute")!.value);
  if (ptH === 24) ptH = 0;
  return (now.getUTCHours() * 60 + now.getUTCMinutes() - ptH * 60 - ptM + 1440) % 1440;
}

function inWindow(currentUtc: number, targets: number[], window = 4): boolean {
  return targets.some((t) => (currentUtc - t + 1440) % 1440 <= window);
}

// How many posts to attempt in a single run before giving up for this window.
// Lets the cron skip past un-postable posts (e.g. media a platform's servers
// can't fetch) and still deliver a good one, instead of wasting the window.
const MAX_TRIES_PER_RUN = 3;

// Pick the next post to attempt: the oldest approved one, or — when auto_run is
// on and nothing is approved — a random pending post promoted to approved.
// Posts marked "failed" drop out of both queries, so a retired post is never
// handed back here again.
async function nextCandidate(db: Db, autoRun: boolean): Promise<Post | null> {
  const approved = await db
    .collection<Post>("posts")
    .findOne({ status: "approved" }, { sort: { scraped_at: 1 } });
  if (approved) return approved;
  if (!autoRun) return null;

  const pending = await db.collection<Post>("posts").find({ status: "pending" }).limit(50).toArray();
  if (pending.length === 0) return null;
  const pick = pending[Math.floor(Math.random() * pending.length)];
  await db.collection("posts").updateOne({ _id: pick._id }, { $set: { status: "approved" } });
  return pick;
}

type CronResult = {
  skipped?: string;
  posted?: string;
  noQueue?: boolean;
  retired?: { id: string; error: string }[];
  failed?: { id: string; error: string }[];
};

export async function runCronPost(
  platformKey: "post_hours_x" | "post_hours_threads" | "post_hours_instagram",
  defaultPtMinutes: number,
  postFn: (id: string) => Promise<string>
): Promise<CronResult> {
  const db = await getDb();
  const settings = (await db.collection("settings").findOne({ _id: "global" as any })) ?? {};

  const ptTimes: number[] = (settings as Record<string, unknown>)[platformKey] as number[] ?? [defaultPtMinutes];
  const offset = getPtUtcOffsetMinutes();
  const utcTargets = ptTimes.map((m) => (m + offset) % 1440);
  const now = new Date();
  const currentUtc = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (!inWindow(currentUtc, utcTargets)) {
    return { skipped: `UTC ${currentUtc}m, targets ${JSON.stringify(utcTargets)}` };
  }

  const autoRun = !!(settings as Record<string, unknown>).auto_run;
  const retired: { id: string; error: string }[] = [];

  // Try a few posts: if one fails to send, retire it (status "failed") and move
  // on. Previously a failing post stayed "approved" and got retried every run
  // forever, silently blocking every post behind it — one bad post = total stall.
  for (let attempt = 0; attempt < MAX_TRIES_PER_RUN; attempt++) {
    const post = await nextCandidate(db, autoRun);
    if (!post) break;

    try {
      const resultId = await postFn(post._id.toString());
      return retired.length ? { posted: resultId, retired } : { posted: resultId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.collection("posts").updateOne(
        { _id: post._id },
        { $set: { status: "failed", failed_at: new Date(), last_error: message } }
      );
      retired.push({ id: post._id.toString(), error: message });
    }
  }

  return retired.length ? { failed: retired } : { noQueue: true };
}
