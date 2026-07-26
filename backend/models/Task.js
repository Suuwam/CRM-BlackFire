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
  assignee:    { type: String, default: '' },
  dueDate:     { type: String, default: '' },
  order:       { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
