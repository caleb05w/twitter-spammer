import { NextRequest, NextResponse } from "next/server";
import { refreshInstagramToken, refreshThreadsToken } from "@/lib/tokens";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Daily. Keeps the Threads token inside its 60-day refresh window and swaps
// the Instagram user token for a non-expiring Page token. See lib/tokens.ts.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [threads, instagram] = await Promise.all([refreshThreadsToken(), refreshInstagramToken()]);
  const result = { threads, instagram };
  console.log("[cron/refresh-tokens]", result);
  const failed = threads.status === "failed" || instagram.status === "failed";
  return NextResponse.json(result, { status: failed ? 500 : 200 });
}
