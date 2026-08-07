require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// ─── Security Headers (helmet) ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Cloudinary/CDN images
  contentSecurityPolicy: false, // disabled to avoid breaking the React SPA in same-origin serving
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Set ALLOWED_ORIGINS in .env as a comma-separated list of allowed origins.
// Falls back to permissive mode only if the env var is explicitly not set (local dev).
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (!ALLOWED_ORIGINS) return callback(null, true); // dev fallback
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── Body Parsing (with size cap to prevent DoS) ──────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mongo DB connection handling for serverless & local
let cachedConnection = null;

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is missing in server environment');
  }
  if (!cachedConnection) {
    cachedConnection = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 4000,
    });
  }
  return cachedConnection;
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    res.status(500).json({ error: 'Database connection failed. Please try again.' });
  }
});

// Routes
app.use('/api/clients', require('./routes/clients'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/events', require('./routes/events'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/references', require('./routes/references'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/email', require('./routes/email'));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// ─── Global Error Handler (prevents stack traces leaking to clients) ───────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // CORS errors
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  // JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  // Payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large (max 1MB)' });
  }
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'An internal error occurred' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

module.exports = app;
