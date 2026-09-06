import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Add a check to make sure MONGODB_URI exists
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined. Please check your .env file.');
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}