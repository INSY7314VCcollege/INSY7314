const express = require('express');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const User = require('../models/User');
const { auditLogger } = require('../middleware/auditLogger');
const { inputValidation } = require('../middleware/inputValidation');
const { asyncHandler } = require('../middleware/errorHandler');
const { auth } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { 
      userId,
      iat: Math.floor(Date.now() / 1000),
      type: 'access'
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'secure-payments-portal',
      audience: 'banking-customers'
    }
  );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { 
      userId,
      iat: Math.floor(Date.now() / 1000),
      type: 'refresh'
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'secure-payments-portal',
      audience: 'banking-customers'
    }
  );
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new customer
 * @access  Public
 */
router.post('/register', 
  asyncHandler(async (req, res) => {
    const { fullName, idNumber, accountNumber, username, password, passwordHash, email, phoneNumber } = req.body;
    
    // Use password if passwordHash is not provided (frontend compatibility)
    const userPassword = passwordHash || password;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { idNumber },
        { accountNumber },
        { username }
      ]
    });

    if (existingUser) {
      auditLogger.logSecurityEvent('DUPLICATE_REGISTRATION_ATTEMPT', req, {
        idNumber,
        accountNumber,
        username
      });
      
      return res.status(400).json({
        success: false,
        error: 'User already exists with this ID number, account number, or username'
      });
    }

    // Create new user
    let user;
    try {
      user = await User.create({
        fullName,
        idNumber,
        accountNumber,
        username,
        passwordHash: userPassword, // Will be hashed in the model hook
        email: email || null,
        phoneNumber: phoneNumber || null
      });
    } catch (createError) {
      console.error('User creation error:', createError);
      return res.status(400).json({
        success: false,
        error: 'Registration failed. Please check your input data.',
        details: process.env.NODE_ENV === 'development' ? createError.message : undefined
      });
    }

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Log successful registration
    auditLogger.logAuthenticationEvent('REGISTRATION_SUCCESS', req, true, {
      userId: user.id,
      username: user.username,
      accountNumber: user.accountNumber
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          accountNumber: user.accountNumber,
          email: user.email,
          phoneNumber: user.phoneNumber,
          createdAt: user.createdAt
        },
        token,
        refreshToken
      }
    });
  })
);

/**
 * @route   POST /api/auth/login
 * @desc    Login customer
 * @access  Public
 */
router.post('/login',
  asyncHandler(async (req, res) => {
    const { username, accountNumber, password } = req.body;

    try {
      // Find user by credentials
      const user = await User.findByCredentials(username, accountNumber);

      // Validate password
      const isPasswordValid = await user.validatePassword(password);

      if (!isPasswordValid) {
        // Increment failed attempts
        await user.incrementFailedAttempts();
        
        auditLogger.logAuthenticationEvent('LOGIN_FAILED', req, false, {
          username,
          accountNumber,
          reason: 'Invalid password'
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Reset failed attempts on successful login
      await user.resetFailedAttempts();
      await user.updateLastLogin();

      // Generate tokens
      const token = generateToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // Log successful login
      auditLogger.logAuthenticationEvent('LOGIN_SUCCESS', req, true, {
        userId: user.id,
        username: user.username,
        accountNumber: user.accountNumber
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            fullName: user.fullName,
            username: user.username,
            accountNumber: user.accountNumber,
            email: user.email,
            phoneNumber: user.phoneNumber,
            lastLoginAt: user.lastLoginAt
          },
          token,
          refreshToken
        }
      });

    } catch (error) {
      auditLogger.logAuthenticationEvent('LOGIN_FAILED', req, false, {
        username,
        accountNumber,
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
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token type'
        });
      }

      // Check if user still exists and is active
      const userId = decoded.userId || decoded.id;
      const user = await User.findById(userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'User not found or inactive'
        });
      }

      // Generate new tokens
      const newToken = generateToken(user.id);
      const newRefreshToken = generateRefreshToken(user.id);

      auditLogger.logAuthenticationEvent('TOKEN_REFRESH', req, true, {
        userId: user.id
      });

      res.json({
        success: true,
        data: {
          token: newToken,
          refreshToken: newRefreshToken
        }
      });

    } catch (error) {
      auditLogger.logAuthenticationEvent('TOKEN_REFRESH_FAILED', req, false, {
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
 * @route   POST /api/auth/logout
 * @desc    Logout customer
 * @access  Private
 */
router.post('/logout', auth, asyncHandler(async (req, res) => {
  // In a real implementation, you would blacklist the token
  // For now, we'll just log the logout event
  
  auditLogger.logAuthenticationEvent('LOGOUT', req, true, {
    userId: req.user.id
  });

  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', auth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id || req.user.id).select('-passwordHash -salt -twoFactorSecret');

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        accountNumber: user.accountNumber,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      }
    }
  });
}));

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password',
  auth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Verify current password
    const isCurrentPasswordValid = await user.validatePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      auditLogger.logSecurityEvent('PASSWORD_CHANGE_FAILED', req, {
        userId: user.id,
        reason: 'Invalid current password'
      });

      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.passwordHash = newPassword; // Will be hashed in the model hook
    await user.save();

    auditLogger.logSecurityEvent('PASSWORD_CHANGED', req, {
      userId: user.id
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password',
  asyncHandler(async (req, res) => {
    const { username, accountNumber } = req.body;

    try {
      const user = await User.findByCredentials(username, accountNumber);
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour

      // Store reset token (in production, use Redis or database)
      // For now, we'll just log it
      auditLogger.logSecurityEvent('PASSWORD_RESET_REQUESTED', req, {
        userId: user.id,
        resetToken,
        resetExpires
      });

      res.json({
        success: true,
        message: 'Password reset instructions have been sent to your registered email'
      });

    } catch (error) {
      // Don't reveal if user exists or not
      res.json({
        success: true,
        message: 'If an account exists with these credentials, password reset instructions have been sent'
      });
    }
  })
);

module.exports = router;