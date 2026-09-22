const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  action: { type: String, required: true, trim: true },
  targetType: { type: String, enum: ['task', 'account', 'application', 'email', 'attendance'], default: 'task' },
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

// Every read filters and sorts on createdAt; without this it is a collscan + in-memory sort.
activitySchema.index({ createdAt: -1 });
activitySchema.index({ actorId: 1, createdAt: -1 });

// ponytail: the log is append-only and only ever read 180 days back, so let Mongo expire it.
// Raise ACTIVITY_TTL_DAYS (or drop the index) if this ever has to be an audit trail.
const TTL_DAYS = Number(process.env.ACTIVITY_TTL_DAYS || 365);
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_DAYS * 86400 });

module.exports = mongoose.model('Activity', activitySchema);