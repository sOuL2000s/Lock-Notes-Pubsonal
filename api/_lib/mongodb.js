// api/_lib/mongodb.js
import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;
let indexesReady = false;

export async function connectToDatabase() {
  if (cachedClient && cachedDb && indexesReady) {
    return { client: cachedClient, db: cachedDb };
  }

  if (cachedClient && cachedDb && !indexesReady) {
    await ensureIndexes(cachedDb);
    indexesReady = true;
    return { client: cachedClient, db: cachedDb };
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined. Please check your .env file.');
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);

  cachedClient = client;
  cachedDb = db;

  await ensureIndexes(db);
  indexesReady = true;

  return { client, db };
}

async function ensureIndexes(db) {
  try {
    const notes = db.collection('notes');
    // Unique title (case-sensitive, matching existing app behavior)
    await notes.createIndex({ title: 1 }, { unique: true });
    // Sort by createdAt / updatedAt for pagination
    await notes.createIndex({ createdAt: -1 });
    await notes.createIndex({ updatedAt: -1 });
    // Text index for server-side search across title + content
    await notes.createIndex(
      { title: 'text', content: 'text' },
      { name: 'notes_text_search', weights: { title: 5, content: 1 } }
    );
    // Share token lookup
    await notes.createIndex({ shareToken: 1 }, { sparse: true });

    // Versions collection
    const versions = db.collection('note_versions');
    await versions.createIndex({ noteId: 1, createdAt: -1 });

    // Password attempt throttle collection (self-cleaning via TTL)
    const attempts = db.collection('password_attempts');
    await attempts.createIndex({ key: 1 }, { unique: true });
    await attempts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  } catch (err) {
    // Index creation is best-effort; log and continue. A duplicate-title
    // error here would mean the DB already has duplicate titles from earlier
    // versions of the app — the app still works, we just skip the unique index.
    console.warn('[mongodb] ensureIndexes warning:', err.message);
  }
}