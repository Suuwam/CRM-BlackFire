require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mongo DB connection handling for serverless & local
let isConnected = 0;
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is missing on server');
  }
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    res.status(500).json({ error: `Database connection failed: ${err.message}` });
  }
});

// Routes
const routeModules = [
  ['/clients', require('./routes/clients')],
  ['/auth', require('./routes/auth')],
  ['/users', require('./routes/users')],
  ['/activity', require('./routes/activity')],
  ['/events', require('./routes/events')],
  ['/templates', require('./routes/templates')],
  ['/references', require('./routes/references')],
  ['/tasks', require('./routes/tasks')],
  ['/email', require('./routes/email')],
];

routeModules.forEach(([pathStr, routerModule]) => {
  app.use(`/api${pathStr}`, routerModule);
  app.use(pathStr, routerModule);
});

// Health check
app.get(['/api/health', '/health'], (_, res) => res.json({ status: 'ok' }));

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

module.exports = app;
