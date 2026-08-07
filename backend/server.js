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
    console.error('MONGO_URI is missing');
    return;
  }
  await mongoose.connect(process.env.MONGO_URI);
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    res.status(500).json({ error: 'Database connection failed' });
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

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

module.exports = app;
