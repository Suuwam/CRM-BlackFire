const mongoose = require('mongoose');

// _id is a plain string, not an ObjectId: it is the value Task.project stores, so the two
// legacy boards keep their id ('blackfire' / 'aawazz') and their existing tasks.
const boardSchema = new mongoose.Schema({
  _id:   { type: String, required: true },
  label: { type: String, required: true, trim: true },
  color: { type: String, default: '#3b82f6' },
  columns: [{
    _id:   false,
    id:    { type: String, required: true },
    label: { type: String, required: true },
  }],
  order: { type: Number, default: 0 },
}, { timestamps: true, _id: false });

module.exports = mongoose.model('Board', boardSchema);
