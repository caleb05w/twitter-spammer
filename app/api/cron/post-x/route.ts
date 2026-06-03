import { NextRequest, NextResponse } from "next/server";
import { runCronPost } from "@/lib/cron";
import { postById } from "@/lib/poster";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runCronPost("post_hours_x", 540, postById);
  console.log("[cron/post-x]", result);
  return NextResponse.json(result);
}
