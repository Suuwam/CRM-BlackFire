const buckets = new Map();

function rateLimit({ windowMs = 60000, max = 10, prefix = 'default', message = 'Too many requests, please try again later.' } = {}) {
  return (req, res, next) => {
    const forwarded = req.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : (req.ip || 'anonymous');
    const key = `${prefix}:${ip}`;
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter(ts => now - ts < windowMs);

    if (recent.length >= max) {
      return res.status(429).json({ error: message });
    }

    recent.push(now);
    buckets.set(key, recent);
    next();
  };
}

module.exports = { rateLimit };