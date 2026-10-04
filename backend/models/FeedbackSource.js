const mongoose = require('mongoose');

// One website that sends us reviews. Added from the Feedback page (admin) — no code per site.
const feedbackSourceSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true, maxlength: 80 },
  slug:   { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 60 },
  secret: { type: String, required: true }, // shared HMAC key, pasted into the site's CRM_WEBHOOK_SECRET
  lastReceivedAt: { type: Date, default: null },
  color:  { type: String, default: '#3b82f6', match: /^#[0-9a-fA-F]{6}$/ }, // accent on its cards and dashboard
}, { timestamps: true });

module.exports = mongoose.model('FeedbackSource', feedbackSourceSchema);
