// api/note.js
import { connectToDatabase } from './_lib/mongodb.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  // Set CORS headers
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { id } = req.query;

  if (!id) {
    res.status(400).json({ error: 'Note ID is required' });
    return;
  }

  try {
    const { db } = await connectToDatabase();
    const notesCollection = db.collection('notes');

    // GET single note
    if (req.method === 'GET') {
      try {
        const noteWithPassword = await notesCollection.findOne(
          { _id: new ObjectId(id) }
        );

        if (!noteWithPassword) {
          res.status(404).json({ error: 'Note not found' });
          return;
        }

        // Check if note has a password (handle null, undefined, empty string)
        const hasPassword = !!(noteWithPassword.password && 
                              noteWithPassword.password !== null && 
                              noteWithPassword.password !== '');

        // Get note without password for response
        const { password, ...noteWithoutPassword } = noteWithPassword;

        // Return note with hasPassword flag
        res.status(200).json({
          ...noteWithoutPassword,
          hasPassword: hasPassword
        });
      } catch (error) {
        console.error('GET error:', error);
        res.status(500).json({ error: 'Failed to fetch note' });
      }
      return;
    }

    // PUT update note
    if (req.method === 'PUT') {
      try {
        const { title, content, password, currentPassword } = req.body;

        if (!title || !content) {
          res.status(400).json({ error: 'Title and content are required' });
          return;
        }

        const note = await notesCollection.findOne({ _id: new ObjectId(id) });

        if (!note) {
          res.status(404).json({ error: 'Note not found' });
          return;
        }

        // Check if note is password protected
        if (note.password) {
          if (!currentPassword) {
            res.status(401).json({ error: 'Password required to update this note' });
            return;
          }

          const isValid = await bcrypt.compare(currentPassword, note.password);
          if (!isValid) {
            res.status(401).json({ error: 'Invalid password' });
            return;
          }
        }

        // Check if new title conflicts with existing note
        if (title !== note.title) {
          const existingNote = await notesCollection.findOne({ 
            title, 
            _id: { $ne: new ObjectId(id) } 
          });
          if (existingNote) {
            res.status(400).json({ error: 'A note with this name already exists' });
            return;
          }
        }

        // Update password if provided
        let updateData = {
          title,
          content,
          updatedAt: new Date()
        };

        if (password) {
          updateData.password = await bcrypt.hash(password, 10);
        }

        await notesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        // Get updated note without password
        const updatedNote = await notesCollection.findOne(
          { _id: new ObjectId(id) },
          { projection: { password: 0 } }
        );

        res.status(200).json(updatedNote);
      } catch (error) {
        console.error('PUT error:', error);
        res.status(500).json({ error: 'Failed to update note' });
      }
      return;
    }

    // DELETE note
    if (req.method === 'DELETE') {
      try {
        const { password } = req.query;

        const note = await notesCollection.findOne({ _id: new ObjectId(id) });

        if (!note) {
          res.status(404).json({ error: 'Note not found' });
          return;
        }

        // Check if note is password protected
        if (note.password) {
          if (!password) {
            res.status(401).json({ error: 'Password required to delete this note' });
            return;
          }

          const isValid = await bcrypt.compare(password, note.password);
          if (!isValid) {
            res.status(401).json({ error: 'Invalid password' });
            return;
          }
        }

        await notesCollection.deleteOne({ _id: new ObjectId(id) });

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