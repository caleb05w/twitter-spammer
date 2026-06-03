import { NextRequest, NextResponse } from "next/server";
import { runCronPost } from "@/lib/cron";
import { postToInstagram } from "@/lib/instagram";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runCronPost("post_hours_instagram", 660, postToInstagram);
  console.log("[cron/post-instagram]", result);
  return NextResponse.json(result);
}
