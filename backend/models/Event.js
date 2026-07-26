const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title:     { type: String, required: true, trim: true },
  date:      { type: String, required: true },   // YYYY-MM-DD
  time:      { type: String, default: '' },
  clientId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  notes:     { type: String, default: '' },
  color:     { type: String, default: 'blue' },
  platforms: [{ type: String }],
  status:    { type: String, default: 'scheduled' },
  image:     { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
