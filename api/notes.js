// api/notes.js
import { connectToDatabase } from './_lib/mongodb.js';
import bcrypt from 'bcryptjs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export default async function handler(req, res) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { db } = await connectToDatabase();
    const notesCollection = db.collection('notes');

    // ----- GET /api/notes -----
    // Query params:
    //   q      : text search (title + content)
    //   sort   : 'recent' (default) | 'oldest' | 'title' | 'title_desc' | 'updated'
    //   limit  : 1..100 (default 20)
    //   cursor : ISO date string (createdAt or updatedAt depending on sort)
    // Response: { notes, nextCursor, total }
    if (req.method === 'GET') {
      try {
        const { q, sort = 'recent', limit: limitRaw, cursor } = req.query || {};
        const limit = Math.min(Math.max(parseInt(limitRaw, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

        const filter = {};
        if (q && q.trim()) {
          filter.$text = { $search: q.trim() };
        }

        // Sort strategy + cursor field
        let sortSpec;
        let cursorField;
        switch (sort) {
          case 'oldest':
            sortSpec = { createdAt: 1 };
            cursorField = 'createdAt';
            break;
          case 'title':
            sortSpec = { title: 1 };
            cursorField = 'title';
            break;
          case 'title_desc':
            sortSpec = { title: -1 };
            cursorField = 'title';
            break;
          case 'updated':
            sortSpec = { updatedAt: -1 };
            cursorField = 'updatedAt';
            break;
          case 'recent':
          default:
            sortSpec = { createdAt: -1 };
            cursorField = 'createdAt';
        }

        if (cursor) {
          const cursorVal = (cursorField === 'createdAt' || cursorField === 'updatedAt')
            ? new Date(cursor)
            : cursor;
          const op = (sort === 'oldest' || sort === 'title') ? '$gt' : '$lt';
          filter[cursorField] = { [op]: cursorVal };
        }

        // Exclude content from list payload — only fetch on view
        const projection = {
          password: 0,
          content: 0,
          shareToken: 0,
        };

        const total = await notesCollection.countDocuments(
          q && q.trim() ? { $text: { $search: q.trim() } } : {}
        );

        const docs = await notesCollection
          .find(filter, { projection })
          .sort(sortSpec)
          .limit(limit + 1) // +1 to detect "has more"
          .toArray();

        const hasMore = docs.length > limit;
        const page = hasMore ? docs.slice(0, limit) : docs;

        // Attach content length for the list preview (compute cheaply)
        // We don't have content (projection excludes it), so client shows
        // a small placeholder. To keep the existing UI working, we add a
        // separate lightweight aggregation only if explicitly requested.
        // For now, we simply omit and let the UI adapt.

        let nextCursor = null;
        if (hasMore && page.length > 0) {
          const last = page[page.length - 1];
          const val = last[cursorField];
          nextCursor = val instanceof Date ? val.toISOString() : val;
        }

        res.status(200).json({ notes: page, nextCursor, total, hasMore });
      } catch (error) {
        console.error('GET error:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
      }
      return;
    }

    // ----- POST /api/notes -----
    if (req.method === 'POST') {
      try {
        const { title, content, password } = req.body;

        if (!title || !content) {
          res.status(400).json({ error: 'Title and content are required' });
          return;
        }

        if (typeof title !== 'string' || title.length > 100) {
          res.status(400).json({ error: 'Title must be 100 characters or fewer' });
          return;
        }

        if (typeof content !== 'string' || content.length > 100000) {
          res.status(400).json({ error: 'Content is too large (max 100,000 characters)' });
          return;
        }

        if (!password || password.trim() === '') {
          res.status(400).json({ error: 'Password is required to create a note' });
          return;
        }

        if (password.length < 6) {
          res.status(400).json({ error: 'Password must be at least 6 characters long' });
          return;
        }

        const existingNote = await notesCollection.findOne({ title });
        if (existingNote) {
          res.status(400).json({ error: 'A note with this name already exists' });
          return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const note = {
          title,
          content,
          password: hashedPassword,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await notesCollection.insertOne(note);

        const { password: _, ...noteWithoutPassword } = note;
        res.status(201).json({
          ...noteWithoutPassword,
          _id: result.insertedId,
        });
      } catch (error) {
        console.error('POST error:', error);
        res.status(500).json({ error: 'Failed to create note' });
      }
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}