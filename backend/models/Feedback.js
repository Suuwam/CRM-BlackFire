const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  source:     { type: mongoose.Schema.Types.ObjectId, ref: 'FeedbackSource', required: true },
  externalId: { type: String, required: true, maxlength: 100 }, // the site's own id; a resend repeats it
  rating:     { type: Number, required: true, min: 1, max: 5 },
  sentiment:  { type: String, enum: ['positive', 'neutral', 'negative'], required: true },
  category:   { type: String, default: 'other', maxlength: 30 },
  message:    { type: String, default: '', maxlength: 5000 },
  page:       { type: String, default: '', maxlength: 500 },
  urgent:     { type: Boolean, default: false },
  user: {
    id: String, email: String, name: String, plan: String,
  },
  sentAt:     { type: Date, required: true }, // when the review was written on the site
}, { timestamps: true });

feedbackSchema.index({ source: 1, externalId: 1 }, { unique: true });
feedbackSchema.index({ source: 1, sentAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
