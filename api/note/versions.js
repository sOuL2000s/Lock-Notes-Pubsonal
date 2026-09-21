// api/note/versions.js
// GET  /api/note/versions?id=...       → list versions (metadata only)
// POST /api/note/versions/restore      → handled in restore.js
import { connectToDatabase } from '../_lib/mongodb.js';
import { ObjectId } from 'mongodb';

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

  const { id } = req.query;
  if (!id || !ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Valid Note ID is required' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db } = await connectToDatabase();
    const versions = await db
      .collection('note_versions')
      .find(
        { noteId: new ObjectId(id) },
        { projection: { content: 0 } } // don't ship huge bodies in the list
      )
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    res.status(200).json({ versions });
  } catch (error) {
    console.error('versions error:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
}