import { NextRequest, NextResponse } from "next/server";
import { runCronPost } from "@/lib/cron";
import { postToThreads } from "@/lib/threads";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runCronPost("post_hours_threads", 600, postToThreads);
  console.log("[cron/post-threads]", result);
  return NextResponse.json(result);
}
