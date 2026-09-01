import { NextRequest, NextResponse } from "next/server";
import { runCronPost } from "@/lib/cron";
import { postToInstagram } from "@/lib/instagram";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runCronPost("post_hours_instagram", 660, postToInstagram);
    console.log("[cron/post-instagram]", result);
    // Surface a fully-failed run as a 5xx so Vercel's cron monitoring flags it.
    // Returning 200 here is why a month of dead posting went unnoticed.
    return NextResponse.json(result, { status: result.failed ? 500 : 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/post-instagram] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
