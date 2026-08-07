const mongoose = require('mongoose');
const { hashPassword } = require('../utils/password');

const accountApplicationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  username: { type: String, required: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  note: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  verificationCode: { type: String },
  isEmailVerified: { type: Boolean, default: false },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
}, { timestamps: true });

accountApplicationSchema.pre('save', async function preSave(next) {
  try {
    if (!this.isModified('password')) return next();
    this.password = await hashPassword(this.password);
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('AccountApplication', accountApplicationSchema);
