const mongoose = require('mongoose');

// project: 'blackfire' | 'aawazz'
// column:  'backlog' | 'todo' | 'inprogress' | 'qa' | 'done'
const taskSchema = new mongoose.Schema({
  project:     { type: String, enum: ['blackfire', 'aawazz'], required: true },
  column:      { type: String, enum: ['backlog','todo','inprogress','qa','done'], default: 'backlog' },
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
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);

