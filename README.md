# 📝 Lock Notes - Pubsonal

[![Live Demo](https://img.shields.io/badge/Live_Demo-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://lock-notes-pubsonal.vercel.app/)
[![Made with](https://img.shields.io/badge/Made_with-❤️-ff69b4?style=for-the-badge)]()

A serverless note-taking web application where users can create, read, update, and delete public notes with optional password protection.

**🔗 Live:** [https://lock-notes-pubsonal.vercel.app/](https://lock-notes-pubsonal.vercel.app/)

## ✨ Features

- 📝 **Create Notes** - Write and publish notes with unique titles
- 🔒 **Password Protection** - Optionally protect notes with a password
- 👀 **Public Viewing** - All notes are publicly visible to everyone
- ✏️ **Edit Notes** - Update your notes (password required for protected notes)
- 🗑️ **Delete Notes** - Remove notes (password required for protected notes)
- 🚀 **Serverless** - Built on Vercel serverless functions
- 🍃 **MongoDB** - Persistent storage with MongoDB Atlas
- ⚡ **React + Vite** - Fast, modern frontend with hot reload

## 🛠️ Technologies

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and development server
- **Axios** - HTTP client for API requests
- **React Router DOM** - Client-side routing (pre-installed)

### Backend
- **Node.js** - Runtime environment
- **Vercel Serverless Functions** - API endpoints
- **MongoDB Atlas** - Cloud database
- **bcryptjs** - Password hashing

## 🚀 Live Demo

[Link to your deployed application]

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB Atlas account (free tier works)
- Vercel account (for deployment)

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/sOuL2000s/Lock-Notes-Pubsonal.git
cd Lock-Notes-Pubsonal
```

### 2. Install Dependencies

```bash
# Install API dependencies
cd api
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=note_app
```

Create `client/.env` for frontend:

```env
VITE_API_URL=/api
```

### 4. Get MongoDB Connection String

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Click "Connect" → "Connect your application"
4. Copy the connection string
5. Replace `your_mongodb_connection_string` in `.env`

Example connection string:
```
mongodb+srv://username:password@cluster.mongodb.net/
```

## 🏃 Running Locally

### Option 1: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Run development server
vercel dev
```

The app will be available at `http://localhost:3000`

### Option 2: Run Separately

**Terminal 1 - API Server:**
```bash
cd api
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

The frontend will be at `http://localhost:5173` with API proxy to `http://localhost:3000`

## 🚢 Deployment

### Deploy to Vercel

#### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to production
vercel --prod
```

#### Option 2: GitHub + Vercel Dashboard

1. Push code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com)
3. Click "Add New" → "Project"
4. Import your GitHub repository
5. Configure environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `MONGODB_DB`: `note_app`
6. Deploy!

### Vercel Configuration

**Build Command:** `cd client && npm install && npm run build`  
**Output Directory:** `client/dist`  
**Install Command:** `npm install`

## 📡 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/notes` | Get all public notes | None |
| POST | `/api/notes` | Create a new note | None |
| GET | `/api/note?id={id}` | Get a single note | None |
| PUT | `/api/note?id={id}` | Update a note | Password if protected |
| DELETE | `/api/note?id={id}` | Delete a note | Password if protected |

### API Examples

#### Create a Note
```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"My Note","content":"This is my note","password":"optional123"}'
```

#### Update a Note
```bash
curl -X PUT http://localhost:3000/api/note?id=NOTE_ID \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title","content":"Updated content","currentPassword":"optional123"}'
```

#### Delete a Note
```bash
curl -X DELETE "http://localhost:3000/api/note?id=NOTE_ID&password=optional123"
```

## 📁 Project Structure

```
Lock-Notes-Pubsonal/
├── api/
│   ├── _lib/
│   │   └── mongodb.js       # MongoDB connection
│   ├── note.js              # Single note operations
│   ├── notes.js             # Multiple notes operations
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── NoteList.jsx    # Display all notes
│   │   │   ├── NoteEditor.jsx  # Create/Edit notes
│   │   │   ├── NoteViewer.jsx  # View single note
│   │   │   └── NotePassword.jsx# Password modal
│   │   ├── services/
│   │   │   └── api.js          # API client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env                    # Frontend env vars
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .env                        # Backend env vars
├── package.json
├── vercel.json
└── README.md
```

## 🔒 Security Features

- **Password Hashing**: Passwords are hashed using bcryptjs before storage
- **Protected Operations**: Password required for edit/delete on protected notes
- **Unique Titles**: Duplicate note titles are prevented
- **CORS Enabled**: Proper CORS headers for API requests
- **No Sensitive Data Exposure**: Passwords are never returned in API responses

## 🎨 UI Features

- Clean, modern design with gradient background
- Responsive grid layout for notes
- Password protection badge on notes
- Modal dialogs for password entry
- Loading states and error handling
- Smooth animations and transitions

## 🐛 Troubleshooting

### Common Issues

**"MONGODB_URI is not defined"**
- Make sure `.env` file exists in the root directory
- Check if MongoDB connection string is correct
- Restart the development server

**"Failed to load module script"**
- This usually indicates a routing issue with Vercel
- Make sure `vercel.json` routes are configured correctly

**"No Output Directory named 'dist' found"**
- Set Output Directory in Vercel Dashboard to `client/dist`
- Or update `vercel.json` with proper `distDir` configuration

**404 on API endpoints**
- Verify API routes in `vercel.json`
- Check if environment variables are set in Vercel Dashboard

### Local Development Issues

**Vite proxy not working**
- Make sure API server is running on port 3000
- Check `client/vite.config.js` proxy settings

**MongoDB connection timeout**
- Whitelist your IP in MongoDB Atlas
- Check if connection string includes correct database name

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**sOuL2000s**
- GitHub: [@sOuL2000s](https://github.com/sOuL2000s)

## 🙏 Acknowledgments

- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) for database hosting
- [Vercel](https://vercel.com) for serverless hosting
- [React](https://reactjs.org/) for the UI framework
- [Vite](https://vitejs.dev/) for the build tool

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [React Documentation](https://reactjs.org/docs)
- [Vite Documentation](https://vitejs.dev/guide/)

---

Made with ❤️ and a touch of ✨ diamond elegance