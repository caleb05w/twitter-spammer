import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { postById } from "@/lib/poster";
import { postToInstagram } from "@/lib/instagram";
import { postToThreads } from "@/lib/threads";
import { isValidObjectId } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const platform: string = body?.platform ?? "twitter";
  const caption: string | undefined = body?.caption || undefined;
  try {
    if (platform === "instagram") {
      const mediaId = await postToInstagram(id, caption);
      return NextResponse.json({ ok: true, ig_media_id: mediaId });
    } else if (platform === "threads") {
      const mediaId = await postToThreads(id, caption);
      return NextResponse.json({ ok: true, threads_media_id: mediaId });
    } else {
      const tweetId = await postById(id, caption);
      return NextResponse.json({ ok: true, tweet_id: tweetId });
    }
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
  const body = await req.json();
  const update: Record<string, any> = {};
  if (body.status !== undefined) {
    if (!["approved", "rejected"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = body.status;
  }
  if (body.tweet_text !== undefined) update.tweet_text = String(body.tweet_text);
  if (body.ig_handle !== undefined) update.ig_handle = String(body.ig_handle).replace(/^@/, "");
  if (body.threads_handle !== undefined) update.threads_handle = String(body.threads_handle).replace(/^@/, "");
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const db = await getDb();
  await db.collection("posts").updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );
  return NextResponse.json({ ok: true });
}
