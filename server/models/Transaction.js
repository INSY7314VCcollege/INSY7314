const mongoose = require('mongoose');
const crypto = require('crypto');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be at least 0.01'],
    max: [999999999.99, 'Amount cannot exceed 999,999,999.99']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    enum: {
      values: ['USD', 'EUR', 'GBP', 'ZAR', 'JPY', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK'],
      message: 'Currency must be one of: USD, EUR, GBP, ZAR, JPY, CAD, AUD, CHF, SEK, NOK'
    }
  },
  provider: {
    type: String,
    required: [true, 'Provider is required'],
    default: 'SWIFT',
    enum: {
      values: ['SWIFT', 'FEDWIRE', 'CHIPS'],
      message: 'Provider must be one of: SWIFT, FEDWIRE, CHIPS'
    }
  },
  recipientName: {
    type: String,
    required: [true, 'Recipient name is required'],
    minlength: [3, 'Recipient name must be at least 3 characters'],
    maxlength: [50, 'Recipient name cannot exceed 50 characters'],
    match: [/^[A-Za-z\s]{3,50}$/, 'Recipient name can only contain letters and spaces']
  },
  recipientAccountNumber: {
    type: String,
    required: [true, 'Recipient account number is required'],
    match: [/^[A-Za-z0-9]{8,20}$/, 'Recipient account number must be 8-20 alphanumeric characters']
  },
  recipientBankCode: {
    type: String,
    required: [true, 'Recipient bank code is required'],
    match: [/^[A-Z0-9]{8,11}$/, 'Recipient bank code must be 8-11 alphanumeric characters']
  },
  swiftCode: {
    type: String,
    required: [true, 'SWIFT code is required'],
    match: [/^[A-Z]{6}[A-Z0-9]{2,5}$/, 'SWIFT code must be in format: 6 letters followed by 2-5 alphanumeric characters']
  },
  recipientBankName: {
    type: String,
    required: [true, 'Recipient bank name is required'],
    minlength: [3, 'Bank name must be at least 3 characters'],
    maxlength: [100, 'Bank name cannot exceed 100 characters'],
    match: [/^[A-Za-z\s]{3,100}$/, 'Bank name can only contain letters and spaces']
  },
  recipientBankAddress: {
    type: String,
    maxlength: [500, 'Bank address cannot exceed 500 characters']
  },
  purpose: {
    type: String,
    maxlength: [100, 'Purpose cannot exceed 100 characters'],
    match: [/^[A-Za-z0-9\s]{0,100}$/, 'Purpose can only contain letters, numbers, and spaces']
  },
  reference: {
    type: String,
    maxlength: [50, 'Reference cannot exceed 50 characters'],
    match: [/^[A-Za-z0-9]{0,50}$/, 'Reference can only contain letters and numbers']
  },
  status: {
    type: String,
    enum: {
      values: ['PENDING', 'VERIFIED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED'],
      message: 'Status must be one of: PENDING, VERIFIED, PROCESSING, COMPLETED, REJECTED, CANCELLED'
    },
    default: 'PENDING'
  },
  exchangeRate: {
    type: Number,
    min: [0, 'Exchange rate must be positive']
  },
  fees: {
    type: Number,
    default: 0.00,
    min: [0, 'Fees cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: false // Will be calculated in pre-save hook
  },
  verificationCode: {
    type: String,
    length: 6
  },
  verifiedAt: {
    type: Date
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
transactionSchema.index({ userId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ swiftCode: 1 });
transactionSchema.index({ currency: 1 });

// Pre-save middleware
transactionSchema.pre('save', function(next) {
  // Calculate total amount including fees
  this.totalAmount = parseFloat(this.amount) + parseFloat(this.fees || 0);
  
  // Generate verification code if not already set
  if (!this.verificationCode) {
    this.verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  }
  
  next();
});

// Instance methods
transactionSchema.methods.markAsVerified = async function() {
  this.status = 'VERIFIED';
  this.verifiedAt = new Date();
  await this.save();
};

transactionSchema.methods.markAsProcessing = async function() {
  this.status = 'PROCESSING';
  this.processedAt = new Date();
  await this.save();
};

transactionSchema.methods.markAsCompleted = async function() {
  this.status = 'COMPLETED';
  this.completedAt = new Date();
  await this.save();
};

transactionSchema.methods.markAsRejected = async function(reason) {
  this.status = 'REJECTED';
  this.rejectionReason = reason;
  await this.save();
};

transactionSchema.methods.markAsCancelled = async function() {
  this.status = 'CANCELLED';
  await this.save();
};

// Static methods
transactionSchema.statics.findByUser = function(userId, limit = 50, skip = 0) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('userId', 'username accountNumber');
};

transactionSchema.statics.findByStatus = function(status, limit = 50, skip = 0) {
  return this.find({ status })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('userId', 'username accountNumber');
};

transactionSchema.statics.getTotalByCurrency = function(currency, startDate, endDate) {
  const matchStage = {
    currency,
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  return this.aggregate([
    { $match: matchStage },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
};

transactionSchema.statics.getTransactionStats = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
};

module.exports = mongoose.model('Transaction', transactionSchema);