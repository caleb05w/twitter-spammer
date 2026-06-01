import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { postById } from "@/lib/poster";

function isValidObjectId(id: string) {
  return /^[0-9a-f]{24}$/.test(id);
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }
  try {
    const tweetId = await postById(id);
    return NextResponse.json({ ok: true, tweet_id: tweetId });
  } catch (error: any) {
    console.error("Post failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }
  const { status } = await req.json();
  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const db = await getDb();
  await db.collection("posts").updateOne(
    { _id: new ObjectId(id) },
    { $set: { status } }
  );
  return NextResponse.json({ ok: true });
}
