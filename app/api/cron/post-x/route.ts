import { NextRequest, NextResponse } from "next/server";
import { runCronPost } from "@/lib/cron";
import { postById, X_POSTING_DISABLED } from "@/lib/poster";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (X_POSTING_DISABLED) {
    return NextResponse.json({ skipped: "x posting temporarily disabled" });
  }
  try {
    const result = await runCronPost("post_hours_x", 540, postById);
    console.log("[cron/post-x]", result);
    // Surface a fully-failed run as a 5xx so Vercel's cron monitoring flags it.
    // Returning 200 here is why a month of dead posting went unnoticed.
    return NextResponse.json(result, { status: result.failed ? 500 : 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/post-x] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
