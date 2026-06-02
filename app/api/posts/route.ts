import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") || "pending";
  const source = searchParams.get("source");

  const db = await getDb();
  const collection = db.collection("posts");

  const query: Record<string, any> = { status };
  if (source) query.source = source;

  const [posts, sources] = await Promise.all([
    collection.find(query).sort({ scraped_at: -1 }).limit(50).toArray(),
    collection.distinct("source", { status }),
  ]);

  return NextResponse.json({
    posts: posts.map((p) => ({ ...p, _id: p._id.toString() })),
    sources: sources.filter(Boolean).sort(),
  });
}
