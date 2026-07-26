const mongoose = require('mongoose');

const referenceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  url:   { type: String, required: true, trim: true },
  tags:  [{ type: String, trim: true }],
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Reference', referenceSchema);
