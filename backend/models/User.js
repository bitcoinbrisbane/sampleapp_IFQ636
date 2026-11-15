
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // Two roles (brief requires exactly two): a debater can create/join/argue/vote;
    // a moderator creates and officiates debates. Defaults to debater.
    role: { type: String, enum: ['debater', 'moderator'], default: 'debater' },
    university: { type: String },
    address: { type: String },
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);
