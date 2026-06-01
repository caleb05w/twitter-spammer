import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const DEFAULTS = {
  scrape_interval_hours: 6,
  post_hour_pst: 9,
};

export async function GET() {
  const db = await getDb();
  const settings = await db.collection("settings").findOne({ _id: "global" as any });
  return NextResponse.json(settings ?? DEFAULTS);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const db = await getDb();
  await db.collection("settings").updateOne(
    { _id: "global" as any },
    { $set: body },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}
