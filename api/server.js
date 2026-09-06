import 'dotenv/config';
import express from 'express';
import { connectToDatabase } from './_lib/mongodb.js';
import noteHandler from './note.js';
import notesHandler from './notes.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Helper function to convert Express req/res to Vercel-like format
function createVercelHandler(handler) {
  return async (req, res) => {
    try {
      // Create a Vercel-compatible request object
      const vercelReq = {
        method: req.method,
        query: req.query,
        body: req.body,
        headers: req.headers,
        url: req.url,
        // Add any other properties the handler might expect
        setHeader: (key, value) => {
          // This is a dummy - we handle headers in the Express middleware
        }
      };

      // Create a Vercel-compatible response object that wraps Express res
      const vercelRes = {
        statusCode: 200,
        headers: {},
        _sent: false,
        
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        
        setHeader: function(key, value) {
          // Actually set the header on the Express response
          res.setHeader(key, value);
          this.headers[key] = value;
          return this;
        },
        
        json: function(data) {
          if (this._sent) return this;
          this._sent = true;
          res.status(this.statusCode).json(data);
          return this;
        },
        
        send: function(data) {
          if (this._sent) return this;
          this._sent = true;
          res.status(this.statusCode).send(data);
          return this;
        },
        
        end: function(data) {
          if (this._sent) return this;
          this._sent = true;
          if (data) {
            res.status(this.statusCode).send(data);
          } else {
            res.status(this.statusCode).end();
          }
          return this;
        },
        
        // Handle the direct property access that note.js uses
        getHeader: function(key) {
          return res.getHeader(key);
        },
        
        // For the notes.js handler which uses res.setHeader directly
        headersSent: false,
        
        // Also support direct property assignment (though not ideal)
        _headers: {}
      };

      // Make res.setHeader work both ways
      const originalSetHeader = res.setHeader.bind(res);
      res.setHeader = function(key, value) {
        originalSetHeader(key, value);
        vercelRes._headers[key] = value;
        return res;
      };

      // Call the handler
      await handler(vercelReq, vercelRes);
      
      // If the handler didn't send anything, send a 404
      if (!vercelRes._sent) {
        res.status(404).json({ error: 'Not found' });
      }
    } catch (error) {
      console.error('Handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error', message: error.message });
      }
    }
  };
}

// Routes
app.all('/api/notes', createVercelHandler(notesHandler));
app.all('/api/note', createVercelHandler(noteHandler));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Lock-Notes API is running',
    endpoints: {
      notes: '/api/notes',
      note: '/api/note?id=...',
      health: '/api/health'
    }
  });
});

// Start server
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in .env file!');
      console.error('📝 Please create api/.env with:');
      console.error('   MONGODB_URI=your_mongodb_connection_string');
      console.error('   MONGODB_DB=note_app');
      process.exit(1);
    }
    
    await connectToDatabase();
    console.log('✅ Connected to MongoDB');
    
    app.listen(PORT, () => {
      console.log(`✅ API server running at http://localhost:${PORT}`);
      console.log(`📝 Notes endpoint: http://localhost:${PORT}/api/notes`);
      console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    console.error('💡 Make sure your MONGODB_URI is correct in api/.env');
    process.exit(1);
  }
}

startServer();