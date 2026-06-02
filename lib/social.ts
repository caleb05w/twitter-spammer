import { isCdnUrl } from "./utils";

type SocialPost = {
  handle: string;
  media_type?: string;
  media_url?: string;
  cover_url?: string;
  tweet_text?: string;
};

export function buildCaption(post: SocialPost): string {
  return post.tweet_text
    ? `${post.tweet_text}\n\nby @${post.handle}`
    : `Design by @${post.handle}`;
}

export function mediaUrl(post: SocialPost): string | undefined {
  return post.media_type === "video"
    ? post.media_url
    : (post.cover_url || post.media_url);
}

export async function downloadMedia(url: string): Promise<Buffer> {
  const headers: Record<string, string> = {};
  if (isCdnUrl(url)) headers["Referer"] = "https://www.details.so";
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to download media: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function waitForContainer(
  containerId: string,
  token: string,
  baseUrl: string,
  statusField: "status_code" | "status",
  timeoutMs = 120_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/${containerId}?fields=${statusField}&access_token=${token}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    const status = json[statusField];
    if (status === "FINISHED") return;
    if (status === "ERROR") throw new Error(`Container processing failed`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Timed out waiting for media container");
}
