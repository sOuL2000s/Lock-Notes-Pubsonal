// api/notes.js
import { connectToDatabase } from './_lib/mongodb.js';
import bcrypt from 'bcryptjs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Snippet: return a small window of content around the first match.
// Used to show search-result previews in the list without shipping the
// full note body (which can be 100 KB) on every request.
function buildSnippet(content, query, maxLen = 160) {
  if (!content) return '';
  const raw = String(content);
  if (!query) return raw.slice(0, maxLen);

  const lower = raw.toLowerCase();
  const q = String(query).toLowerCase().trim();
  if (!q) return raw.slice(0, maxLen);

  // Prefer the first whole-word match; fall back to first substring.
  let idx = -1;
  const wordRe = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  const wordMatch = raw.match(wordRe);
  if (wordMatch) {
    idx = lower.indexOf(wordMatch[0].toLowerCase());
  }
  if (idx === -1) idx = lower.indexOf(q);
  if (idx === -1) return raw.slice(0, maxLen);

  const start = Math.max(0, idx - 60);
  const end = Math.min(raw.length, idx + q.length + 80);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < raw.length ? '…' : '';
  return prefix + raw.slice(start, end).replace(/\s+/g, ' ') + suffix;
}

// Build a Mongo filter for the search term. Prefers $text when a text index
// exists and the query is long enough; otherwise falls back to $regex over
// title + content. Returns { filter, useTextSearch }.
async function buildSearchFilter(notesCollection, trimmedQuery) {
  if (!trimmedQuery) return { filter: {}, useTextSearch: false };

  let useTextSearch = false;
  let filter = {};

  try {
    const indexes = await notesCollection.indexes();
    const hasTextIndex = indexes.some(
      (idx) => idx.key && Object.values(idx.key).includes('text')
    );

    // $text needs >= 3 chars for stemming to be useful; short queries use regex.
    if (hasTextIndex && trimmedQuery.length >= 3) {
      // Require ALL whitespace-separated terms (AND semantics). This gives
      // much more precise results than the default OR behaviour of $search.
      const terms = trimmedQuery.split(/\s+/).filter(Boolean);
      const phrase = terms.map((t) => `"${t.replace(/"/g, '')}"`).join(' ');
      filter.$text = { $search: phrase };
      useTextSearch = true;
    }
  } catch (e) {
    // Index check failed — fall through to regex
  }

  if (!useTextSearch) {
    const escaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    filter.$or = [{ title: re }, { content: re }];
  }

  return { filter, useTextSearch };
}

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
    // Response: { notes, nextCursor, total, hasMore }
    if (req.method === 'GET') {
      try {
        const { q, sort = 'recent', limit: limitRaw, cursor } = req.query || {};
        const limit = Math.min(
          Math.max(parseInt(limitRaw, 10) || DEFAULT_LIMIT, 1),
          MAX_LIMIT
        );

        const hasQuery = q && q.trim().length > 0;
        const trimmedQuery = hasQuery ? q.trim() : '';

        // Build the search filter (shared for the page + the total count).
        const { filter: searchFilter, useTextSearch } = await buildSearchFilter(
          notesCollection,
          trimmedQuery
        );

        // Clone the search filter for the page query (we'll add the cursor)
        // and keep a separate copy for countDocuments so pagination doesn't
        // affect the total.
        const pageFilter = { ...searchFilter };
        const totalFilter = searchFilter;

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
          const cursorVal =
            cursorField === 'createdAt' || cursorField === 'updatedAt'
              ? new Date(cursor)
              : cursor;
          const op = sort === 'oldest' || sort === 'title' ? '$gt' : '$lt';
          pageFilter[cursorField] = { [op]: cursorVal };
        }

        // Include content ONLY when there is a search query, so we can
        // generate snippets. Otherwise exclude it to keep list payloads small.
        const projection = hasQuery
          ? { password: 0, shareToken: 0 }
          : { password: 0, content: 0, shareToken: 0 };

        const total = await notesCollection.countDocuments(totalFilter);

        const query = notesCollection
          .find(pageFilter, { projection })
          .limit(limit + 1);

        if (useTextSearch) {
          // Sort by text relevance first, then by the chosen sort
          query.project({ score: { $meta: 'textScore' } });
          query.sort({ score: { $meta: 'textScore' }, ...sortSpec });
        } else {
          query.sort(sortSpec);
        }

        const docs = await query.toArray();

        const hasMore = docs.length > limit;
        const page = hasMore ? docs.slice(0, limit) : docs;

        // Build the response. When searching, replace `content` with a
        // short snippet so the client can highlight matches without the
        // full body ever leaving the server.
        const notes = page.map((doc) => {
          if (!hasQuery) return doc;
          const { content, ...rest } = doc;
          return {
            ...rest,
            snippet: buildSnippet(content, trimmedQuery),
          };
        });

        let nextCursor = null;
        if (hasMore && page.length > 0) {
          const last = page[page.length - 1];
          const val = last[cursorField];
          nextCursor = val instanceof Date ? val.toISOString() : val;
        }

        res.status(200).json({ notes, nextCursor, total, hasMore });
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