import { connectToDatabase } from './_lib/mongodb.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  // Set CORS headers - using the wrapper's setHeader
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

    // GET all notes (public)
    if (req.method === 'GET') {
      try {
        const notes = await notesCollection
          .find({})
          .project({ password: 0 })
          .sort({ createdAt: -1 })
          .toArray();
        
        res.status(200).json({ notes });
      } catch (error) {
        console.error('GET error:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
      }
      return;
    }

    // POST create a new note
    if (req.method === 'POST') {
      try {
        const { title, content, password } = req.body;

        if (!title || !content) {
          res.status(400).json({ error: 'Title and content are required' });
          return;
        }

        // Check if note name already exists
        const existingNote = await notesCollection.findOne({ title });
        if (existingNote) {
          res.status(400).json({ error: 'A note with this name already exists' });
          return;
        }

        // Hash password if provided
        let hashedPassword = null;
        if (password) {
          hashedPassword = await bcrypt.hash(password, 10);
        }

        const note = {
          title,
          content,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await notesCollection.insertOne(note);
        
        // Return note without password
        const { password: _, ...noteWithoutPassword } = note;
        res.status(201).json({ 
          ...noteWithoutPassword, 
          _id: result.insertedId 
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