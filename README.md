# Note Sharing App

A serverless note-taking application where users can create, read, update, and delete public notes with password protection.

## Features

- ✨ Create public notes with unique names
- 🔒 Password protect individual notes
- 📝 Edit and delete notes (password required for protected notes)
- 👀 View all public notes without login
- 🚀 Serverless deployment on Vercel
- 🍃 MongoDB database
- ⚡ React with Vite

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB instance
- Vercel account (for deployment)

### Environment Variables

Create a `.env` file in the root directory:

```env
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=your_database_name
```

For the frontend, create `client/.env`:

```env
VITE_API_URL=/api
```

### Local Development

1. Install dependencies:
```bash
# Install API dependencies
cd api
npm install

# Install client dependencies
cd ../client
npm install
```

2. Start the development servers:
```bash
# Start API server (from api directory)
npm run dev

# Start client server (from client directory)
npm run dev
```

3. Open http://localhost:5173 in your browser

### Deployment to Vercel

1. Push your code to GitHub

2. Import the repository in Vercel

3. Add environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `MONGODB_DB`: Your database name

4. Deploy!

## API Endpoints

### GET /api/notes
- Returns all public notes (without passwords)
- Response: `{ notes: [...] }`

### POST /api/notes
- Creates a new note
- Body: `{ title, content, password? }`
- Response: Created note object

### GET /api/note?id={id}
- Returns a single note (without password)
- Response: Note object

### PUT /api/note?id={id}
- Updates a note
- Body: `{ title, content, password?, currentPassword? }`
- Response: Updated note object

### DELETE /api/note?id={id}&password={password}
- Deletes a note (password required for protected notes)
- Response: Success message

## Technologies Used

- **Frontend**: React, Vite, Axios
- **Backend**: Node.js, Serverless Functions
- **Database**: MongoDB
- **Deployment**: Vercel
- **Authentication**: bcryptjs for password hashing

## License

MIT
