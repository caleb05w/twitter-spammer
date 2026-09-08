import { NextResponse } from "next/server";
import { refreshInstagramToken, refreshThreadsToken } from "@/lib/tokens";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Manual trigger for the same work the daily refresh-tokens cron does. Behind
// the password middleware, so it is reachable only once logged in. Use it right
// after pasting a freshly minted token into Vercel instead of waiting a day.
export async function POST() {
  const [threads, instagram] = await Promise.all([refreshThreadsToken(), refreshInstagramToken()]);
  const failed = threads.status === "failed" || instagram.status === "failed";
  return NextResponse.json({ threads, instagram }, { status: failed ? 500 : 200 });
}
