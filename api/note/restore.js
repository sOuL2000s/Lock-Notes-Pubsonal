// api/note/restore.js
// POST /api/note/restore?id=...   body: { versionId, currentPassword }
import { connectToDatabase } from '../_lib/mongodb.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
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
    const versions = db.collection('note_versions');

    const { versionId, currentPassword } = req.body || {};
    if (!versionId || !ObjectId.isValid(versionId)) {
      res.status(400).json({ error: 'Valid versionId required' });
      return;
    }
    if (!currentPassword) {
      res.status(401).json({ error: 'Password required' });
      return;
    }

    const note = await notes.findOne({ _id: new ObjectId(id) });
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, note.password);
    if (!ok) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    const version = await versions.findOne({ _id: new ObjectId(versionId) });
    if (!version || String(version.noteId) !== id) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }

    const serverVersion = note.version || 1;

    // Snapshot current state before restoring
    await versions.insertOne({
      noteId: new ObjectId(id),
      title: note.title,
      content: note.content,
      version: serverVersion,
      createdAt: new Date(),
    });

    await notes.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title: version.title,
          content: version.content,
          updatedAt: new Date(),
          version: serverVersion + 1,
        },
      }
    );

    const updated = await notes.findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } }
    );
    res.status(200).json(updated);
  } catch (error) {
    console.error('restore error:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
}