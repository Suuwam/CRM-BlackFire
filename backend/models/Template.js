const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  subject: { type: String, default: '' },
  body:    { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Template', templateSchema);
