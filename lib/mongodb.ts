import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

const client = new MongoClient(uri);
let connectionPromise: Promise<MongoClient> | null = null;

export async function getDb() {
  if (!connectionPromise) {
    connectionPromise = client.connect();
  }
  await connectionPromise;
  return client.db("design-scrape");
}
