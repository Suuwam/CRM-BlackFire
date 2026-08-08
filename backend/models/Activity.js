const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  action: { type: String, required: true, trim: true },
  targetType: { type: String, enum: ['task', 'account', 'application', 'email'], default: 'task' },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  targetName: { type: String, default: '' },
  project: { type: String, default: '' },
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
  actorName: { type: String, default: '' },
  assigneeId: { type: mongoose.Schema.Types.ObjectId, default: null },
  assigneeName: { type: String, default: '' },
  assigneeEmail: { type: String, default: '' },
  fromColumn: { type: String, default: '' },
  toColumn: { type: String, default: '' },
  summary: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);