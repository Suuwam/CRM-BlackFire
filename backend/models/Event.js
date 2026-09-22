const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title:     { type: String, required: true, trim: true },
  date:      { type: String, required: true },   // YYYY-MM-DD
  time:      { type: String, default: '' },
  assignees: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    email: String
  }],
  assigneeName: { type: String, default: '' },
  notes:     { type: String, default: '' },
  color:     { type: String, default: 'blue' },
  platforms: [{ type: String }],
  status:    { type: String, default: 'scheduled' },
  image:     { type: String, default: '' },
}, { timestamps: true });

// Calendar queries filter by exact date or a ^YYYY-MM prefix and sort by date+time.
eventSchema.index({ date: 1, time: 1 });

module.exports = mongoose.model('Event', eventSchema);
