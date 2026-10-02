// api/notes.js
import { connectToDatabase } from './_lib/mongodb.js';
import bcrypt from 'bcryptjs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Minimum relevance score for $text results. Set to 0 to disable the
// threshold entirely. Tune with real data.
const MIN_TEXT_SCORE = 0;

/**
 * Build a Mongo filter for the search term.
 *
 * Modes:
 *   - 'all'    (default): every whitespace-separated term must appear (AND).
 *   - 'phrase'          : the entire query must appear as a contiguous phrase.
 *   - 'any'             : any one of the terms may appear (OR).
 *
 * Prefers the $text index when available (>= 3-char queries). Falls back
 * to word-boundary-anchored regex so that searching for "cat" does NOT
 * match "concatenate" or "scatter".
 *
 * Returns { filter, useTextSearch }.
 */
async function buildSearchFilter(notesCollection, trimmedQuery, mode = 'any') {
  if (!trimmedQuery) return { filter: {}, useTextSearch: false };

  const terms = trimmedQuery.split(/\s+/).filter(Boolean);

  // ----- 1) Prefer the $text index --------------------------------
  let hasTextIndex = false;
  try {
    const indexes = await notesCollection.indexes();
    hasTextIndex = indexes.some(
      (idx) => idx.key && Object.values(idx.key).includes('text')
    );
  } catch (e) {
    hasTextIndex = false;
  }

  if (hasTextIndex && trimmedQuery.length >= 3) {
    let searchString;
    if (mode === 'phrase' || terms.length === 1) {
      // Exact phrase — MongoDB treats "foo bar" as a phrase.
      searchString = `"${trimmedQuery.replace(/"/g, '')}"`;
    } else if (mode === 'any') {
      // OR — space-separated terms default to OR in $text.
      searchString = terms.map((t) => t.replace(/"/g, '')).join(' ');
    } else {
      // 'all' (default) — AND of every term.
      searchString = terms.map((t) => `"${t.replace(/"/g, '')}"`).join(' ');
    }
    return {
      filter: { $text: { $search: searchString } },
      useTextSearch: true,
    };
  }

  // ----- 2) Regex fallback (word-boundary anchored) ---------------
  const escapedTerms = terms.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  if (mode === 'phrase' || terms.length === 1) {
    // Whole phrase, word-boundary anchored. \b works for ASCII terms.
    const re = new RegExp(`\\b${escapedTerms.join('\\s+')}\\b`, 'i');
    return {
      filter: { $or: [{ title: re }, { content: re }] },
      useTextSearch: false,
    };
  }

  if (mode === 'any') {
    const res = escapedTerms.map((t) => new RegExp(`\\b${t}\\b`, 'i'));
    return {
      filter: { $or: res.flatMap((re) => [{ title: re }, { content: re }]) },
      useTextSearch: false,
    };
  }

  // 'all' — every term must appear (AND), each word-boundary anchored.
  const res = escapedTerms.map((t) => new RegExp(`\\b${t}\\b`, 'i'));
  return {
    filter: {
      $and: res.map((re) => ({ $or: [{ title: re }, { content: re }] })),
    },
    useTextSearch: false,
  };
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
    //   mode   : 'all' (default) | 'phrase' | 'any'
    //   sort   : 'recent' (default) | 'oldest' | 'title' | 'title_desc' | 'updated'
    //   limit  : 1..100 (default 20)
    //   cursor : ISO date string (createdAt or updatedAt depending on sort)
    //
    // Response: { notes, nextCursor, total, hasMore }
    //
    // IMPORTANT — SECURITY MODEL:
    //   Every note in this app is password-protected by design (the POST
    //   handler enforces this). Therefore we NEVER ship note `content`
    //   over the wire from this endpoint — not in the list view, not in
    //   the search view, not ever. The client must call GET /api/note?id=…
    //   and then POST /api/note?id=… with the password to actually read
    //   any note's body.
    //
    //   Search matches ARE reported (so the user can find notes), but
    //   without any snippet text. The client renders a lock badge instead.
    if (req.method === 'GET') {
      try {
        const {
          q,
          sort = 'recent',
          limit: limitRaw,
          cursor,
          mode = 'any',
        } = req.query || {};

        const limit = Math.min(
          Math.max(parseInt(limitRaw, 10) || DEFAULT_LIMIT, 1),
          MAX_LIMIT
        );

        const hasQuery = q && q.trim().length > 0;
        const trimmedQuery = hasQuery ? q.trim() : '';
        const safeMode = ['all', 'any', 'phrase'].includes(mode) ? mode : 'any';

        // Build the search filter (shared for the page + the total count).
        const { filter: searchFilter, useTextSearch } = await buildSearchFilter(
          notesCollection,
          trimmedQuery,
          safeMode
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

        // ------------------------------------------------------------------
        // SECURITY: NEVER project `content` or `password`. We only need the
        // metadata fields the UI actually uses. `shareToken` is also hidden.
        // ------------------------------------------------------------------
        const projection = {
          password: 0,
          content: 0,
          shareToken: 0,
        };

        const total = await notesCollection.countDocuments(totalFilter);

        const query = notesCollection
          .find(pageFilter, { projection })
          .limit(limit + 1);

        if (useTextSearch) {
          // Sort by text relevance first, then by the chosen sort.
          query.project({ score: { $meta: 'textScore' } });
          query.sort({ score: { $meta: 'textScore' }, ...sortSpec });
        } else {
          query.sort(sortSpec);
        }

        const docs = await query.toArray();

        // If we did a text search, drop low-relevance results.
        let filtered = docs;
        if (useTextSearch && MIN_TEXT_SCORE > 0) {
          filtered = docs.filter((d) => (d.score ?? 1) >= MIN_TEXT_SCORE);
          // If filtering removed everything, fall back to unfiltered so the
          // user isn't left staring at an empty list for a valid query.
          if (filtered.length === 0 && docs.length > 0) {
            filtered = docs;
          }
        }

        const hasMore = filtered.length > limit;
        const page = hasMore ? filtered.slice(0, limit) : filtered;

        // ------------------------------------------------------------------
        // Build the response with STRICT content protection.
        //
        // Since every note is password-protected, we:
        //   - ALWAYS set `hasPassword: true` (it's an invariant of the app)
        //   - NEVER include `content` or a `snippet`
        //   - When searching, mark the note with `protectedMatch: true` so
        //     the UI can render "🔒 MATCH INSIDE ENCRYPTED NOTE" instead
        //     of a snippet.
        // ------------------------------------------------------------------
        const notes = page.map((doc) => {
          const { score, ...rest } = doc;
          const out = {
            ...rest,
            hasPassword: true,
          };
          if (hasQuery) {
            out.protectedMatch = true;
            out.snippet = null;
          }
          return out;
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

        const { password: _, content: _c, ...noteWithoutSecrets } = note;
        res.status(201).json({
          ...noteWithoutSecrets,
          hasPassword: true,
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