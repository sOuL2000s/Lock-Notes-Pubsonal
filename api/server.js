import 'dotenv/config';
import express from 'express';
import { connectToDatabase } from './_lib/mongodb.js';
import noteHandler from './note.js';
import notesHandler from './notes.js';
import versionsHandler from './note/versions.js';
import restoreHandler from './note/restore.js';
import noteShareHandler from './note/share.js';
import shareHandler from './share.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

/**
 * Wrap a Vercel-style (req, res) handler so it works inside Express.
 *
 * The Vercel handler expects:
 *   req.method, req.query, req.body, req.headers, req.url
 *   res.status(code).json(data) / res.send(data) / res.end()
 *   res.setHeader(key, value)
 *
 * Express already provides most of these on res. The main gaps are:
 *   - res.status() returns `this` in Express, so chaining works.
 *   - res.json() / res.send() / res.end() all work.
 *   - res.setHeader() works.
 *
 * So we mostly just need a thin adapter for req (Express req already
 * has .method, .query, .body, .headers, .url) and we need to make sure
 * that if a handler returns without sending, we don't hang.
 *
 * The previous version had a bug: it created a `vercelRes` shim and
 * monkey-patched `res.setHeader`, but the shim's `.send`/`.end` set
 * `_sent` on the shim while the outer wrapper checked `vercelRes._sent`
 * — which is fine — but the shim's `.json` called `res.status(...).json(...)`
 * which could double-send if the handler also called `res.end()`. It
 * also didn't forward `res.getHeader`. This version is simpler and safer.
 */
function createVercelHandler(handler) {
  return async (req, res) => {
    try {
      // Express req already has: method, query, body, headers, url.
      // Vercel handlers sometimes read `req.query` as a plain object and
      // sometimes as a parsed object — Express gives us the parsed object,
      // which is what our handlers expect.
      await handler(req, res);

      // If the handler didn't send anything, return 404.
      if (!res.headersSent) {
        res.status(404).json({ error: 'Not found' });
      }
    } catch (error) {
      console.error('Handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: error.message,
        });
      }
    }
  };
}

// Routes — order matters: more specific first.
app.all('/api/note/versions', createVercelHandler(versionsHandler));
app.all('/api/note/restore', createVercelHandler(restoreHandler));
app.all('/api/note/share', createVercelHandler(noteShareHandler));
app.all('/api/share', createVercelHandler(shareHandler));
app.all('/api/note', createVercelHandler(noteHandler));
app.all('/api/notes', createVercelHandler(notesHandler));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Lock-Notes API is running',
    endpoints: {
      notes: '/api/notes',
      note: '/api/note?id=...',
      versions: '/api/note/versions?id=...',
      restore: '/api/note/restore?id=...',
      share: '/api/note/share?id=...',
      publicShare: '/api/share?token=...',
      health: '/api/health',
    },
  });
});

// Start server
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in .env file!');
      console.error('📝 Please create api/.env with:');
      console.error('   MONGODB_URI=your_mongodb_connection_string');
      console.error('   MONGODB_DB=note_app');
      process.exit(1);
    }

    await connectToDatabase();
    console.log('✅ Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`✅ API server running at http://localhost:${PORT}`);
      console.log(`📝 Notes endpoint: http://localhost:${PORT}/api/notes`);
      console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    console.error('💡 Make sure your MONGODB_URI is correct in api/.env');
    process.exit(1);
  }
}

startServer();