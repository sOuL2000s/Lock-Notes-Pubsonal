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
  const notes = db.collection('notes');

  // Unique title (case-sensitive, matching existing app behavior).
  // If the DB already has duplicate titles from earlier app versions,
  // MongoDB will refuse to build this index. That's fine — we skip and
  // continue so the rest of the app still works.
  try {
    await notes.createIndex({ title: 1 }, { unique: true });
  } catch (err) {
    console.warn('[mongodb] unique title index skipped:', err.message);
  }

  // Sort indexes used by pagination.
  try {
    await notes.createIndex({ createdAt: -1 });
    await notes.createIndex({ updatedAt: -1 });
  } catch (err) {
    console.warn('[mongodb] sort index warning:', err.message);
  }

  // Share token lookup (sparse — only docs that actually have a token).
  try {
    await notes.createIndex({ shareToken: 1 }, { sparse: true });
  } catch (err) {
    console.warn('[mongodb] share token index warning:', err.message);
  }

  // ------------------------------------------------------------------
  // Text index — THIS IS THE MOST IMPORTANT ONE for search quality.
  // Without it, every search falls back to substring regex, which is
  // the primary cause of "why do I see so many results?".
  //
  // We do NOT swallow real errors here. If the text index cannot be
  // built, we log loudly so it's obvious in production logs.
  // ------------------------------------------------------------------
  try {
    await notes.createIndex(
      { title: 'text', content: 'text' },
      { name: 'notes_text_search', weights: { title: 5, content: 1 } }
    );
    console.log('[mongodb] text index ready');
  } catch (err) {
    // A pre-existing text index with a different name/definition makes
    // MongoDB throw an options conflict. That is NOT a failure — the
    // existing index serves the same purpose. Any other error is real.
    const code = err.code || err.codeName;
    if (
      code === 85 || // IndexOptionsConflict
      code === 86 || // IndexKeySpecsConflict
      code === 'IndexOptionsConflict' ||
      code === 'IndexKeySpecsConflict'
    ) {
      console.log('[mongodb] text index already exists (different name), reusing');
    } else {
      console.error('[mongodb] FAILED to create text index:', err.message);
      console.error('[mongodb] search will fall back to regex until this is fixed');
    }
  }

  // Versions collection indexes.
  try {
    const versions = db.collection('note_versions');
    await versions.createIndex({ noteId: 1, createdAt: -1 });
  } catch (err) {
    console.warn('[mongodb] versions index warning:', err.message);
  }

  // Password attempt throttle — unique key + TTL self-cleanup.
  try {
    const attempts = db.collection('password_attempts');
    await attempts.createIndex({ key: 1 }, { unique: true });
    await attempts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  } catch (err) {
    console.warn('[mongodb] attempts index warning:', err.message);
  }
}