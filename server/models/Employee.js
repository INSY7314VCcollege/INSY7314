const mongoose = require('mongoose');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const employeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    match: [/^[A-Z0-9]{6,10}$/, 'Employee ID must be 6-10 uppercase alphanumeric characters']
  },
  fullName: {
    type: String,
    required: [true, 'Please provide a full name'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
    match: [/^[A-Za-z\s]{3,50}$/, 'Name can only contain letters and spaces']
  },
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    unique: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_-]{3,30}$/, 'Username can only contain letters, numbers, underscores, and hyphens']
  },
  passwordHash: {
    type: String,
    required: [true, 'Please provide a password'],
    select: false // Don't include password in queries by default
  },
  salt: {
    type: String,
    required: false, // Will be generated in pre-save hook
    select: false
  },
  role: {
    type: String,
    enum: ['EMPLOYEE', 'ADMIN', 'SUPERVISOR'],
    default: 'EMPLOYEE'
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    match: [/^[A-Za-z\s]{3,50}$/, 'Department must be 3-50 characters and contain only letters and spaces']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: {
    type: Date
  },
  passwordChangedAt: {
    type: Date,
    default: Date.now
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    validate: {
      validator: function(v) {
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please provide a valid email'
    }
  },
  phoneNumber: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^[\+]?[1-9][\d]{0,15}$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  verificationLimit: {
    type: Number,
    default: 100000, // Maximum amount employee can verify per transaction
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for account lock status
employeeSchema.virtual('isAccountLocked').get(function() {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
});

// Indexes (unique indexes are already defined in schema fields above)
employeeSchema.index({ role: 1 });
employeeSchema.index({ isActive: 1 });

// Hash password before saving
employeeSchema.pre('save', async function(next) {
  // Update updatedAt timestamp
  this.updatedAt = Date.now();
  
  // Only hash password if it's been modified
  if (!this.isModified('passwordHash')) return next();
  
  try {
    // Generate salt
    this.salt = crypto.randomBytes(32).toString('hex');
    
    // Hash password with salt using Argon2id
    const passwordWithSalt = this.passwordHash + this.salt;
    this.passwordHash = await argon2.hash(passwordWithSalt, {
      type: argon2.argon2id,
      memoryCost: parseInt(process.env.ARGON2_MEMORY) || 65536,
      parallelism: parseInt(process.env.ARGON2_PARALLELISM) || 2,
      timeCost: parseInt(process.env.ARGON2_TIME) || 3
    });
    
    this.passwordChangedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
employeeSchema.methods.validatePassword = async function(password) {
  try {
    const passwordWithSalt = password + this.salt;
    return await argon2.verify(this.passwordHash, passwordWithSalt);
  } catch (error) {
    throw new Error('Password validation failed');
  }
};

employeeSchema.methods.incrementFailedAttempts = async function() {
  const maxAttempts = 5;
  const lockTime = 15 * 60 * 1000; // 15 minutes
  
  if (this.failedLoginAttempts + 1 >= maxAttempts && !this.isAccountLocked) {
    this.lockedUntil = new Date(Date.now() + lockTime);
  }
  
  this.failedLoginAttempts += 1;
  await this.save();
};

employeeSchema.methods.resetFailedAttempts = async function() {
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  await this.save();
};

employeeSchema.methods.updateLastLogin = async function() {
  this.lastLoginAt = new Date();
  await this.save();
};

employeeSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      employeeId: this.employeeId,
      username: this.username,
      role: this.role,
      type: 'employee'
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'secure-payments-portal',
      audience: 'banking-employees'
    }
  );
};

employeeSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      type: 'employee_refresh'
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'secure-payments-portal',
      audience: 'banking-employees'
    }
  );
};

// Static methods
employeeSchema.statics.findByCredentials = async function(username, employeeId) {
  const employee = await this.findOne({
    username: username,
    employeeId: employeeId,
    isActive: true
  }).select('+passwordHash +salt');
  
  if (!employee) {
    throw new Error('Invalid credentials');
  }
  
  if (employee.isAccountLocked) {
    throw new Error('Account is temporarily locked due to too many failed attempts');
  }
  
  return employee;
};

employeeSchema.statics.findByEmployeeId = async function(employeeId) {
  return await this.findOne({ employeeId, isActive: true });
};

module.exports = mongoose.model('Employee', employeeSchema);

