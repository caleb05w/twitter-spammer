import { TwitterApi, EUploadMimeType } from "twitter-api-v2";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { buildCaption, mediaUrl, downloadMedia } from "./social";
import type { Post } from "./types";

function getClient() {
  return new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
  });
}

async function uploadMedia(client: TwitterApi, post: Post): Promise<string | undefined> {
  const url = mediaUrl(post);
  if (!url) return undefined;
  const buffer = await downloadMedia(url);
  const mimeType = post.media_type === "video" ? EUploadMimeType.Mp4 : EUploadMimeType.Jpeg;
  return client.v1.uploadMedia(buffer, { mimeType });
}

export async function postById(postId: string, caption?: string): Promise<string> {
  const db = await getDb();
  const post = await db.collection<Post>("posts").findOne({ _id: new ObjectId(postId) });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const client = getClient();
  const mediaId = await uploadMedia(client, post);
  const tweet = await client.v2.tweet(
    caption ?? buildCaption(post),
    mediaId ? { media: { media_ids: [mediaId] } } : undefined
  );

  const tweetId = tweet.data.id;
  await db.collection("posts").updateOne(
    { _id: post._id },
    { $set: { status: "posted", posted_at: new Date(), tweet_id: tweetId } }
  );

  return tweetId;
}
