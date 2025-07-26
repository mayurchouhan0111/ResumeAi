const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const apiUsageSchema = new mongoose.Schema(
  {
    monthly:   { type: Number, default: 0 },
    lastReset: { type: Date,   default: Date.now },
    total:     { type: Number, default: 0 }
  },
  { _id: false }
);

const preferenceSchema = new mongoose.Schema(
  {
    theme:         { type: String, enum: ['light', 'dark'], default: 'light' },
    language:      { type: String, default: 'en' },
    notifications: { type: Boolean, default: true }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email:               { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:            { type: String, required: true, minlength: 6, select: false },
    name:                { type: String, required: true, trim: true },
    subscriptionType:    { type: String, enum: ['free', 'premium', 'enterprise'], default: 'free' },
    subscriptionExpiry:  { type: Date, default: null, index: { expireAfterSeconds: 0, partialFilterExpression: { subscriptionExpiry: { $type: 'date' } } } }, // TTL once expiry is set
    apiUsage:            apiUsageSchema,
    preferences:         preferenceSchema
  },
  { timestamps: true }
);

/* ────────── Hooks & Methods ────────── */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

/* ────────── Sanitise Output ────────── */
userSchema.methods.toJSON = function () {
  const obj = this.toObject({ versionKey: false });
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);