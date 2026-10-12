import "server-only";
import { MongoClient } from "mongodb";
import { env, isMongoConfigured } from "@/lib/env";

// Next.js dev reloads this module on every edit, which would otherwise open
// a fresh connection each time. Cache the client/connect promise on
// `globalThis` so hot-reloads (and concurrent cold starts on Vercel) reuse
// the same connection instead of leaking sockets.
const globalForMongo = globalThis as unknown as { _mongoClientPromise?: Promise<MongoClient> };

function connect(): Promise<MongoClient> {
  const client = new MongoClient(env.mongodbUri!);
  return client.connect();
}

export function getMongoClientPromise(): Promise<MongoClient> | null {
  if (!isMongoConfigured) return null;
  if (!globalForMongo._mongoClientPromise) {
    globalForMongo._mongoClientPromise = connect();
  }
  return globalForMongo._mongoClientPromise;
}

export async function getMongoDb() {
  const clientPromise = getMongoClientPromise();
  if (!clientPromise) return null;
  const client = await clientPromise;
  return client.db(env.mongodbDbName);
}
