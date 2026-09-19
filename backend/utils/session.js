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
    photo: user.photo || '',
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// Every authenticated request resolves the caller, and the 60s presence heartbeat means
// each open tab alone is one findById per minute. Cache the lookup for a few seconds so a
// burst of requests costs one round-trip instead of one each.
//
// The TTL is deliberately short and every route that changes or removes a user calls
// invalidateSessionUser, so deactivating an account still takes effect immediately.
const SESSION_TTL_MS = Number(process.env.SESSION_CACHE_MS || 10_000);
const sessionCache = new Map(); // id -> { user, expires }

function invalidateSessionUser(id) {
  if (id) sessionCache.delete(String(id));
}

async function getSessionUser(req) {
  const sessionUserId = req.get('x-session-user');
  if (!sessionUserId || !mongoose.isValidObjectId(sessionUserId)) return null;

  const key = String(sessionUserId);
  const hit = sessionCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.user;

  const user = await User.findById(sessionUserId);
  const resolved = user && user.active ? user : null;
  sessionCache.set(key, { user: resolved, expires: Date.now() + SESSION_TTL_MS });

  // ponytail: bounded by eviction on read, not a background sweep. One team's worth of
  // users never grows this past a few dozen entries; swap in an LRU if that stops holding.
  if (sessionCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of sessionCache) if (v.expires <= now) sessionCache.delete(k);
  }
  return resolved;
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

module.exports = { sanitizeUser, getSessionUser, requireSessionUser, requireAdmin, invalidateSessionUser };