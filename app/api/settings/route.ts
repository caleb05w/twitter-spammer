import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const DEFAULTS = {
  scrape_interval_hours: 6,
  post_hours_x:         [540],   // 9:00 AM PST
  post_hours_threads:   [600],   // 10:00 AM PST
  post_hours_instagram: [660],   // 11:00 AM PST
  auto_run:             false,
};

const VALID_INTERVALS = new Set([1, 2, 4, 6, 12, 24]);

// Time stored as minutes from midnight (PST). Must be multiples of 30, 0–1410.
function isTimeArray(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length >= 1 &&
    v.length <= 6 &&
    v.every((m) => Number.isInteger(m) && m >= 0 && m <= 1410 && m % 30 === 0)
  );
}

const VALIDATORS: Record<string, (v: unknown) => boolean> = {
  scrape_interval_hours: (v) => VALID_INTERVALS.has(v as number),
  post_hours_x:          isTimeArray,
  post_hours_threads:    isTimeArray,
  post_hours_instagram:  isTimeArray,
  ig_access_token:       (v) => typeof v === "string",
  auto_run:              (v) => typeof v === "boolean",
};

export async function GET() {
  const db = await getDb();
  const settings = await db.collection("settings").findOne({ _id: "global" as any });
  const data: Record<string, unknown> = { ...DEFAULTS, ...(settings ?? {}) };
  return NextResponse.json({ ...data, ig_token_set: !!data.ig_access_token });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const update: Record<string, unknown> = {};

  for (const [key, validate] of Object.entries(VALIDATORS)) {
    const val = body[key];
    if (val === undefined) continue;
    if (!validate(val)) return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
    update[key] = key === "ig_access_token" ? (val as string).trim() : val;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("settings").updateOne(
    { _id: "global" as any },
    { $set: update },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}
