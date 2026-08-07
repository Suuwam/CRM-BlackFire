const mongoose = require('mongoose');
const User = require('../models/User');

function sanitizeUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function getSessionUser(req) {
  const sessionUserId = req.get('x-session-user');
  if (!sessionUserId || !mongoose.isValidObjectId(sessionUserId)) return null;
  const user = await User.findById(sessionUserId);
  return user && user.active ? user : null;
}

async function requireSessionUser(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    req.sessionUser = user;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function requireAdmin(req, res, next) {
  if (!req.sessionUser || req.sessionUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { sanitizeUser, getSessionUser, requireSessionUser, requireAdmin };