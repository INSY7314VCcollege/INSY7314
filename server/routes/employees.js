const express = require('express');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');
const Transaction = require('../models/Transaction');
const { auditLogger } = require('../middleware/auditLogger');
const inputValidation = require('../middleware/inputValidation');
const { asyncHandler } = require('../middleware/errorHandler');
const { employeeAuth } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();

/**
 * Generate JWT token for employee
 */
const generateEmployeeToken = (employeeId) => {
  return jwt.sign(
    { 
      employeeId,
      iat: Math.floor(Date.now() / 1000),
      type: 'employee_access'
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'secure-payments-portal',
      audience: 'banking-employees'
    }
  );
};

/**
 * Generate refresh token for employee
 */
const generateEmployeeRefreshToken = (employeeId) => {
  return jwt.sign(
    { 
      employeeId,
      iat: Math.floor(Date.now() / 1000),
      type: 'employee_refresh'
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'secure-payments-portal',
      audience: 'banking-employees'
    }
  );
};

/**
 * @route   POST /api/employees/login
 * @desc    Employee login (NO REGISTRATION - employees are pre-registered)
 * @access  Public
 */
router.post('/login', 
  asyncHandler(async (req, res) => {
    const { username, employeeId, password } = req.body;

    // Input validation with RegEx patterns
    if (!username || !inputValidation.patterns.username.test(username)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid username format'
      });
    }

    if (!employeeId || !/^[A-Z0-9]{6,10}$/.test(employeeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid employee ID format'
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    try {
      // Find employee by credentials
      const employee = await Employee.findByCredentials(username, employeeId);

      // Validate password
      const isPasswordValid = await employee.validatePassword(password);

      if (!isPasswordValid) {
        // Increment failed attempts
        await employee.incrementFailedAttempts();
        
        auditLogger.logAuthenticationEvent('EMPLOYEE_LOGIN_FAILED', req, false, {
          username,
          employeeId,
          reason: 'Invalid password'
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Reset failed attempts on successful login
      await employee.resetFailedAttempts();
      await employee.updateLastLogin();

      // Generate tokens
      const token = generateEmployeeToken(employee._id.toString());
      const refreshToken = generateEmployeeRefreshToken(employee._id.toString());

      // Log successful login
      auditLogger.logAuthenticationEvent('EMPLOYEE_LOGIN_SUCCESS', req, true, {
        employeeId: employee._id.toString(),
        username: employee.username,
        employeeId: employee.employeeId,
        role: employee.role
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          employee: {
            id: employee._id.toString(),
            employeeId: employee.employeeId,
            fullName: employee.fullName,
            username: employee.username,
            email: employee.email,
            role: employee.role,
            department: employee.department,
            lastLoginAt: employee.lastLoginAt
          },
          token,
          refreshToken
        }
      });

    } catch (error) {
      auditLogger.logAuthenticationEvent('EMPLOYEE_LOGIN_FAILED', req, false, {
        username,
        employeeId,
        reason: error.message
      });

      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
  })
);

/**
 * @route   POST /api/employees/refresh
 * @desc    Refresh employee access token
 * @access  Public
 */
router.post('/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      
      if (decoded.type !== 'employee_refresh') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token type'
        });
      }

      // Check if employee still exists and is active
      const employee = await Employee.findById(decoded.employeeId);
      if (!employee || !employee.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Employee not found or inactive'
        });
      }

      // Generate new tokens
      const newToken = generateEmployeeToken(employee._id.toString());
      const newRefreshToken = generateEmployeeRefreshToken(employee._id.toString());

      auditLogger.logAuthenticationEvent('EMPLOYEE_TOKEN_REFRESH', req, true, {
        employeeId: employee._id.toString()
      });

      res.json({
        success: true,
        data: {
          token: newToken,
          refreshToken: newRefreshToken
        }
      });

    } catch (error) {
      auditLogger.logAuthenticationEvent('EMPLOYEE_TOKEN_REFRESH_FAILED', req, false, {
        reason: error.message
      });

      res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }
  })
);

/**
 * @route   POST /api/employees/logout
 * @desc    Employee logout
 * @access  Private (Employee)
 */
router.post('/logout', employeeAuth, asyncHandler(async (req, res) => {
  auditLogger.logAuthenticationEvent('EMPLOYEE_LOGOUT', req, true, {
    employeeId: req.employee._id.toString()
  });

  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

/**
 * @route   GET /api/employees/me
 * @desc    Get current employee
 * @access  Private (Employee)
 */
router.get('/me', employeeAuth, asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.employee.id).select('-passwordHash -salt -twoFactorSecret');

  if (!employee) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found'
    });
  }

  res.json({
    success: true,
    data: {
      employee: {
        id: employee._id.toString(),
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        username: employee.username,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        isActive: employee.isActive,
        lastLoginAt: employee.lastLoginAt,
        createdAt: employee.createdAt
      }
    }
  });
}));

/**
 * @route   GET /api/employees/transactions
 * @desc    Get all pending transactions for employee verification
 * @access  Private (Employee)
 */
router.get('/transactions',
  employeeAuth,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;
    const status = req.query.status || 'PENDING'; // Default to PENDING

    // Validate status
    const validStatuses = ['PENDING', 'VERIFIED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status filter'
      });
    }

    const query = { status };
    if (status === 'PENDING') {
      // Only show PENDING transactions
      query.status = 'PENDING';
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('userId', 'username accountNumber fullName')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Transaction.countDocuments(query)
    ]);

    // Log data access
    auditLogger.logDataAccess('EMPLOYEE_TRANSACTIONS_ACCESSED', req, 'transactions', {
      employeeId: req.employee._id.toString(),
      count: transactions.length,
      page,
      limit,
      status
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  })
);

/**
 * @route   GET /api/employees/transactions/:id
 * @desc    Get specific transaction details
 * @access  Private (Employee)
 */
router.get('/transactions/:id',
  employeeAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID format'
      });
    }

    const transaction = await Transaction.findById(id)
      .populate('userId', 'username accountNumber fullName idNumber')
      .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Log data access
    auditLogger.logDataAccess('EMPLOYEE_TRANSACTION_ACCESSED', req, 'transaction', {
      employeeId: req.employee._id.toString(),
      transactionId: id
    });

    res.json({
      success: true,
      data: {
        transaction
      }
    });
  })
);

/**
 * @route   POST /api/employees/transactions/:id/verify
 * @desc    Verify a transaction (employee checks account info and SWIFT code)
 * @access  Private (Employee)
 */
router.post('/transactions/:id/verify',
  employeeAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { verified, notes } = req.body;

    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID format'
      });
    }

    // Validate verified flag
    if (typeof verified !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Verified flag must be a boolean'
      });
    }

    // Validate notes if provided
    if (notes && (typeof notes !== 'string' || notes.length > 500)) {
      return res.status(400).json({
        success: false,
        error: 'Notes must be a string with max 500 characters'
      });
    }

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    if (transaction.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Transaction is not in PENDING status'
      });
    }

    // Check if employee has permission to verify this amount
    if (verified && transaction.amount > req.employee.verificationLimit && req.employee.role !== 'ADMIN' && req.employee.role !== 'SUPERVISOR') {
      return res.status(403).json({
        success: false,
        error: `Transaction amount exceeds your verification limit of ${req.employee.verificationLimit}. Please contact a supervisor.`
      });
    }

    if (verified) {
      // Mark as verified
      await transaction.markAsVerified();
      
      auditLogger.logPaymentEvent('TRANSACTION_VERIFIED', req, {
        transactionId: transaction._id.toString(),
        employeeId: req.employee._id.toString(),
        employeeName: req.employee.fullName,
        amount: transaction.amount,
        currency: transaction.currency,
        notes: notes || null
      });
    } else {
      // Reject transaction
      await transaction.markAsRejected(notes || 'Rejected by employee');
      
      auditLogger.logPaymentEvent('TRANSACTION_REJECTED', req, {
        transactionId: transaction._id.toString(),
        employeeId: req.employee._id.toString(),
        employeeName: req.employee.fullName,
        amount: transaction.amount,
        currency: transaction.currency,
        reason: notes || 'Rejected by employee'
      });
    }

    res.json({
      success: true,
      message: verified ? 'Transaction verified successfully' : 'Transaction rejected',
      data: {
        transaction: {
          id: transaction._id.toString(),
          status: transaction.status,
          verifiedAt: transaction.verifiedAt,
          rejectionReason: transaction.rejectionReason
        }
      }
    });
  })
);

/**
 * @route   POST /api/employees/transactions/submit-to-swift
 * @desc    Submit verified transactions to SWIFT
 * @access  Private (Employee)
 */
router.post('/transactions/submit-to-swift',
  employeeAuth,
  asyncHandler(async (req, res) => {
    const { transactionIds } = req.body;

    // Validate transactionIds array
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Transaction IDs array is required'
      });
    }

    if (transactionIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 transactions can be submitted at once'
      });
    }

    // Validate each transaction ID format
    for (const id of transactionIds) {
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({
          success: false,
          error: `Invalid transaction ID format: ${id}`
        });
      }
    }

    // Find all transactions
    const transactions = await Transaction.find({
      _id: { $in: transactionIds },
      status: 'VERIFIED'
    });

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No verified transactions found'
      });
    }

    if (transactions.length !== transactionIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Some transactions are not in VERIFIED status or do not exist'
      });
    }

    // Submit each transaction to SWIFT (mark as PROCESSING)
    const submittedTransactions = [];
    for (const transaction of transactions) {
      await transaction.markAsProcessing();
      submittedTransactions.push({
        id: transaction._id.toString(),
        amount: transaction.amount,
        currency: transaction.currency,
        swiftCode: transaction.swiftCode
      });

      // Log submission
      auditLogger.logPaymentEvent('TRANSACTION_SUBMITTED_TO_SWIFT', req, {
        transactionId: transaction._id.toString(),
        employeeId: req.employee._id.toString(),
        employeeName: req.employee.fullName,
        amount: transaction.amount,
        currency: transaction.currency,
        swiftCode: transaction.swiftCode
      });
    }

    res.json({
      success: true,
      message: `${submittedTransactions.length} transaction(s) submitted to SWIFT successfully`,
      data: {
        transactions: submittedTransactions,
        count: submittedTransactions.length
      }
    });
  })
);

/**
 * @route   GET /api/employees/statistics
 * @desc    Get transaction statistics for employee dashboard
 * @access  Private (Employee)
 */
router.get('/statistics',
  employeeAuth,
  asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      pendingCount,
      verifiedCount,
      processingCount,
      completedCount,
      rejectedCount,
      totalToday,
      totalAmountToday
    ] = await Promise.all([
      Transaction.countDocuments({ status: 'PENDING' }),
      Transaction.countDocuments({ status: 'VERIFIED' }),
      Transaction.countDocuments({ status: 'PROCESSING' }),
      Transaction.countDocuments({ status: 'COMPLETED' }),
      Transaction.countDocuments({ status: 'REJECTED' }),
      Transaction.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: today, $lt: tomorrow }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const totalAmount = totalAmountToday.length > 0 ? totalAmountToday[0].total : 0;

    res.json({
      success: true,
      data: {
        statistics: {
          pending: pendingCount,
          verified: verifiedCount,
          processing: processingCount,
          completed: completedCount,
          rejected: rejectedCount,
          totalToday,
          totalAmountToday: totalAmount
        }
      }
    });
  })
);

module.exports = router;

