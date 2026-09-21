// api/note/share.js
// POST   /api/note/share?id=...   body: { currentPassword, expiresInDays? }
// DELETE /api/note/share?id=...   body: { currentPassword }
import { connectToDatabase } from '../_lib/mongodb.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
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
    const notes = db.collection('notes');
    const note = await notes.findOne({ _id: new ObjectId(id) });
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const { currentPassword, expiresInDays } = req.body || {};
    if (!currentPassword) {
      res.status(401).json({ error: 'Password required' });
      return;
    }
    const ok = await bcrypt.compare(currentPassword, note.password);
    if (!ok) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    if (req.method === 'POST') {
      // Mint a fresh token. Store a hash, return the plaintext once.
      const token = crypto.randomBytes(24).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const days = Math.min(Math.max(parseInt(expiresInDays, 10) || 7, 1), 90);
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      await notes.updateOne(
        { _id: new ObjectId(id) },
        { $set: { shareToken: tokenHash, shareExpiresAt: expiresAt, shareCreatedAt: new Date() } }
      );

      res.status(200).json({ token, expiresAt });
      return;
    }

    if (req.method === 'DELETE') {
      await notes.updateOne(
        { _id: new ObjectId(id) },
        { $unset: { shareToken: '', shareExpiresAt: '', shareCreatedAt: '' } }
      );
      res.status(200).json({ message: 'Share link revoked' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('share error:', error);
    res.status(500).json({ error: 'Failed to process share request' });
  }
}