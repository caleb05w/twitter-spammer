import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const DEFAULTS = {
  scrape_interval_hours: 6,
  post_hour_pst: 9,
  post_hour_pst_threads: 10,
  post_hour_pst_instagram: 11,
  post_frequency_x: 1,
  post_frequency_threads: 1,
  post_frequency_instagram: 1,
};

const VALID_INTERVALS = new Set([1, 2, 4, 6, 12, 24]);

const VALIDATORS: Record<string, (v: unknown) => boolean> = {
  scrape_interval_hours: (v) => VALID_INTERVALS.has(v as number),
  post_hour_pst:           (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 23,
  post_hour_pst_threads:   (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 23,
  post_hour_pst_instagram: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 23,
  post_frequency_x:         (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 4,
  post_frequency_threads:   (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 4,
  post_frequency_instagram: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 4,
  ig_access_token:          (v) => typeof v === "string",
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
