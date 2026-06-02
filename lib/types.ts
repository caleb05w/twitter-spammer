import { ObjectId } from "mongodb";

export type Post = {
  _id: ObjectId;
  handle: string;
  media_type?: string;
  media_url?: string;
  cover_url?: string;
  tweet_text?: string;
};
