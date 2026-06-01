import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") || "pending";
  const db = await getDb();
  const posts = await db
    .collection("posts")
    .find({ status })
    .sort({ scraped_at: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json(posts.map((p) => ({ ...p, _id: p._id.toString() })));
}
