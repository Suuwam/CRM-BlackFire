const mongoose = require('mongoose');

// ponytail: one row per user per day — first clock-in, last clock-out.
// Split shifts collapse into a single span; add a sessions[] array if that ever matters.
const attendanceSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, default: '' },
  date:     { type: String, required: true },      // YYYY-MM-DD in ATTENDANCE_TZ
  clockIn:  { type: Date, default: null },
  clockOut: { type: Date, default: null },
  lastSeen: { type: Date, default: null },
  note:     { type: String, default: '' },
  // Set when the sweep closed this row because the heartbeat stopped, rather than the
  // person clicking Clock out. Only an auto-closed row may be resumed by a heartbeat.
  autoClosed: { type: Boolean, default: false },
}, { timestamps: true });

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
// The team-day view and admin history both range-scan on date alone.
attendanceSchema.index({ date: 1 });
// The auto clock-out sweep looks for open rows that have gone quiet.
attendanceSchema.index({ clockOut: 1, lastSeen: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
