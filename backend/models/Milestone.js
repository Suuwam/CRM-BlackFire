const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 5000 },
  done:        { type: Boolean, default: false },
  doneAt:      { type: Date, default: null },
  doneByName:  { type: String, default: '' },
  createdByName: { type: String, default: '' },
}, { timestamps: true });

milestoneSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Milestone', milestoneSchema);
