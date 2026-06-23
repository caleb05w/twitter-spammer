import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { buildCaption, mediaUrl, waitForContainer } from "./social";
import type { Post } from "./types";

const GRAPH_URL = "https://graph.facebook.com/v21.0";
const USER_ID = process.env.IG_USER_ID!;
const TOKEN = process.env.IG_ACCESS_TOKEN!;

async function createContainer(post: Post, caption?: string): Promise<string> {
  const url = mediaUrl(post);
  if (!url) throw new Error("No media URL available for Instagram post");

  const params = new URLSearchParams({
    caption: caption ?? buildCaption(post),
    access_token: TOKEN,
    ...(post.media_type === "video"
      ? { video_url: url, media_type: "REELS" }
      : { image_url: url }),
  });

  const res = await fetch(`${GRAPH_URL}/${USER_ID}/media`, { method: "POST", body: params });
  const json = await res.json();
  if (!res.ok || json.error) {
    const e = json.error;
    throw new Error(e ? `IG API error (code ${e.code}/${e.error_subcode ?? "–"}): ${e.message}` : `Failed to create IG container (HTTP ${res.status})`);
  }
  return json.id;
}

async function publishContainer(containerId: string): Promise<string> {
  const params = new URLSearchParams({ creation_id: containerId, access_token: TOKEN });
  const res = await fetch(`${GRAPH_URL}/${USER_ID}/media_publish`, { method: "POST", body: params });
  const json = await res.json();
  if (!res.ok || json.error) {
    const e = json.error;
    throw new Error(e ? `IG API error (code ${e.code}/${e.error_subcode ?? "–"}): ${e.message}` : `Failed to publish IG post (HTTP ${res.status})`);
  }
  return json.id;
}

export async function postToInstagram(postId: string, caption?: string): Promise<string> {
  const db = await getDb();
  const post = await db.collection<Post>("posts").findOne({ _id: new ObjectId(postId) });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const containerId = await createContainer(post, caption);
  if (post.media_type === "video") await waitForContainer(containerId, TOKEN, GRAPH_URL, "status_code");

  const mediaId = await publishContainer(containerId);
  await db.collection("posts").updateOne(
    { _id: post._id },
    { $set: { status: "posted", posted_at: new Date(), ig_media_id: mediaId } }
  );
  return mediaId;
}
