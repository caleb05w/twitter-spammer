import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { buildCaption, mediaUrl, waitForContainer } from "./social";
import type { Post } from "./types";

const GRAPH_URL = "https://graph.threads.net/v1.0";
const USER_ID = process.env.THREADS_USER_ID!;
const TOKEN = process.env.THREADS_ACCESS_TOKEN!;

async function createContainer(post: Post, caption?: string): Promise<string> {
  const url = mediaUrl(post);
  const params = new URLSearchParams({ text: caption ?? buildCaption(post), access_token: TOKEN });

  if (url && post.media_type === "video") {
    params.set("media_type", "VIDEO");
    params.set("video_url", url);
  } else if (url) {
    params.set("media_type", "IMAGE");
    params.set("image_url", url);
  } else {
    params.set("media_type", "TEXT");
  }

  const res = await fetch(`${GRAPH_URL}/${USER_ID}/threads`, { method: "POST", body: params });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message ?? "Failed to create Threads container");
  return json.id;
}

async function publishContainer(containerId: string): Promise<string> {
  const params = new URLSearchParams({ creation_id: containerId, access_token: TOKEN });
  const res = await fetch(`${GRAPH_URL}/${USER_ID}/threads_publish`, { method: "POST", body: params });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message ?? "Failed to publish Threads post");
  return json.id;
}

export async function postToThreads(postId: string, caption?: string): Promise<string> {
  const db = await getDb();
  const post = await db.collection<Post>("posts").findOne({ _id: new ObjectId(postId) });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const containerId = await createContainer(post, caption);
  if (post.media_type === "video") await waitForContainer(containerId, TOKEN, GRAPH_URL, "status");

  const mediaId = await publishContainer(containerId);
  await db.collection("posts").updateOne(
    { _id: post._id },
    { $set: { status: "posted", posted_at: new Date(), threads_media_id: mediaId } }
  );
  return mediaId;
}
