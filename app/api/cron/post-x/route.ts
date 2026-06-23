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
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/post-x] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
