import { ObjectId } from "mongodb";

export type Post = {
  _id: ObjectId;
  handle: string;
  author_name: string;
  tweet_url: string;
  tweet_text?: string;
  cover_url?: string;
  media_url?: string;
  media_type?: string;
  source: string;
  status: "pending" | "approved" | "rejected" | "posted";
  scraped_at: Date;
  ig_handle?: string;
  threads_handle?: string;
  posted_at?: Date;
  tweet_id?: string;
  ig_media_id?: string;
  threads_media_id?: string;
};
