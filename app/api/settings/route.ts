import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const DEFAULTS = {
  scrape_interval_hours: 6,
  post_hour_pst: 9,
};

const VALID_INTERVALS = new Set([1, 2, 4, 6, 12, 24]);

export async function GET() {
  const db = await getDb();
  const settings = await db.collection("settings").findOne({ _id: "global" as any });
  return NextResponse.json(settings ?? DEFAULTS);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { scrape_interval_hours, post_hour_pst } = body;

  if (scrape_interval_hours !== undefined && !VALID_INTERVALS.has(scrape_interval_hours)) {
    return NextResponse.json({ error: "Invalid scrape_interval_hours" }, { status: 400 });
  }
  if (post_hour_pst !== undefined && (!Number.isInteger(post_hour_pst) || post_hour_pst < 0 || post_hour_pst > 23)) {
    return NextResponse.json({ error: "Invalid post_hour_pst" }, { status: 400 });
  }

  const update: Record<string, number> = {};
  if (scrape_interval_hours !== undefined) update.scrape_interval_hours = scrape_interval_hours;
  if (post_hour_pst !== undefined) update.post_hour_pst = post_hour_pst;

  const db = await getDb();
  await db.collection("settings").updateOne(
    { _id: "global" as any },
    { $set: update },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}
