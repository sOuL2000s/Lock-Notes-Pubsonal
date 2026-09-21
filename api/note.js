// api/note.js
import { connectToDatabase } from './_lib/mongodb.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 30 * 1000;

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

  const { id } = req.query;

  if (!id || !ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Valid Note ID is required' });
    return;
  }

  try {
    const { db } = await connectToDatabase();
    const notesCollection = db.collection('notes');
    const versionsCollection = db.collection('note_versions');
    const attemptsCollection = db.collection('password_attempts');

    // Helper: throttle failed password verifications per (noteId, ip)
    const ipRaw = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '';
    const ip = String(ipRaw).split(',')[0].trim() || 'unknown';
    const attemptKey = `${id}:${ip}`;

    const checkThrottle = async () => {
      const rec = await attemptsCollection.findOne({ key: attemptKey });
      if (!rec) return { locked: false };
      if (rec.count >= MAX_ATTEMPTS && new Date(rec.expiresAt) > new Date()) {
        return { locked: true, until: rec.expiresAt };
      }
      return { locked: false };
    };

    const recordFailure = async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + LOCK_WINDOW_MS);
      await attemptsCollection.updateOne(
        { key: attemptKey },
        {
          $inc: { count: 1 },
          $set: { expiresAt, updatedAt: now },
          $setOnInsert: { key: attemptKey, createdAt: now },
        },
        { upsert: true }
      );
    };

    const clearFailures = async () => {
      await attemptsCollection.deleteOne({ key: attemptKey });
    };

    // ----- GET /api/note?id=... -----
    if (req.method === 'GET') {
      try {
        const note = await notesCollection.findOne({ _id: new ObjectId(id) });
        if (!note) {
          res.status(404).json({ error: 'Note not found' });
          return;
        }
        const hasPassword = !!(note.password && note.password !== '');
        const { password, ...rest } = note;
        res.status(200).json({ ...rest, hasPassword });
      } catch (error) {
        console.error('GET error:', error);
        res.status(500).json({ error: 'Failed to fetch note' });
      }
      return;
    }

    // ----- POST /api/note?id=... (verify password) -----
    if (req.method === 'POST') {
      try {
        const throttle = await checkThrottle();
        if (throttle.locked) {
          res.status(429).json({
            error: 'Too many failed attempts. Try again later.',
            retryAfter: Math.ceil((new Date(throttle.until) - Date.now()) / 1000),
          });
          return;
        }

        const { password } = req.body || {};
        if (!password) {
          res.status(401).json({ error: 'Password required' });
          return;
        }

        const note = await notesCollection.findOne({ _id: new ObjectId(id) });
        if (!note) {
          res.status(404).json({ error: 'Note not found' });
          return;
        }

        const isValid = await bcrypt.compare(password, note.password);
        if (!isValid) {
          await recordFailure();
          res.status(401).json({ error: 'Invalid password' });
          return;
        }

        await clearFailures();
        res.status(200).json({
          valid: true,
          version: note.version || 1,
          updatedAt: note.updatedAt,
        });
      } catch (error) {
        console.error('POST verify error:', error);
        res.status(500).json({ error: 'Failed to verify password' });
      }
      return;
    }

    // ----- PUT /api/note?id=... -----
    // Body: { title, content, password?, currentPassword, expectedVersion? }
    // If expectedVersion is provided and doesn't match, returns 409 with server copy.
    if (req.method === 'PUT') {
      try {
        const {
          title,
          content,
          password,
          currentPassword,
          expectedVersion,
        } = req.body || {};

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

        const note = await notesCollection.findOne({ _id: new ObjectId(id) });
        if (!note) {
          res.status(404).json({ error: 'Note not found' });
          return;
        }

        if (!currentPassword) {
          res.status(401).json({ error: 'Password required to update this note' });
          return;
        }

        const throttle = await checkThrottle();
        if (throttle.locked) {
          res.status(429).json({
            error: 'Too many failed attempts. Try again later.',
            retryAfter: Math.ceil((new Date(throttle.until) - Date.now()) / 1000),
          });
          return;
        }

        const isValid = await bcrypt.compare(currentPassword, note.password);
        if (!isValid) {
          await recordFailure();
          res.status(401).json({ error: 'Invalid password' });
          return;
        }

        await clearFailures();

        // Conflict detection
        const serverVersion = note.version || 1;
        if (typeof expectedVersion === 'number' && expectedVersion !== serverVersion) {
          const { password: _pw, ...serverCopy } = note;
          res.status(409).json({
            error: 'Version conflict',
            serverVersion,
            serverNote: serverCopy,
          });
          return;
        }

        // Title uniqueness
        if (title !== note.title) {
          const existing = await notesCollection.findOne({
            title,
            _id: { $ne: new ObjectId(id) },
          });
          if (existing) {
            res.status(400).json({ error: 'A note with this name already exists' });
            return;
          }
        }

        // Snapshot current state into versions
        await versionsCollection.insertOne({
          noteId: new ObjectId(id),
          title: note.title,
          content: note.content,
          version: serverVersion,
          createdAt: new Date(),
        });

        // Trim old versions: keep latest 20
        const excess = await versionsCollection
          .find({ noteId: new ObjectId(id) })
          .sort({ createdAt: -1 })
          .skip(20)
          .toArray();
        if (excess.length) {
          await versionsCollection.deleteMany({
            _id: { $in: excess.map((v) => v._id) },
          });
        }

        const updateData = {
          title,
          content,
          updatedAt: new Date(),
          version: serverVersion + 1,
        };

        if (password && password.length >= 6) {
          updateData.password = await bcrypt.hash(password, 10);
        } else if (password && password.length < 6) {
          res.status(400).json({ error: 'New password must be at least 6 characters long' });
          return;
        }

        await notesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        const updated = await notesCollection.findOne(
          { _id: new ObjectId(id) },
          { projection: { password: 0 } }
        );

        res.status(200).json(updated);
      } catch (error) {
        console.error('PUT error:', error);
        res.status(500).json({ error: 'Failed to update note' });
      }
      return;
    }

    // ----- DELETE /api/note?id=... -----
    // Password now read from JSON body, not query string.
    // Also accepts ?password= for backwards compat but logs a deprecation.
    if (req.method === 'DELETE') {
      try {
        const bodyPassword = (req.body && req.body.password) || null;
        const queryPassword = req.query && req.query.password;
        const password = bodyPassword || queryPassword;

        if (!password) {
          res.status(401).json({ error: 'Password required to delete this note' });
          return;
        }

        const throttle = await checkThrottle();
        if (throttle.locked) {
          res.status(429).json({
            error: 'Too many failed attempts. Try again later.',
            retryAfter: Math.ceil((new Date(throttle.until) - Date.now()) / 1000),
          });
          return;
        }

        const note = await notesCollection.findOne({ _id: new ObjectId(id) });
        if (!note) {
          res.status(404).json({ error: 'Note not found' });
          return;
        }

        const isValid = await bcrypt.compare(password, note.password);
        if (!isValid) {
          await recordFailure();
          res.status(401).json({ error: 'Invalid password' });
          return;
        }

        await clearFailures();
        await notesCollection.deleteOne({ _id: new ObjectId(id) });
        await versionsCollection.deleteMany({ noteId: new ObjectId(id) });

        res.status(200).json({ message: 'Note deleted successfully' });
      } catch (error) {
        console.error('DELETE error:', error);
        res.status(500).json({ error: 'Failed to delete note' });
      }
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}