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

export async function runCronPost(
  platformKey: "post_hours_x" | "post_hours_threads" | "post_hours_instagram",
  defaultPtMinutes: number,
  postFn: (id: string) => Promise<string>
): Promise<{ skipped?: string; posted?: string; noQueue?: boolean }> {
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

  let post = await db
    .collection<Post>("posts")
    .findOne({ status: "approved" }, { sort: { scraped_at: 1 } });

  if (!post && (settings as Record<string, unknown>).auto_run) {
    const pending = await db.collection<Post>("posts").find({ status: "pending" }).limit(50).toArray();
    if (pending.length > 0) {
      post = pending[Math.floor(Math.random() * pending.length)];
      await db.collection("posts").updateOne({ _id: post._id }, { $set: { status: "approved" } });
    }
  }

  if (!post) return { noQueue: true };

  const resultId = await postFn(post._id.toString());
  return { posted: resultId };
}
