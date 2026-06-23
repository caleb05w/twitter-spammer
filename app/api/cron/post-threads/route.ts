import { NextRequest, NextResponse } from "next/server";
import { runCronPost } from "@/lib/cron";
import { postToThreads } from "@/lib/threads";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runCronPost("post_hours_threads", 600, postToThreads);
    console.log("[cron/post-threads]", result);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/post-threads] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
