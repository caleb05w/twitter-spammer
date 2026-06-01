import { TwitterApi, EUploadMimeType } from "twitter-api-v2";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";

type Post = {
  _id: ObjectId;
  handle: string;
  media_type?: string;
  media_url?: string;
  cover_url?: string;
};

function getClient() {
  return new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
  });
}

async function downloadMedia(url: string): Promise<Buffer> {
  const headers: Record<string, string> = {};
  if (url.includes("b-cdn.net") || url.includes("details.so")) {
    headers["Referer"] = "https://www.details.so";
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to download media: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadMedia(client: TwitterApi, post: Post): Promise<string | undefined> {
  const isVideo = post.media_type === "video";
  const url = isVideo ? post.media_url : (post.media_url || post.cover_url);
  if (!url) return undefined;

  const buffer = await downloadMedia(url);
  const mimeType = isVideo ? EUploadMimeType.Mp4 : EUploadMimeType.Jpeg;
  return client.v1.uploadMedia(buffer, { mimeType });
}

export async function postById(postId: string): Promise<string> {
  const db = await getDb();
  const post = await db.collection<Post>("posts").findOne({ _id: new ObjectId(postId) });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const client = getClient();
  const caption = `Design by @${post.handle}`;

  const mediaId = await uploadMedia(client, post);
  const tweet = await client.v2.tweet(
    caption,
    mediaId ? { media: { media_ids: [mediaId] } } : undefined
  );

  const tweetId = tweet.data.id;
  await db.collection("posts").updateOne(
    { _id: post._id },
    { $set: { status: "posted", posted_at: new Date(), tweet_id: tweetId } }
  );

  return tweetId;
}
