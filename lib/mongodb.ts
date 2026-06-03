import { MongoClient } from "mongodb";

let client: MongoClient | null = null;
let connectionPromise: Promise<MongoClient> | null = null;

export async function getDb() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI);
    connectionPromise = client.connect();
  }
  await connectionPromise;
  return client!.db("design-scrape");
}
