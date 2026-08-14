const mongoose = require('mongoose');
const { hashPassword } = require('../utils/password');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, trim: true, lowercase: true, unique: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  password: { type: String, required: true },
  googleId: { type: String, unique: true, sparse: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function preSave(next) {
  try {
    if (!this.isModified('password')) return next();
    this.password = await hashPassword(this.password);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre('findOneAndUpdate', async function preFindOneAndUpdate(next) {
  try {
    const update = this.getUpdate() || {};
    const candidate = update.password ?? update.$set?.password;

    if (!candidate) return next();

    const hashed = await hashPassword(candidate);

    if (update.password !== undefined) update.password = hashed;
    if (update.$set && update.$set.password !== undefined) update.$set.password = hashed;
    if (update.$setOnInsert && update.$setOnInsert.password !== undefined) update.$setOnInsert.password = hashed;

    this.setUpdate(update);
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('User', userSchema);