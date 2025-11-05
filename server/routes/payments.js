const express = require('express');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { auditLogger } = require('../middleware/auditLogger');
const { inputValidation } = require('../middleware/inputValidation');
const { auth, sensitiveOperationAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Joi = require('joi');

const router = express.Router();

// Import rate limiter for payment endpoint
const rateLimit = require('express-rate-limit');

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 20 : 10, // More permissive in development
  message: {
    error: 'Too many payment attempts, please wait before trying again.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Key by user ID if authenticated, otherwise by IP
    if (req.user && req.user.id) {
      return `user_${req.user.id.toString()}`;
    }
    return `ip_${req.ip}`;
  },
  skipSuccessfulRequests: true // Only count failed attempts
});

/**
 * @route   POST /api/payments/make-payment
 * @desc    Create a new payment transaction
 * @access  Private
 */
router.post('/make-payment',
  auth,
  paymentLimiter,
  sensitiveOperationAuth,
  asyncHandler(async (req, res) => {
    const {
      amount,
      currency,
      provider,
      recipientName,
      recipientAccountNumber,
      swiftCode,
      recipientBankName,
      recipientBankAddress,
      purpose,
      reference
    } = req.body;

    const userId = req.user._id || req.user.id;

    // Additional validation
    const amountNum = parseFloat(amount);
    const minAmount = parseFloat(process.env.MIN_PAYMENT_AMOUNT) || 1.00;
    const maxAmount = parseFloat(process.env.MAX_PAYMENT_AMOUNT) || 100000.00;

    if (amountNum < minAmount || amountNum > maxAmount) {
      return res.status(400).json({
        success: false,
        error: `Amount must be between ${minAmount} and ${maxAmount}`
      });
    }

    // Check daily transaction limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTransactions = await Transaction.find({
      userId,
      status: { $in: ['PENDING', 'VERIFIED', 'PROCESSING', 'COMPLETED'] },
      createdAt: { $gte: today, $lt: tomorrow }
    });

    const todayTotal = todayTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const dailyLimit = 50000.00; // $50,000 daily limit

    if (todayTotal + amountNum > dailyLimit) {
      return res.status(400).json({
        success: false,
        error: 'Daily transaction limit exceeded'
      });
    }

    // Calculate fees based on amount and currency
    let fees = 0;
    if (amountNum <= 1000) {
      fees = 15.00; // $15 for amounts up to $1000
    } else if (amountNum <= 10000) {
      fees = 25.00; // $25 for amounts up to $10,000
    } else {
      fees = 50.00; // $50 for amounts over $10,000
    }

    // Calculate total amount (amount + fees)
    const totalAmount = amountNum + fees;

    // Create transaction
    const transaction = await Transaction.create({
      userId,
      amount: amountNum,
      currency,
      provider: provider || 'SWIFT',
      recipientName,
      recipientAccountNumber,
      recipientBankCode: swiftCode, // Use SWIFT code as bank code (required field)
      swiftCode,
      recipientBankName,
      recipientBankAddress: recipientBankAddress || null,
      purpose: purpose || null,
      reference: reference || null,
      fees,
      totalAmount, // Explicitly set totalAmount to avoid validation error
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        timestamp: new Date().toISOString()
      }
    });

    // Log payment creation
    auditLogger.logPaymentEvent('PAYMENT_CREATED', req, {
      transactionId: transaction._id || transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      recipientName: transaction.recipientName,
      swiftCode: transaction.swiftCode
    });

    res.status(201).json({
      success: true,
      message: 'Payment transaction created successfully',
      data: {
        transaction: {
          id: transaction._id || transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          provider: transaction.provider,
          recipientName: transaction.recipientName,
          recipientAccountNumber: transaction.recipientAccountNumber,
          swiftCode: transaction.swiftCode,
          recipientBankName: transaction.recipientBankName,
          purpose: transaction.purpose,
          reference: transaction.reference,
          fees: transaction.fees,
          totalAmount: transaction.totalAmount,
          status: transaction.status,
          verificationCode: transaction.verificationCode,
          createdAt: transaction.createdAt
        }
      }
    });
  })
);

/**
 * @route   GET /api/payments/transactions
 * @desc    Get user's transactions
 * @access  Private
 */
router.get('/transactions',
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const [transactions, count] = await Promise.all([
      Transaction.find(query)
        .select('-metadata') // Exclude sensitive metadata
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip),
      Transaction.countDocuments(query)
    ]);

    // Log data access
    auditLogger.logDataAccess('TRANSACTIONS_ACCESSED', req, 'transactions', {
      userId,
      count: transactions.length,
      page,
      limit
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: limit
        }
      }
    });
  })
);

/**
 * @route   GET /api/payments/transactions/:id
 * @desc    Get specific transaction details
 * @access  Private
 */
router.get('/transactions/:id',
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const transaction = await Transaction.findOne({
      _id: id,
      userId
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Log data access
    auditLogger.logDataAccess('TRANSACTION_ACCESSED', req, 'transaction', {
      userId,
      transactionId: id
    });

    res.json({
      success: true,
      data: {
        transaction: {
          id: transaction._id || transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          provider: transaction.provider,
          recipientName: transaction.recipientName,
          recipientAccountNumber: transaction.recipientAccountNumber,
          swiftCode: transaction.swiftCode,
          recipientBankName: transaction.recipientBankName,
          recipientBankAddress: transaction.recipientBankAddress,
          purpose: transaction.purpose,
          reference: transaction.reference,
          fees: transaction.fees,
          totalAmount: transaction.totalAmount,
          status: transaction.status,
          verificationCode: transaction.verificationCode,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
          verifiedAt: transaction.verifiedAt,
          processedAt: transaction.processedAt,
          completedAt: transaction.completedAt,
          rejectionReason: transaction.rejectionReason
        }
      }
    });
  })
);

/**
 * @route   PUT /api/payments/transactions/:id/cancel
 * @desc    Cancel a pending transaction
 * @access  Private
 */
router.put('/transactions/:id/cancel',
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const transaction = await Transaction.findOne({
      _id: id,
      userId
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    if (transaction.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Only pending transactions can be cancelled'
      });
    }

    await transaction.markAsCancelled();

    // Log cancellation
    auditLogger.logPaymentEvent('PAYMENT_CANCELLED', req, {
      transactionId: transaction._id || transaction.id,
      amount: transaction.amount,
      currency: transaction.currency
    });

    res.json({
      success: true,
      message: 'Transaction cancelled successfully',
      data: {
        transaction: {
          id: transaction._id || transaction.id,
          status: transaction.status
        }
      }
    });
  })
);

/**
 * @route   GET /api/payments/currencies
 * @desc    Get supported currencies
 * @access  Public
 */
router.get('/currencies', (req, res) => {
  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' }
  ];

  res.json({
    success: true,
    data: { currencies }
  });
});

/**
 * @route   GET /api/payments/providers
 * @desc    Get supported payment providers
 * @access  Public
 */
router.get('/providers', (req, res) => {
  const providers = [
    { code: 'SWIFT', name: 'SWIFT Network', description: 'Society for Worldwide Interbank Financial Telecommunication' },
    { code: 'FEDWIRE', name: 'Fedwire', description: 'Federal Reserve Wire Network' },
    { code: 'CHIPS', name: 'CHIPS', description: 'Clearing House Interbank Payments System' }
  ];

  res.json({
    success: true,
    data: { providers }
  });
});

/**
 * @route   GET /api/payments/limits
 * @desc    Get transaction limits and fees
 * @access  Private
 */
router.get('/limits',
  auth,
  (req, res) => {
    const limits = {
      minAmount: parseFloat(process.env.MIN_PAYMENT_AMOUNT) || 1.00,
      maxAmount: parseFloat(process.env.MAX_PAYMENT_AMOUNT) || 100000.00,
      dailyLimit: 50000.00,
      fees: {
        upTo1000: 15.00,
        upTo10000: 25.00,
        over10000: 50.00
      },
      supportedCurrencies: inputValidation.supportedCurrencies || ['USD', 'EUR', 'GBP', 'ZAR', 'JPY', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK']
    };

    res.json({
      success: true,
      data: { limits }
    });
  });

/**
 * @route   POST /api/payments/validate-swift
 * @desc    Validate SWIFT code
 * @access  Private
 */
router.post('/validate-swift',
  auth,
  asyncHandler(async (req, res) => {
    const { swiftCode } = req.body;

    // In a real implementation, you would validate against a SWIFT code database
    // For now, we'll do basic pattern validation
    const isValid = inputValidation && inputValidation.patterns && inputValidation.patterns.swiftCode
      ? inputValidation.patterns.swiftCode.test(swiftCode)
      : /^[A-Z]{6}[A-Z0-9]{2,5}$/.test(swiftCode);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid SWIFT code format'
      });
    }

    // Mock validation response
    res.json({
      success: true,
      data: {
        swiftCode,
        isValid: true,
        bankName: 'Mock Bank Name',
        country: 'Mock Country',
        city: 'Mock City'
      }
    });
  })
);

module.exports = router;
