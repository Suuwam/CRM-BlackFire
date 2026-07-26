const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  company: { type: String, trim: true, default: '' },
  email:   { type: String, trim: true, default: '' },
  phone:   { type: String, trim: true, default: '' },
  status:  { type: String, enum: ['Active', 'Prospect', 'Inactive'], default: 'Active' },
  project: { type: String, trim: true, default: '' },
  notes:   { type: String, default: '' },
  photo:   { type: String, default: null },  // filename in /uploads
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
