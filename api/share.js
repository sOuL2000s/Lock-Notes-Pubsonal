// api/share.js
// GET /api/share?token=...   → returns read-only note payload (no password needed)
import { connectToDatabase } from './_lib/mongodb.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { token } = req.query;
  if (!token) {
    res.status(400).json({ error: 'Token required' });
    return;
  }

  try {
    const { db } = await connectToDatabase();
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');

    const note = await db.collection('notes').findOne({ shareToken: tokenHash });
    if (!note) {
      res.status(404).json({ error: 'Share link not found or revoked' });
      return;
    }
    if (note.shareExpiresAt && new Date(note.shareExpiresAt) < new Date()) {
      res.status(410).json({ error: 'Share link has expired' });
      return;
    }

    res.status(200).json({
      _id: note._id,
      title: note.title,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      shareExpiresAt: note.shareExpiresAt,
      readOnly: true,
    });
  } catch (error) {
    console.error('share fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch shared note' });
  }
}