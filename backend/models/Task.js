const mongoose = require('mongoose');

// project: a Board._id; column: one of that board's column ids. Both are user-defined, so
// no enum here — the Board document is the source of truth for what exists.
const taskSchema = new mongoose.Schema({
  project:     { type: String, required: true },
  column:      { type: String, default: 'backlog' },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  priority:    { type: String, enum: ['low','medium','high'], default: 'medium' },
  tags:        [{ type: String, trim: true }],
  // Legacy single-assignee fields (kept for backward compat)
  assignee:      { type: String, default: '' },
  assigneeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assigneeName:  { type: String, default: '' },
  assigneeEmail: { type: String, default: '' },
  // Multi-assignee array
  assignees: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name:   { type: String, default: '' },
    email:  { type: String, default: '' },
  }],
  assignedById:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedByName:  { type: String, default: '' },
  assignedByEmail: { type: String, default: '' },
  dueDate: { type: String, default: '' },
  image:   { type: String, default: '' },
  color:   { type: String, default: 'blue' },
  order:   { type: Number, default: 0 },
  // Task comments / discussion thread
  comments: [{
    text:       { type: String, required: true },
    authorName: { type: String, default: '' },
    authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt:  { type: Date, default: Date.now },
  }],
}, { timestamps: true });

// Board fetch is find({ project }).sort({ column, order }) — one compound index serves both.
taskSchema.index({ project: 1, column: 1, order: 1 });
// Overdue / due-date views scan open tasks by date.
taskSchema.index({ dueDate: 1 });
// "My tasks" lookups.
taskSchema.index({ 'assignees.userId': 1 });

module.exports = mongoose.model('Task', taskSchema);

